using Serilog;
using Franchisee.Web.Configuration;
using Franchisee.Web.Models;
using Franchisee.Web.Services;

var builder = WebApplication.CreateBuilder(args);

// Инициализация Serilog
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
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

// Настройка конвейера
AppConfiguration.ConfigurePipeline(app, app.Environment);

app.Run();