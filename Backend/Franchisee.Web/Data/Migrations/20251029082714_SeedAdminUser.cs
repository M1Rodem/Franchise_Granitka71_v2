using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Franchisee.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class SeedAdminUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Хеш пароля "admin123"
            var passwordHash = "AQAAAAIAAYagAAAAENlR4VWQJ6pPwGt7RrCjQZ1YzWqA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z";

            migrationBuilder.InsertData(
                table: "Managers",
                columns: new[] { "Id", "Username", "PasswordHash", "FullName", "Role", "IsBlocked" },
                values: new object[] { 1, "admin", passwordHash, "Администратор Системы", 0, false });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Managers",
                keyColumn: "Id",
                keyValue: 1);
        }
    }
}
