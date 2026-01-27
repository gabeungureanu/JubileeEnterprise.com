using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Input;
using JubileeOutlook.Models;

namespace JubileeOutlook.Views;

/// <summary>
/// Dialog for applying categories to emails
/// </summary>
public partial class CategoryDialog : Window
{
    private readonly EmailMessage _message;
    private readonly ObservableCollection<string> _availableCategories;
    private ObservableCollection<string> _currentCategories;

    /// <summary>
    /// Gets the selected categories after the dialog is closed
    /// </summary>
    public List<string> SelectedCategories { get; private set; } = new();

    /// <summary>
    /// Gets any newly added categories
    /// </summary>
    public List<string> NewCategories { get; private set; } = new();

    public CategoryDialog(EmailMessage message, ObservableCollection<string> availableCategories)
    {
        InitializeComponent();
        _message = message;
        _availableCategories = availableCategories;
        _currentCategories = new ObservableCollection<string>(message.Categories);

        // Initialize current categories display
        CurrentCategoriesControl.ItemsSource = _currentCategories;
        UpdateNoCategoriesVisibility();

        // Initialize available categories list (excluding current ones)
        CategoriesListBox.ItemsSource = _availableCategories;

        // Pre-select categories that are already applied
        foreach (var category in _currentCategories)
        {
            for (int i = 0; i < CategoriesListBox.Items.Count; i++)
            {
                if (CategoriesListBox.Items[i]?.ToString() == category)
                {
                    CategoriesListBox.SelectedItems.Add(CategoriesListBox.Items[i]);
                    break;
                }
            }
        }
    }

    private void UpdateNoCategoriesVisibility()
    {
        NoCategoriesText.Visibility = _currentCategories.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
    }

    private void TitleBar_MouseDown(object sender, MouseButtonEventArgs e)
    {
        if (e.LeftButton == MouseButtonState.Pressed)
        {
            DragMove();
        }
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

    private void CancelButton_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

    private void ApplyButton_Click(object sender, RoutedEventArgs e)
    {
        // Collect all selected categories
        SelectedCategories.Clear();
        foreach (var item in CategoriesListBox.SelectedItems)
        {
            if (item is string category)
            {
                SelectedCategories.Add(category);
            }
        }

        DialogResult = true;
        Close();
    }

    private void RemoveCategory_Click(object sender, RoutedEventArgs e)
    {
        if (sender is System.Windows.Controls.Button button && button.Tag is string category)
        {
            _currentCategories.Remove(category);
            UpdateNoCategoriesVisibility();

            // Deselect from the list
            for (int i = 0; i < CategoriesListBox.Items.Count; i++)
            {
                if (CategoriesListBox.Items[i]?.ToString() == category)
                {
                    CategoriesListBox.SelectedItems.Remove(CategoriesListBox.Items[i]);
                    break;
                }
            }
        }
    }

    private void AddCategory_Click(object sender, RoutedEventArgs e)
    {
        AddNewCategory();
    }

    private void NewCategoryBox_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            AddNewCategory();
        }
    }

    private void AddNewCategory()
    {
        var newCategory = NewCategoryBox.Text?.Trim();
        if (string.IsNullOrWhiteSpace(newCategory)) return;

        // Check if category already exists
        if (_availableCategories.Contains(newCategory))
        {
            // Just select it if it exists
            for (int i = 0; i < CategoriesListBox.Items.Count; i++)
            {
                if (CategoriesListBox.Items[i]?.ToString() == newCategory)
                {
                    if (!CategoriesListBox.SelectedItems.Contains(CategoriesListBox.Items[i]))
                    {
                        CategoriesListBox.SelectedItems.Add(CategoriesListBox.Items[i]);
                    }
                    break;
                }
            }
        }
        else
        {
            // Add as new category
            _availableCategories.Add(newCategory);
            NewCategories.Add(newCategory);

            // Select the new category
            CategoriesListBox.SelectedItems.Add(newCategory);
        }

        // Add to current display if not already there
        if (!_currentCategories.Contains(newCategory))
        {
            _currentCategories.Add(newCategory);
            UpdateNoCategoriesVisibility();
        }

        NewCategoryBox.Clear();
        NewCategoryBox.Focus();
    }
}
