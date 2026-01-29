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

            // Конфигурация для NotificationRecipient
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

            // Конфигурация для Notification
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


            // Order конфигурация
            modelBuilder.Entity<Order>()
                .HasQueryFilter(o => !o.IsDeleted); // Автоматически фильтруем удаленные

            modelBuilder.Entity<Order>()
                .Property(o => o.TotalPrice)
                .HasPrecision(18, 2);

            // ВАЖНО: Конфигурация связи Order -> Manager (добавить этот блок)
            modelBuilder.Entity<Order>()
                .HasOne(o => o.Manager)
                .WithMany(m => m.Orders)
                .HasForeignKey(o => o.ManagerId)
                .OnDelete(DeleteBehavior.Restrict); // Запретить удаление менеджера, если есть заказы

            // OrderWorkItem конфигурация
            modelBuilder.Entity<OrderWorkItem>()
                .HasOne(w => w.Order)
                .WithMany(o => o.WorkItems)
                .HasForeignKey(w => w.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<OrderWorkItem>()
                .Property(w => w.Price)
                .HasPrecision(18, 2);

            // OrderPayment конфигурация
            modelBuilder.Entity<OrderPayment>()
                .HasOne(p => p.Order)
                .WithMany(o => o.Payments)
                .HasForeignKey(p => p.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<OrderPayment>()
                .Property(p => p.Amount)
                .HasPrecision(18, 2);

            // OrderPhoto конфигурация
            modelBuilder.Entity<OrderPhoto>()
                .HasOne(p => p.Order)
                .WithMany(o => o.Photos)
                .HasForeignKey(p => p.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            // Manager конфигурация (опционально)
            modelBuilder.Entity<Manager>()
                .HasIndex(m => m.Username)
                .IsUnique(); // Уникальный логин

            modelBuilder.Entity<OrderPhoto>()
                .HasOne(p => p.Uploader)
                .WithMany()  // No navigation back
                .HasForeignKey(p => p.UploaderId)
                .OnDelete(DeleteBehavior.Restrict);  // Не удаляем менеджера при delete photo

            modelBuilder.Entity<TempUpload>()
                .HasQueryFilter(t => t.ExpiresAt > DateTime.UtcNow);  // Auto filter expired

            modelBuilder.Entity<Order>()
                 .Property(o => o.InspectionPlace)
                 .HasMaxLength(200); // Ограничение длины
        }
    }
}