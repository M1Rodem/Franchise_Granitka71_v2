// Services/Print/Builders/HtmlDocumentBuilder.cs
using Franchisee.Web.Models.Print;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Franchisee.Web.Services.Print.Builders
{
    public class HtmlDocumentBuilder : IPrintDocumentBuilder
    {
        private const int MAX_WORK_ITEMS_PER_PAGE = 26;
        private const int MAX_PAYMENTS_PER_PAGE = 6;

        private readonly PrintCssService _cssService;
        private readonly PrintTemplateService _templateService;

        public HtmlDocumentBuilder()
        {
            _cssService = new PrintCssService();
            _templateService = new PrintTemplateService();
        }

        public string GetContentType => "text/html";
        public string GetFileExtension => ".html";

        private string FormatPrice(decimal price, bool show = true)
        {
            if (!show) return "";
            return price == Math.Floor(price)
                ? $"{price:0} руб."
                : $"{price:F2} руб.";
        }

        private string FormatDistanceDisplay(WorkItemInfo item)
        {
            if (!item.DistanceKm.HasValue) return "";

            // Явное преобразование double? в decimal
            decimal distanceKm = (decimal)item.DistanceKm.Value;
            decimal totalKm = distanceKm * item.Routes;
            return $"{distanceKm:F2} км × {item.Routes} рейс = {totalKm:F2} км";
        }

        public byte[] BuildExcel(PrintDataModel data)
        {
            throw new NotSupportedException("HtmlDocumentBuilder не поддерживает Excel формат");
        }

        public string BuildHtml(PrintDataModel data)
        {
            var pages = GeneratePages(data);
            var css = _cssService.GetPrintCss();
            var html = _templateService.BuildFullDocument(css, pages, data);
            return Encoding.UTF8.GetString(Encoding.UTF8.GetBytes(html));
        }

        private List<HtmlPageModel> GeneratePages(PrintDataModel data)
        {
            var pages = new List<HtmlPageModel>();

            // Разделяем работы
            var distanceItems = data.WorkItems.Where(x => x.DistanceKm.HasValue).ToList();
            var regularItems = data.WorkItems.Where(x => !x.DistanceKm.HasValue).ToList();

            // Объединяем для постраничного разбиения (сохраняем порядок как в Excel)
            var allWorkItems = new List<WorkItemInfo>();
            allWorkItems.AddRange(distanceItems);
            allWorkItems.AddRange(regularItems);

            var workItemPages = SplitWorkItems(allWorkItems, MAX_WORK_ITEMS_PER_PAGE);
            var paymentPages = SplitPayments(data.Payments, MAX_PAYMENTS_PER_PAGE);

            var totalPages = Math.Max(workItemPages.Count, paymentPages.Count);
            if (totalPages == 0) totalPages = 1;

            for (int pageNum = 0; pageNum < totalPages; pageNum++)
            {
                var page = new HtmlPageModel
                {
                    PageNumber = pageNum + 1,
                    TotalPages = totalPages,
                    IsFirstPage = pageNum == 0,
                    IsLastPage = pageNum == totalPages - 1,
                    OrderNumber = data.Header.OrderNumber,
                    SequenceStartNumber = pageNum * MAX_WORK_ITEMS_PER_PAGE + 1,
                    Data = data,
                    TotalAmount = data.WorkItems.Sum(w => w.Total)
                };

                // Определяем работы для этой страницы
                page.WorkItems = pageNum < workItemPages.Count
                    ? workItemPages[pageNum]
                    : new List<WorkItemInfo>();

                // Определяем платежи для этой страницы
                page.Payments = pageNum < paymentPages.Count
                    ? paymentPages[pageNum]
                    : new List<PaymentInfo>();

                // Разделяем на distance и regular для текущей страницы
                page.DistanceItems = page.WorkItems.Where(x => x.DistanceKm.HasValue).ToList();
                page.RegularItems = page.WorkItems.Where(x => !x.DistanceKm.HasValue).ToList();

                // Добивка пустыми строками для работ (только первая страница имеет добивку до 26)
                if (pageNum == 0)
                {
                    PadWorkItemsToMax(page, MAX_WORK_ITEMS_PER_PAGE);
                }

                pages.Add(page);
            }

            return pages;
        }

        private void PadWorkItemsToMax(HtmlPageModel page, int maxItems)
        {
            var totalCurrent = page.DistanceItems.Count + page.RegularItems.Count;
            for (int i = totalCurrent; i < maxItems; i++)
            {
                // Добавляем пустую обычную работу (проще для отображения)
                page.RegularItems.Add(new WorkItemInfo
                {
                    Description = "",
                    Quantity = 0,
                    Price = 0,
                    Note = "",
                    ShowPrice = false
                });
            }
        }

        private List<List<WorkItemInfo>> SplitWorkItems(List<WorkItemInfo> items, int pageSize)
        {
            var pages = new List<List<WorkItemInfo>>();
            if (items.Count == 0)
            {
                pages.Add(new List<WorkItemInfo>());
                return pages;
            }

            for (int i = 0; i < items.Count; i += pageSize)
                pages.Add(items.Skip(i).Take(pageSize).ToList());

            return pages;
        }

        private List<List<PaymentInfo>> SplitPayments(List<PaymentInfo> payments, int pageSize)
        {
            var pages = new List<List<PaymentInfo>>();
            if (payments.Count == 0)
            {
                pages.Add(new List<PaymentInfo>());
                return pages;
            }

            for (int i = 0; i < payments.Count; i += pageSize)
                pages.Add(payments.Skip(i).Take(pageSize).ToList());

            return pages;
        }
    }
}