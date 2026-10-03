-- Columnas de seguimiento del pedido + tabla de notificaciones.
-- No modifica payment_status (eso sigue siendo del flujo de Caja/Cobrar,
-- tal cual está). online_payment_status es un campo NUEVO y separado,
-- pensado para cuando se integre una pasarela de pago online más
-- adelante — por ahora queda en "no_aplica" para todos los pedidos.

create type online_payment_status as enum ('no_aplica', 'pendiente', 'aprobado', 'rechazado');

alter table public.orders
  add column online_payment_status online_payment_status not null default 'no_aplica',
  add column accepted_at timestamptz,
  add column ready_at timestamptz,
  add column delivered_at timestamptz,
  add column cancelled_at timestamptz,
  add column cancel_reason text;

-- Registro de notificaciones (WhatsApp u otro canal a futuro). Todavía
-- no se usa — se deja lista para la Etapa 2, y sirve para no mandar el
-- mismo aviso dos veces por el mismo pedido (índice único abajo).
create table public.order_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event text not null, -- 'confirmado' | 'listo_para_retirar' | ... (futuro)
  channel text not null default 'whatsapp',
  status text not null default 'pendiente', -- 'pendiente' | 'enviado' | 'error'
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index order_notifications_order_event_unique
  on public.order_notifications (order_id, event);

alter table public.order_notifications enable row level security;

create policy order_notifications_staff_all
  on public.order_notifications
  for all
  using (current_user_is_staff())
  with check (current_user_is_staff());