using System.ComponentModel.DataAnnotations;

namespace Franchisee.Web.Models
{
    public class CreateOrderRequest
    {
        public string? OrderNumber { get; set; }
        [Required] public string Place { get; set; } = string.Empty;
        public string InspectionPlace { get; set; } = string.Empty;
        public DateTime OrderDate { get; set; } = DateTime.UtcNow; 
        [Required] public string DeceasedFullName { get; set; } = string.Empty;
        [Required] public string CustomerFullName { get; set; } = string.Empty;
        public string? CustomerEmail { get; set; }
        [Required] public string Address { get; set; } = string.Empty;
        [Required] public string Phone { get; set; } = string.Empty;
        [Required] public string MonumentType { get; set; } = string.Empty;
        [Required] public string MonumentSize { get; set; } = string.Empty;
        public string? AdditionalInfo { get; set; } 
        public decimal TotalPrice { get; set; } = 0;
        public List<OrderWorkItem>? WorkItems { get; set; } = new();
        public List<OrderPayment>? Payments { get; set; } = new();
        public List<int> TempUploadIds { get; set; } = new();
    }
}