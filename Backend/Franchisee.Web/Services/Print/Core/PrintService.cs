using Franchisee.Web.Models.Entities.Print;
using Franchisee.Web.Models.Print;
using Franchisee.Web.Services.Orders.Repositories;
using Franchisee.Web.Services.Print.Builders;
using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Franchisee.Web.Configuration;
using Franchisee.Web.Models.DTOs.Print;
using Franchisee.Web.Services.Media.Core;
using Franchisee.Web.Models.Entities.Orders;

namespace Franchisee.Web.Services.Print.Core
{
    public class PrintService : IPrintService
    {
        private readonly IOrderRepository _orderRepository;
        private readonly PrintStrategyFactory _strategyFactory;
        private readonly IPrintDocumentBuilder _excelBuilder;
        private readonly IPrintDocumentBuilder _htmlBuilder;
        private readonly ApplicationDbContext _context;
        private readonly IMediaService _mediaService;

        public PrintService(
            IOrderRepository orderRepository,
            PrintStrategyFactory strategyFactory,
            ExcelDocumentBuilder excelBuilder,
            HtmlDocumentBuilder htmlBuilder,
            ApplicationDbContext context,           
            IMediaService mediaService)             
        {
            _orderRepository = orderRepository;
            _strategyFactory = strategyFactory;
            _excelBuilder = excelBuilder;
            _htmlBuilder = htmlBuilder;
            _context = context;                     
            _mediaService = mediaService;           
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

        public async Task<string> GenerateOrderHtmlWithPhotosAsync(int orderId, List<int> selectedPhotoIds, PrintType type = PrintType.Default)
        {
            // 1. Получаем заказ
            var order = await _orderRepository.GetByIdAsync(orderId);
            if (order == null)
                throw new ArgumentException($"Заказ с ID {orderId} не найден");

            // 2. Получаем выбранные фото (без вызова GetMediaUrl в запросе)
            var photosEntities = await _context.OrderPhotos
                .Where(p => selectedPhotoIds.Contains(p.Id) && p.OrderId == orderId && p.MediaType == MediaType.Photo)
                .ToListAsync();

            // 3. Проверяем, что все запрошенные фото найдены
            if (photosEntities.Count != selectedPhotoIds.Count)
                throw new ArgumentException("Некоторые фото не найдены или не принадлежат заказу");

            // 4. Преобразуем в DTO (здесь уже можно вызывать GetMediaUrl)
            var photos = photosEntities.Select(p => new PhotoInfoDto
            {
                Id = p.Id,
                Url = _mediaService.GetMediaUrl(p.Id),
                Width = p.Width ?? 0,
                Height = p.Height ?? 0
            }).ToList();

            // 5. Получаем базовую модель через стратегию
            var strategy = _strategyFactory.GetStrategy(type);
            var baseData = strategy.BuildDataModel(order);

            // 6. Создаем копию модели и добавляем фото
            var printData = new PrintDataModel
            {
                Header = baseData.Header,
                Customer = baseData.Customer,
                WorkItems = baseData.WorkItems,
                Payments = baseData.Payments,
                Financials = baseData.Financials,
                AdditionalInfo = baseData.AdditionalInfo,
                Manager = baseData.Manager,
                Type = baseData.Type,
                DistanceWorkItems = baseData.DistanceWorkItems,
                RegularWorkItems = baseData.RegularWorkItems,
                SelectedPhotos = photos
            };

            // 7. Генерируем HTML
            return _htmlBuilder.BuildHtml(printData);
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