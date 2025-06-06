using MeetingTime.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MeetingTime.Domain.Data;

public class MeetingTimeContext : DbContext
{
    public MeetingTimeContext() { }

    public MeetingTimeContext(DbContextOptions<MeetingTimeContext> opt)
    : base(opt)
    { }

    public DbSet<RoomEntity> Rooms { get; set; }
}
