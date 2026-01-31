using Franchisee.Web.Configuration;
using Franchisee.Web.Models;
using Franchisee.Web.Services;
using Franchisee.Web.Services.Hubs;
using Franchisee.Web.Services.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.Text;

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
                    var allowedOrigins = new List<string>
                    {
                        "http://localhost:3000",
                        "http://localhost:5000",
                        "https://localhost:5001",
                    };

                    // Добавляем WebSocket origins
                    allowedOrigins.AddRange(new[]
                    {
                        "ws://localhost:3000",
                        "wss://localhost:3000",
                        "ws://localhost:5000",
                        "wss://localhost:5000"
                    });

                    // Добавляем продакшен домены
                    if (env.IsProduction())
                    {
                        allowedOrigins.AddRange(new[]
                        {
                            "https://granit71.ru",
                            "https://www.granit71.ru",
                            "http://granit71.ru",
                            "http://www.granit71.ru"
                        });
                    }

                    policy.WithOrigins(allowedOrigins.ToArray())
                          .AllowAnyHeader()
                          .AllowAnyMethod()
                          .AllowCredentials()
                          .SetIsOriginAllowedToAllowWildcardSubdomains();
                });
            });

            services.AddScoped<IPrintService, PrintService>();

            // Поддержка больших файлов
            services.Configure<FormOptions>(options =>
            {
                options.MultipartBodyLengthLimit = 100_000_000; // 100 MB
            });

            // Основные сервисы MVC
            services.AddControllers()
                .AddJsonOptions(options =>
                {
                    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
                    options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
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

                // загрузки файлов в Swagger
                c.OperationFilter<FileUploadOperationFilter>();
            });

            // JWT Authentication
            var key = configuration["Jwt:Key"];
            if (string.IsNullOrEmpty(key))
                throw new ArgumentNullException(nameof(key), "JWT Key не может быть пустым.");
            var keyBytes = Encoding.ASCII.GetBytes(key);
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
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ClockSkew = TimeSpan.Zero
                };

                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];

                        if (!string.IsNullOrEmpty(accessToken))
                        {
                            context.Token = accessToken;
                        }
                        else if (context.Request.Headers.ContainsKey("Authorization"))
                        {
                            var authHeader = context.Request.Headers["Authorization"].ToString();
                            if (authHeader.StartsWith("Bearer "))
                            {
                                context.Token = authHeader.Substring("Bearer ".Length);
                            }
                        }

                        return Task.CompletedTask;
                    }
                };
            });

            // Авторизация по ролям
            services.AddAuthorization(options =>
            {
                options.AddPolicy("Admin", policy => policy.RequireRole("Admin", "SuperAdmin"));
                options.AddPolicy("SuperAdmin", policy => policy.RequireRole("SuperAdmin"));
                options.AddPolicy("ManagerOrHigher", policy => policy.RequireRole("Manager", "Admin", "SuperAdmin"));
            });

            // Регистрируем контекст БД
            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

            // Репозитории и сервисы
            services.AddScoped<IPhotoService, PhotoService>();
            services.AddScoped<IManagerRepository, ManagerRepository>();
            services.AddScoped<IOrderRepository, OrderRepository>();
            services.AddScoped<INotificationService, NotificationService>();

            // Фоновые сервисы
            services.AddHostedService<OldNotificationsCleanupService>();
            services.AddHostedService<PostponedNotificationCleanupService>();
            services.AddHostedService<ExpiredTempCleanupService>();
        }

        public static void ConfigurePipeline(IApplicationBuilder app, IWebHostEnvironment env)
        {
            // СОЗДАЕМ ПАПКИ ДЛЯ ЗАГРУЗОК
            CreateUploadDirectories(app, env);

            if (env.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseHttpsRedirection();

            // Статические файлы
            app.UseStaticFiles();
            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = new PhysicalFileProvider(
                Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads")),
                RequestPath = "/uploads"
            });

            app.UseRouting();

            // CORS
            app.UseCors("AllowFrontend");

            app.UseAuthentication();
            app.UseAuthorization();

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllers();

                // SignalR endpoint
                endpoints.MapHub<NotificationHub>("/api/notificationhub", options =>
                {
                    options.Transports = Microsoft.AspNetCore.Http.Connections.HttpTransportType.WebSockets |
                                         Microsoft.AspNetCore.Http.Connections.HttpTransportType.LongPolling;
                    options.ApplicationMaxBufferSize = 102400;
                    options.TransportMaxBufferSize = 102400;
                });
            });
        }

        private static void CreateUploadDirectories(IApplicationBuilder app, IWebHostEnvironment env)
        {
            var uploadsPath = Path.Combine(env.WebRootPath, "uploads");
            var tempPath = Path.Combine(uploadsPath, "temp");
            var ordersPath = Path.Combine(uploadsPath, "orders");

            if (!Directory.Exists(uploadsPath))
            {
                Directory.CreateDirectory(uploadsPath);
                Log.Information("Создана папка для загрузок: {UploadsPath}", uploadsPath);
            }
            if (!Directory.Exists(tempPath))
            {
                Directory.CreateDirectory(tempPath);
                Log.Information("Создана папка для временных файлов: {TempPath}", tempPath);
            }
            if (!Directory.Exists(ordersPath))
            {
                Directory.CreateDirectory(ordersPath);
                Log.Information("Создана папка для заказов: {OrdersPath}", ordersPath);
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
                                    Description = "Выберите файл для загрузки"
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