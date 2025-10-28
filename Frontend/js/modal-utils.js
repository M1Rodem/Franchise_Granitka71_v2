class ModalUtils {
    // ====== КОНФИРМАЦИОННЫЕ ОКНА ======
    
    static confirm(options) {
        return new Promise((resolve) => {
            const modal = this.createModalBase();
            
            modal.innerHTML = `
                <div class="modal-content" style="
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    max-width: 400px;
                    width: 90%;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                ">
                    <h3 style="margin-bottom: 1rem; color: #333; font-size: 1.25rem;">
                        ${options.title || 'Подтверждение'}
                    </h3>
                    <p style="margin-bottom: 1.5rem; color: #666; line-height: 1.5;">
                        ${options.message}
                    </p>
                    <div style="display: flex; gap: 1rem; justify-content: center;">
                        <button class="btn btn-outline" id="modalCancel" style="min-width: 100px;">
                            ${options.cancelText || 'Отмена'}
                        </button>
                        <button class="btn ${options.danger ? 'btn-danger' : 'btn-primary'}" 
                                id="modalConfirm" style="min-width: 100px;">
                            ${options.confirmText || 'Подтвердить'}
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            this.setupModalEvents(modal, resolve);
        });
    }

    // ====== ИНФОРМАЦИОННЫЕ ОКНА ======
    
    static alert(options) {
        return new Promise((resolve) => {
            const modal = this.createModalBase();
            
            modal.innerHTML = `
                <div class="modal-content" style="
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    max-width: 400px;
                    width: 90%;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                ">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">
                        ${options.icon || 'ℹ️'}
                    </div>
                    <h3 style="margin-bottom: 1rem; color: #333; font-size: 1.25rem;">
                        ${options.title || 'Информация'}
                    </h3>
                    <p style="margin-bottom: 1.5rem; color: #666; line-height: 1.5;">
                        ${options.message}
                    </p>
                    <div style="display: flex; gap: 1rem; justify-content: center;">
                        <button class="btn btn-primary" id="modalOk" style="min-width: 100px;">
                            ${options.okText || 'OK'}
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const closeModal = () => {
                modal.remove();
                resolve(true);
            };
            
            modal.querySelector('#modalOk').addEventListener('click', closeModal);
            this.setupModalClose(modal, closeModal);
        });
    }

    // ====== ОКНА ЗАГРУЗКИ ======
    
    static showLoading(message = 'Загрузка...') {
        const modal = this.createModalBase();
        
        modal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 2rem;
                border-radius: 8px;
                max-width: 300px;
                width: 90%;
                text-align: center;
            ">
                <div class="loading-spinner" style="
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #007bff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 1rem;
                "></div>
                <p style="margin: 0; color: #666;">${message}</p>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        
        document.body.appendChild(modal);
        
        return {
            close: () => modal.remove(),
            update: (newMessage) => {
                const messageEl = modal.querySelector('p');
                if (messageEl) messageEl.textContent = newMessage;
            }
        };
    }

    // ====== ОКНА ВВОДА ======
    
    static prompt(options) {
        return new Promise((resolve) => {
            const modal = this.createModalBase();
            
            modal.innerHTML = `
                <div class="modal-content" style="
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    max-width: 400px;
                    width: 90%;
                    text-align: center;
                ">
                    <h3 style="margin-bottom: 1rem; color: #333;">
                        ${options.title || 'Ввод данных'}
                    </h3>
                    <p style="margin-bottom: 1rem; color: #666; text-align: left;">
                        ${options.message}
                    </p>
                    <input type="${options.inputType || 'text'}" 
                           id="modalInput"
                           value="${options.defaultValue || ''}"
                           placeholder="${options.placeholder || ''}"
                           style="
                                width: 100%;
                                padding: 0.5rem;
                                border: 1px solid #ddd;
                                border-radius: 4px;
                                margin-bottom: 1.5rem;
                                font-size: 1rem;
                           "
                           ${options.required ? 'required' : ''}>
                    <div style="display: flex; gap: 1rem; justify-content: center;">
                        <button class="btn btn-outline" id="modalCancel">
                            ${options.cancelText || 'Отмена'}
                        </button>
                        <button class="btn btn-primary" id="modalConfirm">
                            ${options.confirmText || 'OK'}
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Фокус на поле ввода
            const input = modal.querySelector('#modalInput');
            input.focus();
            input.select();
            
            const confirmHandler = () => {
                const value = input.value.trim();
                if (options.required && !value) {
                    input.style.borderColor = '#dc3545';
                    return;
                }
                modal.remove();
                resolve(value);
            };
            
            const cancelHandler = () => {
                modal.remove();
                resolve(null);
            };
            
            modal.querySelector('#modalConfirm').addEventListener('click', confirmHandler);
            modal.querySelector('#modalCancel').addEventListener('click', cancelHandler);
            
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') confirmHandler();
            });
            
            this.setupModalClose(modal, cancelHandler);
        });
    }

    // ====== БАЗОВЫЕ ФУНКЦИИ ======
    
    static createModalBase() {
        // Закрываем существующие модальные окна
        this.closeAllModals();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        return modal;
    }
    
    static setupModalEvents(modal, resolve) {
        const confirmHandler = () => {
            modal.remove();
            resolve(true);
        };
        
        const cancelHandler = () => {
            modal.remove();
            resolve(false);
        };
        
        modal.querySelector('#modalConfirm').addEventListener('click', confirmHandler);
        modal.querySelector('#modalCancel').addEventListener('click', cancelHandler);
        this.setupModalClose(modal, cancelHandler);
    }
    
    static setupModalClose(modal, closeHandler) {
        // Закрытие по клику на фон
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeHandler();
            }
        });
        
        // Закрытие по ESC
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeHandler();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        // Убираем обработчик при закрытии модального окна
        const originalClose = closeHandler;
        closeHandler = () => {
            document.removeEventListener('keydown', escapeHandler);
            originalClose();
        };
    }
    
    static closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
    }
}

// ====== ФУНКЦИИ ДЛЯ ВРЕМЕННЫХ СООБЩЕНИЙ ======

function showTempMessage(message, type = 'success', duration = 4000) {
    // Закрываем существующие сообщения
    closeTempMessages();
    
    const messageEl = document.createElement('div');
    messageEl.className = `temp-message temp-message-${type}`;
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 6px;
        z-index: 10001;
        color: white;
        background: ${type === 'success' ? '#28a745' : 
                     type === 'error' ? '#dc3545' : 
                     type === 'warning' ? '#ffc107' : 
                     type === 'info' ? '#17a2b8' : '#6c757d'};
        max-width: 400px;
        word-wrap: break-word;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    messageEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.2em;">
                ${type === 'success' ? '✅' : 
                  type === 'error' ? '❌' : 
                  type === 'warning' ? '⚠️' : 
                  type === 'info' ? 'ℹ️' : '💬'}
            </span>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(messageEl);
    
    // Анимация появления
    setTimeout(() => {
        messageEl.style.transform = 'translateX(0)';
    }, 10);
    
    // Автоматическое закрытие
    const timeoutId = setTimeout(() => {
        closeMessage(messageEl);
    }, duration);
    
    // Закрытие по клику
    messageEl.addEventListener('click', () => {
        clearTimeout(timeoutId);
        closeMessage(messageEl);
    });
    
    return {
        close: () => closeMessage(messageEl)
    };
}

function closeTempMessages() {
    document.querySelectorAll('.temp-message').forEach(msg => {
        msg.style.transform = 'translateX(100%)';
        setTimeout(() => msg.remove(), 300);
    });
}

function closeMessage(messageEl) {
    if (messageEl && messageEl.parentNode) {
        messageEl.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 300);
    }
}

// ====== УПРОЩЕННЫЕ ФУНКЦИИ ДЛЯ ЧАСТЫХ СЦЕНАРИЕВ ======

function showSuccessMessage(message, duration) {
    return showTempMessage(message, 'success', duration);
}

function showErrorMessage(message, duration) {
    return showTempMessage(message, 'error', duration);
}

function showWarningMessage(message, duration) {
    return showTempMessage(message, 'warning', duration);
}

function showInfoMessage(message, duration) {
    return showTempMessage(message, 'info', duration);
}

// ====== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ HTML ======

window.showTempMessage = showTempMessage;
window.showSuccessMessage = showSuccessMessage;
window.showErrorMessage = showErrorMessage;
window.closeTempMessages = closeTempMessages;