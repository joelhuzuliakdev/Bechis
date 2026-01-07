// public/js/filters.js

export function initFilters() {
  console.log("🧪 initFilters ejecutado");

  const buttons = document.querySelectorAll(".filter-btn");
  const cards = document.querySelectorAll(".product-card");
  const counter = document.getElementById("products-count");

  let activeFilter = "todos";

  function aplicarFiltro() {
    let visible = 0;

    cards.forEach((card) => {
      const category = card.dataset.category;
      const show =
        activeFilter === "todos" || category === activeFilter;

      if (show) {
        card.classList.remove("hidden");
        visible++;
      } else {
        card.classList.add("hidden");
      }
    });

    if (counter) counter.textContent = visible;
  }

  function actualizarBotones() {
    buttons.forEach((btn) => {
      const isActive = btn.dataset.filter === activeFilter;

      btn.classList.remove(
        "bg-amber-400",
        "border-amber-400",
        "text-white",
        "font-semibold",
        "shadow",
        "shadow-amber-500/40"
      );

      btn.classList.add(
        "bg-zinc-900",
        "border-zinc-700",
        "text-zinc-300"
      );

      if (isActive) {
        btn.classList.remove(
          "bg-zinc-900",
          "border-zinc-700",
          "text-zinc-300"
        );

        btn.classList.add(
          "bg-amber-400",
          "border-amber-400",
          "text-white",
          "font-semibold",
          "shadow",
          "shadow-amber-500/40"
        );
      }
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      actualizarBotones();
      aplicarFiltro();
    });
  });

  // Estado inicial
  actualizarBotones();
  aplicarFiltro();
}
