using Franchisee.Web.Configuration;
using Franchisee.Web.Models.DTOs.Notifications;
using Franchisee.Web.Models.Entities.Notification;
using Franchisee.Web.Models.Entities.Orders;
using Franchisee.Web.Models.Entities.Users;
using Franchisee.Web.Services.Media.Core;
using Franchisee.Web.Services.Notifications.Builders;
using Franchisee.Web.Services.Notifications.Dispatch;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Franchisee.Web.Services.Notifications.Core
{
    public class NotificationService : INotificationService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<NotificationService> _logger;
        private readonly IHubContext<NotificationHub, INotificationClient> _hubContext;
        private readonly IMediaService _mediaService;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            NumberHandling = JsonNumberHandling.AllowReadingFromString,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
        };

        public NotificationService(
            ApplicationDbContext context,
            ILogger<NotificationService> logger,
            IHubContext<NotificationHub, INotificationClient> hubContext,
            IMediaService mediaService)
        {
            _context = context;
            _logger = logger;
            _hubContext = hubContext;
            _mediaService = mediaService;
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
                var order = await _context.Orders
                    .Include(o => o.Manager)
                    .FirstOrDefaultAsync(o => o.Id == orderId);

                if (order == null)
                    throw new ArgumentException($"Заказ {orderId} не найден");

                var initiator = await _context.Managers
                    .FirstOrDefaultAsync(m => m.Id == initiatorId);

                if (initiator == null)
                    throw new ArgumentException($"Инициатор {initiatorId} не найден");

                if (proposedChanges.TryGetValue("Photos", out var photosChangeObj))
                {
                    var photosChange = JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(photosChangeObj));

                    if (photosChange.TryGetProperty("addedTempIds", out var addedTempIdsElement))
                    {
                        var addedTempIds = addedTempIdsElement.Deserialize<List<int>>();

                        if (addedTempIds?.Any() == true)
                        {
                            var tempUploads = await _context.TempUploads
                                .Where(t => addedTempIds.Contains(t.Id) && t.UploaderId == initiatorId)
                                .ToListAsync();

                            foreach (var tempUpload in tempUploads)
                            {
                                tempUpload.ExpiresAt = DateTime.UtcNow.AddDays(14);
                            }

                            await _context.SaveChangesAsync();
                        }
                    }
                }

                if (proposedChanges.TryGetValue("Videos", out var videosChangeObj))
                {
                    var videosChange = JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(videosChangeObj));

                    if (videosChange.TryGetProperty("addedTempIds", out var addedTempIdsElement))
                    {
                        var addedTempIds = addedTempIdsElement.Deserialize<List<int>>();

                        if (addedTempIds?.Any() == true)
                        {
                            var tempUploads = await _context.TempUploads
                                .Where(t => addedTempIds.Contains(t.Id) && t.UploaderId == initiatorId)
                                .ToListAsync();

                            foreach (var tempUpload in tempUploads)
                            {
                                tempUpload.ExpiresAt = DateTime.UtcNow.AddDays(14);
                            }

                            await _context.SaveChangesAsync();
                        }
                    }
                }

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

                if (proposedChanges.TryGetValue("Photos", out photosChangeObj))
                {
                    var photosChange = JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(photosChangeObj));

                    if (photosChange.TryGetProperty("addedTempIds", out var addedTempIdsElement))
                    {
                        var addedTempIds = addedTempIdsElement.Deserialize<List<int>>();

                        if (addedTempIds?.Any() == true)
                        {
                            var tempUploads = await _context.TempUploads
                                .Where(t => addedTempIds.Contains(t.Id) && t.UploaderId == initiatorId)
                                .ToListAsync();

                            foreach (var tempUpload in tempUploads)
                            {
                                tempUpload.NotificationId = notification.Id;
                                tempUpload.ExpiresAt = DateTime.UtcNow.AddDays(14);
                            }

                            await _context.SaveChangesAsync();
                        }
                    }
                }

                if (proposedChanges.TryGetValue("Videos", out videosChangeObj))
                {
                    var videosChange = JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(videosChangeObj));

                    if (videosChange.TryGetProperty("addedTempIds", out var addedTempIdsElement))
                    {
                        var addedTempIds = addedTempIdsElement.Deserialize<List<int>>();

                        if (addedTempIds?.Any() == true)
                        {
                            var tempUploads = await _context.TempUploads
                                .Where(t => addedTempIds.Contains(t.Id) && t.UploaderId == initiatorId)
                                .ToListAsync();

                            foreach (var tempUpload in tempUploads)
                            {
                                tempUpload.NotificationId = notification.Id;
                                tempUpload.ExpiresAt = DateTime.UtcNow.AddDays(14);
                            }

                            await _context.SaveChangesAsync();
                        }
                    }
                }

                var recipientUserIds = new HashSet<int>();
                recipientUserIds.Add(order.ManagerId);

                var admins = await _context.Managers
                    .Where(m => (m.Role == UserRole.Admin || m.Role == UserRole.SuperAdmin) &&
                             m.Id != order.ManagerId && m.Id != initiatorId)
                    .Select(m => m.Id)
                    .ToListAsync();

                foreach (var adminId in admins)
                {
                    recipientUserIds.Add(adminId);
                }

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

                foreach (var userId in recipientUserIds)
                {
                    await SendRealTimeNotificationAsync(notification, userId);
                }
                
                foreach (var userId in recipientUserIds)
                {
                    await SendNotificationCountsUpdateAsync(userId);
                }

                LogNotificationCreated(notification, initiatorId, recipientUserIds.Count);
                LogNotificationDispatch(notification.Id, recipientUserIds.Count);

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

        private async Task SendNotificationCountsUpdateAsync(int userId)
        {
            try
            {
                var counts = await GetNotificationCountsAsync(userId);
                
                await _hubContext.Clients.Group($"user-{userId}")
                    .UpdateNotificationCounts(counts);
                
                _logger.LogDebug("Отправлены counts для UserId: {UserId}, Active={Active}, HasActiveNonSystem={HasActiveNonSystem}",
                    userId, counts.Active, counts.HasActiveNonSystem);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка отправки counts пользователю {UserId}", userId);
            }
        }

        public async Task<NotificationCountsDto> GetNotificationCountsAsync(int userId)
        {
            var now = DateTime.UtcNow;

            // Один запрос к БД с агрегацией
            var result = await _context.NotificationRecipients
                .Where(nr => nr.UserId == userId)
                .Select(nr => new
                {
                    nr.Status,
                    nr.ReturnsAt,
                    IsSystem = nr.Notification.Type == NotificationType.System,
                    IsActive = nr.Status == NotificationStatus.Pending ||
                            (nr.Status == NotificationStatus.Postponed &&
                                nr.ReturnsAt.HasValue &&
                                nr.ReturnsAt <= now),
                    IsPostponed = nr.Status == NotificationStatus.Postponed &&
                                nr.ReturnsAt.HasValue &&
                                nr.ReturnsAt > now,
                    IsHistory = nr.Status == NotificationStatus.Approved ||
                                nr.Status == NotificationStatus.Rejected
                })
                .GroupBy(x => 1) // Группируем всё в одну группу для агрегации
                .Select(g => new NotificationCountsDto
                {
                    Active = g.Count(x => x.IsActive),
                    Postponed = g.Count(x => x.IsPostponed),
                    History = g.Count(x => x.IsHistory),
                    All = g.Count(),
                    
                    HasActiveNonSystem = g.Any(x => x.IsActive && !x.IsSystem),
                    HasPostponed = g.Any(x => x.IsPostponed),
                    HasOnlySystem = g.Count(x => x.IsActive || x.IsPostponed) > 0 &&
                                    !g.Any(x => (x.IsActive || x.IsPostponed) && !x.IsSystem)
                })
                .FirstOrDefaultAsync();

            // Если нет уведомлений, возвращаем пустые значения
            if (result == null)
            {
                return new NotificationCountsDto
                {
                    Active = 0,
                    Postponed = 0,
                    History = 0,
                    All = 0,
                    HasActiveNonSystem = false,
                    HasPostponed = false,
                    HasOnlySystem = false
                };
            }

            return result;
        }

        public async Task<NotificationDetailsDto?> GetNotificationDetailsAsync(
            int notificationId,
            int userId)
        {
            var notification = await _context.Notifications
                .Include(n => n.Initiator)
                .Include(n => n.Order)
                .FirstOrDefaultAsync(n => n.Id == notificationId);

            if (notification == null)
                return null;

            var data = JsonSerializer.Deserialize<JsonElement>(notification.Data);

            string? comment = null;
            string? fullMessage = null;

            if (data.TryGetProperty("comment", out var commentProp))
                comment = commentProp.GetString();

            // Извлекаем полное сообщение из Data
            if (data.TryGetProperty("fullMessage", out var fullMessageProp))
                fullMessage = fullMessageProp.GetString();

            // Если нет fullMessage, используем стандартное (для обратной совместимости)
            if (string.IsNullOrEmpty(fullMessage))
                fullMessage = notification.Message;

            var dto = new NotificationDetailsDto
            {
                Id = notification.Id,
                Type = notification.Type.ToString(),
                Status = notification.Status,
                CreatedAt = notification.CreatedAt,
                Order = new OrderShortDto
                {
                    Id = notification.OrderId ?? 0,
                    Number = notification.Order?.OrderNumber ?? ""
                },
                Initiator = new InitiatorDto
                {
                    Id = notification.InitiatorId,
                    Name = notification.Initiator?.FullName ?? ""
                },
                Comment = comment,
                Message = fullMessage  // ← полное сообщение для деталей
            };

            if (data.TryGetProperty("proposedChanges", out var changes))
            {
                dto.Changes = NotificationDiffBuilder.Build(changes);
            }

            return dto;
        }

        private Task LogSignalRSend(string method, NotificationUpdateDto dto, int userId)
        {
            _logger.LogDebug(
                "[SIGNALR_TRACE] Метод: {Method}, УведомлениеId: {Id}, UserId: {UserId}, Status: {Status}, Type: {Type}",
                method, dto.Id, userId, dto.Status, dto.Type);

            return Task.CompletedTask;
        }

        private void LogNotificationCreated(Notification notification, int initiatorId, int recipientsCount)
        {
            _logger.LogInformation(
                "[Notification] Created Id={Id} Type={Type} OrderId={OrderId} InitiatorId={UserId} Recipients={Count}",
                notification.Id,
                notification.Type,
                notification.OrderId,
                initiatorId,
                recipientsCount);
        }

        private void LogNotificationDispatch(int notificationId, int recipientsCount)
        {
            _logger.LogInformation(
                "[Notification] Dispatch Id={Id} Recipients={Count}",
                notificationId,
                recipientsCount);
        }

        private void LogNotificationUpdated(int notificationId, NotificationStatus status, int userId, string? comment)
        {
            _logger.LogInformation(
                "[Notification] Updated Id={Id} Status={Status} By={UserId} Comment={Comment}",
                notificationId,
                status,
                userId,
                comment ?? string.Empty);
        }

        public async Task<bool> ResolveNotificationAsync(
            int notificationId,
            int userId,
            NotificationStatus status,
            string? note = null)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            List<NotificationRecipient> otherRecipients = new();
            List<int> syncedRecipientUserIds = new();
            
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
                    notification.UpdatedAt = DateTime.UtcNow;

                    // 5. Обновляем глобальный статус уведомления
                    notification.Status = status;
                    notification.ResolvedAt = DateTime.UtcNow;

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    // 6. Обновляем счетчик для пользователя
                    await SendNotificationCountsUpdateAsync(userId);  // ← новый метод


                    // 7. Отправляем SignalR событие об обновлении
                    await SendNotificationResolvedEventAsync(notification, userId, status, note);
                    LogNotificationUpdated(notificationId, status, userId, note);

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
                    notification.UpdatedAt = DateTime.UtcNow;

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

                if (otherRecipients.Any())
                {
                    // Сохраняем в переменную, объявленную в начале
                    syncedRecipientUserIds = otherRecipients.Select(r => r.UserId).Distinct().ToList();

                    foreach (var recipientUserId in syncedRecipientUserIds)
                    {
                        try
                        {
                            await SendNotificationUpdatedEventAsync(notification, recipientUserId);

                            _logger.LogDebug(
                                "Отправлено UpdateNotification синхронизированному получателю {UserId} для уведомления {NotificationId}",
                                recipientUserId, notification.Id);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex,
                                "Ошибка отправки UpdateNotification синхронизированному получателю {UserId}",
                                recipientUserId);
                        }
                    }

                    foreach (var recipientUserId in syncedRecipientUserIds)
                    {
                        await SendNotificationCountsUpdateAsync(recipientUserId);
                    }

                    _logger.LogInformation(
                        "Отправлены SignalR события для {Count} синхронизированных получателей уведомления {NotificationId}",
                        syncedRecipientUserIds.Count, notification.Id);
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // 9. Отправляем SignalR события
                await SendNotificationResolvedEventAsync(notification, userId, status, note);
                LogNotificationUpdated(notificationId, status, userId, note);
                
                // Для влияющих уведомлений
                await SendNotificationCountsUpdateAsync(userId);

                // 10. Отправляем обновления синхронизированным получателям (если есть)
                if (syncedRecipientUserIds.Any())
                {
                    foreach (var recipientUserId in syncedRecipientUserIds)
                    {
                        await SendNotificationCountsUpdateAsync(recipientUserId);
                    }
                }

                if ((status == NotificationStatus.Approved || status == NotificationStatus.Rejected) &&
                    notification.InitiatorId.HasValue &&
                    notification.InitiatorId.Value > 0 &&
                    notification.InitiatorId.Value != userId)
                {
                    var actionText = status == NotificationStatus.Approved ? "приняты" : "отклонены";
                    var resolvedByName = recipient.User?.FullName ?? "Неизвестный пользователь";
                    var orderNumber = notification.Order?.OrderNumber ?? "Без номера";

                    var shortMessage = $"Заказ #{orderNumber}. Ваши изменения {actionText} пользователем {resolvedByName}";

                    string fullMessage;
                    if (!string.IsNullOrEmpty(note))
                    {
                        fullMessage = note;  
                    }
                    else
                    {
                        fullMessage = shortMessage;  // если примечания нет
                    }

                    // Отправляем с разделенными сообщениями
                    await SendSystemNotificationWithFullMessageAsync(
                        shortMessage,
                        fullMessage,
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

                
                List<int> recipientUserIds = new List<int>();

                if (otherRecipients.Any())
                {
                    // Отправляем одно событие UpdateNotification ВСЕМ получателям сразу
                    recipientUserIds = otherRecipients.Select(r => r.UserId).Distinct().ToList();

                    foreach (var recipientUserId in recipientUserIds)
                    {
                        try
                        {
                            await SendNotificationUpdatedEventAsync(notification, recipientUserId);

                            _logger.LogDebug(
                                "Отправлено UpdateNotification синхронизированному получателю {UserId} для уведомления {NotificationId}",
                                recipientUserId, notification.Id);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex,
                                "Ошибка отправки UpdateNotification синхронизированному получателю {UserId}",
                                recipientUserId);
                        }
                    }

                    foreach (var recipientUserId in recipientUserIds)
                    {
                        await SendNotificationCountsUpdateAsync(recipientUserId);
                    }

                    _logger.LogInformation(
                        "Отправлены SignalR события для {Count} синхронизированных получателей уведомления {NotificationId}",
                        recipientUserIds.Count, notification.Id);
                }

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

        public async Task<NotificationResponseDto?> ResolveNotificationWithResultAsync(
            int notificationId,
            int userId,
            NotificationStatus status,
            string? note = null)
        {
            // Вызываем существующий метод
            var success = await ResolveNotificationAsync(notificationId, userId, status, note);
            
            if (!success) return null;
            
            // Получаем обновленное уведомление для этого пользователя
            var recipient = await _context.NotificationRecipients
                .Include(r => r.Notification)
                    .ThenInclude(n => n.Initiator)
                .Include(r => r.Notification)
                    .ThenInclude(n => n.Order)
                .Include(r => r.User)
                .FirstOrDefaultAsync(r => r.NotificationId == notificationId && r.UserId == userId);
            
            if (recipient == null) return null;
            
            // Маппим в DTO
            return MapToDto(recipient);
        }

        public async Task<object> GetNotificationSummary(int userId)
        {
            var now = DateTime.UtcNow;

            var items = await _context.NotificationRecipients
                .Include(r => r.Notification)
                .Where(r => r.UserId == userId)
                .ToListAsync();

            var hasImpact = items.Any(r =>
                r.Status == NotificationStatus.Pending &&
                r.Notification.IsInfluencing
            );

            var hasSnoozed = items.Any(r =>
                r.Status == NotificationStatus.Postponed &&
                r.ReturnsAt > now
            );

            var hasOnlySystem = items.All(r =>
                !r.Notification.IsInfluencing
            );

            return new {
                total = items.Count,
                hasImpact,
                hasSnoozed,
                hasOnlySystem
            };
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
                        UpdatedAt = notification.UpdatedAt,
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

        public async Task<object> GetNotificationSummaryAsync(int userId)
        {
            var now = DateTime.UtcNow;

            var items = await _context.NotificationRecipients
                .Include(r => r.Notification)
                .Include(r => r.Notification.Order)
                .Where(r => r.UserId == userId)
                .ToListAsync();

            var hasImpact = items.Any(r =>
                r.Status == NotificationStatus.Pending &&
                r.Notification.IsInfluencing &&
                r.Notification.Order != null &&
                r.Notification.Order.ManagerId == userId
            );

            var hasSnoozed = items.Any(r =>
                r.Status == NotificationStatus.Postponed &&
                r.ReturnsAt.HasValue &&
                r.ReturnsAt > now
            );

            var hasOnlySystem = items.Any() && items.All(r =>
                !r.Notification.IsInfluencing
            );

            return new
            {
                total = items.Count,
                hasImpact,
                hasSnoozed,
                hasOnlySystem
            };
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
                    .Include(o => o.Photos)
                    .FirstOrDefaultAsync(o => o.Id == notification.OrderId.Value);

                if (order == null)
                {
                    _logger.LogWarning("Заказ {OrderId} не найден для уведомления {NotificationId}",
                        notification.OrderId, notification.Id);
                    return;
                }

                var changesDict = changesProp.Deserialize<Dictionary<string, JsonElement>>();
                if (changesDict == null)
                {
                    _logger.LogWarning("Не удалось десериализовать changesDict для уведомления {NotificationId}", notification.Id);
                    return;
                }

                _logger.LogDebug("Количество изменений в changesDict: {Count}", changesDict.Count);

                bool hasChanges = false;

                foreach (var change in changesDict)
                {
                    var fieldName = change.Key;
                    var changeData = change.Value;

                    _logger.LogDebug("Обработка поля {FieldName}, ValueKind: {ValueKind}",
                        fieldName, changeData.ValueKind);

                    if (changeData.ValueKind == JsonValueKind.Object)
                    {
                        _logger.LogDebug("Field {FieldName} является объектом", fieldName);

                        if (changeData.TryGetProperty("new", out var newValue))
                        {
                            _logger.LogDebug("Найден 'new' в поле {FieldName}, newValue ValueKind: {NewValueKind}",
                                fieldName, newValue.ValueKind);

                            if (fieldName == "WorkItems" || fieldName == "Payments" ||
                                fieldName == "Photos" || fieldName == "Videos") // Добавили Videos
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

                // Обработка Photos (обратная совместимость)
                if (changesDict.TryGetValue("Photos", out var photosProp))
                {
                    _logger.LogDebug("Обработка Photos, ValueKind: {ValueKind}", photosProp.ValueKind);

                    hasChanges |= await ApplyMediaChangesAsync(
                        order.Id,
                        notification.Id,
                        notification.InitiatorId ?? 0,
                        photosProp,
                        MediaType.Photo); // Явно указываем, что это фото
                }

                // НОВОЕ: Обработка Videos
                if (changesDict.TryGetValue("Videos", out var videosProp))
                {
                    _logger.LogDebug("Обработка Videos, ValueKind: {ValueKind}", videosProp.ValueKind);

                    hasChanges |= await ApplyMediaChangesAsync(
                        order.Id,
                        notification.Id,
                        notification.InitiatorId ?? 0,
                        videosProp,
                        MediaType.Video); // Явно указываем, что это видео
                }

                // Обработка TotalPrice если оно есть в changes (но не как отдельный объект)
                if (changesDict.TryGetValue("TotalPrice", out var totalPriceProp))
                {
                    if (totalPriceProp.ValueKind == JsonValueKind.Object &&
                        totalPriceProp.TryGetProperty("new", out var newTotalValue))
                    {
                        _logger.LogDebug("Найдено изменение TotalPrice");
                        hasChanges |= ApplyFieldChange(order, "TotalPrice", newTotalValue);
                    }
                }

                if (hasChanges)
                {
                    // Пересчитываем TotalPrice на всякий случай, но оставляем возможность
                    // ручного изменения через поле TotalPrice в changes
                    if (!changesDict.ContainsKey("TotalPrice"))
                    {
                        order.RecalculateTotals();
                    }

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

        //Применение изменений фото
        private async Task<bool> ApplyMediaChangesAsync(
            int orderId,
            int notificationId,
            int initiatorId,
            JsonElement mediaProp,
            MediaType? expectedMediaType = null) // Необязательный параметр для фильтрации по типу
        {
            try
            {
                _logger.LogDebug("=== ApplyMediaChangesAsync для заказа {OrderId}, уведомление {NotificationId} ===",
                    orderId, notificationId);

                if (_mediaService == null)
                {
                    _logger.LogError("Не удалось получить IMediaService для обработки медиафайлов");
                    return false;
                }

                bool hasChanges = false;

                // Обработка добавленных медиафайлов
                if (mediaProp.TryGetProperty("addedTempIds", out var addedTempIdsElement))
                {
                    var addedTempIds = addedTempIdsElement.Deserialize<List<int>>();

                    if (addedTempIds?.Any() == true)
                    {
                        _logger.LogDebug("Добавление {Count} медиафайлов из временных файлов", addedTempIds.Count);

                        var order = await _context.Orders
                            .Include(o => o.Photos)
                            .FirstOrDefaultAsync(o => o.Id == orderId);

                        if (order == null)
                        {
                            _logger.LogWarning("Заказ {OrderId} не найден при применении изменений медиафайлов", orderId);
                            return false;
                        }

                        // Получаем временные файлы
                        var tempUploads = await _context.TempUploads
                            .Where(t => addedTempIds.Contains(t.Id))
                            .ToListAsync();

                        // Если ожидается конкретный тип медиа, фильтруем
                        if (expectedMediaType.HasValue)
                        {
                            tempUploads = tempUploads.Where(t => t.MediaType == expectedMediaType.Value).ToList();
                        }

                        // Группируем по типу для проверки лимитов
                        var photoTempIds = tempUploads.Where(t => t.MediaType == MediaType.Photo).Select(t => t.Id).ToList();
                        var videoTempIds = tempUploads.Where(t => t.MediaType == MediaType.Video).Select(t => t.Id).ToList();

                        // Проверка лимитов для фото
                        if (photoTempIds.Any())
                        {
                            int currentPhotoCount = order.Photos.Count(p => p.MediaType == MediaType.Photo);
                            int maxPhotos = 10; // MaxPhotosPerOrder

                            if (currentPhotoCount + photoTempIds.Count > maxPhotos)
                            {
                                _logger.LogError("Превышен лимит фото в заказе {OrderId}. Текущее: {Current}, хотим добавить: {ToAdd}",
                                    orderId, currentPhotoCount, photoTempIds.Count);
                                throw new InvalidOperationException(
                                    $"Превышен лимит фото в заказе. Максимум: {maxPhotos}, текущее: {currentPhotoCount}, хотите добавить: {photoTempIds.Count}");
                            }
                        }

                        // Проверка лимитов для видео
                        if (videoTempIds.Any())
                        {
                            int currentVideoCount = order.Photos.Count(p => p.MediaType == MediaType.Video);
                            int maxVideos = 5; // MaxVideosPerOrder

                            if (currentVideoCount + videoTempIds.Count > maxVideos)
                            {
                                _logger.LogError("Превышен лимит видео в заказе {OrderId}. Текущее: {Current}, хотим добавить: {ToAdd}",
                                    orderId, currentVideoCount, videoTempIds.Count);
                                throw new InvalidOperationException(
                                    $"Превышен лимит видео в заказе. Максимум: {maxVideos}, текущее: {currentVideoCount}, хотите добавить: {videoTempIds.Count}");
                            }
                        }

                        var committedCount = 0;

                        foreach (var tempUpload in tempUploads)
                        {
                            try
                            {
                                await _mediaService.CommitTempToOrderAsync(
                                    orderId,
                                    new List<int> { tempUpload.Id },
                                    initiatorId,
                                    tempUpload.MediaType);

                                committedCount++;
                                _logger.LogDebug("Добавлен медиафайл {TempId} (Type: {MediaType}) в заказ {OrderId}",
                                    tempUpload.Id, tempUpload.MediaType, orderId);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "Ошибка коммита временного файла {TempId}", tempUpload.Id);
                            }
                        }

                        if (committedCount > 0)
                        {
                            hasChanges = true;
                            _logger.LogDebug("Добавлено {Count} медиафайлов в заказ {OrderId}", committedCount, orderId);
                        }

                        // Очищаем привязку к уведомлению
                        var remainingTempUploads = await _context.TempUploads
                            .Where(t => addedTempIds.Contains(t.Id))
                            .ToListAsync();

                        foreach (var tempUpload in remainingTempUploads)
                        {
                            tempUpload.NotificationId = null;
                        }

                        await _context.SaveChangesAsync();
                    }
                }

                // Обработка удаленных медиафайлов
                if (mediaProp.TryGetProperty("removedIds", out var removedIdsElement) ||
                    mediaProp.TryGetProperty("removedPhotoIds", out removedIdsElement) ||
                    mediaProp.TryGetProperty("removedMediaIds", out removedIdsElement))
                {
                    var removedIds = removedIdsElement.Deserialize<List<int>>();

                    if (removedIds?.Any() == true)
                    {
                        _logger.LogDebug("Удаление {Count} медиафайлов", removedIds.Count);

                        // Если ожидается конкретный тип, фильтруем ID
                        if (expectedMediaType.HasValue)
                        {
                            var mediaToDelete = await _context.OrderPhotos
                                .Where(m => removedIds.Contains(m.Id) && m.MediaType == expectedMediaType.Value)
                                .Select(m => m.Id)
                                .ToListAsync();

                            foreach (var mediaId in mediaToDelete)
                            {
                                try
                                {
                                    await _mediaService.DeleteMediaFilesAsync(mediaId);
                                    hasChanges = true;
                                    _logger.LogDebug("Удален медиафайл {MediaId} (Type: {ExpectedType}) из заказа {OrderId}",
                                        mediaId, expectedMediaType.Value, orderId);
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogError(ex, "Ошибка удаления медиафайла {MediaId}", mediaId);
                                }
                            }
                        }
                        else
                        {
                            // Нет фильтрации по типу - удаляем все
                            foreach (var mediaId in removedIds)
                            {
                                try
                                {
                                    await _mediaService.DeleteMediaFilesAsync(mediaId);
                                    hasChanges = true;
                                    _logger.LogDebug("Удален медиафайл {MediaId} из заказа {OrderId}", mediaId, orderId);
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogError(ex, "Ошибка удаления медиафайла {MediaId}", mediaId);
                                }
                            }
                        }
                    }
                }

                // Обработка обратной совместимости - ищем поля mediaType
                if (mediaProp.TryGetProperty("mediaType", out var mediaTypeElement) && !expectedMediaType.HasValue)
                {
                    _logger.LogDebug("Найден mediaType в уведомлении: {MediaType}", mediaTypeElement.GetString());
                    // Это просто логирование, тип уже мог быть использован выше
                }

                _logger.LogDebug("=== ApplyMediaChangesAsync УСПЕШНО для заказа {OrderId} ===", orderId);
                return hasChanges;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка применения изменений медиафайлов для заказа {OrderId}", orderId);
                return false;
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
                            // Гарантируем UTC
                            order.OrderDate = date.Kind == DateTimeKind.Utc 
                                ? date 
                                : DateTime.SpecifyKind(date, DateTimeKind.Utc);
                            return true;
                        }
                        break;
                    // НОВОЕ: Обработка геоданных
                    case "Latitude":
                        if (newValue.TryGetDouble(out var lat))
                        {
                            order.Latitude = lat;
                            return true;
                        }
                        break;
                    case "Longitude":
                        if (newValue.TryGetDouble(out var lng))
                        {
                            order.Longitude = lng;
                            return true;
                        }
                        break;
                    case "PlotId":
                        if (newValue.TryGetInt32(out var plotId))
                        {
                            order.PlotId = plotId;
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
                    case "TotalPrice":
                        return false;
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

                // Удаляем старые
                var existing = await _context.OrderWorkItems
                    .Where(w => w.OrderId == orderId)
                    .ToListAsync();

                _context.OrderWorkItems.RemoveRange(existing);

                // Добавляем новые
                foreach (var wi in workItems)
                {
                    wi.OrderId = orderId;
                    wi.Id = 0;

                    _logger.LogDebug("Добавление WorkItem: Description='{Description}', Price={Price}",
                        wi.WorkDescription, wi.Price);

                    _context.OrderWorkItems.Add(wi);
                }

                await _context.SaveChangesAsync();

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

                // Удаляем старые
                var existing = await _context.OrderPayments
                    .Where(p => p.OrderId == orderId)
                    .ToListAsync();

                _context.OrderPayments.RemoveRange(existing);

                // Добавляем новые
                foreach (var p in payments)
                {
                    p.OrderId = orderId;
                    p.Id = 0;

                    // 🔧 ИСПРАВЛЕНИЕ: Гарантируем UTC для PaymentDate
                    if (p.PaymentDate == default)
                    {
                        p.PaymentDate = DateTime.UtcNow;
                    }
                    else if (p.PaymentDate.Kind != DateTimeKind.Utc)
                    {
                        p.PaymentDate = DateTime.SpecifyKind(p.PaymentDate, DateTimeKind.Utc);
                    }

                    _logger.LogDebug("Добавление Payment: Amount={Amount}, Type={Type}, Date={Date} (Kind={Kind})",
                        p.Amount, p.PaymentType, p.PaymentDate, p.PaymentDate.Kind);

                    _context.OrderPayments.Add(p);
                }

                await _context.SaveChangesAsync();

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
                recipient.Notification.UpdatedAt = DateTime.UtcNow;

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

                    var allRecipientIds = allRecipients.Select(r => r.UserId).Distinct();
                    foreach (var id in allRecipientIds)
                    {
                        await SendNotificationCountsUpdateAsync(id); 
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                await SendNotificationResolvedEventAsync(recipient.Notification, userId, NotificationStatus.Postponed, reason);

                await SendNotificationPostponedEventAsync(notificationId, userId, minutes);

                await SendNotificationCountsUpdateAsync(userId);
                LogNotificationUpdated(notificationId, NotificationStatus.Postponed, userId, reason);
                _logger.LogInformation("[Notification] Snoozed Id={Id} Until={ReturnsAt}", notificationId, returnsAt);

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

        public async Task<NotificationResponseDto?> GetNotificationByIdAsync(int notificationId, int userId)
        {
            var recipient = await _context.NotificationRecipients
                .Include(r => r.Notification)
                    .ThenInclude(n => n.Initiator)
                .Include(r => r.Notification)
                    .ThenInclude(n => n.Order)
                .Include(r => r.User)
                .FirstOrDefaultAsync(r => r.NotificationId == notificationId && r.UserId == userId);
            
            return recipient != null ? MapToDto(recipient) : null;
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
                statusFilter = statusFilter?.ToLowerInvariant();

                query = statusFilter switch
                {
                    "active" => query.Where(nr =>
                        nr.Status == NotificationStatus.Pending ||
                        (nr.Status == NotificationStatus.Postponed &&
                        nr.ReturnsAt.HasValue &&
                        nr.ReturnsAt <= now)),

                    "postponed" => query.Where(nr =>
                        nr.Status == NotificationStatus.Postponed &&
                        nr.ReturnsAt.HasValue &&
                        nr.ReturnsAt > now),

                    "history" => query.Where(nr =>
                        nr.Status == NotificationStatus.Approved ||
                        nr.Status == NotificationStatus.Rejected),

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

        public async Task<NotificationBadgeDto> GetNotificationBadgeAsync(int userId)
        {
            var now = DateTime.UtcNow;

            var recipients = await _context.NotificationRecipients
                .Include(nr => nr.Notification)
                .Where(nr => nr.UserId == userId)
                .ToListAsync();

            // Красный: влияющие Pending или просроченные Postponed
            var hasRed = recipients.Any(nr =>
                nr.Notification.IsInfluencing &&
                (nr.Status == NotificationStatus.Pending ||
                (nr.Status == NotificationStatus.Postponed &&
                nr.ReturnsAt.HasValue &&
                nr.ReturnsAt <= now)));

            if (hasRed)
            {
                // ИСПРАВЛЕНИЕ: считаем ВСЕ активные, а не только влияющие
                var count = recipients.Count(nr =>
                    nr.Status == NotificationStatus.Pending ||
                    (nr.Status == NotificationStatus.Postponed &&
                    nr.ReturnsAt.HasValue &&
                    nr.ReturnsAt <= now));

                return new NotificationBadgeDto { Count = count, Color = "red" };
            }

            // Синий: есть активные отложенные
            var hasBlue = recipients.Any(nr =>
                nr.Status == NotificationStatus.Postponed &&
                nr.ReturnsAt.HasValue &&
                nr.ReturnsAt > now);

            if (hasBlue)
            {
                var count = recipients.Count(nr =>
                    nr.Status == NotificationStatus.Postponed &&
                    nr.ReturnsAt.HasValue &&
                    nr.ReturnsAt > now);

                return new NotificationBadgeDto { Count = count, Color = "blue" };
            }

            // Серый: есть информационные
            var hasGray = recipients.Any(nr =>
                !nr.Notification.IsInfluencing &&
                nr.Status == NotificationStatus.Pending);

            if (hasGray)
            {
                var count = recipients.Count(nr =>
                    !nr.Notification.IsInfluencing &&
                    nr.Status == NotificationStatus.Pending);

                return new NotificationBadgeDto { Count = count, Color = "gray" };
            }

            return new NotificationBadgeDto { Count = 0, Color = "none" };
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
                    InitiatorId = initiatorId,
                    OrderId = orderId,
                    Title = title,
                    Message = message,  
                    CreatedAt = DateTime.UtcNow,
                    Data = JsonSerializer.Serialize(new
                    {
                        OrderNumber = orderNumber,
                        IsInformation = isInformationNotification,
                        FullMessage = message 
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
                        await SendNotificationCountsUpdateAsync(recipient.UserId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Ошибка отправки SignalR пользователю {UserId}", recipient.UserId);
                    }
                }

                LogNotificationCreated(systemNotification, initiatorId ?? 0, recipients.Count);
                LogNotificationDispatch(systemNotification.Id, recipients.Count);

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

        public async Task SendSystemNotificationWithFullMessageAsync(
            string shortMessage,   // для списка уведомлений
            string fullMessage,    // для деталей
            int? orderId = null,
            string? orderNumber = null,
            int? initiatorId = null,
            params int[] userIds)
        {
            try
            {
                bool isInformationNotification = shortMessage.StartsWith("Заказ #");

                string title;
                bool isInfluencing = false;

                if (isInformationNotification)
                {
                    var match = System.Text.RegularExpressions.Regex.Match(shortMessage, @"Заказ #(\S+)");
                    title = match.Success ? $"Заказ #{match.Groups[1].Value}" : "Информационное уведомление";
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
                    InitiatorId = initiatorId,
                    OrderId = orderId,
                    Title = title,
                    Message = shortMessage,  // ← краткое для списка
                    CreatedAt = DateTime.UtcNow,
                    Data = JsonSerializer.Serialize(new
                    {
                        OrderNumber = orderNumber,
                        IsInformation = isInformationNotification,
                        FullMessage = fullMessage  // ← полное сообщение для деталей
                    }, JsonOptions)
                };

                _context.Notifications.Add(systemNotification);
                await _context.SaveChangesAsync();

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

                _context.NotificationRecipients.AddRange(recipients);
                await _context.SaveChangesAsync();

                foreach (var recipient in recipients)
                {
                    try
                    {
                        var dto = new NotificationUpdateDto
                        {
                            Id = systemNotification.Id,
                            Type = NotificationType.System,
                            Status = NotificationStatus.Pending,
                            Title = title,
                            Message = shortMessage,  // ← краткое для SignalR
                            CreatedAt = systemNotification.CreatedAt,
                            InitiatorName = "Система"
                        };

                        await _hubContext.Clients.Group($"user-{recipient.UserId}")
                            .ReceiveNotification(dto);

                        await SendNotificationCountsUpdateAsync(recipient.UserId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Ошибка отправки SignalR пользователю {UserId}", recipient.UserId);
                    }
                }

                LogNotificationCreated(systemNotification, initiatorId ?? 0, recipients.Count);
                LogNotificationDispatch(systemNotification.Id, recipients.Count);

                _logger.LogInformation(
                    "Отправлено системное уведомление. ShortMessage: {ShortMessage}, FullMessage: {FullMessage}. Получателей: {Count}",
                    shortMessage, fullMessage, recipients.Count);
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
                var dto = new NotificationUpdateDto
                {
                    Id = notification.Id,
                    Type = notification.Type,
                    Status = notification.Status,
                    Message = notification.Message,
                    CreatedAt = notification.CreatedAt,
                    UpdatedAt = notification.UpdatedAt,
                    OrderId = notification.OrderId,
                    OrderNumber = notification.Order?.OrderNumber ?? "Без номера",
                    InitiatorName = notification.Initiator?.FullName ?? "Неизвестно",
                    Title = notification.Title
                };

                await _hubContext.Clients.Group($"user-{userId}")
                    .ReceiveNotification(dto);

                _logger.LogInformation(
                    "[SignalR] Send NotificationId={NotificationId} RecipientId={UserId} ConnectionId={ConnectionId}",
                    notification.Id,
                    userId,
                    $"user-{userId}");

                await LogSignalRSend("ReceiveNotification", dto, userId);

                _logger.LogDebug(
                    "[SIGNALR] Уведомление {NotificationId} отправлено в группу user-{UserId}. Status: {Status}",
                    notification.Id, userId, notification.Status);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SignalR] Error UserId={UserId} Exception={Exception}", userId, ex.Message);
            }
        }

        private DateTime EnsureUtc(DateTime dateTime)
        {
            return dateTime.Kind == DateTimeKind.Utc 
                ? dateTime 
                : DateTime.SpecifyKind(dateTime, DateTimeKind.Utc);
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

        private NotificationResponseDto MapToDto(NotificationRecipient recipient)
        {
            var notification = recipient.Notification;
            var now = DateTime.UtcNow;

            NotificationChangesPreviewDto? preview = null;

            try
            {
                var data = JsonSerializer.Deserialize<JsonElement>(notification.Data);

                if (data.TryGetProperty("proposedChanges", out var changes))
                {
                    preview = NotificationChangesPreviewBuilder.Build(changes);
                }
            }
            catch { }

            bool isImpactForUser =
                notification.IsInfluencing &&
                notification.Order != null &&
                notification.Order.ManagerId == recipient.UserId;

            bool isInformation = !notification.IsInfluencing;

            bool isPostponedExpired =
                recipient.Status == NotificationStatus.Postponed &&
                recipient.ReturnsAt.HasValue &&
                recipient.ReturnsAt <= now;

            bool isBlocking =
                isImpactForUser &&
                (recipient.Status == NotificationStatus.Pending || isPostponedExpired);

            return new NotificationResponseDto
            {
                Id = notification.Id,
                RecipientId = recipient.Id,
                Type = notification.Type,
                Status = recipient.Status,
                Title = notification.Title,
                Message = notification.Message,
                CreatedAt = notification.CreatedAt,
                UpdatedAt = notification.UpdatedAt,
                ResolvedAt = recipient.ResolvedAt,
                ReturnsAt = recipient.ReturnsAt,
                ResolutionNote = recipient.ResolutionNote,
                UserId = recipient.UserId,
                UserName = recipient.User?.FullName ?? "Неизвестно",
                InitiatorId = notification.InitiatorId,
                InitiatorName = notification.Initiator?.FullName ?? "Неизвестно",
                OrderId = notification.OrderId,
                OrderNumber = notification.Order?.OrderNumber ?? "Без номера",

                MinutesUntilReturn = recipient.ReturnsAt.HasValue && recipient.ReturnsAt > now
                    ? (int)(recipient.ReturnsAt.Value - now).TotalMinutes
                    : 0,

                IsInfluencing = notification.IsInfluencing, // оставляем как raw
                IsImpactForCurrentUser = isImpactForUser,
                IsInformation = isInformation,
                IsBlocking = isBlocking,

                ChangesPreview = preview
            };
        }
    }
}
