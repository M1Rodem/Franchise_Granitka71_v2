using WebApplication1.Models;

namespace WebApplication1.Services.Repositories
{
    public interface IOrderRepository
    {
        Task<Order?> GetByIdAsync(int id);
        Task<IEnumerable<Order>> GetAllAsync(int? managerId = null);  // Optional filter для ролей
        Task<IEnumerable<Order>> GetByManagerAsync(int managerId);
        Task<(IEnumerable<Order> Orders, int TotalCount)> GetFilteredOrdersAsync(OrderFilterRequest filter, int? managerId = null);

        Task AddAsync(Order order);
        Task UpdateAsync(Order order);
        Task SoftDeleteAsync(int id);
        Task PermanentDeleteAsync(int id);
        Task<string> GenerateOrderNumberAsync();
        Task<bool> ExistsAsync(int id);
    }
}