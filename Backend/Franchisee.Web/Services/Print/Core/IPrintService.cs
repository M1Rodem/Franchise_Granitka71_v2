using Franchisee.Web.Models.Entities.Print;
using Franchisee.Web.Models.Print;
using System.Threading.Tasks;

namespace Franchisee.Web.Services.Print.Core
{
    public interface IPrintService
    {
        Task<PrintOrderResponse> GenerateOrderDocumentAsync(int orderId, PrintType type = PrintType.Default);
        Task<string> GenerateOrderHtmlAsync(int orderId, PrintType type = PrintType.Default);
    }
}