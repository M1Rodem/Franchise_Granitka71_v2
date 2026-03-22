using Franchisee.Web.Models.Entities.Orders;
using System.ComponentModel.DataAnnotations;

namespace Franchisee.Web.Models.Entities.Plots
{
    public class Plot
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Description { get; set; }

        [Required]
        public double Latitude { get; set; }

        [Required]
        public double Longitude { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;


        public virtual ICollection<Order> Orders { get; set; } = new List<Order>();
    }
}