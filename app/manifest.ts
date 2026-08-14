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
    background_color: '#0b0d10',
    theme_color: '#0b0d10',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
