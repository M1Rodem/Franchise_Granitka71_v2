import { useEffect, useState, useRef } from 'react';
import { env } from '@/shared/config/env';
import { connectivityService } from '@/modules/offline/services/connectivity.service';

declare global {
  interface Window {
    ymaps?: any;
  }
}

let loaderPromise: Promise<void> | null = null;
const LOAD_TIMEOUT_MS = 15000;

// Функция проверки наличия API в кеше
async function isApiCached(): Promise<boolean> {
  try {
    const url = `https://api-maps.yandex.ru/2.1/?apikey=${env.yandexMapApiKey}&lang=ru_RU`;
    const cache = await caches.open('yandex-maps-api');
    const cachedResponse = await cache.match(url);
    return !!cachedResponse;
  } catch {
    return false;
  }
}

// Функция проверки доступности API
async function checkApiAvailability(): Promise<boolean> {
  try {
    const url = `https://api-maps.yandex.ru/2.1/?apikey=${env.yandexMapApiKey}&lang=ru_RU`;
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function loadApiViaFetch(): Promise<void> {
  const url = `https://api-maps.yandex.ru/2.1/?apikey=${env.yandexMapApiKey}&lang=ru_RU`;
  
  // Пробуем загрузить из кеша напрямую
  try {
    const cache = await caches.open('yandex-maps-api');
    const cachedResponse = await cache.match(url);
    
    if (cachedResponse) {
      const scriptText = await cachedResponse.text();
      const script = document.createElement('script');
      script.textContent = scriptText;
      document.head.appendChild(script);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('ymaps ready timeout from cache'));
        }, LOAD_TIMEOUT_MS);
        
        const checkYmaps = () => {
          if (window.ymaps) {
            window.ymaps.ready(() => {
              clearTimeout(timeout);
              resolve();
            });
          } else {
            setTimeout(checkYmaps, 100);
          }
        };
        checkYmaps();
      });
    }
  } catch (e) {
    console.warn('[YandexLoader] Cache read failed:', e);
  }
  
  // Если нет в кеше — грузим с сервера
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch API: ${response.status}`);
  const scriptText = await response.text();
  const script = document.createElement('script');
  script.textContent = scriptText;
  document.head.appendChild(script);
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('ymaps ready timeout from network'));
    }, LOAD_TIMEOUT_MS);
    
    const checkYmaps = () => {
      if (window.ymaps) {
        window.ymaps.ready(() => {
          clearTimeout(timeout);
          resolve();
        });
      } else {
        setTimeout(checkYmaps, 100);
      }
    };
    checkYmaps();
  });
}

async function loadApiViaScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${env.yandexMapApiKey}&lang=ru_RU`;
    script.async = true;

    const timeout = setTimeout(() => {
      script.onload = null;
      script.onerror = null;
      reject(new Error('ymaps script load timeout'));
    }, LOAD_TIMEOUT_MS);

    script.onload = () => {
      clearTimeout(timeout);
      if (window.ymaps) {
        window.ymaps.ready(() => resolve());
      } else {
        reject(new Error('ymaps not available after script load'));
      }
    };

    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('ymaps script load error'));
    };
    document.body.appendChild(script);
  });
}

export function useYandexLoader() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isApiAvailable, setIsApiAvailable] = useState(false);
  const [hasCachedApi, setHasCachedApi] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [, setIsYandexApiReachable] = useState(true);
  const loadAttemptedRef = useRef(false);
  const loadFailedRef = useRef(false);

  useEffect(() => {
    // Подписка на статус офлайн
    const unsubscribe = connectivityService.subscribe((isOnline) => {
      setIsOffline(!isOnline);
    });

    // Проверяем доступность Яндекс.API
    const checkYandexApi = async () => {
      try {
        const available = await checkApiAvailability();
        setIsYandexApiReachable(available);
      } catch {
        setIsYandexApiReachable(false);
      }
    };

    // Если API уже загружен
    if (window.ymaps) {
      setIsLoaded(true);
      setIsLoading(false);
      setIsApiAvailable(true);
      return () => unsubscribe();
    }

    // Если уже пытались загрузить и failed
    if (loadFailedRef.current) {
      setIsLoading(false);
      setIsApiAvailable(false);
      return () => unsubscribe();
    }

    if (loadAttemptedRef.current) {
      return () => unsubscribe();
    }

    if (!env.yandexMapApiKey) {
      console.error('[YandexLoader] Yandex Map API key is missing');
      setIsLoading(false);
      setIsApiAvailable(false);
      loadFailedRef.current = true;
      return () => unsubscribe();
    }

    loadAttemptedRef.current = true;
    setIsLoading(true);

    // Проверяем наличие кеша
    isApiCached().then((cached) => {
      setHasCachedApi(cached);
      if (cached) {
      }
    });

    // Проверяем доступность Яндекс.API
    checkYandexApi();

    if (!loaderPromise) {
      // Пытаемся загрузить через fetch (SW перехватит), потом через script
      loaderPromise = loadApiViaFetch()
        .then(() => {
          setIsLoaded(true);
          setIsLoading(false);
          setIsApiAvailable(true);
        })
        .catch((error) => {
          console.warn('[YandexLoader] Fetch failed, trying script:', error);
          // Если fetch не сработал — пробуем через script
          return loadApiViaScript()
            .then(() => {
              setIsLoaded(true);
              setIsLoading(false);
              setIsApiAvailable(true);
            })
            .catch((scriptError) => {
              console.error('[YandexLoader] Both methods failed:', scriptError);
              setIsLoaded(false);
              setIsLoading(false);
              // Проверяем, есть ли кеш
              isApiCached().then((cached) => {
                if (cached) {
                  // Если есть кеш, но загрузка не удалась — пробуем еще раз
                  loaderPromise = null;
                  loadAttemptedRef.current = false;
                } else {
                  setIsApiAvailable(false);
                  loadFailedRef.current = true;
                }
              });
            });
        });
    }

    loaderPromise.then(() => {
      if (window.ymaps) {
        setIsLoaded(true);
        setIsLoading(false);
        setIsApiAvailable(true);
      }
    });

    return () => unsubscribe();
  }, []);


  const isFullOffline = isOffline;
  const isApiUnavailable = !isApiAvailable && !window.ymaps;

  const shouldShowBanner = isFullOffline || isApiUnavailable;

  return { 
    isLoaded, 
    isLoading, 
    isApiAvailable,
    hasCachedApi,
    isOffline,
    isFullOffline,
    isApiUnavailable,
    shouldShowBanner,
    isLimitedMode: shouldShowBanner,
    isOfflineMode: shouldShowBanner
  };
}