// public/js/cart.js
import { showNotification } from "./notifications.js";

let cart = [];

export function initCart() {
  console.log("🛒 initCart ejecutado");

  const cartCounter = document.getElementById("cart-count");
  const cartModal = document.getElementById("cart-modal");
  const cartItems = document.getElementById("cart-items");
  const cartTotal = document.getElementById("cart-total");

  const btnOpenCart = document.getElementById("btn-open-cart");
  const btnCloseCart = document.getElementById("btn-close-cart");

  const addButtons = document.querySelectorAll(".btn-add");

  if (!cartCounter || !cartItems || !cartTotal) {
    console.warn("❌ Elementos del carrito no encontrados");
    return;
  }

  console.log("➕ botones agregar:", addButtons.length);

  // ===============================
  // ABRIR / CERRAR CARRITO
  // ===============================
  btnOpenCart?.addEventListener("click", () => {
    cartModal.classList.remove("hidden");
    cartModal.classList.add("flex");
    document.body.style.overflow = "hidden";
  });

  btnCloseCart?.addEventListener("click", () => {
    closeCart();
  });

  cartModal?.addEventListener("click", (e) => {
    if (e.target === cartModal) closeCart();
  });

  function closeCart() {
    cartModal.classList.add("hidden");
    cartModal.classList.remove("flex");
    document.body.style.overflow = "";
  }

  // ===============================
  // AGREGAR PRODUCTO DIRECTO
  // ===============================
  addButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".product-card");

      const product = {
        id: card.dataset.id,
        name: card.querySelector(".product-name")?.textContent,
        price: Number(card.dataset.price),
        image: card.querySelector(".product-image")?.src,
        notes: "",
        quantity: 1,
      };

      addToCart(product);

      showNotification(`🛒 ${product.name} agregado al carrito`);
    });
  });

  // ===============================
  // FUNCIÓN CENTRAL
  // ===============================
  function addToCart(product) {
    cart.push(product);
    renderCart();
  }

  // ===============================
  // RENDER CARRITO
  // ===============================
  function renderCart() {
    cartItems.innerHTML = "";

    let total = 0;

    if (cart.length === 0) {
      cartItems.innerHTML = `
        <p class="text-zinc-400 text-sm text-center py-8">
          Tu carrito está vacío
        </p>
      `;
    }

    cart.forEach((item, index) => {
      total += item.price * item.quantity;

      cartItems.innerHTML += `
        <div class="flex gap-3 border-b border-zinc-800 pb-4 mb-4">
          <img
            src="${item.image}"
            alt="${item.name}"
            class="w-16 h-16 rounded-lg object-cover bg-zinc-800"
          />

          <div class="flex-1">
            <div class="flex justify-between items-start">
              <div>
                <p class="text-zinc-50 font-medium text-sm">
                  ${item.name}
                </p>
                ${
                  item.notes
                    ? `<p class="text-xs text-amber-400 mt-1">${item.notes}</p>`
                    : ""
                }
              </div>

              <button
                class="btn-remove text-red-400 hover:text-red-300 transition p-1"
                data-index="${index}"
                aria-label="Eliminar producto"
              >
                🗑️
              </button>
            </div>

            <p class="text-sm text-zinc-300 mt-1">
              $${item.price.toLocaleString("es-AR")}
            </p>
          </div>
        </div>
      `;
    });

    cartCounter.textContent = cart.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    cartTotal.textContent = `$${total.toLocaleString("es-AR")}`;

    // ===============================
    // ELIMINAR PRODUCTO
    // ===============================
    document.querySelectorAll(".btn-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number(btn.dataset.index);
        const removed = cart[index];

        cart.splice(index, 1);
        renderCart();

        showNotification(`🗑️ ${removed.name} eliminado`);
      });
    });

    console.log("🧾 carrito renderizado", cart);
  }

  // ===============================
  // EXPONER PARA PERSONALIZADOS
  // ===============================
  window.addToCartFromCustomize = function (product) {
    cart.push({
      ...product,
      quantity: 1,
    });

    renderCart();

    showNotification(`🛒 ${product.name} agregado al carrito`);
  };
}
