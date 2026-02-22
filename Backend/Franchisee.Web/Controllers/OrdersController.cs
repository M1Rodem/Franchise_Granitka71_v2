using DocumentFormat.OpenXml.Wordprocessing;
using Franchisee.Web.Configuration;
using Franchisee.Web.Models;
using Franchisee.Web.Services;
using Franchisee.Web.Services.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;

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
                _logger.LogInformation("Генерация номера заказа...");
                var orderNumber = await _orderRepository.GenerateOrderNumberAsync();
                _logger.LogInformation("Сгенерирован номер заказа: {OrderNumber}", orderNumber);

                // 1. Нормализация телефона
                var normalizedPhone = NormalizePhone(request.Phone);

                var order = new Order
                {
                    OrderNumber = orderNumber,
                    Place = request.Place,
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
                    WorkItems = request.WorkItems ?? new List<OrderWorkItem>(),
                    Payments = request.Payments ?? new List<OrderPayment>()
                };

                // ИСПРАВЛЕНИЕ: НЕ вызываем CalculateAndAddDistanceWorkItem
                // Расстояние приходит с фронта в request.WorkItems
                // Бэк НЕ ДОЛЖЕН пересчитывать расстояние!

                // Set FK
                foreach (var wi in order.WorkItems) wi.OrderId = 0;
                foreach (var p in order.Payments) p.OrderId = 0;

                _logger.LogInformation("Сохранение заказа в БД...");
                await _orderRepository.AddAsync(order);

                // Рассчет TotalPrice
                order.TotalPrice = request.TotalPrice > 0 ? request.TotalPrice : order.WorkItems.Sum(w => w.Price * w.Quantity);
                await _orderRepository.UpdateAsync(order);

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
                        comment: "Запрос на изменение заказа"
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
                    var currentTotalPaid = order.Payments.Sum(p => p.Amount);
                    var newPaymentsSum = request.Payments.Sum(p => p.Amount);

                    // Получаем актуальную сумму заказа (из order, т.к. WorkItems еще не обновлены)
                    var orderTotal = order.TotalPrice;

                    // Если сумма заказа 0, пропускаем валидацию (невозможно определить процент)
                    if (orderTotal > 0)
                    {
                        // Случай 1: Первый платеж (текущая оплата была 0)
                        if (currentTotalPaid == 0 && newPaymentsSum > 0)
                        {
                            if (newPaymentsSum < orderTotal * 0.3m)
                            {
                                return BadRequest(new
                                {
                                    message = $"Минимальный первый платеж должен быть не менее 30% от суммы заказа. " +
                                             $"Текущая сумма: {newPaymentsSum}, требуется минимум: {orderTotal * 0.3m:F2}"
                                });
                            }
                        }
                        // Случай 2: Добавление платежей к существующим (сумма увеличивается)
                        else if (newPaymentsSum > currentTotalPaid)
                        {
                            var newPercent = (newPaymentsSum / orderTotal) * 100;

                            // Если после добавления сумма все еще меньше 30% - ошибка
                            if (newPercent < 30)
                            {
                                return BadRequest(new
                                {
                                    message = $"Сумма платежей не может быть меньше 30% от стоимости заказа. " +
                                             $"Текущий процент: {newPercent:F1}%"
                                });
                            }
                        }
                        // Случай 3: Уменьшение суммы платежей - разрешаем (это может быть исправление ошибки)
                        // Не блокируем
                    }
                }

                using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    // Обновляем основные поля
                    if (!string.IsNullOrEmpty(request.Place)) order.Place = request.Place;
                    if (!string.IsNullOrEmpty(request.InspectionPlace)) order.InspectionPlace = request.InspectionPlace;
                    if (request.OrderDate.HasValue) order.OrderDate = request.OrderDate.Value.ToUniversalTime();
                    if (!string.IsNullOrEmpty(request.DeceasedFullName)) order.DeceasedFullName = request.DeceasedFullName;
                    if (!string.IsNullOrEmpty(request.CustomerFullName)) order.CustomerFullName = request.CustomerFullName;
                    if (!string.IsNullOrEmpty(request.CustomerEmail)) order.CustomerEmail = request.CustomerEmail;
                    if (!string.IsNullOrEmpty(request.Phone)) order.Phone = request.Phone;
                    if (!string.IsNullOrEmpty(request.Address)) order.Address = request.Address;
                    if (!string.IsNullOrEmpty(request.MonumentType)) order.MonumentType = request.MonumentType;
                    if (!string.IsNullOrEmpty(request.MonumentSize)) order.MonumentSize = request.MonumentSize;

                    order.AdditionalInfo = request.AdditionalInfo ?? order.AdditionalInfo;
                    if (request.Status.HasValue) order.Status = request.Status.Value;
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
                            wi.OrderId = id;
                            _context.OrderWorkItems.Add(wi);
                        }
                    }

                    // Payments - полная замена
                    if (request.Payments != null)
                    {
                        var existingPayments = await _context.OrderPayments
                            .Where(p => p.OrderId == id)
                            .ToListAsync();
                        _context.OrderPayments.RemoveRange(existingPayments);

                        foreach (var payment in request.Payments)
                        {
                            payment.OrderId = id;
                            payment.PaymentDate = payment.PaymentDate.ToUniversalTime();
                            _context.OrderPayments.Add(payment);
                        }
                    }

                    await _context.SaveChangesAsync();

                    if (request.RemovedPhotoIds?.Any() == true)
                    {
                        var photosToRemove = await _context.OrderPhotos
                            .Where(p => request.RemovedPhotoIds.Contains(p.Id) && p.MediaType == MediaType.Photo)
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
                            .Where(p => request.RemovedVideoIds.Contains(p.Id) && p.MediaType == MediaType.Video)
                            .ToListAsync();

                        foreach (var video in videosToRemove)
                        {
                            if (System.IO.File.Exists(video.FilePath))
                                System.IO.File.Delete(video.FilePath);
                            _context.OrderPhotos.Remove(video);
                        }
                    }

                    if (request.TempPhotoIds?.Any() == true)
                    {
                        await _mediaService.CommitTempToOrderAsync(id, request.TempPhotoIds, userId, MediaType.Photo);
                    }

                    if (request.TempVideoIds?.Any() == true)
                    {
                        await _mediaService.CommitTempToOrderAsync(id, request.TempVideoIds, userId, MediaType.Video);
                    }

                    await _context.SaveChangesAsync();
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

            // Загружаем заказ (без фильтра удаленных)
            var order = await _context.Orders
                .Include(o => o.WorkItems)
                .Include(o => o.Payments)
                .Include(o => o.Photos)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (order == null)
            {
                _logger.LogWarning("Заказ {OrderId} не найден", id);
                return NotFound("Заказ не найден");
            }

            // Проверка прав
            if (!IsAdminOrHigher() && order.ManagerId != userId)
            {
                _logger.LogWarning("Пользователь {UserId} пытается удалить чужой заказ {OrderId}", userId, id);
                return Forbid("Нет прав на удаление этого заказа");
            }

            // Если заказ уже в архиве, не даем повторно мягко удалять
            if (order.IsDeleted)
            {
                _logger.LogWarning("Заказ {OrderId} уже находится в архиве", id);
                return BadRequest(new
                {
                    success = false,
                    message = "Заказ уже в архиве. Используйте полное удаление если нужно удалить навсегда."
                });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // 1. Удаляем ВСЕ уведомления, связанные с заказом (ПОЛНОСТЬЮ)
                var notifications = await _context.Notifications
                    .Where(n => n.OrderId == id)
                    .Include(n => n.Recipients)  // Загружаем получателей для удаления
                    .ToListAsync();

                if (notifications.Any())
                {
                    _logger.LogInformation("Удаляем {Count} уведомлений, связанных с заказом {OrderId}",
                        notifications.Count, id);

                    // Recipients удалятся каскадно благодаря настройкам в БД
                    _context.Notifications.RemoveRange(notifications);
                    await _context.SaveChangesAsync();
                }

                // 2. Помечаем заказ как удаленный (мягкое удаление)
                order.IsDeleted = true;
                order.DeletedAt = DateTime.UtcNow;
                order.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation("Заказ {OrderId} перемещен в архив. Удалено уведомлений: {NotifCount}",
                    id, notifications.Count);

                return Ok(new
                {
                    success = true,
                    message = "Заказ перемещен в архив",
                    deletedNotifications = notifications.Count,
                    orderId = id,
                    orderNumber = order.OrderNumber
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Ошибка при мягком удалении заказа {OrderId}", id);
                return StatusCode(500, new
                {
                    success = false,
                    message = "Ошибка при удалении заказа",
                    error = ex.Message
                });
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

            if (!string.IsNullOrEmpty(request.InspectionPlace) && request.InspectionPlace != order.InspectionPlace)
                changes["InspectionPlace"] = new { old = order.InspectionPlace, @new = request.InspectionPlace };

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

            // НОВОЕ: Геоданные
            if (request.Latitude.HasValue && request.Latitude != order.Latitude)
                changes["Latitude"] = new { old = order.Latitude, @new = request.Latitude };

            if (request.Longitude.HasValue && request.Longitude != order.Longitude)
                changes["Longitude"] = new { old = order.Longitude, @new = request.Longitude };

            if (request.PlotId.HasValue && request.PlotId != order.PlotId)
                changes["PlotId"] = new { old = order.PlotId, @new = request.PlotId };

            if (!string.IsNullOrEmpty(request.DeceasedFullName) && request.DeceasedFullName != order.DeceasedFullName)
                changes["DeceasedFullName"] = new { old = order.DeceasedFullName, @new = request.DeceasedFullName };

            if (!string.IsNullOrEmpty(request.CustomerFullName) && request.CustomerFullName != order.CustomerFullName)
                changes["CustomerFullName"] = new { old = order.CustomerFullName, @new = request.CustomerFullName };

            if (!string.IsNullOrEmpty(request.CustomerEmail) && request.CustomerEmail != order.CustomerEmail)
                changes["CustomerEmail"] = new { old = order.CustomerEmail, @new = request.CustomerEmail };

            if (!string.IsNullOrEmpty(request.Phone) && request.Phone != order.Phone)
                changes["Phone"] = new { old = order.Phone, @new = request.Phone };

            if (!string.IsNullOrEmpty(request.Address) && request.Address != order.Address)
                changes["Address"] = new { old = order.Address, @new = request.Address };

            if (!string.IsNullOrEmpty(request.MonumentType) && request.MonumentType != order.MonumentType)
                changes["MonumentType"] = new { old = order.MonumentType, @new = request.MonumentType };

            if (!string.IsNullOrEmpty(request.MonumentSize) && request.MonumentSize != order.MonumentSize)
                changes["MonumentSize"] = new { old = order.MonumentSize, @new = request.MonumentSize };

            if (!string.IsNullOrEmpty(request.AdditionalInfo) && request.AdditionalInfo != order.AdditionalInfo)
                changes["AdditionalInfo"] = new { old = order.AdditionalInfo, @new = request.AdditionalInfo };

            if (request.Status.HasValue && request.Status.Value != order.Status)
                changes["Status"] = new { old = order.Status.ToString(), @new = request.Status.Value.ToString() };
        }
        private void CollectWorkItemsChanges(Order order, UpdateOrderRequest request, Dictionary<string, object> changes)
        {
            if (request.WorkItems == null) return;

            var oldWorkItems = order.WorkItems.Select(w => new {
                w.WorkDescription,
                w.Price,
                w.Quantity,
                w.Note
            }).ToList();

            var newWorkItems = request.WorkItems.Select(w => new {
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

                // НОВОЕ: Отслеживаем изменение общей суммы
                var oldTotal = order.WorkItems.Sum(w => w.Price * w.Quantity);
                var newTotal = request.WorkItems.Sum(w => w.Price * w.Quantity);

                if (oldTotal != newTotal)
                {
                    changes["TotalPrice"] = new
                    {
                        old = oldTotal,
                        @new = newTotal
                    };

                    _logger.LogDebug("Обнаружено изменение суммы заказа: {OldTotal} -> {NewTotal}",
                        oldTotal, newTotal);
                }
            }
        }

        private void CollectPaymentsChanges(Order order, UpdateOrderRequest request, Dictionary<string, object> changes)
        {
            if (request.Payments == null) return;

            var oldPayments = order.Payments.Select(p => new {
                p.Amount,
                p.PaymentDate,
                p.PaymentType,
                p.Note
            }).ToList();

            var newPayments = request.Payments.Select(p => new {
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
            // Computed TotalPrice
            var total = order.WorkItems.Sum(w => w.Price * w.Quantity);

            // Вычисление нового статуса оплаты - ИСПРАВЛЕНО
            var paid = order.Payments.Sum(p => p.Amount);
            var paymentStatus = PaymentStatus.Advance; // По умолчанию

            if (total > 0)
            {
                if (paid >= total)
                    paymentStatus = PaymentStatus.FullyPaid;
                else if (paid > total * 0.3m)  // ИСПРАВЛЕНО: строго больше 30%
                    paymentStatus = PaymentStatus.PartiallyPaid;
                else if (paid > 0)  // от 0% до 30% включительно
                    paymentStatus = PaymentStatus.Advance;
                // else paid == 0 - остается Advance (по умолчанию)
            }

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
                TotalPrice = total,
                CreatedAt = order.CreatedAt,
                UpdatedAt = order.UpdatedAt,
                ManagerId = order.ManagerId,
                ManagerFullName = order.Manager?.FullName ?? string.Empty,
                WorkItems = order.WorkItems,
                Payments = order.Payments,
                Photos = order.Photos.Select(p => new OrderMediaDto
                {
                    Id = p.Id,
                    Url = $"/api/media/{p.Id}/file",
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
                .Select(o => new Order // ПРОЕКЦИЯ ДЛЯ АРХИВНЫХ ЗАКАЗОВ
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
                    Manager = o.Manager == null ? null : new Manager
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
                    .Include(o => o.Photos)  // ← Добавил Include для фото
                    .FirstOrDefaultAsync(o => o.Id == id && o.IsDeleted);

                if (order == null)
                    return NotFound("Архивный заказ не найден");

                using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    // Путь к папке заказа
                    var orderFolderPath = Path.Combine(_env.WebRootPath, "uploads", "orders", id.ToString());

                    // Удаляем фото и файлы
                    var photos = order.Photos;  // ← Теперь используем order.Photos

                    foreach (var photo in photos)
                    {
                        if (System.IO.File.Exists(photo.FilePath))
                        {
                            await Task.Run(() => System.IO.File.Delete(photo.FilePath));
                            _logger.LogDebug("Удален файл: {FilePath}", photo.FilePath);
                        }
                        _context.OrderPhotos.Remove(photo);
                    }

                    // НОВОЕ: Удаляем пустую папку заказа
                    if (Directory.Exists(orderFolderPath))
                    {
                        // Проверяем, остались ли еще файлы в папке (на всякий случай)
                        if (!Directory.EnumerateFileSystemEntries(orderFolderPath).Any())
                        {
                            Directory.Delete(orderFolderPath);
                            _logger.LogInformation("Удалена пустая папка заказа: {FolderPath}", orderFolderPath);
                        }
                        else
                        {
                            _logger.LogWarning("Папка заказа {OrderId} не пуста, удаление отменено", id);
                        }
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
                    return Ok(new
                    {
                        message = "Заказ полностью удален из архива",
                        folderDeleted = true
                    });
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
                .Where(o => o.Id == id && o.IsDeleted)
                .Include(o => o.WorkItems)
                .Include(o => o.Payments)
                .Include(o => o.Photos)
                .Include(o => o.Manager)
                .Select(o => new Order // ПРОЕКЦИЯ ДЛЯ АРХИВНОГО ЗАКАЗА
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
                    Manager = o.Manager == null ? null : new Manager
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
            .FirstOrDefaultAsync();

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