using Franchisee.Web.Configuration;
using Franchisee.Web.Models.DTOs.Notifications;
using Franchisee.Web.Models.DTOs.Orders;
using Franchisee.Web.Models.Entities.Users;
using Franchisee.Web.Services.Notifications.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Franchisee.Web.Services.Notifications.Dispatch
{
    [Authorize]
    public class NotificationHub : Hub<INotificationClient>
    {
        private readonly ILogger<NotificationHub> _logger;
        private readonly INotificationService _notificationService;
        private readonly ApplicationDbContext _context;

        public NotificationHub(
            ILogger<NotificationHub> logger,
            INotificationService notificationService,
            ApplicationDbContext context) 
        {
            _logger = logger;
            _notificationService = notificationService;
            _context = context; 
        }

        public override async Task OnConnectedAsync()
        {
            var userId = GetUserId();
            try
            {
                if (userId <= 0)
                {
                    _logger.LogWarning("SignalR: Не удалось определить userId при подключении");
                    await base.OnConnectedAsync();
                    return;
                }

                _logger.LogInformation(
                    "[SignalR] UserId={UserId} Connected via {ConnectionId} at {Timestamp}",
                    userId,
                    Context.ConnectionId,
                    DateTime.UtcNow);

                // Основная группа пользователя
                await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");

                // ========== НОВОЕ: Добавляем SuperAdmin в глобальную группу ==========
                if (await IsSuperAdminAsync(userId))
                {
                    await Groups.AddToGroupAsync(Context.ConnectionId, "SuperAdmins");
                    _logger.LogInformation(
                        "[SignalR] UserId={UserId} added to SuperAdmins group",
                        userId);
                }
                // ====================================================================

                await SendInitialStateAsync(userId);
                await base.OnConnectedAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SignalR] Error UserId={UserId} Exception={Exception}", userId, ex.Message);
                throw;
            }
        }

        // ВСПОМОГАТЕЛЬНЫЙ МЕТОД 
        private async Task<bool> IsSuperAdminAsync(int userId)
        {
            try
            {
                var userRoleClaim = Context.User?.FindFirst(ClaimTypes.Role)?.Value;
                if (userRoleClaim == "SuperAdmin")
                    return true;

                var manager = await _context.Managers
                    .Where(m => m.Id == userId)
                    .Select(m => new { m.Role })
                    .FirstOrDefaultAsync();

                if (manager == null)
                {
                    _logger.LogWarning("IsSuperAdminAsync: пользователь {UserId} не найден в БД", userId);
                    return false;
                }

                return manager.Role == UserRole.SuperAdmin;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка проверки роли SuperAdmin для UserId={UserId}", userId);
                return false;
            }
        }

        /// <summary>
        /// Отправить уведомление всем SuperAdmin о новом запросе на выполнение
        /// </summary>
        /// <param name="data">Данные запроса</param>
        public async Task SendCompletionRequestToSuperAdmin(CompletionNotificationDataDto data)
        {
            try
            {
                _logger.LogInformation(
                    "[SignalR] Sending completion request to SuperAdmins group. OrderId={OrderId}, OrderNumber={OrderNumber}",
                    data.OrderId, data.OrderNumber);

                await Clients.Group("SuperAdmins").CompletionRequestReceived(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SignalR] Error sending completion request to SuperAdmins");
                throw;
            }
        }

        /// <summary>
        /// Отправить результат проверки инициатору
        /// </summary>
        /// <param name="initiatorId">ID инициатора (менеджера)</param>
        /// <param name="result">Результат проверки</param>
        public async Task SendCompletionResultToInitiator(int initiatorId, CompletionResultDto result)
        {
            try
            {
                _logger.LogInformation(
                    "[SignalR] Sending completion result to InitiatorId={InitiatorId}. OrderId={OrderId}, Approved={Approved}",
                    initiatorId, result.OrderId, result.Approved);

                await Clients.Group($"user-{initiatorId}").CompletionResultReceived(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SignalR] Error sending completion result to InitiatorId={InitiatorId}", initiatorId);
                throw;
            }
        }

        private async Task SendInitialStateAsync(int userId)
        {
            try
            {
                var counts = await _notificationService.GetNotificationCountsAsync(userId);

                await Clients.Caller.UpdateNotificationCounts(counts);
                
                _logger.LogDebug("SignalR: Отправлены начальные counts пользователю {UserId}: Active={Active}, HasActiveNonSystem={HasActiveNonSystem}",
                    userId, counts.Active, counts.HasActiveNonSystem);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при отправке начальных counts пользователю {UserId}", userId);
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = GetUserId();
            var reason = exception?.Message ?? "ClientDisconnected";
            try
            {
                _logger.LogInformation(
                    "[SignalR] UserId={UserId} Disconnected {ConnectionId} Reason={Reason}",
                    userId,
                    Context.ConnectionId,
                    reason);

                await base.OnDisconnectedAsync(exception);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SignalR] Error UserId={UserId} Exception={Exception}", userId, ex.Message);
            }
        }

        public async Task MarkAsSeen(int notificationId)
        {
            try
            {
                var userId = GetUserId();
                _logger.LogDebug("SignalR: Пользователь {UserId} отметил уведомление {NotificationId} как прочитанное",
                    userId, notificationId);

                // Здесь можно добавить логику отметки в БД, если нужно
                await Clients.Caller.NotificationSeen(notificationId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка в методе MarkAsSeen");
            }
        }

        /// <summary>
        /// Отправить уведомление всем SuperAdmin
        /// </summary>
        public async Task NotifySuperAdminsAboutCompletion(CompletionNotificationDataDto data)
        {
            await Clients.Group("SuperAdmins").CompletionRequestReceived(data);
        }

        /// <summary>
        /// Отправить результат инициатору
        /// </summary>
        public async Task NotifyInitiatorAboutCompletionResult(int initiatorId, CompletionResultDto result)
        {
            await Clients.Group($"user-{initiatorId}").CompletionResultReceived(result);
        }

        private int GetUserId()
        {
            try
            {
                var userIdStr = Context.User?.FindFirst(ClaimTypes.Name)?.Value;
                if (string.IsNullOrEmpty(userIdStr))
                {
                    _logger.LogWarning("UserId claim не найден в SignalR контексте");
                    return 0;
                }

                if (int.TryParse(userIdStr, out int id))
                {
                    return id;
                }

                _logger.LogWarning("Неверный формат UserId: {UserIdStr}", userIdStr);
                return 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения UserId из claims");
                return 0;
            }
        }
    }
}
