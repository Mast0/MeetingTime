using MeetingTime.Domain.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace Shared.Infrastructure.Data;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<MeetingTimeContext>
{
    public MeetingTimeContext CreateDbContext(string[] args)
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";

        var config = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .Build();

        var optionBuilder = new DbContextOptionsBuilder<MeetingTimeContext>();

        optionBuilder.UseNpgsql(config.GetConnectionString("DbConnection"));

        return new MeetingTimeContext(optionBuilder.Options);
    }
}
