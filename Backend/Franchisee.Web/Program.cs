using Serilog;
using WebApplication1.Configuration;
using WebApplication1.Models;

var builder = WebApplication.CreateBuilder(args);

// Инициализация Serilog
Log.Logger = new LoggerConfiguration()
    .WriteTo.File("logs/app.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();
builder.Host.UseSerilog();

// Регистрация сервисов с учетом окружения
AppConfiguration.ConfigureServices(builder.Services, builder.Configuration, builder.Environment);

var app = builder.Build();

// Настройка конвейера
AppConfiguration.ConfigurePipeline(app, app.Environment);

app.Run();