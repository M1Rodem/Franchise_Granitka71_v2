// Services/Print/Models/HtmlPageModel.cs
using System.Collections.Generic;

namespace Franchisee.Web.Models.Print
{
    public class HtmlPageModel
    {
        public int PageNumber { get; set; }
        public int TotalPages { get; set; }
        public bool IsFirstPage { get; set; }
        public bool IsLastPage { get; set; }

        public List<WorkItemInfo> WorkItems { get; set; } = new();
        public List<WorkItemInfo> DistanceItems { get; set; } = new();
        public List<WorkItemInfo> RegularItems { get; set; } = new();
        public List<PaymentInfo> Payments { get; set; } = new();

        public PrintDataModel? Data { get; set; }

        public string OrderNumber { get; set; } = string.Empty;
        public int SequenceStartNumber { get; set; }
        public decimal TotalAmount { get; set; }
    }
}