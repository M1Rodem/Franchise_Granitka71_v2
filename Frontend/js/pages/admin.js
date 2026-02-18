// admin.js - минимальная логика
import { apiService } from '../api/api.js';
import { showTempMessage } from '../utils/utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // Можно добавить проверку админских прав
    const checkAdminAccess = () => {
        // SidebarManager уже скрывает .admin-only для не-админов
        // Дополнительная проверка если нужно
    };
    
    checkAdminAccess();
});