using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Threading;

namespace JubileeOutlook.Services;

/// <summary>
/// Service for displaying user-friendly notifications and error messages
/// </summary>
public class NotificationService
{
    private static NotificationService? _instance;
    private static readonly object _lock = new();

    private Grid? _notificationContainer;
    private readonly Queue<NotificationItem> _notificationQueue = new();
    private readonly int _maxVisibleNotifications = 3;
    private readonly List<Border> _activeNotifications = new();

    /// <summary>
    /// Singleton instance of the notification service
    /// </summary>
    public static NotificationService Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new NotificationService();
                }
            }
            return _instance;
        }
    }

    private NotificationService()
    {
        // Subscribe to HTTP client factory events
        HttpClientFactory.Instance.NetworkError += OnNetworkError;
        HttpClientFactory.Instance.RetryAttempted += OnRetryAttempted;
    }

    /// <summary>
    /// Initializes the notification service with a container grid
    /// </summary>
    public void Initialize(Grid container)
    {
        _notificationContainer = container;
        System.Diagnostics.Debug.WriteLine("NotificationService initialized");
    }

    /// <summary>
    /// Shows an error notification
    /// </summary>
    public void ShowError(string message, string? title = null)
    {
        QueueNotification(new NotificationItem
        {
            Message = message,
            Title = title ?? "Error",
            Type = NotificationType.Error,
            Duration = TimeSpan.FromSeconds(8)
        });
    }

    /// <summary>
    /// Shows a warning notification
    /// </summary>
    public void ShowWarning(string message, string? title = null)
    {
        QueueNotification(new NotificationItem
        {
            Message = message,
            Title = title ?? "Warning",
            Type = NotificationType.Warning,
            Duration = TimeSpan.FromSeconds(6)
        });
    }

    /// <summary>
    /// Shows an info notification
    /// </summary>
    public void ShowInfo(string message, string? title = null)
    {
        QueueNotification(new NotificationItem
        {
            Message = message,
            Title = title ?? "Info",
            Type = NotificationType.Info,
            Duration = TimeSpan.FromSeconds(5)
        });
    }

    /// <summary>
    /// Shows a success notification
    /// </summary>
    public void ShowSuccess(string message, string? title = null)
    {
        QueueNotification(new NotificationItem
        {
            Message = message,
            Title = title ?? "Success",
            Type = NotificationType.Success,
            Duration = TimeSpan.FromSeconds(4)
        });
    }

    /// <summary>
    /// Shows a retry notification
    /// </summary>
    public void ShowRetry(int attemptNumber, int maxAttempts, string reason)
    {
        QueueNotification(new NotificationItem
        {
            Message = $"Retrying... (Attempt {attemptNumber} of {maxAttempts})",
            Title = "Connection Issue",
            Type = NotificationType.Warning,
            Duration = TimeSpan.FromSeconds(3)
        });
    }

    private void QueueNotification(NotificationItem item)
    {
        if (_notificationContainer == null)
        {
            System.Diagnostics.Debug.WriteLine($"NotificationService: No container set. Message: {item.Message}");
            return;
        }

        _notificationContainer.Dispatcher.BeginInvoke(() =>
        {
            if (_activeNotifications.Count < _maxVisibleNotifications)
            {
                ShowNotificationInternal(item);
            }
            else
            {
                _notificationQueue.Enqueue(item);
            }
        });
    }

    private void ShowNotificationInternal(NotificationItem item)
    {
        if (_notificationContainer == null) return;

        var notification = CreateNotificationElement(item);
        _notificationContainer.Children.Add(notification);
        _activeNotifications.Add(notification);

        // Animate in
        AnimateIn(notification);

        // Schedule removal
        var timer = new DispatcherTimer
        {
            Interval = item.Duration
        };
        timer.Tick += (s, e) =>
        {
            timer.Stop();
            AnimateOut(notification, () =>
            {
                _notificationContainer?.Children.Remove(notification);
                _activeNotifications.Remove(notification);
                UpdateNotificationPositions();
                ProcessQueue();
            });
        };
        timer.Start();
    }

    private Border CreateNotificationElement(NotificationItem item)
    {
        var (backgroundColor, iconColor, icon) = GetNotificationStyle(item.Type);

        var border = new Border
        {
            Background = new SolidColorBrush(backgroundColor),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(16, 12, 16, 12),
            Margin = new Thickness(16, 8, 16, 8),
            HorizontalAlignment = HorizontalAlignment.Right,
            VerticalAlignment = VerticalAlignment.Top,
            MaxWidth = 400,
            MinWidth = 280,
            Opacity = 0,
            RenderTransform = new TranslateTransform(300, 0),
            Effect = new System.Windows.Media.Effects.DropShadowEffect
            {
                BlurRadius = 10,
                ShadowDepth = 2,
                Opacity = 0.3,
                Color = Colors.Black
            }
        };

        // Calculate vertical position based on active notifications
        var topMargin = 8 + (_activeNotifications.Count * 80);
        border.Margin = new Thickness(16, topMargin, 16, 8);

        var grid = new Grid();
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        // Icon
        var iconText = new TextBlock
        {
            Text = icon,
            FontFamily = new FontFamily("Segoe MDL2 Assets"),
            FontSize = 20,
            Foreground = new SolidColorBrush(iconColor),
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(0, 0, 12, 0)
        };
        Grid.SetColumn(iconText, 0);
        grid.Children.Add(iconText);

        // Content
        var contentStack = new StackPanel
        {
            VerticalAlignment = VerticalAlignment.Center
        };

        if (!string.IsNullOrEmpty(item.Title))
        {
            contentStack.Children.Add(new TextBlock
            {
                Text = item.Title,
                FontWeight = FontWeights.SemiBold,
                FontSize = 13,
                Foreground = new SolidColorBrush(Colors.White),
                Margin = new Thickness(0, 0, 0, 2)
            });
        }

        contentStack.Children.Add(new TextBlock
        {
            Text = item.Message,
            FontSize = 12,
            Foreground = new SolidColorBrush(Color.FromRgb(220, 220, 220)),
            TextWrapping = TextWrapping.Wrap
        });

        Grid.SetColumn(contentStack, 1);
        grid.Children.Add(contentStack);

        // Close button
        var closeButton = new Button
        {
            Content = "\uE10A",
            FontFamily = new FontFamily("Segoe MDL2 Assets"),
            FontSize = 12,
            Background = Brushes.Transparent,
            BorderBrush = Brushes.Transparent,
            Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)),
            Padding = new Thickness(4),
            Cursor = System.Windows.Input.Cursors.Hand,
            VerticalAlignment = VerticalAlignment.Top,
            Margin = new Thickness(8, 0, 0, 0)
        };
        closeButton.Click += (s, e) =>
        {
            AnimateOut(border, () =>
            {
                _notificationContainer?.Children.Remove(border);
                _activeNotifications.Remove(border);
                UpdateNotificationPositions();
                ProcessQueue();
            });
        };
        Grid.SetColumn(closeButton, 2);
        grid.Children.Add(closeButton);

        border.Child = grid;
        return border;
    }

    private static (Color background, Color icon, string iconChar) GetNotificationStyle(NotificationType type)
    {
        return type switch
        {
            NotificationType.Error => (Color.FromRgb(180, 40, 40), Colors.White, "\uE783"),
            NotificationType.Warning => (Color.FromRgb(200, 150, 30), Colors.White, "\uE7BA"),
            NotificationType.Success => (Color.FromRgb(50, 150, 50), Colors.White, "\uE73E"),
            NotificationType.Info => (Color.FromRgb(50, 120, 180), Colors.White, "\uE946"),
            _ => (Color.FromRgb(80, 80, 80), Colors.White, "\uE946")
        };
    }

    private static void AnimateIn(Border notification)
    {
        var translateTransform = (TranslateTransform)notification.RenderTransform;

        var slideAnimation = new DoubleAnimation
        {
            From = 300,
            To = 0,
            Duration = TimeSpan.FromMilliseconds(300),
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
        };

        var fadeAnimation = new DoubleAnimation
        {
            From = 0,
            To = 1,
            Duration = TimeSpan.FromMilliseconds(300)
        };

        translateTransform.BeginAnimation(TranslateTransform.XProperty, slideAnimation);
        notification.BeginAnimation(UIElement.OpacityProperty, fadeAnimation);
    }

    private static void AnimateOut(Border notification, Action onComplete)
    {
        var translateTransform = (TranslateTransform)notification.RenderTransform;

        var slideAnimation = new DoubleAnimation
        {
            From = 0,
            To = 300,
            Duration = TimeSpan.FromMilliseconds(200),
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn }
        };

        var fadeAnimation = new DoubleAnimation
        {
            From = 1,
            To = 0,
            Duration = TimeSpan.FromMilliseconds(200)
        };

        slideAnimation.Completed += (s, e) => onComplete();

        translateTransform.BeginAnimation(TranslateTransform.XProperty, slideAnimation);
        notification.BeginAnimation(UIElement.OpacityProperty, fadeAnimation);
    }

    private void UpdateNotificationPositions()
    {
        if (_notificationContainer == null) return;

        for (int i = 0; i < _activeNotifications.Count; i++)
        {
            var notification = _activeNotifications[i];
            var targetTop = 8 + (i * 80);

            var marginAnimation = new ThicknessAnimation
            {
                To = new Thickness(16, targetTop, 16, 8),
                Duration = TimeSpan.FromMilliseconds(200),
                EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
            };

            notification.BeginAnimation(FrameworkElement.MarginProperty, marginAnimation);
        }
    }

    private void ProcessQueue()
    {
        if (_notificationQueue.Count > 0 && _activeNotifications.Count < _maxVisibleNotifications)
        {
            var nextItem = _notificationQueue.Dequeue();
            ShowNotificationInternal(nextItem);
        }
    }

    private void OnNetworkError(object? sender, NetworkErrorEventArgs e)
    {
        ShowError(e.FriendlyMessage, "Connection Error");
    }

    private void OnRetryAttempted(object? sender, RetryEventArgs e)
    {
        // Only show retry notifications for later attempts to avoid spam
        if (e.AttemptNumber >= 2)
        {
            ShowRetry(e.AttemptNumber, e.MaxAttempts, e.Reason);
        }
    }
}

/// <summary>
/// Notification types
/// </summary>
public enum NotificationType
{
    Info,
    Success,
    Warning,
    Error
}

/// <summary>
/// Internal notification item model
/// </summary>
internal class NotificationItem
{
    public string Message { get; set; } = string.Empty;
    public string? Title { get; set; }
    public NotificationType Type { get; set; }
    public TimeSpan Duration { get; set; } = TimeSpan.FromSeconds(5);
}
