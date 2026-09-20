import type { SupabaseClient } from "@supabase/supabase-js";

export interface OrderCardData {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  deliveryType: "retiro" | "envio";
  address: string | null;
  deliveryZoneName: string | null;
  deliveryCost: number;
  total: number;
  status: "pedidos" | "en_proceso" | "finalizado";
  paymentStatus: string;
  createdAt: string;
  items: { productName: string; quantity: number; removed: string[]; added: { name: string; price: number }[] }[];
}

const ORDER_SELECT = `
  id, order_number, customer_name, customer_phone, delivery_type, address,
  delivery_cost, total, status, payment_status, created_at,
  delivery_zones ( name ),
  order_items (
    id, quantity,
    products ( name ),
    order_item_ingredients ( action, price, ingredients ( name ) )
  )
`;

function mapOrderRow(raw: any): OrderCardData {
  return {
    id: raw.id,
    orderNumber: raw.order_number,
    customerName: raw.customer_name,
    customerPhone: raw.customer_phone,
    deliveryType: raw.delivery_type,
    address: raw.address,
    deliveryZoneName: raw.delivery_zones?.name ?? null,
    deliveryCost: raw.delivery_cost,
    total: raw.total,
    status: raw.status,
    paymentStatus: raw.payment_status,
    createdAt: raw.created_at,
    items: (raw.order_items ?? []).map((item: any) => ({
      productName: item.products?.name ?? "Producto",
      quantity: item.quantity,
      removed: (item.order_item_ingredients ?? [])
        .filter((i: any) => i.action === "quitado")
        .map((i: any) => i.ingredients?.name ?? ""),
      added: (item.order_item_ingredients ?? [])
        .filter((i: any) => i.action === "agregado")
        .map((i: any) => ({ name: i.ingredients?.name ?? "", price: i.price })),
    })),
  };
}

export async function fetchOrderById(client: SupabaseClient, id: string): Promise<OrderCardData | null> {
  const { data, error } = await client.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return mapOrderRow(data);
}

export async function fetchActiveOrders(client: SupabaseClient): Promise<OrderCardData[]> {
  const { data, error } = await client
    .from("orders")
    .select(ORDER_SELECT)
    .neq("payment_status", "cobrado") // ya cobrados = viven en Ventas, no en este tablero
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map(mapOrderRow);
}