using Franchisee.Web.Models.Entities.Orders;

namespace Franchisee.Web.Models.DTOs.Orders;

// Запрос на отправку (Менеджер - SuperAdmin)

public class SubmitForReviewRequest
{
    public required List<int> TempMediaIds { get; set; }
    public string? Note { get; set; }
}

// Данные для уведомления SuperAdmin

public class CompletionNotificationDataDto
{
    public int OrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string InitiatorName { get; set; } = string.Empty;
    public int InitiatorId { get; set; }
    public string? Note { get; set; }           
    public string? Comment { get; set; }       
    public List<OrderMediaDto> Photos { get; set; } = new();
    public OrderMediaDto? Video { get; set; }
    public DateTime CreatedAt { get; set; }
}

// Результат для инициатора (принято/отклонено)

public class CompletionResultDto
{
    public int OrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public bool Approved { get; set; }
    public string? Comment { get; set; }
    public DateTime ReviewedAt { get; set; }
    public string ReviewedByName { get; set; } = string.Empty;
}

// Response при отправке на проверку

public class SubmitForReviewResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int? NotificationId { get; set; }
    public OrderStatus NewStatus { get; set; }
}