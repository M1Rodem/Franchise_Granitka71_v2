using Franchisee.Web.Models;

namespace Franchisee.Web.Services
{
    public interface IPrintService
    {
        Task<PrintOrderResponse> GenerateOrderDocumentAsync(int orderId);
        Task<string> GenerateOrderHtmlAsync(int orderId);
    }
}