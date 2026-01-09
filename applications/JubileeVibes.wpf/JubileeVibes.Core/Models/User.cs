namespace JubileeVibes.Core.Models;

public class User
{
    public string Id { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public SubscriptionType Subscription { get; set; } = SubscriptionType.Free;
    public string Country { get; set; } = "US";
    public DateTime CreatedAt { get; set; }
    public int FollowerCount { get; set; }
    public int FollowingCount { get; set; }
    public int PlaylistCount { get; set; }
}

public enum SubscriptionType
{
    Free,
    Premium,
    Family,
    Student
}
