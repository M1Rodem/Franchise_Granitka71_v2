using Franchisee.Web.Models.Entities.Print;

namespace Franchisee.Web.Services.Print.Core
{
    public interface IPrintService
    {
        Task<PrintOrderResponse> GenerateOrderDocumentAsync(int orderId);
        Task<string> GenerateOrderHtmlAsync(int orderId);
    }
}