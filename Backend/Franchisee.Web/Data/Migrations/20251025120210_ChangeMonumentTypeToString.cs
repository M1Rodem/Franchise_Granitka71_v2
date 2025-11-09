using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Franchisee.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class ChangeMonumentTypeToString : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "MonumentType",
                table: "Orders",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "MonumentType",
                table: "Orders",
                type: "integer",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");
        }
    }
}
