using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Grpc.AspNetCore.Web;
using Protos;
using System.Text;
using ApiGateway.Proxy;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Net.WebSockets;
using Microsoft.AspNetCore.Authentication;
using Grpc.Core;
using System.Net;

var builder = WebApplication.CreateBuilder(args);

// Jwt Configuration
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["SecretKey"];
builder.Services.AddAuthentication(opt =>
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
    opt.Events = new JwtBearerEvents
    {
        OnTokenValidated = async ctx =>
        {
            var rawToken = ctx.Request
                .Headers["Authorization"].ToString()
                .Replace("Bearer", "", StringComparison.OrdinalIgnoreCase)
                .Trim();

            var authClient = ctx.HttpContext.RequestServices.GetRequiredService<Auth.AuthClient>();

            var validateReq = new ValidateRequest { Token = rawToken };
            var validRes = await authClient.ValidateAsync(validateReq);

            if (!validRes.IsValid)
            {
                ctx.Fail(validRes.Error);
            }
        }
    };
});

builder.Services.AddGrpc();

builder.Services.AddGrpcClient<Auth.AuthClient>(o =>
{
    o.Address = new Uri("http://authservice:8080");
});
builder.Services.AddGrpcClient<Room.RoomClient>(o =>
{
    o.Address = new Uri("http://roomservice:8080");
});
builder.Services.AddGrpcClient<Chat.ChatClient>(o =>
{
    o.Address = new Uri("http://chatservice:8080");
})
.ConfigureHttpClient(c =>
{
    c.DefaultRequestVersion = HttpVersion.Version20;
    c.DefaultVersionPolicy = HttpVersionPolicy.RequestVersionExact;
});

builder.Services.AddGrpc();

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

builder.Services.AddControllers();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(opt =>
{
    opt.AddPolicy("AllowAll", policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRouting();

app.UseCors("AllowAll");

app.UseWebSockets();

app.Use(async (context, next) =>
{
    try
    {
        if (context.Request.Path.StartsWithSegments("/ws/chat"))
        {
            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }

            //var validationResult = await context.AuthenticateAsync(JwtBearerDefaults.AuthenticationScheme);
            //if (!validationResult.Succeeded || validationResult.None)
            //{
            //    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            //    return;
            //}

            var rawToken = context.Request.Query["access_token"].FirstOrDefault();
            if (string.IsNullOrEmpty(rawToken))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return;
            }

            var authClient = context.RequestServices.GetRequiredService<Auth.AuthClient>();
            var validate = await authClient.ValidateAsync(new ValidateRequest { Token = rawToken });
            if (!validate.IsValid)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return;
            }

            // ChatService Proxy
            using var backend = new ClientWebSocket();
            await backend.ConnectAsync(new Uri("ws://chatservice:8081/ws/chat"), CancellationToken.None);

            using var frontend = await context.WebSockets.AcceptWebSocketAsync();
            await ProxyHelper.ProxyWebSocket(frontend, backend);
            return;
        }
        if (context.Request.Path.StartsWithSegments("/ws/mediaservice"))
        {
            if (context.WebSockets.IsWebSocketRequest)
            {
                if (!context.WebSockets.IsWebSocketRequest)
                {
                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    return;
                }

                //var validationResult = await context.AuthenticateAsync(JwtBearerDefaults.AuthenticationScheme);
                //if (!validationResult.Succeeded || validationResult.None)
                //{
                //    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                //    return;
                //}

                var rawToken = context.Request.Query["access_token"].FirstOrDefault();
                if (string.IsNullOrEmpty(rawToken))
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return;
                }

                var authClient = context.RequestServices.GetRequiredService<Auth.AuthClient>();
                var validate = await authClient.ValidateAsync(new ValidateRequest { Token = rawToken });
                if (!validate.IsValid)
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return;
                }

                using var backendSocket = new ClientWebSocket();
                //var wsBackendUri = new Uri("ws://63.178.115.77:3001");
                var wsBackendUri = new Uri("ws://mediaservice:3001");
                await backendSocket.ConnectAsync(wsBackendUri, CancellationToken.None);

                using var frontendSocket = await context.WebSockets.AcceptWebSocketAsync();
                await ProxyHelper.ProxyWebSocket(frontendSocket, backendSocket);
                return;
            }
        }
    } catch (Exception ex)
    {
        throw ex;
    }
    await next();
});

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapReverseProxy();
app.MapControllers();

await app.RunAsync();
