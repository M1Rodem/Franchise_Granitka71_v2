// Services/Print/Strategies/WorkerPrintStrategy.cs
using Franchisee.Web.Models.Entities.Orders;
using Franchisee.Web.Models.Print;
using Franchisee.Web.Services.Print.Core;
using System.Linq;

namespace Franchisee.Web.Services.Print.Strategies
{
    public class WorkerPrintStrategy : BasePrintStrategy
    {
        public override PrintType Type => PrintType.Worker;

        public override PrintDataModel BuildDataModel(Order order)
        {
            var model = base.BuildDataModel(order);

            // 1. ЗАМЕНЯЕМ личные данные на пустые строки
            model.Customer.IncludePersonalInfo = false;
            model.Customer.FullName = "";
            model.Customer.Phone = "";
            model.Customer.Email = "";
            model.Customer.Address = "";

            // 2. УБИРАЕМ все финансовые данные
            model.Financials.ShowFinancials = false;
            model.Financials.Subtotal = 0;
            model.Financials.DiscountPercent = 0;
            model.Financials.DiscountAmount = 0;
            model.Financials.Total = 0;
            model.Financials.TotalPaid = 0;
            model.Financials.Remaining = 0;

            // 3. В работах убираем цены
            foreach (var workItem in model.WorkItems)
            {
                workItem.ShowPrice = false;
            }

            // 4. Убираем платежи
            model.Payments = new List<PaymentInfo>();

            return model;
        }
    }
}