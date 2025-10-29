import { apiService } from './api.js';
import { showTempMessage, getFormValue } from './utils.js';
import { ModalUtils } from './modal-utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const user = apiService.getCurrentUser();
    if (!user) window.location.href = 'login.html';

    document.getElementById('username').textContent = user.username;
    document.getElementById('fullName').value = user.fullName || '';
    document.getElementById('role').textContent = user.role;

    // Update ФИО
    document.getElementById('updateProfileBtn').addEventListener('click', async () => {
        const fullName = getFormValue('fullName');
        if (!fullName) return showTempMessage('ФИО обязательно', 'error');

        try {
            await apiService.updateProfile({ fullName });
            showTempMessage('ФИО обновлено', 'success');
            // Обнови localStorage
            user.fullName = fullName;
            localStorage.setItem('userData', JSON.stringify(user));
            document.getElementById('userName').textContent = fullName;  // Если в header
        } catch (err) {
            showTempMessage(err.message, 'error');
        }
    });

    // Change password
    document.getElementById('changePasswordBtn').addEventListener('click', async () => {
        const current = getFormValue('currentPassword');
        const newPass = getFormValue('newPassword');
        const confirm = getFormValue('confirmPassword');

        if (!current || !newPass || !confirm) return showTempMessage('Заполните все поля', 'error');
        if (newPass !== confirm) return showTempMessage('Пароли не совпадают', 'error');
        if (newPass.length < 6) return showTempMessage('Пароль ≥ 6 символов', 'error');

        const confirmed = await ModalUtils.confirm({
            title: 'Сменить пароль?',
            message: 'Это действие необратимо.',
            danger: true
        });
        if (!confirmed) return;

        try {
            await apiService.changePassword({ currentPassword: current, newPassword: newPass });
            showTempMessage('Пароль изменён', 'success');
            // Clear inputs
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } catch (err) {
            showTempMessage(err.message || 'Ошибка смены пароля', 'error');
        }
    });
});