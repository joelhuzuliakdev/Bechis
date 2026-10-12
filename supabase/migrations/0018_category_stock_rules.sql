-- 0018_category_stock_rules.sql
-- Regla de consumo por categoría: "cada unidad de un producto de esta categoría
-- consume X de este ingrediente". Se define UNA vez por categoría y la heredan
-- todos los productos, incluidos los que se creen después.
--
-- Esta migración NO modifica datos de stock ni de productos. Mientras la tabla
-- esté vacía, order_stock_requirements devuelve exactamente lo mismo que antes.

create table if not exists public.category_stock_rules (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid    not null references public.categories(id) on delete cascade,
  ingredient_id     uuid    not null references public.ingredients(id) on delete restrict,
  quantity_per_unit numeric not null check (quantity_per_unit > 0),
  created_at        timestamptz not null default now(),
  unique (category_id, ingredient_id)
);

alter table public.category_stock_rules enable row level security;
revoke all on public.category_stock_rules from public, anon, authenticated;
grant all on public.category_stock_rules to service_role;

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
    select 'ingrediente', oii.ingredient_id, oi.quantity::numeric * i.extra_quantity
    from order_items oi
    join order_item_ingredients oii on oii.order_item_id = oi.id and oii.action = 'agregado'
    join ingredients i on i.id = oii.ingredient_id
    where oi.order_id = p_order_id

    union all

    -- 3) Receta del producto: ingredientes con consumo por unidad, salvo quitados.
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

    union all

    -- 4) Regla por categoría: unidades pedidas x consumo de la categoría.
    select 'ingrediente', r.ingredient_id, oi.quantity::numeric * r.quantity_per_unit
    from order_items oi
    join products p on p.id = oi.product_id
    join category_stock_rules r on r.category_id = p.category_id
    where oi.order_id = p_order_id
  ) t
  group by t.target, t.item_id
$$;

revoke all on function public.order_stock_requirements(uuid) from public, anon, authenticated;
grant execute on function public.order_stock_requirements(uuid) to service_role;