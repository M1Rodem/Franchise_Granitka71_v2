export class Geocoder {
    constructor(mapManager) {
        this.mapManager = mapManager;
    }
    
    /**
     * Поиск адреса
     */
    async search(query) {
        if (!this.mapManager) {
            throw new Error('Map manager not initialized');
        }
        return this.mapManager.searchAddress(query);
    }
    
    /**
     * Обратный поиск (координаты → адрес)
     */
    async reverse(lat, lon) {
        if (!this.mapManager) {
            throw new Error('Map manager not initialized');
        }
        return this.mapManager.reverseGeocode(lat, lon);
    }
}