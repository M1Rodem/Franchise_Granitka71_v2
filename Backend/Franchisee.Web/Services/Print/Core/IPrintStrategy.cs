using Franchisee.Web.Models.Entities.Orders;
using Franchisee.Web.Models.Print;

namespace Franchisee.Web.Services.Print.Core
{
    public interface IPrintStrategy
    {
        PrintType Type { get; }
        PrintDataModel BuildDataModel(Order order);
    }
}