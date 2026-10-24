// Daily study check + Web Push reminder.
// The push server is the Calisthenics Cloudflare Worker (shared): every hour from 18:00 to 21:59
// local time it wakes this device's service worker until today is marked done.
const PUSH_API_URL = "https://calisthenics-push.sehyun-calisthenics.workers.dev";
const VAPID_PUBLIC_KEY = "BDVo3PjxNVCp_RAlfGfrBv-CUxJrLQ88aF5bCIe5aWc6Nvwj9VpIMLU_WaXOV1r1K-De2UZj_MVybDEkmFUY3Ro";

const DAILY_GOAL = 5;
const PROGRESS_KEY = "wordCardsProgress";
const ENABLED_KEY = "wordCardsReminderEnabled";

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---- daily progress: distinct cards flipped today ----

function readProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null");
    if (p && p.date === todayKey() && Array.isArray(p.ids)) return p;
  } catch {
    // fall through to a fresh record
  }
  return { date: todayKey(), ids: [] };
}

function reviewedToday() {
  return readProgress().ids.length;
}

function isTodayDone() {
  return reviewedToday() >= DAILY_GOAL;
}

// Records a flipped card. Returns true when this call is the one that completed today.
function recordReview(id) {
  const p = readProgress();
  if (p.ids.includes(id)) return false;
  const wasDone = p.ids.length >= DAILY_GOAL;
  p.ids.push(id);
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  const nowDone = p.ids.length >= DAILY_GOAL;
  if (nowDone && !wasDone) syncCompletion(true);
  return nowDone && !wasDone;
}

// ---- push reminder ----

function reminderEnabled() {
  return localStorage.getItem(ENABLED_KEY) === "1";
}

function getPermission() {
  const supported =
    typeof Notification !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  return supported ? Notification.permission : "unsupported";
}

function urlBase64ToUint8Array(base64Url) {
  const padded = base64Url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function post(path, body) {
  const res = await fetch(`${PUSH_API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
}

async function getRegistration() {
  await navigator.serviceWorker.register("sw.js");
  return navigator.serviceWorker.ready;
}

async function registerWithServer(subscription) {
  await post("/subscribe", {
    subscription: subscription.toJSON(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    date: todayKey(),
    done: isTodayDone(),
    app: "word-cards",
  });
}

// Returns "granted" | "denied" | "default" | "unsupported" | "error".
async function enableReminder() {
  if (getPermission() === "unsupported") return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return permission;
    const registration = await getRegistration();
    const subscription =
      (await registration.pushManager.getSubscription()) ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));
    await registerWithServer(subscription);
    localStorage.setItem(ENABLED_KEY, "1");
    return "granted";
  } catch (err) {
    console.error(err);
    return "error";
  }
}

async function disableReminder() {
  localStorage.removeItem(ENABLED_KEY);
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await (registration && registration.pushManager.getSubscription());
    if (!subscription) return;
    await post("/unsubscribe", { endpoint: subscription.endpoint });
    await subscription.unsubscribe();
  } catch {
    // Offline or server unreachable - the server drops dead subscriptions on its own.
  }
}

// Called on app start while reminders are enabled, to keep the server's copy fresh.
async function refreshReminder() {
  if (!reminderEnabled() || getPermission() !== "granted") return;
  try {
    const subscription = await (await getRegistration()).pushManager.getSubscription();
    if (subscription) await registerWithServer(subscription);
  } catch {
    // Retried on the next app start.
  }
}

// Tells the server whether today is done so it stops (or resumes) sending reminders.
async function syncCompletion(done) {
  if (!reminderEnabled() || getPermission() !== "granted") return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await (registration && registration.pushManager.getSubscription());
    if (subscription) await post("/status", { endpoint: subscription.endpoint, date: todayKey(), done });
  } catch {
    // Retried by refreshReminder() on the next app start.
  }
}
