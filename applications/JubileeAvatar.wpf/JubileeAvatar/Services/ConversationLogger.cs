using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Newtonsoft.Json;
using JubileeAvatar.Models;

namespace JubileeAvatar.Services
{
    public class ConversationLogger : IConversationLogger
    {
        private readonly List<LogEntry> _entries = new();

        public void Log(ConversationEntry entry)
        {
            _entries.Add(new LogEntry
            {
                Role = entry.Role,
                Message = entry.Message,
                Timestamp = DateTime.Now
            });
        }

        public async Task ExportAsync(string filePath)
        {
            var extension = Path.GetExtension(filePath).ToLower();

            if (extension == ".json")
            {
                var json = JsonConvert.SerializeObject(new
                {
                    ExportedAt = DateTime.Now,
                    Entries = _entries
                }, Formatting.Indented);

                await File.WriteAllTextAsync(filePath, json);
            }
            else
            {
                var lines = new List<string>
                {
                    "Jubilee Avatar - Conversation Log",
                    $"Exported: {DateTime.Now:yyyy-MM-dd HH:mm:ss}",
                    new string('=', 50),
                    ""
                };

                foreach (var entry in _entries)
                {
                    lines.Add($"[{entry.Timestamp:HH:mm:ss}] {entry.Role}: {entry.Message}");
                    lines.Add("");
                }

                await File.WriteAllLinesAsync(filePath, lines);
            }
        }

        public void Clear()
        {
            _entries.Clear();
        }

        private class LogEntry
        {
            public string Role { get; set; } = string.Empty;
            public string Message { get; set; } = string.Empty;
            public DateTime Timestamp { get; set; }
        }
    }
}
