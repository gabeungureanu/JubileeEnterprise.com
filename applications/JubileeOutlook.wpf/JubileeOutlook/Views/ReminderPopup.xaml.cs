using System.Windows;
using System.Windows.Controls;
using JubileeOutlook.Models;
using JubileeOutlook.Services;

namespace JubileeOutlook.Views;

/// <summary>
/// Popup window for calendar event reminders
/// </summary>
public partial class ReminderPopup : Window
{
    private readonly CalendarEvent _event;

    public ReminderPopup(CalendarEvent calendarEvent)
    {
        InitializeComponent();

        _event = calendarEvent;
        PopulateEventDetails();
        PositionWindow();

        // Play notification sound
        PlayNotificationSound();
    }

    private void PopulateEventDetails()
    {
        SubjectText.Text = _event.DisplaySubject;
        TimeText.Text = _event.GetTimeRange();

        // Calculate time until event
        var timeUntil = _event.StartTime - DateTime.Now;
        if (timeUntil.TotalMinutes <= 0)
        {
            TimeUntilText.Text = "Starting now!";
        }
        else if (timeUntil.TotalMinutes < 60)
        {
            TimeUntilText.Text = $"Starting in {(int)timeUntil.TotalMinutes} minutes";
        }
        else if (timeUntil.TotalHours < 24)
        {
            TimeUntilText.Text = $"Starting in {(int)timeUntil.TotalHours} hours";
        }
        else
        {
            TimeUntilText.Text = $"Starting in {(int)timeUntil.TotalDays} days";
        }

        // Show location if available
        if (!string.IsNullOrEmpty(_event.DisplayLocation))
        {
            LocationPanel.Visibility = Visibility.Visible;
            LocationText.Text = _event.DisplayLocation;
        }
    }

    private void PositionWindow()
    {
        // Position in bottom-right corner of the screen
        var workingArea = SystemParameters.WorkArea;
        Left = workingArea.Right - Width - 20;
        Top = workingArea.Bottom - Height - 20;
    }

    private void PlayNotificationSound()
    {
        try
        {
            System.Media.SystemSounds.Exclamation.Play();
        }
        catch
        {
            // Ignore sound errors
        }
    }

    private void SnoozeButton_Click(object sender, RoutedEventArgs e)
    {
        var selectedItem = SnoozeComboBox.SelectedItem as ComboBoxItem;
        if (selectedItem?.Tag is string tagValue && int.TryParse(tagValue, out int minutes))
        {
            CalendarReminderService.Instance.SnoozeReminder(_event, TimeSpan.FromMinutes(minutes));
        }
        else
        {
            // Default to 10 minutes
            CalendarReminderService.Instance.SnoozeReminder(_event, TimeSpan.FromMinutes(10));
        }

        Close();
    }

    private void DismissButton_Click(object sender, RoutedEventArgs e)
    {
        CalendarReminderService.Instance.DismissReminder(_event);
        Close();
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        // Treat close as dismiss
        CalendarReminderService.Instance.DismissReminder(_event);
        Close();
    }
}
