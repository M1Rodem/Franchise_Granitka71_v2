using System.ComponentModel.DataAnnotations;

namespace Franchisee.Web.Models
{
    public class UpdateOrderRequest
    {
        // Основные поля
        public string? Place { get; set; }
        public string? InspectionPlace { get; set; }
        public DateTime? OrderDate { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public int? PlotId { get; set; }
        public string? DeceasedFullName { get; set; }
        public string? CustomerFullName { get; set; }
        public string? CustomerEmail { get; set; }
        public string? Address { get; set; }
        public string? Phone { get; set; }
        public string? MonumentType { get; set; }
        public string? MonumentSize { get; set; }
        public string? AdditionalInfo { get; set; }
        public OrderStatus? Status { get; set; }

        public decimal? DiscountPercent { get; set; }
        public decimal? DiscountAmount { get; set; }

        // Коллекции
        public List<OrderWorkItem>? WorkItems { get; set; }
        public List<OrderPayment>? Payments { get; set; }

        public List<int> TempPhotoIds { get; set; } = new();
        public List<int> TempVideoIds { get; set; } = new();
        public List<int> RemovedPhotoIds { get; set; } = new();
        public List<int> RemovedVideoIds { get; set; } = new();
    }
}