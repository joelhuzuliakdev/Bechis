-- =====================================================================
-- BECHIS — Datos de prueba para desarrollo local
-- Correr después de 0001_init.sql
-- =====================================================================

-- --- Categorías ---
insert into categories (id, name, slug, sort_order, icon_emoji, theme_class) values
  ('11111111-0000-0000-0000-000000000001', 'Hamburguesas', 'hamburguesas', 1, '🍔', 'bg-gradient-to-br from-ink to-ink-soft'),
  ('11111111-0000-0000-0000-000000000002', 'Papas', 'papas', 2, '🍟', 'bg-gradient-to-br from-bechis-yellow to-bechis-yellow-dark'),
  ('11111111-0000-0000-0000-000000000003', 'Combos', 'combos', 3, '🧾', 'bg-gradient-to-br from-ink-soft to-ink'),
  ('11111111-0000-0000-0000-000000000004', 'Gaseosas', 'gaseosas', 4, '🥤', 'bg-gradient-to-br from-red-700 to-red-900'),
  ('11111111-0000-0000-0000-000000000005', 'Otros', 'otros', 5, '🧅', 'bg-gradient-to-br from-amber-800 to-amber-950');

-- --- Zonas de envío ---
insert into delivery_zones (name, price) values
  ('Zona 1', 1000),
  ('Zona 2', 1500),
  ('Zona 3', 2000),
  ('Zona 4', 2500);

-- --- Ingredientes ---
insert into ingredients (id, name, extra_price, stock, min_stock) values
  ('22222222-0000-0000-0000-000000000001', 'Carne', 0, 100, 20),
  ('22222222-0000-0000-0000-000000000002', 'Cheddar', 1000, 80, 15),
  ('22222222-0000-0000-0000-000000000003', 'Lechuga', 0, 50, 10),
  ('22222222-0000-0000-0000-000000000004', 'Tomate', 0, 50, 10),
  ('22222222-0000-0000-0000-000000000005', 'Cebolla', 0, 50, 10),
  ('22222222-0000-0000-0000-000000000006', 'Salsa Bechis', 0, 60, 10),
  ('22222222-0000-0000-0000-000000000007', 'Bacon', 1500, 40, 10),
  ('22222222-0000-0000-0000-000000000008', 'Huevo', 800, 40, 10);

-- --- Producto: Hamburguesa Bechis ---
insert into products (id, category_id, name, slug, description, price, stock, min_stock) values
  (
    '33333333-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000001',
    'Hamburguesa Bechis',
    'hamburguesa-bechis',
    'Pan brioche, carne 150g, cheddar, lechuga, tomate, cebolla y salsa Bechis.',
    10000,
    25,
    5
  );

-- Ingredientes incluidos (no suman precio, se pueden quitar salvo la carne)
insert into product_ingredients (product_id, ingredient_id, is_included, is_removable, is_addable_extra) values
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', true, false, false), -- Carne, fija
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', true, true, false),  -- Cheddar incluido
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003', true, true, false),  -- Lechuga
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000004', true, true, false),  -- Tomate
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000005', true, true, false),  -- Cebolla
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000006', true, true, false),  -- Salsa
  -- Extras que se pueden agregar pagando adicional (no vienen incluidos)
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000007', false, false, true), -- Bacon +$1.500
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000008', false, false, true); -- Huevo +$800

-- --- Producto: Papas Bechis (sin ingredientes incluidos, con extras) ---
insert into products (id, category_id, name, slug, description, price, stock, min_stock) values
  (
    '33333333-0000-0000-0000-000000000002',
    '11111111-0000-0000-0000-000000000002',
    'Papas Bechis',
    'papas-bechis',
    'Papas fritas cortadas a mano con nuestro condimento de la casa.',
    4500,
    40,
    10
  );

insert into product_ingredients (product_id, ingredient_id, is_included, is_removable, is_addable_extra) values
  ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', false, false, true), -- Cheddar fundido extra
  ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000007', false, false, true); -- Bacon extra

-- --- Gaseosas (sin personalización) ---
insert into products (category_id, name, slug, description, price, stock, min_stock) values
  ('11111111-0000-0000-0000-000000000004', 'Coca-Cola 500ml', 'coca-cola-500', 'Bien fría.', 2000, 60, 10),
  ('11111111-0000-0000-0000-000000000004', 'Sprite 500ml', 'sprite-500', 'Bien fría.', 2000, 60, 10);

-- --- Promo de ejemplo: 20% OFF los martes ---
insert into promotions (name, description, type, discount_value, day_of_week, active) values
  ('Promo Martes', '20% OFF en toda la carta los martes.', 'descuento_porcentual', 20, 2, true);