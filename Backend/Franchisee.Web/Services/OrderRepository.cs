using Microsoft.EntityFrameworkCore;
using Franchisee.Web.Configuration;
using Franchisee.Web.Models;
using Franchisee.Web.Services.Repositories;

namespace Franchisee.Web.Services
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
                .Include(o => o.Plot)
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
                var pattern = $"%{filter.SearchQuery.Trim()}%";
                query = query.Where(o =>
                    EF.Functions.ILike(o.OrderNumber, pattern) ||
                    EF.Functions.ILike(o.CustomerFullName, pattern) ||
                    EF.Functions.ILike(o.Phone, pattern) ||
                    EF.Functions.ILike(o.DeceasedFullName, pattern) ||
                    EF.Functions.ILike(o.MonumentType, pattern) ||
                    (o.Manager != null && (
                        EF.Functions.ILike(o.Manager.FullName, pattern) ||
                        EF.Functions.ILike(o.Manager.Username, pattern)
                    )));
            }

            // Date-only filtering, inclusive by day for "To" via < next day.
            if (filter.OrderDateFrom.HasValue)
            {
                var orderDateFrom = ToUtcDateStart(filter.OrderDateFrom.Value);
                query = query.Where(o => o.OrderDate >= orderDateFrom);
            }
            if (filter.OrderDateTo.HasValue)
            {
                var orderDateToExclusive = ToUtcDateStart(filter.OrderDateTo.Value).AddDays(1);
                query = query.Where(o => o.OrderDate < orderDateToExclusive);
            }

            if (filter.CreatedFrom.HasValue)
            {
                var createdFrom = ToUtcDateStart(filter.CreatedFrom.Value);
                query = query.Where(o => o.CreatedAt >= createdFrom);
            }
            if (filter.CreatedTo.HasValue)
            {
                var createdToExclusive = ToUtcDateStart(filter.CreatedTo.Value).AddDays(1);
                query = query.Where(o => o.CreatedAt < createdToExclusive);
            }

            // По цене
            if (filter.MinPrice.HasValue)
                query = query.Where(o => o.TotalPrice >= filter.MinPrice.Value);
            if (filter.MaxPrice.HasValue)
                query = query.Where(o => o.TotalPrice <= filter.MaxPrice.Value);

            // Фильтр по менеджеру только если явно указан
            if (filter.ManagerId.HasValue)
                query = query.Where(o => o.ManagerId == filter.ManagerId.Value);
            if (filter.PlotId.HasValue)
                query = query.Where(o => o.PlotId == filter.PlotId.Value);

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
              .OrderByDescending(o => o.UpdatedAt)
              .Skip((filter.Page - 1) * filter.PageSize)
              .Take(filter.PageSize)
              .ToListAsync();

            return (orders, totalCount);
        }

        public async Task AddAsync(Order order)
        {
            RecalculateTotalPrice(order);

            _context.Orders.Add(order);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(Order order)
        {
            // ЗАГРУЖАЕМ заказ ВМЕСТЕ с WorkItems и Payments
            var existingOrder = await _context.Orders
                .Include(o => o.WorkItems)
                .Include(o => o.Payments)
                .Include(o => o.Manager)
                .FirstOrDefaultAsync(o => o.Id == order.Id);

            if (existingOrder != null)
            {
                // Сохраняем оригинального менеджера
                var originalManager = existingOrder.Manager;
                var originalManagerId = existingOrder.ManagerId;

                // ОБНОВЛЯЕМ ТОЛЬКО ОСНОВНЫЕ ПОЛЯ, НЕ КОЛЛЕКЦИИ:
                existingOrder.Place = order.Place;
                existingOrder.InspectionPlace = order.InspectionPlace;
                existingOrder.OrderDate = order.OrderDate;
                existingOrder.DeceasedFullName = order.DeceasedFullName;
                existingOrder.CustomerFullName = order.CustomerFullName;
                existingOrder.CustomerEmail = order.CustomerEmail;
                existingOrder.Phone = order.Phone;
                existingOrder.Address = order.Address;
                existingOrder.MonumentType = order.MonumentType;
                existingOrder.MonumentSize = order.MonumentSize;
                existingOrder.AdditionalInfo = order.AdditionalInfo;
                existingOrder.Status = order.Status;
                existingOrder.UpdatedAt = DateTime.UtcNow;

                // Пересчет итоговой суммы на основе актуальных WorkItems
                // Используем WorkItems из переданного order, так как они уже обновлены в контроллере
                if (order.WorkItems != null)
                {
                    existingOrder.WorkItems = order.WorkItems;
                    RecalculateTotalPrice(existingOrder);
                }

                // ВОССТАНАВЛИВАЕМ менеджера (не меняем его)
                existingOrder.Manager = originalManager;
                existingOrder.ManagerId = originalManagerId;

                // Payments обрабатываются отдельно в контроллере, здесь не трогаем

                await _context.SaveChangesAsync();
            }
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
        private IQueryable<Order> ApplyPaymentStatusFilter(IQueryable<Order> query, PaymentStatus status)
        {
            if (status == PaymentStatus.All)
                return query;

            return status switch
            {
                PaymentStatus.Advance => query.Where(o =>
                    o.Payments.Sum(p => p.Amount) > 0
                    && o.Payments.Sum(p => p.Amount) <= o.TotalPrice * 0.3m
                ),

                PaymentStatus.PartiallyPaid => query.Where(o =>
                    o.Payments.Sum(p => p.Amount) > o.TotalPrice * 0.3m
                    && o.Payments.Sum(p => p.Amount) < o.TotalPrice
                ),

                PaymentStatus.FullyPaid => query.Where(o =>
                    o.Payments.Sum(p => p.Amount) >= o.TotalPrice
                    && o.TotalPrice > 0
                ),

                _ => query
            };
        }

        private void RecalculateTotalPrice(Order order)
        {
            if (order.WorkItems != null && order.WorkItems.Any())
            {
                order.TotalPrice = order.WorkItems.Sum(w => w.Price * w.Quantity);
            }
            else
            {
                order.TotalPrice = 0;
            }
        }

        public async Task<string> GenerateOrderNumberAsync()
        {
            try
            {
                // ИСПРАВЛЕНИЕ: Ищем ВСЕ заказы (включая архивные) чтобы избежать дублирования номеров
                var maxId = await _context.Orders
                    .IgnoreQueryFilters() // ВАЖНО: игнорируем фильтр мягкого удаления
                    .MaxAsync(o => (int?)o.Id) ?? 0;

                // Следующий ID
                var nextId = maxId + 1;

                // Формат только ORD-00001, ORD-00002 без даты
                var orderNumber = $"ORD-{nextId:00000}";

                return orderNumber;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"GenerateOrderNumberAsync error: {ex.Message}");
                throw;
            }
        }

        public async Task<string> GetOriginalOrderNumberAsync(int orderId)
        {
            var originalOrder = await _context.Orders
                .IgnoreQueryFilters()
                .Where(o => o.Id == orderId)
                .Select(o => o.OrderNumber)
                .FirstOrDefaultAsync();

            return originalOrder ?? await GenerateOrderNumberAsync();
        }

        private static DateTime ToUtcDateStart(DateTime value)
        {
            var dateOnly = value.Date;
            return dateOnly.Kind == DateTimeKind.Utc
                ? dateOnly
                : DateTime.SpecifyKind(dateOnly, DateTimeKind.Utc);
        }
    }
}
