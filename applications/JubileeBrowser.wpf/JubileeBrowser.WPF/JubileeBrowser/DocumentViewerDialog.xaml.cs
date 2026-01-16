using System;
using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace JubileeBrowser;

/// <summary>
/// Document types that can be displayed.
/// </summary>
public enum DocumentType
{
    TermsOfUse,
    PrivacyPolicy
}

/// <summary>
/// YAML document structure for legal documents.
/// </summary>
public class LegalDocument
{
    public string Title { get; set; } = "";
    public string LastUpdated { get; set; } = "";
    public List<DocumentSection> Sections { get; set; } = new();
}

public class DocumentSection
{
    public string Heading { get; set; } = "";
    public string Content { get; set; } = "";
}

/// <summary>
/// Custom themed document viewer dialog for Terms of Use and Privacy Policy.
/// Loads content from embedded YAML files and displays in a scrollable view.
/// </summary>
public partial class DocumentViewerDialog : Window
{
    /// <summary>
    /// Creates a new DocumentViewerDialog for the specified document type.
    /// </summary>
    public DocumentViewerDialog(DocumentType documentType)
    {
        InitializeComponent();

        PreviewKeyDown += Dialog_PreviewKeyDown;

        Loaded += (s, e) =>
        {
            OkButton.Focus();
            PlayOpenAnimation();
            LoadDocument(documentType);
        };
    }

    private void LoadDocument(DocumentType documentType)
    {
        try
        {
            string resourceName = documentType switch
            {
                DocumentType.TermsOfUse => "JubileeBrowser.Resources.termsofuse.yaml",
                DocumentType.PrivacyPolicy => "JubileeBrowser.Resources.privacypolicy.yaml",
                _ => throw new ArgumentException("Unknown document type")
            };

            var assembly = Assembly.GetExecutingAssembly();
            using var stream = assembly.GetManifestResourceStream(resourceName);

            if (stream == null)
            {
                ShowError($"Could not load document resource: {resourceName}");
                return;
            }

            using var reader = new StreamReader(stream);
            var yamlContent = reader.ReadToEnd();

            var deserializer = new DeserializerBuilder()
                .WithNamingConvention(CamelCaseNamingConvention.Instance)
                .Build();

            var document = deserializer.Deserialize<LegalDocument>(yamlContent);

            DisplayDocument(document);
        }
        catch (Exception ex)
        {
            ShowError($"Failed to load document: {ex.Message}");
        }
    }

    private void DisplayDocument(LegalDocument document)
    {
        TitleText.Text = document.Title;
        Title = document.Title;

        if (!string.IsNullOrEmpty(document.LastUpdated))
        {
            LastUpdatedText.Text = $"Last updated: {document.LastUpdated}";
        }

        ContentPanel.Children.Clear();

        foreach (var section in document.Sections)
        {
            // Section heading
            var headingBlock = new TextBlock
            {
                Text = section.Heading,
                Foreground = new SolidColorBrush(Color.FromRgb(230, 172, 0)), // Gold
                FontSize = 14,
                FontWeight = FontWeights.SemiBold,
                Margin = new Thickness(0, 16, 0, 8),
                TextWrapping = TextWrapping.Wrap
            };
            ContentPanel.Children.Add(headingBlock);

            // Section content - process line by line for better formatting
            var contentLines = section.Content.Trim().Split('\n');
            var contentPanel = new StackPanel { Margin = new Thickness(0, 0, 0, 8) };

            foreach (var line in contentLines)
            {
                var trimmedLine = line.TrimEnd();

                if (string.IsNullOrWhiteSpace(trimmedLine))
                {
                    // Empty line - add spacing
                    contentPanel.Children.Add(new Border { Height = 8 });
                    continue;
                }

                // Check if it's a bullet point
                bool isBullet = trimmedLine.TrimStart().StartsWith("•") ||
                               trimmedLine.TrimStart().StartsWith("-") ||
                               trimmedLine.TrimStart().StartsWith("*");

                var textBlock = new TextBlock
                {
                    Text = trimmedLine,
                    Foreground = new SolidColorBrush(Color.FromRgb(200, 200, 210)),
                    FontSize = 13,
                    LineHeight = 20,
                    TextWrapping = TextWrapping.Wrap,
                    Margin = isBullet ? new Thickness(12, 2, 0, 2) : new Thickness(0, 2, 0, 2)
                };

                // Check for subheadings (lines ending with colon)
                if (trimmedLine.EndsWith(":") && !trimmedLine.Contains("•"))
                {
                    textBlock.Foreground = new SolidColorBrush(Color.FromRgb(230, 230, 242));
                    textBlock.FontWeight = FontWeights.Medium;
                    textBlock.Margin = new Thickness(0, 8, 0, 4);
                }

                contentPanel.Children.Add(textBlock);
            }

            ContentPanel.Children.Add(contentPanel);
        }

        // Scroll to top
        ContentScrollViewer.ScrollToTop();
    }

    private void ShowError(string message)
    {
        ContentPanel.Children.Clear();

        var errorBlock = new TextBlock
        {
            Text = message,
            Foreground = new SolidColorBrush(Color.FromRgb(255, 107, 107)),
            FontSize = 14,
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 20, 0, 0)
        };

        ContentPanel.Children.Add(errorBlock);
    }

    private void PlayOpenAnimation()
    {
        var fadeIn = new DoubleAnimation
        {
            From = 0,
            To = 1,
            Duration = TimeSpan.FromMilliseconds(150),
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
        };

        var scaleX = new DoubleAnimation
        {
            From = 0.95,
            To = 1,
            Duration = TimeSpan.FromMilliseconds(200),
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
        };

        var scaleY = new DoubleAnimation
        {
            From = 0.95,
            To = 1,
            Duration = TimeSpan.FromMilliseconds(200),
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
        };

        if (RenderTransform == null || RenderTransform is not ScaleTransform)
        {
            RenderTransform = new ScaleTransform(1, 1);
            RenderTransformOrigin = new Point(0.5, 0.5);
        }

        BeginAnimation(OpacityProperty, fadeIn);
        ((ScaleTransform)RenderTransform).BeginAnimation(ScaleTransform.ScaleXProperty, scaleX);
        ((ScaleTransform)RenderTransform).BeginAnimation(ScaleTransform.ScaleYProperty, scaleY);
    }

    private void PlayCloseAnimation(Action onComplete)
    {
        var fadeOut = new DoubleAnimation
        {
            From = 1,
            To = 0,
            Duration = TimeSpan.FromMilliseconds(100),
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn }
        };

        fadeOut.Completed += (s, e) => onComplete();
        BeginAnimation(OpacityProperty, fadeOut);
    }

    private void Dialog_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape)
        {
            e.Handled = true;
            CloseDialog();
        }
    }

    private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ClickCount == 1)
        {
            DragMove();
        }
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        CloseDialog();
    }

    private void OkButton_Click(object sender, RoutedEventArgs e)
    {
        CloseDialog();
    }

    private void CloseDialog()
    {
        PlayCloseAnimation(() =>
        {
            try
            {
                DialogResult = true;
            }
            catch (InvalidOperationException)
            {
                // DialogResult can only be set when shown via ShowDialog()
            }
            Close();
        });
    }

    /// <summary>
    /// Shows the Terms of Use document.
    /// </summary>
    public static void ShowTermsOfUse(Window owner)
    {
        Show(owner, DocumentType.TermsOfUse);
    }

    /// <summary>
    /// Shows the Privacy Policy document.
    /// </summary>
    public static void ShowPrivacyPolicy(Window owner)
    {
        Show(owner, DocumentType.PrivacyPolicy);
    }

    /// <summary>
    /// Shows the specified document.
    /// </summary>
    public static void Show(Window owner, DocumentType documentType)
    {
        var dialog = new DocumentViewerDialog(documentType);

        if (owner != null)
        {
            dialog.Owner = owner;
        }

        dialog.ShowDialog();
    }
}
