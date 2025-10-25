using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Models
{
    public enum MonumentType { Надгробный, Гранитный, Мраморный, Бронзовый }  // Из ТЗ 3.2.1
    public enum OrderStatus { Новый, ВРаботе, Оплата, Готов, Доставлен }     // Трекинг статуса

    public class Order
    {
        [Key] public int Id { get; set; }
        public string OrderNumber { get; set; } = string.Empty;
        public string Place { get; set; } = string.Empty; // Место участка
        public DateTime OrderDate { get; set; } = DateTime.UtcNow;
        [StringLength(200)] public string InspectionPlace { get; set; } = string.Empty;
        public int ManagerId { get; set; }
        public virtual Manager? Manager { get; set; }

        [Required] public string DeceasedFullName { get; set; } = string.Empty;
        [Required] public string CustomerFullName { get; set; } = string.Empty;
        public string? CustomerEmail { get; set; }

        [Required]
        [RegularExpression(@"^\+7\(\d{3}\)\d{3}-\d{2}-\d{2}$", ErrorMessage = "Формат: +7(XXX)XXX-XX-XX")]
        [StringLength(20)]
        public string Phone { get; set; } = string.Empty;

        [Required] public string Address { get; set; } = string.Empty;

        [Required] public string MonumentType { get; set; } = string.Empty;  // Новый!
        [Required]
        [RegularExpression(@"^\d{1,3}x\d{1,3}x\d{1,3} см$", ErrorMessage = "Формат: ВxШxГ см (e.g., 100x50x20 см)")]
        public string MonumentSize { get; set; } = string.Empty;  // Новый!

        public string AdditionalInfo { get; set; } = string.Empty;
        public OrderStatus Status { get; set; } = OrderStatus.Новый;  // Новый!

        [NotMapped]  // Computed
        public decimal TotalPrice { get; set; } = 0;  // 🔥 Убрали [NotMapped] — writable, computed в сервисе/DTO если нужно
            
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public virtual List<OrderWorkItem> WorkItems { get; set; } = new();
        public virtual List<OrderPayment> Payments { get; set; } = new();
        public virtual List<OrderPhoto> Photos { get; set; } = new();
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public bool IsArchived { get; set; } = false;
    }
}