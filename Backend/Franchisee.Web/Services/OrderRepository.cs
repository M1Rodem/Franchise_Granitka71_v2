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
                .Include(o => o.Manager) // ДОБАВЛЯЕМ ПРОЕКЦИЮ
                .Select(o => new Order
                {
                    Id = o.Id,
                    OrderNumber = o.OrderNumber,
                    Place = o.Place,
                    InspectionPlace = o.InspectionPlace,
                    OrderDate = o.OrderDate,
                    DeceasedFullName = o.DeceasedFullName,
                    CustomerFullName = o.CustomerFullName,
                    CustomerEmail = o.CustomerEmail,
                    Phone = o.Phone,
                    Address = o.Address,
                    MonumentType = o.MonumentType,
                    MonumentSize = o.MonumentSize,
                    AdditionalInfo = o.AdditionalInfo,
                    Status = o.Status,
                    TotalPrice = o.TotalPrice,
                    CreatedAt = o.CreatedAt,
                    UpdatedAt = o.UpdatedAt,
                    ManagerId = o.ManagerId,
                    Manager = o.Manager == null ? null : new Manager // ПРОЕКЦИЯ МЕНЕДЖЕРА
                    {
                        FullName = o.Manager.FullName,
                    },
                    WorkItems = o.WorkItems,
                    Payments = o.Payments,
                    Photos = o.Photos,
                    IsDeleted = o.IsDeleted,
                    DeletedAt = o.DeletedAt,
                    IsArchived = o.IsArchived
                })
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

            // Фильтры по дате создания
            if (filter.OrderDateFrom.HasValue)
                query = query.Where(o => o.OrderDate >= filter.OrderDateFrom.Value.ToUniversalTime());
            if (filter.OrderDateTo.HasValue)
                query = query.Where(o => o.OrderDate <= filter.OrderDateTo.Value.ToUniversalTime());

            // Также исправьте фильтры по дате создания:
            if (filter.CreatedFrom.HasValue)
                query = query.Where(o => o.CreatedAt >= filter.CreatedFrom.Value.ToUniversalTime());
            if (filter.CreatedTo.HasValue)
                query = query.Where(o => o.CreatedAt <= filter.CreatedTo.Value.ToUniversalTime());

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
              .OrderByDescending(o => o.UpdatedAt)
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
            // ЗАГРУЖАЕМ заказ ВМЕСТЕ с WorkItems и Payments
            var existingOrder = await _context.Orders
                .Include(o => o.WorkItems)    // ← ДОБАВИТЬ эту строку
                .Include(o => o.Payments)     // ← ДОБАВИТЬ эту строку
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
                existingOrder.TotalPrice = order.TotalPrice;
                existingOrder.UpdatedAt = DateTime.UtcNow;

                // ВОССТАНАВЛИВАЕМ менеджера (не меняем его)
                existingOrder.Manager = originalManager;
                existingOrder.ManagerId = originalManagerId;

                // НЕ трогаем WorkItems, Payments, Photos - они уже обработаны в контроллере

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
            return status switch
            {
                PaymentStatus.NotPaid => query.Where(o => o.Payments.Sum(p => p.Amount) == 0),
                PaymentStatus.Partial => query.Where(o => o.Payments.Sum(p => p.Amount) > 0
                                                       && o.Payments.Sum(p => p.Amount) < o.WorkItems.Sum(w => w.Price * w.Quantity)),
                PaymentStatus.Paid => query.Where(o => o.Payments.Sum(p => p.Amount) == o.WorkItems.Sum(w => w.Price * w.Quantity) // ИСПРАВЛЕНО: == вместо >=
                                                        && o.WorkItems.Sum(w => w.Price * w.Quantity) > 0),
                PaymentStatus.Overpaid => query.Where(o => o.Payments.Sum(p => p.Amount) > o.WorkItems.Sum(w => w.Price * w.Quantity)),
                _ => query
            };
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
    }
}