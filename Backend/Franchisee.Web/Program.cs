using Franchisee.Web.Configuration;
using Franchisee.Web.Models;
using Franchisee.Web.Services;
using Franchisee.Web.Services.Hubs;
using Franchisee.Web.Services.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.SignalR;
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

// 1. SignalR ДОБАВЛЯЕМ ПЕРВЫМ
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.MaximumReceiveMessageSize = 102400; // 100KB
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
    options.HandshakeTimeout = TimeSpan.FromSeconds(30);

    if (builder.Environment.IsDevelopment())
    {
        options.EnableDetailedErrors = true;
    }
});

// 2. Основная конфигурация сервисов
AppConfiguration.ConfigureServices(builder.Services, builder.Configuration, builder.Environment);

// 3. Регистрация новых сервисов
builder.Services.AddScoped<IPlotRepository, PlotRepository>();

// 4. Заменяем IPhotoService на IMediaService
// Старая регистрация: builder.Services.AddScoped<IPhotoService, PhotoService>();
builder.Services.AddScoped<IMediaService, MediaService>();

var app = builder.Build();

// СОЗДАНИЕ АДМИНА ПРИ ПЕРВОМ ЗАПУСКЕ (УДАЛИ ПОСЛЕ НАСТРОЙКИ)
try
{
   using var scope = app.Services.CreateScope();
   var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
   var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

   // Ждем пока БД будет готова
   await context.Database.MigrateAsync();

   // Проверяем есть ли админ
   var hasAdmin = await context.Managers
       .AnyAsync(m => m.Role == UserRole.SuperAdmin && !m.IsBlocked);

   if (!hasAdmin)
   {
       var adminUser = new Manager
       {
           Username = "superadmin",
           PasswordHash = BCrypt.Net.BCrypt.HashPassword("superadmin"),
           FullName = "Системный администратор",
           Role = UserRole.SuperAdmin,
           IsBlocked = false
       };

       context.Managers.Add(adminUser);
       await context.SaveChangesAsync();

       logger.LogInformation("Создан системный администратор: superadmin / superadmin");
       logger.LogWarning("НЕ ЗАБУДЬ СМЕНИТЬ ПАРОЛЬ и УДАЛИТЬ ЭТОТ КОД!");
   }
   else
   {
       logger.LogInformation("Администратор уже существует в системе");
   }
}
catch (Exception ex)
{
   var logger = app.Services.GetRequiredService<ILogger<Program>>();
   logger.LogError(ex, "Ошибка при создании администратора");
}

// Исправленный порядок middleware

// Обработка ошибок
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler(exceptionHandlerApp =>
    {
        exceptionHandlerApp.Run(async context =>
        {
            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { message = "Произошла внутренняя ошибка сервера" });
        });
    });
}

// Основной конвейер из AppConfiguration
AppConfiguration.ConfigurePipeline(app, app.Environment);

// WebSocket для SignalR
app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(120),
    AllowedOrigins = { "http://localhost:3000", "https://localhost:3000", "http://localhost:5000", "https://localhost:5001", "https://a2zsulyprv.localto.net" }
});

// Запуск приложения
app.Run();