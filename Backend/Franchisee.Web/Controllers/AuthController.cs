﻿using Microsoft.AspNetCore.Mvc;
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

        private string GetClientIp()
        {
            return HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
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
            var clientIp = GetClientIp();
            _logger.LogInformation("Login attempt for user: {Username} from IP: {IP}", loginDto.Username, clientIp);

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
                            "Login attempt during active lockout. Username: {Username}, IP: {IP}, LockedUntil: {LockedUntil}",
                            loginDto.Username,
                            ip,
                            attemptInfo.LockedUntil.Value
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

                    _logger.LogDebug(
                        "Failed login attempt #{Attempts} for user: {Username} from IP: {IP}",
                        info.FailedAttempts,
                        loginDto.Username,
                        ip
                    );

                    if (info.FailedAttempts >= MaxAttempts)
                    {
                        info.FailedAttempts = 0;
                        info.LockedUntil = now.Add(LockDuration);

                        _logger.LogWarning(
                            "Account locked due to multiple failed attempts. Username: {Username}, IP: {IP}, LockUntil: {LockUntil}",
                            loginDto.Username,
                            ip,
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
                    _logger.LogWarning(
                        "Blocked user attempted to login. Username: {Username}, IP: {IP}, UserId: {UserId}",
                        user.Username,
                        ip,
                        user.Id
                    );
                    return Unauthorized(new { message = "Аккаунт заблокирован" });
                }

                // УСПЕШНАЯ АВТОРИЗАЦИЯ
                var role = user.Role switch
                {
                    UserRole.SuperAdmin => "SuperAdmin",
                    UserRole.Admin => "Admin",
                    _ => "Manager"
                };
                
                _logger.LogInformation(
                    "Successful login. Username: {Username}, Role: {Role}, UserId: {UserId}, IP: {IP}",
                    user.Username,
                    role,
                    user.Id,
                    ip
                );

                var key = Environment.GetEnvironmentVariable("JWT_KEY");

                if (string.IsNullOrEmpty(key))
                {
                    _logger.LogError("JWT_KEY environment variable is missing");
                    throw new Exception("JWT_KEY не задан");
                }

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
                    Issuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? "Franchisee.Web",
                    Audience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? "Franchisee.WebUsers"
                };

                var token = tokenHandler.CreateToken(tokenDescriptor);
                var tokenString = tokenHandler.WriteToken(token);

                _logger.LogDebug(
                    "JWT token generated for user {UserId} (Username: {Username}), expires in {ExpiresMinutes} minutes",
                    user.Id,
                    user.Username,
                    _accessLifetimeMinutes
                );

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

                _logger.LogInformation(
                    "Login completed successfully. UserId: {UserId}, Username: {Username}, IP: {IP}",
                    user.Id,
                    user.Username,
                    ip
                );

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
                _logger.LogError(ex, "Unexpected error during login for user: {Username}, IP: {IP}", loginDto.Username, GetClientIp());
                return StatusCode(500, new { message = "Внутренняя ошибка сервера" });
            }
        }
        
        [Authorize]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            var clientIp = GetClientIp();
            var userIdClaim = User.FindFirst("UserId");

            if (userIdClaim == null)
            {
                _logger.LogWarning("Logout attempted without valid UserId claim from IP: {IP}", clientIp);
                return Unauthorized();
            }

            if (!int.TryParse(userIdClaim.Value, out var userId))
            {
                _logger.LogWarning("Logout attempted with invalid UserId format: {UserIdClaim} from IP: {IP}", userIdClaim.Value, clientIp);
                return Unauthorized();
            }

            _logger.LogDebug("Logout requested for UserId: {UserId} from IP: {IP}", userId, clientIp);

            var user = await _managerRepository.GetByIdAsync(userId);

            if (user != null)
            {
                user.RefreshToken = null;
                user.RefreshTokenExpiryTime = null;

                await _managerRepository.UpdateAsync(user);
                
                _logger.LogInformation(
                    "User logged out successfully. UserId: {UserId}, Username: {Username}, IP: {IP}",
                    userId,
                    user.Username,
                    clientIp
                );
            }
            else
            {
                _logger.LogWarning("Logout attempted for non-existent UserId: {UserId} from IP: {IP}", userId, clientIp);
            }

            Response.Cookies.Delete("refreshToken");
            Response.Cookies.Delete("media_auth");

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
            var clientIp = GetClientIp();
            var refreshToken = Request.Cookies["refreshToken"] ?? request.RefreshToken;

            if (string.IsNullOrEmpty(refreshToken))
            {
                _logger.LogWarning("Token refresh failed: Refresh token missing from IP: {IP}", clientIp);
                return Unauthorized();
            }

            _logger.LogDebug("Token refresh requested from IP: {IP}", clientIp);

            var existingUser = await _managerRepository.GetByRefreshTokenAsync(refreshToken);
            var existingUserId = existingUser?.Id ?? 0;
            var oldExpiry = existingUser?.RefreshTokenExpiryTime;

            if (existingUser != null && existingUser.RefreshTokenExpiryTime <= DateTime.UtcNow)
            {
                _logger.LogWarning(
                    "Token refresh with expired refresh token. UserId: {UserId}, ExpiredAt: {Expiry}, IP: {IP}",
                    existingUser.Id,
                    existingUser.RefreshTokenExpiryTime,
                    clientIp
                );
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

                _logger.LogWarning(
                    "Token refresh failed. UserId: {UserId}, Reason: {Reason}, IP: {IP}",
                    existingUserId,
                    reason,
                    clientIp
                );
                return Unauthorized();
            }

            var key = Environment.GetEnvironmentVariable("JWT_KEY");

            if (string.IsNullOrEmpty(key))
            {
                _logger.LogError("JWT_KEY environment variable is missing during token refresh");
                throw new Exception("JWT_KEY не задан");
            }

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
                Issuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? "Franchisee.Web",
                Audience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? "Franchisee.WebUsers"
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var tokenString = tokenHandler.WriteToken(token);

            Response.Cookies.Append(
                "refreshToken",
                newRefreshToken,
                GetRefreshCookieOptions(user.RefreshTokenExpiryTime.Value)
            );

            _logger.LogInformation(
                "Token refresh successful. UserId: {UserId}, Username: {Username}, OldExpiry: {OldExpiry}, NewExpiry: {NewExpiry}, IP: {IP}",
                user.Id,
                user.Username,
                oldExpiry,
                user.RefreshTokenExpiryTime,
                clientIp
            );

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