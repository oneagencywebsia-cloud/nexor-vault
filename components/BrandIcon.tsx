'use client';

import { useEffect, useState } from 'react';
import type { BrandMatch } from '@/lib/brand-icon';

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

// Icono real (simple-icons) si hay match 'svg', insignia de iniciales con
// el color de marca si es 'mono' (marcas sin logo redistribuible: ver
// EXTRA_BRANDS en lib/brand-icon.ts), o el fallback genérico si no hay match.
export function BrandGlyph({
  brand,
  fallback,
  iconClass,
  textClass = '',
}: {
  brand: BrandMatch | null;
  fallback: React.ReactNode;
  iconClass: string;
  textClass?: string;
}) {
  if (brand?.kind === 'svg') return <BrandIcon slug={brand.slug} className={iconClass} />;
  if (brand?.kind === 'mono') return <span className={`font-bold leading-none ${textClass}`}>{brand.abbr}</span>;
  return <>{fallback}</>;
}
