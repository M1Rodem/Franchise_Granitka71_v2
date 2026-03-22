using Franchisee.Web.Models.Entities.Users;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Franchisee.Web.Models.Entities.Notification
{
    public class NotificationRecipient
    {
        public int Id { get; set; }

        [Required]
        public int NotificationId { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        public NotificationStatus Status { get; set; } = NotificationStatus.Pending;

        public DateTime? ResolvedAt { get; set; }
        public DateTime? ReturnsAt { get; set; }

        [MaxLength(500)]
        public string? ResolutionNote { get; set; }

        [ForeignKey("NotificationId")]
        public virtual Notification Notification { get; set; } = null!;

        [ForeignKey("UserId")]
        public virtual Manager User { get; set; } = null!;
    }
}