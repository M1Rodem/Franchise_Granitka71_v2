using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using Franchisee.Web.Services;           // для INotificationService

namespace Franchisee.Web.Services.Hubs
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
            try
            {
                var userId = GetUserId();
                if (userId <= 0)
                {
                    _logger.LogWarning("SignalR: Не удалось определить userId при подключении");
                    await base.OnConnectedAsync();
                    return;
                }

                var username = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "Anonymous";

                _logger.LogDebug("SignalR: Пользователь {Username} (ID: {UserId}) подключился, ConnectionId: {ConnectionId}",
                    username, userId, Context.ConnectionId);

                await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");

                // Отправляем текущее состояние сразу после подключения
                await SendInitialStateAsync(userId);

                await base.OnConnectedAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при подключении к SignalR");
                throw;
            }
        }

        // Публичный метод — фронт может вызвать при reconnect или вручную
        public async Task RequestCurrentState()
        {
            var userId = GetUserId();
            if (userId <= 0) return;

            await SendInitialStateAsync(userId);
        }

        private async Task SendInitialStateAsync(int userId)
        {
            try
            {
                var count = await _notificationService.GetPendingCountAsync(userId);

                var state = new InitialNotificationStateDto
                {
                    UnreadCount = count
                    // Если позже решим — добавить RecentNotifications
                };

                await Clients.Caller.InitialNotificationState(state);

                _logger.LogDebug("SignalR: Отправлено начальное состояние пользователю {UserId}: {Count} непрочитанных",
                    userId, count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при отправке начального состояния пользователю {UserId}", userId);
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            try
            {
                var userId = GetUserId();
                _logger.LogDebug("SignalR: Пользователь {UserId} отключился", userId);

                await base.OnDisconnectedAsync(exception);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при отключении от SignalR");
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