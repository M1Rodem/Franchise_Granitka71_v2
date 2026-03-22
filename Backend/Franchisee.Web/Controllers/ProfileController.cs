using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Franchisee.Web.Models.DTOs.Users;
using Franchisee.Web.Models.DTOs.Profile;
using Franchisee.Web.Services.Users.Repositories;

namespace Franchisee.Web.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ProfileController : ControllerBase
    {
        private readonly IManagerRepository _managerRepository;
        private readonly ILogger<ProfileController> _logger;

        public ProfileController(IManagerRepository managerRepository, ILogger<ProfileController> logger)
        {
            _managerRepository = managerRepository;
            _logger = logger;
        }

        // Вспомогательный метод для получения ID текущего пользователя
        private int GetCurrentUserId()
        {
            var userId = User.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(userId) || !int.TryParse(userId, out int id))
            {
                throw new UnauthorizedAccessException("Неверный идентификатор пользователя");
            }
            return id;
        }

        // Получить данные текущего пользователя
        [HttpGet]
        public async Task<ActionResult<ManagerResponseDto>> GetMyProfile()
        {
            try
            {
                var userId = GetCurrentUserId();
                _logger.LogInformation("Получение профиля пользователя ID: {UserId}", userId);

                var manager = await _managerRepository.GetByIdAsync(userId);
                if (manager == null) return NotFound("Пользователь не найден");

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
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(ex.Message);
            }
        }

        // Сменить пароль - ДОБАВЛЯЕМ ВАЛИДАЦИЮ НА 8 СИМВОЛОВ
        [HttpPost("change-password")]
        public async Task<ActionResult> ChangePassword([FromBody] ChangePasswordDto changePasswordDto)
        {
            try
            {
                var userId = GetCurrentUserId();
                _logger.LogInformation("Смена пароля для пользователя ID: {UserId}", userId);

                // ВАЛИДАЦИЯ ПАРОЛЯ - 8 СИМВОЛОВ
                if (string.IsNullOrEmpty(changePasswordDto.NewPassword) || changePasswordDto.NewPassword.Length < 8)
                {
                    return BadRequest("Пароль должен быть не менее 8 символов");
                }

                var manager = await _managerRepository.GetByIdAsync(userId);
                if (manager == null) return NotFound("Пользователь не найден");

                if (manager.PasswordHash == null || !_managerRepository.VerifyPassword(changePasswordDto.CurrentPassword, manager.PasswordHash))
                {
                    return BadRequest("Текущий пароль неверен");
                }

                // ИСПОЛЬЗУЕМ ТАКОЙ ЖЕ МЕТОД КАК В USERS CONTROLLER
                var hashedPassword = _managerRepository.HashPassword(changePasswordDto.NewPassword);
                await _managerRepository.ChangePasswordAsync(userId, changePasswordDto.NewPassword);

                _logger.LogInformation("Пароль успешно изменен для пользователя ID: {UserId}", userId);
                return Ok("Пароль успешно изменен");
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(ex.Message);
            }
        }

        // Обновить профиль (имя)
        [HttpPut("update-profile")]
        public async Task<ActionResult<ManagerResponseDto>> UpdateProfile([FromBody] UpdateProfileDto updateProfileDto)
        {
            try
            {
                var userId = GetCurrentUserId();
                _logger.LogInformation("Обновление профиля для пользователя ID: {UserId}", userId);

                var manager = await _managerRepository.GetByIdAsync(userId);
                if (manager == null) return NotFound("Пользователь не найден");

                _managerRepository.UpdateProfile(userId, updateProfileDto.FullName);

                manager = await _managerRepository.GetByIdAsync(userId);
                if (manager == null) return NotFound("Пользователь не найден после обновления");

                var response = new ManagerResponseDto
                {
                    Id = manager.Id,
                    Username = manager.Username,
                    FullName = manager.FullName,
                    Role = manager.Role.ToString(),
                    IsBlocked = manager.IsBlocked
                };

                _logger.LogInformation("Профиль успешно обновлен для пользователя ID: {UserId}", userId);
                return Ok(response);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(ex.Message);
            }
        }
    }
}