using Franchisee.Web.Models.DTOs.Orders;
using System.ComponentModel.DataAnnotations;

namespace Franchisee.Web.Models.Requests.Orders
{
    public class CreateOrderRequest
    {
        [Required] public string Place { get; set; } = string.Empty;

        [Required]
        public string InspectionPlace { get; set; } = string.Empty;

        public DateTime OrderDate { get; set; } = DateTime.UtcNow;

        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public int? PlotId { get; set; }

        [Required] public string DeceasedFullName { get; set; } = string.Empty;
        [Required] public string CustomerFullName { get; set; } = string.Empty;
        public string? CustomerEmail { get; set; }
        [Required] public string Address { get; set; } = string.Empty;

        public string Phone { get; set; } = string.Empty;

        public string MonumentType { get; set; } = string.Empty;
        public string MonumentSize { get; set; } = string.Empty;
        public string? AdditionalInfo { get; set; }

        [Range(0, 10)]
        public decimal DiscountPercent { get; set; }

        public List<OrderWorkItemDto>? WorkItems { get; set; } = new();
        public List<OrderPaymentDto>? Payments { get; set; } = new();

        public List<int> TempPhotoIds { get; set; } = new();
        public List<int> TempVideoIds { get; set; } = new();

        public int? OwnerUserId { get; set; }
    }
}