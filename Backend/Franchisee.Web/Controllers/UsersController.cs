using DocumentFormat.OpenXml.InkML;
using Franchisee.Web.Configuration;
using Franchisee.Web.Models.DTOs.Profile;
using Franchisee.Web.Models.DTOs.Users;
using Franchisee.Web.Models.Entities.Users;
using Franchisee.Web.Services.Users.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;


namespace Franchisee.Web.Controllers
{
    [Authorize(Policy = "Admin")]
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly IManagerRepository _managerRepository;
        private readonly ILogger<UsersController> _logger;
        private readonly ApplicationDbContext _context;

        public UsersController(
            IManagerRepository managerRepository,
            ILogger<UsersController> logger,
            ApplicationDbContext context)
        {
            _managerRepository = managerRepository;
            _logger = logger;
            _context = context;
        }

        private bool IsSuperAdmin() => User.IsInRole("SuperAdmin");
        private bool IsAdmin() => User.IsInRole("Admin") || User.IsInRole("SuperAdmin");

        private ActionResult? CheckRoleCreationPermissions(UserRole roleToCreate)
        {
            var currentUserRole = GetCurrentUserRole();

            // SuperAdmin может создавать любые роли
            if (currentUserRole == UserRole.SuperAdmin)
            {
                return null; // Разрешено
            }

            // Admin может создавать только Manager и Admin
            if (currentUserRole == UserRole.Admin)
            {
                if (roleToCreate == UserRole.SuperAdmin)
                {
                    return StatusCode(403, "У вас нет прав создавать пользователей с ролью Главный администратор");
                }
                return null; // Разрешено
            }

            return StatusCode(403, "Недостаточно прав");
        }

        private UserRole GetCurrentUserRole()
        {
            if (User.IsInRole("SuperAdmin")) return UserRole.SuperAdmin;
            if (User.IsInRole("Admin")) return UserRole.Admin;
            return UserRole.Manager;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ManagerResponseDto>>> GetAll()
        {
            _logger.LogInformation("Получение списка всех менеджеров");
            var managers = await _managerRepository.GetAllAsync();
            var response = managers.Select(m => new ManagerResponseDto
            {
                Id = m.Id,
                Username = m.Username,
                FullName = m.FullName,
                Role = m.Role.ToString(),
                IsBlocked = m.IsBlocked
            });
            return Ok(response);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ManagerDetailsDto>> GetById(int id)
        {
            _logger.LogInformation("Получение пользователя с ID: {Id}", id);

            var manager = await _managerRepository.GetByIdAsync(id);

            if (manager == null)
                return NotFound("Пользователь не найден");

            var response = new ManagerDetailsDto
            {
                Id = manager.Id,
                Username = manager.Username,
                FullName = manager.FullName,
                Role = manager.Role.ToString(),
                IsBlocked = manager.IsBlocked,

                // пароль возвращаем только администраторам
                Password = IsAdmin() ? manager.PasswordHash : null
            };

            return Ok(response);
        }

        [HttpGet("paged")]
        public async Task<ActionResult<PagedResponse<ManagerResponseDto>>> GetPaged(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string searchQuery = "",
        [FromQuery] string? role = null)
        {
            _logger.LogInformation("Получение списка менеджеров с пагинацией: страница {Page}, размер {PageSize}, поиск: {Search}",
                page, pageSize, searchQuery);

            var (managers, totalCount) = await _managerRepository
                .GetPagedAsync(page, pageSize, searchQuery, role);

            var response = managers.Select(m => new ManagerResponseDto
            {
                Id = m.Id,
                Username = m.Username,
                FullName = m.FullName,
                Role = m.Role.ToString(),
                IsBlocked = m.IsBlocked
            });

            var pagedResponse = new PagedResponse<ManagerResponseDto>
            {
                Items = response.ToList(),
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            };

            return Ok(pagedResponse);
        }

        [HttpPost]
        public async Task<ActionResult<ManagerResponseDto>> Create([FromBody] CreateManagerDto createDto)
        {
            try
            {
                _logger.LogInformation("Создание нового менеджера: {Username}", createDto.Username);

                UserRole role;
                if (!Enum.TryParse<UserRole>(createDto.Role, true, out role))
                {
                    return BadRequest($"Неверная роль: {createDto.Role}. Допустимые значения: Manager, Admin, SuperAdmin");
                }

                // Проверка прав на создание пользователя с указанной ролью
                var permissionCheck = CheckRoleCreationPermissions(role);
                if (permissionCheck != null)
                {
                    return permissionCheck;
                }

                if (string.IsNullOrEmpty(createDto.Password) || createDto.Password.Length < 8)
                {
                    return BadRequest("Пароль должен быть не менее 8 символов");
                }

                var hashedPassword = _managerRepository.HashPassword(createDto.Password);

                var manager = new Manager
                {
                    Username = createDto.Username,
                    PasswordHash = hashedPassword,
                    FullName = createDto.FullName,
                    Role = role,
                    IsBlocked = false
                };

                await _managerRepository.AddAsync(manager);

                var response = new ManagerResponseDto
                {
                    Id = manager.Id,
                    Username = manager.Username,
                    FullName = manager.FullName,
                    Role = manager.Role.ToString(),
                    IsBlocked = manager.IsBlocked
                };
                return CreatedAtAction(nameof(GetById), new { id = manager.Id }, response);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ManagerResponseDto>> Update(int id, [FromBody] UpdateManagerDto updateDto)
        {
            try
            {
                _logger.LogInformation("Обновление менеджера с ID: {Id}", id);

                if (!string.IsNullOrEmpty(updateDto.Password))
                {
                    if (updateDto.Password.Length < 8)
                        return BadRequest("Пароль должен быть не менее 8 символов");
                }
                    
                var manager = await _managerRepository.GetByIdAsync(id);
                if (manager == null) return NotFound("Менеджер не найден");

                manager.Username = updateDto.Username;
                manager.FullName = updateDto.FullName;

                // ОБНОВЛЯЕМ ПАРОЛЬ С ХЕШИРОВАНИЕМ
                if (!string.IsNullOrEmpty(updateDto.Password))
                {
                    manager.PasswordHash = _managerRepository.HashPassword(updateDto.Password);
                }

                await _managerRepository.UpdateAsync(manager);

                var response = new ManagerResponseDto
                {
                    Id = manager.Id,
                    Username = manager.Username,
                    FullName = manager.FullName,
                    Role = manager.Role.ToString(),  
                    IsBlocked = manager.IsBlocked
                };

                return Ok(response);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // Изменить роль менеджера
        [HttpPost("{id}/change-role")]
        public async Task<ActionResult> ChangeRole(int id, [FromBody] ChangeRoleDto changeRoleDto)
        {
            _logger.LogInformation("Изменение роли менеджера с ID: {Id} на роль: {Role}", id, changeRoleDto.Role);

            var manager = await _managerRepository.GetByIdAsync(id);
            if (manager == null) return NotFound("Менеджер не найден");

            try
            {
                // Парсим строку в enum
                UserRole newRole = Enum.Parse<UserRole>(changeRoleDto.Role, true);

                // Проверка прав на изменение роли
                var currentUserRole = GetCurrentUserRole();

                // Если пытаемся изменить роль на SuperAdmin
                if (newRole == UserRole.SuperAdmin && currentUserRole != UserRole.SuperAdmin)
                {
                    return StatusCode(403, "Только Главный администратор может назначать роль SuperAdmin");
                }

                // Если текущий пользователь - Admin, он не может изменять роли других Admin
                if (currentUserRole == UserRole.Admin && manager.Role == UserRole.SuperAdmin)
                {
                    return StatusCode(403, "Вы не можете изменять роль Главного администратора");
                }

                // Admin не может повысить пользователя до SuperAdmin
                if (currentUserRole == UserRole.Admin && newRole == UserRole.SuperAdmin)
                {
                    return StatusCode(403, "Вы не можете назначать роль SuperAdmin");
                }

                manager.Role = newRole;
                await _managerRepository.UpdateAsync(manager);

                _logger.LogInformation("Роль менеджера {ManagerId} изменена на {Role}", id, changeRoleDto.Role);
                return Ok($"Роль изменена на {changeRoleDto.Role}");
            }
            catch (ArgumentException)
            {
                return BadRequest("Роль должна быть 'Manager', 'Admin' или 'SuperAdmin'");
            }
        }

        [HttpPost("{id}/block")]
        public async Task<ActionResult> Block(int id)
        {
            _logger.LogInformation("Блокировка менеджера с ID: {Id}", id);

            var manager = await _managerRepository.GetByIdAsync(id);

            if (manager == null)
                return NotFound("Пользователь не найден");

            var currentUserRole = GetCurrentUserRole();

            // Нельзя блокировать SuperAdmin
            if (manager.Role == UserRole.SuperAdmin)
            {
                return StatusCode(403, "Главного администратора нельзя заблокировать");
            }

            // Admin не может блокировать Admin
            if (currentUserRole == UserRole.Admin && manager.Role == UserRole.Admin)
            {
                return StatusCode(403, "Администратор не может блокировать другого администратора");
            }

            await _managerRepository.BlockAsync(id);

            return Ok("Пользователь заблокирован");
        }

        [HttpPost("{id}/unblock")]
        public async Task<ActionResult> Unblock(int id)
        {
            _logger.LogInformation("Разблокировка менеджера с ID: {Id}", id);

            var manager = await _managerRepository.GetByIdAsync(id);

            if (manager == null)
                return NotFound("Пользователь не найден");

            var currentUserRole = GetCurrentUserRole();

            // Admin не может разблокировать SuperAdmin
            if (currentUserRole == UserRole.Admin && manager.Role == UserRole.SuperAdmin)
            {
                return StatusCode(403, "Администратор не может разблокировать Главного администратора");
            }

            // Admin не может разблокировать Admin
            if (currentUserRole == UserRole.Admin && manager.Role == UserRole.Admin)
            {
                return StatusCode(403, "Администратор не может изменять другого администратора");
            }

            await _managerRepository.UnblockAsync(id);

            return Ok("Пользователь разблокирован");
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            _logger.LogInformation("Удаление менеджера с ID: {Id}", id);
            var manager = await _managerRepository.GetByIdAsync(id);
            if (manager == null) return NotFound("Менеджер не найден");

            // Проверка: нельзя удалять SuperAdmin, если текущий пользователь не SuperAdmin
            var currentUserRole = GetCurrentUserRole();
            if (manager.Role == UserRole.SuperAdmin && currentUserRole != UserRole.SuperAdmin)
            {
                return StatusCode(403, "Только Главный администратор может удалять других Главных администраторов");
            }

            // Проверка: нельзя удалять самого себя
            var currentUserId = int.Parse(User.FindFirst(ClaimTypes.Name)?.Value ?? "0");
            if (manager.Id == currentUserId)
            {
                return BadRequest("Вы не можете удалить свой собственный аккаунт");
            }

            // Проверка на наличие активных заказов
            var hasActiveOrders = await _context.Orders.AnyAsync(o => o.ManagerId == id && !o.IsDeleted);
            if (hasActiveOrders)
            {
                return BadRequest("Невозможно удалить менеджера, у которого есть активные заказы. Сначала передайте заказы другому менеджеру.");
            }

            await _managerRepository.DeleteAsync(id);
            return Ok("Менеджер удален");
        }
    }
}