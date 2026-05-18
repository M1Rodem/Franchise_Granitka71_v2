using Franchisee.Web.Models.DTOs.Notifications;
using Franchisee.Web.Models.Entities.Notification;

namespace Franchisee.Web.Services.Notifications.Core
{
    public interface INotificationService
    {
        Task<int> GetBlockingNotificationsCount(int userId);
        Task<int> CreateOrderUpdateRequestAsync(
            int orderId,
            int initiatorId,
            Dictionary<string, object> proposedChanges,
            string comment);

        Task<IEnumerable<NotificationResponseDto>> GetUserNotificationsAsync(
            int userId,
            string? statusFilter = null);

        Task<int> GetPendingCountAsync(int userId);
        Task<NotificationDetailsDto?> GetNotificationDetailsAsync(
        int notificationId,
        int userId);
        Task<bool> ResolveNotificationAsync(
            int notificationId,
            int userId,
            NotificationStatus status,
            string? note = null);
        Task<object> GetNotificationSummaryAsync(int userId);
        Task<bool> PostponeNotificationAsync(
            int notificationId,
            int userId,
            int minutes = 30,
            string? reason = null);

        Task SyncNotificationStatusAsync(
            int notificationId,
            int resolvedByUserId,
            NotificationStatus newStatus);

        Task SendSystemNotificationAsync(
            string message,
            int? orderId = null,
            string? orderNumber = null,
            int? initiatorId = null,
            params int[] userIds);
        Task<NotificationResponseDto?> ResolveNotificationWithResultAsync(
            int notificationId,
            int userId,
            NotificationStatus status,
            string? note = null);
        Task<NotificationBadgeDto> GetNotificationBadgeAsync(int userId);
        Task<NotificationCountsDto> GetNotificationCountsAsync(int userId);
        Task<NotificationResponseDto?> GetNotificationByIdAsync(int notificationId, int userId);

        /// <summary>
        /// Создать уведомление-запрос на выполнение заказа для SuperAdmin
        /// </summary>
        /// <param name="orderId">ID заказа</param>
        /// <param name="initiatorId">ID менеджера, отправившего запрос</param>
        /// <param name="completionNote">Примечание отправителя</param>
        /// <param name="tempMediaIds">ID временных файлов (фото+видео)</param>
        /// <returns>ID созданного уведомления</returns>
        Task<int> CreateCompletionRequestAsync(
            int orderId,
            int initiatorId,
            string? completionNote,
            List<int> tempMediaIds);

        /// <summary>
        /// Отправить предупреждение о скором удалении заказа (для SuperAdmin)
        /// </summary>
        Task SendOrderExpirationWarningAsync(
            int orderId,
            string orderNumber,
            int daysUntilDeletion,
            DateTime completedAt);

        /// <summary>
        /// Получить список ID всех SuperAdmin
        /// </summary>
        Task<List<int>> GetSuperAdminIdsAsync();

        /// <summary>
        /// Отправить системное уведомление с разделёнными сообщениями (краткое для списка, полное для деталей)
        /// </summary>
        Task SendSystemNotificationWithFullMessageAsync(
            string shortMessage,
            string fullMessage,
            int? orderId = null,
            string? orderNumber = null,
            int? initiatorId = null,
            params int[] userIds);

        /// <summary>
        /// Отправить результат проверки инициатору
        /// </summary>
        /// <param name="orderId">ID заказа</param>
        /// <param name="initiatorId">ID инициатора (менеджера)</param>
        /// <param name="approved">true — принято, false — отклонено</param>
        /// <param name="comment">Комментарий SuperAdmin</param>
        /// <param name="reviewedBy">ID SuperAdmin</param>
        Task SendCompletionResultAsync(
            int orderId,
            int initiatorId,
            bool approved,
            string? comment,
            int reviewedBy);
    }
}