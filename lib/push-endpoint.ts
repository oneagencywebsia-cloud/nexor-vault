/**
 * El servidor hace POST al `endpoint` de cada suscripción push. Si se aceptara
 * cualquier URL, un usuario podría apuntarlo a servicios internos (SSRF).
 * Solo se admiten los servicios push de los navegadores, siempre por HTTPS.
 */
const ALLOWED_HOST_SUFFIXES = [
  'fcm.googleapis.com', // Chrome / Edge / Android
  'push.services.mozilla.com', // Firefox
  'notify.windows.com', // Edge / Windows (WNS)
  'push.apple.com', // Safari / iOS
];

export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
}
