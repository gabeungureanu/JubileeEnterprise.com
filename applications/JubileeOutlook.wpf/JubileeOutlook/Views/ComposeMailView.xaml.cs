using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Microsoft.Win32;
using JubileeOutlook.ViewModels;

namespace JubileeOutlook.Views;

public partial class ComposeMailView : UserControl
{
    public ComposeMailView()
    {
        InitializeComponent();

        // Add keyboard shortcuts
        MessageBodyEditor.PreviewKeyDown += MessageBodyEditor_PreviewKeyDown;

        // Subscribe to DataContext changes
        DataContextChanged += OnDataContextChanged;
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        // Unsubscribe from old view model
        if (e.OldValue is ComposeMailViewModel oldViewModel)
        {
            oldViewModel.AttachmentRequested -= OnAttachmentRequested;
            oldViewModel.Attachments.CollectionChanged -= OnAttachmentsCollectionChanged;
        }

        // Subscribe to new view model
        if (e.NewValue is ComposeMailViewModel newViewModel)
        {
            newViewModel.AttachmentRequested += OnAttachmentRequested;
            newViewModel.Attachments.CollectionChanged += OnAttachmentsCollectionChanged;
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
            MessageBox.Show("Please select text to convert to a hyperlink.", "No Text Selected", MessageBoxButton.OK, MessageBoxImage.Information);
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
                MessageBox.Show($"Invalid URL: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
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
                    Margin = new Thickness(0, 4, 0, 4)
                };

                // Create an InlineUIContainer to host the image
                var container = new InlineUIContainer(image, MessageBodyEditor.CaretPosition);

                // Add a line break after the image for better formatting
                var lineBreak = new LineBreak(container.ContentEnd);

                MessageBodyEditor.Focus();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error inserting image: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
