'use client';

import { useEffect } from 'react';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Se suscribe a Web Push la primera vez que el vault está desbloqueado en
// este dispositivo. Silencioso si el navegador no soporta push, si el
// usuario deniega el permiso, o si falta la VAPID key pública.
export default function PushSetup() {
  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'denied') return;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
          if (permission !== 'granted') return;
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription }),
        });
      } catch {
        // sin push en este dispositivo/navegador — no bloquea el resto de la app
      }
    })();
  }, []);

  return null;
}
