import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { updateExpenseSchema } from "@/lib/validators/expenseSchema";

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
    const auth = await requireRole(cookies, ["admin"]);
    if (!auth.ok) return auth.response;

    const id = params.id;
    if (!id) {
        return new Response(JSON.stringify({ error: "Falta el id" }), { status: 400 });
    }

    const supabase = createSupabaseServerClient(cookies);

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
    }

    const parsed = updateExpenseSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }),
        { status: 400 }
        );
    }

    const { error } = await supabase
        .from("expenses")
        .update({
        category_id: parsed.data.categoryId,
        description: parsed.data.description,
        amount: parsed.data.amount,
        payment_method: parsed.data.paymentMethod,
        receipt_url: parsed.data.receiptUrl ?? null,
        })
        .eq("id", id);

    if (error) {
        console.error("Error editando gasto:", error.message);
        return new Response(JSON.stringify({ error: "No se pudo editar el gasto" }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
    const auth = await requireRole(cookies, ["admin"]);
    if (!auth.ok) return auth.response;

    const id = params.id;
    if (!id) {
        return new Response(JSON.stringify({ error: "Falta el id" }), { status: 400 });
    }

    const supabase = createSupabaseServerClient(cookies);

    const { error } = await supabase.from("expenses").delete().eq("id", id);

    if (error) {
        console.error("Error eliminando gasto:", error.message);
        return new Response(JSON.stringify({ error: "No se pudo eliminar el gasto" }), {
        status: 500,
        });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
};