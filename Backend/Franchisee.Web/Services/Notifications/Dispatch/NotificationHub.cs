using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using Franchisee.Web.Models.DTOs.Notifications;
using Franchisee.Web.Services.Notifications.Core;

namespace Franchisee.Web.Services.Notifications.Dispatch
{
    [Authorize]
    public class NotificationHub : Hub<INotificationClient>
    {
        private readonly ILogger<NotificationHub> _logger;
        private readonly INotificationService _notificationService;

        public NotificationHub(
            ILogger<NotificationHub> logger,
            INotificationService notificationService)
        {
            _logger = logger;
            _notificationService = notificationService;
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

                await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");

                // Единственное место отправки начального состояния — больше не вызываем RequestCurrentState
                await SendInitialStateAsync(userId);

                await base.OnConnectedAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SignalR] Error UserId={UserId} Exception={Exception}", userId, ex.Message);
                throw;
            }
        }

        private async Task SendInitialStateAsync(int userId)
        {
            try
            {
                var counts = await _notificationService.GetNotificationCountsAsync(userId);
                
                await Clients.Caller.UpdateNotificationCounts(counts);  // ← новый метод
                
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
