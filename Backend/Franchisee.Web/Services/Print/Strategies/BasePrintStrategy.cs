using Franchisee.Web.Models.Entities.Orders;
using Franchisee.Web.Models.Print;
using Franchisee.Web.Services.Print.Core;
using System.Linq;

namespace Franchisee.Web.Services.Print.Strategies
{
    public abstract class BasePrintStrategy : IPrintStrategy
    {
        public abstract PrintType Type { get; }

        public virtual PrintDataModel BuildDataModel(Order order)
        {
            var allItems = order.WorkItems.Select(w => new WorkItemInfo
            {
                Id = w.Id,
                Description = w.WorkDescription,
                Price = w.Price,
                Quantity = w.Quantity,
                Routes = w.Routes,
                DistanceKm = w.DistanceKm,
                IsDistanceWork = w.DistanceKm.HasValue && w.DistanceKm > 0,
                Note = w.Note,
                ShowPrice = true
            }).ToList();

            return new PrintDataModel
            {
                Type = Type,

                Header = new OrderHeaderInfo
                {
                    OrderNumber = order.OrderNumber,
                    OrderDate = order.OrderDate,
                    Place = order.Plot?.Name ?? order.Place,
                    InspectionPlace = order.InspectionPlace,
                    DeceasedFullName = order.DeceasedFullName,
                    MonumentType = order.MonumentType,
                    MonumentSize = order.MonumentSize
                },

                Customer = new CustomerInfo
                {
                    FullName = order.CustomerFullName,
                    Phone = order.Phone,
                    Email = order.CustomerEmail ?? string.Empty,
                    Address = order.Address,
                    IncludePersonalInfo = true
                },

                WorkItems = allItems,

                DistanceWorkItems = allItems.Where(x => x.IsDistanceWork).ToList(),
                RegularWorkItems = allItems.Where(x => !x.IsDistanceWork).ToList(),

                Payments = order.Payments.Select(p => new PaymentInfo
                {
                    Amount = p.Amount,
                    PaymentDate = p.PaymentDate,
                    PaymentType = p.PaymentType,
                    Note = p.Note,
                    ShowAmount = true
                }).ToList(),

                AdditionalInfo = order.AdditionalInfo,

                Manager = new ManagerInfo
                {
                    FullName = order.Manager?.FullName ?? string.Empty
                },

                Financials = new FinancialInfo
                {
                    Subtotal = order.Subtotal,
                    DiscountPercent = order.DiscountPercent,
                    DiscountAmount = order.DiscountAmount,
                    Total = order.TotalPrice,
                    TotalPaid = order.Payments?.Sum(p => p.Amount) ?? 0,
                    Remaining = order.TotalPrice - (order.Payments?.Sum(p => p.Amount) ?? 0),
                    ShowFinancials = true
                }
            };
        }
    }
}