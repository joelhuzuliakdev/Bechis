// public/js/modals.js

export function initModals() {
  console.log("🪟 initModals ejecutado");

  const customizeModal = document.getElementById("customize-modal");
  const closeBtn = document.getElementById("btn-close-customize");
  const addBtn = document.getElementById("btn-add-customized");
  const notesInput = document.getElementById("custom-notes");

  let currentProductCard = null;

  const customizeButtons = document.querySelectorAll(".btn-customize");

  customizeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentProductCard = btn.closest(".product-card");

      console.log(
        "🎨 Abrir personalizar producto:",
        currentProductCard?.dataset.id
      );

      customizeModal.classList.remove("hidden");
      customizeModal.classList.add("flex");
      document.body.style.overflow = "hidden";
    });
  });

  // Cerrar modal
  closeBtn?.addEventListener("click", closeModal);

  customizeModal.addEventListener("click", (e) => {
    if (e.target === customizeModal) closeModal();
  });

  function closeModal() {
    customizeModal.classList.add("hidden");
    customizeModal.classList.remove("flex");
    document.body.style.overflow = "";
    console.log("❌ Modal personalizar cerrado");
  }

  // ===============================
  // AGREGAR PRODUCTO PERSONALIZADO
  // ===============================
  addBtn?.addEventListener("click", () => {
    if (!currentProductCard) return;

    const id = currentProductCard.dataset.id;
    const name =
      currentProductCard.querySelector(".product-name")?.textContent;
    const basePrice = Number(currentProductCard.dataset.price);
    const image =
      currentProductCard.querySelector(".product-image")?.src;

    let notes = [];
    let extraAmount = 0;

    // Ingredientes removidos
    document.querySelectorAll(".opt-remove:checked").forEach((opt) => {
      notes.push(opt.value);
    });

    // Extras
    document.querySelectorAll(".opt-extra:checked").forEach((opt) => {
      const extra = Number(opt.dataset.extra || 0);
      extraAmount += extra;
      notes.push(`${opt.value} (+$${extra.toLocaleString("es-AR")})`);
    });

    // Notas libres
    if (notesInput.value.trim()) {
      notes.push(notesInput.value.trim());
    }

    const product = {
      id,
      name,
      image,
      price: basePrice + extraAmount,
      notes: notes.join(" | "),
    };

    console.log("🧾 Producto personalizado:", product);

    // 👉 ACÁ SE LO MANDAMOS AL CARRITO
    if (window.addToCartFromCustomize) {
      window.addToCartFromCustomize(product);
    }

    // Reset
    document
      .querySelectorAll(".opt-remove, .opt-extra")
      .forEach((i) => (i.checked = false));
    notesInput.value = "";

    closeModal();
  });
}
