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
    public DbSet<RoomMemberEntity> RoomMembers => Set<RoomMemberEntity>();

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

        // RoomMember - composite PK
        builder.Entity<RoomMemberEntity>()
            .HasKey(rm => new { rm.RoomId, rm.UserId });

        // RoomMember - Room
        builder.Entity<RoomMemberEntity>()
            .HasOne(rm => rm.Room)
            .WithMany(r => r.Members)
            .HasForeignKey(rm => rm.RoomId)
            .OnDelete(DeleteBehavior.Cascade);

        // RoomMember - User
        builder.Entity<RoomMemberEntity>()
            .HasOne(rm => rm.User)
            .WithMany(u => u.RoomMemberships)
            .HasForeignKey(rm => rm.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
