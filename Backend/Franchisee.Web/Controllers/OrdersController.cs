using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Configuration;
using WebApplication1.Models;
using WebApplication1.Services;
using WebApplication1.Services.Repositories;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class OrdersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IOrderRepository _orderRepository;
        private readonly IPhotoService _photoService;
        private readonly ILogger<OrdersController> _logger;

        public OrdersController(
            ApplicationDbContext context,
            IOrderRepository orderRepository,
            IPhotoService photoService,
            ILogger<OrdersController> logger)
        {
            _context = context;
            _orderRepository = orderRepository;
            _photoService = photoService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<PagedResult<OrderResponseDto>>> GetOrders([FromQuery] OrderFilterRequest filter)
        {
            var userId = GetCurrentUserId();
            _logger.LogInformation("Получение заказов для пользователя {UserId}, фильтр: {@Filter}", userId, filter);

            var (orders, total) = await _orderRepository.GetFilteredOrdersAsync(filter, null);

            var responseDtos = orders.Select(MapToResponseDto).ToList();

            var paged = new PagedResult<OrderResponseDto>
            {
                Items = responseDtos,
                TotalCount = total,
                Page = filter.Page,
                PageSize = filter.PageSize
            };

            return Ok(paged);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<OrderResponseDto>> GetOrder(int id)
        {
            var userId = GetCurrentUserId();
            _logger.LogInformation("Получение заказа {OrderId} для пользователя {UserId}", id, userId);

            var order = await _orderRepository.GetByIdAsync(id);
            if (order == null) return NotFound($"Заказ с ID {id} не найден");

            var dto = MapToResponseDto(order);
            return Ok(dto);
        }

        [HttpPost]
        public async Task<ActionResult<OrderResponseDto>> CreateOrder([FromBody] CreateOrderRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            _logger.LogInformation("Создание заказа для пользователя {UserId}", userId);

            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // логирование
                _logger.LogInformation("Генерация номера заказа...");
                var orderNumber = await _orderRepository.GenerateOrderNumberAsync();
                _logger.LogInformation("Сгенерирован номер заказа: {OrderNumber}", orderNumber);

                var order = new Order
                {
                    OrderNumber = orderNumber,
                    Place = request.Place,
                    InspectionPlace = request.InspectionPlace ?? string.Empty,
                    OrderDate = request.OrderDate.ToUniversalTime(),
                    DeceasedFullName = request.DeceasedFullName,
                    CustomerFullName = request.CustomerFullName,
                    CustomerEmail = request.CustomerEmail,
                    Phone = request.Phone,
                    Address = request.Address,
                    MonumentType = request.MonumentType,
                    MonumentSize = request.MonumentSize,
                    AdditionalInfo = request.AdditionalInfo ?? string.Empty,
                    Status = OrderStatus.Новый,
                    ManagerId = userId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    WorkItems = request.WorkItems ?? new List<OrderWorkItem>(),
                    Payments = request.Payments ?? new List<OrderPayment>()
                };

                // Set FK
                foreach (var wi in order.WorkItems) wi.OrderId = 0;
                foreach (var p in order.Payments) p.OrderId = 0;

                _logger.LogInformation("Сохранение заказа в БД...");
                await _orderRepository.AddAsync(order);

                // Рассчеет TotalPrice
                order.TotalPrice = request.TotalPrice > 0 ? request.TotalPrice : order.WorkItems.Sum(w => w.Price * w.Quantity);
                await _orderRepository.UpdateAsync(order);

                _logger.LogInformation("Заказ сохранен с ID: {OrderId}, номером: {OrderNumber}", order.Id, order.OrderNumber);

                // Фото
                if (request.TempUploadIds?.Any() == true)
                {
                    var committedCount = await _photoService.CommitTempToOrderAsync(order.Id, request.TempUploadIds, userId);
                    _logger.LogInformation("Коммитнуто {Count} фото для заказа {OrderId}", committedCount, order.Id);
                }

                await transaction.CommitAsync();

                var dto = MapToResponseDto(order);
                _logger.LogInformation("Заказ успешно создан: {OrderId}, {OrderNumber}", order.Id, order.OrderNumber);

                return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, dto);
            }
            catch (DbUpdateException ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Ошибка БД при создании заказа для {UserId}", userId);
                return StatusCode(500, "Ошибка сохранения заказа");
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Неожиданная ошибка создания заказа для {UserId}", userId);
                return StatusCode(500, "Внутренняя ошибка");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<OrderResponseDto>> UpdateOrder(int id, [FromBody] UpdateOrderRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            _logger.LogInformation("Обновление заказа {OrderId} для {UserId}", id, userId);

            var order = await _orderRepository.GetByIdAsync(id);
            if (order == null) return NotFound();

            if (!IsAdmin() && order.ManagerId != userId) return Forbid();

            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                if (!string.IsNullOrEmpty(request.Place)) order.Place = request.Place;

                if (!string.IsNullOrEmpty(request.InspectionPlace))
                    order.InspectionPlace = request.InspectionPlace;

                if (request.OrderDate.HasValue)
                    order.OrderDate = request.OrderDate.Value;

                if (!string.IsNullOrEmpty(request.DeceasedFullName))
                    order.DeceasedFullName = request.DeceasedFullName;

                if (!string.IsNullOrEmpty(request.CustomerFullName))
                    order.CustomerFullName = request.CustomerFullName;

                if (!string.IsNullOrEmpty(request.CustomerEmail))
                    order.CustomerEmail = request.CustomerEmail;

                if (!string.IsNullOrEmpty(request.Phone))
                    order.Phone = request.Phone;

                if (!string.IsNullOrEmpty(request.Address))
                    order.Address = request.Address;

                if (!string.IsNullOrEmpty(request.MonumentType))
                    order.MonumentType = request.MonumentType;

                if (!string.IsNullOrEmpty(request.MonumentSize))
                    order.MonumentSize = request.MonumentSize;

                order.AdditionalInfo = request.AdditionalInfo ?? order.AdditionalInfo;

                if (request.Status.HasValue)
                    order.Status = request.Status.Value;

                order.UpdatedAt = DateTime.UtcNow;

                // WorkItems: full replace если provided
                if (request.WorkItems != null && request.WorkItems.Any())
                {
                    _context.RemoveRange(order.WorkItems);
                    order.WorkItems.Clear();
                    foreach (var wi in request.WorkItems)
                    {
                        wi.OrderId = id;
                        order.WorkItems.Add(wi);
                    }
                }

                // Аналогично для Payments
                if (request.Payments != null && request.Payments.Any())
                {
                    _context.RemoveRange(order.Payments);
                    order.Payments.Clear();
                    foreach (var payment in request.Payments)
                    {
                        payment.OrderId = id;
                        order.Payments.Add(payment);
                    }
                }

                await _orderRepository.UpdateAsync(order);

                // Новые фото
                if (request.TempUploadIds?.Any() == true)
                {
                    await _photoService.CommitTempToOrderAsync(id, request.TempUploadIds, userId);
                }

                await transaction.CommitAsync();

                var dto = MapToResponseDto(order);
                return Ok(dto);
            }
            catch (DbUpdateConcurrencyException ex) when (!OrderExists(id))
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Concurrency ошибка обновления {OrderId}", id);
                return NotFound();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Ошибка обновления заказа {OrderId}", id);
                return StatusCode(500, "Ошибка обновления");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteOrder(int id)
        {
            var userId = GetCurrentUserId();
            _logger.LogInformation("Удаление заказа {OrderId} для {UserId}", id, userId);

            var order = await _orderRepository.GetByIdAsync(id);
            if (order == null) return NotFound();

            if (!IsAdmin() && order.ManagerId != userId) return Forbid();

            await _orderRepository.SoftDeleteAsync(id);
            return NoContent();
        }

        [HttpPost("{id}/restore")]
        public async Task<IActionResult> RestoreOrder(int id)
        {
            var userId = GetCurrentUserId();
            _logger.LogInformation("Восстановление заказа {OrderId} для {UserId}", id, userId);

            try
            {
                // Ищем заказ ИГНОРИРУЯ фильтр IsDeleted
                var order = await _context.Orders
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(o => o.Id == id);

                if (order == null)
                {
                    _logger.LogWarning("Заказ {OrderId} не найден для восстановления", id);
                    return NotFound("Заказ не найден");
                }

                if (!order.IsDeleted)
                {
                    _logger.LogWarning("Заказ {OrderId} не был удален, восстановление не требуется", id);
                    return BadRequest("Заказ не был удален");
                }

                if (!IsAdmin() && order.ManagerId != userId)
                {
                    _logger.LogWarning("Пользователь {UserId} пытается восстановить чужой заказ {OrderId}", userId, id);
                    return Forbid("Недостаточно прав для восстановления заказа");
                }

                // ВОССТАНАВЛЕНИЕ ЗАКАЗА
                order.IsDeleted = false;
                order.DeletedAt = null;
                order.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _logger.LogInformation("Заказ {OrderId} успешно восстановлен пользователем {UserId}", id, userId);

                return Ok(new
                {
                    message = "Заказ восстановлен",
                    orderId = id
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка восстановления заказа {OrderId}", id);
                return StatusCode(500, "Ошибка восстановления заказа");
            }
        }

        #region Private Helpers

        private int GetCurrentUserId()
        {
            var userIdStr = User.FindFirst(ClaimTypes.Name)?.Value;
            return int.TryParse(userIdStr, out int id) ? id : throw new UnauthorizedAccessException("Неверный ID пользователя");
        }

        private bool IsAdmin() => User.IsInRole("Admin");

        private bool OrderExists(int id) => _context.Orders.Any(e => e.Id == id);

        private OrderResponseDto MapToResponseDto(Order order)
        {
            // Computed TotalPrice
            var total = order.TotalPrice > 0 ? order.TotalPrice : order.WorkItems.Sum(w => w.Price * w.Quantity);

            return new OrderResponseDto
            {
                Id = order.Id,
                OrderNumber = order.OrderNumber,
                Place = order.Place,
                InspectionPlace = order.InspectionPlace,
                OrderDate = order.OrderDate,
                DeceasedFullName = order.DeceasedFullName,
                CustomerFullName = order.CustomerFullName,
                CustomerEmail = order.CustomerEmail,
                Phone = order.Phone,
                Address = order.Address,
                MonumentType = order.MonumentType,
                MonumentSize = order.MonumentSize,
                AdditionalInfo = order.AdditionalInfo,
                Status = order.Status,
                TotalPrice = total,
                CreatedAt = order.CreatedAt,
                UpdatedAt = order.UpdatedAt,
                ManagerId = order.ManagerId,
                ManagerFullName = order.Manager?.FullName ?? string.Empty,
                WorkItems = order.WorkItems,
                Payments = order.Payments,
                Photos = order.Photos.Select(p => new OrderPhotoDto
                {
                    Id = p.Id,
                    Url = $"/api/photos/{p.Id}/file",
                    OriginalFileName = p.OriginalFileName,
                    Size = p.Size,
                    UploadedAt = p.UploadedAt,
                    Width = p.Width ?? 0,
                    Height = p.Height ?? 0
                }).ToList(),
                IsDeleted = order.IsDeleted,
                DeletedAt = order.DeletedAt
            };
        }

        // GET: api/Orders/archived - Получить архивные заказы
        // GET: api/Orders/archived - Получить архивные заказы
        [HttpGet("archived")]
        public async Task<ActionResult<PagedResult<OrderResponseDto>>> GetArchivedOrders([FromQuery] OrderFilterRequest filter)
        {
            var userId = GetCurrentUserId();
            _logger.LogInformation("Получение архивных заказов для пользователя {UserId}", userId);

            try
            {
                // ФИКС: Используем прямой запрос к БД с IgnoreQueryFilters
                var query = _context.Orders
                    .IgnoreQueryFilters()
                    .Where(o => o.IsDeleted)
                    .Include(o => o.WorkItems)
                    .Include(o => o.Payments)
                    .Include(o => o.Photos)
                    .Include(o => o.Manager)
                    .AsNoTracking();

                // Применяем фильтры
                if (!string.IsNullOrWhiteSpace(filter.SearchQuery))
                {
                    var search = filter.SearchQuery.ToLowerInvariant();
                    query = query.Where(o => o.OrderNumber.ToLower().Contains(search) ||
                                             o.CustomerFullName.ToLower().Contains(search) ||
                                             o.Phone.Contains(search) ||
                                             o.DeceasedFullName.ToLower().Contains(search));
                }

                var totalCount = await query.CountAsync();
                var orders = await query
                    .OrderByDescending(o => o.DeletedAt)
                    .Skip((filter.Page - 1) * filter.PageSize)
                    .Take(filter.PageSize)
                    .ToListAsync();

                var responseDtos = orders.Select(MapToResponseDto).ToList();

                var paged = new PagedResult<OrderResponseDto>
                {
                    Items = responseDtos,
                    TotalCount = totalCount,
                    Page = filter.Page,
                    PageSize = filter.PageSize
                };

                return Ok(paged);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения архивных заказов для {UserId}", userId);
                return StatusCode(500, "Ошибка получения архивных заказов");
            }
        }

        // DELETE: api/Orders/archived/{id} - Полностью удалить из архива
        [HttpDelete("archived/{id}")]
        public async Task<IActionResult> PermanentDeleteFromArchive(int id)
        {
            var userId = GetCurrentUserId();
            _logger.LogInformation("Полное удаление архивного заказа {OrderId} пользователем {UserId}", id, userId);

            try
            {
                // Ищем заказ в архиве
                var order = await _context.Orders
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(o => o.Id == id && o.IsDeleted);

                if (order == null)
                    return NotFound("Архивный заказ не найден");

                // Проверяем права (только админ или создатель заказа)
                if (!IsAdmin() && order.ManagerId != userId)
                    return Forbid("Недостаточно прав для полного удаления заказа");

                using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    // Удаляем фото и файлы
                    var photos = await _context.OrderPhotos
                        .Where(p => p.OrderId == id)
                        .ToListAsync();

                    foreach (var photo in photos)
                    {
                        if (System.IO.File.Exists(photo.FilePath))
                        {
                            await Task.Run(() => System.IO.File.Delete(photo.FilePath));
                        }
                        _context.OrderPhotos.Remove(photo);
                    }

                    // Удаляем work items
                    var workItems = await _context.OrderWorkItems
                        .Where(w => w.OrderId == id)
                        .ToListAsync();
                    _context.OrderWorkItems.RemoveRange(workItems);

                    // Удаляем payments
                    var payments = await _context.OrderPayments
                        .Where(p => p.OrderId == id)
                        .ToListAsync();
                    _context.OrderPayments.RemoveRange(payments);

                    // Удаляем сам заказ
                    _context.Orders.Remove(order);

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    _logger.LogInformation("Заказ {OrderId} полностью удален из архива пользователем {UserId}", id, userId);
                    return Ok(new { message = "Заказ полностью удален из архива" });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError(ex, "Ошибка полного удаления заказа {OrderId}", id);
                    return StatusCode(500, "Ошибка полного удаления заказа");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при попытке полного удаления заказа {OrderId}", id);
                return StatusCode(500, "Внутренняя ошибка");
            }
        }

        // GET: api/Orders/archived/{id} - Получить архивный заказ
        [HttpGet("archived/{id}")]
        public async Task<ActionResult<OrderResponseDto>> GetArchivedOrder(int id)
        {
            var userId = GetCurrentUserId();
            _logger.LogInformation("Получение архивного заказа {OrderId} для пользователя {UserId}", id, userId);

            try
            {
                var order = await _context.Orders
                    .IgnoreQueryFilters()
                    .Include(o => o.WorkItems)
                    .Include(o => o.Payments)
                    .Include(o => o.Photos)
                    .Include(o => o.Manager)
                    .FirstOrDefaultAsync(o => o.Id == id && o.IsDeleted);

                if (order == null)
                    return NotFound("Архивный заказ не найден");

                var dto = MapToResponseDto(order);
                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения архивного заказа {OrderId}", id);
                return StatusCode(500, "Ошибка получения заказа");
            }
        }

        #endregion
    }
    
}