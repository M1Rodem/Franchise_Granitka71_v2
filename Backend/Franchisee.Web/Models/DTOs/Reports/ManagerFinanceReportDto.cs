using System;

namespace Franchisee.Web.Models.DTOs.Reports
{
    public record ManagerFinanceReportResponse
    {
        public ManagerFinanceSummaryDto Summary { get; init; } = new();
        public List<ManagerFinanceOrderDto> Orders { get; init; } = new();
    }

    public record ManagerFinanceSummaryDto
    {
        public string ManagerName { get; init; } = string.Empty;
        public int OrdersCount { get; init; }
        public decimal TotalSold { get; init; }
        public decimal TotalPaid { get; init; }
        public decimal TotalDebt { get; init; }
        public decimal CollectionPercent { get; init; }
    }

    public record ManagerFinanceOrderDto
    {
        public int OrderId { get; init; }
        public string OrderNumber { get; init; } = string.Empty;
        public DateTime OrderDate { get; init; }
        public string CustomerName { get; init; } = string.Empty;
        public decimal TotalPrice { get; init; }
        public decimal PaidAmount { get; init; }
        public decimal DebtAmount { get; init; }
    }
}