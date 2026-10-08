import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { createExpenseSchema } from "@/lib/validators/expenseSchema";

export const POST: APIRoute = async ({ request, cookies }) => {
    const auth = await requireRole(cookies, ["admin"]);
    if (!auth.ok) return auth.response;

    const supabase = createSupabaseServerClient(cookies);

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
    }

    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }),
        { status: 400 }
        );
    }

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from("expenses")
        .insert({
        category_id: parsed.data.categoryId,
        description: parsed.data.description,
        amount: parsed.data.amount,
        payment_method: parsed.data.paymentMethod,
        receipt_url: parsed.data.receiptUrl ?? null,
        user_id: user?.id ?? null,
        })
        .select("id")
        .single();

    if (error) {
        console.error("Error creando gasto:", error.message);
        return new Response(JSON.stringify({ error: "No se pudo registrar el gasto" }), {
        status: 500,
        });
    }

    return new Response(JSON.stringify({ id: data.id }), { status: 201 });
};