using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Franchisee.Web.Models
{
    public enum MediaType
    {
        Photo = 0,
        Video = 1
    }

    public class OrderMedia
    {
        [Key] public int Id { get; set; }
        [Required] public int OrderId { get; set; }
        public virtual Order? Order { get; set; }

        [Required] public string FilePath { get; set; } = string.Empty;
        [Required] public string ContentType { get; set; } = string.Empty;
        [Required] public string Checksum { get; set; } = string.Empty;

        public int? Width { get; set; }
        public int? Height { get; set; }
        public string OriginalFileName { get; set; } = string.Empty;
        public long Size { get; set; }

        // Новое поле для типа медиа
        public MediaType MediaType { get; set; } = MediaType.Photo;

        public int? UploaderId { get; set; } = null;
        public virtual Manager? Uploader { get; set; }

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }
}