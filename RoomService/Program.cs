using AuthService.Repositories;
using MeetingTime.Domain.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RoomService.Services;
using Shared.Domain.Entities;
using Shared.Domain.Interfaces;
using Shared.Infrastructure;
using Shared.Infrastructure.Extensions;
using Shared.Infrastructure.Logging;
using Serilog;

var builder = WebApplication.CreateBuilder(args);
builder.AddSerilogLogging("RoomService");

builder.Services.AddSharedInfrastructure(builder.Configuration);
builder.Services.AddRedis(builder.Configuration);

builder.Services.AddIdentity<UserEntity, IdentityRole>(opt =>
{
    opt.Password.RequireDigit = true;
    opt.Password.RequireLowercase = true;
    opt.Password.RequireUppercase = false;
    opt.Password.RequireNonAlphanumeric = false;
    opt.Password.RequiredLength = 8;
})
.AddEntityFrameworkStores<MeetingTimeContext>()
.AddDefaultTokenProviders();

builder.Services.AddScoped<IRoomRepository, RoomRepository>();

builder.Services.AddGrpc();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MeetingTimeContext>();
    try
    {
        await MigrationHelper.SyncAndMigrateAsync(db);
        Log.Information("Database migrations applied successfully.");
    }
    catch (Exception ex)
    {
        Log.Error(ex, "An error occurred while migrating the database.");
    }
}

app.MapGrpcService<RoomGrpcService>();
app.MapGet("/", () => "Communication with gRPC endpoints must be made through a gRPC client. To learn how to create a client, visit: https://go.microsoft.com/fwlink/?linkid=2086909");

try
{
    app.Run();
}
finally
{
    Log.CloseAndFlush();
}
