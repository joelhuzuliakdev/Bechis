import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderStatus } from "@/lib/orders/orderStatus";

export interface OrderItemIngredientChange {
  name: string;
}

export interface OrderItemData {
  productName: string;
  quantity: number;
  removed: string[];
  added: OrderItemIngredientChange[];
}

export interface OrderCardData {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
  customerName: string;
  customerPhone: string;
  deliveryType: string;
  deliveryZoneName: string | null;
  address: string | null;
  total: number;
  items: OrderItemData[];
  cancelReason: string | null;
  cancelledAt: string | null;
}

export const ORDER_SELECT = `
  id,
  order_number,
  status,
  payment_status,
  customer_name,
  customer_phone,
  delivery_type,
  address,
  total,
  cancel_reason,
  cancelled_at,
  delivery_zones ( name ),
  order_items (
    quantity,
    products ( name ),
    order_item_ingredients (
      action,
      ingredients ( name )
    )
  )
`;

function mapOrderRow(row: any): OrderCardData {
  const items: OrderItemData[] = (row.order_items ?? []).map((item: any) => {
    const ingredients = item.order_item_ingredients ?? [];
    return {
      productName: item.products?.name ?? "Producto",
      quantity: item.quantity,
      removed: ingredients
        .filter((i: any) => i.action === "quitado")
        .map((i: any) => i.ingredients?.name ?? "Ingrediente"),
      added: ingredients
        .filter((i: any) => i.action === "agregado")
        .map((i: any) => ({ name: i.ingredients?.name ?? "Ingrediente" })),
    };
  });

  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    paymentStatus: row.payment_status,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deliveryType: row.delivery_type,
    deliveryZoneName: row.delivery_zones?.name ?? null,
    address: row.address ?? null,
    total: row.total,
    items,
    cancelReason: row.cancel_reason ?? null,
    cancelledAt: row.cancelled_at ?? null,
  };
}

export async function fetchOrderById(
  supabase: SupabaseClient,
  id: string
): Promise<OrderCardData | null> {
  const { data, error } = await supabase.from("orders").select(ORDER_SELECT).eq("id", id).single();
  if (error) console.error("fetchOrderById error:", JSON.stringify(error));
  if (error || !data) return null;
  return mapOrderRow(data);
}

// Pedidos activos: todo lo que no esté cancelado. "finalizado" se sigue
// mostrando en el tablero hasta que se cobra (payment_status = 'cobrado'),
// tal como ya funcionaba antes — no se toca esa lógica.
export async function fetchActiveOrders(supabase: SupabaseClient): Promise<OrderCardData[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .neq("status", "cancelado")
    .neq("payment_status", "cobrado")
    .order("created_at", { ascending: true });

  if (error) console.error("fetchActiveOrders error:", JSON.stringify(error));
  if (error || !data) return [];
  return data.map(mapOrderRow);
}

// Historial de pedidos cancelados, para la vista aparte (no se mezclan
// con los activos en el tablero Kanban).
export async function fetchCancelledOrders(supabase: SupabaseClient): Promise<OrderCardData[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("status", "cancelado")
    .order("cancelled_at", { ascending: false });

  if (error) console.error("fetchCancelledOrders error:", JSON.stringify(error));
  if (error || !data) return [];
  return data.map(mapOrderRow);
}