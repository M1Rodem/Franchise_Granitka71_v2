using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models
{
    public class TempUpload
    {
        [Key] public int Id { get; set; }
        [Required] public string FilePath { get; set; } = string.Empty;
        [Required] public string ContentType { get; set; } = string.Empty;
        [Required] public string Checksum { get; set; } = string.Empty;
        public int? Width { get; set; }
        public int? Height { get; set; }
        public string OriginalFileName { get; set; } = string.Empty;
        public long Size { get; set; }
        public int UploaderId { get; set; }

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddHours(1);  // 1h TTL
    }
}