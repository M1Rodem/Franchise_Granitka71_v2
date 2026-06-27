// Services/Print/Builders/ExcelDocumentBuilder.cs
using ClosedXML.Excel;
using Franchisee.Web.Models.Print;
using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;

namespace Franchisee.Web.Services.Print.Builders
{
    public class ExcelDocumentBuilder : IPrintDocumentBuilder
    {
        private const int MAX_WORK_ITEMS_PER_PAGE = 26;
        private const int MAX_PAYMENTS_PER_PAGE = 6;
        private const int PAYMENT_ROWS_PER_PAGE = 3;

        private string FormatPrice(decimal price)
        {
            return price == Math.Floor(price)
                ? $"{price:0} руб."
                : $"{price:F2} руб.";
        }

        public string GetContentType => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        public string GetFileExtension => ".xlsx";

        public byte[] BuildExcel(PrintDataModel data)
        {
            using var workbook = new XLWorkbook();

            if (data.Type == PrintType.Worker)
            {
                BuildWorkerExcel(workbook, data);
            }
            else
            {
                BuildDefaultExcel(workbook, data);
            }

            using var memoryStream = new MemoryStream();
            workbook.SaveAs(memoryStream);
            return memoryStream.ToArray();
        }

        private void BuildDefaultExcel(XLWorkbook workbook, PrintDataModel data)
        {
            var distanceItems = data.WorkItems.Where(x => x.DistanceKm.HasValue).ToList();
            var regularItems = data.WorkItems.Where(x => !x.DistanceKm.HasValue).ToList();

            var allWorkItems = new List<WorkItemInfo>();
            allWorkItems.AddRange(distanceItems);
            allWorkItems.AddRange(regularItems);

            var workItemPages = SplitWorkItems(allWorkItems, MAX_WORK_ITEMS_PER_PAGE);
            var paymentPages = SplitPayments(data.Payments, MAX_PAYMENTS_PER_PAGE);

            var totalPages = Math.Max(workItemPages.Count, paymentPages.Count);

            for (int pageNum = 0; pageNum < totalPages; pageNum++)
            {
                var sheetName = pageNum == 0 ? "Заказ" : $"Заказ (стр.{pageNum + 1})";
                var worksheet = workbook.Worksheets.Add(sheetName);

                ConfigurePage(worksheet);

                int row = 1;

                if (pageNum == 0)
                {
                    BuildHeader(worksheet, ref row, data);
                }
                else
                {
                    // Заголовок продолжения
                    worksheet.Range($"A{row}:H{row}").Merge();
                    SetBoldCentered(worksheet, row, $"--- ПРОДОЛЖЕНИЕ ЗАКАЗА {data.Header.OrderNumber} (стр. {pageNum + 1} из {totalPages}) ---");
                    row++; // Было row += 2, меняем на row++
                }

                // Работы
                var currentWorkItems = pageNum < workItemPages.Count
                    ? workItemPages[pageNum]
                    : new List<WorkItemInfo>();

                BuildWorkItemsPage(worksheet, ref row, currentWorkItems, pageNum, distanceItems, regularItems);

                // Итого (только на первой странице)
                if (pageNum == 0)
                {
                    BuildTotals(worksheet, ref row, data);
                }

                // Примечание (только на первой странице)
                if (pageNum == 0 && !string.IsNullOrWhiteSpace(data.AdditionalInfo))
                {
                    BuildAdditionalInfo(worksheet, ref row, data);
                }

                // Информация о памятнике (только на первой странице)
                if (pageNum == 0)
                {
                    BuildMonumentInfo(worksheet, ref row, data);
                }

                // Платежи
                var currentPayments = pageNum < paymentPages.Count
                    ? paymentPages[pageNum]
                    : new List<PaymentInfo>();

                if (data.Type != PrintType.Worker)
                {
                    if (currentPayments.Any() || pageNum == 0)
                    {
                        BuildPaymentsHeader(worksheet, ref row);
                        BuildPaymentsPage(worksheet, ref row, currentPayments);
                    }
                }

                // Подписи только на последней странице
                if (pageNum == totalPages - 1)
                {
                    BuildSignatures(worksheet, ref row);
                }

                // Границы
                var lastRow = row - 1;
                if (lastRow >= 1)
                {
                    worksheet.Range($"A1:H{lastRow}")
                        .Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                    worksheet.Range($"A1:H{lastRow}")
                        .Style.Border.InsideBorder = XLBorderStyleValues.Thin;
                }
            }
        }

        private void BuildWorkerExcel(XLWorkbook workbook, PrintDataModel data)
        {
            const int ROWS_PER_PAGE = 24;

            var workPages = data.WorkItems
                .Select((x, i) => new { x, i })
                .GroupBy(x => x.i / ROWS_PER_PAGE)
                .Select(g => g.Select(v => v.x).ToList())
                .ToList();

            if (!workPages.Any())
                workPages.Add(new List<WorkItemInfo>());

            for (int pageNum = 0; pageNum < workPages.Count; pageNum++)
            {
                var sheetName = pageNum == 0 ? "Рабочий документ" : $"Рабочий документ (стр.{pageNum + 1})";
                var worksheet = workbook.Worksheets.Add(sheetName);

                ConfigurePage(worksheet);

                // Увеличим высоту строк для лучшего отображения
                worksheet.Rows().Height = 18;

                int row = 1;

                // Отступ сверху
                row += 1;

                // Основная информация
                BuildWorkerHeader(worksheet, ref row, data);

                row += 1;

                // Работы
                var works = workPages[pageNum];
                int startIndex = pageNum * ROWS_PER_PAGE;

                for (int i = 0; i < works.Count; i++)
                {
                    var work = works[i];
                    worksheet.Cell($"A{row}").Value = $"{startIndex + i + 1}.";
                    worksheet.Range($"B{row}:E{row}").Merge().Value = work.Description;
                    worksheet.Range($"F{row}:H{row}").Merge().Value = work.Note;
                    row++;
                }

                // Добивка пустыми строками до 24
                for (int i = works.Count; i < ROWS_PER_PAGE; i++)
                {
                    worksheet.Cell($"A{row}").Value = $"{startIndex + i + 1}.";
                    worksheet.Range($"B{row}:E{row}").Merge();
                    worksheet.Range($"F{row}:H{row}").Merge();
                    row++;
                }

                row += 1;

                // Техническая информация (только на последней странице)
                if (pageNum == workPages.Count - 1)
                {
                    BuildWorkerTechnicalInfo(worksheet, ref row, data);
                }

                // Границы
                var lastRow = row - 1;
                if (lastRow >= 1)
                {
                    worksheet.Range($"A1:H{lastRow}")
                        .Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                    worksheet.Range($"A1:H{lastRow}")
                        .Style.Border.InsideBorder = XLBorderStyleValues.Thin;
                }
            }
        }

        private void ConfigurePage(IXLWorksheet ws)
        {
            ws.PageSetup.PaperSize = XLPaperSize.A4Paper;
            ws.PageSetup.Margins.Top = 0.5;
            ws.PageSetup.Margins.Bottom = 0.5;
            ws.PageSetup.Margins.Left = 0.5;
            ws.PageSetup.Margins.Right = 0.5;
            ws.PageSetup.FitToPages(1, 1);

            // Ширина колонок
            ws.Column(1).Width = 5;   // №
            ws.Column(2).Width = 20;  // Работа (левая часть)
            ws.Column(3).Width = 20;  // Работа (правая часть для слияния) или Цена для дистанционных
            ws.Column(4).Width = 8;   // Км или Цена для обычных
            ws.Column(5).Width = 8;   // Рейсы или Кол-во для обычных
            ws.Column(6).Width = 10;  // Кол-во для дистанционных
            ws.Column(7).Width = 12;  // Итого
            ws.Column(8).Width = 15;  // Примечание

            ws.Style.Font.FontSize = 12;
        }

        private void BuildHeader(IXLWorksheet ws, ref int row, PrintDataModel data)
        {
            // Строка 1
            SetBold(ws, $"A{row}", "№ заказа");
            ws.Cell($"B{row}").Value = data.Header.OrderNumber;
            SetBold(ws, $"C{row}", "№ Участка:");
            ws.Range($"D{row}:E{row}").Merge().Value = data.Header.Place;
            SetBold(ws, $"F{row}", "Место смотрел:");
            ws.Range($"G{row}:H{row}").Merge().Value = data.Header.InspectionPlace;
            row++;

            // Строка 2
            SetBold(ws, $"A{row}", "Дата:");
            ws.Cell($"B{row}").Value = data.Header.OrderDate.ToString("dd.MM.yyyy");
            SetBold(ws, $"C{row}", "Заказ принял:");
            ws.Range($"D{row}:E{row}").Merge().Value = data.Manager.FullName;
            SetBold(ws, $"F{row}", "ФИО на участке захоронения:");
            row++;

            // Личные данные
            SetBold(ws, $"A{row}", "E-mail:");
            ws.Range($"B{row}:E{row}").Merge().Value = data.Customer.Email;
            ws.Range($"F{row}:H{row + 3}").Merge().Value = data.Header.DeceasedFullName;
            row++;

            SetBold(ws, $"A{row}", "Заказчик:");
            ws.Range($"B{row}:E{row}").Merge().Value = data.Customer.FullName;
            row++;

            SetBold(ws, $"A{row}", "Адрес:");
            ws.Range($"B{row}:E{row}").Merge().Value = data.Customer.Address;
            row++;

            SetBold(ws, $"A{row}", "Телефон:");
            ws.Range($"B{row}:E{row}").Merge().Value = data.Customer.Phone;
            row++;
        }

        private void BuildWorkItemsPage(IXLWorksheet ws, ref int row, List<WorkItemInfo> workItems, int pageNum,
            List<WorkItemInfo> distanceItems, List<WorkItemInfo> regularItems)
        {
            int startNumber = pageNum * MAX_WORK_ITEMS_PER_PAGE;
            int currentNumber = startNumber + 1;
            int itemsPrinted = 0;

            // Получаем дистанционные и обычные работы для этой страницы
            var distanceForPage = workItems.Where(x => x.DistanceKm.HasValue).ToList();
            var regularForPage = workItems.Where(x => !x.DistanceKm.HasValue).ToList();

            // ===== ТАБЛИЦА 1: ДИСТАНЦИОННЫЕ РАБОТЫ (без изменений) =====
            if (distanceForPage.Any())
            {
                // Заголовок
                ws.Cell($"A{row}").Value = "№";
                SetBold(ws, $"B{row}", "Работа");
                SetBold(ws, $"C{row}", "Цена");
                SetBold(ws, $"D{row}", "Км");
                SetBold(ws, $"E{row}", "Рейсы");
                SetBold(ws, $"F{row}", "Кол-во");
                SetBold(ws, $"G{row}", "Итого");
                SetBold(ws, $"H{row}", "Примечание");
                row++;

                foreach (var item in distanceForPage)
                {
                    ws.Cell($"A{row}").Value = $"{currentNumber}.";
                    ws.Cell($"B{row}").Value = item.Description;
                    ws.Cell($"C{row}").Value = FormatPrice(item.Price);
                    ws.Cell($"D{row}").Value = item.DistanceKm;
                    ws.Cell($"E{row}").Value = item.Routes;
                    var calcQuantity = item.CalculatedQuantity;
                    var displayCalcQuantity = Math.Abs(calcQuantity - Math.Floor(calcQuantity)) < 0.001m
                        ? (int)calcQuantity
                        : calcQuantity;
                    ws.Cell($"F{row}").Value = displayCalcQuantity;
                    ws.Cell($"G{row}").Value = item.ShowPrice ? FormatPrice(item.Total) : "";
                    ws.Cell($"H{row}").Value = item.Note;

                    currentNumber++;
                    row++;
                    itemsPrinted++;
                }
            }

            // ===== ИЗМЕНЕНО: ТАБЛИЦА 2: ОБЫЧНЫЕ РАБОТЫ (добавлен столбец "Итого") =====
            // Заголовок
            ws.Cell($"A{row}").Value = "№";
            ws.Range($"B{row}:C{row}").Merge();
            SetBold(ws, $"B{row}", "Работа");
            SetBold(ws, $"D{row}", "Кол-во");
            SetBold(ws, $"E{row}", "Цена");
            SetBold(ws, $"F{row}", "Итого"); // НОВЫЙ СТОЛБЕЦ
            ws.Range($"G{row}:H{row}").Merge();
            SetBold(ws, $"G{row}", "Примечание");
            row++;

            foreach (var item in regularForPage)
            {
                var quantityValue = item.Quantity;
                var displayQuantity = Math.Abs(quantityValue - Math.Floor(quantityValue)) < 0.001m
                    ? (int)quantityValue
                    : quantityValue;
                
                // Вычисляем итого для строки
                var total = item.Price * item.Quantity;

                ws.Cell($"A{row}").Value = $"{currentNumber}.";
                ws.Range($"B{row}:C{row}").Merge().Value = item.Description;
                ws.Cell($"D{row}").Value = displayQuantity; // Кол-во
                ws.Cell($"E{row}").Value = item.ShowPrice ? FormatPrice(item.Price) : ""; // Цена
                ws.Cell($"F{row}").Value = item.ShowPrice ? FormatPrice(total) : ""; // Итого (НОВЫЙ)
                ws.Range($"G{row}:H{row}").Merge().Value = item.Note; // Примечание (смещено)

                currentNumber++;
                row++;
                itemsPrinted++;
            }

            // Добивка пустыми строками до 26 (только на первой странице)
            if (pageNum == 0)
            {
                for (int i = itemsPrinted; i < MAX_WORK_ITEMS_PER_PAGE; i++)
                {
                    ws.Cell($"A{row}").Value = $"{currentNumber}.";
                    ws.Range($"B{row}:C{row}").Merge();
                    ws.Range($"G{row}:H{row}").Merge();
                    currentNumber++;
                    row++;
                }
            }
        }

        private void BuildTotals(IXLWorksheet ws, ref int row, PrintDataModel data)
        {
            if (data.Type == PrintType.Worker) return;

            var total = data.WorkItems.Sum(w => w.Total);

            ws.Range($"A{row}:D{row}").Merge();
            SetBold(ws, $"A{row}", "ИТОГО:");

            ws.Range($"E{row}:H{row}").Merge();
            if (data.Financials.ShowFinancials)
            {
                ws.Cell($"E{row}").Value = FormatPrice(total);
            }
            row++;
        }

        private void BuildAdditionalInfo(IXLWorksheet ws, ref int row, PrintDataModel data)
        {
            if (!string.IsNullOrWhiteSpace(data.AdditionalInfo))
            {
                ws.Range($"A{row}:A{row + 2}").Merge();
                SetBold(ws, $"A{row}", "Примечание:");
                ws.Range($"B{row}:H{row + 2}").Merge().Value = data.AdditionalInfo ?? "";
                row += 3;
            }
            // Если нет информации, ничего не добавляем
        }

        private void BuildMonumentInfo(IXLWorksheet ws, ref int row, PrintDataModel data)
        {
            if (string.IsNullOrWhiteSpace(data.Header.MonumentType) &&
                string.IsNullOrWhiteSpace(data.Header.MonumentSize))
                return;

            // Убираем лишний row++ в начале

            ws.Range($"A{row}:H{row}").Merge();
            SetBoldCentered(ws, row, "ИНФОРМАЦИЯ О ПАМЯТНИКЕ");
            ws.Cell($"A{row}").Style.Fill.BackgroundColor = XLColor.LightGray;
            row++;

            if (!string.IsNullOrWhiteSpace(data.Header.MonumentType))
            {
                SetBold(ws, $"A{row}", "Тип памятника:");
                ws.Range($"B{row}:H{row}").Merge().Value = data.Header.MonumentType;
                row++;
            }

            if (!string.IsNullOrWhiteSpace(data.Header.MonumentSize))
            {
                SetBold(ws, $"A{row}", "Размер памятника:");
                ws.Range($"B{row}:H{row}").Merge().Value = data.Header.MonumentSize;
                row++;
            }

            // Убираем лишний row++ в конце
        }

        private void BuildPaymentsHeader(IXLWorksheet ws, ref int row)
        {
            ws.Range($"A{row}:H{row}").Merge();
            SetBoldCentered(ws, row, "ПЛАТЕЖИ");
            ws.Cell($"A{row}").Style.Fill.BackgroundColor = XLColor.LightGray;
            row++;

            SetBold(ws, $"A{row}", "Тип платежа:");
            SetBold(ws, $"B{row}", "Сумма:");
            SetBold(ws, $"C{row}", "Дата:");
            SetBold(ws, $"D{row}", "Подпись:");     
            SetBold(ws, $"E{row}", "Тип платежа:");
            SetBold(ws, $"F{row}", "Сумма:");
            SetBold(ws, $"G{row}", "Дата:");
            SetBold(ws, $"H{row}", "Подпись:");      
            row++;
        }

        private void BuildPaymentsPage(IXLWorksheet ws, ref int row, List<PaymentInfo> payments)
        {
            for (int i = 0; i < payments.Count; i += 2)
            {
                var left = payments[i];
                var right = (i + 1) < payments.Count ? payments[i + 1] : null;

                // Левая колонка
                ws.Cell($"A{row}").Value = left.PaymentType;
                if (left.ShowAmount)
                {
                    ws.Cell($"B{row}").Value = FormatPrice(left.Amount);
                    ws.Cell($"C{row}").Value = left.PaymentDate.ToString("dd.MM.yyyy");
                }
                ws.Cell($"D{row}").Value = ""; // Подпись (пусто)

                // Правая колонка
                if (right != null)
                {
                    ws.Cell($"E{row}").Value = right.PaymentType;
                    if (right.ShowAmount)
                    {
                        ws.Cell($"F{row}").Value = FormatPrice(right.Amount);
                        ws.Cell($"G{row}").Value = right.PaymentDate.ToString("dd.MM.yyyy");
                    }
                    ws.Cell($"H{row}").Value = ""; // Подпись (пусто)
                }
                else
                {
                    // Если платежей нечетное количество — правую часть оставляем пустой
                    ws.Cell($"E{row}").Value = "";
                    ws.Cell($"F{row}").Value = "";
                    ws.Cell($"G{row}").Value = "";
                    ws.Cell($"H{row}").Value = "";
                }

                row++;
            }
        }

        private void BuildSignatures(IXLWorksheet ws, ref int row)
        {
            ws.Range($"A{row}:C{row}").Merge();
            SetBold(ws, $"A{row}", "Скидка при следующем заказе % -");

            ws.Range($"E{row}:G{row}").Merge();
            SetBold(ws, $"E{row}", "Заказ выполнен полностью, претензий не имею -");
            row++;
        }

        private void BuildWorkerHeader(IXLWorksheet ws, ref int row, PrintDataModel data)
        {
            // № заказа и Дата
            SetBold(ws, $"A{row}", "№ заказа:");
            ws.Cell($"B{row}").Value = data.Header.OrderNumber;
            SetBold(ws, $"D{row}", "Дата:");
            ws.Range($"E{row}:H{row}").Merge().Value = data.Header.OrderDate.ToString("dd.MM.yyyy");
            row++;

            // Участок
            SetBold(ws, $"A{row}", "Участок:");
            ws.Range($"B{row}:H{row}").Merge().Value = data.Header.Place;
            row++;

            // ФИО умершего
            SetBold(ws, $"A{row}", "ФИО умершего:");
            ws.Range($"B{row}:H{row}").Merge().Value = data.Header.DeceasedFullName;
            row++;

            row++; // Отступ
        }

        private void BuildWorkerTechnicalInfo(IXLWorksheet ws, ref int row, PrintDataModel data)
        {
            row++; // Отступ

            // Заголовок
            ws.Range($"A{row}:H{row}").Merge();
            SetBoldCentered(ws, row, "ТЕХНИЧЕСКАЯ ИНФОРМАЦИЯ");
            ws.Cell($"A{row}").Style.Fill.BackgroundColor = XLColor.LightGray;
            row++;

            // Тип памятника
            SetBold(ws, $"A{row}", "Тип памятника:");
            ws.Range($"B{row}:H{row}").Merge().Value = data.Header.MonumentType ?? "";
            row++;

            // Размер памятника
            SetBold(ws, $"A{row}", "Размер памятника:");
            ws.Range($"B{row}:H{row}").Merge().Value = data.Header.MonumentSize ?? "";
            row++;

            // Расстояние (если есть)
            if (data.WorkItems.Any(w => w.DistanceKm.HasValue))
            {
                var distances = string.Join(", ", data.WorkItems
                    .Where(w => w.DistanceKm.HasValue)
                    .Select(w => $"{w.Description}: {w.DistanceKm} км"));

                SetBold(ws, $"A{row}", "Расстояние (км):");
                ws.Range($"B{row}:H{row}").Merge().Value = distances;
                row++;
            }
        }

        // ====================== Вспомогательные методы ======================

        private void SetBold(IXLWorksheet ws, string address, string value)
        {
            var cell = ws.Cell(address);
            cell.Value = value;
            cell.Style.Font.Bold = true;
        }

        private void SetBoldCentered(IXLWorksheet ws, int row, string value)
        {
            var cell = ws.Cell($"A{row}");
            cell.Value = value;
            cell.Style.Font.Bold = true;
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
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

        public string BuildHtml(PrintDataModel data)
        {
            throw new NotSupportedException("ExcelDocumentBuilder не поддерживает HTML формат");
        }
    }
}