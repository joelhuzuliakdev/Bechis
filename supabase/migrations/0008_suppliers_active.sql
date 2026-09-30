-- Permite activar/desactivar proveedores sin borrarlos, para conservar
-- el historial de facturas asociadas a un proveedor dado de baja.

alter table public.suppliers
  add column active boolean not null default true;