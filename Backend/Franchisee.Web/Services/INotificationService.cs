using Franchisee.Web.Models;

namespace Franchisee.Web.Services
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
        Task SendNotificationCountUpdateAsync(int userId);

        // ИЗМЕНЕНИЕ: добавляем reason параметр
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
    }
}