using Franchisee.Web.Models.Entities.Orders;
using Franchisee.Web.Models.Print;
using Franchisee.Web.Services.Print.Core;


namespace Franchisee.Web.Services.Print.Strategies
{
    public class DefaultPrintStrategy : BasePrintStrategy
    {
        public override PrintType Type => PrintType.Default;
        
        public override PrintDataModel BuildDataModel(Order order)
        {
            var model = base.BuildDataModel(order);
            
            // Включаем все данные
            model.Customer.IncludePersonalInfo = true;
            model.Financials.ShowFinancials = true;
            
            foreach (var workItem in model.WorkItems)
            {
                workItem.ShowPrice = true;
            }
            
            foreach (var payment in model.Payments)
            {
                payment.ShowAmount = true;
            }
            
            return model;
        }
    }
}