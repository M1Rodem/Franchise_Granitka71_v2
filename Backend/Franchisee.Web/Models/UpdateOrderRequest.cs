using WebApplication1.Models;

namespace WebApplication1.Models
{
    public class UpdateOrderRequest : CreateOrderRequest
    {
        public OrderStatus? Status { get; set; }  // 🔥 Новый: optional для обновления статуса
        // TempUploadIds для новых фото
    }
}