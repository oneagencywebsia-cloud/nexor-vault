'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useVaultStore } from '@/lib/store';

const LOCK_AFTER_MS = 5 * 60 * 1000; // 5 min de inactividad
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;

export default function AutoLock() {
  const router = useRouter();
  const lock = useVaultStore((s) => s.lock);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function reset() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        lock();
        router.push('/unlock');
      }, LOCK_AFTER_MS);
    }

    reset();
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, reset));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [lock, router]);

  return null;
}
