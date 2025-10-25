using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebApplication1.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddInspectionPlaceToOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ThumbPath",
                table: "OrderPhotos");

            migrationBuilder.AddColumn<string>(
                name: "InspectionPlace",
                table: "Orders",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InspectionPlace",
                table: "Orders");

            migrationBuilder.AddColumn<string>(
                name: "ThumbPath",
                table: "OrderPhotos",
                type: "text",
                nullable: true);
        }
    }
}
