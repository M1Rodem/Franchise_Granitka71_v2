using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Franchisee.Web.Models;
using Franchisee.Web.Services.Repositories;

namespace Franchisee.Web.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PlotsController : ControllerBase
    {
        private readonly IPlotRepository _plotRepository;
        private readonly ILogger<PlotsController> _logger;

        public PlotsController(IPlotRepository plotRepository, ILogger<PlotsController> logger)
        {
            _plotRepository = plotRepository;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<PlotDto>>> GetPlots([FromQuery] bool includeInactive = false)
        {
            try
            {
                var plots = await _plotRepository.GetAllAsync(includeInactive);

                var dtos = plots.Select(p => new PlotDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    Description = p.Description,
                    Latitude = p.Latitude,
                    Longitude = p.Longitude,
                    IsActive = p.IsActive,
                    CreatedAt = p.CreatedAt,
                    UpdatedAt = p.UpdatedAt
                }).ToList();

                return Ok(dtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения списка участков");
                return StatusCode(500, "Ошибка получения списка участков");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<PlotDto>> GetPlot(int id)
        {
            try
            {
                var plot = await _plotRepository.GetByIdAsync(id);
                if (plot == null)
                    return NotFound($"Участок с ID {id} не найден");

                var dto = new PlotDto
                {
                    Id = plot.Id,
                    Name = plot.Name,
                    Description = plot.Description,
                    Latitude = plot.Latitude,
                    Longitude = plot.Longitude,
                    IsActive = plot.IsActive,
                    CreatedAt = plot.CreatedAt,
                    UpdatedAt = plot.UpdatedAt
                };

                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения участка {Id}", id);
                return StatusCode(500, "Ошибка получения участка");
            }
        }

        [HttpPost]
        [Authorize(Roles = "Admin,SuperAdmin")]
        public async Task<ActionResult<PlotDto>> CreatePlot([FromBody] CreatePlotRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var plot = new Plot
                {
                    Name = request.Name,
                    Description = request.Description,
                    Latitude = request.Latitude,
                    Longitude = request.Longitude,
                    IsActive = request.IsActive
                };

                await _plotRepository.AddAsync(plot);

                var dto = new PlotDto
                {
                    Id = plot.Id,
                    Name = plot.Name,
                    Description = plot.Description,
                    Latitude = plot.Latitude,
                    Longitude = plot.Longitude,
                    IsActive = plot.IsActive,
                    CreatedAt = plot.CreatedAt,
                    UpdatedAt = plot.UpdatedAt
                };

                return CreatedAtAction(nameof(GetPlot), new { id = plot.Id }, dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка создания участка");
                return StatusCode(500, "Ошибка создания участка");
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,SuperAdmin")]
        public async Task<ActionResult> UpdatePlot(int id, [FromBody] UpdatePlotRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var plot = await _plotRepository.GetByIdAsync(id);
                if (plot == null)
                    return NotFound($"Участок с ID {id} не найден");

                // Обновляем только указанные поля
                if (!string.IsNullOrEmpty(request.Name))
                    plot.Name = request.Name;

                if (request.Description != null)
                    plot.Description = request.Description;

                if (request.Latitude.HasValue)
                    plot.Latitude = request.Latitude.Value;

                if (request.Longitude.HasValue)
                    plot.Longitude = request.Longitude.Value;

                if (request.IsActive.HasValue)
                    plot.IsActive = request.IsActive.Value;

                await _plotRepository.UpdateAsync(plot);

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка обновления участка {Id}", id);
                return StatusCode(500, "Ошибка обновления участка");
            }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,SuperAdmin")]
        public async Task<ActionResult> DeletePlot(int id)
        {
            try
            {
                var plot = await _plotRepository.GetByIdAsync(id);
                if (plot == null)
                    return NotFound($"Участок с ID {id} не найден");

                // Проверяем, есть ли заказы, связанные с этим участком
                var hasOrders = plot.Orders?.Any() == true;
                if (hasOrders)
                {
                    return BadRequest("Нельзя удалить участок, к которому привязаны заказы");
                }

                await _plotRepository.DeleteAsync(id);

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка удаления участка {Id}", id);
                return StatusCode(500, "Ошибка удаления участка");
            }
        }

        private bool IsAdminOrHigher() => User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
    }
}