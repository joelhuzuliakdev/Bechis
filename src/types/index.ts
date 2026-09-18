// Tipos que reflejan las tablas de supabase/migrations/0001_init.sql.
// Cuando el schema esté estable, reemplazar esto corriendo:
//   npm run db:types
// (ya definido en package.json), que genera los tipos reales desde
// la base de datos en vez de mantenerlos a mano.

export type UserRole = "admin" | "empleado";
export type DeliveryType = "retiro" | "envio";
export type OrderStatus = "pedidos" | "en_proceso" | "finalizado";
export type PaymentStatus = "pendiente" | "cobrado";
export type PaymentMethod = "efectivo" | "transferencia" | "qr" | "debito" | "credito";
export type IngredientAction = "agregado" | "quitado";

export interface Category {
    id: string;
    name: string;
    slug: string;
    sort_order: number;
    active: boolean;
    icon_emoji: string;
    accent_color: string;
}

export interface Product {
    id: string;
    category_id: string;
    name: string;
    slug: string;
    description: string | null;
    price: number;
    image_url: string | null;
    stock: number;
    min_stock: number;
    active: boolean;
}

export interface Ingredient {
    id: string;
    name: string;
    extra_price: number;
    stock: number;
    min_stock: number;
    active: boolean;
}

// Fila de product_ingredients + el ingrediente ya "resuelto" (join),
// que es la forma más cómoda de trabajar en el frontend.
export interface ProductIngredientConfig {
    ingredient_id: string;
    ingredient_name: string;
    is_included: boolean;
    is_removable: boolean;
    is_addable_extra: boolean;
    /** Precio a cobrar si se agrega como extra. Ya resuelve el price_override. */
    extra_price: number;
}

export interface ProductWithIngredients extends Product {
    ingredients: ProductIngredientConfig[];
}

// Selección que hace el cliente al personalizar un producto en el catálogo.
export interface ProductSelection {
    productId: string;
    quantity: number;
    /** ids de ingredientes incluidos que el cliente sacó */
    removedIngredientIds: string[];
    /** ids de ingredientes extra que el cliente agregó */
    addedExtraIds: string[];
}

export interface Order {
    id: string;
    order_number: number;
    customer_name: string;
    customer_phone: string;
    delivery_type: DeliveryType;
    address: string | null;
    delivery_zone_id: string | null;
    notes: string | null;
    subtotal: number;
    discount: number;
    delivery_cost: number;
    total: number;
    status: OrderStatus;
    payment_status: PaymentStatus;
    created_at: string;
}