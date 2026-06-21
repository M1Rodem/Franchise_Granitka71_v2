using Franchisee.Web.Models.DTOs.Orders;
using Franchisee.Web.Models.DTOs.Reports;
using Franchisee.Web.Models.Entities.Orders;
using Franchisee.Web.Models.Requests.Orders;
using Franchisee.Web.Models.Requests.Reports;
using Franchisee.Web.Models.Entities.Users;

namespace Franchisee.Web.Services.Orders.Repositories
{
    public interface IOrderRepository
    {
        Task<Order?> GetByIdAsync(int id);

        Task<IEnumerable<Order>> GetAllAsync(int? managerId = null);

        Task<IEnumerable<Order>> GetByManagerAsync(int managerId);

        Task<(IEnumerable<Order> Orders, int TotalCount)> GetFilteredOrdersAsync(
            OrderFilterRequest filter,
            int? managerId = null
        );

        Task<(IEnumerable<OrdersListItemDto> Orders, int TotalCount)> GetOrdersListAsync(
            OrderFilterRequest filter
        );
        Task<(IEnumerable<OrdersListItemDto> Orders, int TotalCount)>
        GetArchivedOrdersListAsync(OrderFilterRequest filter);

        Task AddAsync(Order order);

        Task UpdateAsync(Order order);

        Task SoftDeleteAsync(int id);

        Task PermanentDeleteAsync(int id);

        Task<bool> ExistsAsync(int id);

        Task<string> GenerateOrderNumberAsync();

        Task<string> GetOriginalOrderNumberAsync(int orderId);

        Task<(List<ManagerFinanceOrderDto> Orders, Manager? Manager, decimal TotalPaid)>
           GetManagerFinanceReportAsync(int managerId, DateTime dateFrom, DateTime dateTo);
    }
}