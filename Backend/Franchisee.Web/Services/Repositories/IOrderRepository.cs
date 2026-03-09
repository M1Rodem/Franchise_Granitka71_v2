using Franchisee.Web.Models;

namespace Franchisee.Web.Services.Repositories
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
    }
}