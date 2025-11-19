export class SidebarManager {
    static init() {
        const isProduction = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';
        
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) {
            console.warn('SidebarManager: Sidebar element not found in DOM');
            return;
        }
        
        if (isProduction) {
            sidebar.style.display = 'block';
            sidebar.style.visibility = 'visible';
            sidebar.style.opacity = '1';
        }
        
        this.setupBurgerButton();
        this.setupSidebarClose();
        this.setupActiveNav();
        this.setupAdminMenu();
    }

    static setupBurgerButton() {
        const burgerBtn = document.getElementById('burgerBtn');
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        if (burgerBtn && sidebar) {
            // ФИКС: Удаляем все старые обработчики
            const newBurgerBtn = burgerBtn.cloneNode(true);
            burgerBtn.parentNode.replaceChild(newBurgerBtn, burgerBtn);
            
            newBurgerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                const isOpening = !sidebar.classList.contains('open');
                
                sidebar.classList.toggle('open');
                newBurgerBtn.classList.toggle('open');
                newBurgerBtn.setAttribute('aria-expanded', sidebar.classList.contains('open'));
                
                if (mainContent) {
                    mainContent.classList.toggle('shifted');
                }

                // Add/remove backdrop for mobile
                this.toggleBackdrop(isOpening);
            });
            
        } else {
        }
    }

    static toggleBackdrop(show) {
        let backdrop = document.querySelector('.sidebar-backdrop');
        
        if (show && !backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'sidebar-backdrop';
            backdrop.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 1001;
                display: block;
            `;
            backdrop.addEventListener('click', () => {
                this.closeSidebar();
            });
            document.body.appendChild(backdrop);
            
            // Анимация появления
            setTimeout(() => {
                backdrop.style.opacity = '1';
            }, 10);
        } else if (!show && backdrop) {
            backdrop.style.opacity = '0';
            setTimeout(() => {
                if (backdrop && backdrop.parentNode) {
                    backdrop.parentNode.removeChild(backdrop);
                }
            }, 300);
        }
    }

    static setupSidebarClose() {
        // ФИКС: Более надежная обработка закрытия
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const burgerBtn = document.getElementById('burgerBtn');
            
            if (sidebar && sidebar.classList.contains('open')) {
                const isBurgerBtn = e.target === burgerBtn || e.target.closest('#burgerBtn');
                const isSidebar = e.target === sidebar || sidebar.contains(e.target);
                
                if (!isBurgerBtn && !isSidebar) {
                    this.closeSidebar();
                }
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const sidebar = document.getElementById('sidebar');
                if (sidebar && sidebar.classList.contains('open')) {
                    this.closeSidebar();
                }
            }
        });
    }

    static closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const burgerBtn = document.getElementById('burgerBtn');
        const mainContent = document.getElementById('mainContent');
        
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            if (burgerBtn) {
                burgerBtn.classList.remove('open');
                burgerBtn.setAttribute('aria-expanded', 'false');
            }
            if (mainContent) {
                mainContent.classList.remove('shifted');
            }
            this.toggleBackdrop(false);
        }
    }

    static setupActiveNav() {
        const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
        
        document.querySelectorAll('.nav-item').forEach(item => {
            const href = item.getAttribute('href');
            if (href === currentPage || (currentPage === '' && href === 'dashboard.html')) {
                item.classList.add('active');
                item.setAttribute('aria-current', 'page');
            } else {
                item.classList.remove('active');
                item.removeAttribute('aria-current');
            }
        });
    }

    static setupAdminMenu() {
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            if (userData.role === 'Admin') {
                document.body.classList.add('user-is-admin');
            }
        } catch (error) {
            console.warn('SidebarManager: Error setting up admin menu:', error);
        }
    }
}