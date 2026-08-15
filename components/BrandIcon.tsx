'use client';

import { useEffect, useState } from 'react';

const svgCache = new Map<string, string>();

// Descarga el SVG de /public/brand-icons/{slug}.svg (generado por
// scripts/generate-brand-icons.mjs a partir de simple-icons) y lo inserta
// inline para poder teñirlo vía CSS `color` (fill="currentColor" ya viene
// inyectado en el archivo). Cachea en memoria entre carpetas repetidas.
export function BrandIcon({ slug, className }: { slug: string; className?: string }) {
  const [, forceRender] = useState(0);
  const cached = svgCache.get(slug) ?? null;

  useEffect(() => {
    if (svgCache.has(slug)) return;
    let cancelled = false;
    fetch(`/brand-icons/${slug}.svg`)
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        if (cancelled || !text) return;
        svgCache.set(slug, text);
        forceRender((n) => n + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!cached) return null;
  return <span className={className} dangerouslySetInnerHTML={{ __html: cached }} />;
}
