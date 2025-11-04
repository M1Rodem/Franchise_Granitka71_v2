import { apiService } from './api.js';
import { updateDashboardStats, showLoadingState } from './dashboard-ui.js';
import { mapStatusToEnum } from './utils.js';

export async function loadDashboardData() {
    return await PageManager.withLoading(
        showLoadingState,
        async () => {
            const [totalResponse, todayResponse, unpaidResponse, recentResponse] = await Promise.all([
                apiService.getOrders({ page: 1, pageSize: 1 }),
                apiService.getOrders({ OrderDateFrom: new Date().toISOString().split('T')[0], page: 1, pageSize: 100 }),
                apiService.getOrders({ Status: mapStatusToEnum('not_paid'), page: 1, pageSize: 100 }),
                apiService.getOrders({ page: 1, pageSize: 5, sortBy: 'OrderDate', sortDesc: true })
            ]);

            const stats = {
                total: totalResponse?.totalCount || 0,
                today: todayResponse?.totalCount || 0,
                unpaid: unpaidResponse?.totalCount || 0,
                recent: recentResponse?.items || []
            };

            updateDashboardStats(stats);
            return stats;
        }
    );
}