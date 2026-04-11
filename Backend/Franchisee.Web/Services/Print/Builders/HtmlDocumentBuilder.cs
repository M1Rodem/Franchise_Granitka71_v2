// Services/Print/Builders/HtmlDocumentBuilder.cs
using Franchisee.Web.Models.Print;
using System.Text;
using System.Linq;
using System.Collections.Generic;

namespace Franchisee.Web.Services.Print.Builders
{
    public class HtmlDocumentBuilder : IPrintDocumentBuilder
    {
        private const int MAX_WORK_ITEMS_PER_PAGE = 26;
        private const int MAX_PAYMENTS_PER_PAGE = 8;

        private string FormatPrice(decimal price)
        {
            if (price == Math.Floor(price))
            {
                return $"{price:0} руб.";
            }
            return $"{price:F2} руб.";
        }

        public string GetContentType => "text/html";
        public string GetFileExtension => ".html";

        public byte[] BuildExcel(PrintDataModel data)
        {
            throw new NotSupportedException("HtmlDocumentBuilder не поддерживает Excel формат");
        }

        public string BuildHtml(PrintDataModel data)
        {
            return data.Type == PrintType.Worker
                ? BuildWorkerHtml(data)
                : BuildDefaultHtml(data);
        }

        private string BuildDefaultHtml(PrintDataModel data)
        {
            var sb = new StringBuilder();

            // Разбиваем работы и платежи на страницы
            var workItemPages = SplitWorkItems(data.WorkItems, MAX_WORK_ITEMS_PER_PAGE);
            var paymentPages = SplitPayments(data.Payments, MAX_PAYMENTS_PER_PAGE);
            var totalPages = Math.Max(workItemPages.Count, paymentPages.Count);

            sb.AppendLine("<!DOCTYPE html>");
            sb.AppendLine("<html>");
            sb.AppendLine("<head>");
            sb.AppendLine("<meta charset='UTF-8'>");
            sb.AppendLine($"<title>Заказ {data.Header.OrderNumber}</title>");
            sb.AppendLine(@"
                <style>
                    @page { size: A4; margin: 0.5cm; }
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; font-size: 11px; }
                    .a4-page { width: 19.5cm; margin: 0 auto; border: 1px solid #000; page-break-after: always; }
                    .a4-page:last-child { page-break-after: auto; }
                    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                    td { border: 1px solid #000; padding: 2px 3px; vertical-align: top; height: 18px; }
                    .bold { font-weight: bold; }
                    .center { text-align: center; }
                    @media print {
                        body { margin: 0; }
                        .a4-page { border: none; }
                    }
                </style>
            ");
            sb.AppendLine("</head>");
            sb.AppendLine("<body>");

            for (int pageNum = 0; pageNum < totalPages; pageNum++)
            {
                var currentWorkItems = pageNum < workItemPages.Count ? workItemPages[pageNum] : new List<WorkItemInfo>();
                var currentPayments = pageNum < paymentPages.Count ? paymentPages[pageNum] : new List<PaymentInfo>();

                sb.AppendLine("<div class='a4-page'>");
                sb.AppendLine("<table>");

                // Шапка (только на первой странице)
                if (pageNum == 0)
                {
                    BuildDefaultHeader(sb, data);
                }
                else
                {
                    // Заголовок продолжения
                    sb.AppendLine("<tr class='bold center'>");
                    sb.AppendLine($"<td colspan='8' class='bold center'>--- ПРОДОЛЖЕНИЕ ЗАКАЗА (стр. {pageNum + 1} из {totalPages}) ---</td>");
                    sb.AppendLine("</tr>");

                    sb.AppendLine("<tr><td colspan='8' style='height: 8px;'></td></tr>");

                    // Заголовок колонок работ (ИСПРАВЛЕНО)
                    sb.AppendLine("<tr class='bold center'>");
                    sb.AppendLine("<td style='width:6%'>№</td>");
                    sb.AppendLine("<td colspan='3' style='width:44%'>Вид работы:</td>");
                    sb.AppendLine("<td style='width:15%'>Стоимость:</td>");
                    sb.AppendLine("<td colspan='3' style='width:35%'>Примечание:</td>");
                    sb.AppendLine("</tr>");
                }

                // Работы
                BuildWorkItemsPageHtml(sb, currentWorkItems, pageNum);

                // Итого (только на первой странице)
                if (pageNum == 0)
                {
                    BuildTotalsHtml(sb, data);
                }

                // Примечание (только на первой странице)
                if (pageNum == 0)
                {
                    BuildAdditionalInfoHtml(sb, data);
                }

                // Информация о памятнике (только на первой странице)
                if (pageNum == 0)
                {
                    BuildMonumentInfoHtml(sb, data);
                }

                // Заголовок платежей
                if (currentPayments.Any())
                {
                    if (pageNum > 0)
                    {
                        // Заголовок платежей на страницах продолжения (ИСПРАВЛЕНО)
                        sb.AppendLine("<tr class='bold center'>");
                        sb.AppendLine("<td></td>");
                        sb.AppendLine("<td>Сумма:</td>");
                        sb.AppendLine("<td>Дата:</td>");
                        sb.AppendLine("<td>Подпись:</td>");
                        sb.AppendLine("<td></td>");
                        sb.AppendLine("<td>Сумма:</td>");
                        sb.AppendLine("<td>Дата:</td>");
                        sb.AppendLine("<td>Подпись:</td>");
                        sb.AppendLine("</tr>");
                    }
                    // На первой странице заголовок платежей уже включён в BuildDefaultHeader
                }

                // Платежи
                BuildPaymentsPageHtml(sb, currentPayments);

                // Подписи (только на последней странице)
                if (pageNum == totalPages - 1)
                {
                    BuildSignaturesHtml(sb);
                }

                sb.AppendLine("</table>");
                sb.AppendLine("</div>");
            }

            sb.AppendLine("</body>");
            sb.AppendLine(@"
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    };
                </script>
            ");
            sb.AppendLine("</html>");

            return sb.ToString();
        }

        private void BuildDefaultHeader(StringBuilder sb, PrintDataModel data)
        {
            // Строка 1
            sb.AppendLine("<tr>");
            sb.AppendLine($"<td class='bold center'>№ заказа</td><td>{data.Header.OrderNumber}</td>");
            sb.AppendLine($"<td class='bold center'>№ Участка:</td><td colspan='2'>{data.Header.Place}</td>");
            sb.AppendLine($"<td class='bold center'>Место смотрел:</td><td colspan='2'>{data.Header.InspectionPlace}</td>");
            sb.AppendLine("</tr>");

            // Строка 2
            sb.AppendLine("<tr>");
            sb.AppendLine($"<td class='bold center'>Дата:</td><td>{data.Header.OrderDate:dd.MM.yyyy}</td>");
            sb.AppendLine($"<td class='bold center'>Заказ принял:</td><td colspan='2'>{data.Manager.FullName}</td>");
            sb.AppendLine("<td colspan='3' class='bold center'>ФИО на участке захоронения:</td>");
            sb.AppendLine("</tr>");

            // Строка 3-6 (личные данные)
            sb.AppendLine("<tr>");
            sb.AppendLine($"<td class='bold center'>E-mail:</td><td colspan='4'>{data.Customer.Email}</td>");
            sb.AppendLine($"<td colspan='3' rowspan='4'>{data.Header.DeceasedFullName}</td>");
            sb.AppendLine("</tr>");
            sb.AppendLine("<tr>");
            sb.AppendLine($"<td class='bold center'>Заказчик:</td><td colspan='4'>{data.Customer.FullName}</td>");
            sb.AppendLine("</tr>");
            sb.AppendLine("<tr>");
            sb.AppendLine($"<td class='bold center'>Адрес:</td><td colspan='4'>{data.Customer.Address}</td>");
            sb.AppendLine("</tr>");
            sb.AppendLine("<tr>");
            sb.AppendLine($"<td class='bold center'>Телефон:</td><td colspan='4'>{data.Customer.Phone}</td>");
            sb.AppendLine("</tr>");

            // Заголовок работ (первая страница)
            sb.AppendLine("<tr class='bold center'>");
            sb.AppendLine("<td style='width:6%'>№</td>");
            sb.AppendLine("<td colspan='3' style='width:44%'>Вид работы:</td>");
            sb.AppendLine("<td style='width:15%'>Стоимость:</td>");
            sb.AppendLine("<td colspan='3' style='width:35%'>Примечание:</td>");
            sb.AppendLine("</tr>");
        }

        private void BuildWorkItemsPageHtml(StringBuilder sb, List<WorkItemInfo> workItems, int pageNum)
        {
            var startNumber = pageNum * MAX_WORK_ITEMS_PER_PAGE;

            for (int i = 0; i < workItems.Count; i++)
            {
                var work = workItems[i];
                var itemNumber = startNumber + i + 1;
                var price = work.ShowPrice ? FormatPrice(work.Total) : "";

                sb.AppendLine("<tr>");
                sb.AppendLine($"<td>{itemNumber}.</td>");
                sb.AppendLine($"<td colspan='3'>{work.Description}</td>");
                sb.AppendLine($"<td>{price}</td>");
                sb.AppendLine($"<td colspan='3'>{work.Note}</td>");
                sb.AppendLine("</tr>");
            }

            // Добиваем пустыми строками только на первой странице
            if (pageNum == 0)
            {
                for (int i = workItems.Count; i < MAX_WORK_ITEMS_PER_PAGE; i++)
                {
                    sb.AppendLine("<tr>");
                    sb.AppendLine($"<td>{i + 1}.</td>");
                    sb.AppendLine("<td colspan='3'> </td>");
                    sb.AppendLine("<td> </td>");
                    sb.AppendLine("<td colspan='3'> </td>");
                    sb.AppendLine("</tr>");
                }
            }
        }

        private void BuildTotalsHtml(StringBuilder sb, PrintDataModel data)
        {
            var total = data.WorkItems.Sum(w => w.Total);
            var totalDisplay = data.Financials.ShowFinancials ? FormatPrice(total) : "";

            sb.AppendLine("<tr class='bold center'>");
            sb.AppendLine($"<td colspan='4'>ИТОГО:</td>");
            sb.AppendLine($"<td colspan='4'>{totalDisplay}</td>");
            sb.AppendLine("</tr>");
        }

        private void BuildAdditionalInfoHtml(StringBuilder sb, PrintDataModel data)
        {
            sb.AppendLine("<tr>");
            sb.AppendLine($"<td class='bold center'>Примечание:</td>");
            sb.AppendLine($"<td colspan='7'>{data.AdditionalInfo}</td>");
            sb.AppendLine("</tr>");
        }

        private void BuildMonumentInfoHtml(StringBuilder sb, PrintDataModel data)
        {
            if (!string.IsNullOrWhiteSpace(data.Header.MonumentType) || !string.IsNullOrWhiteSpace(data.Header.MonumentSize))
            {
                sb.AppendLine("<tr><td colspan='8' class='bold center'>ИНФОРМАЦИЯ О ПАМЯТНИКЕ</td></tr>");

                if (!string.IsNullOrWhiteSpace(data.Header.MonumentType))
                {
                    sb.AppendLine("<tr>");
                    sb.AppendLine($"<td class='bold center'>Тип памятника:</td>");
                    sb.AppendLine($"<td colspan='7'>{data.Header.MonumentType}</td>");
                    sb.AppendLine("</tr>");
                }

                if (!string.IsNullOrWhiteSpace(data.Header.MonumentSize))
                {
                    sb.AppendLine("<tr>");
                    sb.AppendLine($"<td class='bold center'>Размер памятника:</td>");
                    sb.AppendLine($"<td colspan='7'>{data.Header.MonumentSize}</td>");
                    sb.AppendLine("</tr>");
                }
            }
        }

        private void BuildPaymentsPageHtml(StringBuilder sb, List<PaymentInfo> payments)
        {
            for (int i = 0; i < payments.Count; i += 2)
            {
                var left = payments[i];
                var right = i + 1 < payments.Count ? payments[i + 1] : null;

                var leftType = left.PaymentType;
                var leftAmount = left.ShowAmount ? FormatPrice(left.Amount) : "";
                var leftDate = left.ShowAmount ? left.PaymentDate.ToString("dd.MM.yyyy") : "";

                sb.AppendLine("<tr>");
                sb.AppendLine($"<td class='bold'>{leftType}</td>");
                sb.AppendLine($"<td>{leftAmount}</td>");
                sb.AppendLine($"<td>{leftDate}</td>");
                sb.AppendLine("<td></td>"); // Подпись левая

                if (right != null)
                {
                    var rightType = right.PaymentType;
                    var rightAmount = right.ShowAmount ? FormatPrice(right.Amount) : "";
                    var rightDate = right.ShowAmount ? right.PaymentDate.ToString("dd.MM.yyyy") : "";

                    sb.AppendLine($"<td class='bold'>{rightType}</td>");
                    sb.AppendLine($"<td>{rightAmount}</td>");
                    sb.AppendLine($"<td>{rightDate}</td>");
                }
                else
                {
                    sb.AppendLine("<td></td><td></td><td></td>");
                }
                sb.AppendLine("<td></td>"); // Подпись правая
                sb.AppendLine("</tr>");
            }
        }

        private void BuildSignaturesHtml(StringBuilder sb)
        {
            sb.AppendLine("<tr>");
            sb.AppendLine("<td colspan='3' class='bold'>Скидка при следующем заказе % -</td>");
            sb.AppendLine("<td></td>");
            sb.AppendLine("<td colspan='3' class='bold'>Заказ выполнен полностью, претензий не имею -</td>");
            sb.AppendLine("<td></td>");
            sb.AppendLine("</tr>");
        }

        private string BuildWorkerHtml(PrintDataModel data)
        {
            var sb = new StringBuilder();

            sb.AppendLine("<!DOCTYPE html>");
            sb.AppendLine("<html>");
            sb.AppendLine("<head>");
            sb.AppendLine("<meta charset='UTF-8'>");
            sb.AppendLine($"<title>Рабочий документ {data.Header.OrderNumber}</title>");
            sb.AppendLine(@"
                <style>
                    @page { size: A4; margin: 0.5cm; }
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; font-size: 11px; }
                    .a4-page { width: 19.5cm; margin: 0 auto; border: 1px solid #000; }
                    table { width: 100%; border-collapse: collapse; }
                    td { border: 1px solid #000; padding: 2px 3px; vertical-align: top; }
                    .bold { font-weight: bold; }
                    .center { text-align: center; }
                    @media print {
                        body { margin: 0; }
                        .a4-page { border: none; page-break-after: always; }
                    }
                </style>
            ");
            sb.AppendLine("</head>");
            sb.AppendLine("<body>");
            sb.AppendLine("<div class='a4-page'>");
            sb.AppendLine("<table>");

            sb.AppendLine("<tr><td colspan='8' style='height: 5px;'> </td></tr>");

            // Основная информация
            sb.AppendLine("<tr>");
            sb.AppendLine($"<td class='bold'>№ заказа:</td><td colspan='2'>{data.Header.OrderNumber}</td>");
            sb.AppendLine($"<td class='bold'>Дата:</td><td colspan='4'>{data.Header.OrderDate:dd.MM.yyyy}</td>");
            sb.AppendLine("</tr>");

            sb.AppendLine("<tr>");
            sb.AppendLine($"<td class='bold'>Участок:</td><td colspan='7'>{data.Header.Place}</td>");
            sb.AppendLine("</tr>");

            sb.AppendLine("<tr>");
            sb.AppendLine($"<td class='bold'>ФИО умершего:</td><td colspan='7'>{data.Header.DeceasedFullName}</td>");
            sb.AppendLine("</tr>");

            sb.AppendLine("<tr><td colspan='8' style='height: 10px;'> </td></tr>");

            // Заголовок работ
            sb.AppendLine("<tr class='bold center'>");
            sb.AppendLine("<td>№</td>");
            sb.AppendLine("<td colspan='4'>Вид работы:</td>");
            sb.AppendLine("<td colspan='3'>Примечание:</td>");
            sb.AppendLine("</tr>");

            // Работы
            for (int i = 0; i < data.WorkItems.Count; i++)
            {
                var work = data.WorkItems[i];
                sb.AppendLine("<tr>");
                sb.AppendLine($"<td>{i + 1}.</td>");
                sb.AppendLine($"<td colspan='4'>{work.Description}</td>");
                sb.AppendLine($"<td colspan='3'>{work.Note}</td>");
                sb.AppendLine("</tr>");
            }

            sb.AppendLine("<tr><td colspan='8' style='height: 10px;'> </td></tr>");

            // Техническая информация
            sb.AppendLine("<tr><td colspan='8' class='bold center'>ТЕХНИЧЕСКАЯ ИНФОРМАЦИЯ</td></tr>");
            sb.AppendLine("<tr>");
            sb.AppendLine($"<td class='bold'>Тип памятника:</td><td colspan='7'>{data.Header.MonumentType}</td>");
            sb.AppendLine("</tr>");
            sb.AppendLine("<tr>");
            sb.AppendLine($"<td class='bold'>Размер памятника:</td><td colspan='7'>{data.Header.MonumentSize}</td>");
            sb.AppendLine("</tr>");

            if (data.WorkItems.Any(w => w.DistanceKm.HasValue))
            {
                var distances = string.Join(", ", data.WorkItems
                    .Where(w => w.DistanceKm.HasValue)
                    .Select(w => $"{w.Description}: {w.DistanceKm} км"));
                sb.AppendLine("<tr>");
                sb.AppendLine($"<td class='bold'>Расстояние (км):</td><td colspan='7'>{distances}</td>");
                sb.AppendLine("</tr>");
            }

            sb.AppendLine("</table>");
            sb.AppendLine("</div>");
            sb.AppendLine("</body>");
            sb.AppendLine(@"
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    };
                </script>
            ");
            sb.AppendLine("</html>");

            return sb.ToString();
        }

        // Вспомогательные методы
        private List<List<WorkItemInfo>> SplitWorkItems(List<WorkItemInfo> workItems, int pageSize)
        {
            var pages = new List<List<WorkItemInfo>>();
            if (workItems.Count == 0)
            {
                pages.Add(new List<WorkItemInfo>());
                return pages;
            }

            for (int i = 0; i < workItems.Count; i += pageSize)
            {
                pages.Add(workItems.Skip(i).Take(pageSize).ToList());
            }
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
            {
                pages.Add(payments.Skip(i).Take(pageSize).ToList());
            }
            return pages;
        }
    }
}