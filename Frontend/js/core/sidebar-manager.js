export class SidebarManager {
    static init() {
        console.log('SidebarManager: Initializing sidebar...');
        
        // ФИКС: Универсальная проверка production режима
        const isProduction = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';
        console.log('SidebarManager: Environment:', isProduction ? 'production' : 'development');
        
        // Проверяем, существует ли sidebar в DOM
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) {
            console.warn('SidebarManager: Sidebar element not found in DOM');
            return;
        }
        
        // ФИКС: Принудительно показываем sidebar в production
        if (isProduction) {
            console.log('SidebarManager: Ensuring sidebar visibility in production');
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

        console.log('SidebarManager: Setting up burger button', { 
            burgerBtn: !!burgerBtn, 
            sidebar: !!sidebar, 
            mainContent: !!mainContent 
        });

        if (burgerBtn && sidebar) {
            // ФИКС: Удаляем все старые обработчики
            const newBurgerBtn = burgerBtn.cloneNode(true);
            burgerBtn.parentNode.replaceChild(newBurgerBtn, burgerBtn);
            
            newBurgerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('SidebarManager: Burger button clicked - toggling sidebar');
                
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
            
            console.log('SidebarManager: Burger button setup complete');
        } else {
            console.warn('SidebarManager: Burger button or sidebar not found');
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
                console.log('SidebarManager: Backdrop clicked - closing sidebar');
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
                    console.log('SidebarManager: Click outside - closing sidebar');
                    this.closeSidebar();
                }
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const sidebar = document.getElementById('sidebar');
                if (sidebar && sidebar.classList.contains('open')) {
                    console.log('SidebarManager: Escape pressed - closing sidebar');
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
            console.log('SidebarManager: Closing sidebar');
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
        console.log('SidebarManager: Setting active nav for page:', currentPage);
        
        document.querySelectorAll('.nav-item').forEach(item => {
            const href = item.getAttribute('href');
            if (href === currentPage || (currentPage === '' && href === 'dashboard.html')) {
                item.classList.add('active');
                item.setAttribute('aria-current', 'page');
                console.log('SidebarManager: Activated nav item:', href);
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
                console.log('SidebarManager: Admin menu activated');
            }
        } catch (error) {
            console.warn('SidebarManager: Error setting up admin menu:', error);
        }
    }
}