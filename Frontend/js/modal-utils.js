import { showTempMessage } from './utils.js';  // Для сообщений

export class ModalUtils {
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
                           ">
                    <div style="display: flex; gap: 1rem; justify-content: center;">
                        <button class="btn btn-outline" id="modalCancel" style="min-width: 100px;">Отмена</button>
                        <button class="btn btn-primary" id="modalConfirm" style="min-width: 100px;">OK</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
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
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeHandler();
            }
        });
        
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeHandler();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
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

// Глобальные для legacy (если в HTML onclick)
window.ModalUtils = ModalUtils;