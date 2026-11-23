'use client';

import { useEffect, useRef, useState } from 'react';

// Hace aparecer su contenido (fundido + subida) la primera vez que entra en
// pantalla. `index` escalona la entrada de elementos hermanos.
export function Reveal({
  children,
  index = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
  as?: 'div' | 'li' | 'section' | 'article';
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible'); // navegador sin IntersectionObserver: mostrar ya
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      style={{ ['--i' as string]: index }}
      className={`nexor-reveal ${visible ? 'is-visible' : ''} ${className}`}
    >
      {children}
    </Tag>
  );
}
