using Franchisee.Web.Configuration;
using Franchisee.Web.Models.DTOs.Auth;
using Franchisee.Web.Models.DTOs.Users;
using Franchisee.Web.Models.Entities.Users;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Events;
using DotNetEnv;
using Franchisee.Web.Services.Orders.Background;

var builder = WebApplication.CreateBuilder(args);

// Загружаем .env СРАЗУ, в самом начале
if (builder.Environment.IsDevelopment())
{
    Env.Load();
}

// Проверяем переменные ТОЛЬКО после загрузки
string[] requiredEnv = {
    "JWT_KEY",
    "JWT_ISSUER",
    "JWT_AUDIENCE",
    "JWT_EXPIRE_MINUTES",
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
    "ALLOWED_ORIGINS"
};

foreach (var key in requiredEnv)
{
    var value = Environment.GetEnvironmentVariable(key);
    if (string.IsNullOrWhiteSpace(value))
    {
        throw new Exception($"ENV {key} is missing. Application cannot start.");
    }
}

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("System", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .Destructure.ByTransforming<LoginDto>(dto => new { dto.Username })
    .Destructure.ByTransforming<CreateManagerDto>(dto => new { dto.Username, dto.FullName, dto.Role })
    .WriteTo.Console(
        outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}"
    )
    .WriteTo.File(
        "logs/app.log",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 7,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}"
    )
    .CreateLogger();

builder.Host.UseSerilog();

try
{
    Log.Information("Application starting up...");
    Log.Information("Environment: {Environment}", builder.Environment.EnvironmentName);

    builder.Services.AddSignalR(options =>
    {
        options.EnableDetailedErrors = builder.Environment.IsDevelopment();
        options.MaximumReceiveMessageSize = 102400;
        options.KeepAliveInterval = TimeSpan.FromSeconds(10);
        options.ClientTimeoutInterval = TimeSpan.FromSeconds(60);
        options.HandshakeTimeout = TimeSpan.FromSeconds(15);
    });

    AppConfiguration.ConfigureServices(builder.Services, builder.Configuration, builder.Environment);

    builder.Services.AddScoped<Franchisee.Web.Services.Plots.Repositories.IPlotRepository, Franchisee.Web.Services.Plots.Repositories.PlotRepository>();
    builder.Services.AddScoped<Franchisee.Web.Services.Media.Core.IMediaService, Franchisee.Web.Services.Media.Core.MediaService>();
    builder.Services.AddHostedService<ExpiredOrderCleanupService>();
    builder.Services.AddHttpContextAccessor();

    var app = builder.Build();

    app.MapGet("/health", async (ApplicationDbContext db) =>
    {
        try
        {
            var canConnect = await db.Database.CanConnectAsync();
            return canConnect
                ? Results.Ok(new { status = "healthy" })
                : Results.StatusCode(500);
        }
        catch
        {
            return Results.StatusCode(500);
        }
    })
    .AllowAnonymous();

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

    var allowedOrigins = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS")?
    .Split(',', StringSplitOptions.RemoveEmptyEntries)
    .Select(o => o.Trim())
    .ToArray() ?? Array.Empty<string>();

    Log.Information("WebSocket allowed origins: {Origins}", string.Join(", ", allowedOrigins));

    var webSocketOptions = new WebSocketOptions
    {
        KeepAliveInterval = TimeSpan.FromSeconds(30)
    };

    foreach (var origin in allowedOrigins)
    {
        webSocketOptions.AllowedOrigins.Add(origin);
    }

    app.UseWebSockets(webSocketOptions);
    AppConfiguration.ConfigurePipeline(app, app.Environment);
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
    throw;
}
finally
{
    Log.CloseAndFlush();
}
