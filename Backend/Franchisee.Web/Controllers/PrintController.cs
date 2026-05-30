using Franchisee.Web.Models.Print;
using Franchisee.Web.Services.Print.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PrintController : ControllerBase
{
    private readonly IPrintService _printService;

    public PrintController(IPrintService printService)
    {
        _printService = printService;
    }

    [HttpGet("order/{orderId}/download")]
    public async Task<IActionResult> DownloadOrder(
        int orderId, 
        [FromQuery] PrintType type = PrintType.Default,
        [FromQuery] string? photoIds = null)  // ← НОВЫЙ параметр
    {
        try
        {
            // Если фото НЕ выбраны - используем старую логику (Excel)
            if (string.IsNullOrEmpty(photoIds))
            {
                var result = await _printService.GenerateOrderDocumentAsync(orderId, type);
                return File(result.FileContent, result.ContentType, result.FileName);
            }
            
            // Если фото выбраны - используем новую логику (HTML с фото)
            var ids = photoIds.Split(',').Select(int.Parse).ToList();
            var html = await _printService.GenerateOrderHtmlWithPhotosAsync(orderId, ids, type);
            
            // Конвертируем HTML в байты для скачивания
            var bytes = Encoding.UTF8.GetBytes(html);
            var fileName = type == PrintType.Worker
                ? $"Рабочий_документ_с_фото_{orderId}_{DateTime.Now:yyyyMMdd}.html"
                : $"Заказ_с_фото_{orderId}_{DateTime.Now:yyyyMMdd}.html";
            
            return File(bytes, "text/html; charset=utf-8", fileName);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("order/{orderId}/html-print")]
    public async Task<IActionResult> PrintOrderHtml(int orderId, [FromQuery] PrintType type = PrintType.Default)
    {
        try
        {
            var htmlContent = await _printService.GenerateOrderHtmlAsync(orderId, type);
            return Content(htmlContent, "text/html; charset=utf-8");
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}