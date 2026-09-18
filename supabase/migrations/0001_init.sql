-- =====================================================================
-- BECHIS — Migración inicial
-- Estructura completa: catálogo, pedidos, ventas, caja, stock,
-- gastos, proveedores, facturas, promociones, equipo y roles.
-- =====================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- =====================================================================
-- 1. ENUMS
-- =====================================================================

create type user_role as enum ('admin', 'empleado');
create type delivery_type as enum ('retiro', 'envio');
create type order_status as enum ('pedidos', 'en_proceso', 'finalizado');
create type payment_status as enum ('pendiente', 'cobrado');
create type payment_method as enum ('efectivo', 'transferencia', 'qr', 'debito', 'credito');
create type stock_movement_type as enum ('ingreso', 'egreso', 'correccion', 'venta');
create type stock_target as enum ('producto', 'ingrediente');
create type cash_register_status as enum ('abierta', 'cerrada');
create type cash_movement_type as enum ('ingreso', 'egreso', 'retiro');
create type promotion_type as enum ('2x1', 'descuento_porcentual', 'combo');
create type ingredient_action as enum ('agregado', 'quitado');

-- =====================================================================
-- 2. USUARIOS / ROLES
-- Extiende auth.users de Supabase con datos de negocio.
-- =====================================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'empleado',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Crea el profile automáticamente cuando se crea un usuario en auth.users
-- (el admin crea la cuenta del empleado desde el panel, punto 17 del brief).
create function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'empleado')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Helper: rol del usuario autenticado actual (se usa en las policies de RLS)
create function current_role_is(required_role user_role)
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = required_role and active = true
  );
$$ language sql security definer stable;

create function current_user_is_staff()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true
  );
$$ language sql security definer stable;

-- =====================================================================
-- 3. CATÁLOGO: categorías, productos, ingredientes
-- =====================================================================

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  active boolean not null default true,
  -- Presentación visual en el catálogo público (home): un emoji y una
  -- clase de Tailwind para el fondo de la card. Administrable desde
  -- el panel para no depender de tocar código al crear una categoría.
  icon_emoji text not null default '🍔',
  theme_class text not null default 'bg-gradient-to-br from-ink to-ink-soft',
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  image_url text,
  stock numeric(10, 2) not null default 0,
  min_stock numeric(10, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  extra_price numeric(10, 2) not null default 0 check (extra_price >= 0),
  stock numeric(10, 2) not null default 0,
  min_stock numeric(10, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Relación producto-ingrediente: define si el ingrediente viene
-- incluido de fábrica, si se puede quitar, y si además (o en cambio)
-- se puede agregar pagando un adicional.
-- Regla de negocio (del brief): quitar un incluido NUNCA descuenta precio;
-- agregar un extra SIEMPRE suma su precio.
create table product_ingredients (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  is_included boolean not null default false,   -- viene por defecto en el producto
  is_removable boolean not null default true,    -- si viene incluido, ¿se puede quitar?
  is_addable_extra boolean not null default false, -- se puede agregar pagando adicional
  price_override numeric(10, 2),                  -- si es null, usa ingredients.extra_price
  unique (product_id, ingredient_id)
);

-- =====================================================================
-- 4. ZONAS DE ENVÍO (precio administrable, punto 3 del brief)
-- =====================================================================

create table delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10, 2) not null default 0 check (price >= 0),
  active boolean not null default true
);

-- =====================================================================
-- 5. PROMOCIONES
-- =====================================================================

create table promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type promotion_type not null,
  discount_value numeric(10, 2) not null default 0,
  day_of_week int check (day_of_week between 0 and 6), -- 0 = domingo
  start_date date,
  end_date date,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table promotion_products (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references promotions(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  unique (promotion_id, product_id)
);

-- =====================================================================
-- 6. PEDIDOS (creados desde la parte pública)
-- =====================================================================

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity,
  customer_name text not null,
  customer_phone text not null,
  delivery_type delivery_type not null,
  address text,
  delivery_zone_id uuid references delivery_zones(id),
  notes text,
  subtotal numeric(10, 2) not null default 0,
  discount numeric(10, 2) not null default 0,
  delivery_cost numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  status order_status not null default 'pedidos',
  payment_status payment_status not null default 'pendiente',
  promotion_id uuid references promotions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity int not null check (quantity > 0),
  unit_price numeric(10, 2) not null, -- precio ya calculado (base + extras) al momento del pedido
  subtotal numeric(10, 2) not null
);

create table order_item_ingredients (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id),
  action ingredient_action not null, -- 'agregado' o 'quitado'
  price numeric(10, 2) not null default 0 -- 0 si fue 'quitado'; > 0 si fue 'agregado' con costo
);

-- =====================================================================
-- 7. COBRO / PAGOS (al pasar un pedido a venta)
-- =====================================================================

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  method payment_method not null,
  amount numeric(10, 2) not null,
  received_amount numeric(10, 2), -- si es efectivo
  change_amount numeric(10, 2),   -- vuelto
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 8. VENTAS
-- Una venta puede o no estar asociada a un pedido (mostrador directo).
-- =====================================================================

create table sales (
  id uuid primary key default gen_random_uuid(),
  sale_number bigint generated always as identity,
  order_id uuid references orders(id),
  customer_name text,
  subtotal numeric(10, 2) not null default 0,
  discount numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  payment_method payment_method not null,
  employee_id uuid references profiles(id),
  cash_register_id uuid, -- FK se agrega luego de crear cash_register
  created_at timestamptz not null default now()
);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity int not null check (quantity > 0),
  unit_price numeric(10, 2) not null,
  subtotal numeric(10, 2) not null
);

-- =====================================================================
-- 9. STOCK
-- =====================================================================

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  target stock_target not null,             -- 'producto' o 'ingrediente'
  product_id uuid references products(id),
  ingredient_id uuid references ingredients(id),
  type stock_movement_type not null,
  quantity numeric(10, 2) not null,         -- siempre positiva; el 'type' define el signo
  reason text,
  sale_id uuid references sales(id),        -- si el movimiento fue automático por venta
  user_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint stock_target_matches_fk check (
    (target = 'producto' and product_id is not null and ingredient_id is null) or
    (target = 'ingrediente' and ingredient_id is not null and product_id is null)
  )
);

-- =====================================================================
-- 10. CAJA
-- =====================================================================

create table cash_register (
  id uuid primary key default gen_random_uuid(),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_amount numeric(10, 2) not null default 0,
  expected_total numeric(10, 2),
  real_amount numeric(10, 2),
  difference numeric(10, 2),
  status cash_register_status not null default 'abierta',
  opened_by uuid references profiles(id),
  closed_by uuid references profiles(id)
);

alter table sales
  add constraint sales_cash_register_fkey
  foreign key (cash_register_id) references cash_register(id);

create table cash_movements (
  id uuid primary key default gen_random_uuid(),
  cash_register_id uuid not null references cash_register(id) on delete cascade,
  type cash_movement_type not null, -- ingreso / egreso / retiro (manuales, no ventas)
  amount numeric(10, 2) not null,
  description text,
  user_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Solo puede haber una caja abierta a la vez
create unique index one_open_cash_register
  on cash_register (status)
  where status = 'abierta';

-- =====================================================================
-- 11. GASTOS
-- =====================================================================

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

insert into expense_categories (name) values
  ('Insumos'), ('Servicios'), ('Combustible'),
  ('Mantenimiento'), ('Sueldos'), ('Compras'), ('Otros');

create table expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references expense_categories(id),
  description text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  payment_method payment_method not null,
  receipt_url text,
  user_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 12. PROVEEDORES Y FACTURAS
-- =====================================================================

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  company text,
  cuit text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id),
  invoice_number text not null,
  date date not null default current_date,
  detail text,
  image_url text,
  total numeric(10, 2) not null check (total >= 0),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 13. TRIGGERS DE MANTENIMIENTO
-- =====================================================================

create function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();

-- =====================================================================
-- 14. ROW LEVEL SECURITY
-- =====================================================================

alter table profiles enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table ingredients enable row level security;
alter table product_ingredients enable row level security;
alter table delivery_zones enable row level security;
alter table promotions enable row level security;
alter table promotion_products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_item_ingredients enable row level security;
alter table payments enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table stock_movements enable row level security;
alter table cash_register enable row level security;
alter table cash_movements enable row level security;
alter table expense_categories enable row level security;
alter table expenses enable row level security;
alter table suppliers enable row level security;
alter table invoices enable row level security;

-- --- Perfiles: cada usuario ve el suyo; admin ve todos ---
create policy "profiles_select_own_or_admin"
  on profiles for select
  using (id = auth.uid() or current_role_is('admin'));

create policy "profiles_admin_manage"
  on profiles for all
  using (current_role_is('admin'))
  with check (current_role_is('admin'));

-- --- Catálogo público: cualquiera (incluso anónimo) puede LEER lo activo ---
create policy "categories_public_read" on categories
  for select using (active = true or current_user_is_staff());
create policy "categories_admin_write" on categories
  for insert with check (current_role_is('admin'));
create policy "categories_admin_update" on categories
  for update using (current_role_is('admin'));
create policy "categories_admin_delete" on categories
  for delete using (current_role_is('admin'));

create policy "products_public_read" on products
  for select using (active = true or current_user_is_staff());
create policy "products_staff_write" on products
  for insert with check (current_user_is_staff());
create policy "products_staff_update" on products
  for update using (current_user_is_staff());
create policy "products_admin_delete" on products
  for delete using (current_role_is('admin'));

create policy "ingredients_public_read" on ingredients
  for select using (active = true or current_user_is_staff());
create policy "ingredients_staff_write" on ingredients
  for insert with check (current_user_is_staff());
create policy "ingredients_staff_update" on ingredients
  for update using (current_user_is_staff());

create policy "product_ingredients_public_read" on product_ingredients
  for select using (true);
create policy "product_ingredients_staff_write" on product_ingredients
  for all using (current_user_is_staff()) with check (current_user_is_staff());

create policy "delivery_zones_public_read" on delivery_zones
  for select using (active = true or current_user_is_staff());
create policy "delivery_zones_admin_write" on delivery_zones
  for all using (current_role_is('admin')) with check (current_role_is('admin'));

create policy "promotions_public_read" on promotions
  for select using (active = true or current_user_is_staff());
create policy "promotions_staff_write" on promotions
  for all using (current_user_is_staff()) with check (current_user_is_staff());

create policy "promotion_products_public_read" on promotion_products
  for select using (true);
create policy "promotion_products_staff_write" on promotion_products
  for all using (current_user_is_staff()) with check (current_user_is_staff());

-- --- Pedidos: cualquiera puede CREAR (cliente anónimo haciendo un pedido) ---
-- pero solo el staff puede LEER, ACTUALIZAR o gestionar pedidos.
create policy "orders_public_insert" on orders
  for insert with check (true);
create policy "orders_staff_select" on orders
  for select using (current_user_is_staff());
create policy "orders_staff_update" on orders
  for update using (current_user_is_staff());

create policy "order_items_public_insert" on order_items
  for insert with check (true);
create policy "order_items_staff_select" on order_items
  for select using (current_user_is_staff());

create policy "order_item_ingredients_public_insert" on order_item_ingredients
  for insert with check (true);
create policy "order_item_ingredients_staff_select" on order_item_ingredients
  for select using (current_user_is_staff());

-- --- Todo lo demás (caja, ventas, gastos, proveedores, facturas, pagos, stock) ---
-- es exclusivamente para staff autenticado. Las pantallas de admin además
-- restringen en el propio frontend (middleware) qué rol ve qué sección,
-- pero la base de datos es la última línea de defensa.
create policy "payments_staff_all" on payments
  for all using (current_user_is_staff()) with check (current_user_is_staff());

create policy "sales_staff_all" on sales
  for all using (current_user_is_staff()) with check (current_user_is_staff());
create policy "sale_items_staff_all" on sale_items
  for all using (current_user_is_staff()) with check (current_user_is_staff());

create policy "stock_movements_staff_all" on stock_movements
  for all using (current_user_is_staff()) with check (current_user_is_staff());

create policy "cash_register_admin_all" on cash_register
  for all using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "cash_movements_admin_all" on cash_movements
  for all using (current_role_is('admin')) with check (current_role_is('admin'));

create policy "expense_categories_staff_read" on expense_categories
  for select using (current_user_is_staff());
create policy "expenses_admin_all" on expenses
  for all using (current_role_is('admin')) with check (current_role_is('admin'));

create policy "suppliers_admin_all" on suppliers
  for all using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "invoices_admin_all" on invoices
  for all using (current_role_is('admin')) with check (current_role_is('admin'));

-- =====================================================================
-- 15. ÍNDICES ÚTILES
-- =====================================================================

create index idx_products_category on products (category_id);
create index idx_products_active on products (active);
create index idx_product_ingredients_product on product_ingredients (product_id);
create index idx_orders_status on orders (status);
create index idx_orders_created_at on orders (created_at);
create index idx_order_items_order on order_items (order_id);
create index idx_sales_created_at on sales (created_at);
create index idx_stock_movements_created_at on stock_movements (created_at);
create index idx_expenses_created_at on expenses (created_at);