namespace MeetingTime.Domain.Entities;

public class RoomEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; }
    public int MaxParticipiants { get; set; }

    public string Quality { get; set; }

    public string Password { get; set; }
}
