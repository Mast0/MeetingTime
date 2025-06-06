using AuthService.Repositories;
using MeetingTime.Domain.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RoomService.Services;
using Shared.Domain.Interfaces;
using Shared.Infrastructure.Extensions;
using System;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSharedInfrastructure(builder.Configuration);
builder.Services.AddScoped<IRoomRepository, RoomRepository>();

builder.Services.AddGrpc();

var app = builder.Build();

app.MapGrpcService<RoomGrpcService>();
app.MapGet("/", () => "Communication with gRPC endpoints must be made through a gRPC client. To learn how to create a client, visit: https://go.microsoft.com/fwlink/?linkid=2086909");

app.Run();
