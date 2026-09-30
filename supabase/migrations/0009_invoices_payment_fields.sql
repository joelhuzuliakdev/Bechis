-- Agrega estado de pago y vencimiento a las facturas. "Vencida" no se
-- guarda como estado aparte: se calcula en la app como
-- payment_status = 'pendiente' AND due_date < hoy, así nunca queda
-- desincronizado con la fecha real.

create type invoice_payment_status as enum ('pendiente', 'pagada');

alter table public.invoices
  add column due_date date,
  add column payment_status invoice_payment_status not null default 'pendiente';