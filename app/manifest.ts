import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nexor Vault',
    short_name: 'Nexor',
    description: 'Secure every connection. Password manager zero-knowledge.',
    start_url: '/vault',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // Android: aparece "Nexor" en el menú Compartir de cualquier web; abre /open con la
    // URL y muestra al instante las credenciales de ese sitio.
    share_target: {
      action: '/open',
      method: 'GET',
      params: { title: 'title', text: 'text', url: 'url' },
    },
    shortcuts: [
      { name: 'Buscar un acceso', short_name: 'Buscar', url: '/open', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
