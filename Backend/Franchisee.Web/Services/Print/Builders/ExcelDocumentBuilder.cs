using ClosedXML.Excel;
using Franchisee.Web.Models.Print;
using System;
using System.IO;
using System.Linq;

namespace Franchisee.Web.Services.Print.Builders
{
    public class ExcelDocumentBuilder : IPrintDocumentBuilder
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
        public string GetContentType => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        public string GetFileExtension => ".xlsx";

        public byte[] BuildExcel(PrintDataModel data)
        {
            using var workbook = new XLWorkbook();
            var worksheet = workbook.Worksheets.Add("Заказ");

            // Настройка страницы
            ConfigurePage(worksheet);
            
            // ВСЕГДА используем BuildDefaultSheet (структура 1 в 1)
            BuildDefaultSheet(worksheet, data);

            using var memoryStream = new MemoryStream();
            workbook.SaveAs(memoryStream);
            return memoryStream.ToArray();
        }

        public string BuildHtml(PrintDataModel data)
        {
            // Для Excel билдера HTML не нужен
            throw new NotSupportedException("ExcelDocumentBuilder не поддерживает HTML формат");
        }

        private void ConfigurePage(IXLWorksheet worksheet)
        {
            worksheet.PageSetup.PaperSize = XLPaperSize.A4Paper;
            worksheet.PageSetup.Margins.Top = 0.5;
            worksheet.PageSetup.Margins.Bottom = 0.5;
            worksheet.PageSetup.Margins.Left = 0.5;
            worksheet.PageSetup.Margins.Right = 0.5;
            worksheet.PageSetup.FitToPages(1, 1);

            // Ширина колонок
            worksheet.Column(1).Width = 12;  // A
            worksheet.Column(2).Width = 15;  // B
            worksheet.Column(3).Width = 15;  // C
            worksheet.Column(4).Width = 15;  // D
            worksheet.Column(5).Width = 12;  // E
            worksheet.Column(6).Width = 19;  // F
            worksheet.Column(7).Width = 15;  // G
            worksheet.Column(8).Width = 15;  // H

            // Высота строк
            for (int row = 1; row <= 43; row++)
                worksheet.Row(row).Height = 18;

            worksheet.Style.Font.FontSize = 11;
        }

        private void BuildDefaultSheet(IXLWorksheet worksheet, PrintDataModel data)
        {
            int currentRow = 1;
            
            // Заголовок (всегда рисуем)
            BuildHeader(worksheet, ref currentRow, data);
            
            // Работы (всегда рисуем 26 строк)
            BuildWorkItems(worksheet, ref currentRow, data);
            
            // Итого (для Worker - пустое место)
            BuildTotals(worksheet, ref currentRow, data);
            
            // Примечание
            BuildAdditionalInfo(worksheet, ref currentRow, data);
            
            // Платежи (для Worker - пустые строки)
            BuildPayments(worksheet, ref currentRow, data);
            
            // Подписи
            BuildSignatures(worksheet, ref currentRow);
            
            // Границы
            worksheet.Range("A1:H43").Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            worksheet.Range("A1:H43").Style.Border.InsideBorder = XLBorderStyleValues.Thin;
        }
        private void BuildWorkerSheet(IXLWorksheet worksheet, PrintDataModel data)
        {
            int currentRow = 1;
            
            // Заголовок (без личных данных)
            BuildWorkerHeader(worksheet, ref currentRow, data);
            
            // Работы (без цен)
            BuildWorkerWorkItems(worksheet, ref currentRow, data);
            
            // Техническая информация
            BuildTechnicalInfo(worksheet, ref currentRow, data);
            
            // Границы
            var lastRow = currentRow - 1;
            worksheet.Range($"A1:H{lastRow}").Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            worksheet.Range($"A1:H{lastRow}").Style.Border.InsideBorder = XLBorderStyleValues.Thin;
        }

        private void BuildHeader(IXLWorksheet worksheet, ref int row, PrintDataModel data)
        {
            // Строка 1
            SetBoldCell(worksheet, $"A{row}", "№ заказа");
            worksheet.Cell($"B{row}").Value = data.Header.OrderNumber;
            SetBoldCell(worksheet, $"C{row}", "№ Участка:");
            worksheet.Range($"D{row}:E{row}").Merge();
            worksheet.Cell($"D{row}").Value = data.Header.Place;
            SetBoldCell(worksheet, $"F{row}", "Место смотрел:");
            worksheet.Range($"G{row}:H{row}").Merge();
            worksheet.Cell($"G{row}").Value = data.Header.InspectionPlace;
            row++;

            // Строка 2
            SetBoldCell(worksheet, $"A{row}", "Дата:");
            worksheet.Cell($"B{row}").Value = data.Header.OrderDate.ToString("dd.MM.yyyy");
            SetBoldCell(worksheet, $"C{row}", "Заказ принял:");
            worksheet.Range($"D{row}:E{row}").Merge();
            worksheet.Cell($"D{row}").Value = data.Manager.FullName;
            worksheet.Range($"F{row}:H{row}").Merge();
            SetBoldCell(worksheet, $"F{row}", "ФИО на участке захоронения:");
            row++;

            // Строка 3 - EMAIL (если личные данные скрыты - пусто)
            SetBoldCell(worksheet, $"A{row}", "E-mail:");
            worksheet.Range($"B{row}:E{row}").Merge();
            worksheet.Cell($"B{row}").Value = data.Customer.IncludePersonalInfo ? data.Customer.Email : "";
            worksheet.Range($"F{row}:H{row + 3}").Merge();
            worksheet.Cell($"F{row}").Value = data.Header.DeceasedFullName;
            row++;

            // Строка 4 - Заказчик (если личные данные скрыты - пусто)
            SetBoldCell(worksheet, $"A{row}", "Заказчик:");
            worksheet.Range($"B{row}:E{row}").Merge();
            worksheet.Cell($"B{row}").Value = data.Customer.IncludePersonalInfo ? data.Customer.FullName : "";
            row++;

            // Строка 5 - Адрес (если личные данные скрыты - пусто)
            SetBoldCell(worksheet, $"A{row}", "Адрес:");
            worksheet.Range($"B{row}:E{row}").Merge();
            worksheet.Cell($"B{row}").Value = data.Customer.IncludePersonalInfo ? data.Customer.Address : "";
            row++;

            // Строка 6 - Телефон (если личные данные скрыты - пусто)
            SetBoldCell(worksheet, $"A{row}", "Телефон:");
            worksheet.Range($"B{row}:E{row}").Merge();
            worksheet.Cell($"B{row}").Value = data.Customer.IncludePersonalInfo ? data.Customer.Phone : "";
            row++;

            // Заголовок работ
            worksheet.Cell($"A{row}").Value = "№";
            worksheet.Range($"B{row}:D{row}").Merge();
            SetBoldCell(worksheet, $"B{row}", "Вид работы:");
            SetBoldCell(worksheet, $"E{row}", "Стоимость:");
            worksheet.Range($"F{row}:H{row}").Merge();
            SetBoldCell(worksheet, $"F{row}", "Примечание:");
            row++;
        }

        private void BuildWorkerHeader(IXLWorksheet worksheet, ref int row, PrintDataModel data)
        {
            // Строка 1 - Рабочий документ
            worksheet.Range($"A{row}:H{row}").Merge();
            SetBoldCell(worksheet, $"A{row}", "РАБОЧИЙ ДОКУМЕНТ (без цен)");
            worksheet.Cell($"A{row}").Style.Font.FontSize = 14;
            worksheet.Cell($"A{row}").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            row += 2;

            // Строка 2 - Номер заказа
            SetBoldCell(worksheet, $"A{row}", "№ заказа:");
            worksheet.Range($"B{row}:C{row}").Merge();
            worksheet.Cell($"B{row}").Value = data.Header.OrderNumber;
            SetBoldCell(worksheet, $"D{row}", "Дата:");
            worksheet.Range($"E{row}:F{row}").Merge();
            worksheet.Cell($"E{row}").Value = data.Header.OrderDate.ToString("dd.MM.yyyy");
            row++;

            // Строка 3 - Участок
            SetBoldCell(worksheet, $"A{row}", "Участок:");
            worksheet.Range($"B{row}:F{row}").Merge();
            worksheet.Cell($"B{row}").Value = data.Header.Place;
            row++;

            // Строка 4 - ФИО умершего
            SetBoldCell(worksheet, $"A{row}", "ФИО умершего:");
            worksheet.Range($"B{row}:H{row}").Merge();
            worksheet.Cell($"B{row}").Value = data.Header.DeceasedFullName;
            row += 2;

            // Заголовок работ
            worksheet.Cell($"A{row}").Value = "№";
            worksheet.Range($"B{row}:E{row}").Merge();
            SetBoldCell(worksheet, $"B{row}", "Вид работы:");
            worksheet.Range($"F{row}:H{row}").Merge();
            SetBoldCell(worksheet, $"F{row}", "Примечание:");
            row++;
        }

        private void BuildWorkItems(IXLWorksheet worksheet, ref int row, PrintDataModel data)
        {
            for (int i = 0; i < 26; i++)
            {
                var workItem = i < data.WorkItems.Count ? data.WorkItems[i] : null;
                
                worksheet.Cell($"A{row}").Value = $"{i + 1}.";
                
                if (workItem != null)
                {
                    worksheet.Range($"B{row}:D{row}").Merge();
                    worksheet.Cell($"B{row}").Value = workItem.Description;
                    
                    // ИСПРАВЛЕНО: форматируем цену
                    if (workItem.ShowPrice)
                    {
                        var formattedPrice = FormatPrice(workItem.Total);
                        worksheet.Cell($"E{row}").Value = formattedPrice;
                    }
                    else
                    {
                        worksheet.Cell($"E{row}").Value = "";
                    }
                    
                    worksheet.Range($"F{row}:H{row}").Merge();
                    worksheet.Cell($"F{row}").Value = workItem.Note;
                }
                else
                {
                    worksheet.Range($"B{row}:D{row}").Merge();
                    worksheet.Range($"F{row}:H{row}").Merge();
                }
                
                row++;
            }
        }

        private void BuildWorkerWorkItems(IXLWorksheet worksheet, ref int row, PrintDataModel data)
        {
            for (int i = 0; i < data.WorkItems.Count; i++)
            {
                var workItem = data.WorkItems[i];
                
                worksheet.Cell($"A{row}").Value = $"{i + 1}.";
                worksheet.Range($"B{row}:E{row}").Merge();
                worksheet.Cell($"B{row}").Value = workItem.Description;
                worksheet.Range($"F{row}:H{row}").Merge();
                worksheet.Cell($"F{row}").Value = workItem.Note;
                
                row++;
            }
        }

        private void BuildTotals(IXLWorksheet worksheet, ref int row, PrintDataModel data)
        {
            worksheet.Range($"A{row}:D{row}").Merge();
            SetBoldCell(worksheet, $"A{row}", "ИТОГО:");
            worksheet.Range($"E{row}:H{row}").Merge();
            
            if (data.Financials.ShowFinancials)
            {
                var totalWorkPrice = data.WorkItems.Sum(w => w.Total);
                // ИСПРАВЛЕНО: форматируем цену
                worksheet.Cell($"E{row}").Value = FormatPrice(totalWorkPrice);
            }
            else
            {
                worksheet.Cell($"E{row}").Value = "";
            }
            row++;
        }

        private void BuildAdditionalInfo(IXLWorksheet worksheet, ref int row, PrintDataModel data)
        {
            worksheet.Range($"A{row}:A{row + 2}").Merge();
            SetBoldCell(worksheet, $"A{row}", "Примечание:");
            worksheet.Range($"B{row}:H{row + 2}").Merge();
            worksheet.Cell($"B{row}").Value = data.AdditionalInfo;
            row += 3;
        }

        private void BuildTechnicalInfo(IXLWorksheet worksheet, ref int row, PrintDataModel data)
        {
            worksheet.Range($"A{row}:H{row}").Merge();
            SetBoldCell(worksheet, $"A{row}", "ТЕХНИЧЕСКАЯ ИНФОРМАЦИЯ");
            worksheet.Cell($"A{row}").Style.Fill.BackgroundColor = XLColor.LightGray;
            row++;

            SetBoldCell(worksheet, $"A{row}", "Тип памятника:");
            worksheet.Range($"B{row}:H{row}").Merge();
            worksheet.Cell($"B{row}").Value = data.Header.MonumentType;
            row++;

            SetBoldCell(worksheet, $"A{row}", "Размер памятника:");
            worksheet.Range($"B{row}:H{row}").Merge();
            worksheet.Cell($"B{row}").Value = data.Header.MonumentSize;
            row++;

            if (data.WorkItems.Any(w => w.DistanceKm.HasValue))
            {
                SetBoldCell(worksheet, $"A{row}", "Расстояние (км):");
                worksheet.Range($"B{row}:H{row}").Merge();
                var distances = string.Join(", ", data.WorkItems.Where(w => w.DistanceKm.HasValue).Select(w => $"{w.Description}: {w.DistanceKm} км"));
                worksheet.Cell($"B{row}").Value = distances;
                row++;
            }
        }

        private void BuildPayments(IXLWorksheet worksheet, ref int row, PrintDataModel data)
        {
            SetBoldCell(worksheet, $"B{row}", "Сумма:");
            SetBoldCell(worksheet, $"C{row}", "Дата:");
            SetBoldCell(worksheet, $"D{row}", "Подпись:");
            SetBoldCell(worksheet, $"F{row}", "Сумма:");
            SetBoldCell(worksheet, $"G{row}", "Дата:");
            SetBoldCell(worksheet, $"H{row}", "Подпись:");
            row++;

            for (int i = 0; i < 4; i++)
            {
                var paymentLeft = i < data.Payments.Count ? data.Payments[i] : null;
                var paymentRight = (i + 4) < data.Payments.Count ? data.Payments[i + 4] : null;

                // Левая часть
                SetBoldCell(worksheet, $"A{row}", paymentLeft?.PaymentType ?? (i == 0 ? "Аванс" : "Доплата"));

                if (paymentLeft != null && paymentLeft.ShowAmount)
                {
                    // ИСПРАВЛЕНО: форматируем сумму платежа
                    worksheet.Cell($"B{row}").Value = FormatPrice(paymentLeft.Amount);
                    worksheet.Cell($"C{row}").Value = paymentLeft.PaymentDate.ToString("dd.MM.yyyy");
                }
                else
                {
                    worksheet.Cell($"B{row}").Value = "";
                    worksheet.Cell($"C{row}").Value = "";
                }

                // Правая часть
                SetBoldCell(worksheet, $"E{row}", paymentRight?.PaymentType ?? "Доплата");

                if (paymentRight != null && paymentRight.ShowAmount)
                {
                    // ИСПРАВЛЕНО: форматируем сумму платежа
                    worksheet.Cell($"F{row}").Value = FormatPrice(paymentRight.Amount);
                    worksheet.Cell($"G{row}").Value = paymentRight.PaymentDate.ToString("dd.MM.yyyy");
                }
                else
                {
                    worksheet.Cell($"F{row}").Value = "";
                    worksheet.Cell($"G{row}").Value = "";
                }
                
                row++;
            }
        }

        private void BuildSignatures(IXLWorksheet worksheet, ref int row, PrintDataModel data = null)
        {
            worksheet.Range($"A{row}:C{row}").Merge();
            SetBoldCell(worksheet, $"A{row}", "Скидка при следующем заказе % -");
            worksheet.Range($"E{row}:G{row}").Merge();
            SetBoldCell(worksheet, $"E{row}", "Заказ выполнен полностью, претензий не имею -");
        }

        private void SetBoldCell(IXLWorksheet worksheet, string cellAddress, string value)
        {
            worksheet.Cell(cellAddress).Value = value;
            worksheet.Cell(cellAddress).Style.Font.Bold = true;
        }
    }
}