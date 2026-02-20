using Franchisee.Web.Models;

namespace Franchisee.Web.Models
{
    public class PagedResult<T>
    {
        public IEnumerable<T> Items { get; set; } = new List<T>();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    }

    public class OrderResponseDto
    {
        public int Id { get; set; }
        public string OrderNumber { get; set; } = string.Empty;
        public string Place { get; set; } = string.Empty;
        public DateTime OrderDate { get; set; }
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string InspectionPlace { get; set; } = string.Empty;

        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public int? PlotId { get; set; }
        public string? PlotName { get; set; }

        public string DeceasedFullName { get; set; } = string.Empty;
        public string CustomerFullName { get; set; } = string.Empty;
        public string? CustomerEmail { get; set; }
        public string Phone { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string MonumentType { get; set; } = string.Empty;
        public string MonumentSize { get; set; } = string.Empty;
        public string AdditionalInfo { get; set; } = string.Empty;
        public OrderStatus Status { get; set; }
        public decimal TotalPrice { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public int ManagerId { get; set; }
        public string ManagerFullName { get; set; } = string.Empty;
        public List<OrderWorkItem> WorkItems { get; set; } = new();
        public List<OrderPayment> Payments { get; set; } = new();
        public List<OrderMediaDto> Photos { get; set; } = new();

        // НОВОЕ ПОЛЕ - статус оплаты
        public PaymentStatus PaymentStatus { get; set; }
    }
}