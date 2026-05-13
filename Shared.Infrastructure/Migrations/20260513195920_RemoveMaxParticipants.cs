using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Shared.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveMaxParticipants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaxParticipiants",
                table: "Rooms");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MaxParticipiants",
                table: "Rooms",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
