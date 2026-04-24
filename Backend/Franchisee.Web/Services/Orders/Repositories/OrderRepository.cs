using Microsoft.EntityFrameworkCore;
using Franchisee.Web.Configuration;
using Franchisee.Web.Models.Entities.Plots;
using Franchisee.Web.Models.Entities.Orders;
using Franchisee.Web.Models.DTOs.Orders;
using Franchisee.Web.Models.Requests.Orders;
using Franchisee.Web.Models.Entities.Users;

namespace Franchisee.Web.Services.Orders.Repositories
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
                .AsSplitQuery()
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
            var query = _context.Orders
                .Where(o => !o.IsDeleted)
                .AsNoTracking()
                .AsQueryable();

            // Поиск
            if (!string.IsNullOrWhiteSpace(filter.SearchQuery))
            {
                var search = filter.SearchQuery.Trim();

                query = query.Where(o =>
                    o.OrderNumber.StartsWith(search) ||
                    o.Phone.StartsWith(search) ||
                    EF.Functions.ILike(o.CustomerFullName, $"%{search}%") ||
                    EF.Functions.ILike(o.DeceasedFullName, $"%{search}%") ||
                    (o.Manager != null && (
                        EF.Functions.ILike(o.Manager.FullName, $"%{search}%") ||
                        EF.Functions.ILike(o.Manager.Username, $"%{search}%")
                    ))
                );
            }

            if (filter.PlotId.HasValue)
            {
                query = query.Where(o => o.PlotId == filter.PlotId.Value);
            }

            // Фильтр по дате заказа
            if (filter.OrderDateFrom.HasValue)
            {
                var fromUtc = ToUtcDateStartLocal(filter.OrderDateFrom.Value);
                query = query.Where(o => o.OrderDate >= fromUtc);
            }

            if (filter.OrderDateTo.HasValue)
            {
                var toUtc = ToUtcDateEndLocal(filter.OrderDateTo.Value);
                query = query.Where(o => o.OrderDate < toUtc);
            }

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
                .Select(o => new Order
                {
                    Id = o.Id,
                    OrderNumber = o.OrderNumber,
                    Place = o.Place,
                    OrderDate = o.OrderDate,
                    InspectionPlace = o.InspectionPlace,
                    Latitude = o.Latitude,
                    Longitude = o.Longitude,
                    PlotId = o.PlotId,
                    Plot = o.Plot == null ? null : new Plot
                    {
                        Id = o.Plot.Id,
                        Name = o.Plot.Name
                    },

                    DeceasedFullName = o.DeceasedFullName,
                    CustomerFullName = o.CustomerFullName,
                    CustomerEmail = o.CustomerEmail,
                    Phone = o.Phone,
                    Address = o.Address,
                    MonumentType = o.MonumentType,
                    MonumentSize = o.MonumentSize,
                    AdditionalInfo = o.AdditionalInfo,

                    Status = o.Status,

                    CreatedAt = o.CreatedAt,
                    UpdatedAt = o.UpdatedAt,

                    ManagerId = o.ManagerId,
                    Manager = o.Manager == null ? null : new Manager
                    {
                        Id = o.Manager.Id,
                        FullName = o.Manager.FullName
                    },

                    WorkItems = o.WorkItems.Select(w => new OrderWorkItem
                    {
                        Id = w.Id,
                        WorkDescription = w.WorkDescription,
                        Price = w.Price,
                        Quantity = w.Quantity,
                        Routes = w.Routes,
                        DistanceKm = w.DistanceKm,
                        Note = w.Note
                    }).ToList(),

                    Payments = o.Payments.Select(p => new OrderPayment
                    {
                        Id = p.Id,
                        Amount = p.Amount,
                        PaymentDate = p.PaymentDate,
                        PaymentType = p.PaymentType,
                        Note = p.Note
                    }).ToList(),

                    Photos = o.Photos.Select(p => new OrderMedia
                    {
                        Id = p.Id,
                        OriginalFileName = p.OriginalFileName,
                        Size = p.Size,
                        UploadedAt = p.UploadedAt,
                        Width = p.Width,
                        Height = p.Height,
                        MediaType = p.MediaType
                    }).ToList()
                })
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

            var queryWithPaid = query.Select(o => new
            {
                Order = o,
                Paid = o.Payments.Sum(p => p.Amount)
            });

            return status switch
            {
                PaymentStatus.Advance =>
                     queryWithPaid
                         .Where(x => x.Paid <= x.Order.TotalPrice * 0.3m)
                         .Select(x => x.Order),

                PaymentStatus.PartiallyPaid =>
                    queryWithPaid
                        .Where(x => x.Paid > x.Order.TotalPrice * 0.3m && x.Paid < x.Order.TotalPrice)
                        .Select(x => x.Order),

                PaymentStatus.FullyPaid =>
                    queryWithPaid
                        .Where(x => x.Paid >= x.Order.TotalPrice && x.Order.TotalPrice > 0)
                        .Select(x => x.Order),

                _ => query
            };
        }

        private static DateTime ToUtcDateStartLocal(DateTime date)
        {
            var local = DateTime.SpecifyKind(date.Date, DateTimeKind.Local);
            return local.ToUniversalTime();
        }

        private static DateTime ToUtcDateEndLocal(DateTime date)
        {
            var local = DateTime.SpecifyKind(date.Date.AddDays(1), DateTimeKind.Local);
            return local.ToUniversalTime();
        }

        public async Task<(IEnumerable<OrdersListItemDto> Orders, int TotalCount)>
        GetArchivedOrdersListAsync(OrderFilterRequest filter)
        {
            var query = _context.Orders
                .IgnoreQueryFilters()
                .Where(o => o.IsDeleted)
                .Include(o => o.Plot)
                .Include(o => o.Manager)
                .Include(o => o.Payments)
                .AsQueryable();

            // Поиск
            if (!string.IsNullOrWhiteSpace(filter.SearchQuery))
            {
                var pattern = $"%{filter.SearchQuery.Trim()}%";

                query = query.Where(o =>
                    EF.Functions.ILike(o.OrderNumber, pattern) ||
                    EF.Functions.ILike(o.CustomerFullName, pattern) ||
                    EF.Functions.ILike(o.Phone, pattern) ||
                    EF.Functions.ILike(o.DeceasedFullName, pattern) ||
                    (o.Manager != null && (
                        EF.Functions.ILike(o.Manager.FullName, pattern) ||
                        EF.Functions.ILike(o.Manager.Username, pattern)
                    ))
                );
            }

            // Фильтр по участку
            if (filter.PlotId.HasValue)
            {
                query = query.Where(o => o.PlotId == filter.PlotId.Value);
            }

            // Фильтр по дате заказа
            if (filter.OrderDateFrom.HasValue)
            {
                var fromUtc = ToUtcDateStartLocal(filter.OrderDateFrom.Value);
                query = query.Where(o => o.OrderDate >= fromUtc);
            }

            if (filter.OrderDateTo.HasValue)
            {
                var toUtc = ToUtcDateEndLocal(filter.OrderDateTo.Value);
                query = query.Where(o => o.OrderDate < toUtc);
            }

            // Фильтр по статусу оплаты
            if (filter.PaymentStatus.HasValue && filter.PaymentStatus != PaymentStatus.All)
            {
                query = ApplyPaymentStatusFilter(query, filter.PaymentStatus.Value);
            }

            // Фильтр по статусу заказа
            if (filter.Status.HasValue)
            {
                query = query.Where(o => o.Status == filter.Status.Value);
            }

            var totalCount = await query.CountAsync();

            var orders = await query
                .OrderByDescending(o => o.DeletedAt)
                .Skip((filter.Page - 1) * filter.PageSize)
                .Take(filter.PageSize)
                .Select(o => new OrdersListItemDto
                {
                    Id = o.Id,
                    OrderNumber = o.OrderNumber,
                    CustomerFullName = o.CustomerFullName,
                    Phone = o.Phone,
                    OrderDate = o.OrderDate,
                    Status = o.Status,

                    PlotName = o.Plot != null ? o.Plot.Name : null,

                    ManagerFullName = o.Manager != null
                        ? o.Manager.FullName
                        : string.Empty,

                    DeletedAt = o.DeletedAt,

                    PaymentStatus = CalculatePaymentStatus(
                        o.TotalPrice,
                        o.Payments.Sum(p => p.Amount)
                    )
                })
                .AsNoTracking()
                .ToListAsync();

            return (orders, totalCount);
        }

        public async Task<(IEnumerable<OrdersListItemDto> Orders, int TotalCount)>
        GetOrdersListAsync(OrderFilterRequest filter)
        {
            var query = _context.Orders
                .Where(o => !o.IsDeleted)
                .Include(o => o.Plot)
                .Include(o => o.Manager)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(filter.SearchQuery))
            {
                var pattern = $"%{filter.SearchQuery.Trim()}%";

                query = query.Where(o =>
                    EF.Functions.ILike(o.OrderNumber, pattern) ||
                    EF.Functions.ILike(o.CustomerFullName, pattern) ||
                    EF.Functions.ILike(o.Phone, pattern) ||
                    EF.Functions.ILike(o.DeceasedFullName, pattern) ||
                    EF.Functions.ILike(o.Manager!.FullName, pattern) ||
                    EF.Functions.ILike(o.Manager!.Username, pattern)
                );
            }

            if (filter.PlotId.HasValue)
            {
                query = query.Where(o => o.PlotId == filter.PlotId.Value);
            }

            if (filter.OrderDateFrom.HasValue)
            {
                var fromUtc = ToUtcDateStartLocal(filter.OrderDateFrom.Value);
                query = query.Where(o => o.OrderDate >= fromUtc);
            }

            if (filter.OrderDateTo.HasValue)
            {
                var toUtc = ToUtcDateEndLocal(filter.OrderDateTo.Value);
                query = query.Where(o => o.OrderDate < toUtc);
            }

            if (filter.PaymentStatus.HasValue && filter.PaymentStatus != PaymentStatus.All)
            {
                query = ApplyPaymentStatusFilter(query, filter.PaymentStatus.Value);
            }

            var totalCount = await query.CountAsync();

            var orders = await query
                .OrderByDescending(o => o.UpdatedAt)
                .Skip((filter.Page - 1) * filter.PageSize)
                .Take(filter.PageSize)
                .Select(o => new OrdersListItemDto
                {
                    Id = o.Id,
                    OrderNumber = o.OrderNumber,
                    CustomerFullName = o.CustomerFullName,
                    Phone = o.Phone,
                    OrderDate = o.OrderDate,
                    Status = o.Status,

                    PlotName = o.Plot != null ? o.Plot.Name : null,

                    ManagerFullName = o.Manager != null
                        ? o.Manager.FullName
                        : string.Empty,

                    PaymentStatus = CalculatePaymentStatus(
                        o.TotalPrice,
                        o.Payments.Sum(p => p.Amount)
                    )
                })
                .AsNoTracking()
                .ToListAsync();

            return (orders, totalCount);
        }

        public async Task<string> GenerateOrderNumberAsync()
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // Блокировка строки
                var counter = await _context.OrderCounters
                    .FromSqlRaw("SELECT * FROM \"OrderCounters\" WHERE \"Id\" = 1 FOR UPDATE")
                    .FirstOrDefaultAsync();

                if (counter == null)
                {
                    var maxOrderNumber = await _context.Orders
                        .IgnoreQueryFilters()
                        .MaxAsync(o => o.OrderNumber);

                    var lastNumber = 0;
                    if (!string.IsNullOrEmpty(maxOrderNumber))
                    {
                        var parts = maxOrderNumber.Split('-');
                        if (parts.Length == 2 && int.TryParse(parts[1], out var num))
                        {
                            lastNumber = num;
                        }
                    }

                    counter = new OrderCounter { Id = 1, LastNumber = lastNumber };
                    _context.OrderCounters.Add(counter);
                    await _context.SaveChangesAsync();
                }

                counter.LastNumber++;
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return $"ORD-{counter.LastNumber:00000}";
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
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
        public static PaymentStatus CalculatePaymentStatus(decimal totalPrice, decimal paid)
        {
            if (totalPrice <= 0)
                return PaymentStatus.Advance;

            var percent = paid / totalPrice;

            if (percent <= 0.3m)
                return PaymentStatus.Advance;

            if (percent < 1m)
                return PaymentStatus.PartiallyPaid;

            return PaymentStatus.FullyPaid;
        }
    }
}
