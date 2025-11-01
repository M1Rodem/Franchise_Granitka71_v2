import { apiService } from './api.js';
import { showTempMessage, getFormValue } from './utils.js';
import { ModalUtils } from './modal-utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    await initializeProfilePage();
});

async function initializeProfilePage() {
    const user = apiService.getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Настройка UI страницы
    setupPageUI(user);
    
    // Загрузка актуальных данных профиля
    await loadProfileData();
    
    // Настройка обработчиков событий
    setupEventListeners();
}

function setupPageUI(user) {
    // ФИКС: Отображение ФИО в шапке
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = user.fullName || user.username || 'Пользователь';
    }

    // ФИКС: Показываем пункт "Пользователи" для админов
    if (user.role === 'Admin') {
        document.querySelectorAll('.admin-only').forEach(element => {
            element.style.display = 'block';
        });
    }

    // Заполняем форму данными пользователя
    document.getElementById('username').value = user.username || '';
    document.getElementById('fullName').value = user.fullName || '';
    document.getElementById('role').value = user.role || '';
}

async function loadProfileData() {
    try {
        // Получаем актуальные данные профиля с сервера
        const profileData = await apiService.getMyProfile();
        
        // Обновляем UI актуальными данными
        document.getElementById('username').value = profileData.username || '';
        document.getElementById('fullName').value = profileData.fullName || '';
        document.getElementById('role').value = profileData.role || '';
        
        // Обновляем данные в localStorage
        const currentUser = apiService.getCurrentUser();
        if (currentUser) {
            currentUser.fullName = profileData.fullName;
            currentUser.username = profileData.username;
            currentUser.role = profileData.role;
            localStorage.setItem('userData', JSON.stringify(currentUser));
        }
        
        // Обновляем шапку
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = profileData.fullName || profileData.username || 'Пользователь';
        }
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        showTempMessage('Не удалось загрузить данные профиля', 'error');
    }
}

function setupEventListeners() {
    // Обновление профиля
    document.getElementById('updateProfileBtn').addEventListener('click', async () => {
        const fullName = getFormValue('fullName');
        if (!fullName) {
            showTempMessage('ФИО обязательно для заполнения', 'error');
            return;
        }

        try {
            await apiService.updateProfile({ fullName });
            showTempMessage('ФИО успешно обновлено', 'success');
            
            // Обновляем данные в localStorage
            const user = apiService.getCurrentUser();
            if (user) {
                user.fullName = fullName;
                localStorage.setItem('userData', JSON.stringify(user));
            }
            
            // Обновляем шапку
            const userNameElement = document.getElementById('userName');
            if (userNameElement) {
                userNameElement.textContent = fullName;
            }
            
        } catch (err) {
            showTempMessage(err.message || 'Ошибка обновления профиля', 'error');
        }
    });

    // Смена пароля
    document.getElementById('changePasswordBtn').addEventListener('click', async () => {
        const current = getFormValue('currentPassword');
        const newPass = getFormValue('newPassword');
        const confirm = getFormValue('confirmPassword');

        if (!current || !newPass || !confirm) {
            showTempMessage('Заполните все поля пароля', 'error');
            return;
        }
        
        if (newPass !== confirm) {
            showTempMessage('Новый пароль и подтверждение не совпадают', 'error');
            return;
        }
        
        if (newPass.length < 6) {
            showTempMessage('Пароль должен содержать минимум 6 символов', 'error');
            return;
        }

        const confirmed = await ModalUtils.confirm({
            title: 'Сменить пароль?',
            message: 'Вы уверены, что хотите сменить пароль? Это действие необратимо.',
            confirmText: 'Сменить',
            danger: true
        });
        
        if (!confirmed) return;

        try {
            await apiService.changePassword({ 
                currentPassword: current, 
                newPassword: newPass 
            });
            
            showTempMessage('Пароль успешно изменён', 'success');
            
            // Очищаем поля пароля
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            
        } catch (err) {
            showTempMessage(err.message || 'Ошибка смены пароля', 'error');
        }
    });

    // Выход из системы
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await apiService.logout();
            } catch (error) {
                console.warn('Logout error:', error);
            }
        });
    }
}