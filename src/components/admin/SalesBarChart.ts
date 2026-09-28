// Gráfico de barras "Ventas — últimos 7 días" para /admin/reportes.
// Lo dibujamos a mano con divs (altura en %) en vez de traer una
// librería de charts solo para 7 puntos — mantiene el bundle liviano,
// como el resto del panel.

interface DailySales {
    date: string;
    label: string;
    total: number;
    count: number;
}

type Metric = "total" | "count";

function formatValue(value: number, metric: Metric): string {
    if (metric === "total") {
        return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
        }).format(value);
    }
    return `${value} venta${value === 1 ? "" : "s"}`;
}

export function mountSalesBarChart() {
    const dataScript = document.getElementById("sales-chart-data");
    const barsContainer = document.getElementById("sales-chart-bars");
    const tooltip = document.getElementById("sales-chart-tooltip");
    const buttons = document.querySelectorAll<HTMLButtonElement>(".chart-toggle-btn");

    if (!dataScript || !barsContainer) return;

    let days: DailySales[] = [];
    try {
        days = JSON.parse(dataScript.textContent ?? "[]");
    } catch {
        days = [];
    }

    let metric: Metric = "total";

    function setActiveButton() {
        buttons.forEach((b) => {
        const isActive = (b.dataset.metric ?? "total") === metric;
        b.classList.toggle("bg-bechis-yellow", isActive);
        b.classList.toggle("text-ink", isActive);
        b.classList.toggle("text-text-muted", !isActive);
        });
    }

    function render() {
        const values = days.map((d) => (metric === "total" ? d.total : d.count));
        const max = Math.max(1, ...values);

        barsContainer!.innerHTML = "";

        days.forEach((day) => {
        const value = metric === "total" ? day.total : day.count;
        const heightPercent = Math.max(4, (value / max) * 100);

        const col = document.createElement("div");
        col.className = "flex flex-1 flex-col items-center justify-end h-full gap-2";

        const barWrap = document.createElement("div");
        barWrap.className = "w-full flex items-end justify-center h-full";

        const bar = document.createElement("div");
        bar.className =
            "w-full max-w-10 rounded-t-sm bg-bechis-yellow transition-all cursor-pointer hover:bg-bechis-yellow-dark";
        bar.style.height = `${heightPercent}%`;
        bar.setAttribute("title", `${day.label} — ${formatValue(value, metric)}`);

        bar.addEventListener("mouseenter", () => {
            if (tooltip) {
            tooltip.textContent = `${day.label}: ${formatValue(value, metric)}`;
            tooltip.classList.remove("hidden");
            }
        });
        bar.addEventListener("mouseleave", () => {
            tooltip?.classList.add("hidden");
        });

        barWrap.appendChild(bar);

        const label = document.createElement("span");
        label.className = "text-xs text-text-muted";
        label.textContent = day.label;

        col.appendChild(barWrap);
        col.appendChild(label);
        barsContainer!.appendChild(col);
        });
    }

    buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
        metric = (btn.dataset.metric as Metric) ?? "total";
        setActiveButton();
        render();
        });
    });

    setActiveButton();
    render();
}