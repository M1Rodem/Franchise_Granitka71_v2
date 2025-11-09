using System.ComponentModel.DataAnnotations;

namespace Franchisee.Web.Models
{
    public class OrderPhotoDto
    {
        public int Id { get; set; }
        [Required] public string Url { get; set; } = string.Empty;
        [Required] public string OriginalFileName { get; set; } = string.Empty;
        public long Size { get; set; } 
        public DateTime UploadedAt { get; set; }  
        public int Width { get; set; } = 0;
        public int Height { get; set; } = 0;
    }
    public class MoveTempPhotoDto
    {
        public string OriginalFileName { get; set; } = string.Empty; 
        public List<int> TempIds { get; set; } = new();
    }
}