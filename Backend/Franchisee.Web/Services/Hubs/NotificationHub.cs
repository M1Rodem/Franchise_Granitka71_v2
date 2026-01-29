using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace Franchisee.Web.Services.Hubs
{
    [Authorize]
    public class NotificationHub : Hub<INotificationClient>
    {
        private readonly ILogger<NotificationHub> _logger;

        public NotificationHub(ILogger<NotificationHub> logger)
        {
            _logger = logger;
        }

        public override async Task OnConnectedAsync()
        {
            try
            {
                var userId = GetUserId();
                var username = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "Anonymous";

                _logger.LogDebug("SignalR: Пользователь {Username} (ID: {UserId}) подключился, ConnectionId: {ConnectionId}",
                    username, userId, Context.ConnectionId);

                _logger.LogDebug("SignalR: Добавляем ConnectionId {ConnectionId} в группу user-{UserId}",
                    Context.ConnectionId, userId);

                await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");

                await base.OnConnectedAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при подключении к SignalR");
                throw;
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
                throw;
            }
        }

        // Метод для фронтенда: подтверждение получения уведомления
        public async Task MarkAsSeen(int notificationId)
        {
            try
            {
                var userId = GetUserId();
                _logger.LogDebug("SignalR: Пользователь {UserId} отметил уведомление {NotificationId} как прочитанное",
                    userId, notificationId);

                // Здесь можно добавить логику отметки прочитанным в БД
                await Clients.Caller.NotificationSeen(notificationId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка в методе MarkAsSeen");
                throw;
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