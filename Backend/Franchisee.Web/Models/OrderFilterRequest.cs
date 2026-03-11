namespace Franchisee.Web.Models
{
    public class OrderFilterRequest
    {
        public string? SearchQuery { get; set; }
        public DateTime? OrderDateFrom { get; set; }
        public DateTime? OrderDateTo { get; set; }
        public PaymentStatus? PaymentStatus { get; set; }
        public OrderStatus? Status { get; set; }

        public int? PlotId { get; set; }
        
        // [Obsolete("Deprecated. Not used by frontend.")]
        // public DateTime? CreatedFrom { get; set; }

        // [Obsolete("Deprecated. Not used by frontend.")]
        // public DateTime? CreatedTo { get; set; }

        // [Obsolete("Deprecated. Not used by frontend.")]
        // public decimal? MinPrice { get; set; }

        // [Obsolete("Deprecated. Not used by frontend.")]
        // public decimal? MaxPrice { get; set; }

        // [Obsolete("Deprecated. Not used by frontend.")]
        // public string? CustomerName { get; set; }

        // [Obsolete("Deprecated. Not used by frontend.")]
        // public string? Phone { get; set; }

        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    // ПОЛНОСТЬЮ ЗАМЕНЕН enum под новые статусы оплаты
    public enum PaymentStatus
    {
        All = 0,           // Все заказы (для фильтрации)
        Advance = 1,       // Аванс (оплачено от 0% до 30%)
        PartiallyPaid = 2, // Частично оплачен (оплачено от 30% до 100%)
        FullyPaid = 3      // Оплачен 100%
    }
}
