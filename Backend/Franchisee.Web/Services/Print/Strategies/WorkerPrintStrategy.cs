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
            
            // 1. ЗАМЕНЯЕМ личные данные на пустые строки (сохраняем структуру)
            model.Customer.IncludePersonalInfo = false;
            model.Customer.FullName = "";   // Пусто, но строка остается
            model.Customer.Phone = "";      // Пусто, но строка остается
            model.Customer.Email = "";      // Пусто, но строка остается
            model.Customer.Address = "";    // Пусто, но строка остается
            
            // 2. УБИРАЕМ все цены (но оставляем ячейки)
            model.Financials.ShowFinancials = false;
            
            // 3. В работах убираем цены
            foreach (var workItem in model.WorkItems)
            {
                workItem.ShowPrice = false;
            }
            
            // 4. Убираем платежи
            model.Payments.Clear();
            
            return model;
        }
    }
}