-- 0017_stock_write_guard.sql
-- *** EJECUTAR AL FINAL, recién cuando el código nuevo esté desplegado. ***
-- Si se ejecuta antes, rompe: Cobrar (usa decrement_product_stock), los PATCH
-- de productos/ingredientes y los formularios que editan stock directo.
--
-- Impide cambiar la columna `stock` por fuera de las funciones de stock
-- (que activan app.stock_write dentro de su transacción). Así ningún
-- endpoint ni empleado puede saltearse el historial.

create or replace function public.guard_stock_write()
returns trigger
language plpgsql
as $$
begin
  if new.stock is distinct from old.stock
     and coalesce(current_setting('app.stock_write', true), '') <> 'on' then
    raise exception 'El stock solo puede modificarse mediante movimientos de stock';
  end if;
  return new;
end;
$$;

drop trigger if exists products_guard_stock on public.products;
create trigger products_guard_stock
  before update of stock on public.products
  for each row execute function public.guard_stock_write();

drop trigger if exists ingredients_guard_stock on public.ingredients;
create trigger ingredients_guard_stock
  before update of stock on public.ingredients
  for each row execute function public.guard_stock_write();