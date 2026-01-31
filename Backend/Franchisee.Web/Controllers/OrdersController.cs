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

namespace Franchisee.Web.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class OrdersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IOrderRepository _orderRepository;
        private readonly IPhotoService _photoService;
        private readonly INotificationService _notificationService;
        private readonly ILogger<OrdersController> _logger;

        public OrdersController(
            ApplicationDbContext context,
            IOrderRepository orderRepository,
            IPhotoService photoService,
            INotificationService notificationService,
            ILogger<OrdersController> logger)
        {
            _context = context;
            _orderRepository = orderRepository;
            _photoService = photoService;
            _notificationService = notificationService;
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

                // Рассчет TotalPrice
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
        public async Task<ActionResult> UpdateOrder(int id, [FromBody] UpdateOrderRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            _logger.LogInformation("Обновление заказа {OrderId} для {UserId}", id, userId);

            // УДАЛЕНО: проверка блокирующих уведомлений
            // Фронтенд управляет блокировкой через /api/notifications/check-blocking

            try
            {
                // Загружаем заказ
                var order = await _context.Orders
                    .Include(o => o.WorkItems)
                    .Include(o => o.Payments)
                    .Include(o => o.Photos)
                    .Include(o => o.Manager)
                    .FirstOrDefaultAsync(o => o.Id == id);

                if (order == null) return NotFound();

                // Проверяем права
                if (!IsAdminOrHigher() && order.ManagerId != userId)
                {
                    // Менеджер пытается изменить чужой заказ → создаём уведомление через NotificationService
                    _logger.LogInformation("Менеджер {UserId} запрашивает изменения чужого заказа {OrderId}", userId, id);

                    // 1. Собираем предлагаемые изменения
                    var proposedChanges = CollectProposedChanges(order, request);

                    // Если нет изменений - возвращаем ошибку
                    if (!proposedChanges.Any())
                    {
                        return BadRequest(new { success = false, message = "Нет изменений для отправки" });
                    }

                    // 2. Создаём уведомление через NotificationService (БЕЗ ТРАНЗАКЦИИ контроллера!)
                    var notificationId = await _notificationService.CreateOrderUpdateRequestAsync(
                        orderId: id,
                        initiatorId: userId,
                        proposedChanges: proposedChanges,
                        comment: "Запрос на изменение заказа"
                    );

                    _logger.LogInformation("Создано уведомление {NotificationId} для заказа {OrderId}", notificationId, id);

                    // 3. Возвращаем успех, но БЕЗ применения изменений
                    return Ok(new
                    {
                        success = true,
                        message = "Запрос на изменение отправлен владельцу заказа и администраторам",
                        notificationId = notificationId
                    });
                }

                // Если Admin/SuperAdmin или менеджер редактирует свой заказ - продолжаем стандартное обновление
                // ДЛЯ РЕАЛЬНОГО ОБНОВЛЕНИЯ - ИСПОЛЬЗУЕМ ТРАНЗАКЦИЮ
                using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    _logger.LogDebug("ДО обновления: WorkItems count = {WorkItemsCount}, Payments count = {PaymentsCount}",
                        order.WorkItems.Count, order.Payments.Count);

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

                    // WorkItems: полная замена
                    if (request.WorkItems != null)
                    {
                        _logger.LogDebug("Обновление WorkItems: удаляем {OldCount} старых, добавляем {NewCount} новых",
                            order.WorkItems.Count, request.WorkItems.Count);

                        // Удаляем старые WorkItems через отдельный запрос
                        var existingWorkItems = await _context.OrderWorkItems
                            .Where(w => w.OrderId == id)
                            .ToListAsync();
                        _context.OrderWorkItems.RemoveRange(existingWorkItems);

                        // Добавляем новые WorkItems
                        foreach (var wi in request.WorkItems)
                        {
                            var newWorkItem = new OrderWorkItem
                            {
                                OrderId = id,
                                WorkDescription = wi.WorkDescription,
                                Price = wi.Price,
                                Quantity = wi.Quantity,
                                Note = wi.Note
                            };
                            _context.OrderWorkItems.Add(newWorkItem);
                        }
                    }

                    // Payments: полная замена
                    if (request.Payments != null)
                    {
                        _logger.LogDebug("Обновление Payments: удаляем {OldCount} старых, добавляем {NewCount} новых",
                            order.Payments.Count, request.Payments.Count);

                        // Удаляем старые Payments через отдельный запрос
                        var existingPayments = await _context.OrderPayments
                            .Where(p => p.OrderId == id)
                            .ToListAsync();
                        _context.OrderPayments.RemoveRange(existingPayments);

                        // Добавляем новые Payments
                        foreach (var payment in request.Payments)
                        {
                            var newPayment = new OrderPayment
                            {
                                OrderId = id,
                                Amount = payment.Amount,
                                PaymentDate = payment.PaymentDate.ToUniversalTime(),
                                PaymentType = payment.PaymentType,
                                Note = payment.Note
                            };
                            _context.OrderPayments.Add(newPayment);
                        }
                    }

                    // Сохраняем все изменения
                    await _context.SaveChangesAsync();

                    // Обрабатываем новые фото
                    if (request.TempUploadIds?.Any() == true)
                    {
                        await _photoService.CommitTempToOrderAsync(id, request.TempUploadIds, userId);
                    }

                    await transaction.CommitAsync();

                    // Перезагружаем заказ для DTO
                    var updatedOrder = await _context.Orders
                        .Include(o => o.WorkItems)
                        .Include(o => o.Payments)
                        .Include(o => o.Photos)
                        .Include(o => o.Manager)
                        .AsNoTracking()
                        .FirstOrDefaultAsync(o => o.Id == id);

                    if (updatedOrder == null)
                    {
                        _logger.LogWarning("Заказ {OrderId} не найден после обновления", id);
                        return StatusCode(500, "Ошибка при получении обновленного заказа");
                    }

                    var dto = MapToResponseDto(updatedOrder);

                    _logger.LogInformation("Заказ {OrderId} успешно обновлен. WorkItems: {WorkItemsCount}, Payments: {PaymentsCount}",
                        id, updatedOrder.WorkItems.Count, updatedOrder.Payments.Count);

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
                _logger.LogError(ex, "Неожиданная ошибка в методе UpdateOrder {OrderId}", id);
                return StatusCode(500, "Внутренняя ошибка сервера");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteOrder(int id)
        {
            var userId = GetCurrentUserId();
            _logger.LogInformation("Удаление заказа {OrderId} для {UserId}", id, userId);

            var order = await _orderRepository.GetByIdAsync(id);
            if (order == null) return NotFound();

            if (!IsAdminOrHigher() && order.ManagerId != userId) return Forbid();

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
            }
        }
        private void CollectPaymentsChanges(Order order, UpdateOrderRequest request, Dictionary<string, object> changes)
        {
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
            List<int> addedTempIds = new();
            List<int> removedPhotoIds = new();

            if (order.Photos == null)
            {
                _logger.LogError("ERROR: order.Photos is NULL!");
                return;
            }

            var existingPhotoIds = order.Photos.Select(p => p.Id).ToList();
            _logger.LogError("Existing photo IDs: {@ExistingIds}", existingPhotoIds);

            if (request.RemovedPhotoIds?.Any() == true)
            {
                _logger.LogError("Request has RemovedPhotoIds: {@Ids}", request.RemovedPhotoIds);

                var validRemovedIds = request.RemovedPhotoIds
                    .Where(pid => existingPhotoIds.Contains(pid))
                    .ToList();

                _logger.LogError("Valid removed IDs after filter: {@ValidIds}", validRemovedIds);

                removedPhotoIds = validRemovedIds;
            }

            if (request.TempUploadIds?.Any() == true)
            {
                var userId = GetCurrentUserId();

                // Проверяем, что TempUploads существуют и принадлежат текущему пользователю
                var validTempIds = _context.TempUploads
                    .Where(t => request.TempUploadIds.Contains(t.Id) && t.UploaderId == userId)
                    .Select(t => t.Id)
                    .ToList();

                if (validTempIds.Any())
                {
                    addedTempIds = validTempIds;
                }
            }

            if (addedTempIds.Any() || removedPhotoIds.Any())
            {
                changes["Photos"] = new
                {
                    addedTempIds = addedTempIds,
                    removedPhotoIds = removedPhotoIds
                };
            }

            if (addedTempIds.Any() || removedPhotoIds.Any())
            {
                _logger.LogDebug(
                    "Собраны изменения фото. Добавлено: {AddedCount}, Удалено: {RemovedCount}",
                    addedTempIds.Count, removedPhotoIds.Count);
            }
        }

        private OrderResponseDto MapToResponseDto(Order order)
        {
            // Computed TotalPrice
            var total = order.WorkItems.Sum(w => w.Price * w.Quantity);

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
                    .FirstOrDefaultAsync(o => o.Id == id && o.IsDeleted);

                if (order == null)
                    return NotFound("Архивный заказ не найден");

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