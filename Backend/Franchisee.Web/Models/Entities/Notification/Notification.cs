using Franchisee.Web.Models.Entities.Orders;
using Franchisee.Web.Models.Entities.Users;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace Franchisee.Web.Models.Entities.Notification
{
    public enum NotificationType
    {
        OrderUpdateRequest = 0,
        OrderCompletionConfirmation = 1,
        System = 2
    }

    public enum NotificationStatus
    {
        Pending = 0,
        Approved = 1,
        Rejected = 2,
        Postponed = 3
    }

    public class Notification
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public NotificationType Type { get; set; }

        [Required]
        public NotificationStatus Status { get; set; } = NotificationStatus.Pending;

        [Required]
        public bool IsInfluencing { get; set; } = false;

        public int? InitiatorId { get; set; }
        public int? OrderId { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Message { get; set; } = string.Empty;

        [Column(TypeName = "jsonb")]
        public string Data { get; set; } = "{}";

        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? ResolvedAt { get; set; }
        public DateTime? ReturnsAt { get; set; }

        /// <summary>
        /// Время последнего изменения уведомления
        /// Используется для разрешения конфликтов при out-of-order событиях
        /// </summary>
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Навигационные свойства
        [ForeignKey("InitiatorId")]
        public virtual Manager Initiator { get; set; } = null!;

        [ForeignKey("OrderId")]
        public virtual Order? Order { get; set; }

        public virtual ICollection<NotificationRecipient> Recipients { get; set; } = new List<NotificationRecipient>();
    }
}