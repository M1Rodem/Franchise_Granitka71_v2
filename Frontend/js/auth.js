// auth.js - упрощенная версия
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('error-message');

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            // Базовая валидация
            if (!username || !password) {
                showError('Заполните все поля');
                return;
            }

            try {
                console.log('Attempting login...');
                const result = await apiService.login({ username, password });
                console.log('Login success:', result);
                
                // Сохраняем токен
                apiService.setToken(result.token);
                
                // Сохраняем данные пользователя
                localStorage.setItem('userData', JSON.stringify({
                    id: result.id,
                    username: result.username,
                    fullName: result.fullName,
                    role: result.role
                }));
                
                // Редирект
                window.location.href = 'dashboard.html';
                
            } catch (error) {
                console.error('Login error:', error);
                showError(error.message || 'Ошибка входа');
            }
        });
    }

    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        } else {
            alert(message); // fallback
        }
    }
});