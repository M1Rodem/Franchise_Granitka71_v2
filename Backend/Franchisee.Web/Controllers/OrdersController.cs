using DocumentFormat.OpenXml.Wordprocessing;
using Franchisee.Web.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Franchisee.Web.Models.Entities.Orders;
using Franchisee.Web.Models.DTOs.Orders;
using Franchisee.Web.Models.Requests.Orders;
using Franchisee.Web.Services.Notifications.Core;
using Franchisee.Web.Services.Orders.Repositories;
using Franchisee.Web.Services.Media.Core;
using Franchisee.Web.Services.Plots.Repositories;


namespace Franchisee.Web.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class OrdersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IOrderRepository _orderRepository;
        private readonly IMediaService _mediaService; // Изменено с IPhotoService
        private readonly INotificationService _notificationService;
        private readonly ILogger<OrdersController> _logger;
        private readonly IPlotRepository _plotRepository; // Новая зависимость
        private readonly IWebHostEnvironment _env;

        public OrdersController(
            ApplicationDbContext context,
            IOrderRepository orderRepository,
            IMediaService mediaService,
            INotificationService notificationService,
            ILogger<OrdersController> logger,
            IPlotRepository plotRepository,
            IWebHostEnvironment env) // ← Добавь этот параметр
        {
            _context = context;
            _orderRepository = orderRepository;
            _mediaService = mediaService;
            _notificationService = notificationService;
            _logger = logger;
            _plotRepository = plotRepository;
            _env = env; // ← Добавь эту строку
        }

        [HttpGet]
        public async Task<ActionResult<PagedResult<OrderResponseDto>>> GetOrders([FromQuery] OrderFilterRequest filter)
        {
            var userId = GetCurrentUserId();
            _logger.LogInformation("QueryString GET /api/orders: {QueryString}", Request.QueryString.Value);
            _logger.LogInformation("Получение заказов для пользователя {UserId}, фильтр: {@Filter}", userId, filter);

            var (orders, total) = await _orderRepository.GetFilteredOrdersAsync(filter, null);

            var responseDtos = orders
            .Select(MapToResponseDto)
            .ToList();

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

        [HttpGet("list")]
        public async Task<ActionResult<PagedResult<OrdersListItemDto>>> GetOrdersList([FromQuery] OrderFilterRequest filter)
        {
            var userId = GetCurrentUserId();

            _logger.LogInformation("Получение списка заказов (light) для пользователя {UserId}", userId);

            var (items, total) = await _orderRepository.GetOrdersListAsync(filter);

            var paged = new PagedResult<OrdersListItemDto>
            {
                Items = items,
                TotalCount = total,
                Page = filter.Page,
                PageSize = filter.PageSize
            };

            return Ok(paged);
        }

        [HttpGet("archived/list")]
        public async Task<ActionResult<PagedResult<OrdersListItemDto>>> GetArchivedOrdersList(
        [FromQuery] OrderFilterRequest filter)
        {
            var userId = GetCurrentUserId();

            _logger.LogInformation(
                "Получение списка архивных заказов (light) для пользователя {UserId}",
                userId);

            var (items, total) = await _orderRepository.GetArchivedOrdersListAsync(filter);

            var paged = new PagedResult<OrdersListItemDto>
            {
                Items = items,
                TotalCount = total,
                Page = filter.Page,
                PageSize = filter.PageSize
            };

            return Ok(paged);
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
                _logger.LogInformation("Генерация номера заказа...");
                var orderNumber = await _orderRepository.GenerateOrderNumberAsync();
                _logger.LogInformation("Сгенерирован номер заказа: {OrderNumber}", orderNumber);

                // 1. Нормализация телефона
                var normalizedPhone = NormalizePhone(request.Phone);

                var order = new Order
                {
                    OrderNumber = orderNumber,
                    Place = request.Place,
                    DiscountPercent = request.DiscountPercent,
                    InspectionPlace = request.InspectionPlace ?? string.Empty,
                    OrderDate = request.OrderDate.ToUniversalTime(),

                    // Новые поля для геоданных
                    Latitude = request.Latitude,
                    Longitude = request.Longitude,
                    PlotId = request.PlotId,

                    DeceasedFullName = request.DeceasedFullName,
                    CustomerFullName = request.CustomerFullName,
                    CustomerEmail = request.CustomerEmail,
                    Phone = normalizedPhone,
                    Address = request.Address,
                    MonumentType = request.MonumentType,
                    MonumentSize = request.MonumentSize,
                    AdditionalInfo = request.AdditionalInfo ?? string.Empty,
                    Status = OrderStatus.Новый,
                    ManagerId = userId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    WorkItems = request.WorkItems?.Select(w => new OrderWorkItem
                    {
                        WorkDescription = w.WorkDescription,
                        Price = w.Price,
                        Quantity = w.Quantity,
                        Note = w.Note,
                        DistanceKm = w.DistanceKm
                    }).ToList() ?? new List<OrderWorkItem>(),

                    Payments = request.Payments?.Select(p => new OrderPayment
                    {
                        Amount = p.Amount,
                        PaymentDate = p.PaymentDate,
                        PaymentType = p.PaymentType,
                        Note = p.Note ?? string.Empty
                    }).ToList() ?? new List<OrderPayment>()
                };

                order.RecalculateTotals();

                // ИСПРАВЛЕНИЕ: НЕ вызываем CalculateAndAddDistanceWorkItem
                // Расстояние приходит с фронта в request.WorkItems
                // Бэк НЕ ДОЛЖЕН пересчитывать расстояние!

                // Set FK
                foreach (var wi in order.WorkItems)
                {
                    wi.OrderId = 0;
                }

                foreach (var p in order.Payments)
                {
                    p.OrderId = 0;
                    p.PaymentDate = DateTime.SpecifyKind(p.PaymentDate, DateTimeKind.Utc);
                }

                _logger.LogInformation("Сохранение заказа в БД...");

                await _orderRepository.AddAsync(order);

                order = await _context.Orders
                    .Include(o => o.WorkItems)
                    .Include(o => o.Payments)
                    .Include(o => o.Photos)
                    .Include(o => o.Manager)
                    .Include(o => o.Plot)
                    .AsSplitQuery()
                    .AsNoTracking()
                    .FirstAsync(o => o.Id == order.Id);

                _logger.LogInformation("Заказ сохранен с ID: {OrderId}, номером: {OrderNumber}", order.Id, order.OrderNumber);

                // 3. Фото
                if (request.TempPhotoIds?.Any() == true)
                {
                    var committedCount = await _mediaService.CommitTempToOrderAsync(
                        order.Id, request.TempPhotoIds, userId, MediaType.Photo);
                    _logger.LogInformation("Коммитнуто {Count} фото для заказа {OrderId}", committedCount, order.Id);
                }

                // 4. Видео (новое)
                if (request.TempVideoIds?.Any() == true)
                {
                    var committedCount = await _mediaService.CommitTempToOrderAsync(
                        order.Id, request.TempVideoIds, userId, MediaType.Video);
                    _logger.LogInformation("Коммитнуто {Count} видео для заказа {OrderId}", committedCount, order.Id);
                }

                await transaction.CommitAsync();

                // Перезагружаем заказ с медиа
                var fullOrder = await _context.Orders
                    .Include(o => o.WorkItems)
                    .Include(o => o.Payments)
                    .Include(o => o.Photos)
                    .Include(o => o.Manager)
                    .Include(o => o.Plot)
                    .FirstOrDefaultAsync(o => o.Id == order.Id);

                var dto = MapToResponseDto(fullOrder ?? order);
                _logger.LogInformation("Заказ успешно создан: {OrderId}, {OrderNumber}", order.Id, order.OrderNumber);

                return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, dto);
            }
            catch (DbUpdateException ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Ошибка БД при создании заказа для {UserId}", userId);
                return StatusCode(500, "Ошибка сохранения заказа");
            }
            catch (ArgumentException ex) when (ex.Message.Contains("Phone"))
            {
                await transaction.RollbackAsync();
                _logger.LogWarning("Неверный формат телефона: {Phone}", request.Phone);
                return BadRequest(new { message = "Неверный формат телефона" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Неожиданная ошибка создания заказа для {UserId}", userId);
                return StatusCode(500, "Внутренняя ошибка");
            }
        }

        // Добавляю вспомогательные методы
        private string NormalizePhone(string phone)
        {
            if (string.IsNullOrWhiteSpace(phone))
                throw new ArgumentException("Телефон обязателен");

            // Удаляем все нецифровые символы
            var digits = Regex.Replace(phone, @"\D", "");

            // Заменяем ведущую 8 на 7
            if (digits.StartsWith("8") && digits.Length == 11)
                digits = "7" + digits.Substring(1);

            // Проверяем формат (должно быть 11 цифр, начинаться с 7)
            if (!Regex.IsMatch(digits, @"^7\d{10}$"))
                throw new ArgumentException("Неверный формат телефона. Ожидается: 11 цифр, начинается с 7");

            return digits;
        }

        [HttpPut("{id}")]
        public async Task<ActionResult> UpdateOrder(int id, [FromBody] UpdateOrderRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            _logger.LogInformation("Обновление заказа {OrderId} для {UserId}", id, userId);

            try
            {
                var order = await _context.Orders
                    .Include(o => o.WorkItems)
                    .Include(o => o.Payments)
                    .Include(o => o.Photos)
                    .Include(o => o.Manager)
                    .Include(o => o.Plot)
                    .AsSplitQuery()
                    .FirstOrDefaultAsync(o => o.Id == id);

                if (order == null) return NotFound();

                // Проверка прав
                if (!IsAdminOrHigher() && order.ManagerId != userId)
                {
                    _logger.LogInformation("Менеджер {UserId} запрашивает изменения чужого заказа {OrderId}", userId, id);

                    var proposedChanges = CollectProposedChanges(order, request);
                    if (!proposedChanges.Any())
                    {
                        return BadRequest(new { success = false, message = "Нет изменений для отправки" });
                    }

                    var notificationId = await _notificationService.CreateOrderUpdateRequestAsync(
                        orderId: id,
                        initiatorId: userId,
                        proposedChanges: proposedChanges,
                        comment: request.ChangeComment ?? "Запрос на изменение заказа"
                    );

                    return Ok(new
                    {
                        success = true,
                        message = "Запрос на изменение отправлен",
                        notificationId = notificationId
                    });
                }

                if (request.Payments != null)
                {
                    var newPaymentsSum = request.Payments.Sum(p => p.Amount);

                    if (newPaymentsSum < 0)
                    {
                        return BadRequest(new
                        {
                            message = "Сумма платежей не может быть отрицательной."
                        });
                    }

                    foreach (var payment in request.Payments)
                    {
                        if (payment.Amount <= 0)
                        {
                            return BadRequest(new
                            {
                                message = "Каждый платеж должен быть больше 0."
                            });
                        }

                        if (payment.PaymentDate == default)
                        {
                            return BadRequest(new
                            {
                                message = "Дата платежа обязательна."
                            });
                        }
                    }
                }

                using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    // Обновляем основные поля
                    if (request.Place != null)
                        order.Place = request.Place;

                    if (request.InspectionPlace != null)
                        order.InspectionPlace = request.InspectionPlace;

                    if (request.OrderDate.HasValue)
                        order.OrderDate = request.OrderDate.Value.ToUniversalTime();

                    if (request.PlotId.HasValue)
                        order.PlotId = request.PlotId;

                    if (request.Latitude.HasValue)
                        order.Latitude = request.Latitude;

                    if (request.Longitude.HasValue)
                        order.Longitude = request.Longitude;

                    if (request.DeceasedFullName != null)
                        order.DeceasedFullName = request.DeceasedFullName;

                    if (request.CustomerFullName != null)
                        order.CustomerFullName = request.CustomerFullName;

                    if (request.CustomerEmail != null)
                        order.CustomerEmail = request.CustomerEmail;

                    if (request.Phone != null)
                        order.Phone = request.Phone;

                    if (request.Address != null)
                        order.Address = request.Address;

                    if (request.MonumentType != null)
                        order.MonumentType = request.MonumentType;

                    if (request.MonumentSize != null)
                        order.MonumentSize = request.MonumentSize;

                    if (request.AdditionalInfo != null)
                        order.AdditionalInfo = request.AdditionalInfo;

                    if (request.DiscountPercent.HasValue)
                        order.DiscountPercent = request.DiscountPercent.Value;

                    if (request.Status.HasValue)
                    {
                        order.Status = request.Status.Value;
                    }

                    order.UpdatedAt = DateTime.UtcNow;

                    // WorkItems - полная замена
                    if (request.WorkItems != null)
                    {
                        var existingWorkItems = await _context.OrderWorkItems
                            .Where(w => w.OrderId == id)
                            .ToListAsync();
                        _context.OrderWorkItems.RemoveRange(existingWorkItems);

                        foreach (var wi in request.WorkItems)
                        {
                            var entity = new OrderWorkItem
                            {
                                OrderId = id,
                                WorkDescription = wi.WorkDescription,
                                Price = wi.Price,
                                Quantity = wi.Quantity,
                                Note = wi.Note,
                                DistanceKm = wi.DistanceKm
                            };

                            _context.OrderWorkItems.Add(entity);
                        }
                    }

                    order.RecalculateTotals();

                    // Payments - полная замена
                    if (request.Payments != null)
                    {
                        var existingPayments = await _context.OrderPayments
                            .Where(p => p.OrderId == id)
                            .ToListAsync();
                        _context.OrderPayments.RemoveRange(existingPayments);

                        foreach (var p in request.Payments)
                        {
                            var entity = new OrderPayment
                            {
                                OrderId = id,
                                Amount = p.Amount,
                                PaymentDate = p.PaymentDate.ToUniversalTime(),
                                PaymentType = p.PaymentType,
                                Note = p.Note ?? string.Empty
                            };

                            _context.OrderPayments.Add(entity);
                        }
                    }

                    await _orderRepository.UpdateAsync(order);

                    if (request.RemovedPhotoIds?.Any() == true)
                    {
                        var photosToRemove = await _context.OrderPhotos
                            .Where(p =>
                                request.RemovedPhotoIds.Contains(p.Id) &&
                                p.OrderId == id &&
                                p.MediaType == MediaType.Photo)
                            .ToListAsync();

                        foreach (var photo in photosToRemove)
                        {
                            if (System.IO.File.Exists(photo.FilePath))
                                System.IO.File.Delete(photo.FilePath);

                            _context.OrderPhotos.Remove(photo);
                        }
                    }

                    if (request.RemovedVideoIds?.Any() == true)
                    {
                        var videosToRemove = await _context.OrderPhotos
                            .Where(p =>
                                request.RemovedVideoIds.Contains(p.Id) &&
                                p.OrderId == id &&
                                p.MediaType == MediaType.Video)
                            .ToListAsync();

                        foreach (var video in videosToRemove)
                        {
                            if (System.IO.File.Exists(video.FilePath))
                                System.IO.File.Delete(video.FilePath);

                            _context.OrderPhotos.Remove(video);
                        }
                    }

                    await _context.SaveChangesAsync();

                    if (request.TempPhotoIds?.Any() == true)
                    {
                        await _mediaService.CommitTempToOrderAsync(id, request.TempPhotoIds, userId, MediaType.Photo);
                    }

                    if (request.TempVideoIds?.Any() == true)
                    {
                        await _mediaService.CommitTempToOrderAsync(id, request.TempVideoIds, userId, MediaType.Video);
                    }

                    await transaction.CommitAsync();

                    // Перезагружаем заказ
                    var updatedOrder = await _context.Orders
                        .Include(o => o.WorkItems)
                        .Include(o => o.Payments)
                        .Include(o => o.Photos)
                        .Include(o => o.Manager)
                        .AsNoTracking()
                        .FirstOrDefaultAsync(o => o.Id == id);

                    var dto = MapToResponseDto(updatedOrder ?? order);
                    return Ok(dto);
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError(ex, "Ошибка обновления заказа {OrderId}", id);
                    return StatusCode(500, "Ошибка обновления заказа");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Неожиданная ошибка в UpdateOrder {OrderId}", id);
                return StatusCode(500, "Внутренняя ошибка сервера");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteOrder(int id)
        {
            var userId = GetCurrentUserId();
            _logger.LogInformation("Мягкое удаление заказа {OrderId} пользователем {UserId}", id, userId);

            try
            {
                var order = await _context.Orders
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(o => o.Id == id);

                if (order == null)
                {
                    _logger.LogWarning("Заказ {OrderId} не найден", id);
                    return NotFound(new { success = false, message = "Заказ не найден" });
                }

                if (!IsAdminOrHigher() && order.ManagerId != userId)
                {
                    _logger.LogWarning("Менеджер {UserId} пытается удалить чужой заказ {OrderId}", userId, id);
                    return StatusCode(403, new { success = false, message = "Можно удалять только свои заказы" });
                }

                using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    var notifications = await _context.Notifications
                        .Where(n => n.OrderId == id)
                        .ToListAsync();

                    if (notifications.Any())
                    {
                        _logger.LogInformation("Удаляем {Count} уведомлений для заказа {OrderId}", notifications.Count, id);
                        _context.Notifications.RemoveRange(notifications);
                    }

                    bool wasAlreadyArchived = order.IsDeleted;
                    order.IsDeleted = true;
                    order.DeletedAt = DateTime.UtcNow;
                    order.UpdatedAt = DateTime.UtcNow;

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    _logger.LogInformation("Заказ {OrderId} успешно перемещен в архив (был в архиве: {WasArchived})", id, wasAlreadyArchived);

                    return Ok(new
                    {
                        success = true,
                        message = wasAlreadyArchived ? "Заказ уже был в архиве, флаги обновлены" : "Заказ перемещен в архив",
                        orderId = id,
                        orderNumber = order.OrderNumber
                    });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError(ex, "Ошибка при сохранении заказа {OrderId} в архив", id);
                    return StatusCode(500, new { success = false, message = "Ошибка при удалении заказа" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Необработанная ошибка при удалении заказа {OrderId}", id);
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера" });
            }
        }

        [HttpPost("{id}/restore")]
        public async Task<IActionResult> RestoreOrder(int id)
        {
            var userId = GetCurrentUserId();
            _logger.LogInformation("Восстановление заказа {OrderId} для {UserId}", id, userId);

            try
            {
                var order = await _context.Orders
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(o => o.Id == id);

                if (order == null)
                {
                    _logger.LogWarning("Заказ {OrderId} не найден для восстановления", id);
                    return Ok(new { success = false, message = "Заказ не найден" });
                }

                _logger.LogDebug("Заказ {OrderId}: ManagerId={ManagerId}, IsDeleted={IsDeleted}, CurrentUser={UserId}",
                    order.Id, order.ManagerId, order.IsDeleted, userId);

                if (!order.IsDeleted)
                {
                    _logger.LogWarning("Заказ {OrderId} не был удален, восстановление не требуется", id);
                    return Ok(new { success = false, message = "Заказ не был удален" });
                }

                // Разрешаем ВСЕМ авторизованным пользователям восстанавливать ЛЮБЫЕ заказы из архива
                order.IsDeleted = false;
                order.DeletedAt = null;
                order.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _logger.LogInformation("Заказ {OrderId} успешно восстановлен пользователем {UserId}", id, userId);

                return Ok(new
                {
                    success = true,
                    message = "Заказ восстановлен",
                    orderId = id,
                    orderNumber = order.OrderNumber
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка восстановления заказа {OrderId}", id);
                return Ok(new { success = false, message = "Ошибка восстановления заказа" });
            }
        }

        #region Private Helpers

        private int GetCurrentUserId()
        {
            var userIdStr = User.FindFirst(ClaimTypes.Name)?.Value;
            return int.TryParse(userIdStr, out int id) ? id : throw new UnauthorizedAccessException("Неверный ID пользователя");
        }

        private bool IsAdminOrHigher() => User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        private bool IsSuperAdmin() => User.IsInRole("SuperAdmin");

        private Dictionary<string, object> CollectProposedChanges(Order order, UpdateOrderRequest request)
        {
            var changes = new Dictionary<string, object>();

            CollectFieldChanges(order, request, changes);

            if (request.WorkItems != null)
            {
                CollectWorkItemsChanges(order, request, changes);
            }

            if (request.Payments != null)
            {
                CollectPaymentsChanges(order, request, changes);
            }

            CollectPhotoChanges(order, request, changes);

            return changes;
        }
        private void CollectFieldChanges(Order order, UpdateOrderRequest request, Dictionary<string, object> changes)
        {
            if (!string.IsNullOrEmpty(request.Place) && request.Place != order.Place)
                changes["Place"] = new { old = order.Place, @new = request.Place };

            if (request.OrderDate.HasValue)
            {
                var newDate = request.OrderDate.Value.Date;
                var oldDate = order.OrderDate.Date;

                if (newDate != oldDate)
                {
                    changes["OrderDate"] = new
                    {
                        old = order.OrderDate,
                        @new = request.OrderDate.Value
                    };
                }
            }

            // Собираем изменения карты (map) ТОЛЬКО если менялись Latitude, Longitude или Plot
            bool hasMapChanges = false;

            // Используем nullable типы для совместимости
            double? oldLatitude = order.Latitude;
            double? oldLongitude = order.Longitude;
            string oldPlot = order.Plot?.Name ?? string.Empty;
            string oldInspectionPlace = order.InspectionPlace ?? string.Empty;  // ← ДОБАВИТЬ

            double? newLatitude = order.Latitude;
            double? newLongitude = order.Longitude;
            string newPlot = order.Plot?.Name ?? string.Empty;
            string newInspectionPlace = order.InspectionPlace ?? string.Empty;  // ← ДОБАВИТЬ

            // Latitude
            if (request.Latitude.HasValue && request.Latitude != order.Latitude)
            {
                newLatitude = request.Latitude.Value;
                hasMapChanges = true;
            }

            // Longitude
            if (request.Longitude.HasValue && request.Longitude != order.Longitude)
            {
                newLongitude = request.Longitude.Value;
                hasMapChanges = true;
            }

            // Plot
            if (request.PlotId.HasValue && request.PlotId != order.PlotId)
            {
                newPlot = _context.Plots
                    .Where(p => p.Id == request.PlotId.Value)
                    .Select(p => p.Name)
                    .FirstOrDefault() ?? string.Empty;
                hasMapChanges = true;
            }

            // ← ДОБАВИТЬ InspectionPlace
            if (request.InspectionPlace != null && request.InspectionPlace != order.InspectionPlace)
            {
                newInspectionPlace = request.InspectionPlace;
                hasMapChanges = true;
            }

            // Если есть изменения карты - добавляем map
            if (hasMapChanges)
            {
                changes["map"] = new
                {
                    old = new
                    {
                        latitude = oldLatitude,
                        longitude = oldLongitude,
                        plot = oldPlot,
                        inspectionPlace = oldInspectionPlace  // ← ДОБАВИТЬ
                    },
                    @new = new
                    {
                        latitude = newLatitude,
                        longitude = newLongitude,
                        plot = newPlot,
                        inspectionPlace = newInspectionPlace  // ← ДОБАВИТЬ
                    }
                };
            }

            // Остальные поля
            if (!string.IsNullOrEmpty(request.DeceasedFullName) && request.DeceasedFullName != order.DeceasedFullName)
                changes["DeceasedFullName"] = new { old = order.DeceasedFullName, @new = request.DeceasedFullName };

            if (!string.IsNullOrEmpty(request.CustomerFullName) && request.CustomerFullName != order.CustomerFullName)
                changes["CustomerFullName"] = new { old = order.CustomerFullName, @new = request.CustomerFullName };

            if (request.CustomerEmail != order.CustomerEmail)
                changes["CustomerEmail"] = new { old = order.CustomerEmail ?? string.Empty, @new = request.CustomerEmail ?? string.Empty };

            if (!string.IsNullOrEmpty(request.Phone) && request.Phone != order.Phone)
                changes["Phone"] = new { old = order.Phone, @new = request.Phone };

            if (!string.IsNullOrEmpty(request.Address) && request.Address != order.Address)
                changes["Address"] = new { old = order.Address, @new = request.Address };

            if (!string.IsNullOrEmpty(request.MonumentType) && request.MonumentType != order.MonumentType)
                changes["MonumentType"] = new { old = order.MonumentType, @new = request.MonumentType };

            if (!string.IsNullOrEmpty(request.MonumentSize) && request.MonumentSize != order.MonumentSize)
                changes["MonumentSize"] = new { old = order.MonumentSize, @new = request.MonumentSize };

            var oldAdditionalInfo = order.AdditionalInfo ?? string.Empty;
            var newAdditionalInfo = request.AdditionalInfo ?? string.Empty;

            if (oldAdditionalInfo != newAdditionalInfo)
            {
                changes["AdditionalInfo"] = new { old = oldAdditionalInfo, @new = newAdditionalInfo };
            }

            if (request.Status.HasValue && request.Status.Value != order.Status)
                changes["Status"] = new { old = order.Status.ToString(), @new = request.Status.Value.ToString() };
            if (request.DiscountPercent.HasValue && request.DiscountPercent.Value != order.DiscountPercent)
            {
                changes["DiscountPercent"] = new
                {
                    old = order.DiscountPercent,
                    @new = request.DiscountPercent.Value
                };
            }
        }

        private void CollectWorkItemsChanges(Order order, UpdateOrderRequest request, Dictionary<string, object> changes)
        {
            if (request.WorkItems == null) return;

            var oldWorkItems = order.WorkItems.Select(w => new
            {
                w.WorkDescription,
                w.Price,
                w.Quantity,
                w.Note
            }).ToList();

            var newWorkItems = request.WorkItems.Select(w => new
            {
                w.WorkDescription,
                w.Price,
                w.Quantity,
                w.Note
            }).ToList();

            var oldWorkItemsJson = JsonSerializer.Serialize(oldWorkItems);
            var newWorkItemsJson = JsonSerializer.Serialize(newWorkItems);

            if (oldWorkItemsJson != newWorkItemsJson)
            {
                changes["WorkItems"] = new { old = oldWorkItems, @new = newWorkItems };
            }
        }

        private void CollectPaymentsChanges(Order order, UpdateOrderRequest request, Dictionary<string, object> changes)
        {
            if (request.Payments == null) return;

            var oldPayments = order.Payments.Select(p => new
            {
                p.Amount,
                p.PaymentDate,
                p.PaymentType,
                p.Note
            }).ToList();

            var newPayments = request.Payments.Select(p => new
            {
                p.Amount,
                PaymentDate = p.PaymentDate,
                p.PaymentType,
                p.Note
            }).ToList();

            var oldPaymentsJson = JsonSerializer.Serialize(oldPayments);
            var newPaymentsJson = JsonSerializer.Serialize(newPayments);

            if (oldPaymentsJson != newPaymentsJson)
            {
                changes["Payments"] = new { old = oldPayments, @new = newPayments };
            }
        }
        private void CollectPhotoChanges(Order order, UpdateOrderRequest request, Dictionary<string, object> changes)
        {
            // Собираем фото для добавления
            List<int> addedPhotoTempIds = new();
            if (request.TempPhotoIds?.Any() == true)
            {
                var userId = GetCurrentUserId();
                var validTempIds = _context.TempUploads
                    .Where(t => request.TempPhotoIds.Contains(t.Id) &&
                               t.UploaderId == userId &&
                               t.MediaType == MediaType.Photo)
                    .Select(t => t.Id)
                    .ToList();

                if (validTempIds.Any())
                {
                    addedPhotoTempIds = validTempIds;
                }
            }

            // Собираем видео для добавления
            List<int> addedVideoTempIds = new();
            if (request.TempVideoIds?.Any() == true)
            {
                var userId = GetCurrentUserId();
                var validTempIds = _context.TempUploads
                    .Where(t => request.TempVideoIds.Contains(t.Id) &&
                               t.UploaderId == userId &&
                               t.MediaType == MediaType.Video)
                    .Select(t => t.Id)
                    .ToList();

                if (validTempIds.Any())
                {
                    addedVideoTempIds = validTempIds;
                }
            }

            // Собираем ID фото для удаления
            List<int> removedPhotoIds = new();
            if (request.RemovedPhotoIds?.Any() == true)
            {
                var existingPhotoIds = order.Photos
                    .Where(p => p.MediaType == MediaType.Photo)
                    .Select(p => p.Id)
                    .ToList();

                removedPhotoIds = request.RemovedPhotoIds
                    .Where(pid => existingPhotoIds.Contains(pid))
                    .ToList();
            }

            // Собираем ID видео для удаления
            List<int> removedVideoIds = new();
            if (request.RemovedVideoIds?.Any() == true)
            {
                var existingVideoIds = order.Photos
                    .Where(p => p.MediaType == MediaType.Video)
                    .Select(p => p.Id)
                    .ToList();

                removedVideoIds = request.RemovedVideoIds
                    .Where(pid => existingVideoIds.Contains(pid))
                    .ToList();
            }

            // Добавляем изменения фото в уведомление (отдельным ключом)
            if (addedPhotoTempIds.Any() || removedPhotoIds.Any())
            {
                changes["Photos"] = new
                {
                    addedTempIds = addedPhotoTempIds,
                    removedIds = removedPhotoIds
                };
            }

            // Добавляем изменения видео в уведомление (отдельным ключом)
            if (addedVideoTempIds.Any() || removedVideoIds.Any())
            {
                changes["Videos"] = new
                {
                    addedTempIds = addedVideoTempIds,
                    removedIds = removedVideoIds
                };
            }

            // Логируем для отладки
            if (addedPhotoTempIds.Any() || removedPhotoIds.Any() ||
                addedVideoTempIds.Any() || removedVideoIds.Any())
            {
                _logger.LogDebug(
                    "CollectPhotoChanges: Фото: +{PhotoAdd} -{PhotoRemove}, Видео: +{VideoAdd} -{VideoRemove}",
                    addedPhotoTempIds.Count, removedPhotoIds.Count,
                    addedVideoTempIds.Count, removedVideoIds.Count);
            }
        }

        private OrderResponseDto MapToResponseDto(Order order)
        {
            // Пересчитываем финансы из WorkItems
            order.RecalculateTotals();

            var paymentStatus = OrderRepository.CalculatePaymentStatus(
                order.TotalPrice,
                order.Payments?.Sum(p => p.Amount) ?? 0m
            );

            return new OrderResponseDto
            {
                Id = order.Id,
                OrderNumber = order.OrderNumber,
                Place = order.Place,
                InspectionPlace = order.InspectionPlace,
                OrderDate = order.OrderDate,

                Latitude = order.Latitude,
                Longitude = order.Longitude,
                PlotId = order.PlotId,
                PlotName = order.Plot?.Name,

                DeceasedFullName = order.DeceasedFullName,
                CustomerFullName = order.CustomerFullName,
                CustomerEmail = order.CustomerEmail,
                Phone = order.Phone,
                Address = order.Address,
                MonumentType = order.MonumentType,
                MonumentSize = order.MonumentSize,
                AdditionalInfo = order.AdditionalInfo,

                Status = order.Status,

                Subtotal = order.Subtotal,
                DiscountPercent = order.DiscountPercent,
                DiscountAmount = order.DiscountAmount,
                TotalPrice = order.TotalPrice,

                CreatedAt = order.CreatedAt,
                UpdatedAt = order.UpdatedAt,

                ManagerId = order.ManagerId,
                ManagerFullName = order.Manager?.FullName ?? string.Empty,
                WorkItems = order.WorkItems.Select(w => new OrderWorkItemDto
                {
                    Id = w.Id,
                    WorkDescription = w.WorkDescription,
                    Price = w.Price,
                    Quantity = w.Quantity,
                    Note = w.Note,
                    DistanceKm = w.DistanceKm
                }).ToList(),
                Payments = (order.Payments ?? new List<OrderPayment>())
                    .Select(p => new OrderPaymentDto
                    {
                        Id = p.Id,
                        Amount = p.Amount,
                        PaymentDate = p.PaymentDate,
                        PaymentType = p.PaymentType,
                        Note = p.Note
                    }).ToList(),
                Photos = order.Photos.Select(p => new OrderMediaDto
                {
                    Id = p.Id,
                    Url = $"/api/Media/{p.Id}/file",
                    OriginalFileName = p.OriginalFileName,
                    Size = p.Size,
                    UploadedAt = p.UploadedAt,
                    Width = p.Width ?? 0,
                    Height = p.Height ?? 0,
                    MediaType = p.MediaType
                }).ToList(),
                IsDeleted = order.IsDeleted,
                DeletedAt = order.DeletedAt,
                PaymentStatus = paymentStatus
            };
        }

        #endregion

        #region Archive Methods

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
                    .AsSplitQuery()
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
                    .Include(o => o.Photos)
                    .Include(o => o.WorkItems)
                    .Include(o => o.Payments)
                    .FirstOrDefaultAsync(o => o.Id == id && o.IsDeleted);

                if (order == null)
                {
                    _logger.LogWarning("Архивный заказ {OrderId} не найден", id);
                    return NotFound(new { success = false, message = "Архивный заказ не найден" });
                }

                // === НОВАЯ ЛОГИКА ПРОВЕРКИ ===

                // Админы и суперадмины могут всё
                if (IsAdminOrHigher())
                {
                    _logger.LogInformation("Админ {UserId} удаляет архивный заказ {OrderId}", userId, id);
                    // продолжаем удаление
                }
                else
                {
                    // Менеджеры: проверяем время создания заказа
                    var timeSinceCreated = DateTime.UtcNow - order.CreatedAt;
                    var canDelete = timeSinceCreated.TotalMinutes <= 30;

                    if (!canDelete)
                    {
                        var minutesLeft = (int)(30 - timeSinceCreated.TotalMinutes);
                        _logger.LogWarning(
                            "Менеджер {UserId} пытается удалить архивный заказ {OrderId} (создан {CreatedAt}, прошло {Minutes} мин, можно только до 30 мин)",
                            userId, id, order.CreatedAt, (int)timeSinceCreated.TotalMinutes);

                        return StatusCode(403, new
                        {
                            success = false,
                            message = $"Заказ можно удалить из архива только в течение 30 минут после создания. Осталось {minutesLeft} минут.",
                            canDeleteAt = order.CreatedAt.AddMinutes(30)
                        });
                    }

                    // Дополнительная проверка: заказ должен принадлежать менеджеру
                    if (order.ManagerId != userId)
                    {
                        _logger.LogWarning("Менеджер {UserId} пытается удалить чужой архивный заказ {OrderId}", userId, id);
                        return StatusCode(403, new { success = false, message = "Можно удалять из архива только свои заказы" });
                    }

                    _logger.LogInformation("Менеджер {UserId} удаляет свой архивный заказ {OrderId} (создан {CreatedAt}, прошло {Minutes} мин)",
                        userId, id, order.CreatedAt, (int)timeSinceCreated.TotalMinutes);
                }

                // === УДАЛЕНИЕ (без изменений) ===
                using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    // Удаляем папку с файлами
                    var orderFolderPath = Path.Combine(_env.WebRootPath, "uploads", "orders", id.ToString());

                    try
                    {
                        if (Directory.Exists(orderFolderPath))
                        {
                            Directory.Delete(orderFolderPath, true);
                            _logger.LogInformation("Папка заказа {OrderId} удалена", id);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Ошибка удаления папки заказа {OrderId}", id);
                    }

                    // Удаляем фото
                    if (order.Photos.Any())
                    {
                        _context.OrderPhotos.RemoveRange(order.Photos);
                    }

                    // Удаляем work items
                    if (order.WorkItems.Any())
                    {
                        _context.OrderWorkItems.RemoveRange(order.WorkItems);
                    }

                    // Удаляем payments
                    if (order.Payments.Any())
                    {
                        _context.OrderPayments.RemoveRange(order.Payments);
                    }

                    // Удаляем сам заказ
                    _context.Orders.Remove(order);

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    _logger.LogInformation("Заказ {OrderId} полностью удален из архива пользователем {UserId}", id, userId);

                    return Ok(new
                    {
                        success = true,
                        message = "Заказ полностью удален из архива"
                    });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError(ex, "Ошибка полного удаления заказа {OrderId}", id);
                    return StatusCode(500, new { success = false, message = "Ошибка полного удаления заказа" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Необработанная ошибка при полном удалении заказа {OrderId}", id);
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера" });
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