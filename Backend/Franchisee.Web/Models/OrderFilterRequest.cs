namespace Franchisee.Web.Models
{
    public class OrderFilterRequest
    {
        public string? SearchQuery { get; set; }
        public DateTime? CreatedFrom { get; set; }
        public DateTime? CreatedTo { get; set; }
        public DateTime? OrderDateFrom { get; set; } 
        public DateTime? OrderDateTo { get; set; }   
        public PaymentStatus? PaymentStatus { get; set; }
        public OrderStatus? Status { get; set; }
        public decimal? MinPrice { get; set; }
        public decimal? MaxPrice { get; set; }
        public int? ManagerId { get; set; }
        public string? CustomerName { get; set; }
        public string? Phone { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }
    public enum PaymentStatus
    {
        All = 0,        // Все заказы
        NotPaid = 1,    // Не оплачено
        Partial = 2,    // Частично оплачено
        Paid = 3,       // Полностью оплачено
        Overpaid = 4    // Переплата
    }
}