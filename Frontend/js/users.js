import { apiService } from './api.js';
import { showTempMessage, escapeHtml } from './utils.js';
import { ModalUtils } from './modal-utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const userData = apiService.getCurrentUser();
    if (!token || !userData || userData.role !== 'Admin') {
        window.location.href = 'login.html';
        return;
    }

    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = userData.fullName || 'Пользователь';
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => apiService.logout());

    setupCreateForm();
    loadUsers();
});

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="loading">Загрузка...</td></tr>`;
    try {
        const users = await apiService.getUsers();
        if (!Array.isArray(users) || users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6">Пользователи не найдены</td></tr>`;
            return;
        }
        tbody.innerHTML = users.map(renderUserRow).join('');
    } catch (e) {
        console.error('Ошибка загрузки:', e);
        tbody.innerHTML = `<tr><td colspan="6" style="color:#dc3545;">Ошибка загрузки пользователей</td></tr>`;
        showTempMessage(e.message || 'Ошибка загрузки', 'error');
    }
}

function renderUserRow(u) {
    const status = u.isBlocked ? 'Заблокирован' : 'Активен';
    const statusClass = u.isBlocked ? 'status-blocked' : 'status-active';
    const toggleText = u.isBlocked ? 'Разблокировать' : 'Заблокировать';
    const toggleClass = u.isBlocked ? 'btn-success' : 'btn-danger';
    const nextRole = u.role === 'Admin' ? 'Manager' : 'Admin';
    const roleClass = u.role.toLowerCase();
    return `
    <tr>
        <td>${u.id}</td>
        <td>${escapeHtml(u.username)}</td>
        <td>${escapeHtml(u.fullName)}</td>
        <td><span class="status-badge role-${roleClass}">${u.role}</span></td>
        <td><span class="status-badge ${statusClass}">${status}</span></td>
        <td class="actions">
            <button class="btn btn-outline btn-sm" onclick="openEdit(${u.id})">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">🗑️</button>
            <button class="btn ${toggleClass} btn-sm" onclick="toggleBlock(${u.id}, ${u.isBlocked})">${toggleText}</button>
            <button class="btn btn-primary btn-sm" onclick="changeRole(${u.id}, '${nextRole}')">Сделать ${nextRole}</button>
        </td>
    </tr>`;
}

function setupCreateForm() {
    const form = document.getElementById('createUserForm');
    if (!form) return;
    const errorEl = document.getElementById('userFormError');
    const successEl = document.getElementById('userFormSuccess');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            username: document.getElementById('newUsername').value.trim(),
            password: document.getElementById('newPassword').value,
            fullName: document.getElementById('newFullName').value.trim(),
            role: document.getElementById('newRole').value
        };

        const validationError = validateCreateUser(payload);
        if (validationError) {
            showTempMessage(validationError, 'error');
            return;
        }

        try {
            await apiService.createUser(payload);
            showTempMessage('Пользователь создан', 'success');
            form.reset();
            loadUsers();
        } catch (e) {
            showTempMessage(e.message || 'Не удалось создать пользователя', 'error');
        }
    });
}

function validateCreateUser(payload) {
    if (!payload.username || !payload.password || !payload.fullName) {
        return 'Заполните обязательные поля';
    }
    if (payload.password.length < 6) {
        return 'Пароль должен быть не менее 6 символов';
    }
    if (!['Admin', 'Manager'].includes(payload.role)) {
        return 'Неверная роль';
    }
    return null;
}

async function openEdit(id) {
    try {
        // Модалка для username/fullName
        const newUsername = await ModalUtils.prompt({
            title: 'Изменить логин',
            message: 'Новый логин:',
            inputType: 'text',
            defaultValue: '',  // Загрузи из load, но для простоты prompt без current
            required: true
        });
        if (newUsername === null) return;

        const newFullName = await ModalUtils.prompt({
            title: 'Изменить ФИО',
            message: 'Новые ФИО:',
            inputType: 'text',
            required: true
        });
        if (newFullName === null) return;

        const changePassword = await ModalUtils.confirm({
            title: 'Изменить пароль?',
            message: 'Ввести новый пароль?',
            confirmText: 'Да'
        });
        let newPassword = '';
        if (changePassword) {
            newPassword = await ModalUtils.prompt({
                title: 'Новый пароль',
                message: 'Пароль (минимум 6 символов):',
                inputType: 'password',
                required: true
            });
            if (newPassword === null || newPassword.length < 6) return;
        }

        await updateUser(id, {
            username: newUsername.trim(),
            fullName: newFullName.trim(),
            password: newPassword
        });
    } catch (e) {
        showTempMessage(e.message || 'Ошибка редактирования', 'error');
    }
}

async function updateUser(id, payload) {
    try {
        await apiService.updateUser(id, payload);
        showTempMessage('Пользователь обновлён', 'success');
        await loadUsers();
    } catch (e) {
        showTempMessage(e.message || 'Не удалось обновить пользователя', 'error');
    }
}

async function deleteUser(id) {
    const confirmed = await ModalUtils.confirm({
        title: 'Удалить пользователя?',
        message: 'Это действие необратимо.',
        confirmText: 'Удалить',
        danger: true
    });
    if (!confirmed) return;

    try {
        await apiService.deleteUser(id);
        showTempMessage('Пользователь удалён', 'success');
        await loadUsers();
    } catch (e) {
        showTempMessage(e.message || 'Не удалось удалить пользователя', 'error');
    }
}

async function toggleBlock(id, isBlocked) {
    const action = isBlocked ? 'разблокировать' : 'заблокировать';
    const confirmed = await ModalUtils.confirm({
        title: ` ${action} пользователя?`,
        message: `Пользователь будет ${action}.`,
        confirmText: action.charAt(0).toUpperCase() + action.slice(1),
        danger: !isBlocked  // Danger для block
    });
    if (!confirmed) return;

    try {
        if (isBlocked) {
            await apiService.unblockUser(id);
        } else {
            await apiService.blockUser(id);
        }
        showTempMessage(`Пользователь ${action}`, 'success');
        await loadUsers();
    } catch (e) {
        showTempMessage(e.message || `Не удалось ${action} пользователя`, 'error');
    }
}

async function changeRole(id, role) {
    const confirmed = await ModalUtils.confirm({
        title: `Изменить роль на ${role}?`,
        message: `Роль пользователя будет изменена на ${role}.`,
        confirmText: 'Изменить'
    });
    if (!confirmed) return;

    try {
        await apiService.changeUserRole(id, role);
        showTempMessage(`Роль изменена на ${role}`, 'success');
        await loadUsers();
    } catch (e) {
        showTempMessage(e.message || 'Не удалось изменить роль', 'error');
    }
}

// Глобальные для onclick в HTML
window.openEdit = openEdit;
window.deleteUser = deleteUser;
window.toggleBlock = toggleBlock;
window.changeRole = changeRole;