using AuthService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Shared.Infrastructure.Extensions;
using MeetingTime.Domain.Data;
using Shared.Domain.Entities;
using Shared.Infrastructure.Logging;
using Serilog;

var builder = WebApplication.CreateBuilder(args);
var configuration = builder.Configuration;
var services = builder.Services;

builder.AddSerilogLogging("AuthService");

// Add DB connection
services.AddSharedInfrastructure(builder.Configuration);
services.AddRedis(builder.Configuration);

// Add Identity and Role managment
services.AddIdentity<UserEntity, IdentityRole>(opt =>
{
    opt.Password.RequireDigit = true;
    opt.Password.RequireLowercase = true;
    opt.Password.RequireUppercase = false;
    opt.Password.RequireNonAlphanumeric = false;
    opt.Password.RequiredLength = 8;
})
.AddEntityFrameworkStores<MeetingTimeContext>()
.AddDefaultTokenProviders();

// Configure JWT Authentication
var jwtSettings = configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["SecretKey"];

services.AddAuthentication(opt =>
{
    opt.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    opt.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(opt =>
{
    opt.RequireHttpsMetadata = true;
    opt.SaveToken = true;
    opt.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
        ClockSkew = TimeSpan.Zero
    };
});

// Add services to the container.
services.AddGrpc();

var app = builder.Build();

// Configure the HTTP request pipeline.
app.MapGrpcService<AuthGrpcService>();
app.MapGet("/", () => "Communication with gRPC endpoints must be made through a gRPC client. To learn how to create a client, visit: https://go.microsoft.com/fwlink/?linkid=2086909");

for (var attempt = 1; attempt <= 5; attempt++)
{
    using var scope = app.Services.CreateScope();
    try
    {
        var context = scope.ServiceProvider.GetRequiredService<MeetingTimeContext>();
        await context.Database.MigrateAsync();
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

try
{
    await app.RunAsync();
}
finally
{
    Log.CloseAndFlush();
}
