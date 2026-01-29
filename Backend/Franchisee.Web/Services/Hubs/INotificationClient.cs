using Franchisee.Web.Models;

namespace Franchisee.Web.Services.Hubs
{
    public interface INotificationClient
    {
        Task ReceiveNotification(NotificationUpdateDto notification);
        Task UpdateNotificationCount(int count);
        Task UpdateNotification(NotificationUpdateDto notification);
        Task NotificationResolved(NotificationResolvedDto resolution);
        Task NotificationPostponed(NotificationPostponedDto postponement);
        Task NotificationSeen(int notificationId);
        Task ConnectionEstablished(string message);
        Task ConnectionLost(string message);
    }
}