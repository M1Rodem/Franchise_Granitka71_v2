using Franchisee.Web.Models.Entities.Plots;
using Franchisee.Web.Models.Entities.Users;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Franchisee.Web.Models.Entities.Orders
{
    public enum OrderStatus
    {
        ВРаботе = 1,                  // 1 — основной статус (был 1)
        ОжидаетПодтверждения = 5,     // 5 — на проверке у SuperAdmin
        Выполнено = 6,                // 6 — терминальный (успех)
        НаДоработке = 7               // 7 — требуется переделать
    }

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
        public OrderStatus Status { get; set; } = OrderStatus.ВРаботе;

        public decimal Subtotal { get; private set; }

        [Range(0, 10)]
        public decimal DiscountPercent { get; set; } = 0;
        public decimal DiscountAmount { get; private set; }

        public decimal TotalPrice { get; private set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public virtual List<OrderWorkItem> WorkItems { get; set; } = new();
        public virtual List<OrderPayment> Payments { get; set; } = new();
        public virtual List<OrderMedia> Photos { get; set; } = new();

        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public bool IsArchived { get; set; } = false;

        // COMPLETION WORKFLOW
        public string? CompletionNote { get; set; }           // Примечание при отправке на проверку
        public string? ReviewComment { get; set; }            // Комментарий SuperAdmin (при принятии/отклонении)
        public DateTime? SubmittedForReviewAt { get; set; }   // Дата отправки на проверку
        public DateTime? ReviewedAt { get; set; }             // Дата проверки SuperAdmin
        public int? ReviewedBy { get; set; }                  // ID SuperAdmin, кто проверил
        public DateTime? CompletedAt { get; set; }

        public void RecalculateTotals()
        {
            if (WorkItems == null || WorkItems.Count == 0)
            {
                Subtotal = 0m;
                DiscountAmount = 0m;
                TotalPrice = 0m;
                return;
            }

            decimal subtotal = 0m;

            foreach (var item in WorkItems)
            {
                if (item == null)
                    continue;

                var lineTotal = item.Price * item.Quantity;
                subtotal += lineTotal;
            }

            Subtotal = Math.Round(subtotal, 2, MidpointRounding.AwayFromZero);

            var percent = DiscountPercent;

            if (percent < 0)
                percent = 0;

            if (percent > 10)
                percent = 10;

            DiscountAmount = Math.Round(
                Subtotal * percent / 100m,
                2,
                MidpointRounding.AwayFromZero
            );

            var total = Subtotal - DiscountAmount;

            if (total < 0)
                total = 0;

            TotalPrice = Math.Round(
                total,
                2,
                MidpointRounding.AwayFromZero
            );
        }
    }

}