using Microsoft.EntityFrameworkCore;
using WebApplication1.Models;

namespace WebApplication1.Configuration
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        // ✅ Таблицы (DbSet)
        public DbSet<Manager> Managers { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderWorkItem> OrderWorkItems { get; set; }
        public DbSet<OrderPayment> OrderPayments { get; set; }
        public DbSet<OrderPhoto> OrderPhotos { get; set; }
        public DbSet<TempUpload> TempUploads { get; set; }
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Order конфигурация
            modelBuilder.Entity<Order>()
                .HasQueryFilter(o => !o.IsDeleted); // Автоматически фильтруем удаленные

            modelBuilder.Entity<Order>()
                .Property(o => o.TotalPrice)
                .HasPrecision(18, 2);

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
        }
    }
}