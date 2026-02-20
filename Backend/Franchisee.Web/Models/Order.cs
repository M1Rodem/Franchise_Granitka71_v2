using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Franchisee.Web.Models
{
    public enum MonumentType { Надгробный, Гранитный, Мраморный, Бронзовый }
    public enum OrderStatus { Новый, ВРаботе, Оплата, Готов, Доставлен }

    public class Order
    {
        [Key] public int Id { get; set; }
        public string OrderNumber { get; set; } = string.Empty;
        public string Place { get; set; } = string.Empty;
        public DateTime OrderDate { get; set; } = DateTime.UtcNow;
        [StringLength(200)] public string InspectionPlace { get; set; } = string.Empty;

        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public int? PlotId { get; set; }

        public int ManagerId { get; set; }
        public virtual Manager? Manager { get; set; }
        public virtual Plot? Plot { get; set; }

        [Required] public string DeceasedFullName { get; set; } = string.Empty;
        [Required] public string CustomerFullName { get; set; } = string.Empty;
        public string? CustomerEmail { get; set; }

        [Required]
        [RegularExpression(@"^7\d{10}$", ErrorMessage = "Номер телефона должен начинаться с 7 и содержать 11 цифр")]
        public string Phone { get; set; } = string.Empty;

        public string Address { get; set; } = string.Empty;
        public string MonumentType { get; set; } = string.Empty;

        [Required]
        [RegularExpression(@"^\d{1,3}x\d{1,3}x\d{1,3} см$", ErrorMessage = "Формат: ВxШxГ см (e.g., 100x50x20 см)")]
        public string MonumentSize { get; set; } = string.Empty;

        public string AdditionalInfo { get; set; } = string.Empty;
        public OrderStatus Status { get; set; } = OrderStatus.Новый;

        public decimal TotalPrice { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public virtual List<OrderWorkItem> WorkItems { get; set; } = new();
        public virtual List<OrderPayment> Payments { get; set; } = new();
        public virtual List<OrderMedia> Photos { get; set; } = new();

        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public bool IsArchived { get; set; } = false;
    }
}