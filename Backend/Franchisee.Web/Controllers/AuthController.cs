using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Collections.Concurrent;
using Microsoft.AspNetCore.Authorization;
using Franchisee.Web.Models.DTOs.Auth;
using Franchisee.Web.Models.Entities.Users;
using Franchisee.Web.Services.Users.Repositories;

namespace Franchisee.Web.Controllers
{
    [AllowAnonymous]
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

        private readonly int _accessLifetimeMinutes;
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
            
            _accessLifetimeMinutes = int.Parse(_config["Jwt:AccessTokenMinutes"] ?? "15");
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
                    Expires = DateTime.UtcNow.AddMinutes(_accessLifetimeMinutes),
                    SigningCredentials = new SigningCredentials(
                        new SymmetricSecurityKey(keyBytes),
                        SecurityAlgorithms.HmacSha256Signature),
                    Issuer = _config["Jwt:Issuer"] ?? "Franchisee.Web",
                    Audience = _config["Jwt:Audience"] ?? "Franchisee.WebUsers"
                };

                var token = tokenHandler.CreateToken(tokenDescriptor);
                var tokenString = tokenHandler.WriteToken(token);

                var refreshToken = GenerateRefreshToken();

                user.RefreshToken = refreshToken;
                user.RefreshTokenExpiryTime = DateTime.UtcNow.AddHours(8);

                await _managerRepository.UpdateAsync(user);

                Response.Cookies.Append("refreshToken", refreshToken, GetRefreshCookieOptions(user.RefreshTokenExpiryTime.Value));

                Response.Cookies.Append("media_auth", tokenString, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = true,
                    SameSite = SameSiteMode.None,
                    Expires = DateTime.UtcNow.AddHours(8)
                });

                LoginAttempts.TryRemove(loginKey, out _);

                return Ok(new
                {
                    id = user.Id,
                    username = user.Username,
                    fullName = user.FullName,
                    role = role,
                    token = tokenString,
                    expiresIn = _accessLifetimeMinutes * 60
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при авторизации пользователя: {Username}", loginDto.Username);
                return StatusCode(500, new { message = "Внутренняя ошибка сервера" });
            }
        }
        
        [Authorize]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            var userIdClaim = User.FindFirst("UserId");

            if (userIdClaim == null)
                return Unauthorized();

            if (!int.TryParse(userIdClaim.Value, out var userId))
                return Unauthorized();

            var user = await _managerRepository.GetByIdAsync(userId);

            if (user != null)
            {
                user.RefreshToken = null;
                user.RefreshTokenExpiryTime = null;

                await _managerRepository.UpdateAsync(user);
            }

            Response.Cookies.Delete("refreshToken");
            Response.Cookies.Delete("media_auth");

            _logger.LogInformation("[Token] Revoked UserId={UserId}", userId);

            return Ok(new { message = "Logged out" });
        }

        public class RefreshRequest
        {
            public string RefreshToken { get; set; } = "";
        }

        [AllowAnonymous]
        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh([FromBody] RefreshRequest request)
        {
            var refreshToken = Request.Cookies["refreshToken"] ?? request.RefreshToken;

            if (string.IsNullOrEmpty(refreshToken))
            {
                _logger.LogWarning("[TokenRefresh] UserId={UserId} Failed Reason={Reason}", 0, "RefreshTokenMissing");
                return Unauthorized();
            }

            var existingUser = await _managerRepository.GetByRefreshTokenAsync(refreshToken);
            var existingUserId = existingUser?.Id ?? 0;
            var oldExpiry = existingUser?.RefreshTokenExpiryTime;

            if (existingUser != null && existingUser.RefreshTokenExpiryTime <= DateTime.UtcNow)
            {
                _logger.LogWarning("[Token] Expired UserId={UserId} At={Time}", existingUser.Id, existingUser.RefreshTokenExpiryTime);
            }

            var newRefreshToken = GenerateRefreshToken();
            var newExpiry = DateTime.UtcNow.AddHours(8);

            var user = await _managerRepository.RotateRefreshTokenAsync(
                refreshToken,
                newRefreshToken,
                newExpiry
            );


            if (user == null || user.IsBlocked || user.RefreshTokenExpiryTime <= DateTime.UtcNow)
            {
                var reason = user == null
                    ? "InvalidRefreshToken"
                    : user.IsBlocked
                        ? "UserBlocked"
                        : "RefreshTokenExpired";

                _logger.LogWarning("[TokenRefresh] UserId={UserId} Failed Reason={Reason}", existingUserId, reason);
                return Unauthorized();
            }

            var key = _config["Jwt:Key"]
                ?? throw new InvalidOperationException("JWT Key не настроен");

            var keyBytes = Encoding.ASCII.GetBytes(key);
            var tokenHandler = new JwtSecurityTokenHandler();

            var role = user.Role switch
            {
                UserRole.SuperAdmin => "SuperAdmin",
                UserRole.Admin => "Admin",
                _ => "Manager"
            };

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
                Expires = DateTime.UtcNow.AddMinutes(_accessLifetimeMinutes),
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(keyBytes),
                    SecurityAlgorithms.HmacSha256Signature),
                Issuer = _config["Jwt:Issuer"],
                Audience = _config["Jwt:Audience"]
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var tokenString = tokenHandler.WriteToken(token);

            Response.Cookies.Append(
                "refreshToken",
                newRefreshToken,
                GetRefreshCookieOptions(user.RefreshTokenExpiryTime.Value)
            );

            _logger.LogInformation(
                "[TokenRefresh] UserId={UserId} Success OldExpiry={Old} NewExpiry={New}",
                user.Id,
                oldExpiry,
                user.RefreshTokenExpiryTime);

            return Ok(new
            {
                token = tokenString,
                expiresIn = _accessLifetimeMinutes * 60
            });
        }

        private static string GenerateRefreshToken()
        {
            var randomNumber = new byte[64];

            using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
            rng.GetBytes(randomNumber);

            return Convert.ToBase64String(randomNumber);
        }
        private CookieOptions GetRefreshCookieOptions(DateTime expiry)
        {
            return new CookieOptions
            {
                HttpOnly = true,
                Secure = HttpContext.Request.IsHttps,
                SameSite = HttpContext.Request.IsHttps ? SameSiteMode.None : SameSiteMode.Lax,
                Expires = expiry
            };
        }
    }
}
