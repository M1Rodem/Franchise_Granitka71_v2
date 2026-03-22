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

        public decimal Quantity { get; set; } = 1m;

        public string Note { get; set; } = string.Empty;
        public double? DistanceKm { get; set; }
    }
}