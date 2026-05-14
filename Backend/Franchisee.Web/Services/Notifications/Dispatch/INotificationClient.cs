using Franchisee.Web.Models.DTOs.Notifications;
using Franchisee.Web.Models.DTOs.Orders;

namespace Franchisee.Web.Services.Notifications.Dispatch
{
    public interface INotificationClient
    {
        Task ReceiveNotification(NotificationUpdateDto notification);
        Task UpdateNotificationCount(NotificationBadgeDto badge);
        Task UpdateNotificationCounts(NotificationCountsDto counts);
        Task UpdateNotification(NotificationUpdateDto notification);
        Task NotificationResolved(NotificationResolvedDto resolution);
        Task NotificationPostponed(NotificationPostponedDto postponement);
        Task NotificationSeen(int notificationId);
        Task ConnectionEstablished(string message);
        Task ConnectionLost(string message);
        Task InitialNotificationState(NotificationBadgeDto badge);
        Task CompletionRequestReceived(CompletionNotificationDataDto data);
        Task CompletionResultReceived(CompletionResultDto result);
    }

    public class InitialNotificationStateDto
    {
        public int UnreadCount { get; set; }
        // public List<NotificationUpdateDto> RecentNotifications { get; set; } = new();  // пока закомментировано
    }
}