using Franchisee.Web.Models.Entities.Orders;

namespace Franchisee.Web.Models.DTOs.Orders;

/// <summary>
/// Информация о выполнении заказа (отправка на проверку и результат)
/// </summary>
public class OrderCompletionInfoDto
{
    /// <summary>
    /// Дата отправки на проверку
    /// </summary>
    public DateTime? SubmittedAt { get; set; }
    
    /// <summary>
    /// Кто отправил на проверку (ФИО менеджера)
    /// </summary>
    public string? SubmittedBy { get; set; }
    
    /// <summary>
    /// Примечание менеджера при отправке
    /// </summary>
    public string? SubmittedNote { get; set; }
    
    /// <summary>
    /// Медиафайлы, прикреплённые при отправке (фото + видео)
    /// </summary>
    public List<OrderMediaDto> Media { get; set; } = new();
    
    /// <summary>
    /// Дата проверки SuperAdmin
    /// </summary>
    public DateTime? ReviewedAt { get; set; }
    
    /// <summary>
    /// Кто проверил (ФИО SuperAdmin)
    /// </summary>
    public string? ReviewedBy { get; set; }
    
    /// <summary>
    /// Комментарий SuperAdmin
    /// </summary>
    public string? ReviewComment { get; set; }
    
    /// <summary>
    /// Результат проверки: Approved / Rejected / null (ещё не проверено)
    /// </summary>
    public string? Status { get; set; }
}