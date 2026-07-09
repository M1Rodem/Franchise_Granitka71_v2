import { useEffect, useState, useRef } from 'react';
import { env } from '@/shared/config/env';
import { connectivityService } from '@/modules/offline/services/connectivity.service';
import { tilePrecacheService } from '@/modules/pwa/services/tilePrecache.service';

declare global {
  interface Window {
    ymaps?: any;
  }
}

let loaderPromise: Promise<void> | null = null;
const LOAD_TIMEOUT_MS = 15000;

// ===== ЗАГРУЗКА API С СЕРВЕРА (через fetch + textContent, с fallback на script) =====
async function loadApiFromNetwork(): Promise<void> {
  const url = `https://api-maps.yandex.ru/2.1/?apikey=${env.yandexMapApiKey}&lang=ru_RU&_t=${Date.now()}`;
  
  console.log('[YandexLoader] Загрузка API с сервера (онлайн режим)');
  
  // 🔄 ПЫТАЕМСЯ ЧЕРЕЗ fetch + textContent (правильно инициализирует тайлы)
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      }
    });
    
    if (response.ok) {
      const scriptText = await response.text();
      const script = document.createElement('script');
      script.textContent = scriptText;
      document.head.appendChild(script);
      
      await waitForYmaps();
      console.log('[YandexLoader] API загружен через fetch + textContent');
      
      // ✅ Сохраняем в кеш для офлайн-режима
      saveApiToCache(url).catch(() => {});
      
      return;
    }
  } catch (error) {
    console.warn('[YandexLoader] fetch + textContent не удался, пробуем script тег:', error);
  }
  
  // 🔄 FALLBACK: через script тег (если fetch не сработал)
  console.log('[YandexLoader] Используем fallback: script тег');
  await loadApiViaScript(url);
}

// ===== ВСПОМОГАТЕЛЬНАЯ: ожидание ymaps =====
function waitForYmaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('ymaps ready timeout'));
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

// ===== ЗАГРУЗКА ЧЕРЕЗ SCRIPT ТЕГ (fallback) =====
function loadApiViaScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    
    const timeout = setTimeout(() => {
      script.onload = null;
      script.onerror = null;
      reject(new Error('ymaps script load timeout from network'));
    }, LOAD_TIMEOUT_MS);
    
    script.onload = () => {
      clearTimeout(timeout);
      if (window.ymaps) {
        window.ymaps.ready(() => {
          console.log('[YandexLoader] API загружен через script тег (fallback)');
          resolve();
        });
      } else {
        reject(new Error('ymaps not available after script load'));
      }
    };
    
    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('ymaps script load error from network'));
    };
    
    document.head.appendChild(script);
  });
}

// ===== ЗАГРУЗКА API ИЗ КЕША =====
async function loadApiFromCache(): Promise<void> {
  const url = `https://api-maps.yandex.ru/2.1/?apikey=${env.yandexMapApiKey}&lang=ru_RU`;
  
  console.log('[YandexLoader] Загрузка API из кеша (офлайн режим)');
  
  const cache = await caches.open('yandex-maps-api');
  const cachedResponse = await cache.match(url);
  
  if (!cachedResponse) {
    throw new Error('API не найден в кеше');
  }
  
  const scriptText = await cachedResponse.text();
  const script = document.createElement('script');
  script.textContent = scriptText;
  document.head.appendChild(script);
  
  await waitForYmaps();
  console.log('[YandexLoader] API из кеша загружен');
}

// ===== СОХРАНЕНИЕ API В КЕШ =====
async function saveApiToCache(url: string): Promise<void> {
  try {
    const cache = await caches.open('yandex-maps-api');
    const response = await fetch(url);
    if (response.ok) {
      await cache.put(url, response);
      console.log('[YandexLoader] API сохранен в кеш');
    }
  } catch (e) {
    console.warn('[YandexLoader] Не удалось сохранить API в кеш:', e);
  }
}

// ===== ФУНКЦИЯ ПРОВЕРКИ НАЛИЧИЯ API В КЕШЕ =====
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

// ===== ФУНКЦИЯ ПРОВЕРКИ ДОСТУПНОСТИ API =====
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
      
      const isOnline = connectivityService.isOnline();
      if (isOnline) {
        tilePrecacheService.refreshYandexApiIfNeeded().catch(() => {});
      }
      
      return () => unsubscribe();
    }

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
    });

    checkYandexApi();

    if (!loaderPromise) {
      // ===== ГЛАВНАЯ ЛОГИКА: ОНЛАЙН → СЕРВЕР, ОФЛАЙН → КЕШ =====
      const isOnline = connectivityService.isOnline();
      
      loaderPromise = (async () => {
        try {
          if (isOnline) {
            await loadApiFromNetwork();
          } else {
            await loadApiFromCache();
          }
          
          setIsLoaded(true);
          setIsLoading(false);
          setIsApiAvailable(true);
        } catch (error) {
          console.warn('[YandexLoader] Первичная загрузка не удалась:', error);
          
          // Если не удалось загрузить с сервера (онлайн), пробуем из кеша
          if (isOnline) {
            try {
              console.log('[YandexLoader] Пробуем загрузить из кеша (fallback)');
              await loadApiFromCache();
              setIsLoaded(true);
              setIsLoading(false);
              setIsApiAvailable(true);
              return;
            } catch (cacheError) {
              console.warn('[YandexLoader] Fallback из кеша тоже не удался:', cacheError);
            }
          }
          
          setIsLoaded(false);
          setIsLoading(false);
          setIsApiAvailable(false);
          loadFailedRef.current = true;
        }
      })();
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