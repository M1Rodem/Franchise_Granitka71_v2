using Franchisee.Web.Models;

namespace Franchisee.Web.Services.Hubs
{
    public interface INotificationClient
    {
        Task ReceiveNotification(NotificationUpdateDto notification);
        Task UpdateNotificationCount(NotificationBadgeDto badge);
        Task UpdateNotification(NotificationUpdateDto notification);
        Task NotificationResolved(NotificationResolvedDto resolution);
        Task NotificationPostponed(NotificationPostponedDto postponement);
        Task NotificationSeen(int notificationId);
        Task ConnectionEstablished(string message);
        Task ConnectionLost(string message);

        Task InitialNotificationState(InitialNotificationStateDto state);
    }

    public class InitialNotificationStateDto
    {
        public int UnreadCount { get; set; }
        // public List<NotificationUpdateDto> RecentNotifications { get; set; } = new();  // пока закомментировано
    }
}