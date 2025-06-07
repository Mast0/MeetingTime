using MeetingTime.Domain.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Shared.Domain.Entities;

namespace MeetingTime.Domain.Data;

public class MeetingTimeContext : IdentityDbContext<UserEntity>
{
    public MeetingTimeContext() { }

    public MeetingTimeContext(DbContextOptions<MeetingTimeContext> opt)
    : base(opt)
    { }

    public DbSet<RoomEntity> Rooms => Set<RoomEntity>();
    public DbSet<ChatMessageEntity> ChatMessages => Set<ChatMessageEntity>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Room - ChatMessage
        builder.Entity<ChatMessageEntity>()
            .HasOne(cm => cm.Room)
            .WithMany(r => r.ChatMessages)
            .HasForeignKey(cm => cm.RoomId)
            .OnDelete(DeleteBehavior.Cascade);

        // ChatMessage - User
        builder.Entity<ChatMessageEntity>()
            .HasOne(cm => cm.Sender)
            .WithMany()
            .HasForeignKey(cm => cm.UserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
