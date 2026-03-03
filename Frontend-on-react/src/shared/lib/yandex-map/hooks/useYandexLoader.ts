import { useEffect, useState } from 'react';
import { env } from '@/shared/config/env';

declare global {
  interface Window {
    ymaps?: any;
  }
}

let loaderPromise: Promise<void> | null = null;

export function useYandexLoader() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (window.ymaps) {
      setIsLoaded(true);
      return;
    }

    if (!env.yandexMapApiKey) {
      console.error('Yandex Map API key is missing');
      return;
    }

    if (!loaderPromise) {
      loaderPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://api-maps.yandex.ru/2.1/?apikey=${env.yandexMapApiKey}&lang=ru_RU`;
        script.async = true;

        script.onload = () => {
          window.ymaps.ready(() => resolve());
        };

        script.onerror = reject;

        document.body.appendChild(script);
      });
    }

    loaderPromise.then(() => setIsLoaded(true)).catch(console.error);
  }, []);

  return { isLoaded };
}