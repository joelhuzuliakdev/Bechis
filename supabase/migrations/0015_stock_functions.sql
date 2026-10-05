-- 0015_stock_functions.sql
-- Funciones atómicas de stock. Solo las puede ejecutar el servidor
-- (service_role). Hasta que se cambie el código, nada las llama: esta
-- migración NO altera el comportamiento actual salvo por el cierre de
-- permisos de decrement_product_stock (ver final).

-- ---------------------------------------------------------------------------
-- Qué consume un pedido: cantidad x consumo por porción, + extras agregados.
-- Devuelve una fila por ítem (producto o ingrediente) con el total requerido.
-- ---------------------------------------------------------------------------
create or replace function public.order_stock_requirements(p_order_id uuid)
returns table (target text, item_id uuid, required numeric)
language sql
stable
security definer
set search_path = public
as $$
  select t.target, t.item_id, sum(t.required)::numeric
  from (
    -- 1) Producto terminado con stock propio: 1 por unidad pedida.
    select 'producto'::text as target, oi.product_id as item_id, oi.quantity::numeric as required
    from order_items oi
    join products p on p.id = oi.product_id
    where oi.order_id = p_order_id and p.track_stock

    union all

    -- 2) Extras agregados por el cliente: unidades pedidas x extra_quantity.
    --    (CONFIRMAR con orders/create.ts que el extra aplica a cada unidad.)
    select 'ingrediente', oii.ingredient_id, oi.quantity::numeric * i.extra_quantity
    from order_items oi
    join order_item_ingredients oii on oii.order_item_id = oi.id and oii.action = 'agregado'
    join ingredients i on i.id = oii.ingredient_id
    where oi.order_id = p_order_id

    union all

    -- 3) Receta: ingredientes con consumo por porción, salvo los quitados.
    select 'ingrediente', pi.ingredient_id, oi.quantity::numeric * pi.quantity_per_unit
    from order_items oi
    join product_ingredients pi
      on pi.product_id = oi.product_id and pi.quantity_per_unit is not null
    where oi.order_id = p_order_id
      and not exists (
        select 1 from order_item_ingredients q
        where q.order_item_id = oi.id
          and q.ingredient_id = pi.ingredient_id
          and q.action = 'quitado'
      )
  ) t
  group by t.target, t.item_id
$$;

-- ---------------------------------------------------------------------------
-- Confirmar pedido + descontar stock, todo en una transacción.
-- Si falta stock no cambia NADA y devuelve qué falta.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_order_with_stock(p_order_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order   public.orders%rowtype;
  v_req     jsonb;
  v_missing jsonb;
  r         record;
begin
  perform set_config('app.stock_write', 'on', true);

  -- Bloquea el pedido: dos confirmaciones simultáneas se serializan acá.
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_order.status <> 'pedidos' then
    return jsonb_build_object('ok', false, 'code', 'invalid_status', 'status', v_order.status);
  end if;
  if v_order.stock_deducted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'already_deducted');
  end if;

  -- Se calcula UNA sola vez y se usa para validar, descontar y registrar.
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_req
  from public.order_stock_requirements(p_order_id) x;

  -- Bloqueo de filas de stock en orden fijo (productos, luego ingredientes,
  -- por id) para evitar deadlocks entre pedidos concurrentes.
  perform 1 from public.products p
   where p.id in (select (e->>'item_id')::uuid from jsonb_array_elements(v_req) e where e->>'target' = 'producto')
   order by p.id for update;
  perform 1 from public.ingredients i
   where i.id in (select (e->>'item_id')::uuid from jsonb_array_elements(v_req) e where e->>'target' = 'ingrediente')
   order by i.id for update;

  -- ¿Alcanza todo?
  select jsonb_agg(jsonb_build_object(
           'target',    x.target,
           'id',        x.item_id,
           'name',      coalesce(p.name, i.name),
           'unit',      coalesce(i.unit, 'unidad'),
           'required',  x.required,
           'available', coalesce(p.stock, i.stock, 0)))
    into v_missing
  from jsonb_to_recordset(v_req) as x(target text, item_id uuid, required numeric)
  left join public.products p    on x.target = 'producto'    and p.id = x.item_id
  left join public.ingredients i on x.target = 'ingrediente' and i.id = x.item_id
  where x.required > coalesce(p.stock, i.stock, 0);

  if v_missing is not null then
    return jsonb_build_object('ok', false, 'code', 'insufficient_stock', 'missing', v_missing);
  end if;

  -- Descuento + movimiento, ítem por ítem.
  for r in
    select * from jsonb_to_recordset(v_req) as x(target text, item_id uuid, required numeric)
    order by (x.target = 'ingrediente'), x.item_id
  loop
    if r.target = 'producto' then
      update public.products set stock = stock - r.required where id = r.item_id;
      insert into public.stock_movements (target, product_id, type, quantity, reason, order_id, user_id)
      values ('producto', r.item_id, 'consumo_pedido', r.required,
              format('Pedido #%s confirmado', v_order.order_number), p_order_id, p_user_id);
    else
      update public.ingredients set stock = stock - r.required where id = r.item_id;
      insert into public.stock_movements (target, ingredient_id, type, quantity, reason, order_id, user_id)
      values ('ingrediente', r.item_id, 'consumo_pedido', r.required,
              format('Pedido #%s confirmado', v_order.order_number), p_order_id, p_user_id);
    end if;
  end loop;

  update public.orders
     set status = 'confirmado',
         accepted_at = now(),
         stock_deducted_at = now()
   where id = p_order_id;

  return jsonb_build_object('ok', true, 'deducted_items', jsonb_array_length(v_req));
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancelar pedido, con tratamiento del stock.
--   - Nunca descontó (estado "pedidos" o legacy): solo cancela.
--   - Cancela desde "confirmado": repone automáticamente.
--   - Desde "en_proceso" en adelante: p_stock_action = 'reponer' | 'merma'
--     (obligatorio). El control de que sea ADMIN lo hace la API.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_order_with_stock(
  p_order_id uuid,
  p_user_id uuid,
  p_reason text,
  p_stock_action text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order  public.orders%rowtype;
  v_action text;
  m        record;
begin
  perform set_config('app.stock_write', 'on', true);

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_order.status = 'cancelado' or v_order.payment_status = 'cobrado' then
    return jsonb_build_object('ok', false, 'code', 'invalid_status', 'status', v_order.status);
  end if;

  if v_order.stock_deducted_at is null then
    v_action := 'none';
  elsif v_order.status = 'confirmado' then
    v_action := 'reponer';
  else
    if p_stock_action is null or p_stock_action not in ('reponer', 'merma') then
      return jsonb_build_object('ok', false, 'code', 'stock_decision_required');
    end if;
    v_action := p_stock_action;
  end if;

  if v_action in ('reponer', 'merma') then
    -- Se revierte lo que REALMENTE se registró al confirmar (no se recalcula).
    for m in
      select target, product_id, ingredient_id, quantity
      from public.stock_movements
      where order_id = p_order_id and type = 'consumo_pedido'
      order by (target = 'ingrediente'), coalesce(product_id, ingredient_id)
    loop
      if v_action = 'reponer' then
        if m.target = 'producto' then
          update public.products set stock = stock + m.quantity where id = m.product_id;
        else
          update public.ingredients set stock = stock + m.quantity where id = m.ingredient_id;
        end if;
      end if;

      insert into public.stock_movements (target, product_id, ingredient_id, type, quantity, reason, order_id, user_id)
      values (m.target, m.product_id, m.ingredient_id,
              case when v_action = 'reponer' then 'reposicion_pedido'::public.stock_movement_type
                   else 'merma'::public.stock_movement_type end,
              m.quantity,
              format('Pedido #%s cancelado (%s)', v_order.order_number,
                     case when v_action = 'reponer' then 'stock repuesto' else 'registrado como merma' end),
              p_order_id, p_user_id);
    end loop;
  end if;

  update public.orders
     set status = 'cancelado',
         cancelled_at = now(),
         cancel_reason = p_reason
   where id = p_order_id;

  return jsonb_build_object('ok', true, 'stock', v_action);
end;
$$;

-- ---------------------------------------------------------------------------
-- Movimiento manual (ingreso / egreso / corrección), atómico y con historial.
-- Reemplaza la lógica leer-calcular-escribir de api/stock/movement.ts.
-- Un egreso mayor al stock disponible da error (ya no se corta en 0).
-- ---------------------------------------------------------------------------
create or replace function public.apply_stock_movement(
  p_target text,
  p_item_id uuid,
  p_type text,
  p_quantity numeric,
  p_reason text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current numeric;
  v_new     numeric;
  v_qty     numeric;
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform set_config('app.stock_write', 'on', true);

  if p_target not in ('producto', 'ingrediente') then
    return jsonb_build_object('ok', false, 'code', 'invalid_target');
  end if;
  if p_type not in ('ingreso', 'egreso', 'correccion') then
    return jsonb_build_object('ok', false, 'code', 'invalid_type');
  end if;
  if p_quantity is null or p_quantity < 0 or (p_type <> 'correccion' and p_quantity = 0) then
    return jsonb_build_object('ok', false, 'code', 'invalid_quantity');
  end if;

  if p_target = 'producto' then
    select stock into v_current from public.products where id = p_item_id for update;
  else
    select stock into v_current from public.ingredients where id = p_item_id for update;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if p_type = 'ingreso' then
    v_new := v_current + p_quantity;
    v_qty := p_quantity;
  elsif p_type = 'egreso' then
    if p_quantity > v_current then
      return jsonb_build_object('ok', false, 'code', 'insufficient_stock', 'available', v_current);
    end if;
    v_new := v_current - p_quantity;
    v_qty := p_quantity;
  else
    v_new := p_quantity;
    v_qty := abs(p_quantity - v_current);
    v_reason := format('Corrección: %s → %s%s', v_current, p_quantity,
                       case when v_reason is null then '' else ' (' || v_reason || ')' end);
  end if;

  if p_target = 'producto' then
    update public.products set stock = v_new where id = p_item_id;
    insert into public.stock_movements (target, product_id, type, quantity, reason, user_id)
    values ('producto', p_item_id, p_type::public.stock_movement_type, v_qty, v_reason, p_user_id);
  else
    update public.ingredients set stock = v_new where id = p_item_id;
    insert into public.stock_movements (target, ingredient_id, type, quantity, reason, user_id)
    values ('ingrediente', p_item_id, p_type::public.stock_movement_type, v_qty, v_reason, p_user_id);
  end if;

  return jsonb_build_object('ok', true, 'newStock', v_new);
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos: solo el servidor (service_role) puede ejecutar estas funciones.
-- ---------------------------------------------------------------------------
revoke all on function public.order_stock_requirements(uuid) from public, anon, authenticated;
revoke all on function public.confirm_order_with_stock(uuid, uuid) from public, anon, authenticated;
revoke all on function public.cancel_order_with_stock(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.apply_stock_movement(text, uuid, text, numeric, text, uuid) from public, anon, authenticated;
grant execute on function public.order_stock_requirements(uuid) to service_role;
grant execute on function public.confirm_order_with_stock(uuid, uuid) to service_role;
grant execute on function public.cancel_order_with_stock(uuid, uuid, text, text) to service_role;
grant execute on function public.apply_stock_movement(text, uuid, text, numeric, text, uuid) to service_role;

-- Cierra el hueco de seguridad: hoy cualquiera (incluso sin sesión) podía
-- ejecutarla. Cobrar la sigue usando vía service_role, así que no se rompe.
revoke execute on function public.decrement_product_stock(uuid, numeric) from public, anon, authenticated;