using ChatService.Handlers;
using ChatService.Repositories;
using ChatService.Services;
using MeetingTime.Domain.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Protos;
using Shared.Domain.Entities;
using Shared.Domain.Interfaces;
using Shared.Infrastructure.Extensions;
using Shared.Infrastructure.Logging;
using Serilog;

var builder = WebApplication.CreateBuilder(args);
builder.AddSerilogLogging("ChatService");

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

builder.Services.AddSingleton<IAesEncryptionService, AesEncryptionService>();
builder.Services.AddSingleton<IRedisPubSubService, RedisPubSubService>();
builder.Services.AddSingleton<IPresenceService, PresenceService>();
builder.Services.AddScoped<IChatMessageRepository, ChatMessageRepository>();

builder.Services.AddGrpc();

builder.Services.AddGrpcClient<Auth.AuthClient>(o =>
{
    o.Address = new Uri("http://authservice:8080");
});

var app = builder.Build();

for (var attempt = 1; attempt <= 5; attempt++)
{
    using var scope = app.Services.CreateScope();
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<MeetingTimeContext>();
        await db.Database.MigrateAsync();
        Log.Information("Database migrations applied successfully.");
        break;
    }
    catch (Exception ex) when (attempt < 5 && ex.ToString().Contains("42P07"))
    {
        Log.Warning("Migration race condition detected (attempt {Attempt}/5), retrying in {Delay}ms...", attempt, attempt * 1000);
        await Task.Delay(attempt * 1000);
    }
    catch (Exception ex)
    {
        Log.Error(ex, "An error occurred while migrating the database.");
        break;
    }
}

app.UseWebSockets();

app.Map("/ws/chat", ChatWebSocketHandler.Handle);

app.MapGrpcService<ChatGrpcService>();

try
{
    await app.RunAsync();
}
finally
{
    Log.CloseAndFlush();
}
