using Franchisee.Web.Configuration;
using Franchisee.Web.Models;
using Franchisee.Web.Services;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Events;

var builder = WebApplication.CreateBuilder(args);

// Инициализация Serilog
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .Destructure.ByTransforming<LoginDto>(dto => new { dto.Username })
    .Destructure.ByTransforming<CreateManagerDto>(dto => new { dto.Username, dto.FullName, dto.Role })
    .WriteTo.Console(
        outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}"
    )
    .WriteTo.File(
        "logs/app.log",
        rollingInterval: RollingInterval.Day,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}"
    )
    .CreateLogger();
builder.Host.UseSerilog();
builder.Services.AddHostedService<ExpiredTempCleanupService>();

// Регистрация сервисов с учетом окружения
AppConfiguration.ConfigureServices(builder.Services, builder.Configuration, builder.Environment);

var app = builder.Build();

// СОЗДАНИЕ АДМИНА ПРИ ПЕРВОМ ЗАПУСКЕ (УДАЛИ ПОСЛЕ НАСТРОЙКИ)
//try
//{
//    using var scope = app.Services.CreateScope();
//    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
//    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

//    // Ждем пока БД будет готова
//    await context.Database.MigrateAsync();

//    // Проверяем есть ли админ
//    var hasAdmin = await context.Managers
//        .AnyAsync(m => m.Role == UserRole.Admin && !m.IsBlocked);

//    if (!hasAdmin)
//    {
//        var adminUser = new Manager
//        {
//            Username = "admin",
//            PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
//            FullName = "Системный администратор",
//            Role = UserRole.Admin,
//            IsBlocked = false
//        };

//        context.Managers.Add(adminUser);
//        await context.SaveChangesAsync();

//        logger.LogInformation("Создан системный администратор: admin / admin123");
//        logger.LogWarning("НЕ ЗАБУДЬ СМЕНИТЬ ПАРОЛЬ и УДАЛИТЬ ЭТОТ КОД!");
//    }
//    else
//    {
//        logger.LogInformation("Администратор уже существует в системе");
//    }
//}
//catch (Exception ex)
//{
//    var logger = app.Services.GetRequiredService<ILogger<Program>>();
//    logger.LogError(ex, "Ошибка при создании администратора");
//}

// ГЛОБАЛЬНАЯ ОБРАБОТКА ОШИБОК (ДО ВСЕГО)
app.UseExceptionHandler(app => app.Run(async context =>
{
    context.Response.StatusCode = 500;
    context.Response.ContentType = "application/json";
    await context.Response.WriteAsJsonAsync(new { message = "Произошла внутренняя ошибка сервера" });
}));

// Обработка HTTP ошибок (404, 401, 403, etc.)
app.UseStatusCodePages(async statusCodeContext =>
{
    var response = statusCodeContext.HttpContext.Response;
    var statusCode = response.StatusCode;

    var message = statusCode switch
    {
        400 => "Неверный запрос",
        401 => "Требуется авторизация",
        403 => "Доступ запрещен",
        404 => "Ресурс не найден",
        _ => "Произошла ошибка"
    };

    response.ContentType = "application/json";
    await response.WriteAsJsonAsync(new { message });
});

app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");

    if (context.Response.Headers.ContainsKey("Server"))
    {
        context.Response.Headers.Remove("Server");
    }

    await next();
});

// Настройка конвейера
AppConfiguration.ConfigurePipeline(app, app.Environment);

app.Run();