// Lógica cliente del formulario de gastos (alta y edición) + alta rápida
// de categoría + botón de eliminar. Se monta desde
// /admin/gastos/nuevo.astro y /admin/gastos/[id]/editar.astro.
//
// attachExpenseDeleteHandlers() se usa aparte desde
// /admin/gastos/index.astro para los botones "Eliminar" de la tabla.

interface ExpenseFormPayload {
    categoryId: string;
    description: string;
    amount: number;
    paymentMethod: string;
    receiptUrl: string;
}

function showError(message: string) {
    const box = document.getElementById("expense-form-error");
    if (!box) return;
    box.textContent = message;
    box.classList.remove("hidden");
}

function hideError() {
    document.getElementById("expense-form-error")?.classList.add("hidden");
}

export function mountExpenseForm() {
    const form = document.getElementById("expense-form") as HTMLFormElement | null;
    if (!form) return;

    const mode = form.dataset.mode === "editar" ? "editar" : "crear";
    const expenseId = form.dataset.expenseId || "";

    // Alta rápida de categoría, sin salir del formulario.
    const toggleBtn = document.getElementById("toggle-new-category");
    const box = document.getElementById("new-category-box");
    const nameInput = document.getElementById("new-category-name") as HTMLInputElement | null;
    const saveBtn = document.getElementById("save-new-category") as HTMLButtonElement | null;
    const select = document.getElementById("category-id") as HTMLSelectElement | null;

    toggleBtn?.addEventListener("click", () => {
        box?.classList.toggle("hidden");
        nameInput?.focus();
    });

    saveBtn?.addEventListener("click", async () => {
        const name = nameInput?.value.trim();
        if (!name) return;

        saveBtn.setAttribute("disabled", "true");
        try {
        const res = await fetch("/api/expense-categories/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        });
        const json = await res.json();

        if (!res.ok) {
            showError(json.error ?? "No se pudo crear la categoría");
            return;
        }

        const option = document.createElement("option");
        option.value = json.category.id;
        option.textContent = json.category.name;
        option.selected = true;
        select?.appendChild(option);

        if (nameInput) nameInput.value = "";
        box?.classList.add("hidden");
        hideError();
        } catch {
        showError("Error de conexión al crear la categoría");
        } finally {
        saveBtn.removeAttribute("disabled");
        }
    });

    // Envío del formulario (crear o editar)
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideError();

        const formData = new FormData(form);
        const payload: ExpenseFormPayload = {
        categoryId: String(formData.get("categoryId") ?? ""),
        description: String(formData.get("description") ?? ""),
        amount: Number(formData.get("amount") ?? 0),
        paymentMethod: String(formData.get("paymentMethod") ?? ""),
        receiptUrl: String(formData.get("receiptUrl") ?? ""),
        };

        const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
        submitBtn?.setAttribute("disabled", "true");

        try {
        const url = mode === "editar" ? `/api/expenses/${expenseId}` : "/api/expenses/create";
        const method = mode === "editar" ? "PATCH" : "POST";

        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const json = await res.json();

        if (!res.ok) {
            showError(json.error ?? "No se pudo guardar el gasto");
            return;
        }

        window.location.href = "/admin/gastos";
        } catch {
        showError("Error de conexión al guardar el gasto");
        } finally {
        submitBtn?.removeAttribute("disabled");
        }
    });

    const deleteBtn = document.getElementById("delete-expense");
    deleteBtn?.addEventListener("click", async () => {
        const id = deleteBtn.getAttribute("data-delete-expense");
        if (!id) return;
        if (!confirm("¿Eliminar este gasto? Esta acción no se puede deshacer.")) return;

        try {
        const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
        const json = await res.json();
        if (!res.ok) {
            showError(json.error ?? "No se pudo eliminar el gasto");
            return;
        }
        window.location.href = "/admin/gastos";
        } catch {
        showError("Error de conexión al eliminar el gasto");
        }
    });
}

// Usado desde /admin/gastos/index.astro para los botones "Eliminar" de
// cada fila de la tabla (ahí no hay un solo formulario, hay uno por fila).
export function attachExpenseDeleteHandlers() {
    document.querySelectorAll<HTMLElement>("[data-delete-expense]").forEach((btn) => {
        btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete-expense");
        if (!id) return;
        if (!confirm("¿Eliminar este gasto? Esta acción no se puede deshacer.")) return;

        try {
            const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok) {
            alert(json.error ?? "No se pudo eliminar el gasto");
            return;
            }
            window.location.reload();
        } catch {
            alert("Error de conexión al eliminar el gasto");
        }
        });
    });
}