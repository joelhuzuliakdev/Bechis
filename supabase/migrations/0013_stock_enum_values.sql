-- 0013_stock_enum_values.sql
-- Nuevos tipos de movimiento de stock. Va SOLO en su archivo: Postgres no
-- permite usar un valor de enum recién agregado en la misma transacción.
--   consumo_pedido    : descuento al pasar un pedido a Confirmado
--   reposicion_pedido : devolución de stock al cancelar un pedido
--   merma             : pedido cancelado cuyo stock NO se repone (se pierde)

alter type public.stock_movement_type add value if not exists 'consumo_pedido';
alter type public.stock_movement_type add value if not exists 'reposicion_pedido';
alter type public.stock_movement_type add value if not exists 'merma';