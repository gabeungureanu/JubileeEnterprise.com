using System.Windows;
using System.Windows.Controls;

namespace JubileeFlywheel.Controls
{
    public partial class AppRailControl : UserControl
    {
        public event EventHandler<string>? ModuleChanged;
        public event EventHandler? SettingsRequested;
        public event EventHandler? MenuRequested;

        public AppRailControl()
        {
            InitializeComponent();
        }

        private void ModuleButton_Checked(object sender, RoutedEventArgs e)
        {
            if (sender is RadioButton rb)
            {
                var moduleName = rb.Name.Replace("Module", "");
                ModuleChanged?.Invoke(this, moduleName);
            }
        }

        private void SettingsButton_Click(object sender, RoutedEventArgs e)
        {
            SettingsRequested?.Invoke(this, EventArgs.Empty);
        }

        private void MenuButton_Click(object sender, RoutedEventArgs e)
        {
            MenuRequested?.Invoke(this, EventArgs.Empty);
        }

        public void SelectModule(string moduleName)
        {
            switch (moduleName)
            {
                case "Inbox":
                    InboxModule.IsChecked = true;
                    break;
                case "Charts":
                    ChartsModule.IsChecked = true;
                    break;
                case "Portfolio":
                    PortfolioModule.IsChecked = true;
                    break;
                case "Accounts":
                    AccountsModule.IsChecked = true;
                    break;
                case "Data":
                    DataModule.IsChecked = true;
                    break;
            }
        }
    }
}
