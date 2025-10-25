using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models
{
    public class UpdateOrderRequest
    {
        public string? Place { get; set; }
        public string? InspectionPlace { get; set; }
        public DateTime? OrderDate { get; set; }
        public string? DeceasedFullName { get; set; }
        public string? CustomerFullName { get; set; }
        public string? CustomerEmail { get; set; }
        public string? Phone { get; set; }
        public string? Address { get; set; }
        public string? MonumentType { get; set; }
        public string? MonumentSize { get; set; }
        public string? AdditionalInfo { get; set; }
        public OrderStatus? Status { get; set; }
        public List<OrderWorkItem>? WorkItems { get; set; }
        public List<OrderPayment>? Payments { get; set; }
        public List<int>? TempUploadIds { get; set; }
    }
}