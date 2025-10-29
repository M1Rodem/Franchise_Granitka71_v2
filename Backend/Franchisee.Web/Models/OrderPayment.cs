using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models
{
    public class OrderPayment
    {
        [Key] public int Id { get; set; }
        [Required] public int OrderId { get; set; }
        public Order? Order { get; set; }
        [Required] public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; } = DateTime.UtcNow;
        public string PaymentType { get; set; } = "Аванс";  // Аванс/Доплата/Нал/Безнал
        public string Note { get; set; } = string.Empty;
    }
}
