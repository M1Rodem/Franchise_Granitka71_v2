import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { registerTempMessageHandler } from '@/shared/ui/temp-message.service';
import type { TempMessagePayload } from '@/shared/ui/temp-message.service';
import styles from './temp-message.module.css';

export function TempMessageProvider() {
  const [current, setCurrent] = useState<TempMessagePayload | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return registerTempMessageHandler((payload) => {

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      setCurrent(null)

      requestAnimationFrame(() => {
        setCurrent(payload)
      })

      timeoutRef.current = window.setTimeout(() => {

        setCurrent(null)
        timeoutRef.current = null

      }, payload.durationMs ?? 2500)

    });
  }, []);

  if (!current) {
    return null;
  }

  return createPortal(
    <div className={`${styles.toast} ${styles[current.type]}`}>
      {current.message}
    </div>,
    document.body,
  );
}