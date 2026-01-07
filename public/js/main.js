// public/js/main.js
console.log("🔥 main.js cargado");

import { initFilters } from "./filters.js";
import { initCart } from "./cart.js";
import { initModals } from "./modals.js";
import { showNotification } from "./notifications.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 DOM listo");

  initFilters();
  initCart();
  initModals();
});
