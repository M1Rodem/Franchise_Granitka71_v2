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
        private const int MAX_PAYMENTS_PER_PAGE = 8;

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

            var workItemPages = SplitWorkItems(data.WorkItems, MAX_WORK_ITEMS_PER_PAGE);
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
                    SetBoldCentered(worksheet, row, $"--- ПРОДОЛЖЕНИЕ ЗАКАЗА (стр. {pageNum + 1} из {totalPages}) ---");
                    row += 2;

                    BuildWorkItemsHeader(worksheet, ref row);
                }

                // Работы
                var currentWorkItems = pageNum < workItemPages.Count
                    ? workItemPages[pageNum]
                    : new List<WorkItemInfo>();

                BuildWorkItemsPage(worksheet, ref row, currentWorkItems, pageNum);

                // Только на первой странице
                if (pageNum == 0)
                {
                    BuildTotals(worksheet, ref row, data);
                    BuildAdditionalInfo(worksheet, ref row, data);
                    BuildMonumentInfo(worksheet, ref row, data);
                }

                // Платежи
                var currentPayments = pageNum < paymentPages.Count
                    ? paymentPages[pageNum]
                    : new List<PaymentInfo>();

                if (currentPayments.Any())
                {
                    BuildPaymentsHeader(worksheet, ref row);
                    BuildPaymentsPage(worksheet, ref row, currentPayments);
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

            using var memoryStream = new MemoryStream();
            workbook.SaveAs(memoryStream);
            return memoryStream.ToArray();
        }

        private void ConfigurePage(IXLWorksheet ws)
        {
            ws.PageSetup.PaperSize = XLPaperSize.A4Paper;

            // Исправление: нет метода Set(), задаём каждое поле отдельно
            ws.PageSetup.Margins.Top = 0.5;
            ws.PageSetup.Margins.Bottom = 0.5;
            ws.PageSetup.Margins.Left = 0.5;
            ws.PageSetup.Margins.Right = 0.5;

            ws.PageSetup.FitToPages(1, 1);

            // Ширина колонок
            ws.Column(1).Width = 8;
            ws.Column(2).Width = 18;
            ws.Column(3).Width = 12;
            ws.Column(4).Width = 12;
            ws.Column(5).Width = 15;
            ws.Column(6).Width = 22;
            ws.Column(7).Width = 12;
            ws.Column(8).Width = 12;

            ws.Style.Font.FontSize = 11;
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
            ws.Range($"F{row}:H{row}").Merge();
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

            BuildWorkItemsHeader(ws, ref row);
        }

        private void BuildWorkItemsHeader(IXLWorksheet ws, ref int row)
        {
            ws.Cell($"A{row}").Value = "№";
            ws.Range($"B{row}:D{row}").Merge();
            SetBold(ws, $"B{row}", "Вид работы:");
            SetBold(ws, $"E{row}", "Стоимость:");
            ws.Range($"F{row}:H{row}").Merge();
            SetBold(ws, $"F{row}", "Примечание:");
            row++;
        }

        private void BuildPaymentsHeader(IXLWorksheet ws, ref int row)
        {
            SetBold(ws, $"B{row}", "Сумма:");
            SetBold(ws, $"C{row}", "Дата:");
            SetBold(ws, $"D{row}", "Подпись:");
            SetBold(ws, $"F{row}", "Сумма:");
            SetBold(ws, $"G{row}", "Дата:");
            SetBold(ws, $"H{row}", "Подпись:");
            row++;
        }

        private void BuildWorkItemsPage(IXLWorksheet ws, ref int row, List<WorkItemInfo> workItems, int pageNum)
        {
            int startNumber = pageNum * MAX_WORK_ITEMS_PER_PAGE;

            for (int i = 0; i < workItems.Count; i++)
            {
                var item = workItems[i];
                int itemNumber = startNumber + i + 1;

                ws.Cell($"A{row}").Value = $"{itemNumber}.";
                ws.Range($"B{row}:D{row}").Merge().Value = item.Description;

                if (item.ShowPrice)
                    ws.Cell($"E{row}").Value = FormatPrice(item.Total);

                ws.Range($"F{row}:H{row}").Merge().Value = item.Note;
                row++;
            }

            if (pageNum == 0)
            {
                for (int i = workItems.Count; i < MAX_WORK_ITEMS_PER_PAGE; i++)
                {
                    ws.Cell($"A{row}").Value = $"{i + 1}.";
                    ws.Range($"B{row}:D{row}").Merge();
                    ws.Range($"F{row}:H{row}").Merge();
                    row++;
                }
            }
        }

        private void BuildTotals(IXLWorksheet ws, ref int row, PrintDataModel data)
        {
            ws.Range($"A{row}:D{row}").Merge();
            SetBold(ws, $"A{row}", "ИТОГО:");

            ws.Range($"E{row}:H{row}").Merge();
            if (data.Financials.ShowFinancials)
            {
                var total = data.WorkItems.Sum(w => w.Total);
                ws.Cell($"E{row}").Value = FormatPrice(total);
            }
            row++;
        }

        private void BuildAdditionalInfo(IXLWorksheet ws, ref int row, PrintDataModel data)
        {
            ws.Range($"A{row}:A{row + 2}").Merge();
            SetBold(ws, $"A{row}", "Примечание:");

            ws.Range($"B{row}:H{row + 2}").Merge().Value = data.AdditionalInfo ?? "";
            row += 3;
        }

        private void BuildMonumentInfo(IXLWorksheet ws, ref int row, PrintDataModel data)
        {
            if (string.IsNullOrWhiteSpace(data.Header.MonumentType) &&
                string.IsNullOrWhiteSpace(data.Header.MonumentSize))
                return;

            ws.Range($"A{row}:H{row}").Merge();
            SetBold(ws, $"A{row}", "ИНФОРМАЦИЯ О ПАМЯТНИКЕ");
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
            row++;
        }

        private void BuildPaymentsPage(IXLWorksheet ws, ref int row, List<PaymentInfo> payments)
        {
            for (int i = 0; i < payments.Count; i += 2)
            {
                var left = payments[i];
                var right = i + 1 < payments.Count ? payments[i + 1] : null;

                SetBold(ws, $"A{row}", left.PaymentType);

                if (left.ShowAmount)
                {
                    ws.Cell($"B{row}").Value = FormatPrice(left.Amount);
                    ws.Cell($"C{row}").Value = left.PaymentDate.ToString("dd.MM.yyyy");
                }

                if (right != null)
                {
                    SetBold(ws, $"E{row}", right.PaymentType);
                    if (right.ShowAmount)
                    {
                        ws.Cell($"F{row}").Value = FormatPrice(right.Amount);
                        ws.Cell($"G{row}").Value = right.PaymentDate.ToString("dd.MM.yyyy");
                    }
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