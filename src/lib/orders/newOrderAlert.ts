// Aviso de pedido nuevo para TODO el panel (admin y empleado).
//
// Qué hace:
//  - Escucha los INSERT de `orders` con Supabase Realtime (un solo canal por pestaña).
//  - Por cada pedido nuevo muestra un cartel "🔔 ¡Nuevo pedido #XX!" y hace sonar
//    un aviso UNA vez.
//  - Avisa al Kanban (si está abierto) con un evento de ventana para que agregue
//    la tarjeta; el Kanban ya no tiene su propio listener de INSERT.
//  - Si se corta la conexión, al volver trae los pedidos de nuevo y avisa SOLO de los
//    que no conocía y siguen en "pedidos". Sin polling: se dispara por eventos
//    (reconexión del canal, volver a la pestaña, volver la red).
//  - Los navegadores bloquean el sonido hasta que la persona interactúa con la
//    página: por eso existe el botón "Activar sonidos" (se ubica en el Header, en el
//    elemento con data-role="sound-control").
//
// Es seguro llamar a initOrderAlerts() más de una vez: solo arranca la primera vez.

import { supabaseBrowser } from "@/lib/supabase/client";

const PENDING_STATUS = "pedidos";
const MUTE_KEY = "bechis:orderSound"; // "muted" si se silenció a mano
const BANNER_MS = 12_000;
const MAX_BANNERS = 4;
const CHIME_GAP_MS = 750;
const MIN_RESYNC_GAP_MS = 2_000;
const HIDDEN_RESYNC_AFTER_MS = 20_000;

// Eventos de ventana que escucha el Kanban.
const NEW_ORDER_EVENT = "bechis:new-order"; // detail: { id }
const ORDERS_RESYNC_EVENT = "bechis:orders-resync"; // detail: { orders, requestedAt, mode }

type SyncMode = "baseline" | "reconnect";

interface AlertState {
  started: boolean;
  known: Set<string>; // pedidos ya vistos en esta pestaña (para no avisar dos veces)
  everSubscribed: boolean;
  needsResync: boolean;
  syncing: boolean;
  lastSync: number;
  hiddenAt: number | null;
  ctx: AudioContext | null;
  chimeQueue: number;
  chiming: boolean;
  button: HTMLButtonElement | null;
}

// El estado vive en window para que sobreviva aunque el módulo se cargue dos veces.
function state(): AlertState {
  const w = window as any;
  if (!w.__bechisOrderAlerts) {
    w.__bechisOrderAlerts = {
      started: false,
      known: new Set<string>(),
      everSubscribed: false,
      needsResync: false,
      syncing: false,
      lastSync: 0,
      hiddenAt: null,
      ctx: null,
      chimeQueue: 0,
      chiming: false,
      button: null,
    } satisfies AlertState;
  }
  return w.__bechisOrderAlerts as AlertState;
}

/* ------------------------------ Sonido ------------------------------ */

function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "muted";
  } catch {
    return false;
  }
}

function setMuted(muted: boolean): void {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, "muted");
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    /* sin localStorage: la preferencia solo dura mientras la página esté abierta */
  }
}

function getCtx(): AudioContext | null {
  const s = state();
  if (s.ctx) return s.ctx;
  const Ctor: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  try {
    s.ctx = new Ctor();
    s.ctx.addEventListener("statechange", renderSoundControl);
  } catch {
    s.ctx = null;
  }
  return s.ctx;
}

function soundReady(): boolean {
  const ctx = state().ctx;
  return !!ctx && ctx.state === "running";
}

// Hay que llamarla desde un gesto del usuario (click, tecla, toque).
async function unlockAudio(): Promise<boolean> {
  const ctx = getCtx();
  if (!ctx) return false;
  if (ctx.state !== "running") {
    try {
      await ctx.resume();
    } catch {
      /* el navegador lo rechazó: seguimos bloqueados */
    }
  }
  return ctx.state === "running";
}

// Dos notas cortas (tipo "ding-dong").
function playChimeNow(): void {
  const ctx = state().ctx;
  if (!ctx || ctx.state !== "running") return;
  const t0 = ctx.currentTime;
  for (const note of [
    { freq: 880, at: 0 },
    { freq: 1318.5, at: 0.2 },
  ]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = note.freq;
    gain.gain.setValueAtTime(0.0001, t0 + note.at);
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + note.at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.at + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0 + note.at);
    osc.stop(t0 + note.at + 0.5);
  }
}

// Si entran varios pedidos juntos (p. ej. tras una reconexión) suenan de a uno,
// separados, en vez de pisarse.
async function enqueueChime(): Promise<void> {
  const s = state();
  s.chimeQueue += 1;
  if (s.chiming) return;
  s.chiming = true;
  while (s.chimeQueue > 0) {
    s.chimeQueue -= 1;
    playChimeNow();
    await new Promise((r) => setTimeout(r, CHIME_GAP_MS));
  }
  s.chiming = false;
}

// El navegador exige un gesto del usuario: el primer click/tecla/toque en la página
// desbloquea el sonido sin que haya que apretar el botón.
function armUnlockOnGesture(): void {
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  const handler = () => {
    if (isMuted()) return;
    void unlockAudio().then((ok) => {
      if (ok) events.forEach((e) => window.removeEventListener(e, handler, true));
      renderSoundControl();
    });
  };
  events.forEach((e) => window.addEventListener(e, handler, true));
}

/* --------------------------- Botón de sonido --------------------------- */

function renderSoundControl(): void {
  const slot = document.querySelector<HTMLElement>("[data-role='sound-control']");
  if (!slot) return;
  const s = state();

  if (!s.button || !slot.contains(s.button)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.addEventListener("click", async () => {
      if (isMuted()) {
        setMuted(false);
        if (await unlockAudio()) playChimeNow(); // prueba, no cuenta como pedido
      } else if (!soundReady()) {
        if (await unlockAudio()) playChimeNow();
      } else {
        setMuted(true);
      }
      renderSoundControl();
    });
    slot.replaceChildren(btn);
    s.button = btn;
  }

  const btn = s.button!;
  const compact = window.innerWidth < 480;
  const base =
    "border-radius:9999px;padding:4px 10px;font-size:12px;font-weight:600;line-height:1.2;cursor:pointer;white-space:nowrap;";

  if (isMuted()) {
    btn.textContent = compact ? "🔕" : "🔕 Sonido silenciado";
    btn.title = "Tocá para volver a activar el sonido de los avisos";
    btn.style.cssText = base + "background:#fff;color:#6b7280;border:1px solid #d1d5db;";
  } else if (!soundReady()) {
    btn.textContent = compact ? "🔔 Activar" : "🔔 Activar sonidos";
    btn.title = "El navegador bloquea el sonido hasta que lo actives con un toque";
    btn.style.cssText = base + "background:#facc15;color:#141414;border:1px solid #eab308;";
  } else {
    btn.textContent = compact ? "🔔" : "🔔 Sonido activado";
    btn.title = "Tocá para silenciar los avisos";
    btn.style.cssText = base + "background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;";
  }
}

/* ------------------------------- Cartel ------------------------------- */

function bannerContainer(): HTMLElement {
  let c = document.getElementById("bechis-order-alerts");
  if (c) return c;
  c = document.createElement("div");
  c.id = "bechis-order-alerts";
  c.style.cssText =
    "position:fixed;top:68px;right:12px;z-index:9998;display:flex;flex-direction:column;gap:8px;max-width:calc(100vw - 24px);pointer-events:none;";
  document.body.appendChild(c);
  return c;
}

function showBanner(order: { id: string; orderNumber: string | number | null }): void {
  const container = bannerContainer();
  while (container.children.length >= MAX_BANNERS) container.firstElementChild?.remove();

  const el = document.createElement("div");
  el.setAttribute("role", "status");
  // OJO: no usar data-order-id, es el atributo que usan las tarjetas del Kanban
  // y se confundirían con este cartel.
  el.dataset.alertOrderId = order.id;
  el.style.cssText =
    "pointer-events:auto;display:flex;align-items:center;gap:10px;background:#141414;color:#fff;border-left:5px solid #facc15;border-radius:10px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.3);font-family:system-ui,sans-serif;font-size:14px;";

  const text = document.createElement("div");
  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.textContent = order.orderNumber ? `🔔 ¡Nuevo pedido #${order.orderNumber}!` : "🔔 ¡Nuevo pedido!";
  text.appendChild(title);

  // Aviso cuando el navegador no deja sonar: se explica en el mismo cartel.
  if (!isMuted() && !soundReady()) {
    const hint = document.createElement("div");
    hint.style.cssText = "font-size:12px;color:#fde68a;margin-top:2px;";
    hint.textContent = "Tocá «Activar sonidos» arriba para escuchar los avisos.";
    text.appendChild(hint);
  }
  el.appendChild(text);

  if (!location.pathname.startsWith("/empleado/pedidos")) {
    const link = document.createElement("a");
    link.href = "/empleado/pedidos";
    link.textContent = "Ver pedidos";
    link.style.cssText =
      "background:#facc15;color:#141414;font-weight:700;font-size:12px;padding:6px 10px;border-radius:6px;text-decoration:none;white-space:nowrap;";
    el.appendChild(link);
  }

  const close = document.createElement("button");
  close.type = "button";
  close.setAttribute("aria-label", "Cerrar aviso");
  close.textContent = "✕";
  close.style.cssText = "background:none;border:0;color:#9ca3af;font-size:14px;cursor:pointer;padding:2px 4px;";
  close.addEventListener("click", () => el.remove());
  el.appendChild(close);

  container.appendChild(el);
  setTimeout(() => el.remove(), BANNER_MS);
}

function announce(order: { id: string; orderNumber: string | number | null }): void {
  showBanner(order);
  if (isMuted()) return;
  if (soundReady()) void enqueueChime();
  else renderSoundControl(); // sigue bloqueado: el cartel ya explica cómo activarlo
}

/* ------------------------ Realtime y sincronización ------------------------ */

function onLiveInsert(row: any): void {
  const id: string | undefined = row?.id;
  if (!id) return;
  const s = state();
  if (s.known.has(id)) return; // evento repetido: no se vuelve a avisar
  s.known.add(id);

  // El Kanban (si está abierto) agrega la tarjeta.
  window.dispatchEvent(new CustomEvent(NEW_ORDER_EVENT, { detail: { id } }));

  // Un pedido que ya no está en "pedidos" no es "nuevo".
  if (row.status && row.status !== PENDING_STATUS) return;
  announce({ id, orderNumber: row.order_number ?? null });
}

// Trae los pedidos activos una vez. "baseline" (al abrir la página) solo registra
// los que ya existen, SIN avisar. "reconnect" avisa únicamente de los que no se
// conocían y siguen en "pedidos".
async function syncPending(mode: SyncMode): Promise<void> {
  const s = state();
  if (s.syncing) return;
  const now = Date.now();
  if (mode === "reconnect" && now - s.lastSync < MIN_RESYNC_GAP_MS) return;
  s.syncing = true;
  s.lastSync = now;

  try {
    const res = await fetch("/api/orders/active", { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return;
    const body = await res.json();
    const orders: any[] = Array.isArray(body?.orders) ? body.orders : [];

    // El Kanban (si está abierto) se pone al día con la lista.
    window.dispatchEvent(new CustomEvent(ORDERS_RESYNC_EVENT, { detail: { orders, requestedAt: now, mode } }));

    for (const o of orders) {
      if (o.status !== PENDING_STATUS || s.known.has(o.id)) continue;
      s.known.add(o.id);
      if (mode === "reconnect") announce({ id: o.id, orderNumber: o.orderNumber ?? null });
    }
  } catch (err) {
    console.error("newOrderAlert: no se pudo sincronizar los pedidos:", err);
  } finally {
    s.syncing = false;
  }
}

function onChannelStatus(status: string): void {
  const s = state();
  if (status === "SUBSCRIBED") {
    const reconnected = s.everSubscribed && s.needsResync;
    s.everSubscribed = true;
    s.needsResync = false;
    if (reconnected) void syncPending("reconnect");
    return;
  }
  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
    s.needsResync = true;
  }
}

function onVisibilityChange(): void {
  const s = state();
  if (document.visibilityState === "hidden") {
    s.hiddenAt = Date.now();
    return;
  }
  const hiddenFor = s.hiddenAt ? Date.now() - s.hiddenAt : 0;
  s.hiddenAt = null;
  // Tras un rato en segundo plano (o con la compu dormida) la conexión pudo caerse.
  if (hiddenFor >= HIDDEN_RESYNC_AFTER_MS) void syncPending("reconnect");
}

export async function initOrderAlerts(): Promise<void> {
  if (typeof window === "undefined") return;
  const s = state();
  if (s.started) {
    renderSoundControl();
    return;
  }
  s.started = true; // primero: así una segunda llamada no crea otro canal

  getCtx();
  renderSoundControl();
  armUnlockOnGesture();

  try {
    // Igual que el Kanban: sin esto la conexión puede quedar "anónima" para RLS
    // y no llegar ningún evento, sin error visible.
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();
    if (session) supabaseBrowser.realtime.setAuth(session.access_token);
  } catch (err) {
    console.error("newOrderAlert: no se pudo leer la sesión:", err);
  }

  supabaseBrowser
    .channel("orders-alerts")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) =>
      onLiveInsert(payload.new)
    )
    .subscribe((status) => onChannelStatus(status));

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("online", () => {
    setTimeout(() => void syncPending("reconnect"), 1_500);
  });

  // Punto de partida: registra los pedidos que ya existen para no avisar de ellos.
  void syncPending("baseline");
}