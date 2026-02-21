using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Markup;
using JubileeOutlook.Models;
using JubileeOutlook.ViewModels;

namespace JubileeOutlook.Views;

public partial class NewEventWindow : Window
{
    public bool IsDeleted { get; private set; }
    private CalendarEvent? _eventToEdit;

    public NewEventWindow()
    {
        InitializeComponent();
        Loaded += NewEventWindow_Loaded;
    }

    public NewEventWindow(CalendarEvent eventToEdit) : this()
    {
        _eventToEdit = eventToEdit;
    }

    private void NewEventWindow_Loaded(object sender, RoutedEventArgs e)
    {
        // Load event for editing after window is loaded
        if (_eventToEdit != null && DataContext is NewEventViewModel viewModel)
        {
            viewModel.LoadEventForEditing(_eventToEdit);

            // Populate RichTextBox with existing description (supports both XAML and plain text)
            if (!string.IsNullOrEmpty(viewModel.Description) && DescriptionRichTextBox != null)
            {
                LoadRichTextContent(viewModel.Description);
            }
        }
    }

    private void SetRichTextBoxText(string text)
    {
        if (DescriptionRichTextBox == null) return;

        DescriptionRichTextBox.Document.Blocks.Clear();
        var lines = text.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);

        foreach (var line in lines)
        {
            DescriptionRichTextBox.Document.Blocks.Add(new Paragraph(new Run(line)));
        }

        // Update placeholder visibility
        DescriptionPlaceholder.Visibility = string.IsNullOrWhiteSpace(text)
            ? Visibility.Visible
            : Visibility.Collapsed;
    }

    /// <summary>
    /// Loads rich text content from storage - handles both XAML format and plain text for backwards compatibility
    /// </summary>
    private void LoadRichTextContent(string content)
    {
        if (DescriptionRichTextBox == null || string.IsNullOrEmpty(content)) return;

        // Check if the content is XAML (starts with <FlowDocument or <Section)
        if (content.TrimStart().StartsWith("<FlowDocument") || content.TrimStart().StartsWith("<Section"))
        {
            try
            {
                // Parse as XAML FlowDocument
                using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(content));
                var flowDocument = XamlReader.Load(stream) as FlowDocument;
                if (flowDocument != null)
                {
                    DescriptionRichTextBox.Document = flowDocument;
                    UpdatePlaceholderVisibility();
                    return;
                }
            }
            catch
            {
                // If XAML parsing fails, fall back to plain text
            }
        }

        // Fallback: treat as plain text (backwards compatibility)
        SetRichTextBoxText(content);
    }

    /// <summary>
    /// Serializes the RichTextBox content as XAML for storage
    /// </summary>
    private string GetRichTextAsXaml()
    {
        if (DescriptionRichTextBox == null) return string.Empty;

        var document = DescriptionRichTextBox.Document;
        var textRange = new TextRange(document.ContentStart, document.ContentEnd);

        // If the document is empty, return empty string
        if (string.IsNullOrWhiteSpace(textRange.Text))
        {
            return string.Empty;
        }

        // Serialize the FlowDocument as XAML
        using var stream = new MemoryStream();
        XamlWriter.Save(document, stream);
        stream.Position = 0;
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }

    private void UpdatePlaceholderVisibility()
    {
        if (DescriptionRichTextBox == null || DescriptionPlaceholder == null) return;

        var document = DescriptionRichTextBox.Document;
        var textRange = new TextRange(document.ContentStart, document.ContentEnd);
        var text = textRange.Text.Trim();

        DescriptionPlaceholder.Visibility = string.IsNullOrEmpty(text)
            ? Visibility.Visible
            : Visibility.Collapsed;
    }

    private void MinimizeButton_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void MaximizeButton_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState == WindowState.Maximized
            ? WindowState.Normal
            : WindowState.Maximized;
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

    private void SaveButton_Click(object sender, RoutedEventArgs e)
    {
        if (DataContext is NewEventViewModel viewModel)
        {
            viewModel.SaveEventCommand.Execute(null);
            if (viewModel.CreatedEvent != null && string.IsNullOrEmpty(viewModel.ValidationError))
            {
                DialogResult = true;
                Close();
            }
        }
    }

    private void DeleteButton_Click(object sender, RoutedEventArgs e)
    {
        if (DataContext is NewEventViewModel viewModel)
        {
            // Show custom themed confirmation dialog before deleting
            var confirmed = ConfirmationDialog.ShowDeleteConfirmation(this, viewModel.EventTitle);

            if (confirmed)
            {
                viewModel.DeleteEventCommand.Execute(null);
                if (viewModel.CreatedEvent != null)
                {
                    IsDeleted = true;
                    DialogResult = true;
                    Close();
                }
            }
        }
    }

    // RichTextBox Text Changed Handler for Placeholder
    private void DescriptionRichTextBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (DescriptionRichTextBox == null || DescriptionPlaceholder == null) return;

        UpdatePlaceholderVisibility();

        // Sync to ViewModel - save as XAML to preserve formatting
        if (DataContext is NewEventViewModel viewModel)
        {
            viewModel.Description = GetRichTextAsXaml();
        }
    }

    private string GetRichTextAsPlainText()
    {
        if (DescriptionRichTextBox == null) return string.Empty;
        var textRange = new TextRange(
            DescriptionRichTextBox.Document.ContentStart,
            DescriptionRichTextBox.Document.ContentEnd);
        return textRange.Text.TrimEnd();
    }

    // More Options Menu Handlers
    private void MoreOptionsButton_Click(object sender, RoutedEventArgs e)
    {
        MoreOptionsPopup.IsOpen = !MoreOptionsPopup.IsOpen;
    }

    private void MenuBold_Click(object sender, RoutedEventArgs e)
    {
        MoreOptionsPopup.IsOpen = false;
        EditingCommands.ToggleBold.Execute(null, DescriptionRichTextBox);
        DescriptionRichTextBox?.Focus();
    }

    private void MenuItalic_Click(object sender, RoutedEventArgs e)
    {
        MoreOptionsPopup.IsOpen = false;
        EditingCommands.ToggleItalic.Execute(null, DescriptionRichTextBox);
        DescriptionRichTextBox?.Focus();
    }

    private void MenuUnderline_Click(object sender, RoutedEventArgs e)
    {
        MoreOptionsPopup.IsOpen = false;
        EditingCommands.ToggleUnderline.Execute(null, DescriptionRichTextBox);
        DescriptionRichTextBox?.Focus();
    }

    private void MenuStrikethrough_Click(object sender, RoutedEventArgs e)
    {
        MoreOptionsPopup.IsOpen = false;
        ApplyStrikethrough();
        DescriptionRichTextBox?.Focus();
    }

    private void ApplyStrikethrough()
    {
        if (DescriptionRichTextBox == null) return;

        var selection = DescriptionRichTextBox.Selection;
        if (selection.IsEmpty) return;

        var currentDecorations = selection.GetPropertyValue(Inline.TextDecorationsProperty) as TextDecorationCollection;
        var hasStrikethrough = currentDecorations != null && currentDecorations.Contains(TextDecorations.Strikethrough[0]);

        if (hasStrikethrough)
        {
            selection.ApplyPropertyValue(Inline.TextDecorationsProperty, null);
        }
        else
        {
            selection.ApplyPropertyValue(Inline.TextDecorationsProperty, TextDecorations.Strikethrough);
        }
    }

    private void MenuBulletedList_Click(object sender, RoutedEventArgs e)
    {
        MoreOptionsPopup.IsOpen = false;
        EditingCommands.ToggleBullets.Execute(null, DescriptionRichTextBox);
        DescriptionRichTextBox?.Focus();
    }

    private void MenuNumberedList_Click(object sender, RoutedEventArgs e)
    {
        MoreOptionsPopup.IsOpen = false;
        EditingCommands.ToggleNumbering.Execute(null, DescriptionRichTextBox);
        DescriptionRichTextBox?.Focus();
    }

    private void MenuChecklist_Click(object sender, RoutedEventArgs e)
    {
        MoreOptionsPopup.IsOpen = false;
        InsertTextAtCaret("☐ ");
        DescriptionRichTextBox?.Focus();
    }

    private void MenuInsertLink_Click(object sender, RoutedEventArgs e)
    {
        MoreOptionsPopup.IsOpen = false;
        InsertHyperlink();
        DescriptionRichTextBox?.Focus();
    }

    private void InsertHyperlink()
    {
        if (DescriptionRichTextBox == null) return;

        var selection = DescriptionRichTextBox.Selection;
        var selectedText = selection.Text;

        if (string.IsNullOrEmpty(selectedText))
        {
            selectedText = "link text";
        }

        try
        {
            var hyperlink = new Hyperlink(new Run(selectedText))
            {
                NavigateUri = new Uri("https://example.com"),
                Foreground = System.Windows.Media.Brushes.DodgerBlue
            };

            if (!selection.IsEmpty)
            {
                selection.Text = string.Empty;
            }

            var insertPosition = DescriptionRichTextBox.CaretPosition;
            if (insertPosition.Paragraph != null)
            {
                insertPosition.Paragraph.Inlines.Add(hyperlink);
            }
        }
        catch
        {
            // Fallback: insert as plain text
            InsertTextAtCaret($"[{selectedText}](url)");
        }
    }

    private void MenuInsertTable_Click(object sender, RoutedEventArgs e)
    {
        MoreOptionsPopup.IsOpen = false;
        InsertTable();
        DescriptionRichTextBox?.Focus();
    }

    private void InsertTable()
    {
        if (DescriptionRichTextBox == null) return;

        var table = new Table
        {
            CellSpacing = 0,
            BorderBrush = System.Windows.Media.Brushes.Gray,
            BorderThickness = new Thickness(1)
        };

        // Add 3 columns
        for (int i = 0; i < 3; i++)
        {
            table.Columns.Add(new TableColumn { Width = new GridLength(100) });
        }

        var rowGroup = new TableRowGroup();

        // Header row
        var headerRow = new TableRow { Background = System.Windows.Media.Brushes.DarkGray };
        for (int i = 0; i < 3; i++)
        {
            var cell = new TableCell(new Paragraph(new Run($"Column {i + 1}")))
            {
                BorderBrush = System.Windows.Media.Brushes.Gray,
                BorderThickness = new Thickness(1),
                Padding = new Thickness(4)
            };
            headerRow.Cells.Add(cell);
        }
        rowGroup.Rows.Add(headerRow);

        // Data row
        var dataRow = new TableRow();
        for (int i = 0; i < 3; i++)
        {
            var cell = new TableCell(new Paragraph(new Run($"Cell {i + 1}")))
            {
                BorderBrush = System.Windows.Media.Brushes.Gray,
                BorderThickness = new Thickness(1),
                Padding = new Thickness(4)
            };
            dataRow.Cells.Add(cell);
        }
        rowGroup.Rows.Add(dataRow);

        table.RowGroups.Add(rowGroup);

        // Insert the table into the document
        var caretPosition = DescriptionRichTextBox.CaretPosition;
        var paragraph = caretPosition.Paragraph;

        if (paragraph != null)
        {
            DescriptionRichTextBox.Document.Blocks.InsertAfter(paragraph, table);
            DescriptionRichTextBox.Document.Blocks.InsertAfter(table, new Paragraph());
        }
        else
        {
            DescriptionRichTextBox.Document.Blocks.Add(table);
            DescriptionRichTextBox.Document.Blocks.Add(new Paragraph());
        }
    }

    private void MenuInsertLine_Click(object sender, RoutedEventArgs e)
    {
        MoreOptionsPopup.IsOpen = false;
        InsertHorizontalLine();
        DescriptionRichTextBox?.Focus();
    }

    private void InsertHorizontalLine()
    {
        if (DescriptionRichTextBox == null) return;

        var line = new Paragraph(new Run("─────────────────────────────────────"))
        {
            Foreground = System.Windows.Media.Brushes.Gray,
            Margin = new Thickness(0, 8, 0, 8)
        };

        var caretPosition = DescriptionRichTextBox.CaretPosition;
        var paragraph = caretPosition.Paragraph;

        if (paragraph != null)
        {
            DescriptionRichTextBox.Document.Blocks.InsertAfter(paragraph, line);
            DescriptionRichTextBox.Document.Blocks.InsertAfter(line, new Paragraph());
        }
        else
        {
            DescriptionRichTextBox.Document.Blocks.Add(line);
            DescriptionRichTextBox.Document.Blocks.Add(new Paragraph());
        }
    }

    private void MenuClearFormatting_Click(object sender, RoutedEventArgs e)
    {
        MoreOptionsPopup.IsOpen = false;
        ClearFormatting();
        DescriptionRichTextBox?.Focus();
    }

    private void ClearFormatting()
    {
        if (DescriptionRichTextBox == null) return;

        var selection = DescriptionRichTextBox.Selection;
        if (selection.IsEmpty) return;

        selection.ApplyPropertyValue(TextElement.FontWeightProperty, System.Windows.FontWeights.Normal);
        selection.ApplyPropertyValue(TextElement.FontStyleProperty, System.Windows.FontStyles.Normal);
        selection.ApplyPropertyValue(Inline.TextDecorationsProperty, null);
    }

    private void MenuSelectAll_Click(object sender, RoutedEventArgs e)
    {
        MoreOptionsPopup.IsOpen = false;
        DescriptionRichTextBox?.SelectAll();
        DescriptionRichTextBox?.Focus();
    }

    private void InsertTextAtCaret(string text)
    {
        if (DescriptionRichTextBox == null) return;

        var caretPosition = DescriptionRichTextBox.CaretPosition;
        caretPosition.InsertTextInRun(text);
    }

    #region Attendees Contact Suggestions

    private bool _isSuppressingTextChanged;

    private async void AttendeesTextBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (_isSuppressingTextChanged) return;
        if (DataContext is not NewEventViewModel viewModel) return;

        // Extract the current token (text after the last separator)
        var text = AttendeesTextBox.Text;
        var lastSeparatorIndex = text.LastIndexOfAny(new[] { ';', ',' });
        var currentToken = lastSeparatorIndex >= 0
            ? text[(lastSeparatorIndex + 1)..].Trim()
            : text.Trim();

        if (currentToken.Length >= 1)
        {
            await viewModel.FilterContactsAsync(currentToken);
        }
        else
        {
            viewModel.SuggestedContacts.Clear();
            viewModel.ShowContactSuggestions = false;
        }
    }

    private void AttendeesTextBox_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (DataContext is not NewEventViewModel viewModel) return;

        if (e.Key == Key.Escape && viewModel.ShowContactSuggestions)
        {
            viewModel.ShowContactSuggestions = false;
            e.Handled = true;
            return;
        }

        if (e.Key == Key.Down && viewModel.ShowContactSuggestions && viewModel.SuggestedContacts.Count > 0)
        {
            ContactSuggestionsListBox.SelectedIndex = 0;
            ContactSuggestionsListBox.Focus();
            e.Handled = true;
            return;
        }

        if (e.Key == Key.Enter && viewModel.ShowContactSuggestions && viewModel.SuggestedContacts.Count > 0)
        {
            // Select the first suggestion
            var firstContact = viewModel.SuggestedContacts[0];
            ApplyContactSelection(viewModel, firstContact);
            e.Handled = true;
        }
    }

    private void ContactSuggestion_Selected(object sender, MouseButtonEventArgs e)
    {
        if (DataContext is not NewEventViewModel viewModel) return;
        if (ContactSuggestionsListBox.SelectedItem is not Models.Contact contact) return;

        ApplyContactSelection(viewModel, contact);
    }

    private void ApplyContactSelection(NewEventViewModel viewModel, Models.Contact contact)
    {
        _isSuppressingTextChanged = true;
        viewModel.SelectContact(contact);
        _isSuppressingTextChanged = false;

        // Move caret to end of text
        AttendeesTextBox.CaretIndex = AttendeesTextBox.Text.Length;
        AttendeesTextBox.Focus();
    }

    #endregion
}
