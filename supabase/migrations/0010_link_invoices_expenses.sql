-- Vínculo factura -> gasto, y las funciones que mantienen esa relación
-- consistente (evitan que una factura quede "pagada" sin su gasto, o
-- un gasto huérfano sin su factura, si algo falla a mitad de camino).

-- Un gasto puede no venir de ninguna factura (carga manual desde
-- /admin/gastos), pero una factura pagada tiene como máximo un gasto
-- vinculado — de ahí el índice único parcial.
alter table public.expenses
  add column invoice_id uuid references public.invoices(id);

create unique index expenses_invoice_id_unique
  on public.expenses (invoice_id)
  where invoice_id is not null;

-- Las tres funciones corren SIN security definer: se ejecutan con los
-- privilegios de quien las llama, así que las políticas
-- "expenses_admin_all" e "invoices_admin_all" se siguen aplicando
-- normalmente — solo un admin autenticado puede usarlas, igual que si
-- hiciera las operaciones por separado. Lo único que cambia es que
-- Postgres las ejecuta como una sola transacción.

-- Marca la factura como pagada y crea su gasto vinculado.
create or replace function public.mark_invoice_paid(
  p_invoice_id uuid,
  p_category_id uuid,
  p_payment_method public.expenses.payment_method%type
)
returns uuid
language plpgsql
as $$
declare
  v_invoice public.invoices%rowtype;
  v_supplier_name text;
  v_expense_id uuid;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id;

  if not found then
    raise exception 'Factura no encontrada';
  end if;

  select name into v_supplier_name from public.suppliers where id = v_invoice.supplier_id;

  update public.invoices
    set payment_status = 'pagada'
    where id = p_invoice_id;

  insert into public.expenses (category_id, description, amount, payment_method, invoice_id)
  values (
    p_category_id,
    'Factura ' || v_invoice.invoice_number || coalesce(' - ' || v_supplier_name, ''),
    v_invoice.total,
    p_payment_method,
    p_invoice_id
  )
  returning id into v_expense_id;

  return v_expense_id;
end;
$$;

-- Vuelve la factura a pendiente y borra el gasto que se había generado.
create or replace function public.mark_invoice_pending(p_invoice_id uuid)
returns void
language plpgsql
as $$
begin
  delete from public.expenses where invoice_id = p_invoice_id;

  update public.invoices
    set payment_status = 'pendiente'
    where id = p_invoice_id;
end;
$$;

-- Edita una factura y, si ya tiene un gasto vinculado (está pagada),
-- actualiza monto y descripción de ese gasto en el mismo movimiento.
create or replace function public.update_invoice(
  p_invoice_id uuid,
  p_supplier_id uuid,
  p_invoice_number text,
  p_date date,
  p_due_date date,
  p_detail text,
  p_image_url text,
  p_total numeric
)
returns void
language plpgsql
as $$
declare
  v_supplier_name text;
begin
  update public.invoices
    set supplier_id = p_supplier_id,
        invoice_number = p_invoice_number,
        date = p_date,
        due_date = p_due_date,
        detail = p_detail,
        image_url = p_image_url,
        total = p_total
    where id = p_invoice_id;

  if not found then
    raise exception 'Factura no encontrada';
  end if;

  select name into v_supplier_name from public.suppliers where id = p_supplier_id;

  -- Si no hay gasto vinculado (factura todavía pendiente), este update
  -- no afecta ninguna fila y no pasa nada.
  update public.expenses
    set amount = p_total,
        description = 'Factura ' || p_invoice_number || coalesce(' - ' || v_supplier_name, '')
    where invoice_id = p_invoice_id;
end;
$$;