/**
 * Рассчитать расстояние между двумя точками через Яндекс JS API
 * Использует ymaps.multiRouter (бесплатно, без отдельного ключа)
 * 
 * Оптимизация: если API уже загружен — используем сразу
 */

// Ожидаем загрузку Яндекс API с проверкой
function waitForYmaps(timeout = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      if (window.ymaps && window.ymaps.ready && window.ymaps.multiRouter?.MultiRoute) {
        window.ymaps.ready(() => resolve());
        return;
      }
      if (Date.now() - startTime > timeout) {
        reject(new Error('Yandex Maps API timeout'));
        return;
      }
      setTimeout(check, 200);
    };
    check();
  });
}

// Проверяем, что multiRouter доступен
function isMultiRouterAvailable(): boolean {
  return !!(window.ymaps?.multiRouter?.MultiRoute)
}

export async function calculateDistanceViaYmaps(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  timeoutMs = 15000
): Promise<number> {
  // 1. Ждём загрузки API (только если не загружен)
  await waitForYmaps(timeoutMs)

  // Проверяем, что multiRouter доступен
  if (!isMultiRouterAvailable()) {
    throw new Error('ymaps.multiRouter not available')
  }

  // 2. Создаём скрытый контейнер
  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  `
  document.body.appendChild(container)

  // 3. Создаём карту (без загрузки, используем уже загруженный API)
  const map = new window.ymaps.Map(container, {
    center: [fromLat, fromLng],
    zoom: 10,
    controls: [],
  })

  // 4. Создаём маршрут
  const multiRoute = new window.ymaps.multiRouter.MultiRoute(
    {
      referencePoints: [
        [fromLat, fromLng],
        [toLat, toLng],
      ],
    },
    {
      boundsAutoApply: true,
      wayPointVisible: false,
    }
  )

  map.geoObjects.add(multiRoute)

  // 5. Ждём построения маршрута
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Route build timeout'))
    }, timeoutMs)

    const onSuccess = () => {
      cleanup()
      const activeRoute = multiRoute.getActiveRoute()
      if (!activeRoute) {
        reject(new Error('No active route'))
        return
      }
      const distanceMeters = activeRoute.properties.get('distance').value
      const distanceKm = Math.round(distanceMeters / 1000 * 100) / 100
      resolve(distanceKm)
    }

    const onError = () => {
      cleanup()
      reject(new Error('Route build failed'))
    }

    const cleanup = () => {
      clearTimeout(timeout)
      multiRoute.model.events.remove('requestsuccess', onSuccess)
      multiRoute.model.events.remove('requesterror', onError)
      try {
        map.destroy()
      } catch {
        // ignore
      }
      if (container.parentNode) {
        container.parentNode.removeChild(container)
      }
    }

    multiRoute.model.events.add('requestsuccess', onSuccess)
    multiRoute.model.events.add('requesterror', onError)
  })
}