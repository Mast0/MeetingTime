using ChatService.Handlers;
using ChatService.Repositories;
using ChatService.Services;
using MeetingTime.Domain.Data;
using Microsoft.AspNetCore.Identity;
using Shared.Domain.Entities;
using Shared.Domain.Interfaces;
using Shared.Infrastructure.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSharedInfrastructure(builder.Configuration);

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

builder.Services.AddScoped<IChatMessageRepository, ChatMessageRepository>();

builder.Services.AddGrpc();

var app = builder.Build();

app.UseWebSockets();

app.Map("/ws/chat", ChatWebSocketHandler.Handle);

app.MapGrpcService<ChatGrpcService>();

await app.RunAsync();
