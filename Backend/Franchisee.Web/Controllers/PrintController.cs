using Franchisee.Web.Services.Repositories;
using Franchisee.Web.Services;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class PrintController : ControllerBase
{
    private readonly IPrintService _printService;

    public PrintController(IPrintService printService)
    {
        _printService = printService;
    }

    [HttpGet("order/{orderId}/download")]
    public async Task<IActionResult> DownloadOrder(int orderId)
    {
        try
        {
            var result = await _printService.GenerateOrderDocumentAsync(orderId);
            return File(result.FileContent, result.ContentType, result.FileName);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("order/{orderId}/html-print")]
    public async Task<IActionResult> PrintOrderHtml(int orderId)
    {
        try
        {
            var htmlContent = await _printService.GenerateOrderHtmlAsync(orderId);
            return Content(htmlContent, "text/html; charset=utf-8");
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}