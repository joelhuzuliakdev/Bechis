// Lógica cliente del formulario de proveedores (alta y edición) +
// activar/desactivar. attachSupplierToggleHandlers() se usa aparte
// desde /admin/proveedores/index.astro para los botones de la tabla.

interface SupplierFormPayload {
  name: string;
  company: string;
  phone: string;
  email: string;
  cuit: string;
  address: string;
  notes: string;
}

function showError(message: string) {
  const box = document.getElementById("supplier-form-error");
  if (!box) return;
  box.textContent = message;
  box.classList.remove("hidden");
}

function hideError() {
  document.getElementById("supplier-form-error")?.classList.add("hidden");
}

async function toggleSupplierActive(id: string, isActive: boolean): Promise<boolean> {
  const confirmMsg = isActive
    ? "¿Desactivar este proveedor? No vas a poder elegirlo en nuevas facturas, pero se conserva su historial."
    : "¿Activar este proveedor?";
  if (!confirm(confirmMsg)) return false;

  try {
    const res = await fetch(`/api/suppliers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !isActive }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error ?? "No se pudo actualizar el proveedor");
      return false;
    }
    return true;
  } catch {
    alert("Error de conexión al actualizar el proveedor");
    return false;
  }
}

export function mountSupplierForm() {
  const form = document.getElementById("supplier-form") as HTMLFormElement | null;
  if (!form) return;

  const mode = form.dataset.mode === "editar" ? "editar" : "crear";
  const supplierId = form.dataset.supplierId || "";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const formData = new FormData(form);
    const payload: SupplierFormPayload = {
      name: String(formData.get("name") ?? ""),
      company: String(formData.get("company") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      cuit: String(formData.get("cuit") ?? ""),
      address: String(formData.get("address") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    };

    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    submitBtn?.setAttribute("disabled", "true");

    try {
      const url = mode === "editar" ? `/api/suppliers/${supplierId}` : "/api/suppliers/create";
      const method = mode === "editar" ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        showError(json.error ?? "No se pudo guardar el proveedor");
        return;
      }

      window.location.href = "/admin/proveedores";
    } catch {
      showError("Error de conexión al guardar el proveedor");
    } finally {
      submitBtn?.removeAttribute("disabled");
    }
  });

  const toggleBtn = document.getElementById("toggle-active");
  toggleBtn?.addEventListener("click", async () => {
    const id = toggleBtn.getAttribute("data-supplier-id");
    const isActive = toggleBtn.getAttribute("data-active") === "true";
    if (!id) return;

    const ok = await toggleSupplierActive(id, isActive);
    if (ok) window.location.reload();
  });
}

// Usado desde /admin/proveedores/index.astro para los botones
// activar/desactivar de cada fila de la tabla.
export function attachSupplierToggleHandlers() {
  document.querySelectorAll<HTMLElement>("[data-toggle-active]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-toggle-active");
      const isActive = btn.getAttribute("data-active") === "true";
      if (!id) return;

      const ok = await toggleSupplierActive(id, isActive);
      if (ok) window.location.reload();
    });
  });
}