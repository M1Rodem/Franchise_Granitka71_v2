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
      // Если уже есть таймер — очищаем
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      // Показываем новое сообщение сразу
      setCurrent(payload);

      timeoutRef.current = window.setTimeout(() => {
        setCurrent(null);
      }, payload.durationMs ?? 2500);
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