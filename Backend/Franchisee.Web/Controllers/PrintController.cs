using Franchisee.Web.Models.Print;
using Franchisee.Web.Services.Print.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
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
    public async Task<IActionResult> DownloadOrder(int orderId, [FromQuery] PrintType type = PrintType.Default)
    {
        try
        {
            var result = await _printService.GenerateOrderDocumentAsync(orderId, type);
            return File(result.FileContent, result.ContentType, result.FileName);
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