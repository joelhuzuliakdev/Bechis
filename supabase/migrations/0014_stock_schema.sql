-- 0014_stock_schema.sql
-- Solo agrega columnas e índices. No modifica datos existentes ni funciones.

-- Unidad de medida del ingrediente. Los valores actuales quedan en "unidad".
alter table public.ingredients
  add column if not exists unit text not null default 'unidad'
    check (unit in ('unidad', 'g', 'ml')),
  -- Cuánto consume UN extra agregado por el cliente (en la unidad del ingrediente).
  add column if not exists extra_quantity numeric not null default 1
    check (extra_quantity >= 0);

-- ¿El producto lleva su propio stock por unidad? (Hamburguesa, bebidas: sí.
-- Un producto que solo consume ingredientes, como Papas, se pasa a false.)
alter table public.products
  add column if not exists track_stock boolean not null default true;

-- Cuánto de este ingrediente consume UNA unidad del producto (ej. 300 g de
-- papa por porción). NULL = la receta no descuenta este ingrediente.
alter table public.product_ingredients
  add column if not exists quantity_per_unit numeric
    check (quantity_per_unit is null or quantity_per_unit > 0);

-- Marca de "este pedido ya descontó stock" (garantía de descuento único).
alter table public.orders
  add column if not exists stock_deducted_at timestamptz;

-- Vínculo movimiento -> pedido.
alter table public.stock_movements
  add column if not exists order_id uuid references public.orders(id);

create index if not exists stock_movements_order_id_idx
  on public.stock_movements (order_id);

-- Segunda garantía contra el descuento doble: a nivel base de datos, no puede
-- existir dos veces el mismo tipo de movimiento para el mismo pedido e ítem.
create unique index if not exists stock_movements_order_item_type_uniq
  on public.stock_movements (order_id, type, target, coalesce(product_id, ingredient_id))
  where order_id is not null;