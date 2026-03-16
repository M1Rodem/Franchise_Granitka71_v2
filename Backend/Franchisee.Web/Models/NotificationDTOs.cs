using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace Franchisee.Web.Models
{
    // DTO для списка уведомлений
    public class NotificationResponseDto
    {
        public int Id { get; set; }
        public int RecipientId { get; set; }
        public NotificationType Type { get; set; }
        public NotificationStatus Status { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public DateTime? ReturnsAt { get; set; }
        public string? ResolutionNote { get; set; }
        public NotificationChangesPreviewDto? ChangesPreview { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;

        public int? InitiatorId { get; set; }
        public string InitiatorName { get; set; } = string.Empty;

        public int? OrderId { get; set; }
        public string OrderNumber { get; set; } = string.Empty;

        public bool IsInfluencing { get; set; }
        public bool IsBlocking { get; set; }

        // НОВОЕ ПОЛЕ: флаг информационного уведомления
        public bool IsInformation { get; set; }

        // Вычисляемые поля для фронтенда
        public int MinutesUntilReturn { get; set; }
        public bool IsActionRequired => Status == NotificationStatus.Pending && !IsInformation;
        public bool CanPostpone => Status == NotificationStatus.Pending && IsInfluencing;
    }

    // DTO для изменения статуса
    public class ResolveNotificationRequest
    {
        [Required]
        [RegularExpression("^(Pending|Approved|Rejected|Postponed)$",
            ErrorMessage = "Статус должен быть: Pending, Approved, Rejected или Postponed")]
        public string Status { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Note { get; set; }

        public NotificationStatus GetStatus()
        {
            return Enum.Parse<NotificationStatus>(Status, ignoreCase: true);
        }
    }

    // DTO для откладывания
    public class PostponeNotificationRequest
    {
        [Range(1, 1440)]
        public int Minutes { get; set; } = 30;

        [MaxLength(500)]
        public string? Reason { get; set; }
    }

    // DTO для SignalR
    public class NotificationUpdateDto
    {
        public int Id { get; set; }
        public NotificationType Type { get; set; }
        public NotificationStatus Status { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public int? OrderId { get; set; }
        public string? OrderNumber { get; set; }
        public string InitiatorName { get; set; } = string.Empty;
        public DateTime? ReturnsAt { get; set; }
    }

    public class NotificationResolvedDto
    {
        public int NotificationId { get; set; }
        public NotificationStatus Status { get; set; }
        public string ResolvedBy { get; set; } = string.Empty;
        public DateTime ResolvedAt { get; set; }
        public string? Note { get; set; }
        public int? OrderId { get; set; }
        public string? OrderNumber { get; set; }
    }

    public class NotificationPostponedDto
    {
        public int NotificationId { get; set; }
        public DateTime ReturnsAt { get; set; }
        public int Minutes { get; set; }
    }
}