using System.IO;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace JubileeMusic.Services;

public class WorkflowService : IWorkflowService
{
    private readonly ILogger<WorkflowService> _logger;
    private const string DefaultWorkflowFileName = "song-generation.yaml";

    public WorkflowService(ILogger<WorkflowService> logger)
    {
        _logger = logger;
    }

    public SongWorkflow? LoadDefaultWorkflow()
    {
        var appDir = AppDomain.CurrentDomain.BaseDirectory;
        var workflowPath = Path.Combine(appDir, "workflow", DefaultWorkflowFileName);

        if (!File.Exists(workflowPath))
        {
            _logger.LogWarning("Default workflow file not found at: {Path}", workflowPath);
            return null;
        }

        return LoadWorkflow(workflowPath);
    }

    public SongWorkflow? LoadWorkflow(string workflowPath)
    {
        try
        {
            if (!File.Exists(workflowPath))
            {
                _logger.LogError("Workflow file not found: {Path}", workflowPath);
                return null;
            }

            var yamlContent = File.ReadAllText(workflowPath);
            var deserializer = new DeserializerBuilder()
                .WithNamingConvention(UnderscoredNamingConvention.Instance)
                .IgnoreUnmatchedProperties()
                .Build();

            var yamlDoc = deserializer.Deserialize<Dictionary<string, object>>(yamlContent);

            var workflow = new SongWorkflow();

            // Parse workflow section
            if (yamlDoc.TryGetValue("workflow", out var workflowSection) && workflowSection is Dictionary<object, object> wf)
            {
                if (wf.TryGetValue("name", out var name))
                    workflow.Name = name?.ToString() ?? string.Empty;
                if (wf.TryGetValue("version", out var version))
                    workflow.Version = version?.ToString() ?? "1.0";
                if (wf.TryGetValue("description", out var desc))
                    workflow.Description = desc?.ToString() ?? string.Empty;
            }

            // Parse prompt
            if (yamlDoc.TryGetValue("prompt", out var prompt))
            {
                workflow.Prompt = prompt?.ToString() ?? string.Empty;
            }

            // Parse settings
            if (yamlDoc.TryGetValue("settings", out var settingsSection) && settingsSection is Dictionary<object, object> settings)
            {
                if (settings.TryGetValue("auto_submit", out var autoSubmit))
                    workflow.AutoSubmit = autoSubmit?.ToString()?.ToLower() == "true";
                if (settings.TryGetValue("response_timeout_seconds", out var timeout) && int.TryParse(timeout?.ToString(), out var timeoutValue))
                    workflow.ResponseTimeoutSeconds = timeoutValue;
            }

            _logger.LogInformation("Loaded workflow: {Name} v{Version}", workflow.Name, workflow.Version);
            return workflow;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load workflow from: {Path}", workflowPath);
            return null;
        }
    }

    public ParsedSongResult? ParseChatGptResponse(string response)
    {
        if (string.IsNullOrWhiteSpace(response))
        {
            _logger.LogWarning("Empty response received from ChatGPT");
            return null;
        }

        try
        {
            var result = new ParsedSongResult();

            // Parse Workspace - look for "Workspace:" followed by the value
            var workspaceMatch = Regex.Match(response, @"Workspace:\s*(.+?)(?=\n|Title:|$)", RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (workspaceMatch.Success)
            {
                result.Workspace = workspaceMatch.Groups[1].Value.Trim().Trim('"', '*');
                _logger.LogDebug("Parsed Workspace: {Workspace}", result.Workspace);
            }

            // Parse Title - look for "Title:" followed by the value
            var titleMatch = Regex.Match(response, @"Title:\s*(.+?)(?=\n|Styles:|$)", RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (titleMatch.Success)
            {
                result.Title = titleMatch.Groups[1].Value.Trim().Trim('"', '*');
                _logger.LogDebug("Parsed Title: {Title}", result.Title);
            }

            // Parse Styles - look for "Styles:" followed by the value
            var stylesMatch = Regex.Match(response, @"Styles:\s*(.+?)(?=\n\n|Gender:|Lyrics:|$)", RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (stylesMatch.Success)
            {
                result.Styles = stylesMatch.Groups[1].Value.Trim().Trim('"', '*');
                _logger.LogDebug("Parsed Styles: {Styles}", result.Styles);
            }

            // Parse Gender - look for "Gender:" followed by the value
            var genderMatch = Regex.Match(response, @"Gender:\s*(.+?)(?=\n|Weirdness:|Lyrics:|$)", RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (genderMatch.Success)
            {
                result.Gender = genderMatch.Groups[1].Value.Trim().Trim('"', '*');
                _logger.LogDebug("Parsed Gender: {Gender}", result.Gender);
            }

            // Parse Weirdness - look for "Weirdness:" followed by the value
            var weirdnessMatch = Regex.Match(response, @"Weirdness:\s*(.+?)(?=\n|Style Influence:|Lyrics:|$)", RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (weirdnessMatch.Success)
            {
                result.Weirdness = weirdnessMatch.Groups[1].Value.Trim().Trim('"', '*');
                _logger.LogDebug("Parsed Weirdness: {Weirdness}", result.Weirdness);
            }

            // Parse Style Influence - look for "Style Influence:" followed by the value
            var styleInfluenceMatch = Regex.Match(response, @"Style Influence:\s*(.+?)(?=\n|Lyrics:|$)", RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (styleInfluenceMatch.Success)
            {
                result.StyleInfluence = styleInfluenceMatch.Groups[1].Value.Trim().Trim('"', '*');
                _logger.LogDebug("Parsed StyleInfluence: {StyleInfluence}", result.StyleInfluence);
            }

            // Parse Lyrics - look for "Lyrics:" followed by everything after
            var lyricsMatch = Regex.Match(response, @"Lyrics:\s*([\s\S]+)$", RegexOptions.IgnoreCase);
            if (lyricsMatch.Success)
            {
                result.Lyrics = lyricsMatch.Groups[1].Value.Trim();
                _logger.LogDebug("Parsed Lyrics length: {Length} chars", result.Lyrics?.Length ?? 0);
            }

            if (result.IsComplete)
            {
                _logger.LogInformation("Successfully parsed complete song result");
            }
            else
            {
                _logger.LogWarning("Incomplete song result - Title: {HasTitle}, Styles: {HasStyles}, Lyrics: {HasLyrics}",
                    !string.IsNullOrWhiteSpace(result.Title),
                    !string.IsNullOrWhiteSpace(result.Styles),
                    !string.IsNullOrWhiteSpace(result.Lyrics));
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse ChatGPT response");
            return null;
        }
    }
}
