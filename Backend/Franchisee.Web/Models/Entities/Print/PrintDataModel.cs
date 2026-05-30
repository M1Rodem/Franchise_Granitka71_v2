using System;
using System.Collections.Generic;
using Franchisee.Web.Models.DTOs.Print;

namespace Franchisee.Web.Models.Print
{
    public class PrintDataModel
    {
        public OrderHeaderInfo Header { get; set; } = new();
        public CustomerInfo Customer { get; set; } = new();
        public List<WorkItemInfo> WorkItems { get; set; } = new();
        public List<PaymentInfo> Payments { get; set; } = new();
        public FinancialInfo Financials { get; set; } = new();
        public string AdditionalInfo { get; set; } = string.Empty;
        public ManagerInfo Manager { get; set; } = new();
        public PrintType Type { get; set; }
        public List<WorkItemInfo> DistanceWorkItems { get; set; } = new();
        public List<WorkItemInfo> RegularWorkItems { get; set; } = new();
        public List<PhotoInfoDto>? SelectedPhotos { get; set; }
    }

    public class OrderHeaderInfo
    {
        public string OrderNumber { get; set; } = string.Empty;
        public DateTime OrderDate { get; set; }
        public string Place { get; set; } = string.Empty;
        public string InspectionPlace { get; set; } = string.Empty;
        public string DeceasedFullName { get; set; } = string.Empty;
        public string MonumentType { get; set; } = string.Empty;
        public string MonumentSize { get; set; } = string.Empty;
    }

    public class CustomerInfo
    {
        public string FullName { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public bool IncludePersonalInfo { get; set; } = true;
    }

    public class WorkItemInfo
    {
        public int Id { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public decimal Quantity { get; set; }
        public decimal Total =>
            IsDistanceWork
                ? Price * (decimal)((DistanceKm ?? 0) * Routes)
                : Price * Quantity;

        public decimal CalculatedQuantity =>
            IsDistanceWork
                ? (decimal)((DistanceKm ?? 0) * Routes)
                : Quantity;
        public string Note { get; set; } = string.Empty;
        public bool ShowPrice { get; set; } = true;
        public double? DistanceKm { get; set; }
        public int Routes { get; set; }
        public bool IsDistanceWork { get; set; }
    }

    public class PaymentInfo
    {
        public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; }
        public string PaymentType { get; set; } = string.Empty;
        public string? Note { get; set; }
        public bool ShowAmount { get; set; } = true;
    }

    public class FinancialInfo
    {
        public decimal Subtotal { get; set; }
        public decimal DiscountPercent { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal Total { get; set; }
        public decimal TotalPaid { get; set; }
        public decimal Remaining { get; set; }
        public bool ShowFinancials { get; set; } = true;
    }

    public class ManagerInfo
    {
        public string FullName { get; set; } = string.Empty;
    }

    public enum PrintType
    {
        Default = 0,
        Worker = 1
    }
}