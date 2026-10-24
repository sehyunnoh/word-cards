// Service worker: shows the daily study reminder when the push server wakes it up,
// and focuses the app when the notification is tapped.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("오늘 단어 카드 아직 안 봤어요 📚", {
      body: "카드 5장만 넘겨볼까요?",
      icon: "favicon.svg",
      tag: "daily-word-reminder",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients[0];
      if (existing) return existing.focus();
      return self.clients.openWindow(self.registration.scope);
    })
  );
});
