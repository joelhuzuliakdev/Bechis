-- Agrega 3 estados nuevos al enum order_status, sin tocar los 3 que ya
-- usás (pedidos, en_proceso, finalizado) para no romper Kanban ni Cobrar.
-- Van en su propio archivo porque Postgres no deja usar un valor de enum
-- recién agregado dentro de la misma transacción que lo crea.

alter type order_status add value 'confirmado' before 'en_proceso';
alter type order_status add value 'listo_para_retirar' before 'finalizado';
alter type order_status add value 'cancelado';

-- Orden final del enum: pedidos, confirmado, en_proceso,
-- listo_para_retirar, finalizado, cancelado.