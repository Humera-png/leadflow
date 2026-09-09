// LeadFlow push notification service worker.
// Handles two things: showing a notification when a push arrives, and
// focusing/opening the app (at the right lead) when the notification is tapped.

self.addEventListener("push", (event) => {
  let data = { title: "LeadFlow", body: "You have a new update.", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // non-JSON payload — fall back to the default text above
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        const clientPath = new URL(client.url).pathname;
        if (clientPath === new URL(targetUrl, self.location.origin).pathname && "focus" in client) {
          return client.focus();
        }
      }
      // No matching tab open — focus any LeadFlow tab and navigate it, or open a new one.
      if (clients.length > 0 && "focus" in clients[0]) {
        clients[0].navigate(targetUrl);
        return clients[0].focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
