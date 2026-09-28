import type { SupabaseClient } from "@supabase/supabase-js";

export interface ExpenseCategoryOption {
    id: string;
    name: string;
}

export interface ExpenseRow {
    id: string;
    categoryId: string;
    categoryName: string;
    description: string;
    amount: number;
    paymentMethod: string;
    receiptUrl: string | null;
    createdAt: string;
}

export async function fetchExpenseCategories(
    client: SupabaseClient
    ): Promise<ExpenseCategoryOption[]> {
    const { data, error } = await client
        .from("expense_categories")
        .select("id, name")
        .order("name", { ascending: true });

    if (error) {
        console.error("Error cargando categorías de gastos:", error.message);
    }

    return data ?? [];
}

export interface FetchExpensesParams {
    from: Date;
    to: Date;
    categoryId?: string;
}

export async function fetchExpenses(
    client: SupabaseClient,
    { from, to, categoryId }: FetchExpensesParams
    ): Promise<ExpenseRow[]> {
    let query = client
        .from("expenses")
        .select(
        "id, category_id, description, amount, payment_method, receipt_url, created_at, expense_categories(name)"
        )
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false });

    if (categoryId) {
        query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error cargando gastos:", error.message);
    }

    return (data ?? []).map((row: any) => ({
        id: row.id,
        categoryId: row.category_id,
        categoryName: row.expense_categories?.name ?? "Sin categoría",
        description: row.description,
        amount: Number(row.amount),
        paymentMethod: row.payment_method,
        receiptUrl: row.receipt_url,
        createdAt: row.created_at,
    }));
}