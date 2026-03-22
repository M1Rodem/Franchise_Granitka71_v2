using Franchisee.Web.Models.Entities.Orders;
using System.ComponentModel.DataAnnotations;

namespace Franchisee.Web.Models.DTOs.Orders
{
    public class OrderMediaDto
    {
        public int Id { get; set; }
        [Required] public string Url { get; set; } = string.Empty;
        [Required] public string OriginalFileName { get; set; } = string.Empty;
        public long Size { get; set; }
        public DateTime UploadedAt { get; set; }
        public int Width { get; set; } = 0;
        public int Height { get; set; } = 0;

        // Новое поле для типа медиа
        public MediaType MediaType { get; set; } = MediaType.Photo;
    }

    // Оставляем для обратной совместимости
    public class MoveTempMediaDto
    {
        public string OriginalFileName { get; set; } = string.Empty;
        public List<int> TempIds { get; set; } = new();
    }
}