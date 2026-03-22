namespace Franchisee.Web.Models.DTOs.Notifications
{
    public class NotificationBadgeDto
    {
        public int Count { get; set; }
        public string Color { get; set; } = "none"; // "red", "blue", "gray", "none"
    }
}