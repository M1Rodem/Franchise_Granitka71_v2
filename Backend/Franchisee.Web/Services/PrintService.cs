using ClosedXML.Excel;
using Franchisee.Web.Models;
using Franchisee.Web.Services.Repositories;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace Franchisee.Web.Services
{
    public class PrintService : IPrintService
    {
        private readonly IOrderRepository _orderRepository;
        private readonly IWebHostEnvironment _environment;
        private readonly string _baseUrl;

        public PrintService(IOrderRepository orderRepository, IWebHostEnvironment environment, IOptions<AppSettings> appSettings)
        {
            _orderRepository = orderRepository;
            _environment = environment;
            _baseUrl = appSettings.Value.BaseUrl;
        }

        public async Task<PrintOrderResponse> GenerateOrderDocumentAsync(int orderId)
        {
            var order = await _orderRepository.GetByIdAsync(orderId);
            if (order == null)
                throw new ArgumentException($"Заказ с ID {orderId} не найден");

            var orderData = new OrderPrintData
            {
                Order = order,
                WorkItems = order.WorkItems.ToList(),
                Payments = order.Payments.ToList(),
                Manager = order.Manager!
            };

            using var memoryStream = new MemoryStream();
            using var workbook = new XLWorkbook();

            // ЛИСТ 1 - ОСНОВНОЙ
            var worksheet = workbook.Worksheets.Add("Заказ_1");
            CreateMainPage(worksheet, orderData);

            // ЛИСТ 2 - ДОПОЛНИТЕЛЬНЫЕ РАБОТЫ И/ИЛИ ПЛАТЕЖИ
            if (orderData.WorkItems.Count > 26 || orderData.Payments.Count > 8)
            {
                var worksheet2 = workbook.Worksheets.Add("Заказ_2");
                CreateAdditionalPage(worksheet2, orderData,
                    workStartIndex: 26,
                    paymentStartIndex: 8);
            }

            // ЛИСТ 3 - ЕЩЕ БОЛЬШЕ ДАННЫХ
            if (orderData.WorkItems.Count > 56 || orderData.Payments.Count > 16)
            {
                var worksheet3 = workbook.Worksheets.Add("Заказ_3");
                CreateAdditionalPage(worksheet3, orderData,
                    workStartIndex: 56,
                    paymentStartIndex: 16);
            }

            // ЛИСТ 4 - МАКСИМУМ
            if (orderData.WorkItems.Count > 86 || orderData.Payments.Count > 24)
            {
                var worksheet4 = workbook.Worksheets.Add("Заказ_4");
                CreateAdditionalPage(worksheet4, orderData,
                    workStartIndex: 86,
                    paymentStartIndex: 24);
            }

            workbook.SaveAs(memoryStream);
            memoryStream.Position = 0;

            return new PrintOrderResponse
            {
                FileContent = memoryStream.ToArray(),
                FileName = $"Заказ_{order.OrderNumber}_{DateTime.Now:yyyyMMdd}.xlsx",
                ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            };
        }

        // ОСНОВНАЯ СТРАНИЦА
        private void CreateMainPage(IXLWorksheet worksheet, OrderPrintData orderData)
        {
            // НАСТРОЙКА СТРАНИЦЫ (без изменений)
            worksheet.PageSetup.PaperSize = XLPaperSize.A4Paper;
            worksheet.PageSetup.Margins.Top = 0.5;
            worksheet.PageSetup.Margins.Bottom = 0.5;
            worksheet.PageSetup.Margins.Left = 0.5;
            worksheet.PageSetup.Margins.Right = 0.5;
            worksheet.PageSetup.FitToPages(1, 1);

            worksheet.Column(1).Width = 12;
            worksheet.Column(2).Width = 15;
            worksheet.Column(3).Width = 15;
            worksheet.Column(4).Width = 15;
            worksheet.Column(5).Width = 12;
            worksheet.Column(6).Width = 19;
            worksheet.Column(7).Width = 15;
            worksheet.Column(8).Width = 15;

            for (int row = 1; row <= 43; row++)
            {
                worksheet.Row(row).Height = 18;
            }

            worksheet.Style.Font.FontSize = 11;

            // ШАПКА (без изменений)
            // Строка 1
            SetBoldCell(worksheet, "A1", "№ заказа");
            worksheet.Cell("B1").Value = orderData.Order.OrderNumber;

            SetBoldCell(worksheet, "C1", "№ Участка:");
            worksheet.Range("D1:E1").Merge();
            worksheet.Cell("D1").Value = orderData.Order.Place;

            SetBoldCell(worksheet, "F1", "Место смотрел:");
            worksheet.Range("G1:H1").Merge();
            worksheet.Cell("G1").Value = orderData.Order.InspectionPlace;

            // Строка 2
            SetBoldCell(worksheet, "A2", "Дата:");
            worksheet.Cell("B2").Value = orderData.Order.OrderDate.ToString("dd.MM.yyyy");

            SetBoldCell(worksheet, "C2", "Заказ принял:");
            worksheet.Range("D2:E2").Merge();
            worksheet.Cell("D2").Value = orderData.Manager.FullName;

            worksheet.Range("F2:H2").Merge();
            SetBoldCell(worksheet, "F2", "ФИО на участке захоронения:");

            // Строка 3
            SetBoldCell(worksheet, "A3", "E-mail:");
            worksheet.Range("B3:E3").Merge();
            worksheet.Cell("B3").Value = orderData.Order.CustomerEmail ?? "";

            worksheet.Range("F3:H6").Merge();
            worksheet.Cell("F3").Value = orderData.Order.DeceasedFullName;

            // Строка 4
            SetBoldCell(worksheet, "A4", "Заказчик:");
            worksheet.Range("B4:E4").Merge();
            worksheet.Cell("B4").Value = orderData.Order.CustomerFullName;

            // Строка 5
            SetBoldCell(worksheet, "A5", "Адрес:");
            worksheet.Range("B5:E5").Merge();
            worksheet.Cell("B5").Value = orderData.Order.Address;

            // Строка 6
            SetBoldCell(worksheet, "A6", "Телефон:");
            worksheet.Range("B6:E6").Merge();
            worksheet.Cell("B6").Value = orderData.Order.Phone;

            // Строка 7
            worksheet.Cell("A7").Value = "№";
            worksheet.Range("B7:D7").Merge();
            SetBoldCell(worksheet, "B7", "Вид работы:");
            SetBoldCell(worksheet, "E7", "Стоимость:");
            worksheet.Range("F7:H7").Merge();
            SetBoldCell(worksheet, "F7", "Примечание:");

            // РАБОТЫ (первые 26)
            for (int i = 0; i < 26; i++)
            {
                var rowNum = 8 + i;
                var workItem = i < orderData.WorkItems.Count ? orderData.WorkItems[i] : null;

                worksheet.Cell($"A{rowNum}").Value = $"{i + 1}.";

                if (workItem != null)
                {
                    worksheet.Range($"B{rowNum}:D{rowNum}").Merge();
                    worksheet.Cell($"B{rowNum}").Value = workItem.WorkDescription;
                    worksheet.Cell($"E{rowNum}").Value = $"{workItem.Price * workItem.Quantity} руб.";
                    worksheet.Range($"F{rowNum}:H{rowNum}").Merge();
                    worksheet.Cell($"F{rowNum}").Value = workItem.Note;
                }
                else
                {
                    worksheet.Range($"B{rowNum}:D{rowNum}").Merge();
                    worksheet.Range($"F{rowNum}:H{rowNum}").Merge();
                }
            }

            // Итого
            worksheet.Range("A34:D34").Merge();
            SetBoldCell(worksheet, "A34", "ИТОГО:");
            worksheet.Range("E34:H34").Merge();

            // Считаем общую сумму ВСЕХ работ
            var totalAllWorkPrice = orderData.WorkItems.Sum(item => item.Price * item.Quantity);
            worksheet.Cell("E34").Value = $"{totalAllWorkPrice} руб.";

            // Примечание
            worksheet.Range("A35:A37").Merge();
            SetBoldCell(worksheet, "A35", "Примечание:");
            worksheet.Range("B35:H37").Merge();
            worksheet.Cell("B35").Value = orderData.Order.AdditionalInfo;

            // Заголовки платежей
            SetBoldCell(worksheet, "B38", "Сумма:");
            SetBoldCell(worksheet, "C38", "Дата:");
            SetBoldCell(worksheet, "D38", "Подпись:");
            SetBoldCell(worksheet, "F38", "Сумма:");
            SetBoldCell(worksheet, "G38", "Дата:");
            SetBoldCell(worksheet, "H38", "Подпись:");

            // ПЛАТЕЖИ - ИСПРАВЛЕННАЯ ВЕРСИЯ
            for (int i = 0; i < 4; i++)
            {
                var rowNum = 39 + i;
                var paymentLeft = i < orderData.Payments.Count ? orderData.Payments[i] : null;
                var paymentRight = (i + 4) < orderData.Payments.Count ? orderData.Payments[i + 4] : null;

                // ЛЕВАЯ ЧАСТЬ
                SetBoldCell(worksheet, $"A{rowNum}", paymentLeft?.PaymentType ?? (i == 0 ? "Аванс" : "Доплата"));

                if (paymentLeft != null)
                {
                    worksheet.Cell($"B{rowNum}").Value = $"{paymentLeft.Amount} руб.";
                    worksheet.Cell($"C{rowNum}").Value = paymentLeft.PaymentDate.ToString("dd.MM.yyyy");
                }

                // ПРАВАЯ ЧАСТЬ - ОТДЕЛЬНЫЕ ПЛАТЕЖИ
                SetBoldCell(worksheet, $"E{rowNum}", paymentRight?.PaymentType ?? "Доплата");

                if (paymentRight != null)
                {
                    worksheet.Cell($"F{rowNum}").Value = $"{paymentRight.Amount} руб.";
                    worksheet.Cell($"G{rowNum}").Value = paymentRight.PaymentDate.ToString("dd.MM.yyyy");
                }
            }

            // Подписи
            worksheet.Range("A43:C43").Merge();
            SetBoldCell(worksheet, "A43", "Скидка при следующем заказе % -");
            worksheet.Range("E43:G43").Merge();
            SetBoldCell(worksheet, "E43", "Заказ выполнен полностью, претензий не имею -");

            // Границы
            var dataRange = worksheet.Range("A1:H43");
            dataRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            dataRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;

            // Выравнивание
            worksheet.Range("A1:H7").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            worksheet.Range("A34:H35").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            worksheet.Range("B38:H38").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            worksheet.Range("F3:H6").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            worksheet.Range("F3:H6").Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            worksheet.Range("F3:H6").Style.Alignment.WrapText = true;
            worksheet.Range("B35:H37").Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            worksheet.Range("B35:H37").Style.Alignment.WrapText = true;
        }

        // ДОПОЛНИТЕЛЬНАЯ СТРАНИЦА
        private void CreateAdditionalPage(IXLWorksheet worksheet, OrderPrintData orderData, int workStartIndex, int paymentStartIndex)
        {
            // Настройка страницы
            worksheet.PageSetup.PaperSize = XLPaperSize.A4Paper;
            worksheet.PageSetup.Margins.Top = 0.5;
            worksheet.PageSetup.Margins.Bottom = 0.5;
            worksheet.PageSetup.Margins.Left = 0.5;
            worksheet.PageSetup.Margins.Right = 0.5;
            worksheet.PageSetup.FitToPages(1, 1);

            worksheet.Column(1).Width = 12;
            worksheet.Column(2).Width = 15;
            worksheet.Column(3).Width = 15;
            worksheet.Column(4).Width = 15;
            worksheet.Column(5).Width = 12;
            worksheet.Column(6).Width = 19;
            worksheet.Column(7).Width = 15;
            worksheet.Column(8).Width = 15;

            for (int row = 1; row <= 43; row++)
            {
                worksheet.Row(row).Height = 18;
            }

            worksheet.Style.Font.FontSize = 11;

            int currentRow = 1;

            // Заголовок дополнительной страницы
            SetBoldCell(worksheet, $"A{currentRow}", "ПРОДОЛЖЕНИЕ ЗАКАЗА");
            worksheet.Range($"A{currentRow}:H{currentRow}").Merge();
            currentRow += 2;

            // ДОПОЛНИТЕЛЬНЫЕ РАБОТЫ (если есть)
            if (workStartIndex < orderData.WorkItems.Count)
            {
                SetBoldCell(worksheet, $"A{currentRow}", "ДОПОЛНИТЕЛЬНЫЕ РАБОТЫ:");
                worksheet.Range($"A{currentRow}:H{currentRow}").Merge();
                currentRow++;

                // Заголовок таблицы работ
                worksheet.Cell($"A{currentRow}").Value = "№";
                worksheet.Range($"B{currentRow}:D{currentRow}").Merge();
                SetBoldCell(worksheet, $"B{currentRow}", "Вид работы:");
                SetBoldCell(worksheet, $"E{currentRow}", "Стоимость:");
                worksheet.Range($"F{currentRow}:H{currentRow}").Merge();
                SetBoldCell(worksheet, $"F{currentRow}", "Примечание:");
                currentRow++;

                // Продолжение работ
                for (int i = workStartIndex; i < orderData.WorkItems.Count && i < workStartIndex + 30; i++)
                {
                    var workItem = orderData.WorkItems[i];
                    worksheet.Cell($"A{currentRow}").Value = $"{i + 1}.";
                    worksheet.Range($"B{currentRow}:D{currentRow}").Merge();
                    worksheet.Cell($"B{currentRow}").Value = workItem.WorkDescription;
                    worksheet.Cell($"E{currentRow}").Value = $"{workItem.Price * workItem.Quantity} руб.";
                    worksheet.Range($"F{currentRow}:H{currentRow}").Merge();
                    worksheet.Cell($"F{currentRow}").Value = workItem.Note;
                    currentRow++;
                }

                currentRow++; // Отступ после работ
            }

            // ДОПОЛНИТЕЛЬНЫЕ ПЛАТЕЖИ (если есть)
            if (paymentStartIndex < orderData.Payments.Count)
            {
                SetBoldCell(worksheet, $"A{currentRow}", "ДОПОЛНИТЕЛЬНЫЕ ПЛАТЕЖИ:");
                worksheet.Range($"A{currentRow}:H{currentRow}").Merge();
                currentRow++;

                // Заголовки платежей
                SetBoldCell(worksheet, $"B{currentRow}", "Сумма:");
                SetBoldCell(worksheet, $"C{currentRow}", "Дата:");
                SetBoldCell(worksheet, $"D{currentRow}", "Подпись:");
                SetBoldCell(worksheet, $"F{currentRow}", "Сумма:");
                SetBoldCell(worksheet, $"G{currentRow}", "Дата:");
                SetBoldCell(worksheet, $"H{currentRow}", "Подпись:");
                currentRow++;

                // Продолжение платежей
                int paymentCount = 0;
                for (int i = paymentStartIndex; i < orderData.Payments.Count && paymentCount < 8; i++)
                {
                    var payment = orderData.Payments[i];

                    if (paymentCount % 2 == 0) // ЛЕВАЯ ЧАСТЬ (A-B-C-D)
                    {
                        SetBoldCell(worksheet, $"A{currentRow}", payment.PaymentType);
                        worksheet.Cell($"B{currentRow}").Value = $"{payment.Amount} руб.";
                        worksheet.Cell($"C{currentRow}").Value = payment.PaymentDate.ToString("dd.MM.yyyy");
                        // D{currentRow} - оставляем пустым для подписи
                    }
                    else // ПРАВАЯ ЧАСТЬ (E-F-G-H)
                    {
                        SetBoldCell(worksheet, $"E{currentRow}", payment.PaymentType);
                        worksheet.Cell($"F{currentRow}").Value = $"{payment.Amount} руб.";
                        worksheet.Cell($"G{currentRow}").Value = payment.PaymentDate.ToString("dd.MM.yyyy");
                        // H{currentRow} - оставляем пустым для подписи
                        currentRow++; // Переходим на следующую строку после правой части
                    }

                    paymentCount++;
                }

                // Если последняя строка не завершена (только левая часть)
                if (paymentCount % 2 != 0)
                {
                    currentRow++;
                }
            }

            // Границы для всей области с данными
            if (currentRow > 1)
            {
                var dataRange = worksheet.Range($"A1:H{currentRow - 1}");
                dataRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                dataRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
            }
        }

        public async Task<string> GenerateOrderHtmlAsync(int orderId)
        {
            var order = await _orderRepository.GetByIdAsync(orderId);
            if (order == null)
                throw new ArgumentException($"Заказ с ID {orderId} не найден");

            var orderData = new OrderPrintData
            {
                Order = order,
                WorkItems = order.WorkItems.ToList(),
                Payments = order.Payments.ToList(),
                Manager = order.Manager!
            };

            // Создаем HTML который ТОЧНО повторяет Excel шаблон
            var htmlContent = GenerateExcelLikeHtml(orderData);
            return htmlContent;
        }

        private string GenerateExcelLikeHtml(OrderPrintData orderData)
        {
            var totalWorkPrice = orderData.WorkItems.Sum(item => item.Price * item.Quantity);

            // Генерируем работы (всегда 26 строк)
            var workItemsHtml = "";
            for (int i = 0; i < 26; i++)
            {
                var workItem = i < orderData.WorkItems.Count ? orderData.WorkItems[i] : null;
                var itemTotal = workItem != null ? workItem.Price * workItem.Quantity : 0;

                workItemsHtml += $@"
        <tr class='work-row'>
            <td class='cell-number'>{i + 1}.</td>
            <td colspan='3' class='cell-work-desc'>{workItem?.WorkDescription ?? ""}</td>
            <td class='cell-price'>{(workItem != null ? $"{itemTotal} руб." : "")}</td>
            <td colspan='3' class='cell-note'>{workItem?.Note ?? ""}</td>
        </tr>";
            }

            // Генерируем платежи (всегда 4 строки)
            var paymentsHtml = "";
            for (int i = 0; i < 4; i++)
            {
                var paymentLeft = i < orderData.Payments.Count ? orderData.Payments[i] : null;
                var paymentRight = (i + 4) < orderData.Payments.Count ? orderData.Payments[i + 4] : null;

                paymentsHtml += $@"
        <tr class='payment-row'>
            <td class='cell-payment-type bold'>{paymentLeft?.PaymentType ?? (i == 0 ? "Аванс" : "Доплата")}</td>
            <td class='cell-amount'>{(paymentLeft != null ? $"{paymentLeft.Amount} руб." : "")}</td>
            <td class='cell-date'>{(paymentLeft != null ? paymentLeft.PaymentDate.ToString("dd.MM.yyyy") : "")}</td>
            <td class='cell-signature'></td>
            <td class='cell-payment-type bold'>{paymentRight?.PaymentType ?? "Доплата"}</td>
            <td class='cell-amount'>{(paymentRight != null ? $"{paymentRight.Amount} руб." : "")}</td>
            <td class='cell-date'>{(paymentRight != null ? paymentRight.PaymentDate.ToString("dd.MM.yyyy") : "")}</td>
            <td class='cell-signature'></td>
        </tr>";
            }

            return $@"
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Заказ {orderData.Order.OrderNumber}</title>
                    <meta charset='UTF-8'>
                    <style>
                        /* ОСНОВНЫЕ СТИЛИ ДЛЯ A4 */
                        @page {{
                            size: A4;
                            margin: 0.5cm;
                        }}
        
                        body {{
                            font-family: Arial, sans-serif;
                            margin: 0;
                            padding: 0;
                            font-size: 11px;
                            line-height: 1.2;
                            background: white;
                            width: 21cm;
                            height: 29.7cm;
                        }}
        
                        .a4-page {{
                            width: 19.5cm; /* 21cm - margins */
                            height: 28.7cm; /* 29.7cm - margins */
                            margin: 0 auto;
                            border: 1px solid #000;
                            position: relative;
                        }}
        
                        .main-table {{
                            width: 100%;
                            border-collapse: collapse;
                            table-layout: fixed;
                        }}
        
                        .main-table td {{
                            border: 1px solid #000;
                            padding: 2px 3px;
                            vertical-align: top;
                            overflow: hidden;
                            height: 18px;
                        }}
        
                        /* ФИКСИРОВАННЫЕ ШИРИНЫ КАК В EXCEL */
                        .cell-number {{ width: 1.5cm; }}          /* A - 12% */
                        .cell-work-desc {{ width: 7.3cm; }}       /* B-D - 45% */
                        .cell-price {{ width: 1.5cm; }}           /* E - 12% */
                        .cell-note {{ width: 5cm; }}              /* F-H - 31% */
                        .cell-payment-type {{ width: 1.5cm; }}    /* A/E - 12% */
                        .cell-amount {{ width: 1.9cm; }}          /* B/F - 15% */
                        .cell-date {{ width: 1.9cm; }}            /* C/G - 15% */
                        .cell-signature {{ width: 1.9cm; }}       /* D/H - 15% */
        
                        .bold {{ font-weight: bold; }}
                        .center {{ text-align: center; }}
        
                        /* ОСОБЫЕ СТИЛИ ДЛЯ ОБЪЕДИНЕННЫХ ЯЧЕЕК */
                        .merged-cell {{
                            text-align: center;
                            vertical-align: middle;
                            word-wrap: break-word;
                        }}
        
                        .deceased-name {{
                            height: 72px; /* 4 строки × 18px */
                            line-height: 1.1;
                        }}
        
                        .additional-info {{
                            height: 54px; /* 3 строки × 18px */
                            vertical-align: top;
                        }}
        
                        /* ПЕЧАТЬ */
                        @media print {{
                            body {{
                                margin: 0 !important;
                                padding: 0 !important;
                                width: 21cm;
                                height: 29.7cm;
                            }}
            
                            .a4-page {{
                                border: none;
                                margin: 0;
                                width: 21cm;
                                height: 29.7cm;
                                page-break-after: always;
                            }}
            
                            .page-break {{
                                page-break-before: always;
                            }}
                        }}
                    </style>
                </head>
                <body>
                    <div class='a4-page'>
                        <table class='main-table'>
                            <!-- Строка 1 -->
                            <tr>
                                <td class='bold center' style='width: 1.5cm'>№ заказа</td>
                                <td style='width: 1.9cm'>{orderData.Order.OrderNumber}</td>
                                <td class='bold center' style='width: 1.9cm'>№ Участка:</td>
                                <td colspan='2' style='width: 3.8cm'>{orderData.Order.Place}</td>
                                <td class='bold center' style='width: 2.4cm'>Место смотрел:</td>
                                <td colspan='2' style='width: 3.8cm'>{orderData.Order.InspectionPlace}</td>
                            </tr>

                            <!-- Строка 2 -->
                            <tr>
                                <td class='bold center'>Дата:</td>
                                <td>{orderData.Order.OrderDate:dd.MM.yyyy}</td>
                                <td class='bold center'>Заказ принял:</td>
                                <td colspan='2'>{orderData.Manager.FullName}</td>
                                <td colspan='3' class='bold center'>ФИО на участке захоронения:</td>
                            </tr>

                            <!-- Строка 3 -->
                            <tr>
                                <td class='bold center'>E-mail:</td>
                                <td colspan='4'>{orderData.Order.CustomerEmail ?? ""}</td>
                                <td colspan='3' rowspan='4' class='merged-cell deceased-name'>{orderData.Order.DeceasedFullName}</td>
                            </tr>

                            <!-- Строка 4 -->
                            <tr>
                                <td class='bold center'>Заказчик:</td>
                                <td colspan='4'>{orderData.Order.CustomerFullName}</td>
                            </tr>

                            <!-- Строка 5 -->
                            <tr>
                                <td class='bold center'>Адрес:</td>
                                <td colspan='4'>{orderData.Order.Address}</td>
                            </tr>

                            <!-- Строка 6 -->
                            <tr>
                                <td class='bold center'>Телефон:</td>
                                <td colspan='4'>{orderData.Order.Phone}</td>
                            </tr>

                            <!-- Заголовок работ -->
                            <tr class='bold center'>
                                <td>№</td>
                                <td colspan='3'>Вид работы:</td>
                                <td>Стоимость:</td>
                                <td colspan='3'>Примечание:</td>
                            </tr>

                            <!-- Работы (26 строк) -->
                            {workItemsHtml}

                            <!-- Итого по работам -->
                            <tr class='bold center'>
                                <td colspan='4'>ИТОГО:</td>
                                <td colspan='4'>{totalWorkPrice} руб.</td>
                            </tr>

                            <!-- Примечание -->
                            <tr>
                                <td class='bold center'>Примечание:</td>
                                <td colspan='7' class='additional-info'>{orderData.Order.AdditionalInfo}</td>
                            </tr>

                            <!-- Заголовок платежей -->
                            <tr class='bold center'>
                                <td></td>
                                <td>Сумма:</td>
                                <td>Дата:</td>
                                <td>Подпись:</td>
                                <td></td>
                                <td>Сумма:</td>
                                <td>Дата:</td>
                                <td>Подпись:</td>
                            </tr>

                            <!-- Платежи (4 строки) -->
                            {paymentsHtml}

                            <!-- Подписи в конце -->
                            <tr>
                                <td colspan='3' class='bold'>Скидка при следующем заказе % -</td>
                                <td></td>
                                <td colspan='3' class='bold'>Заказ выполнен полностью, претензий не имею -</td>
                                <td></td>
                            </tr>
                        </table>
                    </div>

                    <!-- ДОПОЛНИТЕЛЬНЫЕ СТРАНИЦЫ -->
                    {(orderData.WorkItems.Count > 26 || orderData.Payments.Count > 8 ? GenerateAdditionalPagesHtml(orderData) : "")}

                    <script>
                        window.onload = function() {{
                            setTimeout(function() {{
                                window.print();
                            }}, 500);
                        }};
                    </script>
                </body>
                </html>";
        }

        // ДОПОЛНИТЕЛЬНЫЕ СТРАНИЦЫ
        private string GenerateAdditionalPagesHtml(OrderPrintData orderData)
        {
            var additionalPagesHtml = "";

            // Страница 2 - дополнительные работы (если больше 26) и/или платежи (если больше 8)
            if (orderData.WorkItems.Count > 26 || orderData.Payments.Count > 8)
            {
                additionalPagesHtml += $@"
                    <div class='a4-page page-break'>
                        <div style='text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 10px;'>
                            ПРОДОЛЖЕНИЕ ЗАКАЗА {orderData.Order.OrderNumber}
                        </div>
        
                        <table class='main-table'>
                            {(orderData.WorkItems.Count > 26 ? GenerateAdditionalWorksHtml(orderData, 26) : "")}
                            {(orderData.Payments.Count > 8 ? GenerateAdditionalPaymentsHtml(orderData, 8) : "")}
                        </table>
                    </div>
                ";
            }

            // Страница 3 - если еще больше данных
            if (orderData.WorkItems.Count > 56 || orderData.Payments.Count > 16)
            {
                additionalPagesHtml += $@"
                    <div class='a4-page page-break'>
                        <div style='text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 10px;'>
                            ПРОДОЛЖЕНИЕ ЗАКАЗА {orderData.Order.OrderNumber}
                        </div>
        
                        <table class='main-table'>
                            {(orderData.WorkItems.Count > 56 ? GenerateAdditionalWorksHtml(orderData, 56) : "")}
                            {(orderData.Payments.Count > 16 ? GenerateAdditionalPaymentsHtml(orderData, 16) : "")}
                        </table>
                    </div>
                ";
            }

            // Страница 4 - максимум
            if (orderData.WorkItems.Count > 86 || orderData.Payments.Count > 24)
            {
                additionalPagesHtml += $@"
                    <div class='a4-page page-break'>
                        <div style='text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 10px;'>
                            ПРОДОЛЖЕНИЕ ЗАКАЗА {orderData.Order.OrderNumber}
                        </div>
        
                        <table class='main-table'>
                            {(orderData.WorkItems.Count > 86 ? GenerateAdditionalWorksHtml(orderData, 86) : "")}
                            {(orderData.Payments.Count > 24 ? GenerateAdditionalPaymentsHtml(orderData, 24) : "")}
                        </table>
                    </div>
                ";
            }

            return additionalPagesHtml;
        }

        // ДОПОЛНИТЕЛЬНЫЕ РАБОТЫ
        private string GenerateAdditionalWorksHtml(OrderPrintData orderData, int startIndex)
        {
            var worksHtml = $@"
            <tr>
                <td colspan='8' class='bold center' style='background-color: #f0f0f0;'>
                    ДОПОЛНИТЕЛЬНЫЕ РАБОТЫ (продолжение):
                </td>
            </tr>
            <tr class='bold center'>
                <td class='cell-number'>№</td>
                <td colspan='3' class='cell-work-desc'>Вид работы:</td>
                <td class='cell-price'>Стоимость:</td>
                <td colspan='3' class='cell-note'>Примечание:</td>
            </tr>";

            for (int i = startIndex; i < orderData.WorkItems.Count && i < startIndex + 30; i++)
            {
                var workItem = orderData.WorkItems[i];
                var itemTotal = workItem.Price * workItem.Quantity;

                worksHtml += $@"
                <tr class='work-row'>
                    <td class='cell-number'>{i + 1}.</td>
                    <td colspan='3' class='cell-work-desc'>{workItem.WorkDescription}</td>
                    <td class='cell-price'>{itemTotal} руб.</td>
                    <td colspan='3' class='cell-note'>{workItem.Note}</td>
                </tr>";
            }

            // Добавляем отступ после работ
            worksHtml += @"
            <tr>
                <td colspan='8' style='border: none; height: 10px;'></td>
            </tr>";

            return worksHtml;
        }

        // ДОПОЛНИТЕЛЬНЫЕ ПЛАТЕЖИ
        private string GenerateAdditionalPaymentsHtml(OrderPrintData orderData, int startIndex)
        {
            var paymentsHtml = $@"
            <tr>
                <td colspan='8' class='bold center' style='background-color: #f0f0f0;'>
                    ДОПОЛНИТЕЛЬНЫЕ ПЛАТЕЖИ (продолжение):
                </td>
            </tr>
            <tr class='bold center'>
                <td class='cell-payment-type'></td>
                <td class='cell-amount'>Сумма:</td>
                <td class='cell-date'>Дата:</td>
                <td class='cell-signature'>Подпись:</td>
                <td class='cell-payment-type'></td>
                <td class='cell-amount'>Сумма:</td>
                <td class='cell-date'>Дата:</td>
                <td class='cell-signature'>Подпись:</td>
            </tr>";

            int paymentCount = 0;
            int currentRow = 0;

            for (int i = startIndex; i < orderData.Payments.Count && paymentCount < 8; i++)
            {
                var payment = orderData.Payments[i];

                if (paymentCount % 2 == 0)
                {
                    // Начало новой строки - левая часть
                    paymentsHtml += $@"
                    <tr class='payment-row'>
                        <td class='cell-payment-type bold'>{payment.PaymentType}</td>
                        <td class='cell-amount'>{payment.Amount} руб.</td>
                        <td class='cell-date'>{payment.PaymentDate:dd.MM.yyyy}</td>
                        <td class='cell-signature'></td>";
                }
                else
                {
                    // Правая часть и закрытие строки
                    paymentsHtml += $@"
                        <td class='cell-payment-type bold'>{payment.PaymentType}</td>
                        <td class='cell-amount'>{payment.Amount} руб.</td>
                        <td class='cell-date'>{payment.PaymentDate:dd.MM.yyyy}</td>
                        <td class='cell-signature'></td>
                    </tr>";
                }

                paymentCount++;
                currentRow++;
            }

            // Если осталась незакрытая строка (нечетное количество платежей)
            if (paymentCount % 2 != 0)
            {
                paymentsHtml += $@"
                    <td class='cell-payment-type bold'>Доплата</td>
                    <td class='cell-amount'></td>
                    <td class='cell-date'></td>
                    <td class='cell-signature'></td>
                </tr>";
            }

            return paymentsHtml;
        }

        private void SetBoldCell(IXLWorksheet worksheet, string cellAddress, string value)
        {
            worksheet.Cell(cellAddress).Value = value;
            worksheet.Cell(cellAddress).Style.Font.Bold = true;
        }
    }
}