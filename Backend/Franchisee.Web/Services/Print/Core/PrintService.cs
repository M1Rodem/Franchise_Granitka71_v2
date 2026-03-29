using Franchisee.Web.Models.Entities.Print;
using Franchisee.Web.Models.Print;
using Franchisee.Web.Services.Orders.Repositories;
using Franchisee.Web.Services.Print.Builders;
using System;
using System.Threading.Tasks;

namespace Franchisee.Web.Services.Print.Core
{
    public class PrintService : IPrintService
    {
        private readonly IOrderRepository _orderRepository;
        private readonly PrintStrategyFactory _strategyFactory;
        private readonly IPrintDocumentBuilder _excelBuilder;
        private readonly IPrintDocumentBuilder _htmlBuilder;

        public PrintService(
            IOrderRepository orderRepository,
            PrintStrategyFactory strategyFactory,
            ExcelDocumentBuilder excelBuilder,
            HtmlDocumentBuilder htmlBuilder)
        {
            _orderRepository = orderRepository;
            _strategyFactory = strategyFactory;
            _excelBuilder = excelBuilder;
            _htmlBuilder = htmlBuilder;
        }

        public async Task<PrintOrderResponse> GenerateOrderDocumentAsync(int orderId, PrintType type = PrintType.Default)
        {
            var order = await _orderRepository.GetByIdAsync(orderId);
            if (order == null)
                throw new ArgumentException($"Заказ с ID {orderId} не найден");

            var strategy = _strategyFactory.GetStrategy(type);
            var printData = strategy.BuildDataModel(order);
            
            var fileContent = _excelBuilder.BuildExcel(printData);
            
            var fileName = type == PrintType.Worker 
                ? $"Рабочий_документ_{order.OrderNumber}_{DateTime.Now:yyyyMMdd}.xlsx"
                : $"Заказ_{order.OrderNumber}_{DateTime.Now:yyyyMMdd}.xlsx";

            return new PrintOrderResponse
            {
                FileContent = fileContent,
                FileName = fileName,
                ContentType = _excelBuilder.GetContentType
            };
        }

        public async Task<string> GenerateOrderHtmlAsync(int orderId, PrintType type = PrintType.Default)
        {
            var order = await _orderRepository.GetByIdAsync(orderId);
            if (order == null)
                throw new ArgumentException($"Заказ с ID {orderId} не найден");

            var strategy = _strategyFactory.GetStrategy(type);
            var printData = strategy.BuildDataModel(order);
            
            return _htmlBuilder.BuildHtml(printData);
        }
    }
}