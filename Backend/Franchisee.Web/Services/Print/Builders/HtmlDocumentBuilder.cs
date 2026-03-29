// Services/Print/Builders/HtmlDocumentBuilder.cs
using Franchisee.Web.Models.Print;
using System.Text;
using System.Linq;

namespace Franchisee.Web.Services.Print.Builders
{
    public class HtmlDocumentBuilder : IPrintDocumentBuilder
    {
        private string FormatPrice(decimal price)
        {
            // Если цена целое число - показываем без копеек
            if (price == Math.Floor(price))
            {
                return $"{price:0} руб.";
            }
            // Иначе показываем с 2 знаками
            return $"{price:F2} руб.";
        }
        public string GetContentType => "text/html";
        public string GetFileExtension => ".html";

        public byte[] BuildExcel(PrintDataModel data)
        {
            // Для HTML билдера Excel не нужен
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
            
            sb.AppendLine("<!DOCTYPE html>");
            sb.AppendLine("<html>");
            sb.AppendLine("<head>");
            sb.AppendLine("<meta charset='UTF-8'>");
            sb.AppendLine($"<title>Заказ {data.Header.OrderNumber}</title>");
            sb.AppendLine(@"
                <style>
                    @page { size: A4; margin: 0.5cm; }
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; font-size: 11px; }
                    .a4-page { width: 19.5cm; margin: 0 auto; border: 1px solid #000; }
                    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                    td { border: 1px solid #000; padding: 2px 3px; vertical-align: top; height: 18px; }
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

            // Заголовок работ
            sb.AppendLine("<tr class='bold center'>");
            sb.AppendLine("<td>№</td><td colspan='3'>Вид работы:</td><td>Стоимость:</td><td colspan='3'>Примечание:</td>");
            sb.AppendLine("<tr>");

            // Работы
            for (int i = 0; i < 26; i++)
            {
                var work = i < data.WorkItems.Count ? data.WorkItems[i] : null;
                var description = work?.Description ?? "";
                var note = work?.Note ?? "";
                var price = (work != null && work.ShowPrice) ? FormatPrice(work.Total) : "";
                
                sb.AppendLine("<tr>");
                sb.AppendLine($"<td>{i + 1}.</td>");
                sb.AppendLine($"<td colspan='3'>{description}</td>");
                sb.AppendLine($"<td>{price}</td>");
                sb.AppendLine($"<td colspan='3'>{note}</td>");
                sb.AppendLine("</tr>");
            }

            // Итого
            var total = data.WorkItems.Sum(w => w.Total);
            var totalDisplay = data.Financials.ShowFinancials ? FormatPrice(total) : "";
            sb.AppendLine("<tr class='bold center'>");
            sb.AppendLine($"<td colspan='4'>ИТОГО:</td><td colspan='4'>{totalDisplay}</td>");
            sb.AppendLine("</tr>");

            // Примечание
            sb.AppendLine("<tr>");
            sb.AppendLine($"<td class='bold center'>Примечание:</td><td colspan='7'>{data.AdditionalInfo}</td>");
            sb.AppendLine("</tr>");

            // Платежи
            sb.AppendLine("<tr class='bold center'>");
            sb.AppendLine("<td></td><td>Сумма:</td><td>Дата:</td><td>Подпись:</td><td></td><td>Сумма:</td><td>Дата:</td><td>Подпись:</td>");
            sb.AppendLine("</tr>");

            for (int i = 0; i < 4; i++)
            {
                var left = i < data.Payments.Count ? data.Payments[i] : null;
                var right = (i + 4) < data.Payments.Count ? data.Payments[i + 4] : null;
                
                var leftType = left?.PaymentType ?? (i == 0 ? "Аванс" : "Доплата");
                var leftAmount = (left != null && left.ShowAmount) ? FormatPrice(left.Amount) : "";
                var leftDate = (left != null && left.ShowAmount) ? left.PaymentDate.ToString("dd.MM.yyyy") : "";
                
                var rightType = right?.PaymentType ?? "Доплата";
                var rightAmount = (right != null && right.ShowAmount) ? FormatPrice(right.Amount) : "";            
                var rightDate = (right != null && right.ShowAmount) ? right.PaymentDate.ToString("dd.MM.yyyy") : "";
                
                sb.AppendLine("<tr>");
                sb.AppendLine($"<td class='bold'>{leftType}</td>");
                sb.AppendLine($"<td>{leftAmount}</td>");
                sb.AppendLine($"<td>{leftDate}</td>");
                sb.AppendLine("<td></td>");
                sb.AppendLine($"<td class='bold'>{rightType}</td>");
                sb.AppendLine($"<td>{rightAmount}</td>");
                sb.AppendLine($"<td>{rightDate}</td>");
                sb.AppendLine("<td></td>");
                sb.AppendLine("</tr>");
            }

            // Подписи
            sb.AppendLine("<tr>");
            sb.AppendLine("<td colspan='3' class='bold'>Скидка при следующем заказе % -</td>");
            sb.AppendLine("<td></td>");
            sb.AppendLine("<td colspan='3' class='bold'>Заказ выполнен полностью, претензий не имею -</td>");
            sb.AppendLine("<td></td>");
            sb.AppendLine("</tr>");

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
                    .worker-title { background-color: #f0f0f0; font-size: 14px; }
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

            // Заголовок
            sb.AppendLine("<tr><td colspan='8' class='bold center worker-title'>РАБОЧИЙ ДОКУМЕНТ (без цен)</td></tr>");
            sb.AppendLine("<tr><td colspan='8' style='height: 5px;'></td></tr>");

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

            sb.AppendLine("<tr><td colspan='8' style='height: 10px;'></td></tr>");

            // Заголовок работ
            sb.AppendLine("<tr class='bold center'>");
            sb.AppendLine("<td>№</td><td colspan='4'>Вид работы:</td><td colspan='3'>Примечание:</td>");
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

            sb.AppendLine("<tr><td colspan='8' style='height: 10px;'></td></tr>");

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
    }
}