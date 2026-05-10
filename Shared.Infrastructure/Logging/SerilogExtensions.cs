using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Serilog;
using Serilog.Events;
using Serilog.Exceptions;

namespace Shared.Infrastructure.Logging;

public static class SerilogExtensions
{
    /// <summary>
    /// Configures Serilog as the application logger.
    /// Call this on <paramref name="builder"/> BEFORE <c>builder.Build()</c>,
    /// then call <c>app.UseSerilogRequestLogging()</c> after building.
    /// </summary>
    /// <param name="builder">The <see cref="WebApplicationBuilder"/>.</param>
    /// <param name="serviceName">Human-readable name stamped on every log event.</param>
    public static WebApplicationBuilder AddSerilogLogging(
        this WebApplicationBuilder builder,
        string serviceName)
    {
        var seqUrl = builder.Configuration["Seq:Url"] ?? "http://localhost:5341";
        var minLevelStr = builder.Configuration["Seq:MinimumLevel"] ?? "Information";
        var minLevel = Enum.TryParse<LogEventLevel>(minLevelStr, ignoreCase: true, out var parsed)
            ? parsed
            : LogEventLevel.Information;

        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Is(minLevel)
            // Suppress noisy framework categories at Warning level
            .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
            .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
            .MinimumLevel.Override("Grpc", LogEventLevel.Warning)
            .MinimumLevel.Override("System.Net.Http.HttpClient", LogEventLevel.Warning)
            // Enrichers — metadata attached to every log event
            .Enrich.FromLogContext()
            .Enrich.WithProperty("ServiceName", serviceName)
            .Enrich.WithProperty("Environment", builder.Environment.EnvironmentName)
            .Enrich.WithMachineName()
            .Enrich.WithProcessId()
            .Enrich.WithThreadId()
            .Enrich.WithExceptionDetails()
            // Console sink — pretty, colored for local dev
            .WriteTo.Console(
                outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] [{ServiceName}] {Message:lj}{NewLine}{Exception}",
                restrictedToMinimumLevel: LogEventLevel.Debug)
            // Seq sink — structured JSON, all events
            .WriteTo.Seq(seqUrl, restrictedToMinimumLevel: minLevel)
            .CreateLogger();

        builder.Host.UseSerilog();

        return builder;
    }
}
