// Services/Print/Builders/PrintTemplateService.cs
using Franchisee.Web.Models.Print;
using System.Linq;
using System.Text;

namespace Franchisee.Web.Services.Print.Builders
{
    public class PrintTemplateService
    {
        private string FormatPrice(decimal price, bool show = true)
        {
            if (!show) return "";
            return price == System.Math.Floor(price)
                ? $"{price:0} руб."
                : $"{price:F2} руб.";
        }

        private string FormatDistanceDisplay(WorkItemInfo item)
        {
            if (!item.DistanceKm.HasValue) return "";

            decimal distanceKm = (decimal)item.DistanceKm.Value;
            decimal totalKm = distanceKm * item.Routes;
            return $"{distanceKm:F2} км × {item.Routes} рейс = {totalKm:F2} км";
        }

        private string FormatQuantity(decimal quantity)
        {
            if (Math.Abs(quantity - Math.Floor(quantity)) < 0.001m)
                return ((int)quantity).ToString();
            return quantity.ToString("F2");
        }
        public string BuildFullDocument(string css, List<HtmlPageModel> pages, PrintDataModel data)
        {
            var sb = new StringBuilder();

            sb.AppendLine("<!DOCTYPE html>");
            sb.AppendLine("<html>");
            sb.AppendLine("<head>");
            sb.AppendLine("<meta charset='UTF-8'>");
            sb.AppendLine("<title>Заказ " + data.Header.OrderNumber + "</title>");
            sb.AppendLine("<style>");
            sb.AppendLine(css);
            sb.AppendLine(@"
                /* Убираем отступы между таблицами */
                table {
                    margin-bottom: 0 !important;
                    border-collapse: collapse !important;
                }
                
                /* Соединяем границы таблиц */
                table + table {
                    margin-top: -1px;
                }
                
                /* Уменьшаем отступы в ячейках для экономии места */
                td, th {
                    padding: 2px 4px !important;
                    font-size: 12px !important;
                }
                
                /* Кнопка печати */
                .print-button {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 10px 20px;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    z-index: 1000;
                    font-size: 14px;
                    font-weight: bold;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                }
                
                .print-button:hover {
                    background: #0056b3;
                }
                
                @media print {
                    .print-button {
                        display: none !important;
                    }
                }
                
                /* Компактный заголовок продолжения */
                .continuation-header {
                    padding: 4px !important;
                    margin: 0 !important;
                }
            ");
            sb.AppendLine("</style>");
            sb.AppendLine("</head>");
            sb.AppendLine("<body>");

            // Кнопка печати
            sb.AppendLine(@"
<button class='print-button' onclick='window.print();'>
    Печать
</button>

<script>
    // АВТОМАТИЧЕСКИ ОТКРЫВАЕМ ДИАЛОГ ПЕЧАТИ
    window.onload = function() {
        setTimeout(function() {
            window.print();
        }, 500);
    };
    
    // Ctrl+P для печати
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            window.print();
        }
    });
</script>
");

            // Генерируем страницы
            for (int i = 0; i < pages.Count; i++)
            {
                var page = pages[i];

                if (i > 0)
                    sb.AppendLine("<div class='page-break'></div>");

                sb.AppendLine(BuildPageContent(page, data));
            }

            sb.AppendLine("</body>");
            sb.AppendLine("</html>");

            return sb.ToString();
        }

        private string BuildPageContent(HtmlPageModel page, PrintDataModel data)
        {
            var sb = new StringBuilder();

            if (page.IsFirstPage)
            {
                sb.AppendLine(BuildMainInfoTable(data));
            }
            else
            {
                sb.AppendLine(BuildContinuationHeader(page));
            }

            // Таблица работ
            sb.AppendLine(BuildWorkTables(page, data));

            // Итого (только первая страница)
            if (page.IsFirstPage && data.Financials.ShowFinancials && data.Type != PrintType.Worker)
            {
                sb.AppendLine(BuildTotalsTable(page));
            }

            // Примечание (только первая страница)
            if (page.IsFirstPage && !string.IsNullOrWhiteSpace(data.AdditionalInfo))
            {
                sb.AppendLine(BuildAdditionalInfo(data));
            }

            // Информация о памятнике (только первая страница)
            if (page.IsFirstPage)
            {
                var monumentInfo = BuildMonumentInfo(data);
                if (!string.IsNullOrWhiteSpace(monumentInfo))
                    sb.AppendLine(monumentInfo);
            }

            // Платежи
            if (page.Data?.Type != PrintType.Worker)
            {
                if (page.Payments.Any() || page.IsFirstPage)
                {
                    sb.AppendLine(BuildPaymentsTable(page));
                }
            }

            // Подписи (только последняя страница)
            if (page.IsLastPage)
            {
                sb.AppendLine(BuildSignaturesTable());
            }

            return sb.ToString();
        }

        private string BuildMainInfoTable(PrintDataModel data)
        {
            var deceasedName = data.Header.DeceasedFullName ?? "";

            return $@"
<table class='main-info'>
    <colgroup>
        <col style='width: 12%'><col style='width: 23%'>
        <col style='width: 12%'><col style='width: 23%'>
        <col style='width: 12%'><col style='width: 18%'>
    </colgroup>
    <tbody>
        <!-- Строка 1 -->
        <tr>
            <th>№ заказа</th>
            <td>{data.Header.OrderNumber}</td>
            <th>№ Участка:</th>
            <td>{data.Header.Place}</td>
            <th>Место смотрел:</th>
            <td>{data.Header.InspectionPlace}</td>
        </tr>
        
        <!-- Строка 2: Дата, Заказ принял, ФИО на участке захоронения (заголовок) -->
        <tr>
            <th>Дата:</th>
            <td>{data.Header.OrderDate:dd.MM.yyyy}</td>
            <th>Заказ принял:</th>
            <td>{data.Manager.FullName}</td>
            <th colspan='2' class='deceased-label'>ФИО на участке захоронения:</th>
        </tr>
        
        <!-- Строка 3: E-mail и начало ФИО (rowspan=4, colspan=2) -->
        <tr>
            <th>E-mail:</th>
            <td colspan='3'>{data.Customer.Email}</td>
            <td rowspan='4' colspan='2' class='deceased-value'>{deceasedName}</td>
        </tr>
        
        <!-- Строка 4: Заказчик -->
        <tr>
            <th>Заказчик:</th>
            <td colspan='3'>{data.Customer.FullName}</td>
        </tr>
        
        <!-- Строка 5: Адрес -->
        <tr>
            <th>Адрес:</th>
            <td colspan='3'>{data.Customer.Address}</td>
        </tr>
        
        <!-- Строка 6: Телефон -->
        <tr>
            <th>Телефон:</th>
            <td colspan='5'>{data.Customer.Phone}</td>
        </tr>
    </tbody>
</table>";
        }

        private string BuildContinuationHeader(HtmlPageModel page)
        {
            return $@"
<div class='continuation-header' style='margin:0;border:1px solid #000;text-align:center;padding:4px;background:#f0f0f0;font-size:12px;'>
    --- ПРОДОЛЖЕНИЕ ЗАКАЗА {page.OrderNumber} (стр. {page.PageNumber} из {page.TotalPages}) ---
</div>";
        }

        private string BuildWorkTables(HtmlPageModel page, PrintDataModel data)
        {
            var sb = new StringBuilder();
            int currentNumber = page.SequenceStartNumber;

            // Таблица дистанционных работ
            if (page.DistanceItems.Any())
            {
                sb.AppendLine(@"
        <table class='work-table work-distance'>
            <colgroup>
                <col style='width: 5%'><col style='width: 30%'><col style='width: 10%'>
                <col style='width: 8%'><col style='width: 8%'><col style='width: 8%'>
                <col style='width: 11%'><col style='width: 20%'>
            </colgroup>
            <thead>
                <tr>
                    <th>№</th><th>Работа</th><th>Цена</th><th>Км</th><th>Рейсы</th><th>Кол-во</th><th>Итого</th><th>Примечание</th>
                </tr>
            </thead>
            <tbody>");

                foreach (var item in page.DistanceItems)
                {
                    sb.AppendLine($@"
                <tr>
                    <td>{currentNumber}.</td>
                    <td>{item.Description}</td>
                    <td>{FormatPrice(item.Price, item.ShowPrice)}</td>
                    <td>{item.DistanceKm}</td>
                    <td>{item.Routes}</td>
                    <td>{FormatQuantity(item.CalculatedQuantity)}</td>
                    <td>{FormatPrice(item.Total, item.ShowPrice)}</td>
                    <td>{item.Note}</td>
                </tr>");
                    currentNumber++;
                }
                sb.AppendLine("    </tbody>\n</table>");
            }

            // ===== ИЗМЕНЕНО: Таблица обычных работ с добавленным столбцом "Итого" =====
            if (page.RegularItems.Any())
            {
                sb.AppendLine(@"
        <table class='work-table work-regular'>
            <colgroup>
                <col style='width: 5%'><col style='width: 35%'>
                <col style='width: 8%'><col style='width: 10%'>
                <col style='width: 12%'><col style='width: 30%'>
            </colgroup>
            <thead>
                <tr>
                    <th>№</th><th>Работа</th><th>Кол-во</th><th>Цена</th><th>Итого</th><th>Примечание</th>
                </tr>
            </thead>
            <tbody>");

                foreach (var item in page.RegularItems)
                {
                    // Вычисляем итого для строки
                    var total = item.Price * item.Quantity;
                    
                    sb.AppendLine($@"
                <tr>
                    <td>{currentNumber}.</td>
                    <td>{item.Description}</td>
                    <td>{FormatQuantity(item.Quantity)}</td>
                    <td>{FormatPrice(item.Price, item.ShowPrice)}</td>
                    <td>{FormatPrice(total, item.ShowPrice)}</td>
                    <td>{item.Note}</td>
                </tr>");
                    currentNumber++;
                }
                sb.AppendLine("    </tbody>\n</table>");
            }

            return sb.ToString();
        }

        private string BuildTotalsTable(HtmlPageModel page)
        {
            return $@"
<table class='totals'>
    <colgroup>
        <col style='width: 50%'>
        <col style='width: 50%'>
    </colgroup>
    <tbody>
        <tr>
            <td><strong>ИТОГО:</strong></td>
            <td><strong>{FormatPrice(page.TotalAmount, true)}</strong></td>
        </tr>
    </tbody>
</table>";
        }

        private string BuildAdditionalInfo(PrintDataModel data)
        {
            return $@"
<table class='additional-info'>
    <colgroup>
        <col style='width: 15%'>
        <col style='width: 85%'>
    </colgroup>
    <tbody>
        <tr>
            <th>Примечание:</th>
            <td>{data.AdditionalInfo}</td>
        </tr>
    </tbody>
</table>";
        }

        private string BuildMonumentInfo(PrintDataModel data)
        {
            if (string.IsNullOrWhiteSpace(data.Header.MonumentType) &&
                string.IsNullOrWhiteSpace(data.Header.MonumentSize))
                return "";

            var sb = new StringBuilder();
            sb.AppendLine(@"
<table class='monument-info'>
    <colgroup>
        <col style='width: 20%'>
        <col style='width: 80%'>
    </colgroup>
    <tbody>
        <tr><th colspan='2'>ИНФОРМАЦИЯ О ПАМЯТНИКЕ</th></tr>");

            if (!string.IsNullOrWhiteSpace(data.Header.MonumentType))
            {
                sb.AppendLine($@"        <tr><th>Тип памятника:</th><td>{data.Header.MonumentType}</td></tr>");
            }

            if (!string.IsNullOrWhiteSpace(data.Header.MonumentSize))
            {
                sb.AppendLine($@"        <tr><th>Размер памятника:</th><td>{data.Header.MonumentSize}</td></tr>");
            }

            sb.AppendLine("    </tbody>\n</table>");
            return sb.ToString();
        }

        private string BuildPaymentsTable(HtmlPageModel page)
        {
            var sb = new StringBuilder();
            sb.AppendLine(@"
        <table class='payments'>
            <colgroup>
                <col style='width: 14%'><col style='width: 10%'><col style='width: 10%'><col style='width: 10%'>
                <col style='width: 14%'><col style='width: 10%'><col style='width: 10%'><col style='width: 10%'>
            </colgroup>
            <thead>
                <tr><th colspan='8'>ПЛАТЕЖИ</th></tr>
                <tr>
                    <th>Тип платежа:</th><th>Сумма:</th><th>Дата:</th><th>Подпись:</th>
                    <th>Тип платежа:</th><th>Сумма:</th><th>Дата:</th><th>Подпись:</th>
                </tr>
            </thead>
            <tbody>");

            var payments = page.Payments;

            for (int i = 0; i < payments.Count; i += 2)
            {
                var left = payments[i];
                var right = (i + 1) < payments.Count ? payments[i + 1] : null;

                sb.AppendLine("        <tr>");

                // Левая колонка
                sb.AppendLine($"            <td>{left.PaymentType}</td>");
                sb.AppendLine($"            <td>{FormatPrice(left.Amount, left.ShowAmount)}</td>");
                sb.AppendLine($"            <td>{left.PaymentDate:dd.MM.yyyy}</td>");
                sb.AppendLine($"            <td></td>");

                // Правая колонка
                if (right != null)
                {
                    sb.AppendLine($"            <td>{right.PaymentType}</td>");
                    sb.AppendLine($"            <td>{FormatPrice(right.Amount, right.ShowAmount)}</td>");
                    sb.AppendLine($"            <td>{right.PaymentDate:dd.MM.yyyy}</td>");
                    sb.AppendLine($"            <td></td>");
                }
                else
                {
                    // Если платежей нечетное количество — правую часть оставляем пустой
                    sb.AppendLine("            <td></td><td></td><td></td><td></td>");
                }

                sb.AppendLine("        </tr>");
            }

            sb.AppendLine("    </tbody>\n</table>");
            return sb.ToString();
        }

        private string BuildSignaturesTable()
        {
            return @"
<table class='signatures'>
    <colgroup>
        <col style='width: 50%'>
        <col style='width: 50%'>
    </colgroup>
    <tbody>
        <tr>
            <td>Скидка при следующем заказе % - -</td>
            <td>Заказ выполнен полностью, претензий не имею - -</td>
        </tr>
    </tbody>
</table>";
        }
    }
}