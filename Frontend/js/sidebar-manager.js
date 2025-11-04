export class SidebarManager {
    static init() {
        this.setupBurgerButton();
        this.setupSidebarClose();
        this.setupActiveNav();
    }

    static setupBurgerButton() {
        const burgerBtn = document.getElementById('burgerBtn');
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');

        if (burgerBtn && sidebar) {
            burgerBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                burgerBtn.classList.toggle('open');
                burgerBtn.setAttribute('aria-expanded', 
                    sidebar.classList.contains('open'));
                
                if (mainContent) {
                    mainContent.classList.toggle('shifted');
                }
            });
        }
    }

    static setupSidebarClose() {
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const burgerBtn = document.getElementById('burgerBtn');
            
            if (sidebar?.classList.contains('open') && 
                !sidebar.contains(e.target) && 
                e.target !== burgerBtn) {
                sidebar.classList.remove('open');
                if (burgerBtn) {
                    burgerBtn.classList.remove('open');
                    burgerBtn.setAttribute('aria-expanded', 'false');
                }
                document.getElementById('mainContent')?.classList.remove('shifted');
            }
        });
    }

    static setupActiveNav() {
        const currentPage = window.location.pathname.split('/').pop();
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('href') === currentPage) {
                item.classList.add('active');
                item.setAttribute('aria-current', 'page');
            } else {
                item.classList.remove('active');
                item.removeAttribute('aria-current');
            }
        });
    }
}