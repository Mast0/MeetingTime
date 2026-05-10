using MeetingTime.Domain.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

namespace Shared.Infrastructure.Extensions;

public static class InfrastructureServiceCollectionExtensions
{
    public static IServiceCollection AddSharedInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<MeetingTimeContext>(opt =>
        {
            opt.UseNpgsql(configuration.GetConnectionString("DbConnection"));
        });

        return services;
    }

    /// <summary>
    /// Registers <see cref="IConnectionMultiplexer"/> as a singleton using the
    /// <c>Redis:Connection</c> configuration key (or <c>Redis__Connection</c> env var).
    /// </summary>
    public static IServiceCollection AddRedis(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration["Redis:Connection"]
            ?? throw new InvalidOperationException("Redis:Connection is not configured.");

        services.AddSingleton<IConnectionMultiplexer>(
            ConnectionMultiplexer.Connect(connectionString));

        return services;
    }
}
