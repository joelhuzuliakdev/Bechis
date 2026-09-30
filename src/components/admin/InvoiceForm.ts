// Lógica cliente del formulario de facturas: alta/edición del formulario
// principal, y las acciones "Marcar como pagada" / "Volver a pendiente",
// que llaman a las funciones RPC atómicas del backend (ver migración
// 0010_link_invoices_expenses.sql).

interface InvoiceFormPayload {
  supplierId: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  detail: string;
  imageUrl: string;
  total: number;
}

function showError(message: string) {
  const box = document.getElementById("invoice-form-error");
  if (!box) return;
  box.textContent = message;
  box.classList.remove("hidden");
}

function hideError() {
  document.getElementById("invoice-form-error")?.classList.add("hidden");
}

export function mountInvoiceForm() {
  const form = document.getElementById("invoice-form") as HTMLFormElement | null;
  if (!form) return;

  const mode = form.dataset.mode === "editar" ? "editar" : "crear";
  const invoiceId = form.dataset.invoiceId || "";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const formData = new FormData(form);
    const payload: InvoiceFormPayload = {
      supplierId: String(formData.get("supplierId") ?? ""),
      invoiceNumber: String(formData.get("invoiceNumber") ?? ""),
      date: String(formData.get("date") ?? ""),
      dueDate: String(formData.get("dueDate") ?? ""),
      detail: String(formData.get("detail") ?? ""),
      imageUrl: String(formData.get("imageUrl") ?? ""),
      total: Number(formData.get("total") ?? 0),
    };

    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    submitBtn?.setAttribute("disabled", "true");

    try {
      const url = mode === "editar" ? `/api/invoices/${invoiceId}` : "/api/invoices/create";
      const method = mode === "editar" ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        showError(json.error ?? "No se pudo guardar la factura");
        return;
      }

      window.location.href = "/admin/facturas";
    } catch {
      showError("Error de conexión al guardar la factura");
    } finally {
      submitBtn?.removeAttribute("disabled");
    }
  });

  // Marcar como pagada: despliega categoría + método de pago, y confirma.
  const toggleBtn = document.getElementById("toggle-pay-box");
  const payBox = document.getElementById("pay-box");
  toggleBtn?.addEventListener("click", () => {
    payBox?.classList.toggle("hidden");
  });

  const confirmPayBtn = document.getElementById("confirm-pay") as HTMLButtonElement | null;
  confirmPayBtn?.addEventListener("click", async () => {
    const categorySelect = document.getElementById("pay-category") as HTMLSelectElement | null;
    const methodSelect = document.getElementById("pay-method") as HTMLSelectElement | null;
    const categoryId = categorySelect?.value;
    const paymentMethod = methodSelect?.value;

    if (!categoryId) {
      showError("Elegí una categoría de gasto para poder marcar la factura como pagada");
      return;
    }

    confirmPayBtn.setAttribute("disabled", "true");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, paymentMethod }),
      });
      const json = await res.json();

      if (!res.ok) {
        showError(json.error ?? "No se pudo marcar la factura como pagada");
        return;
      }

      window.location.reload();
    } catch {
      showError("Error de conexión al marcar la factura como pagada");
    } finally {
      confirmPayBtn.removeAttribute("disabled");
    }
  });

  // Volver a pendiente: borra el gasto vinculado.
  const unpayBtn = document.getElementById("unpay-invoice");
  unpayBtn?.addEventListener("click", async () => {
    if (
      !confirm(
        "¿Volver esta factura a pendiente? Esto va a eliminar el gasto que se había generado al pagarla."
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/unpay`, { method: "POST" });
      const json = await res.json();

      if (!res.ok) {
        showError(json.error ?? "No se pudo actualizar la factura");
        return;
      }

      window.location.reload();
    } catch {
      showError("Error de conexión al actualizar la factura");
    }
  });
}