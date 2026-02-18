export class YandexMapManager {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.options = {
            center: [54.1931, 37.6175],
            zoom: 12,
            controls: ['zoomControl', 'fullscreenControl', 'searchControl'],
            ...options
        };
        
        this.map = null;
        this.placemark = null;      // для single mode
        this.coordinates = null;
        this.onChange = null;
        this.apiKey = '';
        this.isInitialized = false;
        this.initPromise = null;
        
        // НОВЫЕ ПОЛЯ для route mode
        this.mode = options.mode || 'single'; // 'single' (админка) или 'route' (create-order)
        this.plotMarker = null;      // маркер участка (только в route mode)
        this.clientMarker = null;    // маркер клиента (только в route mode)
        this.route = null;           // маршрут (только в route mode)
        this.plotCoords = null;
        this.clientCoords = null;
        this.onRouteUpdate = null;   // колбэк для обновления информации о маршруте
        this.routePending = false;   // защита от множественных запросов
    }
    
    setApiKey(key) {
        this.apiKey = key;
    }
    
    async initialize() {
        if (this.isInitialized) return true;
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = this._initMap();
        return this.initPromise;
    }
    
    async _initMap() {
        try {
            await this.loadYandexMaps();
            await new Promise(resolve => ymaps.ready(resolve));
            
            // Создаем карту
            this.map = new ymaps.Map(this.containerId, {
                center: this.options.center,
                zoom: this.options.zoom,
                controls: this.options.controls
            });
            
            // Убираем лишние контролы
            this.map.controls.remove('trafficControl');
            this.map.controls.remove('typeSelector');
            this.map.controls.remove('rulerControl');
            
            // ====== ПЕРЕХВАТЫВАЕМ ПОИСК ======
            const searchControl = this.map.controls.get('searchControl');
            if (searchControl) {
                // Отключаем suggest и используем прямой поиск
                searchControl.options.set({
                    provider: null,
                    noSuggest: true,
                    noPlacemark: true,
                    resultsPerPage: 0
                });
                
                // Перехватываем отправку формы поиска
                searchControl.events.add('submit', (e) => {
                    e.preventDefault();
                    const request = searchControl.getRequestString();
                    if (request) {
                        this.geocodeAndSetPlacemark(request);
                    }
                });
                
                // Очищаем поле после поиска (опционально)
                searchControl.events.add('clear', () => {
                    // Ничего не делаем
                });
            }
            
            // Обработчик клика по карте
            this.map.events.add('click', (e) => {
                const coords = e.get('coords');
                this.setPlacemark(coords[0], coords[1]);
            });
            this.isInitialized = true;
            return true;
            
        } catch (error) {
            console.error('Ошибка инициализации Яндекс.Карт:', error);
            throw error;
        } finally {
            this.initPromise = null;
        }
    }

    /**
     * Прямой геокодинг без suggest
     */
    async geocodeAndSetPlacemark(query) {
        try {
            // Показываем индикатор загрузки
            if (this.onSearchStart) {
                this.onSearchStart();
            }
            
            const result = await ymaps.geocode(query, {
                results: 1,
                kind: 'house'
            });
            
            const firstGeoObject = result.geoObjects.get(0);
            
            if (!firstGeoObject) {
                // Пробуем найти улицу
                const streetResult = await ymaps.geocode(query, {
                    results: 1,
                    kind: 'street'
                });
                const streetGeo = streetResult.geoObjects.get(0);
                
                if (!streetGeo) {
                    if (this.onSearchError) {
                        this.onSearchError('Адрес не найден');
                    }
                    return;
                }
                
                const coords = streetGeo.geometry.getCoordinates();
                const address = streetGeo.getAddressLine();
                this.setPlacemark(coords[0], coords[1], { address });
                
            } else {
                const coords = firstGeoObject.geometry.getCoordinates();
                const address = firstGeoObject.getAddressLine();
                this.setPlacemark(coords[0], coords[1], { address });
            }
            
            if (this.onSearchSuccess) {
                this.onSearchSuccess();
            }
            
        } catch (error) {
            console.error('Ошибка геокодинга:', error);
            if (this.onSearchError) {
                this.onSearchError('Ошибка поиска');
            }
        }
    }

    // Добавьте методы для колбэков
    onSearchStart(callback) {
        this.onSearchStart = callback;
    }

    onSearchSuccess(callback) {
        this.onSearchSuccess = callback;
    }

    onSearchError(callback) {
        this.onSearchError = callback;
    }
    
    loadYandexMaps() {
        return new Promise((resolve, reject) => {
            if (window.ymaps) {
                resolve();
                return;
            }
            
            if (!this.apiKey) {
                reject(new Error('API ключ не установлен'));
                return;
            }
            
            const script = document.createElement('script');
            // ВАЖНО: добавляем suggest_apikey с тем же ключом
            script.src = `https://api-maps.yandex.ru/2.1/?apikey=${this.apiKey}&suggest_apikey=${this.apiKey}&lang=ru_RU&load=package.full`;
            
            script.onload = resolve;
            script.onerror = () => reject(new Error('Не удалось загрузить Яндекс.Карты'));
            document.head.appendChild(script);
        });
    }
    
    /**
     * Установка метки
     */
    setPlacemark(lat, lng, options = {}) {
        if (!this.map) {
            console.error('Карта не инициализирована');
            return;
        }
        
        if (this.mode === 'single') {
            // РЕЖИМ АДМИНКИ - старая логика с удалением
            this.coordinates = { lat, lng };
            
            if (this.placemark) {
                this.map.geoObjects.remove(this.placemark);
            }
            
            this.placemark = new ymaps.Placemark([lat, lng], {
                hintContent: options.hint || 'Выбранное место',
                balloonContent: options.balloon || `Координаты: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
            }, {
                preset: 'islands#redIcon',
                draggable: true,
                openBalloonOnClick: true,
                zIndex: 10000
            });
            
            this.map.geoObjects.add(this.placemark);
            this.map.setCenter([lat, lng], this.options.zoom);
            
            // Принудительное обновление позиции
            this.placemark.geometry.setCoordinates([lat, lng]);
            this.placemark.options.set('visible', true);
            this.map.container.fitToViewport();
            
            setTimeout(() => {
                if (this.placemark) {
                    this.placemark.geometry.setCoordinates([lat, lng]);
                }
            }, 50);
            
            this.placemark.balloon.open();
            
            if (this.onChange) {
                this.onChange(lat, lng, options.address);
            }
        } else {
            // РЕЖИМ CREATE-ORDER - устанавливаем маркер клиента
            this.setClientMarker(lat, lng, options);
        }
    }

    /**
     * Установка маркера участка (только для route mode)
     * НЕ удаляет маркер клиента!
     */
    setPlotMarker(lat, lng, options = {}) {
        if (this.mode !== 'route') {
            console.warn('setPlotMarker доступен только в route mode');
            return;
        }
        
        if (!this.map) {
            console.error('Карта не инициализирована');
            return;
        }
        
        this.plotCoords = { lat, lng };
        
        if (this.plotMarker) {
            // Обновляем существующий маркер
            this.plotMarker.geometry.setCoordinates([lat, lng]);
            this.plotMarker.properties.set({
                hintContent: options.hint || 'Участок',
                balloonContent: options.balloon || `Участок<br>Координаты: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
            });
        } else {
            // Создаём новый маркер (зелёный для участка) ТОЛЬКО если нет
            this.plotMarker = new ymaps.Placemark([lat, lng], {
                hintContent: options.hint || 'Участок',
                balloonContent: options.balloon || `Участок<br>Координаты: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
            }, {
                preset: 'islands#greenIcon',
                draggable: false,
                openBalloonOnClick: true,
                zIndex: 9000
            });
            
            this.map.geoObjects.add(this.plotMarker);
        }
        
        // Обновляем маршрут если есть обе точки
        this._updateRoute();
        
        // Центрирование
        setTimeout(() => {
            if (this.clientCoords) {
                this._fitBounds();
            } else {
                this.map.setCenter([lat, lng], this.options.zoom);
            }
        }, 100);
    }
    
    /**
     * Установка маркера клиента (только для route mode)
     * НЕ удаляет маркер участка!
     */
    setClientMarker(lat, lng, options = {}) {
        if (this.mode !== 'route') {
            console.warn('setClientMarker доступен только в route mode');
            return;
        }
        
        if (!this.map) {
            console.error('Карта не инициализирована');
            return;
        }
        
        this.clientCoords = { lat, lng };
        this.coordinates = { lat, lng };
        
        if (this.clientMarker) {
            // Обновляем существующий маркер
            this.clientMarker.geometry.setCoordinates([lat, lng]);
            this.clientMarker.properties.set({
                hintContent: options.hint || 'Место захоронения',
                balloonContent: options.balloon || `Координаты: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
            });
        } else {
            // Создаём новый маркер (красный для клиента) ТОЛЬКО если нет
            this.clientMarker = new ymaps.Placemark([lat, lng], {
                hintContent: options.hint || 'Место захоронения',
                balloonContent: options.balloon || `Координаты: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
            }, {
                preset: 'islands#redIcon',
                draggable: true,
                openBalloonOnClick: true,
                zIndex: 10000
            });
            
            this.map.geoObjects.add(this.clientMarker);
            
            // Обработчик перетаскивания
            this.clientMarker.events.add('dragend', () => {
                const coords = this.clientMarker.geometry.getCoordinates();
                this.clientCoords = { lat: coords[0], lng: coords[1] };
                this.coordinates = { lat: coords[0], lng: coords[1] };
                this._updateRoute();
                
                if (this.onChange) {
                    this.onChange(coords[0], coords[1], options.address);
                }
            });
        }
        
        // Обновляем маршрут если есть обе точки
        this._updateRoute();
        
        // Центрирование
        setTimeout(() => {
            if (this.plotCoords) {
                this._fitBounds();
            } else {
                this.map.setCenter([lat, lng], this.options.zoom);
            }
        }, 100);
        
        // Вызываем onChange для обратной совместимости
        if (this.onChange) {
            this.onChange(lat, lng, options.address);
        }
    }

    /**
     * Очистка всех маркеров (для перезагрузки)
     */
    clearAllMarkers() {
        if (this.plotMarker) {
            this.map.geoObjects.remove(this.plotMarker);
            this.plotMarker = null;
        }
        if (this.clientMarker) {
            this.map.geoObjects.remove(this.clientMarker);
            this.clientMarker = null;
        }
        this.plotCoords = null;
        this.clientCoords = null;
    }

    /**
     * Приватный метод: центрирование карты по обоим маркерам
     * Ручной расчёт границ без использования LineString
     */
    _fitBounds() {
        if (!this.plotCoords || !this.clientCoords || !this.map) {
            return;
        }
        
        try {
            // Ручной расчёт границ
            const minLat = Math.min(this.plotCoords.lat, this.clientCoords.lat);
            const maxLat = Math.max(this.plotCoords.lat, this.clientCoords.lat);
            const minLng = Math.min(this.plotCoords.lng, this.clientCoords.lng);
            const maxLng = Math.max(this.plotCoords.lng, this.clientCoords.lng);
            
            // Добавляем отступ (10% от размера области)
            const latPadding = (maxLat - minLat) * 0.1;
            const lngPadding = (maxLng - minLng) * 0.1;
            
            const bounds = [
                [minLat - latPadding, minLng - lngPadding],
                [maxLat + latPadding, maxLng + lngPadding]
            ];

            this.map.setBounds(bounds, {
                checkZoomRange: true,
                zoomMargin: 50,
                duration: 300
            });
            
        } catch (error) {
            console.warn('Ошибка при центрировании карты:', error);
            // Запасной вариант - центрируем по клиенту
            if (this.clientCoords) {
                this.map.setCenter([this.clientCoords.lat, this.clientCoords.lng], 14);
            }
        }
    }

    /**
     * Приватный метод: обновление маршрута
     * ИСПРАВЛЕНО: Обработчик навешивается ТОЛЬКО ОДИН РАЗ за lifecycle маршрута
     */
    async _updateRoute() {
        // Работает только в route mode
        if (this.mode !== 'route') return;
        
        // Если нет обеих координат - удаляем маршрут
        if (!this.plotCoords || !this.clientCoords) {
            if (this.route) {
                this.map.geoObjects.remove(this.route);
                this.route = null;
            }
            
            if (this.onRouteUpdate) {
                this.onRouteUpdate(null);
            }
            return;
        }
        
        // Предотвращаем множественные запросы
        if (this.routePending) return;
        this.routePending = true;
        
        try {
            // Удаляем старый маршрут (обработчики удалятся вместе с моделью)
            if (this.route) {
                this.map.geoObjects.remove(this.route);
                this.route = null;
            }
            
            // ИСПОЛЬЗУЕМ MultiRoute (бесплатный API Яндекс.Карт)
            this.route = new ymaps.multiRouter.MultiRoute({
                referencePoints: [
                    [this.plotCoords.lat, this.plotCoords.lng],
                    [this.clientCoords.lat, this.clientCoords.lng]
                ],
                params: {
                    routingMode: 'auto',
                    avoidTrafficJams: true,
                    results: 1
                }
            }, {
                boundsAutoApply: true,
                
                // ОТКЛЮЧАЕМ ВСТРОЕННЫЕ МАРКЕРЫ
                wayPointStartIconColor: '',           // Убираем цвет
                wayPointStartIconFillColor: '',       // Убираем заливку
                wayPointEndIconColor: '',             // Убираем цвет
                wayPointEndIconFillColor: '',         // Убираем заливку
                wayPointVisible: false,                // Скрываем точки маршрута
                
                // Оставляем только линию
                activeRouteStrokeColor: '#0066ff',
                activeRouteStrokeWidth: 4,
                activeRouteStrokeStyle: 'solid',
                
                // Отключаем всё лишнее
                balloonContentLayout: null,
                iconColor: 'transparent',
                pinVisible: false
            });
            
            // Добавляем маршрут на карту
            this.map.geoObjects.add(this.route);
            
            // ИСПРАВЛЕНИЕ: Сохраняем обработчики как свойства экземпляра
            // и удаляем старые перед добавлением новых
            if (this._routeSuccessHandler) {
                this.route.model.events.remove('requestsuccess', this._routeSuccessHandler);
            }
            if (this._routeFailHandler) {
                this.route.model.events.remove('requestfail', this._routeFailHandler);
            }
            
            // Создаем новые обработчики
            this._routeSuccessHandler = () => {
                this.routePending = false;
                
                try {
                    const activeRoute = this.route.getActiveRoute();
                    if (activeRoute && this.onRouteUpdate) {
                        const distance = activeRoute.properties.get('distance');
                        const duration = activeRoute.properties.get('duration');
                        
                        this.onRouteUpdate({
                            distance: distance?.text || 'неизвестно',
                            distanceValue: distance?.value || 0,
                            duration: duration?.text || 'неизвестно',
                            durationValue: duration?.value || 0,
                            route: activeRoute
                        });
                        
                        setTimeout(() => {
                            this._fitBounds();
                        }, 200);
                    }
                } catch (e) {
                    console.error('Ошибка получения данных маршрута:', e);
                }
            };
            
            this._routeFailHandler = (e) => {
                this.routePending = false;
                console.error('Ошибка построения маршрута:', e);
                
                if (this.onRouteUpdate) {
                    this.onRouteUpdate(null);
                }
            };
            
            // Подписываемся на события (теперь гарантированно один раз)
            this.route.model.events.add('requestsuccess', this._routeSuccessHandler);
            this.route.model.events.add('requestfail', this._routeFailHandler);
            
        } catch (error) {
            this.routePending = false;
            console.error('Ошибка создания маршрута:', error);
            
            if (this.onRouteUpdate) {
                this.onRouteUpdate(null);
            }
        }
    }

    /**
     * Установка колбэка для обновления маршрута
     */
    onRouteUpdateCallback(callback) {
        this.onRouteUpdate = callback;
    }

    /**
     * Полный сброс всех маркеров и маршрута (только для route mode)
     */
    resetAll() {
        if (this.mode !== 'route') {
            this.resetPlacemark();
            return;
        }
        
        if (this.plotMarker) {
            this.map.geoObjects.remove(this.plotMarker);
            this.plotMarker = null;
        }
        
        if (this.clientMarker) {
            this.map.geoObjects.remove(this.clientMarker);
            this.clientMarker = null;
        }
        
        if (this.route) {
            this.map.geoObjects.remove(this.route);
            this.route = null;
        }
        
        this.plotCoords = null;
        this.clientCoords = null;
        this.coordinates = null;
        
        if (this.onRouteUpdate) {
            this.onRouteUpdate(null);
        }
    }

    /**
     * Поиск по адресу (для обратной совместимости)
     */
    async searchAddress(query) {
        try {
            const result = await ymaps.geocode(query, { results: 1 });
            const firstGeoObject = result.geoObjects.get(0);
            
            if (!firstGeoObject) {
                throw new Error('Адрес не найден');
            }
            
            const coords = firstGeoObject.geometry.getCoordinates();
            const address = firstGeoObject.getAddressLine();
            
            return {
                lat: coords[0],
                lon: coords[1],
                display_name: address
            };
            
        } catch (error) {
            console.error('Ошибка геокодинга:', error);
            throw error;
        }
    }
    
    /**
     * Обратное геокодирование
     */
    async reverseGeocode(lat, lng) {
        try {
            const result = await ymaps.geocode([lat, lng], { results: 1 });
            const firstGeoObject = result.geoObjects.get(0);
            return firstGeoObject ? firstGeoObject.getAddressLine() : 'Адрес не определен';
        } catch (error) {
            console.error('Обратный геокодинг ошибка:', error);
            return 'Адрес не определен';
        }
    }
    
    getCoordinates() {
        return this.coordinates ? { ...this.coordinates } : null;
    }
    
    resetPlacemark() {
        if (this.placemark) {
            this.map.geoObjects.remove(this.placemark);
            this.placemark = null;
        }
        this.coordinates = null;
    }
    
    setOnChange(callback) {
        this.onChange = callback;
    }
    
    setCenter(lat, lng, zoom = null) {
        if (this.map) {
            this.map.setCenter([lat, lng], zoom || this.options.zoom);
        }
    }
    
    destroy() {
        if (this.map) {
            this.map.destroy();
            this.map = null;
        }
        this.placemark = null;
        this.plotMarker = null;
        this.clientMarker = null;
        this.route = null;
        this.coordinates = null;
        this.plotCoords = null;
        this.clientCoords = null;
        this.isInitialized = false;
    }
}