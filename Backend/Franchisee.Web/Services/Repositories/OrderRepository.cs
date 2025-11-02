// 🔥 ЗАМЕНИТЕ ВЕСЬ OrderRepository.cs на этот код:

using Microsoft.EntityFrameworkCore;
using WebApplication1.Configuration;
using WebApplication1.Models;

namespace WebApplication1.Services.Repositories
{
    public class OrderRepository : IOrderRepository
    {
        private readonly ApplicationDbContext _context;

        public OrderRepository(ApplicationDbContext context)
        {
            _context = context;
        }
        private IQueryable<Order> BaseQuery()
        {
            return _context.Orders
                .Where(o => !o.IsDeleted)
                .Include(o => o.WorkItems)
                .Include(o => o.Payments)
                .Include(o => o.Photos)
                .Include(o => o.Manager)
                .AsNoTracking();
        }

        public async Task<bool> ExistsAsync(int id)
        {
            return await _context.Orders.AnyAsync(o => o.Id == id);
        }

        public async Task<Order?> GetByIdAsync(int id)
        {
            return await BaseQuery().FirstOrDefaultAsync(o => o.Id == id);
        }
        public async Task<IEnumerable<Order>> GetAllAsync(int? managerId = null)
        {
            return await BaseQuery().OrderByDescending(o => o.CreatedAt).ToListAsync();
        }
        public async Task<IEnumerable<Order>> GetByManagerAsync(int managerId)
        {
            return await BaseQuery().OrderByDescending(o => o.CreatedAt).ToListAsync();
        }
        public async Task<(IEnumerable<Order> Orders, int TotalCount)> GetFilteredOrdersAsync(OrderFilterRequest filter, int? managerId = null)
        {
            var query = BaseQuery().AsQueryable();

            // Поиск
            if (!string.IsNullOrWhiteSpace(filter.SearchQuery))
            {
                var search = filter.SearchQuery.ToLowerInvariant();
                query = query.Where(o => o.OrderNumber.ToLower().Contains(search) ||
                                         o.CustomerFullName.ToLower().Contains(search) ||
                                         o.Phone.Contains(search) ||
                                         o.DeceasedFullName.ToLower().Contains(search) ||
                                         o.MonumentType.ToLower().Contains(search));
            }

            // Фильтры по датам
            if (filter.CreatedFrom.HasValue)
                query = query.Where(o => o.CreatedAt >= filter.CreatedFrom.Value);
            if (filter.CreatedTo.HasValue)
                query = query.Where(o => o.CreatedAt <= filter.CreatedTo.Value);

            // По цене
            if (filter.MinPrice.HasValue)
                query = query.Where(o => o.TotalPrice >= filter.MinPrice.Value);
            if (filter.MaxPrice.HasValue)
                query = query.Where(o => o.TotalPrice <= filter.MaxPrice.Value);

            // Фильтр по менеджеру только если явно указан
            if (filter.ManagerId.HasValue)
                query = query.Where(o => o.ManagerId == filter.ManagerId.Value);

            // По клиенту/телефону
            if (!string.IsNullOrEmpty(filter.CustomerName))
                query = query.Where(o => o.CustomerFullName.Contains(filter.CustomerName));
            if (!string.IsNullOrEmpty(filter.Phone))
                query = query.Where(o => o.Phone.Contains(filter.Phone));

            // По статусу оплаты
            if (filter.PaymentStatus.HasValue && filter.PaymentStatus != PaymentStatus.All)
                query = ApplyPaymentStatusFilter(query, filter.PaymentStatus.Value);

            // По статусу заказа
            if (filter.Status.HasValue)
                query = query.Where(o => o.Status == filter.Status.Value);

            // Пагинация
            var totalCount = await query.CountAsync();
            var orders = await query
                .OrderByDescending(o => o.CreatedAt)
                .Skip((filter.Page - 1) * filter.PageSize)
                .Take(filter.PageSize)
                .ToListAsync();

            return (orders, totalCount);
        }

        public async Task AddAsync(Order order)
        {
            _context.Orders.Add(order);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(Order order)
        {
            _context.Orders.Update(order);
            await _context.SaveChangesAsync();
        }

        public async Task SoftDeleteAsync(int id)
        {
            var order = await _context.Orders.FindAsync(id);
            if (order != null)
            {
                order.IsDeleted = true;
                order.DeletedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }

        public async Task PermanentDeleteAsync(int id)
        {
            var order = await _context.Orders.FindAsync(id);
            if (order != null)
            {
                _context.Orders.Remove(order);
                await _context.SaveChangesAsync();
            }
        }

        // Приват: фильтр по оплате
        private IQueryable<Order> ApplyPaymentStatusFilter(IQueryable<Order> query, PaymentStatus status)
        {
            return status switch
            {
                PaymentStatus.NotPaid => query.Where(o => !o.Payments.Any()),
                PaymentStatus.Partial => query.Where(o => o.Payments.Sum(p => p.Amount) > 0 && o.Payments.Sum(p => p.Amount) < o.TotalPrice),
                PaymentStatus.Paid => query.Where(o => o.Payments.Sum(p => p.Amount) == o.TotalPrice),
                PaymentStatus.Overpaid => query.Where(o => o.Payments.Sum(p => p.Amount) > o.TotalPrice),
                _ => query
            };
        }

        public async Task<string> GenerateOrderNumberAsync()
        {
            try
            {
                var lastOrder = await _context.Orders
                    .Where(o => !o.IsDeleted)
                    .OrderByDescending(o => o.Id)
                    .FirstOrDefaultAsync();

                var nextId = (lastOrder?.Id ?? 0) + 1;
                var orderNumber = $"ORD-{nextId:00000}-{DateTime.UtcNow:yyyyMMdd}";

                return orderNumber;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"GenerateOrderNumberAsync error: {ex.Message}");
                throw;
            }
        }
    }
}