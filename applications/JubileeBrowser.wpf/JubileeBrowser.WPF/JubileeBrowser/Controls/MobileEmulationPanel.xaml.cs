using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using JubileeBrowser.Models;

namespace JubileeBrowser.Controls;

/// <summary>
/// Control panel for mobile device emulation settings.
/// Provides device selection, dimension controls, orientation toggle, and throttling options.
/// </summary>
public partial class MobileEmulationPanel : UserControl
{
    private bool _isInitializing = true;
    private bool _suppressDimensionUpdates = false;

    /// <summary>
    /// Event raised when the user selects a different device.
    /// </summary>
    public event EventHandler<DeviceSelectedEventArgs>? DeviceSelected;

    /// <summary>
    /// Event raised when custom dimensions are changed.
    /// </summary>
    public event EventHandler<DimensionsChangedEventArgs>? DimensionsChanged;

    /// <summary>
    /// Event raised when orientation is changed.
    /// </summary>
    public event EventHandler<OrientationChangedEventArgs>? OrientationChanged;

    /// <summary>
    /// Event raised when device pixel ratio is changed.
    /// </summary>
    public event EventHandler<DprChangedEventArgs>? DprChanged;

    /// <summary>
    /// Event raised when network throttling preset is changed.
    /// </summary>
    public event EventHandler<NetworkThrottleChangedEventArgs>? NetworkThrottleChanged;

    /// <summary>
    /// Event raised when CPU throttling preset is changed.
    /// </summary>
    public event EventHandler<CpuThrottleChangedEventArgs>? CpuThrottleChanged;

    /// <summary>
    /// Event raised when the close button is clicked.
    /// </summary>
    public event EventHandler? CloseRequested;

    public MobileEmulationPanel()
    {
        InitializeComponent();
        PopulateDeviceList();
        InitializeDefaults();
        _isInitializing = false;
    }

    /// <summary>
    /// Populates the device selector with available device profiles.
    /// </summary>
    private void PopulateDeviceList()
    {
        DeviceSelector.Items.Clear();

        // Add "Responsive" option first
        var responsiveItem = new ComboBoxItem
        {
            Content = "Responsive",
            Tag = "responsive"
        };
        DeviceSelector.Items.Add(responsiveItem);

        // Add separator-like item (disabled)
        var separator1 = new ComboBoxItem
        {
            Content = "--- Apple Devices ---",
            IsEnabled = false,
            Foreground = System.Windows.Media.Brushes.Gray
        };
        DeviceSelector.Items.Add(separator1);

        // Add Apple devices
        foreach (var device in DeviceProfiles.GetByCategory("Apple"))
        {
            DeviceSelector.Items.Add(new ComboBoxItem
            {
                Content = $"{device.Name} ({device.Width}x{device.Height})",
                Tag = device.Id
            });
        }

        // Add Android separator
        var separator2 = new ComboBoxItem
        {
            Content = "--- Android Devices ---",
            IsEnabled = false,
            Foreground = System.Windows.Media.Brushes.Gray
        };
        DeviceSelector.Items.Add(separator2);

        // Add Android devices
        foreach (var device in DeviceProfiles.GetByCategory("Android"))
        {
            DeviceSelector.Items.Add(new ComboBoxItem
            {
                Content = $"{device.Name} ({device.Width}x{device.Height})",
                Tag = device.Id
            });
        }

        // Add Tablet separator
        var separator3 = new ComboBoxItem
        {
            Content = "--- Tablets ---",
            IsEnabled = false,
            Foreground = System.Windows.Media.Brushes.Gray
        };
        DeviceSelector.Items.Add(separator3);

        // Add Tablet devices
        foreach (var device in DeviceProfiles.GetByCategory("Tablet"))
        {
            DeviceSelector.Items.Add(new ComboBoxItem
            {
                Content = $"{device.Name} ({device.Width}x{device.Height})",
                Tag = device.Id
            });
        }

        // Add Generic separator
        var separator4 = new ComboBoxItem
        {
            Content = "--- Generic Sizes ---",
            IsEnabled = false,
            Foreground = System.Windows.Media.Brushes.Gray
        };
        DeviceSelector.Items.Add(separator4);

        // Add Generic devices
        foreach (var device in DeviceProfiles.GetByCategory("Generic"))
        {
            DeviceSelector.Items.Add(new ComboBoxItem
            {
                Content = $"{device.Name}",
                Tag = device.Id
            });
        }

        // Select Responsive by default
        DeviceSelector.SelectedIndex = 0;
    }

    /// <summary>
    /// Initialize default values for controls.
    /// </summary>
    private void InitializeDefaults()
    {
        WidthInput.Text = "375";
        HeightInput.Text = "667";
        DprSelector.SelectedIndex = 2; // 2x DPR
        NetworkThrottleSelector.SelectedIndex = 0; // No throttle
        CpuThrottleSelector.SelectedIndex = 0; // No throttle
    }

    /// <summary>
    /// Updates the panel to reflect a given emulation state.
    /// </summary>
    public void UpdateFromState(MobileEmulationState state)
    {
        _suppressDimensionUpdates = true;

        try
        {
            // Update device selector
            if (state.IsResponsiveMode)
            {
                SelectDeviceById("responsive");
            }
            else if (state.SelectedDevice != null)
            {
                SelectDeviceById(state.SelectedDevice.Id);
            }

            // Update dimensions
            WidthInput.Text = state.EffectiveWidth.ToString();
            HeightInput.Text = state.EffectiveHeight.ToString();

            // Update DPR
            SelectDprValue(state.EffectiveDevicePixelRatio);

            // Update orientation
            PortraitButton.IsChecked = state.Orientation == DeviceOrientation.Portrait;
            LandscapeButton.IsChecked = state.Orientation == DeviceOrientation.Landscape;

            // Update network throttle
            SelectNetworkThrottle(state.NetworkThrottle);

            // Update CPU throttle
            SelectCpuThrottle(state.CpuThrottle);
        }
        finally
        {
            _suppressDimensionUpdates = false;
        }
    }

    private void SelectDeviceById(string id)
    {
        foreach (ComboBoxItem item in DeviceSelector.Items)
        {
            if (item.Tag?.ToString() == id)
            {
                DeviceSelector.SelectedItem = item;
                break;
            }
        }
    }

    private void SelectDprValue(double dpr)
    {
        foreach (ComboBoxItem item in DprSelector.Items)
        {
            if (double.TryParse(item.Tag?.ToString(), out var itemDpr) && Math.Abs(itemDpr - dpr) < 0.01)
            {
                DprSelector.SelectedItem = item;
                return;
            }
        }
        // Default to 2x if not found
        DprSelector.SelectedIndex = 2;
    }

    private void SelectNetworkThrottle(NetworkThrottlePreset preset)
    {
        foreach (ComboBoxItem item in NetworkThrottleSelector.Items)
        {
            if (item.Tag?.ToString() == preset.ToString())
            {
                NetworkThrottleSelector.SelectedItem = item;
                return;
            }
        }
    }

    private void SelectCpuThrottle(CpuThrottlePreset preset)
    {
        foreach (ComboBoxItem item in CpuThrottleSelector.Items)
        {
            if (item.Tag?.ToString() == preset.ToString())
            {
                CpuThrottleSelector.SelectedItem = item;
                return;
            }
        }
    }

    private void DeviceSelector_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_isInitializing || DeviceSelector.SelectedItem is not ComboBoxItem item) return;

        var deviceId = item.Tag?.ToString();
        if (string.IsNullOrEmpty(deviceId)) return;

        if (deviceId == "responsive")
        {
            // Enable custom dimension inputs
            WidthInput.IsEnabled = true;
            HeightInput.IsEnabled = true;
            DprSelector.IsEnabled = true;

            DeviceSelected?.Invoke(this, new DeviceSelectedEventArgs(null, true));
        }
        else
        {
            var device = DeviceProfiles.GetById(deviceId);
            if (device != null)
            {
                // Update dimension displays
                _suppressDimensionUpdates = true;
                WidthInput.Text = device.Width.ToString();
                HeightInput.Text = device.Height.ToString();
                SelectDprValue(device.DevicePixelRatio);
                _suppressDimensionUpdates = false;

                // Disable custom dimension inputs when a specific device is selected
                WidthInput.IsEnabled = false;
                HeightInput.IsEnabled = false;
                DprSelector.IsEnabled = false;

                DeviceSelected?.Invoke(this, new DeviceSelectedEventArgs(device, false));
            }
        }
    }

    private void DimensionInput_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (_isInitializing || _suppressDimensionUpdates) return;

        if (int.TryParse(WidthInput.Text, out var width) && int.TryParse(HeightInput.Text, out var height))
        {
            if (width > 0 && height > 0)
            {
                DimensionsChanged?.Invoke(this, new DimensionsChangedEventArgs(width, height));
            }
        }
    }

    private void DimensionInput_PreviewTextInput(object sender, TextCompositionEventArgs e)
    {
        // Only allow numeric input
        e.Handled = !int.TryParse(e.Text, out _);
    }

    private void DprSelector_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_isInitializing || _suppressDimensionUpdates) return;

        if (DprSelector.SelectedItem is ComboBoxItem item &&
            double.TryParse(item.Tag?.ToString(), out var dpr))
        {
            DprChanged?.Invoke(this, new DprChangedEventArgs(dpr));
        }
    }

    private void OrientationButton_Click(object sender, RoutedEventArgs e)
    {
        if (_isInitializing) return;

        if (sender == PortraitButton)
        {
            PortraitButton.IsChecked = true;
            LandscapeButton.IsChecked = false;
            OrientationChanged?.Invoke(this, new OrientationChangedEventArgs(DeviceOrientation.Portrait));
        }
        else if (sender == LandscapeButton)
        {
            PortraitButton.IsChecked = false;
            LandscapeButton.IsChecked = true;
            OrientationChanged?.Invoke(this, new OrientationChangedEventArgs(DeviceOrientation.Landscape));
        }
    }

    private void NetworkThrottleSelector_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_isInitializing) return;

        if (NetworkThrottleSelector.SelectedItem is ComboBoxItem item &&
            Enum.TryParse<NetworkThrottlePreset>(item.Tag?.ToString(), out var preset))
        {
            NetworkThrottleChanged?.Invoke(this, new NetworkThrottleChangedEventArgs(preset));
        }
    }

    private void CpuThrottleSelector_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_isInitializing) return;

        if (CpuThrottleSelector.SelectedItem is ComboBoxItem item &&
            Enum.TryParse<CpuThrottlePreset>(item.Tag?.ToString(), out var preset))
        {
            CpuThrottleChanged?.Invoke(this, new CpuThrottleChangedEventArgs(preset));
        }
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        CloseRequested?.Invoke(this, EventArgs.Empty);
    }
}

#region Event Args Classes

public class DeviceSelectedEventArgs : EventArgs
{
    public DeviceProfile? Device { get; }
    public bool IsResponsiveMode { get; }

    public DeviceSelectedEventArgs(DeviceProfile? device, bool isResponsiveMode)
    {
        Device = device;
        IsResponsiveMode = isResponsiveMode;
    }
}

public class DimensionsChangedEventArgs : EventArgs
{
    public int Width { get; }
    public int Height { get; }

    public DimensionsChangedEventArgs(int width, int height)
    {
        Width = width;
        Height = height;
    }
}

public class OrientationChangedEventArgs : EventArgs
{
    public DeviceOrientation Orientation { get; }

    public OrientationChangedEventArgs(DeviceOrientation orientation)
    {
        Orientation = orientation;
    }
}

public class DprChangedEventArgs : EventArgs
{
    public double DevicePixelRatio { get; }

    public DprChangedEventArgs(double dpr)
    {
        DevicePixelRatio = dpr;
    }
}

public class NetworkThrottleChangedEventArgs : EventArgs
{
    public NetworkThrottlePreset Preset { get; }

    public NetworkThrottleChangedEventArgs(NetworkThrottlePreset preset)
    {
        Preset = preset;
    }
}

public class CpuThrottleChangedEventArgs : EventArgs
{
    public CpuThrottlePreset Preset { get; }

    public CpuThrottleChangedEventArgs(CpuThrottlePreset preset)
    {
        Preset = preset;
    }
}

#endregion
