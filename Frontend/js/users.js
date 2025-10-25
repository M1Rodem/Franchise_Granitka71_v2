document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (!token || userData.role !== 'Admin') {
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
    tbody.innerHTML = `<tr><td colspan="6" class="loading">Загрузка...</td></tr>`;
    try {
        const users = await apiService.getUsers();
        if (!Array.isArray(users) || users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="loading">Пользователи не найдены</td></tr>`;
            return;
        }
        tbody.innerHTML = users.map(renderUserRow).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="loading" style="color:#dc3545;">Ошибка загрузки пользователей</td></tr>`;
    }
}

function renderUserRow(u) {
    const status = u.isBlocked ? 'Заблокирован' : 'Активен';
    const toggleText = u.isBlocked ? 'Разблокировать' : 'Заблокировать';
    const nextRole = u.role === 'Admin' ? 'Manager' : 'Admin';
    return `
    <tr>
        <td>${u.id}</td>
        <td>${escapeHtml(u.username)}</td>
        <td>${escapeHtml(u.fullName)}</td>
        <td>
            <span class="status-badge">${u.role}</span>
            <button class="btn btn-outline btn-sm" onclick="changeRole(${u.id}, '${nextRole}')">Сделать ${nextRole}</button>
        </td>
        <td>${status}</td>
        <td class="actions">
            <button class="btn btn-outline btn-sm" onclick="openEdit(${u.id}, '${escapeAttr(u.username)}', '${escapeAttr(u.fullName)}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">🗑️</button>
            <button class="btn btn-primary btn-sm" onclick="toggleBlock(${u.id}, ${u.isBlocked})">${toggleText}</button>
        </td>
    </tr>`;
}

function setupCreateForm() {
    const form = document.getElementById('createUserForm');
    const errorEl = document.getElementById('userFormError');
    const successEl = document.getElementById('userFormSuccess');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessage(errorEl); hideMessage(successEl);
        const payload = {
            username: document.getElementById('newUsername').value.trim(),
            password: document.getElementById('newPassword').value,
            fullName: document.getElementById('newFullName').value.trim(),
            role: document.getElementById('newRole').value
        };
        if (!payload.username || !payload.password || !payload.fullName) {
            showMessage(errorEl, 'Заполните обязательные поля');
            return;
        }
        if (payload.password.length < 6) {
            showMessage(errorEl, 'Пароль должен быть не менее 6 символов');
            return;
        }
        try {
            await apiService.createUser(payload);
            showMessage(successEl, 'Пользователь создан');
            form.reset();
            loadUsers();
        } catch (e) {
            showMessage(errorEl, e.message || 'Не удалось создать пользователя');
        }
    });
}

function openEdit(id, username, fullName) {
    const newUsername = prompt('Новый логин', username);
    if (newUsername === null) return;
    const newFullName = prompt('Новые ФИО', fullName);
    if (newFullName === null) return;
    const newPassword = prompt('Новый пароль (оставьте пустым чтобы не менять)');
    updateUser(id, {
        username: newUsername.trim(),
        fullName: newFullName.trim(),
        password: newPassword ? String(newPassword) : ''
    });
}

async function updateUser(id, payload) {
    try {
        await apiService.updateUser(id, payload);
        await loadUsers();
    } catch (e) {
        alert(e.message || 'Не удалось обновить пользователя');
    }
}

async function deleteUser(id) {
    if (!confirm('Удалить пользователя?')) return;
    try {
        await apiService.deleteUser(id);
        await loadUsers();
    } catch (e) {
        alert(e.message || 'Не удалось удалить пользователя');
    }
}

async function toggleBlock(id, isBlocked) {
    try {
        if (isBlocked) await apiService.unblockUser(id); else await apiService.blockUser(id);
        await loadUsers();
    } catch (e) {
        alert(e.message || 'Не удалось изменить статус');
    }
}

async function changeRole(id, role) {
    try {
        await apiService.changeUserRole(id, role);
        await loadUsers();
    } catch (e) {
        alert(e.message || 'Не удалось изменить роль');
    }
}

function showMessage(el, text) { el.textContent = text; el.style.display = 'block'; }
function hideMessage(el) { el.textContent = ''; el.style.display = 'none'; }
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function escapeAttr(s) { return String(s).replace(/["']/g, c => ({'"':'&quot;','\'':'&#39;'}[c])); }

