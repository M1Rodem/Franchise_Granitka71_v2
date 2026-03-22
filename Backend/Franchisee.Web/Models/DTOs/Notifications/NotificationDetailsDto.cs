using Franchisee.Web.Models.DTOs.Orders;
using Franchisee.Web.Models.Entities.Notification;

namespace Franchisee.Web.Models.DTOs.Notifications
{
    public class NotificationDetailsDto
    {
        public int Id { get; set; }

        public string Type { get; set; } = string.Empty;

        public NotificationStatus Status { get; set; }

        public DateTime CreatedAt { get; set; }

        public OrderShortDto Order { get; set; } = new();

        public InitiatorDto Initiator { get; set; } = new();

        public string? Comment { get; set; }
        public string? Message { get; set; }

        public NotificationChangesDto Changes { get; set; } = new();
    }

    public class OrderShortDto
    {
        public int Id { get; set; }
        public string Number { get; set; } = string.Empty;
    }

    public class InitiatorDto
    {
        public int? Id { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    public class NotificationChangesDto
    {
        public List<FieldChangeDto>? MainInfo { get; set; }
        public List<FieldChangeDto>? Client { get; set; }

        public MapChangeDto? Map { get; set; }

        public WorksChangeDto? Works { get; set; }

        public PaymentsChangeDto? Payments { get; set; }

        public FinanceChangeDto? Finance { get; set; }

        public MediaChangeDto? Media { get; set; }
    }

    public class FieldChangeDto
    {
        public string Field { get; set; } = string.Empty;

        public string Label { get; set; } = string.Empty;

        public string? OldValue { get; set; }

        public string? NewValue { get; set; }
    }

    public class MapChangeDto
    {
        public MapStateDto Old { get; set; } = new();
        public MapStateDto New { get; set; } = new();
    }

    public class MapStateDto
    {
        public double? Latitude { get; set; }

        public double? Longitude { get; set; }

        public string? Plot { get; set; }

        public string? InspectionPlace { get; set; }

        public double? DistanceKm { get; set; }
    }

    public class WorksChangeDto
    {
        public List<OrderWorkItemDto> OldWorks { get; set; } = new();
        public List<OrderWorkItemDto> NewWorks { get; set; } = new();

        public decimal OldTotal { get; set; }

        public decimal NewTotal { get; set; }
    }

    public class PaymentsChangeDto
    {
        public List<OrderPaymentDto> OldPayments { get; set; } = new();

        public List<OrderPaymentDto> NewPayments { get; set; } = new();
    }

    public class FinanceChangeDto
    {
        public FinanceStateDto Old { get; set; } = new();

        public FinanceStateDto New { get; set; } = new();
    }

    public class FinanceStateDto
    {
        public decimal WorksTotal { get; set; }

        public decimal Discount { get; set; }

        public decimal DiscountAmount { get; set; }

        public decimal Total { get; set; }

        public decimal Paid { get; set; }

        public decimal Remaining { get; set; }
    }

    public class MediaChangeDto
    {
        public List<MediaItemDto> DeletedMedia { get; set; } = new();

        public List<MediaItemDto> AddedMedia { get; set; } = new();
    }

    public class MediaItemDto
    {
        public int Id { get; set; }

        public string Type { get; set; } = "photo";

        public string PreviewUrl { get; set; } = string.Empty;
    }
}