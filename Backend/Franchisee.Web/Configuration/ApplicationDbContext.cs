using Microsoft.EntityFrameworkCore;
using Franchisee.Web.Models.Entities.Notification;
using Franchisee.Web.Models.Entities.Orders;
using Franchisee.Web.Models.Entities.Users;
using Franchisee.Web.Models.Entities.Plots;
using Franchisee.Web.Models.Entities.Media;

namespace Franchisee.Web.Configuration
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        // Таблицы (DbSet)
        public DbSet<Manager> Managers { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderWorkItem> OrderWorkItems { get; set; }
        public DbSet<OrderPayment> OrderPayments { get; set; }
        public DbSet<OrderMedia> OrderPhotos { get; set; } // Изменено с OrderPhoto
        public DbSet<TempUpload> TempUploads { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<NotificationRecipient> NotificationRecipients { get; set; }
        public DbSet<Plot> Plots { get; set; } // Новая таблица

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Конфигурация для Plot
            modelBuilder.Entity<Plot>(entity =>
            {
                entity.HasIndex(p => p.Name).IsUnique();
                entity.HasIndex(p => p.IsActive);

                entity.Property(p => p.Name)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(p => p.Description)
                    .HasMaxLength(500);

                entity.Property(p => p.Latitude)
                    .IsRequired();

                entity.Property(p => p.Longitude)
                    .IsRequired();
            });

            // Конфигурация для OrderMedia (бывший OrderPhoto)
            modelBuilder.Entity<OrderMedia>(entity =>
            {
                entity.HasOne(p => p.Order)
                    .WithMany(o => o.Photos)
                    .HasForeignKey(p => p.OrderId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(p => p.MediaType);

                entity.Property(p => p.MediaType)
                    .HasDefaultValue(MediaType.Photo);
            });

            // Конфигурация для TempUpload
            modelBuilder.Entity<TempUpload>(entity =>
            {
                entity.HasIndex(t => t.NotificationId)
                    .HasDatabaseName("IX_TempUploads_NotificationId");

                entity.HasOne<Notification>()
                    .WithMany()
                    .HasForeignKey(t => t.NotificationId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasIndex(t => t.ExpiresAt)
                    .HasDatabaseName("IX_TempUploads_ExpiresAt");

                entity.HasIndex(t => new { t.UploaderId, t.ExpiresAt })
                    .HasDatabaseName("IX_TempUploads_UploaderId_ExpiresAt");

                entity.HasIndex(t => t.MediaType);

                entity.Property(t => t.MediaType)
                    .HasDefaultValue(MediaType.Photo);
            });

            // Конфигурация для Order - добавляем связь с Plot
            modelBuilder.Entity<Order>(entity =>
            {
                entity.HasQueryFilter(o => !o.IsDeleted);

                entity.Property(o => o.TotalPrice)
                    .HasPrecision(18, 2);

                // Связь с Plot
                entity.HasOne(o => o.Plot)
                    .WithMany(p => p.Orders)
                    .HasForeignKey(o => o.PlotId)
                    .OnDelete(DeleteBehavior.SetNull); // При удалении участка, PlotId = NULL

                entity.HasIndex(o => o.PlotId);

                // Связь с Manager
                entity.HasOne(o => o.Manager)
                    .WithMany(m => m.Orders)
                    .HasForeignKey(o => o.ManagerId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // Конфигурация для OrderWorkItem
            modelBuilder.Entity<OrderWorkItem>(entity =>
            {
                entity.HasOne(w => w.Order)
                    .WithMany(o => o.WorkItems)
                    .HasForeignKey(w => w.OrderId)
                    .OnDelete(DeleteBehavior.Cascade);

                // Цена - 2 знака для копеек
                entity.Property(w => w.Price)
                    .HasPrecision(18, 2);

                // Количество - 3 знака (для 2.123)
                entity.Property(w => w.Quantity)
                    .HasPrecision(10, 3);  // 10 знаков всего, 3 после запятой
            });

            // Конфигурация для OrderPayment
            modelBuilder.Entity<OrderPayment>(entity =>
            {
                entity.HasOne(p => p.Order)
                    .WithMany(o => o.Payments)
                    .HasForeignKey(p => p.OrderId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.Property(p => p.Amount)
                    .HasPrecision(18, 2);
            });

            // Конфигурация для NotificationRecipient (существующая логика)
            modelBuilder.Entity<NotificationRecipient>(entity =>
            {
                entity.HasIndex(nr => new { nr.NotificationId, nr.UserId }).IsUnique();

                entity.HasIndex(nr => new { nr.Status, nr.ResolvedAt })
                    .HasFilter("\"ResolvedAt\" IS NOT NULL")
                    .HasDatabaseName("IX_NotificationRecipients_Status_ResolvedAt");

                entity.HasOne(nr => nr.Notification)
                    .WithMany(n => n.Recipients)
                    .HasForeignKey(nr => nr.NotificationId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(nr => nr.User)
                    .WithMany()
                    .HasForeignKey(nr => nr.UserId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // Конфигурация для Notification (существующая логика)
            modelBuilder.Entity<Notification>(entity =>
            {
                entity.HasIndex(n => n.CreatedAt)
                    .HasDatabaseName("IX_Notifications_CreatedAt");

                entity.HasOne(n => n.Initiator)
                    .WithMany()
                    .HasForeignKey(n => n.InitiatorId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(n => n.Order)
                    .WithMany()
                    .HasForeignKey(n => n.OrderId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // Manager конфигурация (существующая логика)
            modelBuilder.Entity<Manager>(entity =>
            {
                entity.HasIndex(m => m.Username)
                    .IsUnique();
            });

            modelBuilder.Entity<OrderMedia>()
                .HasOne(p => p.Uploader)
                .WithMany()
                .HasForeignKey(p => p.UploaderId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<TempUpload>()
                .HasQueryFilter(t => t.ExpiresAt > DateTime.UtcNow);

            modelBuilder.Entity<Order>()
                .Property(o => o.InspectionPlace)
                .HasMaxLength(200);

            modelBuilder.Entity<OrderWorkItem>()
                .HasQueryFilter(w => !w.Order!.IsDeleted);

            modelBuilder.Entity<OrderPayment>()
                .HasQueryFilter(p => !p.Order!.IsDeleted);

            modelBuilder.Entity<OrderMedia>()
                .HasQueryFilter(m => !m.Order!.IsDeleted);
        }
    }
}