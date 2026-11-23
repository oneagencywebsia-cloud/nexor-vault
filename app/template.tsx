'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// Orden de los accesos directos: sirve para decidir si la pantalla entra
// desde la derecha (vas hacia delante) o desde la izquierda (vuelves atrás).
const ORDER = ['/vault', '/share', '/teams', '/audit', '/settings'];

function indexOf(path: string | null) {
  if (!path) return -1;
  return ORDER.findIndex((p) => path === p || path.startsWith(p + '/'));
}

// template.tsx se monta de nuevo en cada navegación (por eso un useRef no
// sirve para recordar la ruta anterior): se guarda a nivel de módulo, se lee
// durante el render y se actualiza en un efecto.
let lastPath: string | null = null;

// Solo marca la dirección (data-nav). La animación la aplican los elementos
// con la clase `nexor-page-anim` (ver globals.css).
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const from = indexOf(lastPath);
  const to = indexOf(pathname);
  let nav = 'up';
  if (from !== -1 && to !== -1 && from !== to) nav = to > from ? 'right' : 'left';

  useEffect(() => {
    lastPath = pathname;
  }, [pathname]);

  return (
    <div data-nav={nav} className="flex min-h-full flex-1 flex-col">
      {children}
    </div>
  );
}
