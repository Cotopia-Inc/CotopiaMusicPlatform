self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "Everyday Radio";
  const options = {
    body: data.body || "",
    icon: "/logo.jpg",
    badge: "/logo.jpg",
    data: { url: data.url || "/notifications" },
    vibrate: [100, 50, 100],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/notifications";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
