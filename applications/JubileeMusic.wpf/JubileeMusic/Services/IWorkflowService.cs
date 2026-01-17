namespace JubileeMusic.Services;

public interface IWorkflowService
{
    SongWorkflow? LoadWorkflow(string workflowPath);
    SongWorkflow? LoadDefaultWorkflow();
    ParsedSongResult? ParseChatGptResponse(string response);
}

public class SongWorkflow
{
    public string Name { get; set; } = string.Empty;
    public string Version { get; set; } = "1.0";
    public string Description { get; set; } = string.Empty;
    public string Prompt { get; set; } = string.Empty;
    public bool AutoSubmit { get; set; } = true;
    public int ResponseTimeoutSeconds { get; set; } = 120;
}

public class ParsedSongResult
{
    public string? Workspace { get; set; }
    public string? Title { get; set; }
    public string? Styles { get; set; }
    public string? Gender { get; set; }
    public string? Weirdness { get; set; }
    public string? StyleInfluence { get; set; }
    public string? Lyrics { get; set; }
    public bool IsComplete => !string.IsNullOrWhiteSpace(Title) &&
                               !string.IsNullOrWhiteSpace(Styles) &&
                               !string.IsNullOrWhiteSpace(Lyrics);
}
