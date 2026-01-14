using System.Windows;
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
        }
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
            // Show confirmation dialog before deleting
            var result = MessageBox.Show(
                $"Are you sure you want to delete the event '{viewModel.EventTitle}'?\n\nThis action cannot be undone.",
                "Delete Event",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning,
                MessageBoxResult.No);

            if (result == MessageBoxResult.Yes)
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
}
