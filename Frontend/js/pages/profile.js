import { apiService } from '../api/api.js';
import { showTempMessage, getFormValue } from '../utils/utils.js';
import { ModalUtils } from '../utils/modal-utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    await initializeProfilePage();
});

async function initializeProfilePage() {
    const user = apiService.getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    setupPageUI(user);
    await loadProfileData();
    setupEventListeners();
}

function setupPageUI(user) {
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = user.fullName || user.username || 'Пользователь';
    }

    if (user.role === 'Admin') {
        document.querySelectorAll('.admin-only').forEach(element => {
            element.style.display = 'block';
        });
    }

    document.getElementById('username').value = user.username || '';
    document.getElementById('fullName').value = user.fullName || '';
    document.getElementById('role').value = user.role || '';
}

async function loadProfileData() {
    try {
        const profileData = await apiService.getMyProfile();
        
        document.getElementById('username').value = profileData.username || '';
        document.getElementById('fullName').value = profileData.fullName || '';
        document.getElementById('role').value = profileData.role || '';
        
        const currentUser = apiService.getCurrentUser();
        if (currentUser) {
            currentUser.fullName = profileData.fullName;
            currentUser.username = profileData.username;
            currentUser.role = profileData.role;
            localStorage.setItem('userData', JSON.stringify(currentUser));
        }
        
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
    document.getElementById('updateProfileBtn').addEventListener('click', handleProfileUpdate);

    const passwordForm = document.getElementById('changePasswordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordChange);
    }

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

async function handleProfileUpdate() {
    const fullName = getFormValue('fullName');
    if (!fullName) {
        showTempMessage('ФИО обязательно для заполнения', 'error');
        return;
    }

    try {
        await apiService.updateProfile({ fullName });
        showTempMessage('ФИО успешно обновлено', 'success');
        
        const user = apiService.getCurrentUser();
        if (user) {
            user.fullName = fullName;
            localStorage.setItem('userData', JSON.stringify(user));
        }
        
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = fullName;
        }
        
    } catch (err) {
        showTempMessage(err.message || 'Ошибка обновления профиля', 'error');
    }
}

async function handlePasswordChange(e) {
    e.preventDefault();
    
    const current = getFormValue('currentPassword');
    const newPass = getFormValue('newPassword');
    const confirm = getFormValue('confirmPassword');

    // ВАЛИДАЦИЯ 1: Проверка заполненности полей
    if (!current || !newPass || !confirm) {
        showTempMessage('Заполните все поля пароля', 'error');
        return;
    }
    
    // ВАЛИДАЦИЯ 2: Проверка длины пароля (8 символов)
    if (newPass.length < 8) {
        showTempMessage('Пароль должен содержать минимум 8 символов', 'error');
        return;
    }
    
    // ВАЛИДАЦИЯ 3: Проверка совпадения паролей
    if (newPass !== confirm) {
        showTempMessage('Новый пароль и подтверждение не совпадают', 'error');
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
        
        // Очищаем форму
        const passwordForm = document.getElementById('changePasswordForm');
        if (passwordForm) {
            passwordForm.reset();
        }
        
    } catch (err) {
        // ВАЛИДАЦИЯ 4: Обработка ошибки от сервера (неверный текущий пароль)
        if (err.message && err.message.includes('Текущий пароль неверен')) {
            showTempMessage('Текущий пароль неверен', 'error');
        } else {
            showTempMessage(err.message || 'Ошибка смены пароля', 'error');
        }
    }
}