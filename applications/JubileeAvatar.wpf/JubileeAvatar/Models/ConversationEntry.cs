using System.Windows.Media;

namespace JubileeAvatar.Models
{
    public class ConversationEntry
    {
        public string Role { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string Timestamp { get; set; } = string.Empty;
        public Brush RoleColor { get; set; } = Brushes.White;
    }
}
