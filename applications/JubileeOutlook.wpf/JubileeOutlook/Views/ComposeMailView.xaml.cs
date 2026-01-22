using System.IO;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Microsoft.Win32;
using JubileeOutlook.ViewModels;
using JubileeOutlook.Views;

namespace JubileeOutlook.Views;

public partial class ComposeMailView : UserControl
{
    public ComposeMailView()
    {
        InitializeComponent();

        // Add keyboard shortcuts
        MessageBodyEditor.PreviewKeyDown += MessageBodyEditor_PreviewKeyDown;

        // Sync RichTextBox content to ViewModel when text changes
        MessageBodyEditor.TextChanged += MessageBodyEditor_TextChanged;

        // Subscribe to DataContext changes
        DataContextChanged += OnDataContextChanged;
    }

    /// <summary>
    /// Syncs the RichTextBox content to the ViewModel's Body property as HTML
    /// </summary>
    private void MessageBodyEditor_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (DataContext is ComposeMailViewModel viewModel)
        {
            // Clear previous embedded images
            viewModel.EmbeddedImages.Clear();

            // Convert FlowDocument to HTML for proper formatting support
            var htmlBody = ConvertFlowDocumentToHtml(MessageBodyEditor.Document, viewModel.EmbeddedImages);
            viewModel.SetBodyContent(htmlBody);
        }
    }

    /// <summary>
    /// Converts a FlowDocument to HTML string preserving formatting
    /// </summary>
    private string ConvertFlowDocumentToHtml(FlowDocument document, List<EmbeddedImageData> embeddedImages)
    {
        var html = new StringBuilder();

        foreach (var block in document.Blocks)
        {
            if (block is Paragraph paragraph)
            {
                html.Append("<p>");
                html.Append(ConvertInlinesToHtml(paragraph.Inlines, embeddedImages));
                html.Append("</p>");
            }
            else if (block is List list)
            {
                var listTag = list.MarkerStyle == TextMarkerStyle.Decimal ? "ol" : "ul";
                html.Append($"<{listTag}>");
                foreach (var listItem in list.ListItems)
                {
                    html.Append("<li>");
                    foreach (var listBlock in listItem.Blocks)
                    {
                        if (listBlock is Paragraph listParagraph)
                        {
                            html.Append(ConvertInlinesToHtml(listParagraph.Inlines, embeddedImages));
                        }
                    }
                    html.Append("</li>");
                }
                html.Append($"</{listTag}>");
            }
        }

        var result = html.ToString().Trim();
        // Return empty string if content is just empty paragraph tags
        if (result == "<p></p>" || string.IsNullOrWhiteSpace(result))
            return string.Empty;

        return result;
    }

    /// <summary>
    /// Converts Inline elements to HTML with formatting
    /// </summary>
    private string ConvertInlinesToHtml(InlineCollection inlines, List<EmbeddedImageData> embeddedImages)
    {
        var html = new StringBuilder();

        foreach (var inline in inlines)
        {
            if (inline is Run run)
            {
                var text = run.Text;
                if (string.IsNullOrEmpty(text)) continue;

                // Check formatting
                var isBold = run.FontWeight == FontWeights.Bold;
                var isItalic = run.FontStyle == FontStyles.Italic;
                var isUnderline = run.TextDecorations != null && run.TextDecorations.Contains(TextDecorations.Underline[0]);

                // Apply formatting tags
                if (isBold) html.Append("<strong>");
                if (isItalic) html.Append("<em>");
                if (isUnderline) html.Append("<u>");

                // HTML encode the text
                html.Append(System.Web.HttpUtility.HtmlEncode(text));

                // Close tags in reverse order
                if (isUnderline) html.Append("</u>");
                if (isItalic) html.Append("</em>");
                if (isBold) html.Append("</strong>");
            }
            else if (inline is Span span)
            {
                // Recursively process spans
                html.Append(ConvertInlinesToHtml(span.Inlines, embeddedImages));
            }
            else if (inline is LineBreak)
            {
                html.Append("<br/>");
            }
            else if (inline is InlineUIContainer container)
            {
                // Handle embedded images using CID references
                if (container.Child is Image image)
                {
                    // Get file path from Tag property
                    var filePath = image.Tag as string;
                    if (!string.IsNullOrEmpty(filePath) && File.Exists(filePath))
                    {
                        // Generate a unique Content-ID for this image
                        var contentId = $"img_{Guid.NewGuid():N}";
                        var fileName = Path.GetFileName(filePath);

                        // Add to embedded images list
                        embeddedImages.Add(new EmbeddedImageData
                        {
                            ContentId = contentId,
                            FilePath = filePath,
                            FileName = fileName
                        });

                        // Use CID reference in HTML
                        html.Append($"<img src=\"cid:{contentId}\" style=\"max-width:600px;\" />");
                    }
                }
            }
        }

        return html.ToString();
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        // Unsubscribe from old view model
        if (e.OldValue is ComposeMailViewModel oldViewModel)
        {
            oldViewModel.AttachmentRequested -= OnAttachmentRequested;
            oldViewModel.Attachments.CollectionChanged -= OnAttachmentsCollectionChanged;
            oldViewModel.PropertyChanged -= OnViewModelPropertyChanged;
        }

        // Subscribe to new view model
        if (e.NewValue is ComposeMailViewModel newViewModel)
        {
            newViewModel.AttachmentRequested += OnAttachmentRequested;
            newViewModel.Attachments.CollectionChanged += OnAttachmentsCollectionChanged;
            newViewModel.PropertyChanged += OnViewModelPropertyChanged;
        }
    }

    private void OnViewModelPropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
    {
        // When IsComposing changes to true, clear the RichTextBox to ensure fresh state
        if (e.PropertyName == nameof(ComposeMailViewModel.IsComposing) &&
            sender is ComposeMailViewModel viewModel &&
            viewModel.IsComposing)
        {
            ClearMessageBody();
        }
    }

    /// <summary>
    /// Clears the RichTextBox content to ensure a fresh compose state
    /// </summary>
    public void ClearMessageBody()
    {
        if (MessageBodyEditor != null)
        {
            MessageBodyEditor.Document.Blocks.Clear();
            MessageBodyEditor.Document.Blocks.Add(new Paragraph());
        }

        // Also ensure attachments section is hidden
        if (AttachmentsSection != null)
        {
            AttachmentsSection.Visibility = Visibility.Collapsed;
        }

        // Reset formatting toolbar to collapsed
        if (FormattingToolbar != null)
        {
            FormattingToolbar.Visibility = Visibility.Collapsed;
        }
    }

    /// <summary>
    /// Sets the body content for reply/forward operations
    /// </summary>
    /// <param name="bodyText">The text content to display (can contain newlines or HTML)</param>
    public void SetBodyContent(string bodyText)
    {
        if (MessageBodyEditor == null || string.IsNullOrEmpty(bodyText)) return;

        MessageBodyEditor.Document.Blocks.Clear();

        // Check if content is HTML and convert to plain text
        var displayText = bodyText;
        if (bodyText.Contains("<") && bodyText.Contains(">"))
        {
            displayText = ConvertHtmlToPlainText(bodyText);
        }

        // Split by newlines and create paragraphs
        var lines = displayText.Split(new[] { "\r\n", "\n", "\r" }, StringSplitOptions.None);
        foreach (var line in lines)
        {
            var paragraph = new Paragraph(new Run(line));
            MessageBodyEditor.Document.Blocks.Add(paragraph);
        }

        // Move cursor to the beginning (so user can type their reply before the quoted text)
        MessageBodyEditor.CaretPosition = MessageBodyEditor.Document.ContentStart;
        MessageBodyEditor.Focus();
    }

    /// <summary>
    /// Converts HTML content to plain text for display in RichTextBox
    /// </summary>
    private string ConvertHtmlToPlainText(string html)
    {
        if (string.IsNullOrEmpty(html)) return string.Empty;

        var text = html;

        // Remove inline images (data:image/...) - they're too long to display
        text = System.Text.RegularExpressions.Regex.Replace(text, @"<img[^>]*src=""data:image[^""]*""[^>]*>", "[Image]", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        // Replace common HTML entities
        text = text.Replace("&nbsp;", " ");
        text = text.Replace("&amp;", "&");
        text = text.Replace("&lt;", "<");
        text = text.Replace("&gt;", ">");
        text = text.Replace("&quot;", "\"");
        text = text.Replace("&apos;", "'");

        // Replace <br>, <br/>, <br /> with newlines
        text = System.Text.RegularExpressions.Regex.Replace(text, @"<br\s*/?>", "\n", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        // Replace block-level elements with newlines
        text = System.Text.RegularExpressions.Regex.Replace(text, @"</p>|</div>|</li>|</tr>", "\n", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        text = System.Text.RegularExpressions.Regex.Replace(text, @"<p[^>]*>|<div[^>]*>|<li[^>]*>|<tr[^>]*>", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        // Handle headers
        text = System.Text.RegularExpressions.Regex.Replace(text, @"</h[1-6]>", "\n\n", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        text = System.Text.RegularExpressions.Regex.Replace(text, @"<h[1-6][^>]*>", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        // Remove all remaining HTML tags
        text = System.Text.RegularExpressions.Regex.Replace(text, @"<[^>]+>", "");

        // Decode any remaining HTML entities
        text = System.Net.WebUtility.HtmlDecode(text);

        // Normalize multiple newlines to maximum of two
        text = System.Text.RegularExpressions.Regex.Replace(text, @"\n{3,}", "\n\n");

        // Trim leading/trailing whitespace from each line while preserving structure
        var lines = text.Split('\n');
        for (int i = 0; i < lines.Length; i++)
        {
            lines[i] = lines[i].Trim();
        }
        text = string.Join("\n", lines);

        return text.Trim();
    }

    /// <summary>
    /// Shows the attachments section (for forward operations with attachments)
    /// </summary>
    public void ShowAttachmentsSection()
    {
        if (AttachmentsSection != null)
        {
            AttachmentsSection.Visibility = Visibility.Visible;
        }
    }

    private void OnAttachmentRequested(object? sender, EventArgs e)
    {
        var openFileDialog = new OpenFileDialog
        {
            Title = "Select files to attach",
            Multiselect = true,
            Filter = "All Files (*.*)|*.*"
        };

        if (openFileDialog.ShowDialog() == true)
        {
            if (DataContext is ComposeMailViewModel viewModel)
            {
                foreach (var filePath in openFileDialog.FileNames)
                {
                    viewModel.AddAttachment(filePath);
                }
            }
        }
    }

    private void OnAttachmentsCollectionChanged(object? sender, System.Collections.Specialized.NotifyCollectionChangedEventArgs e)
    {
        // Show/hide attachments section based on whether there are attachments
        if (DataContext is ComposeMailViewModel viewModel)
        {
            AttachmentsSection.Visibility = viewModel.Attachments.Count > 0
                ? Visibility.Visible
                : Visibility.Collapsed;
        }
    }

    private void MessageBodyEditor_PreviewKeyDown(object sender, System.Windows.Input.KeyEventArgs e)
    {
        if (e.Key == System.Windows.Input.Key.B && (System.Windows.Input.Keyboard.Modifiers & System.Windows.Input.ModifierKeys.Control) == System.Windows.Input.ModifierKeys.Control)
        {
            ToggleBold();
            e.Handled = true;
        }
        else if (e.Key == System.Windows.Input.Key.I && (System.Windows.Input.Keyboard.Modifiers & System.Windows.Input.ModifierKeys.Control) == System.Windows.Input.ModifierKeys.Control)
        {
            ToggleItalic();
            e.Handled = true;
        }
        else if (e.Key == System.Windows.Input.Key.U && (System.Windows.Input.Keyboard.Modifiers & System.Windows.Input.ModifierKeys.Control) == System.Windows.Input.ModifierKeys.Control)
        {
            ToggleUnderline();
            e.Handled = true;
        }
    }

    private void BoldButton_Click(object sender, RoutedEventArgs e)
    {
        ToggleBold();
    }

    private void ItalicButton_Click(object sender, RoutedEventArgs e)
    {
        ToggleItalic();
    }

    private void UnderlineButton_Click(object sender, RoutedEventArgs e)
    {
        ToggleUnderline();
    }

    private void AlignLeftButton_Click(object sender, RoutedEventArgs e)
    {
        SetTextAlignment(TextAlignment.Left);
    }

    private void AlignCenterButton_Click(object sender, RoutedEventArgs e)
    {
        SetTextAlignment(TextAlignment.Center);
    }

    private void AlignRightButton_Click(object sender, RoutedEventArgs e)
    {
        SetTextAlignment(TextAlignment.Right);
    }

    private void BulletListButton_Click(object sender, RoutedEventArgs e)
    {
        ToggleList(TextMarkerStyle.Disc);
    }

    private void NumberedListButton_Click(object sender, RoutedEventArgs e)
    {
        ToggleList(TextMarkerStyle.Decimal);
    }

    private void FormattingButton_Click(object sender, RoutedEventArgs e)
    {
        // Toggle the formatting toolbar visibility
        if (FormattingToolbar != null)
        {
            FormattingToolbar.Visibility = FormattingToolbar.Visibility == Visibility.Visible
                ? Visibility.Collapsed
                : Visibility.Visible;
        }
    }

    private void ToggleBold()
    {
        var selection = MessageBodyEditor.Selection;
        if (!selection.IsEmpty)
        {
            var currentValue = selection.GetPropertyValue(TextElement.FontWeightProperty);
            var newValue = (currentValue as FontWeight?)?.Equals(FontWeights.Bold) == true
                ? FontWeights.Normal
                : FontWeights.Bold;
            selection.ApplyPropertyValue(TextElement.FontWeightProperty, newValue);
        }
        MessageBodyEditor.Focus();
    }

    private void ToggleItalic()
    {
        var selection = MessageBodyEditor.Selection;
        if (!selection.IsEmpty)
        {
            var currentValue = selection.GetPropertyValue(TextElement.FontStyleProperty);
            var newValue = (currentValue as FontStyle?)?.Equals(FontStyles.Italic) == true
                ? FontStyles.Normal
                : FontStyles.Italic;
            selection.ApplyPropertyValue(TextElement.FontStyleProperty, newValue);
        }
        MessageBodyEditor.Focus();
    }

    private void ToggleUnderline()
    {
        var selection = MessageBodyEditor.Selection;
        if (!selection.IsEmpty)
        {
            var currentValue = selection.GetPropertyValue(Inline.TextDecorationsProperty);
            var newValue = currentValue == TextDecorations.Underline
                ? null
                : TextDecorations.Underline;
            selection.ApplyPropertyValue(Inline.TextDecorationsProperty, newValue);
        }
        MessageBodyEditor.Focus();
    }

    private void SetTextAlignment(TextAlignment alignment)
    {
        var selection = MessageBodyEditor.Selection;
        if (!selection.IsEmpty)
        {
            selection.ApplyPropertyValue(Paragraph.TextAlignmentProperty, alignment);
        }
        else
        {
            // Apply to current paragraph
            var caretPosition = MessageBodyEditor.CaretPosition;
            var paragraph = caretPosition.Paragraph;
            if (paragraph != null)
            {
                paragraph.TextAlignment = alignment;
            }
        }
        MessageBodyEditor.Focus();
    }

    private void ToggleList(TextMarkerStyle markerStyle)
    {
        var selection = MessageBodyEditor.Selection;
        var startParagraph = selection.Start.Paragraph;
        var endParagraph = selection.End.Paragraph;

        if (startParagraph != null && endParagraph != null)
        {
            var parent = startParagraph.Parent;

            if (parent is ListItem)
            {
                // Remove from list
                var listItem = (ListItem)parent;
                var list = listItem.List;
                object? listParent = list?.Parent;

                if (list != null)
                {
                    var itemsToRemove = new System.Collections.Generic.List<Block>();
                    foreach (var item in list.ListItems)
                    {
                        itemsToRemove.AddRange(item.Blocks);
                    }

                    list.ListItems.Clear();

                    if (listParent is FlowDocument doc)
                    {
                        var listIndex = doc.Blocks.ToList().IndexOf(list);
                        doc.Blocks.Remove(list);
                        foreach (var block in itemsToRemove)
                        {
                            doc.Blocks.InsertBefore(doc.Blocks.ElementAt(listIndex), block);
                        }
                    }
                }
            }
            else
            {
                // Create list
                var document = MessageBodyEditor.Document;
                var paragraphsToList = new System.Collections.Generic.List<Paragraph>();

                var currentBlock = startParagraph as Block;
                while (currentBlock != null && currentBlock != endParagraph?.NextBlock)
                {
                    if (currentBlock is Paragraph p)
                    {
                        paragraphsToList.Add(p);
                    }
                    currentBlock = currentBlock.NextBlock;
                }

                if (paragraphsToList.Count > 0)
                {
                    var list = new List { MarkerStyle = markerStyle };
                    var firstParagraph = paragraphsToList[0];

                    document.Blocks.InsertBefore(firstParagraph, list);

                    foreach (var p in paragraphsToList)
                    {
                        document.Blocks.Remove(p);
                        var listItem = new ListItem(new Paragraph(new Run(new TextRange(p.ContentStart, p.ContentEnd).Text)));
                        list.ListItems.Add(listItem);
                    }
                }
            }
        }

        MessageBodyEditor.Focus();
    }

    private void InsertLinkButton_Click(object sender, RoutedEventArgs e)
    {
        var selection = MessageBodyEditor.Selection;
        if (selection.IsEmpty)
        {
            MessageDialog.ShowInfo(Window.GetWindow(this), "Please select text to convert to a hyperlink.", "No Text Selected");
            return;
        }

        // Create a simple input dialog for the URL
        var linkDialog = new Window
        {
            Title = "Insert Hyperlink",
            Width = 450,
            Height = 200,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Owner = Window.GetWindow(this),
            Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#1A1A1A")),
            WindowStyle = WindowStyle.ToolWindow,
            ResizeMode = ResizeMode.NoResize
        };

        var grid = new Grid { Margin = new Thickness(20) };
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        var label = new TextBlock
        {
            Text = "Enter URL:",
            Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#EEEEEE")),
            FontSize = 13,
            Margin = new Thickness(0, 0, 0, 8)
        };
        Grid.SetRow(label, 0);

        var urlTextBox = new TextBox
        {
            Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#252525")),
            Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#EEEEEE")),
            BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#333333")),
            BorderThickness = new Thickness(1),
            Padding = new Thickness(8),
            FontSize = 13,
            Text = "https://"
        };
        Grid.SetRow(urlTextBox, 1);

        var buttonPanel = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Margin = new Thickness(0, 20, 0, 0)
        };
        Grid.SetRow(buttonPanel, 4);

        var okButton = new Button
        {
            Content = "OK",
            Width = 80,
            Height = 32,
            Margin = new Thickness(0, 0, 8, 0),
            Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#B8860B")),
            Foreground = new SolidColorBrush(Colors.Black),
            BorderThickness = new Thickness(0),
            Cursor = Cursors.Hand
        };
        okButton.Click += (s, args) =>
        {
            linkDialog.DialogResult = true;
            linkDialog.Close();
        };

        var cancelButton = new Button
        {
            Content = "Cancel",
            Width = 80,
            Height = 32,
            Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#333333")),
            Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#EEEEEE")),
            BorderThickness = new Thickness(0),
            Cursor = Cursors.Hand
        };
        cancelButton.Click += (s, args) =>
        {
            linkDialog.DialogResult = false;
            linkDialog.Close();
        };

        buttonPanel.Children.Add(okButton);
        buttonPanel.Children.Add(cancelButton);

        grid.Children.Add(label);
        grid.Children.Add(urlTextBox);
        grid.Children.Add(buttonPanel);

        linkDialog.Content = grid;

        urlTextBox.Focus();
        urlTextBox.SelectAll();

        if (linkDialog.ShowDialog() == true && !string.IsNullOrWhiteSpace(urlTextBox.Text))
        {
            try
            {
                var hyperlink = new Hyperlink(selection.Start, selection.End)
                {
                    NavigateUri = new Uri(urlTextBox.Text),
                    Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#4A9EFF"))
                };

                MessageBodyEditor.Focus();
            }
            catch (Exception ex)
            {
                MessageDialog.ShowError(Window.GetWindow(this), $"Invalid URL: {ex.Message}", "Error");
            }
        }
    }

    private void InsertImageButton_Click(object sender, RoutedEventArgs e)
    {
        var openFileDialog = new OpenFileDialog
        {
            Title = "Select Image",
            Filter = "Image Files (*.jpg;*.jpeg;*.png;*.gif;*.bmp)|*.jpg;*.jpeg;*.png;*.gif;*.bmp|All Files (*.*)|*.*",
            Multiselect = false
        };

        if (openFileDialog.ShowDialog() == true)
        {
            try
            {
                var image = new Image
                {
                    Source = new BitmapImage(new Uri(openFileDialog.FileName)),
                    MaxWidth = 600,
                    Stretch = Stretch.Uniform,
                    Margin = new Thickness(0, 4, 0, 4),
                    Tag = openFileDialog.FileName // Store file path for email sending
                };

                // Create an InlineUIContainer to host the image
                var container = new InlineUIContainer(image, MessageBodyEditor.CaretPosition);

                // Add a line break after the image for better formatting
                var lineBreak = new LineBreak(container.ContentEnd);

                MessageBodyEditor.Focus();
            }
            catch (Exception ex)
            {
                MessageDialog.ShowError(Window.GetWindow(this), $"Error inserting image: {ex.Message}", "Error");
            }
        }
    }
}
