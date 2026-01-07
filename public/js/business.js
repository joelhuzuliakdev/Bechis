export function initBusiness() {
  function checkBusinessStatus() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime = currentHour + currentMinutes / 60;

    const openTime = 19;
    const closeTime = 24;

    const isOpen = currentTime >= openTime && currentTime < closeTime;

    const statusBanner = document.getElementById("status-banner");
    const statusIndicator = document.getElementById("status-indicator");
    const statusText = document.getElementById("status-text");
    const deliveryTime = document.getElementById("delivery-time");

    if (!statusBanner) return isOpen;

    if (isOpen) {
      statusBanner.className =
        "bg-gradient-to-r from-green-600/20 to-green-500/10 border border-green-500/30 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3";
      statusIndicator.className =
        "w-3 h-3 bg-green-400 rounded-full animate-pulse";
      statusText.textContent = "Abierto ahora";
      if (deliveryTime) deliveryTime.style.display = "inline";
    } else {
      statusBanner.className =
        "bg-gradient-to-r from-red-600/20 to-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3";
      statusIndicator.className = "w-3 h-3 bg-red-400 rounded-full";
      statusText.textContent = "Cerrado";
      if (deliveryTime) deliveryTime.style.display = "none";
    }

    return isOpen;
  }

  checkBusinessStatus();
  setInterval(checkBusinessStatus, 60000);

  // lo exportamos global para cart.js
  window.checkBusinessStatus = checkBusinessStatus;
}
