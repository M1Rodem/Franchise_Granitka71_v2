using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using WebApplication1.Models;
using WebApplication1.Services.Repositories;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IManagerRepository _managerRepository;
        private readonly IConfiguration _config;
        private readonly ILogger<AuthController> _logger;

        public AuthController(IManagerRepository managerRepository, IConfiguration config, ILogger<AuthController> logger)
        {
            _managerRepository = managerRepository;
            _config = config;
            _logger = logger;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto loginDto)  // ✅ Добавил async Task<>
        {
            _logger.LogInformation("Попытка входа для пользователя: {Username}", loginDto.Username);

            // ✅ ИСПРАВЛЕНО: используем async версию
            var user = await _managerRepository.GetByUsernameAsync(loginDto.Username);

            if (user == null || !_managerRepository.VerifyPassword(loginDto.Password, user.PasswordHash))
            {
                _logger.LogWarning("Неудачная попытка входа для пользователя: {Username}", loginDto.Username);
                return Unauthorized("Неверный логин или пароль");
            }

            if (user.IsBlocked)
            {
                _logger.LogWarning("Заблокированный пользователь пытается войти: {Username}", user.Username);
                return Unauthorized("Аккаунт заблокирован");
            }

            // ✅ ИСПРАВЛЕНО: используем enum вместо хардкода
            var role = user.Role == UserRole.Admin ? "Admin" : "Manager";
            _logger.LogInformation("Успешный вход для пользователя: {Username} с ролью: {Role}", user.Username, role);

            var key = _config["Jwt:Key"];
            if (string.IsNullOrEmpty(key))
                throw new ArgumentNullException(nameof(key), "JWT Key не может быть пустым.");
            var keyBytes = Encoding.ASCII.GetBytes(key);

            var tokenHandler = new JwtSecurityTokenHandler();

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, user.Id.ToString()),
                new Claim(ClaimTypes.NameIdentifier, user.Username),
                new Claim(ClaimTypes.Role, role),
                new Claim("UserId", user.Id.ToString()),
                new Claim("FullName", user.FullName ?? string.Empty)
            };

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddHours(8),
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(keyBytes),
                    SecurityAlgorithms.HmacSha256Signature),
                Issuer = _config["Jwt:Issuer"] ?? "WebApplication1",
                Audience = _config["Jwt:Audience"] ?? "WebApplication1Users"
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var tokenString = tokenHandler.WriteToken(token);

            _logger.LogInformation("JWT токен создан для пользователя: {Username}", user.Username);

            return Ok(new
            {
                id = user.Id,
                username = user.Username,
                fullName = user.FullName,
                role = role,
                token = tokenString
            });
        }

        [HttpPost("logout")]
        public IActionResult Logout()
        {
            // Просто сообщение для фронтенда
            var username = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "Unknown";
            _logger.LogInformation("Пользователь {Username} выполнил выход", username);
            return Ok(new { message = "Выход выполнен. Очистите токен на клиенте." });
        }

        //// Дополнительный метод для проверки токена (опционально)
        //[HttpGet("validate-token")]
        //[Microsoft.AspNetCore.Authorization.Authorize]
        //public IActionResult ValidateToken()
        //{
        //    var userId = User.FindFirst(ClaimTypes.Name)?.Value ?? "Unknown";
        //    var username = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "Unknown";
        //    var role = User.FindFirst(ClaimTypes.Role)?.Value ?? "Unknown";
        //    var fullName = User.FindFirst("FullName")?.Value ?? "Unknown";

        //    _logger.LogInformation("Валидация токена для пользователя: {Username}", username);

        //    return Ok(new
        //    {
        //        id = userId,
        //        username = username,
        //        fullName = fullName,
        //        role = role,
        //        message = "Токен валиден"
        //    });
        //}

        //// Метод для обновления токена (опционально)
        //[HttpPost("refresh-token")]
        //[Microsoft.AspNetCore.Authorization.Authorize]
        //public IActionResult RefreshToken()
        //{
        //    var userId = User.FindFirst(ClaimTypes.Name)?.Value;
        //    var username = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        //    var role = User.FindFirst(ClaimTypes.Role)?.Value;

        //    if (string.IsNullOrEmpty(userId) || !int.TryParse(userId, out int id))
        //    {
        //        return Unauthorized("Неверный токен");
        //    }

        //    var user = _managerRepository.GetById(id);
        //    if (user == null || user.IsBlocked)
        //    {
        //        return Unauthorized("Пользователь не найден или заблокирован");
        //    }

        //    // Генерация нового токена
        //    var key = _config["Jwt:Key"];
        //    if (string.IsNullOrEmpty(key))
        //        throw new ArgumentNullException(nameof(key), "JWT Key не может быть пустым.");
        //    var keyBytes = Encoding.ASCII.GetBytes(key);

        //    var tokenHandler = new JwtSecurityTokenHandler();

        //    // ✅ Исправлено: убраны возможные null значения в claims
        //    var claims = new List<Claim>
        //    {
        //        new Claim(ClaimTypes.Name, user.Id.ToString()),
        //        new Claim(ClaimTypes.NameIdentifier, user.Username),
        //        new Claim(ClaimTypes.Role, role ?? "Manager"),
        //        new Claim("UserId", user.Id.ToString()),
        //        new Claim("FullName", user.FullName ?? string.Empty)
        //    };

        //    var tokenDescriptor = new SecurityTokenDescriptor
        //    {
        //        Subject = new ClaimsIdentity(claims),
        //        Expires = DateTime.UtcNow.AddHours(8),
        //        SigningCredentials = new SigningCredentials(
        //            new SymmetricSecurityKey(keyBytes),
        //            SecurityAlgorithms.HmacSha256Signature),
        //        Issuer = _config["Jwt:Issuer"] ?? "WebApplication1",
        //        Audience = _config["Jwt:Audience"] ?? "WebApplication1Users"
        //    };

        //    var token = tokenHandler.CreateToken(tokenDescriptor);
        //    var tokenString = tokenHandler.WriteToken(token);

        //    _logger.LogInformation("Токен обновлен для пользователя: {Username}", username);

        //    return Ok(new
        //    {
        //        id = user.Id,
        //        username = user.Username,
        //        fullName = user.FullName,
        //        role = role,
        //        token = tokenString
        //    });
        //}
    }
}