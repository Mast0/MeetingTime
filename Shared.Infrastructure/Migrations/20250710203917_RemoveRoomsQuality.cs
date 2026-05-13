using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Shared.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveRoomsQuality : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Quality",
                table: "Rooms");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Quality",
                table: "Rooms",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
