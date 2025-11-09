using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Franchisee.Web.Models
{
    public class OrderPhoto
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
        public int? UploaderId { get; set; } = null;
        public virtual Manager? Uploader { get; set; }
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }
}