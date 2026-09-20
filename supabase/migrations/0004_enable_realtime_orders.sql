-- =====================================================================
-- BECHIS — 0004: habilitar Realtime en orders
--
-- Por defecto, Supabase no transmite cambios de ninguna tabla por
-- Realtime — hay que agregarla explícitamente a la "publicación"
-- supabase_realtime. Esto es lo que permite que el Panel Empleado
-- reciba el pedido nuevo apenas se crea, sin que nadie recargue nada.
-- La seguridad sigue siendo la misma RLS de siempre: solo el staff
-- puede recibir estos eventos (ver policy orders_staff_select).
-- =====================================================================

alter publication supabase_realtime add table orders;