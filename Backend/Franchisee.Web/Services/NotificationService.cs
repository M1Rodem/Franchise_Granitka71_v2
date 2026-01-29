using Franchisee.Web.Configuration;
using Franchisee.Web.Models;
using Franchisee.Web.Services.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Franchisee.Web.Services
{
    public class NotificationService : INotificationService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<NotificationService> _logger;
        private readonly IHubContext<NotificationHub, INotificationClient> _hubContext;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            NumberHandling = JsonNumberHandling.AllowReadingFromString,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        public NotificationService(
            ApplicationDbContext context,
            ILogger<NotificationService> logger,
            IHubContext<NotificationHub, INotificationClient> hubContext)
        {
            _context = context;
            _logger = logger;
            _hubContext = hubContext;
        }

        public async Task<int> CreateOrderUpdateRequestAsync(
            int orderId,
            int initiatorId,
            Dictionary<string, object> proposedChanges,
            string comment)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // 1. Получаем заказ и его владельца
                var order = await _context.Orders
                    .Include(o => o.Manager)
                    .FirstOrDefaultAsync(o => o.Id == orderId);

                if (order == null)
                    throw new ArgumentException($"Заказ {orderId} не найден");

                // 2. Получаем инициатора
                var initiator = await _context.Managers
                    .FirstOrDefaultAsync(m => m.Id == initiatorId);

                if (initiator == null)
                    throw new ArgumentException($"Инициатор {initiatorId} не найден");

                // 3. Создаём уведомление
                var notification = new Notification
                {
                    Type = NotificationType.OrderUpdateRequest,
                    Status = NotificationStatus.Pending,
                    IsInfluencing = true,
                    InitiatorId = initiatorId,
                    OrderId = orderId,
                    Title = "Запрос на изменение заказа",
                    Message = $"Менеджер {initiator.FullName} запрашивает изменения заказа {order.OrderNumber}",
                    Data = JsonSerializer.Serialize(new
                    {
                        ProposedChanges = proposedChanges,
                        Comment = comment,
                        OriginalOrderSnapshot = new
                        {
                            order.OrderNumber,
                            order.CustomerFullName,
                            order.DeceasedFullName,
                            order.TotalPrice,
                            order.Status
                        }
                    }, JsonOptions),
                    CreatedAt = DateTime.UtcNow
                };

                _context.Notifications.Add(notification);
                await _context.SaveChangesAsync();

                // 4. Добавляем получателей с УНИКАЛЬНЫМИ ID пользователей
                var recipientUserIds = new HashSet<int>();

                // 4.1. Владелец заказа
                recipientUserIds.Add(order.ManagerId);

                // 4.2. Все админы и суперадмины (кроме владельца и инициатора)
                var admins = await _context.Managers
                    .Where(m => (m.Role == UserRole.Admin || m.Role == UserRole.SuperAdmin)
                             && m.Id != order.ManagerId    // исключаем владельца, если он уже добавлен
                             && m.Id != initiatorId)       // исключаем инициатора
                    .Select(m => m.Id)
                    .ToListAsync();

                // Добавляем админов, гарантируя уникальность
                foreach (var adminId in admins)
                {
                    recipientUserIds.Add(adminId);
                }

                // 4.3. Создаём записи получателей
                var recipients = new List<NotificationRecipient>();
                foreach (var userId in recipientUserIds)
                {
                    recipients.Add(new NotificationRecipient
                    {
                        NotificationId = notification.Id,
                        UserId = userId,
                        Status = NotificationStatus.Pending
                    });
                }

                _context.NotificationRecipients.AddRange(recipients);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // 5. Отправляем SignalR уведомления КАЖДОМУ пользователю ОДИН РАЗ
                foreach (var userId in recipientUserIds)
                {
                    await SendRealTimeNotificationAsync(notification, userId);
                }

                _logger.LogInformation(
                    "Создано уведомление об изменении заказа. ID: {NotificationId}, Заказ: {OrderId}, Уникальных получателей: {Count}",
                    notification.Id, orderId, recipientUserIds.Count);

                return notification.Id;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Ошибка создания уведомления об изменении заказа {OrderId}", orderId);
                throw;
            }
        }
        private Task LogSignalRSend(string method, NotificationUpdateDto dto, int userId)
        {
            _logger.LogDebug(
                "[SIGNALR_TRACE] Метод: {Method}, УведомлениеId: {Id}, UserId: {UserId}, Status: {Status}, Type: {Type}",
                method, dto.Id, userId, dto.Status, dto.Type);

            return Task.CompletedTask;
        }

        public async Task<bool> ResolveNotificationAsync(
            int notificationId,
            int userId,
            NotificationStatus status,
            string? note = null)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // 1. Находим уведомление с получателями
                var notification = await _context.Notifications
                    .Include(n => n.Recipients)
                        .ThenInclude(r => r.User)
                    .Include(n => n.Initiator)
                    .Include(n => n.Order)
                    .FirstOrDefaultAsync(n => n.Id == notificationId);

                if (notification == null)
                {
                    _logger.LogWarning("Уведомление {NotificationId} не найдено", notificationId);
                    return false;
                }

                // НАЧАЛО: НОВАЯ ЛОГИКА ДЛЯ ИНФОРМАЦИОННЫХ УВЕДОМЛЕНИЙ
                bool isInformationNotification = !notification.IsInfluencing;

                // Для информационных уведомлений разрешаем только статус Approved
                if (isInformationNotification && status != NotificationStatus.Approved)
                {
                    _logger.LogWarning(
                        "Информационное уведомление {NotificationId} может быть только Approved. Получен статус: {Status}",
                        notificationId, status);
                    return false;
                }

                // Для информационных уведомлений пропускаем все побочные эффекты
                if (isInformationNotification)
                {
                    // 2. Находим получателя
                    var infoRecipient = notification.Recipients // ИСПРАВЛЕНО: меняем имя переменной
                        .FirstOrDefault(r => r.UserId == userId);

                    if (infoRecipient == null) // ИСПРАВЛЕНО
                    {
                        _logger.LogWarning("Пользователь {UserId} не является получателем уведомления {NotificationId}",
                            userId, notificationId);
                        return false;
                    }

                    // 3. Проверяем текущий статус
                    if (infoRecipient.Status != NotificationStatus.Pending) // ИСПРАВЛЕНО
                    {
                        _logger.LogWarning(
                            "Информационное уведомление {NotificationId} уже обработано. Текущий статус: {CurrentStatus}",
                            notificationId, infoRecipient.Status); // ИСПРАВЛЕНО
                        return false;
                    }

                    // 4. Просто меняем статус получателя (без побочных эффектов)
                    var infoOldStatus = infoRecipient.Status; // ИСПРАВЛЕНО: меняем имя переменной
                    infoRecipient.Status = status; // ИСПРАВЛЕНО
                    infoRecipient.ResolvedAt = DateTime.UtcNow; // ИСПРАВЛЕНО
                    infoRecipient.ResolutionNote = note; // ИСПРАВЛЕНО

                    // 5. Обновляем глобальный статус уведомления
                    notification.Status = status;
                    notification.ResolvedAt = DateTime.UtcNow;

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    // 6. Обновляем счетчик для пользователя
                    await SendNotificationCountUpdateAsync(userId);

                    // 7. Отправляем SignalR событие об обновлении
                    await SendNotificationResolvedEventAsync(notification, userId, status, note);

                    _logger.LogInformation(
                        "Информационное уведомление {NotificationId} убрано пользователем {UserId}. Статус: {OldStatus} -> {NewStatus}",
                        notificationId, userId, infoOldStatus, status); // ИСПРАВЛЕНО

                    return true;
                }
                // КОНЕЦ: НОВОЙ ЛОГИКИ ДЛЯ ИНФОРМАЦИОННЫХ УВЕДОМЛЕНИЙ

                // 2. Находим получателя
                var recipient = notification.Recipients
                    .FirstOrDefault(r => r.UserId == userId);

                if (recipient == null)
                {
                    _logger.LogWarning("Пользователь {UserId} не является получателем уведомления {NotificationId}",
                        userId, notificationId);
                    return false;
                }

                // 3. Проверяем, может ли получатель выполнить действие
                if (!CanRecipientResolve(recipient, status))
                {
                    _logger.LogWarning(
                        "Пользователь {UserId} не может изменить статус уведомления {NotificationId} на {Status}. Текущий статус: {CurrentStatus}",
                        userId, notificationId, status, recipient.Status);
                    return false;
                }

                // 4. Проверяем глобальный статус уведомления
                if (notification.Status != NotificationStatus.Pending &&
                    notification.Status != NotificationStatus.Postponed)
                {
                    _logger.LogWarning(
                        "Уведомление {NotificationId} уже обработано. Текущий глобальный статус: {Status}",
                        notificationId, notification.Status);
                    return false;
                }

                // 5. Обновляем получателя
                var oldStatus = recipient.Status;
                recipient.Status = status;
                recipient.ResolvedAt = DateTime.UtcNow;
                recipient.ResolutionNote = note;

                // 6. Если это первое решение - обновляем глобальный статус
                bool isFirstResolution = notification.Recipients
                    .All(r => r.Status == NotificationStatus.Pending ||
                             r.Status == NotificationStatus.Postponed ||
                             r.UserId == userId);

                if (isFirstResolution)
                {
                    notification.Status = status;
                    notification.ResolvedAt = DateTime.UtcNow;

                    // 7. Если одобрено - применяем изменения
                    if (status == NotificationStatus.Approved &&
                        notification.Type == NotificationType.OrderUpdateRequest)
                    {
                        await ApplyOrderChangesAsync(notification);
                    }
                }

                // 8. Синхронизируем с другими получателями (если это окончательное решение)
                if (status == NotificationStatus.Approved || status == NotificationStatus.Rejected)
                {
                    SyncOtherRecipients(notification, userId, status, note);
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // 9. Отправляем SignalR события
                await SendNotificationResolvedEventAsync(notification, userId, status, note);

                // Обновляем счетчики для всех получателей
                foreach (var recipientId in notification.Recipients.Select(r => r.UserId).Distinct())
                {
                    await SendNotificationCountUpdateAsync(recipientId);
                }

                _logger.LogInformation(
                        "DEBUG: Проверка условия. Status={Status}, InitiatorId={InitiatorId}, userId={userId}, Условие={Condition}",
                        status,
                        notification.InitiatorId,
                        userId,
                        (status == NotificationStatus.Approved || status == NotificationStatus.Rejected)
                );

                // 10. Отправить информационное уведомление инициатору
                if ((status == NotificationStatus.Approved || status == NotificationStatus.Rejected) &&
                    notification.InitiatorId.HasValue &&
                    notification.InitiatorId.Value > 0 &&
                    notification.InitiatorId.Value != userId)
                {
                    var actionText = status == NotificationStatus.Approved ? "приняты" : "отклонены";
                    var resolvedByName = recipient.User?.FullName ?? "Неизвестный пользователь";
                    var orderNumber = notification.Order?.OrderNumber ?? "Без номера";

                    // НОВЫЙ ФОРМАТ СООБЩЕНИЯ - СТРОГО ПО ТРЕБОВАНИЯМ
                    var infoMessage = $"Заказ #{orderNumber} Ваши изменения к заказу {orderNumber} были {actionText} пользователем {resolvedByName}";

                    // Добавляем примечание если есть (в отдельной строке)
                    if (!string.IsNullOrEmpty(note))
                    {
                        infoMessage += $"\nПримечание: {note}";
                    }

                    // Отправляем информационное уведомление
                    await SendSystemNotificationAsync(
                        infoMessage,
                        notification.OrderId,
                        notification.Order?.OrderNumber, 
                        null,
                        notification.InitiatorId.Value);

                    _logger.LogDebug(
                        "Отправлено информационное уведомление инициатору {InitiatorId} о решении по уведомлению {NotificationId}",
                        notification.InitiatorId.Value, notificationId);
                }

                _logger.LogInformation(
                    "Уведомление {NotificationId} обработано пользователем {UserId}. Статус: {Status} ({OldStatus} -> {NewStatus})",
                    notificationId, userId, status, oldStatus, status);

                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex,
                    "Ошибка обработки уведомления {NotificationId} пользователем {UserId}",
                    notificationId, userId);
                throw;
            }
        }

        private async Task SendNotificationUpdatedEventAsync(Notification notification, int userId)
        {
            try
            {
                await _hubContext.Clients.Group($"user-{userId}")
                    .UpdateNotification(new NotificationUpdateDto
                    {
                        Id = notification.Id,
                        Type = notification.Type,
                        Status = notification.Status,
                        Title = notification.Title,
                        Message = notification.Message,
                        CreatedAt = notification.CreatedAt,
                        OrderId = notification.OrderId,
                        OrderNumber = notification.Order?.OrderNumber ?? "Без номера",
                        InitiatorName = notification.Initiator?.FullName ?? "Неизвестно",
                        ReturnsAt = notification.ReturnsAt
                    });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка отправки обновления уведомления");
            }
        }

        private async Task<int> GetPendingCountForUserAsync(int userId)
        {
            var now = DateTime.UtcNow;

            return await _context.NotificationRecipients
                .Where(nr => nr.UserId == userId &&
                            (nr.Status == NotificationStatus.Pending ||
                             (nr.Status == NotificationStatus.Postponed &&
                              nr.ReturnsAt.HasValue &&
                              nr.ReturnsAt <= now)))
                .CountAsync();
        }

        private bool CanRecipientResolve(NotificationRecipient recipient, NotificationStatus newStatus)
        {
            if (recipient.Status == NotificationStatus.Pending)
            {
                return newStatus == NotificationStatus.Approved ||
                       newStatus == NotificationStatus.Rejected ||
                       newStatus == NotificationStatus.Postponed;
            }

            if (recipient.Status == NotificationStatus.Postponed)
            {
                return newStatus == NotificationStatus.Approved ||
                       newStatus == NotificationStatus.Rejected;
            }

            return false; // Уже обработано
        }
        private void SyncOtherRecipients(
            Notification notification,
            int resolvedByUserId,
            NotificationStatus newStatus,
            string? note)
        {
            var otherRecipients = notification.Recipients
                .Where(r => r.UserId != resolvedByUserId &&
                          (r.Status == NotificationStatus.Pending ||
                           r.Status == NotificationStatus.Postponed))
                .ToList();

            foreach (var recipient in otherRecipients)
            {
                recipient.Status = newStatus;
                recipient.ResolvedAt = DateTime.UtcNow;
                recipient.ResolutionNote = $"Синхронизировано: {note ?? "Решение принято другим пользователем"}";
            }

            if (otherRecipients.Any())
            {
                _logger.LogDebug(
                    "Синхронизировано {Count} получателей уведомления {NotificationId}",
                    otherRecipients.Count, notification.Id);
            }
        }

        private async Task ApplyOrderChangesAsync(Notification notification)
        {
            try
            {
                _logger.LogInformation("=== НАЧАЛО ApplyOrderChangesAsync для уведомления {NotificationId} ===", notification.Id);

                var data = JsonSerializer.Deserialize<JsonElement>(notification.Data);
                _logger.LogDebug("Data JSON: {Data}", notification.Data);

                if (!data.TryGetProperty("proposedChanges", out var changesProp) ||
                    !notification.OrderId.HasValue)
                {
                    _logger.LogWarning("Нет данных об изменениях в уведомлении {NotificationId}", notification.Id);
                    return;
                }

                var order = await _context.Orders
                    .Include(o => o.WorkItems)
                    .Include(o => o.Payments)
                    .FirstOrDefaultAsync(o => o.Id == notification.OrderId.Value);

                if (order == null)
                {
                    _logger.LogWarning("Заказ {OrderId} не найден для уведомления {NotificationId}",
                        notification.OrderId, notification.Id);
                    return;
                }

                // Десериализуем изменения
                var changesDict = changesProp.Deserialize<Dictionary<string, JsonElement>>();
                if (changesDict == null)
                {
                    _logger.LogWarning("Не удалось десериализовать changesDict для уведомления {NotificationId}", notification.Id);
                    return;
                }

                _logger.LogDebug("Количество изменений в changesDict: {Count}", changesDict.Count);

                bool hasChanges = false;

                // Применяем изменения к полям
                foreach (var change in changesDict)
                {
                    var fieldName = change.Key;
                    var changeData = change.Value;

                    _logger.LogDebug("Обработка поля {FieldName}, ValueKind: {ValueKind}",
                        fieldName, changeData.ValueKind);

                    // ИСПРАВЛЕНИЕ: Проверяем структуру {old, new}
                    if (changeData.ValueKind == JsonValueKind.Object)
                    {
                        _logger.LogDebug("Field {FieldName} является объектом", fieldName);

                        if (changeData.TryGetProperty("new", out var newValue))
                        {
                            _logger.LogDebug("Найден 'new' в поле {FieldName}, newValue ValueKind: {NewValueKind}",
                                fieldName, newValue.ValueKind);

                            // Пропускаем WorkItems и Payments - обрабатываем отдельно
                            if (fieldName == "WorkItems" || fieldName == "Payments")
                            {
                                _logger.LogDebug("Пропускаем {FieldName} для отдельной обработки", fieldName);
                                continue;
                            }

                            hasChanges |= ApplyFieldChange(order, fieldName, newValue);
                        }
                        else
                        {
                            _logger.LogWarning("Поле {FieldName} не содержит свойства 'new'", fieldName);
                        }
                    }
                }

                // Применяем WorkItems
                if (changesDict.TryGetValue("WorkItems", out var workItemsProp))
                {
                    _logger.LogDebug("Обработка WorkItems, ValueKind: {ValueKind}", workItemsProp.ValueKind);

                    if (workItemsProp.ValueKind == JsonValueKind.Object &&
                        workItemsProp.TryGetProperty("new", out var newWorkItemsValue))
                    {
                        _logger.LogDebug("Найден 'new' в WorkItems, ValueKind: {ValueKind}",
                            newWorkItemsValue.ValueKind);

                        hasChanges |= await ApplyWorkItemsChangesAsync(order.Id, newWorkItemsValue);
                    }
                    else
                    {
                        _logger.LogWarning("WorkItems не содержит 'new' или имеет неправильный формат");
                    }
                }
                else
                {
                    _logger.LogDebug("WorkItems отсутствует в changesDict");
                }

                // Применяем Payments
                if (changesDict.TryGetValue("Payments", out var paymentsProp))
                {
                    _logger.LogDebug("Обработка Payments, ValueKind: {ValueKind}", paymentsProp.ValueKind);

                    if (paymentsProp.ValueKind == JsonValueKind.Object &&
                        paymentsProp.TryGetProperty("new", out var newPaymentsValue))
                    {
                        _logger.LogDebug("Найден 'new' в Payments, ValueKind: {ValueKind}",
                            newPaymentsValue.ValueKind);

                        hasChanges |= await ApplyPaymentsChangesAsync(order.Id, newPaymentsValue);
                    }
                    else
                    {
                        _logger.LogWarning("Payments не содержит 'new' или имеет неправильный формат");
                    }
                }
                else
                {
                    _logger.LogDebug("Payments отсутствует в changesDict");
                }

                if (hasChanges)
                {
                    // Пересчитываем TotalPrice после обновления WorkItems
                    order.TotalPrice = order.WorkItems.Sum(w => w.Price * w.Quantity);
                    order.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();

                    _logger.LogInformation(
                        "=== УСПЕХ: Изменения из уведомления {NotificationId} применены к заказу {OrderId}. TotalPrice: {TotalPrice} ===",
                        notification.Id, order.Id, order.TotalPrice);
                }
                else
                {
                    _logger.LogWarning("=== Нет изменений для применения из уведомления {NotificationId} ===",
                        notification.Id);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "=== ОШИБКА в ApplyOrderChangesAsync для уведомления {NotificationId} ===",
                    notification.Id);
                throw;
            }
        }

        private bool ApplyFieldChange(Order order, string fieldName, JsonElement newValue)
        {
            try
            {
                switch (fieldName)
                {
                    case "Place":
                        order.Place = newValue.ValueKind == JsonValueKind.String ? newValue.GetString() ?? order.Place : order.Place;
                        return true;
                    case "InspectionPlace":
                        order.InspectionPlace = newValue.ValueKind == JsonValueKind.String ? newValue.GetString() ?? order.InspectionPlace : order.InspectionPlace;
                        return true;
                    case "OrderDate":
                        if (newValue.TryGetDateTime(out var date))
                        {
                            order.OrderDate = date.ToUniversalTime();
                            return true;
                        }
                        break;
                    case "DeceasedFullName":
                        order.DeceasedFullName = newValue.ValueKind == JsonValueKind.String ? newValue.GetString() ?? order.DeceasedFullName : order.DeceasedFullName;
                        return true;
                    case "CustomerFullName":
                        order.CustomerFullName = newValue.ValueKind == JsonValueKind.String ? newValue.GetString() ?? order.CustomerFullName : order.CustomerFullName;
                        return true;
                    case "CustomerEmail":
                        order.CustomerEmail = newValue.ValueKind == JsonValueKind.String ? newValue.GetString() ?? order.CustomerEmail : order.CustomerEmail;
                        return true;
                    case "Phone":
                        order.Phone = newValue.ValueKind == JsonValueKind.String ? newValue.GetString() ?? order.Phone : order.Phone;
                        return true;
                    case "Address":
                        order.Address = newValue.ValueKind == JsonValueKind.String ? newValue.GetString() ?? order.Address : order.Address;
                        return true;
                    case "MonumentType":
                        order.MonumentType = newValue.ValueKind == JsonValueKind.String ? newValue.GetString() ?? order.MonumentType : order.MonumentType;
                        return true;
                    case "MonumentSize":
                        order.MonumentSize = newValue.ValueKind == JsonValueKind.String ? newValue.GetString() ?? order.MonumentSize : order.MonumentSize;
                        return true;
                    case "AdditionalInfo":
                        order.AdditionalInfo = newValue.ValueKind == JsonValueKind.String ? newValue.GetString() ?? order.AdditionalInfo : order.AdditionalInfo;
                        return true;
                    case "Status":
                        if (newValue.ValueKind == JsonValueKind.String &&
                            Enum.TryParse<OrderStatus>(newValue.GetString(), out var status))
                        {
                            order.Status = status;
                            return true;
                        }
                        break;
                }
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка применения изменения поля {FieldName}", fieldName);
                return false;
            }
        }

        private async Task<bool> ApplyWorkItemsChangesAsync(int orderId, JsonElement newWorkItemsValue)
        {
            try
            {
                _logger.LogDebug("=== ApplyWorkItemsChangesAsync для заказа {OrderId} ===", orderId);
                _logger.LogDebug("newWorkItemsValue JSON: {Json}", newWorkItemsValue.GetRawText());

                // ИСПРАВЛЕНИЕ: Использовать PropertyNameCaseInsensitive
                var workItems = newWorkItemsValue.Deserialize<List<OrderWorkItem>>(new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    NumberHandling = JsonNumberHandling.AllowReadingFromString
                });

                if (workItems == null)
                {
                    _logger.LogWarning("Не удалось десериализовать WorkItems для заказа {OrderId}", orderId);
                    return false;
                }

                _logger.LogDebug("Десериализовано {Count} WorkItems", workItems.Count);

                for (int i = 0; i < workItems.Count; i++)
                {
                    var wi = workItems[i];
                    _logger.LogDebug("WorkItem {Index}: Description='{Description}', Price={Price}, Quantity={Quantity}",
                        i, wi.WorkDescription, wi.Price, wi.Quantity);
                }

                // Удаляем старые
                var existing = await _context.OrderWorkItems
                    .Where(w => w.OrderId == orderId)
                    .ToListAsync();

                _logger.LogDebug("Удаление {Count} старых WorkItems", existing.Count);
                _context.OrderWorkItems.RemoveRange(existing);

                // Добавляем новые
                foreach (var wi in workItems)
                {
                    wi.OrderId = orderId;
                    wi.Id = 0;

                    // ЗАЩИТА: Если Description пустой после десериализации
                    if (string.IsNullOrEmpty(wi.WorkDescription))
                    {
                        _logger.LogWarning("WorkItem имеет пустой WorkDescription после десериализации!");
                    }

                    _logger.LogDebug("Добавление WorkItem: Description='{Description}', Price={Price}",
                        wi.WorkDescription, wi.Price);

                    _context.OrderWorkItems.Add(wi);
                }

                _logger.LogDebug("=== ApplyWorkItemsChangesAsync УСПЕШНО для заказа {OrderId} ===", orderId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка применения изменений WorkItems для заказа {OrderId}", orderId);
                return false;
            }
        }

        private async Task<bool> ApplyPaymentsChangesAsync(int orderId, JsonElement newPaymentsValue)
        {
            try
            {
                _logger.LogDebug("=== ApplyPaymentsChangesAsync для заказа {OrderId} ===", orderId);
                _logger.LogDebug("newPaymentsValue JSON: {Json}", newPaymentsValue.GetRawText());

                // ИСПРАВЛЕНИЕ: Использовать PropertyNameCaseInsensitive
                var payments = newPaymentsValue.Deserialize<List<OrderPayment>>(new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    NumberHandling = JsonNumberHandling.AllowReadingFromString
                });

                if (payments == null)
                {
                    _logger.LogWarning("Не удалось десериализовать Payments для заказа {OrderId}", orderId);
                    return false;
                }

                _logger.LogDebug("Десериализовано {Count} Payments", payments.Count);

                for (int i = 0; i < payments.Count; i++)
                {
                    var p = payments[i];
                    _logger.LogDebug("Payment {Index}: Amount={Amount}, Type={Type}, Date={Date}",
                        i, p.Amount, p.PaymentType, p.PaymentDate);
                }

                // Удаляем старые
                var existing = await _context.OrderPayments
                    .Where(p => p.OrderId == orderId)
                    .ToListAsync();

                _logger.LogDebug("Удаление {Count} старых Payments", existing.Count);
                _context.OrderPayments.RemoveRange(existing);

                // Добавляем новые
                foreach (var p in payments)
                {
                    p.OrderId = orderId;
                    p.Id = 0;

                    // Убедиться, что PaymentDate установлен
                    if (p.PaymentDate == default)
                    {
                        p.PaymentDate = DateTime.UtcNow;
                    }

                    _logger.LogDebug("Добавление Payment: Amount={Amount}, Type={Type}",
                        p.Amount, p.PaymentType);

                    _context.OrderPayments.Add(p);
                }

                _logger.LogDebug("=== ApplyPaymentsChangesAsync УСПЕШНО для заказа {OrderId} ===", orderId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка применения изменений Payments для заказа {OrderId}", orderId);
                return false;
            }
        }

        public async Task<bool> PostponeNotificationAsync(
            int notificationId,
            int userId,
            int minutes = 30,
            string? reason = null)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // Находим получателя с уведомлением
                var recipient = await _context.NotificationRecipients
                    .Include(nr => nr.Notification)
                        .ThenInclude(n => n.Order)
                    .Include(nr => nr.Notification)
                        .ThenInclude(n => n.Initiator)
                    .FirstOrDefaultAsync(nr => nr.NotificationId == notificationId && nr.UserId == userId);

                if (recipient == null)
                {
                    _logger.LogWarning("Получатель {UserId} не найден для уведомления {NotificationId}",
                        userId, notificationId);
                    return false;
                }

                // Проверяем, может ли получатель отложить
                if (!CanRecipientResolve(recipient, NotificationStatus.Postponed))
                {
                    _logger.LogWarning(
                        "Пользователь {UserId} не может отложить уведомление {NotificationId}. Текущий статус: {CurrentStatus}",
                        userId, notificationId, recipient.Status);
                    return false;
                }

                var returnsAt = DateTime.UtcNow.AddMinutes(minutes);

                // Сохраняем старый статус для логирования
                var oldStatus = recipient.Status;

                // Обновляем получателя
                recipient.Status = NotificationStatus.Postponed;
                recipient.ResolvedAt = DateTime.UtcNow;
                recipient.ReturnsAt = returnsAt;
                recipient.ResolutionNote = reason ?? $"Отложено на {minutes} минут";

                // Если все получатели отложили - обновляем глобальный статус
                var allRecipients = await _context.NotificationRecipients
                    .Where(nr => nr.NotificationId == notificationId)
                    .ToListAsync();

                bool allPostponed = allRecipients.All(r =>
                    r.Status == NotificationStatus.Postponed ||
                    r.UserId == userId); // исключаем текущего пользователя, т.к. его статус уже обновлён

                if (allPostponed)
                {
                    var notification = recipient.Notification;
                    notification.Status = NotificationStatus.Postponed;
                    notification.ReturnsAt = returnsAt;
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                await SendNotificationResolvedEventAsync(recipient.Notification, userId, NotificationStatus.Postponed, reason);

                await SendNotificationPostponedEventAsync(notificationId, userId, minutes);

                await SendNotificationCountUpdateAsync(userId);

                _logger.LogInformation(
                    "Уведомление {NotificationId} отложено пользователем {UserId} на {Minutes} минут. " +
                    "Статус: {OldStatus} -> {NewStatus}",
                    notificationId, userId, minutes, oldStatus, NotificationStatus.Postponed);

                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Ошибка откладывания уведомления {NotificationId}", notificationId);
                throw;
            }
        }


        public async Task<IEnumerable<NotificationResponseDto>> GetUserNotificationsAsync(
            int userId,
            string? statusFilter = null)
        {
            var query = _context.NotificationRecipients
                .Include(nr => nr.Notification)
                    .ThenInclude(n => n.Initiator)
                .Include(nr => nr.Notification)
                    .ThenInclude(n => n.Order)
                .Include(nr => nr.User)
                .Where(nr => nr.UserId == userId);

            var now = DateTime.UtcNow;

            if (!string.IsNullOrEmpty(statusFilter))
            {
                statusFilter = statusFilter.ToLower();
                query = statusFilter switch
                {
                    "active" => query.Where(nr =>
                        nr.Status == NotificationStatus.Pending ||
                        (nr.Status == NotificationStatus.Postponed &&
                         nr.ReturnsAt.HasValue &&
                         nr.ReturnsAt > now)),

                    "postponed" => query.Where(nr => nr.Status == NotificationStatus.Postponed),

                    "pending" => query.Where(nr => nr.Status == NotificationStatus.Pending),
                    "approved" => query.Where(nr => nr.Status == NotificationStatus.Approved),
                    "rejected" => query.Where(nr => nr.Status == NotificationStatus.Rejected),
                    "all" => query,

                    _ => query.Where(nr => nr.Status == NotificationStatus.Pending)
                };
            }
            else
            {
                query = query.Where(nr => nr.Status == NotificationStatus.Pending);
            }

            var recipients = await query
                .OrderByDescending(nr => nr.Notification.CreatedAt)
                .ToListAsync();

            return recipients.Select(r => MapToDto(r));
        }

        public async Task<int> GetPendingCountAsync(int userId)
        {
            var now = DateTime.UtcNow;

            return await _context.NotificationRecipients
                .Where(nr => nr.UserId == userId &&
                            (nr.Status == NotificationStatus.Pending ||
                             (nr.Status == NotificationStatus.Postponed &&
                              nr.ReturnsAt.HasValue &&
                              nr.ReturnsAt > now)))
                .CountAsync();
        }

        public async Task<int> GetBlockingNotificationsCount(int userId)
        {
            var now = DateTime.UtcNow;

            return await _context.NotificationRecipients
                .Include(nr => nr.Notification)
                .Where(nr => nr.UserId == userId &&
                            nr.Notification.IsInfluencing &&
                            (nr.Status == NotificationStatus.Pending ||
                             (nr.Status == NotificationStatus.Postponed &&
                              nr.ReturnsAt.HasValue &&
                              nr.ReturnsAt <= now)))
                .CountAsync();
        }

        public async Task SyncNotificationStatusAsync(
            int notificationId,
            int resolvedByUserId,
            NotificationStatus newStatus)
        {
            var recipients = await _context.NotificationRecipients
                .Where(nr => nr.NotificationId == notificationId &&
                            nr.UserId != resolvedByUserId &&
                            (nr.Status == NotificationStatus.Pending ||
                             nr.Status == NotificationStatus.Postponed))
                .ToListAsync();

            foreach (var recipient in recipients)
            {
                recipient.Status = newStatus;
                recipient.ResolvedAt = DateTime.UtcNow;
                recipient.ResolutionNote = $"Синхронизировано автоматически";
            }

            if (recipients.Any())
            {
                await _context.SaveChangesAsync();
                _logger.LogDebug("Синхронизировано {Count} получателей", recipients.Count);
            }
        }

        public async Task SendSystemNotificationAsync(
            string message,
            int? orderId = null,
            string? orderNumber = null,
            int? initiatorId = null,
            params int[] userIds)
        {
            try
            {
                bool isInformationNotification = message.StartsWith("Заказ #");

                string title;
                bool isInfluencing = false;

                if (isInformationNotification)
                {
                    var match = System.Text.RegularExpressions.Regex.Match(message, @"Заказ #(\S+)");
                    title = match.Success ? $"Заказ #{match.Groups[1].Value}" : "Информационное уведомление";

                    // Если номер заказа не передан, берем из сообщения
                    orderNumber ??= match.Success ? match.Groups[1].Value : null;
                }
                else
                {
                    title = "Системное уведомление";
                }

                var systemNotification = new Notification
                {
                    Type = NotificationType.System,
                    Status = NotificationStatus.Pending,
                    IsInfluencing = isInfluencing,
                    InitiatorId = initiatorId, // ← МОЖЕТ БЫТЬ ЗАПОЛНЕНО
                    OrderId = orderId, // ← МОЖЕТ БЫТЬ ЗАПОЛНЕНО
                    Title = title,
                    Message = message,
                    CreatedAt = DateTime.UtcNow,
                    Data = JsonSerializer.Serialize(new
                    {
                        OrderNumber = orderNumber,
                        IsInformation = isInformationNotification
                    }, JsonOptions)
                };

                // 2. Сохраняем уведомление в БД
                _context.Notifications.Add(systemNotification);
                await _context.SaveChangesAsync();

                // 3. Создаем получателей для каждого пользователя
                var recipients = new List<NotificationRecipient>();
                foreach (var userId in userIds.Distinct())
                {
                    recipients.Add(new NotificationRecipient
                    {
                        NotificationId = systemNotification.Id,
                        UserId = userId,
                        Status = NotificationStatus.Pending
                    });
                }

                // 4. Сохраняем получателей в БД
                _context.NotificationRecipients.AddRange(recipients);
                await _context.SaveChangesAsync();

                // 5. Отправляем через SignalR
                foreach (var recipient in recipients)
                {
                    try
                    {
                        var dto = new NotificationUpdateDto
                        {
                            Id = systemNotification.Id,
                            Type = NotificationType.System,
                            Status = NotificationStatus.Pending,
                            Title = title, // Правильный заголовок
                            Message = message,
                            CreatedAt = systemNotification.CreatedAt,
                            InitiatorName = "Система"
                        };

                        await _hubContext.Clients.Group($"user-{recipient.UserId}")
                            .ReceiveNotification(dto);

                        // 6. Обновляем счетчик уведомлений
                        await SendNotificationCountUpdateAsync(recipient.UserId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Ошибка отправки SignalR пользователю {UserId}", recipient.UserId);
                    }
                }

                _logger.LogInformation(
                    "Отправлено {Type} уведомление: {Message}. Получателей: {Count}",
                    isInformationNotification ? "информационное" : "системное",
                    message, recipients.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка отправки системного уведомления");
                throw;
            }
        }

        private async Task SendRealTimeNotificationAsync(Notification notification, int userId)
        {
            try
            {
                _logger.LogDebug(
                    "[SIGNALR] Отправка уведомления {NotificationId} в группу user-{UserId}",
                    notification.Id, userId);

                var dto = new NotificationUpdateDto
                {
                    Id = notification.Id,
                    Type = notification.Type,
                    Status = notification.Status, // ← ДОБАВИТЬ ЭТУ СТРОКУ!
                    Message = notification.Message,
                    CreatedAt = notification.CreatedAt,
                    OrderId = notification.OrderId,
                    OrderNumber = notification.Order?.OrderNumber ?? "Без номера",
                    InitiatorName = notification.Initiator?.FullName ?? "Неизвестно",
                    Title = notification.Title
                };

                // остальной код без изменений
                await _hubContext.Clients.Group($"user-{userId}")
                    .ReceiveNotification(dto);

                await LogSignalRSend("ReceiveNotification", dto, userId);

                _logger.LogDebug(
                    "[SIGNALR] Уведомление {NotificationId} отправлено в группу user-{UserId}. Status: {Status}",
                    notification.Id, userId, notification.Status); // ← Добавить логирование статуса

                // Обновляем счетчик
                await SendNotificationCountUpdateAsync(userId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка отправки уведомления пользователю {UserId}", userId);
            }
        }

        private async Task SendNotificationResolvedEventAsync(
    Notification notification,
    int userId,
    NotificationStatus status,
    string? note)
        {
            try
            {
                if (status == NotificationStatus.Approved || status == NotificationStatus.Rejected)
                {
                    // Используем HashSet для гарантии уникальности пользователей
                    var uniqueUserIds = notification.Recipients
                        .Select(r => r.UserId)
                        .Distinct()
                        .ToList();

                    _logger.LogDebug(
                        "[SIGNALR] Отправка NotificationResolved. NotificationId: {NotificationId}, Уникальных получателей: {Count}",
                        notification.Id, uniqueUserIds.Count);

                    foreach (var recipientUserId in uniqueUserIds)
                    {
                        // Ключевое исправление: НЕ отправляем NotificationResolved пользователю, который сам принял решение
                        if (recipientUserId == userId)
                        {
                            _logger.LogDebug(
                                "[SIGNALR] Пропускаем отправку NotificationResolved пользователю {UserId} - он принял решение",
                                recipientUserId);
                            continue;
                        }

                        await _hubContext.Clients.Group($"user-{recipientUserId}")
                            .NotificationResolved(new NotificationResolvedDto
                            {
                                NotificationId = notification.Id,
                                Status = status,
                                ResolvedBy = notification.Recipients
                                    .First(r => r.UserId == userId)
                                    .User?.FullName ?? "Неизвестно",
                                ResolvedAt = DateTime.UtcNow,
                                Note = note,
                                OrderId = notification.OrderId,
                                OrderNumber = notification.Order?.OrderNumber
                            });

                        _logger.LogDebug(
                            "[SIGNALR] NotificationResolved отправлен пользователю {UserId} для уведомления {NotificationId}",
                            recipientUserId, notification.Id);
                    }

                    _logger.LogDebug(
                        "[SIGNALR] Отправлено NotificationResolved для уведомления {NotificationId} получателям (кроме пользователя {UserId})",
                        notification.Id, userId);
                }
                else if (status == NotificationStatus.Postponed)
                {
                    // Для отложенных уведомлений отправляем UpdateNotification всем получателям
                    var recipientUserIds = notification.Recipients
                        .Select(r => r.UserId)
                        .Distinct()
                        .ToList();

                    _logger.LogDebug(
                        "[SIGNALR] Отправка UpdateNotification (Postponed). NotificationId: {NotificationId}, Получателей: {Count}",
                        notification.Id, recipientUserIds.Count);

                    foreach (var recipientUserId in recipientUserIds)
                    {
                        await _hubContext.Clients.Group($"user-{recipientUserId}")
                            .UpdateNotification(new NotificationUpdateDto
                            {
                                Id = notification.Id,
                                Type = notification.Type,
                                Status = status,
                                Title = notification.Title,
                                Message = notification.Message,
                                CreatedAt = notification.CreatedAt,
                                OrderId = notification.OrderId,
                                OrderNumber = notification.Order?.OrderNumber ?? "Без номера",
                                InitiatorName = notification.Initiator?.FullName ?? "Неизвестно",
                                ReturnsAt = notification.ReturnsAt
                            });

                        _logger.LogDebug(
                            "[SIGNALR] UpdateNotification (Postponed) отправлен пользователю {UserId} для уведомления {NotificationId}",
                            recipientUserId, notification.Id);
                    }

                    _logger.LogDebug(
                        "[SIGNALR] Отправлено UpdateNotification (Postponed) для уведомления {NotificationId} всем получателям",
                        notification.Id);
                }
                else if (status == NotificationStatus.Pending)
                {
                    // Обработка сброса статуса на Pending (если потребуется)
                    _logger.LogDebug(
                        "[SIGNALR] Статус Pending не требует отправки события разрешения для уведомления {NotificationId}",
                        notification.Id);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "[SIGNALR] Ошибка отправки события разрешения уведомления {NotificationId}. Status: {Status}, UserId: {UserId}",
                    notification.Id, status, userId);
            }
        }

        private async Task SendNotificationPostponedEventAsync(int notificationId, int userId, int minutes)
        {
            try
            {
                var returnsAt = DateTime.UtcNow.AddMinutes(minutes);

                await _hubContext.Clients.Group($"user-{userId}")
                    .NotificationPostponed(new NotificationPostponedDto
                    {
                        NotificationId = notificationId,
                        ReturnsAt = returnsAt,
                        Minutes = minutes
                    });

                _logger.LogDebug("SignalR: Отправлено событие NotificationPostponed для уведомления {NotificationId} пользователю {UserId}",
                    notificationId, userId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка отправки события откладывания уведомления");
            }
        }

        private async Task SendNotificationCountUpdateAsync(int userId)
        {
            try
            {
                var count = await GetPendingCountAsync(userId);
                _logger.LogDebug("Обновление счетчика уведомлений для UserId: {UserId}, Count: {Count}", userId, count);

                await _hubContext.Clients.Group($"user-{userId}")
                    .UpdateNotificationCount(count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка отправки обновления счетчика пользователю {UserId}", userId);
            }
        }

        private NotificationResponseDto MapToDto(NotificationRecipient recipient)
        {
            var notification = recipient.Notification;
            var now = DateTime.UtcNow;

            bool isInfluencing = notification.IsInfluencing;
            bool isInformation = !isInfluencing;

            bool isPostponedWithExpiredTime = recipient.Status == NotificationStatus.Postponed &&
                                              recipient.ReturnsAt.HasValue &&
                                              recipient.ReturnsAt <= now;

            bool isBlocking = isInfluencing &&
                             (recipient.Status == NotificationStatus.Pending ||
                              isPostponedWithExpiredTime);

            var dto = new NotificationResponseDto
            {
                Id = notification.Id,
                RecipientId = recipient.Id,
                Type = notification.Type,
                Status = recipient.Status,
                Title = notification.Title,
                Message = notification.Message,
                CreatedAt = notification.CreatedAt,
                ResolvedAt = recipient.ResolvedAt,
                ReturnsAt = recipient.ReturnsAt,
                ResolutionNote = recipient.ResolutionNote,
                UserId = recipient.UserId,
                UserName = recipient.User?.FullName ?? "Неизвестно",
                InitiatorId = notification.InitiatorId,
                InitiatorName = notification.Initiator?.FullName ?? "Неизвестно",
                OrderId = notification.OrderId,
                OrderNumber = notification.Order?.OrderNumber ?? "Без номера",
                Data = JsonSerializer.Deserialize<JsonElement>(notification.Data),
                MinutesUntilReturn = recipient.ReturnsAt.HasValue && recipient.ReturnsAt > now
                    ? (int)(recipient.ReturnsAt.Value - now).TotalMinutes
                    : 0,
                IsInfluencing = isInfluencing,
                IsBlocking = isBlocking,
                IsInformation = isInformation
            };

            return dto;
        }
    }
}