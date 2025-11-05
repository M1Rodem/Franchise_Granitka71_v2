export class SidebarManager {
    static init() {
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
            burgerBtn.addEventListener('click', () => {
                const isOpening = !sidebar.classList.contains('open');
                
                sidebar.classList.toggle('open');
                burgerBtn.classList.toggle('open');
                burgerBtn.setAttribute('aria-expanded', 
                    sidebar.classList.contains('open'));
                
                if (mainContent) {
                    mainContent.classList.toggle('shifted');
                }

                // Add/remove backdrop for mobile
                this.toggleBackdrop(isOpening);
            });
        }
    }

    static toggleBackdrop(show) {
        let backdrop = document.getElementById('sidebarBackdrop');
        
        if (show && !backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'sidebarBackdrop';
            backdrop.className = 'sidebar-backdrop';
            backdrop.addEventListener('click', () => {
                this.closeSidebar();
            });
            document.body.appendChild(backdrop);
            
            // Add active class with slight delay for animation
            setTimeout(() => backdrop.classList.add('active'), 10);
        } else if (!show && backdrop) {
            backdrop.classList.remove('active');
            setTimeout(() => {
                if (backdrop && backdrop.parentNode) {
                    backdrop.parentNode.removeChild(backdrop);
                }
            }, 300);
        }
    }

    static setupSidebarClose() {
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const burgerBtn = document.getElementById('burgerBtn');
            
            if (sidebar?.classList.contains('open') && 
                !sidebar.contains(e.target) && 
                e.target !== burgerBtn &&
                !e.target.closest('.burger-btn')) {
                this.closeSidebar();
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSidebar();
            }
        });
    }

    static closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const burgerBtn = document.getElementById('burgerBtn');
        const mainContent = document.getElementById('mainContent');
        
        if (sidebar?.classList.contains('open')) {
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
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        if (userData.role === 'Admin') {
            document.body.classList.add('user-is-admin');
        }
    }
}