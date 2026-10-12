
begin;

-- 0) Control: Bife De Lomo no puede tener stock cargado al pasarlo a gramos.
do $$
declare s numeric; u text;
begin
  select stock, unit into s, u from public.ingredients where name = 'Bife De Lomo';
  if u is distinct from 'g' and coalesce(s, 0) > 0 then
    raise exception 'Bife De Lomo tiene stock % en unidad %. Ponelo en 0 (o avisame) antes de pasarlo a gramos.', s, u;
  end if;
end $$;

-- 1) "Carne" pasa a llamarse "Medallón de carne" (sigue en unidades).
update public.ingredients set name = 'Medallón de carne'
 where name = 'Carne'
   and not exists (select 1 from public.ingredients where name = 'Medallón de carne');

-- 2) Bife De Lomo se mide en gramos.
update public.ingredients set unit = 'g' where name = 'Bife De Lomo';

-- 3) Ingrediente Papas (gramos), si no existe.
insert into public.ingredients (name, unit, stock, min_stock, extra_price, active)
select 'Papas', 'g', 0, 0, 0, true
where not exists (select 1 from public.ingredients where lower(name) = 'papas');

-- 4) Regla: cada porción de la categoría Papas consume 300 g.
insert into public.category_stock_rules (category_id, ingredient_id, quantity_per_unit)
select c.id, i.id, 300
from public.categories c cross join public.ingredients i
where lower(i.name) = 'papas' and lower(c.name) = 'papas'
on conflict (category_id, ingredient_id) do update
  set quantity_per_unit = excluded.quantity_per_unit;

-- 5) Medallones: Simple 1, Doble 2, Triple 3 (también Medallón Vegetariano).
update public.product_ingredients pi
   set quantity_per_unit = case
         when p.name ~* 'triple$' then 3
         when p.name ~* 'doble$'  then 2
         else 1
       end
  from public.products p, public.ingredients i
 where pi.product_id = p.id and pi.ingredient_id = i.id
   and i.name in ('Medallón de carne', 'Medallón Vegetariano');

-- 6) Lomo en gramos: individual 180 g; P/2 y P/3 200 g.
update public.product_ingredients pi
   set quantity_per_unit = case
         when p.name ~* 'P/[23]$' then 200
         else 180
       end
  from public.products p, public.ingredients i
 where pi.product_id = p.id and pi.ingredient_id = i.id
   and i.name = 'Bife De Lomo';

-- 7) Estos productos ya no llevan stock propio (descuentan ingredientes).
update public.products p set track_stock = false
  from public.categories c
 where c.id = p.category_id
   and lower(c.name) in ('hamburguesas', 'lomitos', 'sandwiches', 'papas');

commit;