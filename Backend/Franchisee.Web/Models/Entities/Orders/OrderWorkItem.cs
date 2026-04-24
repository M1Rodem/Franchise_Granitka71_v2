using System.ComponentModel.DataAnnotations;

namespace Franchisee.Web.Models.Entities.Orders
{
    public class OrderWorkItem
    {
        [Key] public int Id { get; set; }
        [Required] public int OrderId { get; set; }
        public Order? Order { get; set; }
        [Required] public string WorkDescription { get; set; } = string.Empty;

        public decimal Price { get; set; }
        public decimal Quantity { get; set; } = 1;
        public int Routes { get; set; } = 1;
        public double? DistanceKm { get; set; } 

        public string Note { get; set; } = string.Empty;

        // Пересчет Quantity на основе DistanceKm * Routes
        public void RecalculateQuantity()
        {
            if (DistanceKm.HasValue && DistanceKm.Value > 0 && Routes > 0)
            {
                Quantity = (decimal)(DistanceKm.Value * Routes);
            }
        }
    }
}