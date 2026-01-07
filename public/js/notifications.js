// public/js/notifications.js
export function showNotification(message) {
  const n = document.createElement("div");
  n.className =
    "fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50";
  n.textContent = message;

  document.body.appendChild(n);

  setTimeout(() => {
    n.remove();
  }, 2000);
}
