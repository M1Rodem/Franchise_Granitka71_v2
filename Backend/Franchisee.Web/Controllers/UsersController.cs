using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Franchisee.Web.Models;
using Franchisee.Web.Services.Repositories;

namespace Franchisee.Web.Controllers
{
    [Authorize(Roles = "Admin")]
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly IManagerRepository _managerRepository;
        private readonly ILogger<UsersController> _logger;

        public UsersController(IManagerRepository managerRepository, ILogger<UsersController> logger)
        {
            _managerRepository = managerRepository;
            _logger = logger;
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
        public async Task<ActionResult<ManagerResponseDto>> GetById(int id)
        {
            _logger.LogInformation("Получение менеджера с ID: {Id}", id);
            var manager = await _managerRepository.GetByIdAsync(id);
            if (manager == null) return NotFound("Менеджер не найден");

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

        [HttpPost]
        public async Task<ActionResult<ManagerResponseDto>> Create([FromBody] CreateManagerDto createDto)
        {
            try
            {
                _logger.LogInformation("Создание нового менеджера: {Username}", createDto.Username);

                // Исправляем парсинг роли - добавляем игнорирование регистра
                UserRole role;
                if (!Enum.TryParse<UserRole>(createDto.Role, true, out role))
                {
                    return BadRequest($"Неверная роль: {createDto.Role}. Допустимые значения: Admin, Manager");
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
                    Role = role, // используем распаршенную роль
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
                manager.Role = Enum.Parse<UserRole>(changeRoleDto.Role);
                await _managerRepository.UpdateAsync(manager);

                _logger.LogInformation("Роль менеджера {ManagerId} изменена на {Role}", id, changeRoleDto.Role);
                return Ok($"Роль изменена на {changeRoleDto.Role}");
            }
            catch (ArgumentException)
            {
                return BadRequest("Роль должна быть 'Admin' или 'Manager'");
            }
        }

        [HttpPost("{id}/block")]
        public async Task<ActionResult> Block(int id)
        {
            _logger.LogInformation("Блокировка менеджера с ID: {Id}", id);
            var manager = await _managerRepository.GetByIdAsync(id);
            if (manager == null) return NotFound("Менеджер не найден");

            await _managerRepository.BlockAsync(id);
            return Ok("Менеджер заблокирован");
        }

        [HttpPost("{id}/unblock")]
        public async Task<ActionResult> Unblock(int id)
        {
            _logger.LogInformation("Разблокировка менеджера с ID: {Id}", id);
            var manager = await _managerRepository.GetByIdAsync(id);
            if (manager == null) return NotFound("Менеджер не найден");

            await _managerRepository.UnblockAsync(id);
            return Ok("Менеджер разблокирован");
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            _logger.LogInformation("Удаление менеджера с ID: {Id}", id);
            var manager = await _managerRepository.GetByIdAsync(id);
            if (manager == null) return NotFound("Менеджер не найден");

            await _managerRepository.DeleteAsync(id);
            return Ok("Менеджер удален");
        }
    }
}