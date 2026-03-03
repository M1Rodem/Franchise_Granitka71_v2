using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Collections.Concurrent;
using Franchisee.Web.Models;
using Franchisee.Web.Services.Repositories;

namespace Franchisee.Web.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private const int MaxAttempts = 5;
        private static readonly TimeSpan LockDuration = TimeSpan.FromMinutes(15);

        private class LoginAttemptInfo
        {
            public int FailedAttempts { get; set; }
            public DateTime? LockedUntil { get; set; }
        }

        private static readonly ConcurrentDictionary<string, LoginAttemptInfo> LoginAttempts = new();

        private readonly IManagerRepository _managerRepository;
        private readonly IConfiguration _config;
        private readonly ILogger<AuthController> _logger;
        private string GetClientKey(string username)
        {
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            return $"{username.ToLower()}_{ip}";
        }

        public AuthController(IManagerRepository managerRepository, IConfiguration config, ILogger<AuthController> logger)
        {
            _managerRepository = managerRepository;
            _config = config;
            _logger = logger;

        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
        {
            _logger.LogInformation("Попытка входа для пользователя: {Username}", loginDto.Username);

            try
            {
                var loginKey = GetClientKey(loginDto.Username);
                var now = DateTime.UtcNow;
                var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

                if (LoginAttempts.TryGetValue(loginKey, out var attemptInfo))
                {
                    if (attemptInfo.LockedUntil.HasValue && attemptInfo.LockedUntil > now)
                    {
                        var retryAfter = (int)(attemptInfo.LockedUntil.Value - now).TotalSeconds;

                        Response.Headers["Retry-After"] = retryAfter.ToString();
                        _logger.LogWarning(
                            "Попытка входа во время активной блокировки. Username: {Username}, IP: {IP}, TimeUtc: {Time}",
                            loginDto.Username,
                            ip,
                            now
                        );
                        return StatusCode(429, new
                        {
                            message = "Слишком много попыток входа. Попробуйте позже.",
                            retryAfterSeconds = retryAfter
                        });
                    }
                }

                var user = await _managerRepository.GetByUsernameAsync(loginDto.Username);

                if (user == null || !_managerRepository.VerifyPassword(loginDto.Password, user.PasswordHash))
                {
                    var info = LoginAttempts.GetOrAdd(loginKey, _ => new LoginAttemptInfo());

                    info.FailedAttempts++;

                    if (info.FailedAttempts >= MaxAttempts)
                    {
                        info.FailedAttempts = 0;
                        info.LockedUntil = now.Add(LockDuration);

                        _logger.LogWarning(
                            "Блокировка входа. Username: {Username}, IP: {IP}, TimeUtc: {Time}, LockUntil: {LockUntil}",
                            loginDto.Username,
                            ip,
                            now,
                            info.LockedUntil
                        );

                        return StatusCode(429, new
                        {
                            message = "Слишком много попыток входа. Аккаунт временно заблокирован.",
                            retryAfterSeconds = (int)LockDuration.TotalSeconds
                        });
                    }

                    return Unauthorized(new
                    {
                        message = "Неверный логин или пароль",
                        remainingAttempts = MaxAttempts - info.FailedAttempts
                    });
                }

                if (user.IsBlocked)
                {
                    _logger.LogWarning("Заблокированный пользователь пытается войти: {Username}", user.Username);
                    return Unauthorized(new { message = "Аккаунт заблокирован" });
                }

                // УСПЕШНАЯ АВТОРИЗАЦИЯ
                var role = user.Role switch
                {
                    UserRole.SuperAdmin => "SuperAdmin",
                    UserRole.Admin => "Admin",
                    _ => "Manager"
                };
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
                    Expires = DateTime.UtcNow.AddMinutes(15),
                    SigningCredentials = new SigningCredentials(
                        new SymmetricSecurityKey(keyBytes),
                        SecurityAlgorithms.HmacSha256Signature),
                    Issuer = _config["Jwt:Issuer"] ?? "Franchisee.Web",
                    Audience = _config["Jwt:Audience"] ?? "Franchisee.WebUsers"
                };

                var token = tokenHandler.CreateToken(tokenDescriptor);
                var tokenString = tokenHandler.WriteToken(token);

                var refreshToken = Guid.NewGuid().ToString();

                user.RefreshToken = refreshToken;
                user.RefreshTokenExpiryTime = DateTime.UtcNow.AddHours(8);

                await _managerRepository.UpdateAsync(user);

                Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = false, // пока false для localhost
                    SameSite = SameSiteMode.Strict,
                    Expires = user.RefreshTokenExpiryTime
                });

                var cookieExpires = DateTime.UtcNow.AddHours(8);

                var cookieOptions = new CookieOptions
                {
                    HttpOnly = true,
                    Secure = HttpContext.Request.IsHttps,
                    SameSite = HttpContext.Request.IsHttps ? SameSiteMode.None : SameSiteMode.Lax,
                    Expires = cookieExpires
                };

                Response.Cookies.Append("media_auth", tokenString, cookieOptions);

                LoginAttempts.TryRemove(loginKey, out _);

                return Ok(new
                {
                    id = user.Id,
                    username = user.Username,
                    fullName = user.FullName,
                    role = role,
                    token = tokenString
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при авторизации пользователя: {Username}", loginDto.Username);
                return StatusCode(500, new { message = "Внутренняя ошибка сервера" });
            }
        }

        [HttpPost("logout")]
        public IActionResult Logout()
        {
            // Просто сообщение для фронтенда
            var username = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "Unknown";
            _logger.LogInformation("Пользователь {Username} выполнил выход", username);
            return Ok(new { message = "Выход выполнен. Очистите токен на клиенте." });
        }

        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh()
        {
            var refreshToken = Request.Cookies["refreshToken"];

            if (string.IsNullOrEmpty(refreshToken))
                return Unauthorized();

            var user = await _managerRepository.GetByRefreshTokenAsync(refreshToken);

            if (user == null)
                return Unauthorized();

            var key = _config["Jwt:Key"];
            if (string.IsNullOrEmpty(key))
                return Unauthorized();

            var keyBytes = Encoding.ASCII.GetBytes(key);
            var tokenHandler = new JwtSecurityTokenHandler();

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, user.Id.ToString()),
                new Claim(ClaimTypes.NameIdentifier, user.Username),
                new Claim(ClaimTypes.Role, user.Role.ToString()),
                new Claim("UserId", user.Id.ToString()),
                new Claim("FullName", user.FullName ?? string.Empty)
            };

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddMinutes(15),
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(keyBytes),
                    SecurityAlgorithms.HmacSha256Signature),
                Issuer = _config["Jwt:Issuer"] ?? "Franchisee.Web",
                Audience = _config["Jwt:Audience"] ?? "Franchisee.WebUsers"
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var tokenString = tokenHandler.WriteToken(token);

            return Ok(new { token = tokenString });
        }
    }
}