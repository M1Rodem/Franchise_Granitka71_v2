using Microsoft.EntityFrameworkCore;
using Franchisee.Web.Models;

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
        public DbSet<OrderPhoto> OrderPhotos { get; set; }
        public DbSet<TempUpload> TempUploads { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<NotificationRecipient> NotificationRecipients { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Конфигурация для NotificationRecipient (СУЩЕСТВУЮЩАЯ ЛОГИКА)
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

            // Конфигурация для Notification (СУЩЕСТВУЮЩАЯ ЛОГИКА)
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

            // Связь TempUpload → Notification
            modelBuilder.Entity<TempUpload>(entity =>
            {
                entity.HasIndex(t => t.NotificationId)
                    .HasDatabaseName("IX_TempUploads_NotificationId");

                entity.HasOne<Notification>()
                    .WithMany()
                    .HasForeignKey(t => t.NotificationId)
                    .OnDelete(DeleteBehavior.SetNull); // При удалении уведомления, NotificationId = NULL

                entity.HasIndex(t => t.ExpiresAt)
                    .HasDatabaseName("IX_TempUploads_ExpiresAt");

                entity.HasIndex(t => new { t.UploaderId, t.ExpiresAt })
                    .HasDatabaseName("IX_TempUploads_UploaderId_ExpiresAt");
            });

            // Order конфигурация (СУЩЕСТВУЮЩАЯ ЛОГИКА)
            modelBuilder.Entity<Order>()
                .HasQueryFilter(o => !o.IsDeleted);

            modelBuilder.Entity<Order>()
                .Property(o => o.TotalPrice)
                .HasPrecision(18, 2);

            // Конфигурация связи Order -> Manager (СУЩЕСТВУЮЩАЯ ЛОГИКА)
            modelBuilder.Entity<Order>()
                .HasOne(o => o.Manager)
                .WithMany(m => m.Orders)
                .HasForeignKey(o => o.ManagerId)
                .OnDelete(DeleteBehavior.Restrict);

            // OrderWorkItem конфигурация (СУЩЕСТВУЮЩАЯ ЛОГИКА)
            modelBuilder.Entity<OrderWorkItem>()
                .HasOne(w => w.Order)
                .WithMany(o => o.WorkItems)
                .HasForeignKey(w => w.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<OrderWorkItem>()
                .Property(w => w.Price)
                .HasPrecision(18, 2);

            // OrderPayment конфигурация (СУЩЕСТВУЮЩАЯ ЛОГИКА)
            modelBuilder.Entity<OrderPayment>()
                .HasOne(p => p.Order)
                .WithMany(o => o.Payments)
                .HasForeignKey(p => p.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<OrderPayment>()
                .Property(p => p.Amount)
                .HasPrecision(18, 2);

            // OrderPhoto конфигурация (СУЩЕСТВУЮЩАЯ ЛОГИКА)
            modelBuilder.Entity<OrderPhoto>()
                .HasOne(p => p.Order)
                .WithMany(o => o.Photos)
                .HasForeignKey(p => p.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            // Manager конфигурация (СУЩЕСТВУЮЩАЯ ЛОГИКА)
            modelBuilder.Entity<Manager>()
                .HasIndex(m => m.Username)
                .IsUnique();

            modelBuilder.Entity<OrderPhoto>()
                .HasOne(p => p.Uploader)
                .WithMany()
                .HasForeignKey(p => p.UploaderId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<TempUpload>()
                .HasQueryFilter(t => t.ExpiresAt > DateTime.UtcNow); // Автоматически фильтрует просроченные

            modelBuilder.Entity<Order>()
                 .Property(o => o.InspectionPlace)
                 .HasMaxLength(200);
        }
    }
}