import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { createExpenseCategorySchema } from "@/lib/validators/expenseSchema";

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

    const parsed = createExpenseCategorySchema.safeParse(body);
    if (!parsed.success) {
        return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }),
        { status: 400 }
        );
    }

    const { data, error } = await supabase
        .from("expense_categories")
        .insert({ name: parsed.data.name })
        .select("id, name")
        .single();

    if (error) {
        console.error("Error creando categoría de gasto:", error.message);
        return new Response(JSON.stringify({ error: "No se pudo crear la categoría" }), {
        status: 500,
        });
    }

    return new Response(JSON.stringify({ category: data }), { status: 201 });
};