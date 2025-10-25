using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;  // 🔥 Для транзакций
using WebApplication1.Configuration;  // ApplicationDbContext
using WebApplication1.Models;
using WebApplication1.Services;
using WebApplication1.Services.Repositories;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class OrdersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;  // 🔥 Восстановили для транзакций/Restore
        private readonly IOrderRepository _orderRepository;
        private readonly IPhotoService _photoService;
        private readonly ILogger<OrdersController> _logger;

        public OrdersController(
            ApplicationDbContext context,  // 🔥 Добавили обратно
            IOrderRepository orderRepository,
            IPhotoService photoService,
            ILogger<OrdersController> logger)
        {
            _context = context;
            _orderRepository = orderRepository;
            _photoService = photoService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<PagedResult<OrderResponseDto>>> GetOrders([FromQuery] OrderFilterRequest filter)
        {
            var userId = GetCurrentUserId();
            _logger.LogInformation("Получение заказов для пользователя {UserId}, фильтр: {@Filter}", userId, filter);

            var (orders, total) = await _orderRepository.GetFilteredOrdersAsync(filter, IsAdmin() ? null : userId);

            var responseDtos = orders.Select(MapToResponseDto).ToList();

            var paged = new PagedResult<OrderResponseDto>
            {
                Items = responseDtos,
                TotalCount = total,
                Page = filter.Page,
                PageSize = filter.PageSize
            };

            return Ok(paged);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<OrderResponseDto>> GetOrder(int id)
        {
            var userId = GetCurrentUserId();
            _logger.LogInformation("Получение заказа {OrderId} для пользователя {UserId}", id, userId);

            var order = await _orderRepository.GetByIdAsync(id);
            if (order == null) return NotFound($"Заказ с ID {id} не найден");

            if (!IsAdmin() && order.ManagerId != userId)
                return Forbid("Доступ запрещен к чужому заказу");

            var dto = MapToResponseDto(order);
            return Ok(dto);
        }

        [HttpPost]
        public async Task<ActionResult<OrderResponseDto>> CreateOrder([FromBody] CreateOrderRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            _logger.LogInformation("Создание заказа для пользователя {UserId}", userId);

            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // 🔥 ОТЛАДКА: Добавим логирование
                _logger.LogInformation("Генерация номера заказа...");
                var orderNumber = await _orderRepository.GenerateOrderNumberAsync();
                _logger.LogInformation("Сгенерирован номер заказа: {OrderNumber}", orderNumber);

                var order = new Order
                {
                    OrderNumber = orderNumber,
                    Place = request.Place,
                    DeceasedFullName = request.DeceasedFullName,
                    CustomerFullName = request.CustomerFullName,
                    CustomerEmail = request.CustomerEmail,
                    Phone = request.Phone,
                    Address = request.Address,
                    MonumentType = request.MonumentType,
                    MonumentSize = request.MonumentSize,
                    AdditionalInfo = request.AdditionalInfo ?? string.Empty,
                    Status = OrderStatus.Новый,
                    ManagerId = userId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    WorkItems = request.WorkItems ?? new List<OrderWorkItem>(),
                    Payments = request.Payments ?? new List<OrderPayment>()
                };

                // Set FK
                foreach (var wi in order.WorkItems) wi.OrderId = 0;
                foreach (var p in order.Payments) p.OrderId = 0;

                _logger.LogInformation("Сохранение заказа в БД...");
                await _orderRepository.AddAsync(order);

                // 🔥 Рассчитываем TotalPrice
                order.TotalPrice = request.TotalPrice > 0 ? request.TotalPrice : order.WorkItems.Sum(w => w.Price * w.Quantity);
                await _orderRepository.UpdateAsync(order);

                _logger.LogInformation("Заказ сохранен с ID: {OrderId}, номером: {OrderNumber}", order.Id, order.OrderNumber);

                // Фото
                if (request.TempUploadIds?.Any() == true)
                {
                    var committedCount = await _photoService.CommitTempToOrderAsync(order.Id, request.TempUploadIds, userId);
                    _logger.LogInformation("Коммитнуто {Count} фото для заказа {OrderId}", committedCount, order.Id);
                }

                await transaction.CommitAsync();

                var dto = MapToResponseDto(order);
                _logger.LogInformation("Заказ успешно создан: {OrderId}, {OrderNumber}", order.Id, order.OrderNumber);

                return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, dto);
            }
            catch (DbUpdateException ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Ошибка БД при создании заказа для {UserId}", userId);
                return StatusCode(500, "Ошибка сохранения заказа");
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Неожиданная ошибка создания заказа для {UserId}", userId);
                return StatusCode(500, "Внутренняя ошибка");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<OrderResponseDto>> UpdateOrder(int id, [FromBody] UpdateOrderRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            _logger.LogInformation("Обновление заказа {OrderId} для {UserId}", id, userId);

            var order = await _orderRepository.GetByIdAsync(id);
            if (order == null) return NotFound();

            if (!IsAdmin() && order.ManagerId != userId) return Forbid();

            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // Partial update
                if (!string.IsNullOrEmpty(request.Place)) order.Place = request.Place;
                if (!string.IsNullOrEmpty(request.DeceasedFullName)) order.DeceasedFullName = request.DeceasedFullName;
                // ... аналогично для Address, Phone, MonumentSize, AdditionalInfo (?? string.Empty)
                order.AdditionalInfo = request.AdditionalInfo ?? order.AdditionalInfo;  // 🔥 Фикс
                if (request.Status.HasValue) order.Status = request.Status.Value;  // 🔥 Фикс: теперь в DTO
                order.UpdatedAt = DateTime.UtcNow;

                // WorkItems: full replace если provided (как в оригинале)
                if (request.WorkItems != null && request.WorkItems.Any())
                {
                    _context.RemoveRange(order.WorkItems);  // 🔥 _context для RemoveRange
                    order.WorkItems.Clear();
                    foreach (var wi in request.WorkItems)
                    {
                        wi.OrderId = id;
                        order.WorkItems.Add(wi);
                    }
                }

                // Аналогично для Payments (если нужно)

                await _orderRepository.UpdateAsync(order);

                // Новые фото
                if (request.TempUploadIds?.Any() == true)
                {
                    await _photoService.CommitTempToOrderAsync(id, request.TempUploadIds, userId);
                }

                await transaction.CommitAsync();

                var dto = MapToResponseDto(order);
                return Ok(dto);
            }
            catch (DbUpdateConcurrencyException ex) when (!OrderExists(id))
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Concurrency ошибка обновления {OrderId}", id);  // 🔥 Используем ex
                return NotFound();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Ошибка обновления заказа {OrderId}", id);  // 🔥 Используем ex
                return StatusCode(500, "Ошибка обновления");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteOrder(int id)
        {
            var userId = GetCurrentUserId();
            _logger.LogInformation("Удаление заказа {OrderId} для {UserId}", id, userId);

            var order = await _orderRepository.GetByIdAsync(id);
            if (order == null) return NotFound();

            if (!IsAdmin() && order.ManagerId != userId) return Forbid();

            await _orderRepository.SoftDeleteAsync(id);
            return NoContent();
        }

        [HttpPost("{id}/restore")]
        public async Task<IActionResult> RestoreOrder(int id)
        {
            var userId = GetCurrentUserId();
            _logger.LogInformation("Восстановление заказа {OrderId} для {UserId}", id, userId);

            var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == id && o.IsDeleted);  // 🔥 Фикс _context
            if (order == null) return NotFound("Заказ не найден или не удален");

            if (!IsAdmin() && order.ManagerId != userId) return Forbid();

            order.IsDeleted = false;
            order.DeletedAt = null;
            await _context.SaveChangesAsync();  // 🔥 _context

            return Ok(new { message = "Заказ восстановлен", orderId = id });
        }

        #region Private Helpers

        private int GetCurrentUserId()
        {
            var userIdStr = User.FindFirst(ClaimTypes.Name)?.Value;
            return int.TryParse(userIdStr, out int id) ? id : throw new UnauthorizedAccessException("Неверный ID пользователя");
        }

        private bool IsAdmin() => User.IsInRole("Admin");

        private bool OrderExists(int id) => _context.Orders.Any(e => e.Id == id);  // 🔥 _context

        private OrderResponseDto MapToResponseDto(Order order)
        {
            // 🔥 Computed TotalPrice здесь (если [NotMapped])
            var total = order.TotalPrice > 0 ? order.TotalPrice : order.WorkItems.Sum(w => w.Price * w.Quantity);

            return new OrderResponseDto
            {
                Id = order.Id,
                OrderNumber = order.OrderNumber,
                Place = order.Place,
                OrderDate = order.OrderDate,
                DeceasedFullName = order.DeceasedFullName,
                CustomerFullName = order.CustomerFullName,
                CustomerEmail = order.CustomerEmail,
                Phone = order.Phone,
                Address = order.Address,
                MonumentType = order.MonumentType,
                MonumentSize = order.MonumentSize,
                AdditionalInfo = order.AdditionalInfo,
                Status = order.Status,
                TotalPrice = total,  // 🔥 Computed
                CreatedAt = order.CreatedAt,
                UpdatedAt = order.UpdatedAt,
                ManagerId = order.ManagerId,
                ManagerFullName = order.Manager?.FullName ?? string.Empty,
                WorkItems = order.WorkItems,
                Payments = order.Payments,
                Photos = order.Photos.Select(p => new OrderPhotoDto
                {
                    Id = p.Id,
                    Url = $"/api/photos/{p.Id}/file",
                    OriginalFileName = p.OriginalFileName,
                    Size = p.Size,
                    UploadedAt = p.UploadedAt,
                    Width = p.Width ?? 0,
                    Height = p.Height ?? 0
                }).ToList()
            };
        }

        #endregion
    }
}