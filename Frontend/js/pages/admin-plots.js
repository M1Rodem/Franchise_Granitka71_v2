import { YandexMapManager } from '../map/yandex-map-manager.js';
import { Geocoder } from '../map/geocoder.js';
import { apiService } from '../api/api.js';
import { showTempMessage, isAdmin, secureGetToken } from '../utils/utils.js';

class PlotsManager {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 10;
        this.totalPages = 1;
        this.searchQuery = '';
        this.currentPlotId = null;
        this.mapManager = null;
        this.geocoder = null;
        this.allPlots = [];
        this.config = null; // Для хранения конфига с сервера
        
        this.init();
    }
    
    async init() {
        // Сначала загружаем конфиг с сервера
        await this.loadConfig();
        this.bindElements();
        await this.loadPlots();
        this.bindEvents();
        this.setupModal();
    }

    async loadConfig() {
        try {
            // Получаем токен из utils.js
            const token = secureGetToken();
            
            if (!token) {
                throw new Error('Нет токена авторизации');
            }
            
            const response = await fetch('/api/config', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    // Перенаправляем на логин если не авторизован
                    window.location.href = '../login.html';
                    return;
                }
                throw new Error('Failed to load config');
            }
            
            this.config = await response.json();
            
        } catch (error) {
            console.error('Ошибка загрузки конфига:', error);
            showTempMessage('Ошибка загрузки конфигурации', 'error');
        }
    }

    bindElements() {
        this.elements = {
            createPlotBtn: document.getElementById('createPlotBtn'),
            searchInput: document.getElementById('searchInput'),
            resetFilters: document.getElementById('resetFilters'),
            plotsTableBody: document.getElementById('plotsTableBody'),
            prevPage: document.getElementById('prevPage'),
            nextPage: document.getElementById('nextPage'),
            pageInfo: document.getElementById('pageInfo'),
            
            plotModal: document.getElementById('plotModal'),
            plotModalTitle: document.getElementById('plotModalTitle'),
            plotForm: document.getElementById('plotForm'),
            plotName: document.getElementById('plotName'),
            plotAddress: document.getElementById('plotAddress'),
            mapSearchInput: document.getElementById('mapSearchInput'),
            mapSearchBtn: document.getElementById('mapSearchBtn'),
            mapContainer: document.getElementById('mapContainer'),
            coordinatesDisplay: document.getElementById('coordinatesDisplay'),
            savePlotBtn: document.getElementById('savePlotBtn'),
            modalCloseBtns: document.querySelectorAll('[data-close-modal]'),
            
            deleteConfirmModal: document.getElementById('deleteConfirmModal'),
            deleteConfirmMessage: document.getElementById('deleteConfirmMessage'),
            confirmDeleteBtn: document.getElementById('confirmDeleteBtn')
        };
    }
    
    bindEvents() {
        this.elements.createPlotBtn.addEventListener('click', () => this.openCreateModal());
        
        this.elements.searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.debouncedSearch();
        });
        
        this.elements.resetFilters.addEventListener('click', () => this.resetFilters());
        
        this.elements.prevPage.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        this.elements.nextPage.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        
        this.elements.modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });
        
        this.elements.plotModal.addEventListener('click', (e) => {
            if (e.target === this.elements.plotModal) this.closeAllModals();
        });
        
        this.elements.deleteConfirmModal.addEventListener('click', (e) => {
            if (e.target === this.elements.deleteConfirmModal) this.closeAllModals();
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllModals();
        });
    }
    
    debouncedSearch = this.debounce(() => {
        this.currentPage = 1;
        this.filterAndRenderPlots();
    }, 300);
    
    debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    // ==================== ЗАГРУЗКА УЧАСТКОВ ====================
    async loadPlots() {
        try {
            this.showLoading();
            
            // Загружаем все участки
            this.allPlots = await apiService.getPlots(true) || [];
            
            this.filterAndRenderPlots();
            
        } catch (error) {
            console.error('Error loading plots:', error);
            this.showError('Ошибка загрузки участков');
        }
    }
    
    filterAndRenderPlots() {
        // Фильтрация
        let filteredPlots = this.allPlots;
        
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filteredPlots = this.allPlots.filter(plot => 
                (plot.name && plot.name.toLowerCase().includes(query)) ||
                (plot.address && plot.address.toLowerCase().includes(query))
            );
        }
        
        // Пагинация
        this.totalPages = Math.ceil(filteredPlots.length / this.pageSize);
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const paginatedPlots = filteredPlots.slice(startIndex, startIndex + this.pageSize);
        
        this.renderPlotsTable(paginatedPlots);
        this.updatePagination(filteredPlots.length);
    }
    
    renderPlotsTable(plots) {
        if (!plots || plots.length === 0) {
            this.elements.plotsTableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center" style="padding: 60px 20px; color: var(--text-muted); font-size: 1.1rem;">
                        Участки не найдены
                    </td>
                </tr>
            `;
            return;
        }
        
        const rows = plots.map(plot => `
            <tr data-plot-id="${plot.id}">
                <td><strong>${this.escapeHtml(plot.name)}</strong></td>
                <td class="status-cell">
                    <span class="status-badge ${plot.isActive ? 'status-active' : 'status-inactive'}">
                        <span class="status-dot"></span>
                        ${plot.isActive ? 'Активен' : 'Неактивен'}
                    </span>
                </td>
                <td class="actions-cell">
                    <button class="btn btn-outline btn-sm action-btn edit" 
                            data-action="edit" 
                            data-plot-id="${plot.id}">
                        Редактировать
                    </button>
                    <button class="btn btn-outline btn-sm action-btn delete" 
                            data-action="delete" 
                            data-plot-id="${plot.id}">
                        Удалить
                    </button>
                </td>
            </tr>
        `).join('');
        
        this.elements.plotsTableBody.innerHTML = rows;
        
        // ────────────────────────────────────────────────
        // ДОБАВЛЯЕМ data-label для мобильной версии (как в users.js)
        // ────────────────────────────────────────────────
        setTimeout(() => {
            const thElements = document.querySelectorAll('.plots-table th');
            const tdElements = document.querySelectorAll('.plots-table tbody td');
            
            tdElements.forEach((td, index) => {
                // берём соответствующий заголовок по порядку колонок
                const thIndex = index % thElements.length;
                const label = thElements[thIndex]?.textContent?.trim();
                if (label) {
                    td.setAttribute('data-label', label);
                }
            });
        }, 50);  // небольшой таймаут, чтобы DOM точно обновился
        
        // Привязываем события (оставляем как было)
        document.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const plotId = e.target.closest('[data-plot-id]').dataset.plotId;
                this.openEditModal(plotId);
            });
        });
        
        document.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const plotId = e.target.closest('[data-plot-id]').dataset.plotId;
                const plotName = e.target.closest('tr').querySelector('td:first-child strong').textContent;
                this.openDeleteConfirm(plotId, plotName);
            });
        });
    }

    
    updatePagination(totalItems) {
        this.elements.pageInfo.textContent = `Страница ${this.currentPage} из ${this.totalPages || 1}`;
        this.elements.prevPage.disabled = this.currentPage <= 1;
        this.elements.nextPage.disabled = this.currentPage >= this.totalPages;
        
        const paginationDiv = document.querySelector('.pagination');
        if (paginationDiv) {
            paginationDiv.style.display = totalItems === 0 ? 'none' : 'flex';
        }
    }
    
    goToPage(page) {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        this.filterAndRenderPlots();
    }
    
    resetFilters() {
        this.elements.searchInput.value = '';
        this.searchQuery = '';
        this.currentPage = 1;
        this.filterAndRenderPlots();
    }
    
    // ==================== МОДАЛЬНОЕ ОКНО ====================
    async setupModal() {
        if (!this.config || !this.config.yandexMapsKey) {
            return;
        }
        
        this.mapManager = new YandexMapManager('mapContainer', {
            center: [54.1931, 37.6175],
            zoom: 12
        });
        
        this.mapManager.setApiKey(this.config.yandexMapsKey);
        
        try {
            await this.mapManager.initialize();
            
            // Обработчик изменения координат с адресом
            this.mapManager.setOnChange((lat, lng, address) => {
                this.handleCoordinatesChange(lat, lng, address);
            });
            
        } catch (error) {
            console.error('Ошибка:', error);
            showTempMessage('Ошибка загрузки карты', 'error');
        }

        this.mapManager.onSearchStart(() => {

        });

        this.mapManager.onSearchSuccess(() => {

        });

        this.mapManager.onSearchError((message) => {

        });
        
        // Отправка формы
        this.elements.plotForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        // Валидация формы
        this.elements.plotName.addEventListener('input', () => this.validateForm());
    }
    
    async openCreateModal() {        
        if (!this.mapManager) {
            console.error('mapManager не инициализирован');
            showTempMessage('Карта не загружена', 'error');
            return;
        }
        
        this.currentPlotId = null;
        this.elements.plotModalTitle.textContent = 'Добавить участок';
        this.elements.plotForm.reset();
        
        this.mapManager.resetPlacemark();
        
        this.elements.coordinatesDisplay.textContent = 'Не выбрано';
        this.elements.plotAddress.value = '';
        this.elements.savePlotBtn.disabled = true;
        
        this.openModal(this.elements.plotModal);
    }
    
    async openEditModal(plotId) {
        try {
            this.currentPlotId = plotId;
            
            // Ищем участок в кэше
            const plot = this.allPlots.find(p => p.id == plotId);
            
            if (!plot) {
                throw new Error('Участок не найден');
            }
            
            this.elements.plotModalTitle.textContent = 'Редактировать участок';
            this.elements.plotName.value = plot.name || '';
            this.elements.plotAddress.value = plot.address || '';
            
            if (plot.latitude && plot.longitude) {
                this.mapManager.setPlacemark(plot.latitude, plot.longitude);
                this.elements.coordinatesDisplay.textContent = 
                    `${plot.latitude.toFixed(6)}, ${plot.longitude.toFixed(6)}`;
            } else {
                this.mapManager.resetPlacemark();
            }
            
            this.validateForm();
            this.openModal(this.elements.plotModal);
            
        } catch (error) {
            console.error('Error loading plot for edit:', error);
            showTempMessage('Ошибка загрузки данных участка', 'error');
        }
    }
    
    async handleMapSearch() {
        const query = this.elements.mapSearchInput.value.trim();
        
        if (!query) {
            showTempMessage('Введите адрес для поиска', 'warning');
            return;
        }
        
        try {
            showTempMessage('Ищем адрес на карте...', 'info');
            
            const result = await this.geocoder.search(query);
            
            // Устанавливаем метку
            this.mapManager.setPlacemark(result.lat, result.lon);
            
            // Обновляем поле адреса
            this.elements.plotAddress.value = result.display_name;
            
            // Очищаем поле поиска
            this.elements.mapSearchInput.value = '';
            
            showTempMessage('Адрес найден', 'success');
            
        } catch (error) {
            console.error('Map search error:', error);
            showTempMessage(error.message || 'Ошибка поиска адреса', 'error');
        }
    }
    
    async handleCoordinatesChange(lat, lng, address) {
        this.elements.coordinatesDisplay.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        
        if (address) {
            // Если адрес передан из поиска
            this.elements.plotAddress.value = address;
        } else {
            // Если кликнули на карту - определяем адрес
            try {
                const addr = await this.mapManager.reverseGeocode(lat, lng);
                this.elements.plotAddress.value = addr;
            } catch (error) {
                console.warn('Reverse geocoding failed:', error);
            }
        }
        
        this.validateForm();
    }
    
    validateForm() {
        const hasName = this.elements.plotName.value.trim().length > 0;
        const hasCoordinates = this.mapManager.getCoordinates() !== null;
        
        this.elements.savePlotBtn.disabled = !(hasName && hasCoordinates);
        
        return hasName && hasCoordinates;
    }
    
    async handleFormSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            showTempMessage('Заполните все обязательные поля', 'warning');
            return;
        }
        
        const coordinates = this.mapManager.getCoordinates();
        
        const plotData = {
            name: this.elements.plotName.value.trim(),
            latitude: coordinates.lat,
            longitude: coordinates.lng,
            address: this.elements.plotAddress.value.trim() || null,
            isActive: true
        };
        
        try {
            this.elements.savePlotBtn.disabled = true;
            this.elements.savePlotBtn.textContent = 'Сохранение...';
            
            if (this.currentPlotId) {
                await apiService.request(`/Plots/${this.currentPlotId}`, {
                    method: 'PUT',
                    body: JSON.stringify(plotData)
                });
                showTempMessage('Участок обновлен!', 'success');
            } else {
                await apiService.request('/Plots', {
                    method: 'POST',
                    body: JSON.stringify(plotData)
                });
                showTempMessage('Участок создан!', 'success');
            }
            
            this.closeAllModals();
            await this.loadPlots(); // Перезагружаем список
            
        } catch (error) {
            console.error('Error saving plot:', error);
            
            let errorMessage = 'Ошибка сохранения';
            if (error.data?.errors) {
                errorMessage = Object.values(error.data.errors).flat().join(', ');
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            showTempMessage(errorMessage, 'error');
            
        } finally {
            this.elements.savePlotBtn.disabled = false;
            this.elements.savePlotBtn.textContent = 'Сохранить';
        }
    }
    
    // ==================== УДАЛЕНИЕ ====================
    openDeleteConfirm(plotId, plotName) {
        this.currentPlotId = plotId;
        this.elements.deleteConfirmMessage.textContent = 
            `Вы уверены, что хотите удалить участок "${plotName}"?`;
        this.elements.confirmDeleteBtn.onclick = () => this.confirmDelete();
        this.openModal(this.elements.deleteConfirmModal);
    }
    
    async confirmDelete() {
        try {
            await apiService.request(`/Plots/${this.currentPlotId}`, {
                method: 'DELETE'
            });
            
            showTempMessage('Участок удален', 'success');
            this.closeAllModals();
            await this.loadPlots();
            
        } catch (error) {
            console.error('Error deleting plot:', error);
            showTempMessage('Ошибка удаления участка', 'error');
        }
    }
    
    // ==================== УТИЛИТЫ ====================
    openModal(modalElement) {
        modalElement.style.display = 'flex';
        setTimeout(() => {
            modalElement.classList.add('show');
            document.body.style.overflow = 'hidden';
        }, 10);
    }
    
    closeAllModals() {
        [this.elements.plotModal, this.elements.deleteConfirmModal].forEach(modal => {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        });
        document.body.style.overflow = '';
    }
    
    showLoading() {
        this.elements.plotsTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="loading-row">
                    <div class="loading-spinner"></div>
                    <span>Загрузка участков...</span>
                </td>
            </tr>
        `;
    }
    
    showError(message) {
        this.elements.plotsTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center" style="padding: 40px; color: var(--danger-color);">
                    ${message}
                </td>
            </tr>
        `;
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Проверка прав
    if (!isAdmin()) {
        window.location.href = '../dashboard.html';
        return;
    }
    
    window.plotsManager = new PlotsManager();
});