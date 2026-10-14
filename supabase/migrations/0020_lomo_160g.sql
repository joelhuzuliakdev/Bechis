-- 0020_lomo_160g.sql
-- Cada lomo usa 160 g de Bife De Lomo. Gramos de la receta = 160 x lomos que trae el producto.
-- Solo corrige 4 recetas. No toca movimientos, pedidos, hamburguesas, papas ni otros ingredientes.
-- Si no encuentra exactamente 4 recetas, se frena y no cambia nada.

begin;

do $$
declare n int;
begin
  with nuevos(producto, categoria, lomos) as (
    values
      ('clásico',           'lomitos',      1),
      ('masa de pizza p/2', 'lomitos',      2),
      ('masa de pizza p/3', 'lomitos',      3),
      ('clásico p/2',       'hamburguesas', 2)
  )
  update public.product_ingredients pi
     set quantity_per_unit = 160 * v.lomos
    from nuevos v, public.products p, public.categories c, public.ingredients i
   where pi.product_id = p.id
     and pi.ingredient_id = i.id
     and c.id = p.category_id
     and i.name = 'Bife De Lomo'
     and lower(p.name) = v.producto
     and lower(c.name) = v.categoria;

  get diagnostics n = row_count;
  if n <> 4 then
    raise exception 'Se esperaba actualizar 4 recetas y se actualizaron %. No se aplicó ningún cambio.', n;
  end if;
end $$;

commit;