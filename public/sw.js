// Service Worker for Push Notifications
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(clients.claim());
});

// Listen for push events
self.addEventListener('push', (event) => {
    console.log('Push notification received:', event);

    let data = {
        title: 'UniTracker',
        body: 'Yeni bir bildiriminiz var!',
        icon: '/vite.svg',
        badge: '/vite.svg',
        tag: 'default',
        data: { url: '/' }
    };

    if (event.data) {
        try {
            const payload = event.data.json();
            data = {
                title: payload.title || data.title,
                body: payload.body || data.body,
                icon: payload.icon || data.icon,
                badge: payload.badge || data.badge,
                tag: payload.tag || data.tag,
                data: payload.data || data.data
            };
        } catch (e) {
            console.error('Error parsing push notification:', e);
        }
    }

    const promiseChain = self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        tag: data.tag,
        data: data.data,
        vibrate: [200, 100, 200],
        requireInteraction: false
    });

    event.waitUntil(promiseChain);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Check if there's already a window/tab open
                for (let client of windowClients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus().then(client => {
                            // Navigate to the notification URL
                            return client.navigate(urlToOpen);
                        });
                    }
                }
                // If no window is open, open a new one
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Handle background sync (optional - for future offline support)
self.addEventListener('sync', (event) => {
    console.log('Background sync:', event);
    if (event.tag === 'sync-notifications') {
        event.waitUntil(syncNotifications());
    }
});

async function syncNotifications() {
    // Future: Sync offline notifications
    console.log('Syncing notifications...');
}
