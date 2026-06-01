namespace Franchisee.Web.Models.Requests.Reports
{
    public record ManagerFinanceReportRequest
    {
        public DateTime DateFrom { get; init; }
        public DateTime DateTo { get; init; }
        public int ManagerId { get; init; }
    }
}