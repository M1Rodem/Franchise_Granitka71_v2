using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models
{
    public class OrderPhotoDto
    {
        public int Id { get; set; }
        [Required] public string Url { get; set; } = string.Empty;
        [Required] public string OriginalFileName { get; set; } = string.Empty;
        public long Size { get; set; }  // ✅ Non-nullable long
        public DateTime UploadedAt { get; set; }  // ✅ UploadedAt вместо CreatedAt
        public int Width { get; set; } = 0;
        public int Height { get; set; } = 0;
    }
    public class MoveTempPhotoDto
    {
        public string OriginalFileName { get; set; } = string.Empty;  // Оригинал с фронта
        public List<int> TempIds { get; set; } = new();
    }
}