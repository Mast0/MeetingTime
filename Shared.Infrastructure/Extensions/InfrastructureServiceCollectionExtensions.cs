using MeetingTime.Domain.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

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
}
