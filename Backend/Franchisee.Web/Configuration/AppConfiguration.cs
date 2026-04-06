using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.Text;
using Microsoft.AspNetCore.Http.Connections;
using Franchisee.Web.Models.Shared;
using Franchisee.Web.Services.Notifications.Dispatch;
using Franchisee.Web.Services.Notifications.Background;
using Franchisee.Web.Services.Media.Background;
using Franchisee.Web.Services.Print.Core;
using Franchisee.Web.Services.Print.Builders;
using Franchisee.Web.Services.Print.Strategies;

namespace Franchisee.Web.Configuration
{
    public static class AppConfiguration
    {
        public static void ConfigureServices(IServiceCollection services, IConfiguration configuration, IWebHostEnvironment env)
        {
            services.Configure<AppSettings>(configuration.GetSection("AppSettings"));

            // CORS
            services.AddCors(options =>
            {
                options.AddPolicy("AllowFrontend", policy =>
                {
                    var originsEnv = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS");
                    string[] origins;

                    if (string.IsNullOrWhiteSpace(originsEnv))
                    {
                        Log.Warning("ALLOWED_ORIGINS is not set. CORS will not allow any external origins.");
                        origins = Array.Empty<string>();
                    }
                    else
                    {
                        origins = originsEnv
                            .Split(',', StringSplitOptions.RemoveEmptyEntries)
                            .Select(o => o.Trim())
                            .ToArray();

                        Log.Information("CORS allowed origins: {Origins}", string.Join(", ", origins));
                    }

                    if (origins.Length > 0)
                    {
                        policy.WithOrigins(origins)
                            .AllowAnyHeader()
                            .AllowAnyMethod()
                            .AllowCredentials();
                    }
                    else
                    {
                        // No origins specified - CORS will deny all cross-origin requests
                        Log.Warning("CORS policy created with no allowed origins. Cross-origin requests will be rejected.");
                    }
                });
            });

            services.AddHttpContextAccessor();

            // Upload limits - вынесены в ENV
            int maxUploadSizeBytes = 100_000_000; // default 100 MB
            var maxUploadSizeEnv = Environment.GetEnvironmentVariable("MAX_UPLOAD_SIZE_BYTES");
            if (!string.IsNullOrWhiteSpace(maxUploadSizeEnv) && int.TryParse(maxUploadSizeEnv, out var parsedSize))
            {
                maxUploadSizeBytes = parsedSize;
                Log.Information("Max upload size configured: {MaxUploadSizeBytes} bytes", maxUploadSizeBytes);
            }
            else
            {
                Log.Information("Using default max upload size: {MaxUploadSizeBytes} bytes", maxUploadSizeBytes);
            }

            services.Configure<FormOptions>(options =>
            {
                options.MultipartBodyLengthLimit = maxUploadSizeBytes;
                options.ValueLengthLimit = int.MaxValue;
                options.MultipartBoundaryLengthLimit = int.MaxValue;
                options.MemoryBufferThreshold = int.MaxValue;
            });

            services.Configure<IISServerOptions>(options =>
            {
                options.MaxRequestBodySize = maxUploadSizeBytes;
            });

            services.Configure<KestrelServerOptions>(options =>
            {
                options.Limits.MaxRequestBodySize = maxUploadSizeBytes;
            });

            // Основные сервисы MVC
            services.AddControllers()
                .AddJsonOptions(options =>
                {
                    options.JsonSerializerOptions.ReferenceHandler =
                        System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;

                    options.JsonSerializerOptions.DefaultIgnoreCondition =
                        System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;

                    options.JsonSerializerOptions.PropertyNamingPolicy =
                        System.Text.Json.JsonNamingPolicy.CamelCase;
                });
            services.AddEndpointsApiExplorer();

            // Swagger + JWT
            services.AddSwaggerGen(c =>
            {
                c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
                {
                    Name = "Authorization",
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT",
                    In = ParameterLocation.Header,
                    Description = "Введите 'Bearer' [пробел] и ваш JWT токен."
                });
                c.AddSecurityRequirement(new OpenApiSecurityRequirement
                {
                    {
                        new OpenApiSecurityScheme
                        {
                            Reference = new OpenApiReference
                            {
                                Type = ReferenceType.SecurityScheme,
                                Id = "Bearer"
                            }
                        },
                        Array.Empty<string>()
                    }
                });

                c.OperationFilter<FileUploadOperationFilter>();
                c.UseInlineDefinitionsForEnums();
            });

            // JWT Authentication
            var key = Environment.GetEnvironmentVariable("JWT_KEY");
            if (string.IsNullOrEmpty(key))
                throw new ArgumentNullException(nameof(key), "JWT_KEY не задан в ENV.");

            // Проверка длины JWT ключа (минимум 32 байта для безопасности)
            if (Encoding.ASCII.GetBytes(key).Length < 32)
            {
                Log.Warning("JWT_KEY is weak. Recommended length is at least 32 bytes. Current length: {Length} bytes", Encoding.ASCII.GetBytes(key).Length);
            }

            var keyBytes = Encoding.ASCII.GetBytes(key);
            var issuer = Environment.GetEnvironmentVariable("JWT_ISSUER");
            var audience = Environment.GetEnvironmentVariable("JWT_AUDIENCE");

            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.RequireHttpsMetadata = env.IsProduction();
                options.SaveToken = true;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(keyBytes),

                    ValidateIssuer = true,
                    ValidateAudience = true,

                    ValidIssuer = issuer,
                    ValidAudience = audience ?? "Franchisee.WebUsers",

                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero
                };

                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = context =>
                    {
                        var userIdClaim = context.Principal?.FindFirst("UserId");

                        if (userIdClaim == null)
                        {
                            context.Fail("Unauthorized");
                            return Task.CompletedTask;
                        }

                        return Task.CompletedTask;
                    },

                    OnMessageReceived = context =>
                    {
                        var path = context.HttpContext.Request.Path;

                        var accessToken = context.Request.Query["access_token"].FirstOrDefault();

                        if (!string.IsNullOrEmpty(accessToken) &&
                            path.StartsWithSegments("/api/notificationhub"))
                        {
                            context.Token = accessToken;
                            return Task.CompletedTask;
                        }

                        var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();

                        if (!string.IsNullOrEmpty(authHeader) &&
                            authHeader.StartsWith("Bearer "))
                        {
                            context.Token = authHeader.Substring("Bearer ".Length);
                            return Task.CompletedTask;
                        }

                        if (path.StartsWithSegments("/api/media") &&
                            context.Request.Cookies.TryGetValue("media_auth", out var cookieToken))
                        {
                            context.Token = cookieToken;
                        }

                        return Task.CompletedTask;
                    }
                };
            });

            // Авторизация по ролям
            services.AddAuthorization(options =>
            {
                options.FallbackPolicy = new AuthorizationPolicyBuilder()
                    .RequireAuthenticatedUser()
                    .Build();

                options.AddPolicy("Admin", policy => policy.RequireRole("Admin", "SuperAdmin"));
                options.AddPolicy("SuperAdmin", policy => policy.RequireRole("SuperAdmin"));
                options.AddPolicy("ManagerOrHigher", policy => policy.RequireRole("Manager", "Admin", "SuperAdmin"));
            });

            // Регистрируем контекст БД с проверкой ENV
            var host = Environment.GetEnvironmentVariable("DB_HOST");
            var port = Environment.GetEnvironmentVariable("DB_PORT");
            var db = Environment.GetEnvironmentVariable("DB_NAME");
            var user = Environment.GetEnvironmentVariable("DB_USER");
            var pass = Environment.GetEnvironmentVariable("DB_PASSWORD");

            // Проверка наличия всех переменных БД
            var missingDbVars = new List<string>();
            if (string.IsNullOrWhiteSpace(host)) missingDbVars.Add("DB_HOST");
            if (string.IsNullOrWhiteSpace(port)) missingDbVars.Add("DB_PORT");
            if (string.IsNullOrWhiteSpace(db)) missingDbVars.Add("DB_NAME");
            if (string.IsNullOrWhiteSpace(user)) missingDbVars.Add("DB_USER");
            if (string.IsNullOrWhiteSpace(pass)) missingDbVars.Add("DB_PASSWORD");

            if (missingDbVars.Any())
            {
                var error = $"Missing database environment variables: {string.Join(", ", missingDbVars)}";
                Log.Error(error);
                throw new InvalidOperationException(error);
            }

            var connectionString = $"Host={host};Port={port};Database={db};Username={user};Password={pass};";

            Log.Information("Database connection configured for: {Host}:{Port}/{Database}", host, port, db);

            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseNpgsql(connectionString));

            // Репозитории и сервисы
            services.AddScoped<Franchisee.Web.Services.Users.Repositories.IManagerRepository, Franchisee.Web.Services.Users.Repositories.ManagerRepository>();
            services.AddScoped<Franchisee.Web.Services.Orders.Repositories.IOrderRepository, Franchisee.Web.Services.Orders.Repositories.OrderRepository>();
            services.AddScoped<Franchisee.Web.Services.Notifications.Core.INotificationService, Franchisee.Web.Services.Notifications.Core.NotificationService>();
            services.AddScoped<IPrintStrategy, DefaultPrintStrategy>();
            services.AddScoped<IPrintStrategy, WorkerPrintStrategy>();
            services.AddScoped<PrintStrategyFactory>();
            services.AddHostedService<OldNotificationsCleanupService>();
            services.AddHostedService<PostponedNotificationCleanupService>();
            services.AddHostedService<ExpiredTempCleanupService>();
            services.AddScoped<ExcelDocumentBuilder>();
            services.AddScoped<HtmlDocumentBuilder>();
            services.AddScoped<IPrintDocumentBuilder, ExcelDocumentBuilder>(sp => sp.GetRequiredService<ExcelDocumentBuilder>());
            services.AddScoped<IPrintDocumentBuilder, HtmlDocumentBuilder>(sp => sp.GetRequiredService<HtmlDocumentBuilder>());
            services.AddScoped<IPrintService, PrintService>();
        }

        public static void ConfigurePipeline(IApplicationBuilder app, IWebHostEnvironment env)
        {
            CreateUploadDirectories(app, env);

            if (env.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }


            // Статические файлы
            app.UseStaticFiles();
            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = new PhysicalFileProvider(
                Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads")),
                RequestPath = "/uploads",
                DefaultContentType = "application/octet-stream"
            });

            app.UseRouting();
            app.UseCors("AllowFrontend");
            app.UseAuthentication();
            app.UseAuthorization();

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllers();

                endpoints.MapHub<NotificationHub>("/api/notificationhub", options =>
                {
                    options.Transports =
                        HttpTransportType.WebSockets |
                        HttpTransportType.ServerSentEvents |
                        HttpTransportType.LongPolling;

                    options.ApplicationMaxBufferSize = 102400;
                    options.TransportMaxBufferSize = 102400;
                });
            });
        }

        private static void CreateUploadDirectories(IApplicationBuilder app, IWebHostEnvironment env)
        {
            var uploadsPath = Path.Combine(env.WebRootPath, "uploads");
            var tempPath = Path.Combine(uploadsPath, "temp");
            var tempVideosPath = Path.Combine(tempPath, "videos");
            var ordersPath = Path.Combine(uploadsPath, "orders");

            if (!Directory.Exists(uploadsPath))
            {
                Directory.CreateDirectory(uploadsPath);
                Log.Information("Created upload directory: {UploadsPath}", uploadsPath);
            }
            if (!Directory.Exists(tempPath))
            {
                Directory.CreateDirectory(tempPath);
                Log.Information("Created temp directory: {TempPath}", tempPath);
            }
            if (!Directory.Exists(tempVideosPath))
            {
                Directory.CreateDirectory(tempVideosPath);
                Log.Information("Created temp videos directory: {TempVideosPath}", tempVideosPath);
            }
            if (!Directory.Exists(ordersPath))
            {
                Directory.CreateDirectory(ordersPath);
                Log.Information("Created orders directory: {OrdersPath}", ordersPath);
            }
        }
    }

    public class FileUploadOperationFilter : IOperationFilter
    {
        public void Apply(OpenApiOperation operation, OperationFilterContext context)
        {
            var fileParams = context.MethodInfo.GetParameters()
                .Where(p => p.ParameterType == typeof(IFormFile));

            if (fileParams.Any())
            {
                operation.RequestBody = new OpenApiRequestBody
                {
                    Content = {
                        ["multipart/form-data"] = new OpenApiMediaType
                        {
                            Schema = new OpenApiSchema
                            {
                                Type = "object",
                                Properties = {
                                    ["file"] = new OpenApiSchema {
                                        Type = "string",
                                        Format = "binary",
                                        Description = "Select file to upload"
                                    }
                                },
                                Required = new HashSet<string> { "file" }
                            }
                        }
                    }
                };
            }
        }
    }
}
