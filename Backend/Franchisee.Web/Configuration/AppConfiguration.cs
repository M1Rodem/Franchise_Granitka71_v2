using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.Text;
using WebApplication1.Configuration;
using WebApplication1.Services;
using WebApplication1.Services.Repositories;


namespace WebApplication1.Configuration
{
    public static class AppConfiguration
    {
        public static void ConfigureServices(IServiceCollection services, IConfiguration configuration, IWebHostEnvironment env)
        {
            // ✅ ДОБАВЛЯЕМ CORS В САМОМ НАЧАЛЕ
            services.AddCors(options =>
            {
                options.AddPolicy("AllowFrontend", policy =>
                {
                    policy.WithOrigins("http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5000")
                          .AllowAnyHeader()
                          .AllowAnyMethod()
                          .AllowCredentials();
                });
            });

            // ✅ ДОБАВЛЯЕМ ПОДДЕРЖКУ ФАЙЛОВ
            services.Configure<IISServerOptions>(options =>
            {
                options.AllowSynchronousIO = true;
            });

            // ✅ ДОБАВЛЯЕМ ЛИМИТ ДЛЯ БОЛЬШИХ ФАЙЛОВ
            services.Configure<FormOptions>(options =>
            {
                options.MultipartBodyLengthLimit = 100_000_000; // 100 MB
            });

            // ✅ Основные сервисы MVC + JSON игнор циклов
            services.AddControllers()
                .AddJsonOptions(options =>
                {
                    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
                    options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
                });
            services.AddEndpointsApiExplorer();

            // ✅ Swagger + JWT Authorize кнопка + File Upload
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

                // ✅ ДОБАВЛЕНО: Поддержка загрузки файлов в Swagger
                c.OperationFilter<FileUploadOperationFilter>();
            });

            // ✅ JWT Authentication
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
                options.RequireHttpsMetadata = env.IsProduction(); // в dev можно false
                options.SaveToken = true;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ClockSkew = TimeSpan.Zero // без запаса по времени
                };
                // ✅ Логи JWT ошибок
                options.Events = new JwtBearerEvents
                {
                    OnAuthenticationFailed = context =>
                    {
                        var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
                        logger.LogError(context.Exception, "❌ Аутентификация не удалась");
                        return Task.CompletedTask;
                    },
                    OnTokenValidated = context =>
                    {
                        var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
                        logger.LogInformation("✅ Токен валиден. Пользователь: {User}", context.Principal?.Identity?.Name);
                        return Task.CompletedTask;
                    },
                    OnChallenge = context =>
                    {
                        var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
                        logger.LogWarning("⚠️ Неавторизованный доступ: {Status}", context.Response.StatusCode);
                        return Task.CompletedTask;
                    }
                };
            });

            // ✅ Авторизация по ролям
            services.AddAuthorization(options =>
            {
                options.AddPolicy("Admin", policy => policy.RequireRole("Admin"));
            });

            // ✅ Регистрируем контекст БД
            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

            // ✅ Репозитории и сервисы
            services.AddScoped<IPhotoService, PhotoService>();
            services.AddScoped<IManagerRepository, ManagerRepository>();
            services.AddScoped<IOrderRepository, OrderRepository>();
        }

        public static void ConfigurePipeline(IApplicationBuilder app, IWebHostEnvironment env)
        {
            // ✅ СОЗДАЕМ ПАПКИ ДЛЯ ЗАГРУЗОК ПЕРЕД ВСЕМ
            CreateUploadDirectories(app, env);

            if (env.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseHttpsRedirection();

            // ✅ ДОБАВЛЯЕМ ПОДДЕРЖКУ СТАТИЧЕСКИХ ФАЙЛОВ ДО UseRouting()
            app.UseStaticFiles(); // Для wwwroot
            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = new PhysicalFileProvider(
                Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads")),
                RequestPath = "/uploads"
            });

            app.UseRouting();

            // ✅ ДОБАВЛЯЕМ UseCors ПОСЛЕ UseRouting()
            app.UseCors("AllowFrontend");

            app.UseAuthentication();
            app.UseAuthorization();

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllers();
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