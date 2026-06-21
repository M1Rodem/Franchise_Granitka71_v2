using Franchisee.Web.Models.DTOs.Reports;
using Franchisee.Web.Services.Orders.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Franchisee.Web.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ReportsController : ControllerBase
    {
        private readonly IOrderRepository _orderRepository;
        private readonly ILogger<ReportsController> _logger;

        public ReportsController(
            IOrderRepository orderRepository,
            ILogger<ReportsController> logger)
        {
            _orderRepository = orderRepository;
            _logger = logger;
        }

        [HttpGet("manager-finance")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<ActionResult<ManagerFinanceReportResponse>> GetManagerFinanceReport(
            [FromQuery] DateTime dateFrom,
            [FromQuery] DateTime dateTo,
            [FromQuery] int managerId)
        {
            // Валидация
            if (dateFrom == default)
                return BadRequest(new { message = "DateFrom is required" });

            if (dateTo == default)
                return BadRequest(new { message = "DateTo is required" });

            if (managerId <= 0)
                return BadRequest(new { message = "ManagerId is required" });

            if (dateFrom > dateTo)
                return BadRequest(new { message = "DateFrom must be less than or equal to DateTo" });

            // Приводим даты к UTC
            var fromUtc = DateTime.SpecifyKind(dateFrom.Date, DateTimeKind.Utc);
            var toUtc = DateTime.SpecifyKind(dateTo.Date.AddDays(1), DateTimeKind.Utc);

            // Получаем данные
            var (orders, manager, totalPaid) = await _orderRepository
                .GetManagerFinanceReportAsync(managerId, fromUtc, toUtc);

            // Если нет менеджера или заказов
            if (manager == null)
            {
                return Ok(new ManagerFinanceReportResponse
                {
                    Summary = new ManagerFinanceSummaryDto
                    {
                        ManagerName = "Неизвестно",
                        OrdersCount = 0,
                        TotalSold = 0,
                        TotalPaid = 0,
                        TotalDebt = 0,
                        CollectionPercent = 0
                    },
                    Orders = new List<ManagerFinanceOrderDto>()
                });
            }

            if (orders.Count == 0)
            {
                return Ok(new ManagerFinanceReportResponse
                {
                    Summary = new ManagerFinanceSummaryDto
                    {
                        ManagerName = manager.FullName,
                        OrdersCount = 0,
                        TotalSold = 0,
                        TotalPaid = 0,
                        TotalDebt = 0,
                        CollectionPercent = 0
                    },
                    Orders = new List<ManagerFinanceOrderDto>()
                });
            }

            // Расчет сумм
            var totalSold = orders.Sum(o => o.TotalPrice);
            var totalDebt = totalSold - totalPaid;
            var collectionPercent = totalSold > 0
                ? Math.Round((totalPaid / totalSold) * 100, 2)
                : 0;

            // Формируем ответ
            var response = new ManagerFinanceReportResponse
            {
                Summary = new ManagerFinanceSummaryDto
                {
                    ManagerName = manager.FullName,
                    OrdersCount = orders.Count,
                    TotalSold = totalSold,
                    TotalPaid = totalPaid,
                    TotalDebt = totalDebt,
                    CollectionPercent = collectionPercent
                },
                Orders = orders
            };

            _logger.LogInformation(
                "Финансовый отчет для менеджера {ManagerId} ({ManagerName}) за период {DateFrom} - {DateTo}: {OrdersCount} заказов, продано {TotalSold}, оплачено {TotalPaid}",
                managerId, manager.FullName, dateFrom, dateTo, orders.Count, totalSold, totalPaid);

            return Ok(response);
        }
    }
}