using System.ComponentModel.DataAnnotations;

namespace Franchisee.Web.Models
{
    public class PlotDto
    {
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Required]
        public double Latitude { get; set; }

        [Required]
        public double Longitude { get; set; }

        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class CreatePlotRequest
    {
        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Description { get; set; }

        [Required]
        [Range(-90.0, 90.0, ErrorMessage = "Широта должна быть между -90 и 90")]
        public double Latitude { get; set; }

        [Required]
        [Range(-180.0, 180.0, ErrorMessage = "Долгота должна быть между -180 и 180")]
        public double Longitude { get; set; }

        public bool IsActive { get; set; } = true;
    }

    public class UpdatePlotRequest
    {
        [StringLength(100)]
        public string? Name { get; set; }

        [StringLength(500)]
        public string? Description { get; set; }

        [Range(-90.0, 90.0, ErrorMessage = "Широта должна быть между -90 и 90")]
        public double? Latitude { get; set; }

        [Range(-180.0, 180.0, ErrorMessage = "Долгота должна быть между -180 и 180")]
        public double? Longitude { get; set; }

        public bool? IsActive { get; set; }
    }
}