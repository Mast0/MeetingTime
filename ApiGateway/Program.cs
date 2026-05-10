using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Protos;
using System.Text;
using System.Net;
using Microsoft.IdentityModel.JsonWebTokens;
using Shared.Infrastructure.Logging;
using Serilog;

var builder = WebApplication.CreateBuilder(args);
builder.AddSerilogLogging("ApiGateway");

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
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];

            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) &&
                (path.StartsWithSegments("/ws/chat") || path.StartsWithSegments("/ws/mediaservice")))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        },
        OnTokenValidated = async ctx =>
        {
            var jwt = ctx.SecurityToken as JsonWebToken;
            var rawToken = jwt?.EncodedToken;

            if (string.IsNullOrEmpty(rawToken))
            {
                if (ctx.Request.Query.ContainsKey("access_token"))
                {
                    rawToken = ctx.Request.Query["access_token"];
                }
                else
                {
                    rawToken = ctx.Request.Headers["Authorization"].ToString()
                        .Replace("Bearer", "", StringComparison.OrdinalIgnoreCase)
                        .Trim();
                }
            }

            if (string.IsNullOrEmpty(rawToken))
            {
                ctx.Fail("Token not found");
                return;
            }

            // Guest tokens are stateless — skip blacklist validation
            var roleClaim = ctx.Principal?.FindFirst("role")?.Value;
            if (string.Equals(roleClaim, "guest", StringComparison.OrdinalIgnoreCase))
                return;

            try
            {
                var authClient = ctx.HttpContext.RequestServices.GetRequiredService<Auth.AuthClient>();

                var validateReq = new ValidateRequest { Token = rawToken };
                var validRes = await authClient.ValidateAsync(validateReq);

                if (!validRes.IsValid)
                {
                    ctx.Fail(validRes.Error);
                }
            }
            catch (Exception ex)
            {
                ctx.Fail($"Auth validation failed: {ex.Message}");
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

app.UseSerilogRequestLogging();
app.UseWebSockets();
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

app.MapReverseProxy();
app.MapControllers();

try
{
    await app.RunAsync();
}
finally
{
    Log.CloseAndFlush();
}
