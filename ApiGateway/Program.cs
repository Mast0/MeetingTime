using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Grpc.AspNetCore.Web;
using Protos;
using System.Text;
using ApiGateway.Proxy;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

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
            var token = ctx.SecurityToken as JwtSecurityToken;
            var rawToken = ctx.Request
                .Headers["Authorization"].ToString()
                .Replace("Bearer", "");

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
});

builder.Services.AddGrpc();

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

builder.Services.AddControllers();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRouting();

app.UseGrpcWeb(new GrpcWebOptions { DefaultEnabled = true });

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapReverseProxy();
app.MapGrpcService<ProxyToChatService>().EnableGrpcWeb();
app.MapControllers();

await app.RunAsync();
