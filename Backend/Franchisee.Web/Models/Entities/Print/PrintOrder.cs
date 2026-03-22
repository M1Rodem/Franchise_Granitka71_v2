using Franchisee.Web.Models.Entities.Orders;
using Franchisee.Web.Models.Entities.Users;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Franchisee.Web.Models.Entities.Print
{
    public class PrintOrderRequest
    {
        public int OrderId { get; set; }
        public bool IncludePayments { get; set; } = true;
    }

    public class PrintOrderResponse
    {
        public byte[] FileContent { get; set; } = Array.Empty<byte>();
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
    }

    public class OrderPrintData
    {
        public required Order Order { get; set; }
        public required List<OrderWorkItem> WorkItems { get; set; }
        public required List<OrderPayment> Payments { get; set; }
        public required Manager Manager { get; set; }
        public decimal TotalWorkPrice => WorkItems?.Sum(w => w.Price * w.Quantity) ?? 0;
        public decimal TotalPaid => Payments?.Sum(p => p.Amount) ?? 0;
        public decimal RemainingAmount => TotalWorkPrice - TotalPaid;
    }
}