---
title: "IoT Companion Apps with MAUI"
layout: guide
category: IoT
subcategory: Dashboards & Apps
description: "Building cross-platform IoT companion apps with .NET MAUI, covering BLE communication, device setup and provisioning, real-time monitoring, cloud integration, and platform-specific considerations."
tags: [iot, dotnet, embedded, practical, real-time, architecture, sensors]
---

## Why IoT Devices Need Companion Apps

Most IoT devices have no screen. A temperature sensor, smart lock, air quality monitor, or industrial controller interacts with the physical world but has no way to present information directly to a user beyond perhaps a status LED. Companion apps fill that gap, providing the setup experience, configuration controls, live monitoring dashboards, and command interfaces that the hardware itself cannot.

Cross-platform reach matters here because users do not choose their hardware to match your app. A household with an Android phone and a Windows laptop expects the companion app to work on both. .NET MAUI addresses this directly, building native Android, iOS, macOS, and Windows apps from a single C# codebase. Shared business logic, BLE communication code, and cloud integration all live in one project; only platform-specific permission declarations and a handful of native API wrappers need to differ per platform.

A well-designed companion app covers several distinct responsibilities. During initial setup it walks the user through scanning for nearby devices, establishing a BLE connection, and provisioning the device onto a local WiFi network. In ongoing use it displays live telemetry, accepts configuration changes, and relays commands to the device either locally over BLE or remotely through a cloud backend. These responsibilities map naturally to an MVVM architecture where the UI layer stays thin and the communication logic lives in testable ViewModels and services.

---

## BLE Communication

### Why BLE Is the Default Local Transport

Bluetooth Low Energy dominates companion app communication for good reasons. It operates without any network infrastructure, so setup can happen before the device is connected to WiFi. It has predictable range, around 10 to 30 metres indoors, which keeps the user in proximity to the device during configuration and provides a physical security boundary. Power consumption is low enough that BLE-capable IoT devices can run on coin cells for months. And every modern smartphone and tablet ships with BLE hardware and OS-level APIs.

WiFi direct and NFC are occasionally used for provisioning, but BLE covers the broadest range of scenarios with the most predictable developer experience across Android and iOS.

### BLE Concepts

The BLE protocol organises communication around two roles. The peripheral is the IoT device; it advertises its presence and hosts the data. The central is the phone or tablet; it scans for advertisements and initiates connections.

Data on a peripheral is structured through the GATT profile, which stands for Generic Attribute Profile. At the top level, a peripheral exposes one or more **services**, each identified by a UUID. A service for an environmental sensor might carry temperature and humidity data. Within each service sit **characteristics**, which are the actual data values. Each characteristic also has a UUID and a set of properties: read, write, write without response, and notify. A temperature characteristic might support read (fetch the current value on demand) and notify (push updates whenever the value changes). **Descriptors** provide metadata about characteristics, and the Client Characteristic Configuration Descriptor (CCCD) is the one you interact with most often because writing to it is how you subscribe to notifications.

Standard services and characteristics have well-known UUIDs defined by the Bluetooth SIG, such as `0x180F` for the Battery Service and `0x2A19` for Battery Level. Custom IoT devices use vendor-defined 128-bit UUIDs for services and characteristics specific to their firmware.

### BLE Libraries for MAUI

[Plugin.BLE](https://github.com/dotnet-bluetooth-le/dotnet-bluetooth-le){:target="_blank" rel="noopener noreferrer"} is the most widely used cross-platform BLE library for .NET MAUI and its predecessor Xamarin.Forms. It wraps the native BLE APIs on Android, iOS, macOS, and Windows behind a single async C# interface. [Shiny.BluetoothLE](https://github.com/shinyorg/shiny){:target="_blank" rel="noopener noreferrer"} is an alternative that integrates with the broader Shiny framework for background processing and permissions.

Add Plugin.BLE via NuGet:

```bash
dotnet add package Plugin.BLE
```

### Scanning for Nearby Devices

Before connecting you must scan for advertising peripherals. Plugin.BLE exposes `IBluetoothLE` and `IAdapter` through dependency injection. The adapter raises a `DeviceDiscovered` event for each advertisement received during a scan.

```csharp
using Plugin.BLE;
using Plugin.BLE.Abstractions.Contracts;

public class BleService
{
    private readonly IAdapter _adapter;

    public BleService()
    {
        _adapter = CrossBluetoothLE.Current.Adapter;
        _adapter.ScanTimeout = 10000; // 10 seconds
    }

    public async Task<List<IDevice>> ScanForDevicesAsync(CancellationToken cancellationToken)
    {
        var discovered = new List<IDevice>();

        _adapter.DeviceDiscovered += (_, args) =>
        {
            // Filter by device name or advertised service UUID
            if (args.Device.Name?.StartsWith("MySensor") == true)
                discovered.Add(args.Device);
        };

        await _adapter.StartScanningForDevicesAsync(
            serviceUuids: new[] { Guid.Parse("12345678-1234-1234-1234-123456789abc") },
            cancellationToken: cancellationToken);

        return discovered;
    }
}
```

Filtering by a known service UUID in the scan parameters reduces the number of devices returned and avoids processing advertisements from unrelated BLE peripherals nearby. On iOS, filtering by service UUID is often required because iOS suppresses advertisements that do not match the filter when the app is in the background.

### Connecting and Discovering Services

Once a device is selected, connecting is an async call that returns when the GATT connection is established. After connecting, discover the services to get handles to the specific characteristics you want to interact with.

```csharp
public async Task<IDevice> ConnectToDeviceAsync(IDevice device)
{
    await _adapter.ConnectToDeviceAsync(device);
    return device;
}

public async Task<ICharacteristic> GetCharacteristicAsync(
    IDevice device,
    Guid serviceUuid,
    Guid characteristicUuid)
{
    var service = await device.GetServiceAsync(serviceUuid);
    if (service is null)
        throw new InvalidOperationException($"Service {serviceUuid} not found on device.");

    var characteristic = await service.GetCharacteristicAsync(characteristicUuid);
    if (characteristic is null)
        throw new InvalidOperationException($"Characteristic {characteristicUuid} not found.");

    return characteristic;
}
```

### Reading and Writing Characteristics

Reading a characteristic fetches the current value synchronously from the perspective of your code, though it involves a GATT read request over the radio.

```csharp
public async Task<float> ReadTemperatureAsync(ICharacteristic characteristic)
{
    var result = await characteristic.ReadAsync();
    // Assume firmware sends temperature as a little-endian IEEE 754 float
    return BitConverter.ToSingle(result.data, 0);
}
```

Writing sends data to the device. Use `WriteAsync` for writes where you need confirmation, or `WriteWithoutResponseAsync` for high-frequency writes where throughput matters more than reliability, such as streaming audio or motion data.

```csharp
public async Task SetReportingIntervalAsync(ICharacteristic characteristic, ushort intervalSeconds)
{
    var payload = BitConverter.GetBytes(intervalSeconds);
    await characteristic.WriteAsync(payload);
}
```

### Subscribing to Notifications

Polling characteristics on a timer works but wastes radio time and battery on both ends. BLE notifications let the peripheral push updates to the central whenever the value changes, which is far more efficient for telemetry data like sensor readings.

Subscribing involves writing to the CCCD on the characteristic, which Plugin.BLE handles automatically when you start updates.

```csharp
public async Task SubscribeToTemperatureAsync(
    ICharacteristic characteristic,
    Action<float> onTemperatureReceived)
{
    characteristic.ValueUpdated += (_, args) =>
    {
        var temperature = BitConverter.ToSingle(args.Characteristic.Value, 0);
        onTemperatureReceived(temperature);
    };

    await characteristic.StartUpdatesAsync();
}

public async Task UnsubscribeAsync(ICharacteristic characteristic)
{
    await characteristic.StopUpdatesAsync();
}
```

Remember to call `StopUpdatesAsync` when navigating away from the monitoring screen to avoid keeping the BLE radio active unnecessarily.

---

## WiFi Provisioning

### The SoftAP Pattern

Many IoT devices do not know the local WiFi credentials until a user provides them. A common approach is the SoftAP pattern: the device starts in access point mode, advertising its own WiFi network with a name like `MySensor-Setup`. The companion app guides the user to connect their phone to that network, then the app communicates with the device directly over WiFi to deliver the target network's SSID and password. Once the device reboots onto the home network, the companion app reconnects through the normal router.

The drawback is that the user must manually switch their phone's WiFi network, which interrupts any internet connectivity during setup and confuses some users.

### BLE Provisioning

A cleaner alternative keeps the phone on its existing WiFi and uses the BLE connection already established during device discovery to deliver credentials. This is the approach that Espressif's ESP-IDF uses with [ESP BLE Provisioning](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/provisioning/ble_prov.html){:target="_blank" rel="noopener noreferrer"}, and it produces a smoother user experience.

The companion app writes the WiFi credentials to a provisioning characteristic. The firmware reads those credentials, attempts to join the network, and then writes back a status value indicating success or failure. The companion app subscribes to notifications on that status characteristic so it receives the result without polling.

```csharp
// Well-known UUIDs defined by the firmware vendor (examples)
private static readonly Guid ProvisioningServiceUuid =
    Guid.Parse("4fafc201-1fb5-459e-8fcc-c5c9c331914b");
private static readonly Guid SsidCharacteristicUuid =
    Guid.Parse("beb5483e-36e1-4688-b7f5-ea07361b26a8");
private static readonly Guid PasswordCharacteristicUuid =
    Guid.Parse("beb5483e-36e1-4688-b7f5-ea07361b26a9");
private static readonly Guid StatusCharacteristicUuid =
    Guid.Parse("beb5483e-36e1-4688-b7f5-ea07361b26aa");

public async Task<bool> ProvisionWiFiAsync(
    IDevice device,
    string ssid,
    string password,
    CancellationToken cancellationToken)
{
    var service = await device.GetServiceAsync(ProvisioningServiceUuid);

    var ssidChar = await service.GetCharacteristicAsync(SsidCharacteristicUuid);
    var passwordChar = await service.GetCharacteristicAsync(PasswordCharacteristicUuid);
    var statusChar = await service.GetCharacteristicAsync(StatusCharacteristicUuid);

    await ssidChar.WriteAsync(System.Text.Encoding.UTF8.GetBytes(ssid));
    await passwordChar.WriteAsync(System.Text.Encoding.UTF8.GetBytes(password));

    var tcs = new TaskCompletionSource<bool>();

    statusChar.ValueUpdated += (_, args) =>
    {
        // Firmware sends 0x01 for success, 0x00 for failure
        var success = args.Characteristic.Value[0] == 0x01;
        tcs.TrySetResult(success);
    };

    await statusChar.StartUpdatesAsync();

    // Trigger provisioning attempt by writing a command characteristic or
    // the firmware may begin provisioning automatically after receiving credentials
    using var registration = cancellationToken.Register(() => tcs.TrySetCanceled());

    return await tcs.Task;
}
```

### Securing Credentials in Transit

WiFi passwords sent over BLE are at risk if the connection is not encrypted. Modern BLE connections negotiate encryption automatically when the peripheral requires pairing, and most IoT firmware stacks support this. For higher-assurance requirements, some provisioning protocols add an application-layer encryption step where the companion app and firmware exchange a public key before transmitting credentials.

---

## Device Setup and Configuration UIs

### Onboarding Flow

A typical onboarding sequence moves through several pages. The first explains what Bluetooth permissions are needed and requests them. The second scans for nearby devices and presents a list. The third confirms the selected device and initiates the BLE connection. The fourth collects WiFi credentials and runs provisioning. The fifth registers the device with the cloud backend and assigns it a name. Navigating forward and backward through this flow without losing state or leaving orphaned BLE connections requires careful lifecycle management.

MAUI Shell navigation works well here. Each step is its own page, parameters pass through query string navigation, and a shared `SetupViewModel` holds connection state across the flow.

```csharp
// Navigate to the provisioning step, carrying the connected device ID
await Shell.Current.GoToAsync(
    $"//setup/provision?deviceId={device.Id}");
```

### MVVM for BLE Services

Keeping BLE code in ViewModels directly makes testing difficult because tests would need physical Bluetooth hardware. A cleaner approach defines an interface for the BLE service and injects it into the ViewModel, allowing unit tests to substitute a mock.

```csharp
public interface IBleService
{
    Task<IReadOnlyList<IDevice>> ScanAsync(CancellationToken cancellationToken);
    Task ConnectAsync(IDevice device);
    Task<float> ReadTemperatureAsync(IDevice device);
    IObservable<float> TemperatureUpdates(IDevice device);
    Task DisconnectAsync(IDevice device);
}

public class DeviceMonitorViewModel : ObservableObject
{
    private readonly IBleService _bleService;
    private float _currentTemperature;

    public float CurrentTemperature
    {
        get => _currentTemperature;
        set => SetProperty(ref _currentTemperature, value);
    }

    public DeviceMonitorViewModel(IBleService bleService)
    {
        _bleService = bleService;
    }

    public async Task StartMonitoringAsync(IDevice device, CancellationToken cancellationToken)
    {
        _bleService.TemperatureUpdates(device)
            .Subscribe(temp => CurrentTemperature = temp, cancellationToken);
    }
}
```

### Configuration Screens

Configuration screens let users adjust device parameters like reporting interval, alert thresholds, and device name. Each setting maps to a BLE characteristic write. Present current values by reading characteristics when the screen loads, then write back on save. Avoid writing on every keystroke; wait until the user taps Save to reduce BLE traffic.

A common pattern is to load all configuration characteristics into a dictionary keyed by UUID, display them in a list, and then batch-write changed values. This keeps the configuration screen generic and reusable across different device types with different characteristic sets.

### Displaying Device Status

Device status information often comes from standard GATT services. Battery level lives in the Battery Service (`0x180F`, characteristic `0x2A19`). Signal strength (RSSI) is available directly from the `IDevice` object via `device.Rssi`. Firmware version typically lives in a vendor-defined characteristic and arrives as a UTF-8 string.

```csharp
public async Task<DeviceStatus> ReadDeviceStatusAsync(IDevice device)
{
    var batteryService = await device.GetServiceAsync(Guid.Parse("0000180f-0000-1000-8000-00805f9b34fb"));
    var batteryChar = await batteryService.GetCharacteristicAsync(
        Guid.Parse("00002a19-0000-1000-8000-00805f9b34fb"));
    var batteryResult = await batteryChar.ReadAsync();

    return new DeviceStatus
    {
        BatteryPercent = batteryResult.data[0],
        Rssi = device.Rssi,
        IsConnected = device.State == DeviceState.Connected
    };
}
```

---

## Real-Time Monitoring

### Live Sensor Data from Notifications

BLE characteristic notifications arrive on a background thread. MAUI binding updates must happen on the main thread, so always marshal notification callbacks through `MainThread.BeginInvokeOnMainThread` or use an `ObservableProperty` from CommunityToolkit.Mvvm which handles thread dispatch automatically when bound to UI.

```csharp
public async Task StartLiveSensorDisplayAsync(IDevice device, CancellationToken cancellationToken)
{
    var tempChar = await GetCharacteristicAsync(device, SensorServiceUuid, TemperatureCharUuid);

    tempChar.ValueUpdated += (_, args) =>
    {
        var raw = args.Characteristic.Value;
        var celsius = BitConverter.ToSingle(raw, 0);

        MainThread.BeginInvokeOnMainThread(() =>
        {
            TemperatureReadings.Add(new SensorReading(DateTime.Now, celsius));
            CurrentTemperature = celsius;

            // Keep the chart from growing unbounded
            if (TemperatureReadings.Count > 120)
                TemperatureReadings.RemoveAt(0);
        });
    };

    await tempChar.StartUpdatesAsync();
}
```

### Charting Telemetry

[LiveCharts2](https://livecharts.dev/){:target="_blank" rel="noopener noreferrer"} works well for live MAUI charts. It supports MAUI natively and handles smooth animation for streaming data. [Microcharts](https://github.com/microcharts-dotnet/Microcharts){:target="_blank" rel="noopener noreferrer"} is a lighter option when basic line and bar charts are sufficient.

For gauge displays, such as showing current battery level or signal strength as a dial, [OxyPlot](https://oxyplot.github.io/){:target="_blank" rel="noopener noreferrer"} has gauge-style series, or a custom `GraphicsView` drawing routine gives precise control over the visual.

### Combining Local BLE and Cloud Historical Data

A common UX pattern shows recent live readings from BLE overlaid on historical data fetched from the cloud. When the user opens the monitoring screen, the app fetches the past 24 hours of readings from an Azure API, renders those as the baseline chart, and then appends new BLE notification values to the right edge in real time. This gives context (is today's temperature higher than usual?) alongside immediacy (what is happening right now?).

Fetch historical data on screen load with an async call to your REST API, then start BLE notifications and append as they arrive. Using `ObservableCollection<SensorReading>` as the chart's data source means LiveCharts2 automatically reflects additions.

---

## Cloud Integration

### Sending Commands Through Azure IoT Hub

For devices connected to [Azure IoT Hub](https://learn.microsoft.com/en-us/azure/iot-hub/){:target="_blank" rel="noopener noreferrer"}, the companion app can send commands remotely even when the device is not in BLE range. IoT Hub provides cloud-to-device messaging and direct methods for this purpose.

Direct methods are synchronous: the app invokes a named method on the device, the device executes it and returns a result. Use direct methods for operations where you need confirmation, such as triggering a firmware restart or forcing an immediate sensor reading.

Cloud-to-device messages are one-way and queued: the app sends a message that IoT Hub holds until the device next connects. Use these for lower-priority commands that can tolerate some delivery delay.

From a MAUI app, use the [Azure IoT Hub Service SDK](https://learn.microsoft.com/en-us/azure/iot-hub/iot-hub-devguide-sdks){:target="_blank" rel="noopener noreferrer"} (`Microsoft.Azure.Devices`) to invoke direct methods:

```csharp
using Microsoft.Azure.Devices;

public class IotHubCommandService
{
    private readonly ServiceClient _serviceClient;

    public IotHubCommandService(string connectionString)
    {
        _serviceClient = ServiceClient.CreateFromConnectionString(connectionString);
    }

    public async Task<bool> TriggerImmediateReadingAsync(string deviceId)
    {
        var method = new CloudToDeviceMethod("TriggerReading")
        {
            ResponseTimeout = TimeSpan.FromSeconds(10)
        };

        var result = await _serviceClient.InvokeDeviceMethodAsync(deviceId, method);
        return result.Status == 200;
    }
}
```

Note that embedding an IoT Hub connection string with service-level access directly in a client app is insecure. In production, the companion app calls a backend API (an Azure Function or App Service endpoint) which holds the connection string and invokes the method on the app's behalf after verifying the user's identity.

### Receiving Telemetry via SignalR

Rather than polling a REST endpoint for new telemetry, a companion app can receive a real-time push from the cloud using [SignalR](https://learn.microsoft.com/en-us/aspnet/core/signalr/introduction){:target="_blank" rel="noopener noreferrer"}. The backend subscribes to IoT Hub's Event Hub-compatible endpoint, fans out incoming device messages to connected SignalR clients filtered by device ID, and the MAUI app receives updates without polling.

```csharp
using Microsoft.AspNetCore.SignalR.Client;

public class TelemetryStreamService
{
    private HubConnection? _connection;

    public async Task StartAsync(string hubUrl, string deviceId, Action<SensorReading> onReading)
    {
        _connection = new HubConnectionBuilder()
            .WithUrl(hubUrl)
            .WithAutomaticReconnect()
            .Build();

        _connection.On<SensorReading>($"telemetry:{deviceId}", onReading);

        await _connection.StartAsync();
    }

    public async Task StopAsync()
    {
        if (_connection is not null)
            await _connection.StopAsync();
    }
}
```

The `WithAutomaticReconnect()` call is important for mobile apps where network connectivity drops and resumes frequently.

### Authentication with MSAL

Companion apps that access cloud backends need user authentication. [Microsoft Authentication Library (MSAL)](https://learn.microsoft.com/en-us/entra/identity-platform/msal-overview){:target="_blank" rel="noopener noreferrer"} (`Microsoft.Identity.Client`) handles the OAuth 2.0 / OpenID Connect flow against Azure Entra ID (formerly Azure AD) and works on all MAUI target platforms.

```csharp
using Microsoft.Identity.Client;

public class AuthService
{
    private readonly IPublicClientApplication _msalClient;
    private readonly string[] _scopes;

    public AuthService(string clientId, string tenantId, string apiScope)
    {
        _msalClient = PublicClientApplicationBuilder.Create(clientId)
            .WithAuthority($"https://login.microsoftonline.com/{tenantId}")
            .WithRedirectUri("msal{clientId}://auth")
            .Build();

        _scopes = new[] { apiScope };
    }

    public async Task<string> AcquireTokenAsync()
    {
        try
        {
            // Try silent first (uses cached token)
            var accounts = await _msalClient.GetAccountsAsync();
            var result = await _msalClient.AcquireTokenSilent(_scopes, accounts.FirstOrDefault())
                .ExecuteAsync();
            return result.AccessToken;
        }
        catch (MsalUiRequiredException)
        {
            // Fall back to interactive login
            var result = await _msalClient.AcquireTokenInteractive(_scopes)
                .ExecuteAsync();
            return result.AccessToken;
        }
    }
}
```

Include the access token as a Bearer header on all API calls that access device data or invoke cloud commands.

### Hybrid Communication Pattern

Most production companion apps use a hybrid model combining BLE for local setup and configuration where low latency and no-network-required are critical with the cloud backend for remote monitoring, historical data, and commands sent when out of BLE range.

| Scenario | Communication Path |
|----------|-------------------|
| Initial device setup | BLE only (no WiFi on device yet) |
| WiFi provisioning | BLE (write credentials to characteristic) |
| Configuration changes (in range) | BLE direct write |
| Live monitoring (in range) | BLE notifications |
| Historical telemetry | Cloud REST API |
| Live telemetry (out of range) | SignalR from cloud backend |
| Remote commands | IoT Hub direct method via backend API |
| OTA firmware trigger | IoT Hub direct method via backend API |

---

## Platform-Specific Considerations

### Android Permissions

Android requires explicit runtime permissions for BLE access. The permissions needed depend on the Android version:

- **Android 12 and later**: `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` (and `BLUETOOTH_ADVERTISE` if the app advertises)
- **Android 11 and earlier**: `BLUETOOTH`, `BLUETOOTH_ADMIN`, and `ACCESS_FINE_LOCATION` (BLE scanning was tied to location permissions for anti-tracking reasons)

Declare these in `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"
    android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

The `neverForLocation` flag on `BLUETOOTH_SCAN` tells Android 12+ that the app does not use BLE scanning to derive location, which avoids requiring the user to grant location access.

### iOS Permissions

iOS requires two Info.plist entries to use BLE. Without them, CoreBluetooth throws a privacy exception at runtime.

In `Platforms/iOS/Info.plist`:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app needs Bluetooth to connect to and configure your IoT device.</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>This app needs Bluetooth to communicate with your IoT device.</string>
```

The string values appear in the system permission dialog shown to the user, so make them descriptive.

For background BLE on iOS, add the `bluetooth-central` background mode in the Entitlements file and in the Xcode project capabilities:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>bluetooth-central</string>
</array>
```

Without this, iOS suspends BLE connections when the app moves to the background and CoreBluetooth queues events until the app resumes.

### Requesting Permissions in MAUI

MAUI's permission API provides a cross-platform way to request permissions before attempting BLE operations. Check and request at the point of use rather than during app startup.

```csharp
public async Task<bool> EnsureBluetoothPermissionsAsync()
{
    var status = await Permissions.CheckStatusAsync<Permissions.Bluetooth>();

    if (status == PermissionStatus.Granted)
        return true;

    status = await Permissions.RequestAsync<Permissions.Bluetooth>();
    return status == PermissionStatus.Granted;
}
```

On Android 12+, you may also need to separately request `ACCESS_FINE_LOCATION` depending on how your scan filtering is configured. Always handle the denied case gracefully, explaining to the user why the permission is needed and how to grant it in system settings if they previously denied it.

### Background BLE on Android

Android's Doze mode and battery optimisations aggressively terminate background work. For companion apps that need to maintain a BLE connection while backgrounded (for example, to alert the user when a sensor threshold is exceeded), run the BLE work inside a Foreground Service.

A Foreground Service displays a persistent notification to the user and receives exemption from Doze. In MAUI, implement the Foreground Service in the `Platforms/Android/` directory as a native Android service class. MAUI's `IForegroundServiceManager` (from Shiny) or a manual Android service bridge handles starting and stopping it from shared code.

The approach differs across platforms:

| Platform | Background BLE Approach |
|----------|------------------------|
| Android | Foreground Service with persistent notification |
| iOS | `bluetooth-central` background mode; limited execution time |
| Windows | Background Task (limited; most companion apps do not need this) |
| macOS | Background app refresh; generally well-supported |

iOS enforces a time limit on background BLE execution unless the app is in the `bluetooth-central` mode, and even then, activity must occur frequently enough to prevent suspension. Design iOS companion apps to reconnect quickly when resumed rather than assuming the connection stays alive.

---

## Blazor Hybrid Integration

### Embedding Blazor Components in MAUI

[Blazor Hybrid](https://learn.microsoft.com/en-us/aspnet/core/blazor/hybrid/){:target="_blank" rel="noopener noreferrer"} embeds a Blazor web UI inside a native MAUI shell using `BlazorWebView`. The Blazor components run in-process (not in a browser), so they can call native .NET APIs directly, including your BLE service.

```xml
<!-- MainPage.xaml -->
<ContentPage xmlns="http://schemas.microsoft.com/dotnet/2021/maui"
             xmlns:x="http://schemas.microsoft.com/winfx/2009/xaml"
             xmlns:b="clr-namespace:Microsoft.AspNetCore.Components.WebView.Maui;assembly=Microsoft.AspNetCore.Components.WebView.Maui">
    <b:BlazorWebView HostPage="wwwroot/index.html">
        <b:BlazorWebView.RootComponents>
            <b:RootComponent Selector="#app" ComponentType="{x:Type local:Routes}" />
        </b:BlazorWebView.RootComponents>
    </b:BlazorWebView>
</ContentPage>
```

The Blazor component accesses `IBleService` through the standard DI container shared with the MAUI app:

```razor
@inject IBleService BleService

<div>Current Temperature: @_temperature °C</div>

@code {
    private float _temperature;

    protected override async Task OnInitializedAsync()
    {
        // Assumes a connected device is already available via a shared service
        await BleService.SubscribeToTemperatureAsync(connectedDevice, temp =>
        {
            _temperature = temp;
            InvokeAsync(StateHasChanged);
        });
    }
}
```

### When Blazor Hybrid Makes Sense

Blazor Hybrid is worth considering when a team already has a Blazor web dashboard for the same IoT platform and wants to reuse those components in the mobile app. Sharing chart components, telemetry grids, and configuration panels between the web UI and the mobile app reduces duplication significantly.

The tradeoff is that `BlazorWebView` renders HTML inside a native WebView control, which has different performance and look-and-feel characteristics than a fully native MAUI UI. For complex BLE setup flows with custom animations and native gestures, native MAUI pages are more responsive. For data-heavy dashboards where the component library already exists in Blazor, the reuse benefits outweigh the rendering overhead.

A common split: use native MAUI pages for BLE scanning, pairing, and device setup steps where platform feel matters, and embed a `BlazorWebView` for the monitoring dashboard where the web component library already covers the requirements.

---

## Testing and Debugging

### Developing Without Hardware

Testing BLE code against physical hardware during every development cycle is slow. A BLE peripheral simulator lets you run the companion app on a device and connect to a software-simulated peripheral.

[nRF Connect for Mobile](https://www.nordicsemi.com/Products/Development-tools/nRF-Connect-for-mobile){:target="_blank" rel="noopener noreferrer"} (from Nordic Semiconductor) includes a peripheral simulator mode on iOS. Set up a custom GATT profile matching your device's services and characteristics, and the app connects to the phone as if it were the real hardware. You can manually update characteristic values to simulate sensor readings.

For Android, nRF Connect also works, though the peripheral simulator is more limited. [BLEUnity](https://github.com/adafruit/Bluefruit_LE_Connect_Android_v2){:target="_blank" rel="noopener noreferrer"} and [LightBlue](https://punchthrough.com/lightblue/){:target="_blank" rel="noopener noreferrer"} are alternatives for peripheral simulation.

For unit testing, mock the `IBleService` interface. This covers ViewModel logic, onboarding flow state machines, and data transformation code entirely in isolation from hardware.

```csharp
public class DeviceMonitorViewModelTests
{
    [Fact]
    public async Task Temperature_Updates_When_Notification_Received()
    {
        var mockBle = new Mock<IBleService>();
        var subject = new Subject<float>();
        mockBle.Setup(b => b.TemperatureUpdates(It.IsAny<IDevice>()))
               .Returns(subject.AsObservable());

        var viewModel = new DeviceMonitorViewModel(mockBle.Object);
        await viewModel.StartMonitoringAsync(Mock.Of<IDevice>(), CancellationToken.None);

        subject.OnNext(23.5f);

        Assert.Equal(23.5f, viewModel.CurrentTemperature);
    }
}
```

### Debugging BLE Communication

When a BLE interaction fails, understanding whether the failure is in the app, the firmware, or the radio layer is important. [nRF Connect for Mobile](https://www.nordicsemi.com/Products/Development-tools/nRF-Connect-for-mobile){:target="_blank" rel="noopener noreferrer"} is the standard tool for inspecting GATT profiles directly. Connect to your device, browse its services and characteristics, and read or write values independently of your app. This isolates firmware issues from app issues.

For Android, the HCI snoop log captures raw BLE packets. Enable it in Developer Options, reproduce the issue, then pull the log with `adb pull /sdcard/btsnoop_hci.log` and open it in [Wireshark](https://www.wireshark.org/){:target="_blank" rel="noopener noreferrer"} with the Bluetooth plugins. You can see exactly what is transmitted at the packet level, including connection parameters, MTU negotiation, and characteristic data.

Log verbosely during development. Record connection events, characteristic UUIDs being accessed, raw bytes read or written (in hex), and notification payloads. Structure logs with enough context to reconstruct a BLE session from the log alone, including timestamps and device identifiers. Reduce log verbosity in production builds.

### Testing on Emulators vs Physical Devices

BLE requires physical hardware. Android emulators do not support BLE by default (some configurations in Android Studio 31+ have partial support but it is unreliable). iOS Simulator has no BLE support at all. Plan to test all BLE-dependent flows on physical devices from the start.

Maintain a test device matrix covering at least one recent Android device and one recent iPhone. BLE behaviour differs across hardware vendors, with chipsets from Qualcomm and MediaTek having different quirks around connection intervals, MTU negotiation, and connection parameter requests. Test critical flows on both.

Permissions behaviour also varies. Some Android OEMs modify the system permission dialogs or add battery optimisation overlays that intercept BLE connections, and vendors from East Asian hardware brands have historically applied aggressive background process killing. Test background BLE scenarios on a range of devices, not just flagship models.

---

## Common Patterns and Pitfalls

### Connection State Management

BLE connections drop unexpectedly: the user walks out of range, the device reboots after a firmware write, or the OS terminates the connection to save power. Handle disconnection events and offer automatic reconnection rather than leaving the app in a broken state.

```csharp
_adapter.DeviceDisconnected += async (_, args) =>
{
    if (args.Device.Id == _connectedDevice?.Id)
    {
        IsConnected = false;
        ConnectionStatus = "Disconnected. Reconnecting...";

        // Delay before retrying to avoid hammering the radio
        await Task.Delay(TimeSpan.FromSeconds(2));
        await ReconnectAsync(_connectedDevice);
    }
};
```

Apply exponential backoff if immediate reconnection fails, and give up after several attempts with a clear message to the user rather than retrying indefinitely.

### Characteristic UUID Management

Manage characteristic UUIDs as named constants rather than embedding UUID strings throughout the codebase. Group them by service in a static class matching the device's GATT profile documentation. This makes the code readable and makes UUID updates from firmware changes easy to find.

```csharp
public static class SensorGattProfile
{
    public static readonly Guid EnvironmentalService =
        Guid.Parse("12345678-0001-1000-8000-00805f9b34fb");
    public static readonly Guid TemperatureCharacteristic =
        Guid.Parse("12345678-0002-1000-8000-00805f9b34fb");
    public static readonly Guid HumidityCharacteristic =
        Guid.Parse("12345678-0003-1000-8000-00805f9b34fb");

    public static class Configuration
    {
        public static readonly Guid ConfigService =
            Guid.Parse("12345678-0010-1000-8000-00805f9b34fb");
        public static readonly Guid ReportingIntervalCharacteristic =
            Guid.Parse("12345678-0011-1000-8000-00805f9b34fb");
    }
}
```

### Thread Safety for BLE Callbacks

BLE callbacks in Plugin.BLE arrive on background threads. When updating observable properties bound to UI, always marshal to the main thread. Using `[ObservableProperty]` from CommunityToolkit.Mvvm with `MainThread.BeginInvokeOnMainThread` around the update is the safest pattern. Failing to do so produces intermittent UI crashes that are difficult to reproduce because threading issues depend on timing.

### MTU Negotiation for Larger Payloads

By default, BLE packets carry 20 bytes of payload. For configuration screens that write larger structures, negotiate a higher MTU after connecting. Android allows MTU up to 512 bytes; iOS caps at 185 bytes in practice. Plugin.BLE exposes MTU negotiation through `device.RequestMtuAsync(512)`. The firmware must also support extended MTU. Check the returned value; the negotiated MTU may be lower than requested depending on firmware and radio constraints.
