---
title: ".NET nanoFramework"
layout: guide
category: IoT
subcategory: .NET IoT Development
description: "Running C# on bare-metal microcontrollers with .NET nanoFramework, covering supported hardware like ESP32 and STM32, programming model differences, built-in libraries, and constrained device patterns."
tags: [iot, dotnet, embedded, microcontrollers, fundamentals, practical, firmware]
---

## What .NET nanoFramework Is

[.NET nanoFramework](https://www.nanoframework.net){:target="_blank" rel="noopener noreferrer"} is a free, open-source platform that lets you write C# code to run directly on microcontrollers. Unlike a Raspberry Pi, which runs a full Linux operating system with gigabytes of RAM and a relatively powerful CPU, microcontrollers operate on kilobytes of RAM and run code on bare metal without any OS underneath them. nanoFramework bridges that gap by providing a C# runtime and a carefully chosen subset of .NET APIs that fit within those severe resource constraints.

The project is community-driven with backing from Microsoft, and it hosts its source code on [GitHub](https://github.com/nanoframework){:target="_blank" rel="noopener noreferrer"}. Packages are distributed through [NuGet](https://www.nuget.org/packages?q=nanoFramework){:target="_blank" rel="noopener noreferrer"} under the `nanoFramework.*` namespace. Because it runs the CLR (Common Language Runtime) in a stripped-down form on the chip itself, you write normal C# in Visual Studio, deploy it over USB, and debug it with breakpoints just as you would a desktop application.

### The Critical Distinction from .NET IoT Libraries

Before going further, it helps to understand where nanoFramework sits in the broader .NET embedded ecosystem, because the two options are frequently confused.

**.NET IoT Libraries** target single-board computers (SBCs) like the Raspberry Pi. Those boards run Linux, and your C# application runs as a full .NET process on top of that OS. You get the complete .NET runtime, LINQ, async/await, System.Text.Json, and everything else you expect. The Linux OS handles hardware access, and .NET IoT Libraries provide convenient abstractions over the GPIO, SPI, and I2C interfaces that the OS exposes.

**.NET nanoFramework** targets microcontrollers (MCUs) such as the ESP32 or STM32 family. There is no operating system at all. The nanoFramework firmware is flashed directly onto the chip, and your C# assembly runs within that firmware. You give up the full .NET API surface in exchange for a device that costs a few dollars, consumes milliwatts of power, boots in milliseconds, and can run for months on a small battery.

| Dimension | .NET nanoFramework | .NET IoT Libraries |
|-----------|--------------------|--------------------|
| **Target hardware** | Microcontrollers (ESP32, STM32) | SBCs (Raspberry Pi, etc.) |
| **Operating system** | None (bare metal) | Linux |
| **RAM requirement** | 256 KB to a few MB | 512 MB+ typical |
| **Power consumption** | Milliwatts, deep sleep support | Watts |
| **Device cost** | $2 to $15 USD | $15 to $80+ USD |
| **Full .NET runtime** | No (subset only) | Yes |
| **LINQ / async / JSON** | Very limited or absent | Full support |
| **Best for** | Battery-powered sensors, mass deployment | Prototyping, complex local processing |

---

## Supported Hardware

### ESP32 Family

The ESP32 line from Espressif is the most popular target for nanoFramework projects because the chips include integrated WiFi and Bluetooth, the development boards are inexpensive, and the community tooling is mature. Several variants are supported.

**ESP32-WROOM** is the baseline module. It features a dual-core 240 MHz Xtensa LX6 processor, 520 KB of internal SRAM, and up to 16 MB of external flash depending on the board. WiFi (802.11 b/g/n) and Bluetooth Classic plus BLE are built in. Most ESP32 development boards such as the popular 30-pin and 38-pin DevKitC variants use this module. Price is typically $3 to $8 for bare modules and $8 to $15 for complete development boards.

**ESP32-WROVER** adds a PSRAM chip alongside the standard flash, bringing addressable RAM up to 4 MB or 8 MB. This matters when your application needs to buffer larger payloads, such as compressed sensor data or display framebuffers. The programming model in nanoFramework is identical to the WROOM, and the extra RAM is available through the standard allocation mechanisms.

**ESP32-S3** is a newer variant with a more capable dual-core Xtensa LX7 running at 240 MHz, native USB support, and improved AI acceleration instructions. It also supports larger PSRAM configurations. nanoFramework support is available and maturing. The S3 is a sensible choice for devices that need faster data processing or a native USB HID interface.

**ESP32-C3** uses a single-core RISC-V processor rather than the Xtensa architecture, which simplifies the toolchain. It retains WiFi and BLE but drops Bluetooth Classic. It is less capable than the original ESP32 but draws less power at idle, making it appealing for battery-powered designs where you spend most of the time sleeping.

### STM32 Family

STM32 microcontrollers from STMicroelectronics use ARM Cortex-M cores and are widely used in commercial products. nanoFramework supports several Nucleo and Discovery evaluation boards from ST, including boards based on the STM32F7, STM32H7, and STM32L4 series. These chips generally lack integrated WiFi, so network connectivity requires an external module or Ethernet PHY. They excel in deterministic real-time behavior and have strong support for industrial communication protocols.

### Other Supported Targets

Texas Instruments CC3220SF and CC1352 boards are supported, covering WiFi and sub-GHz radio applications respectively. NXP's i.MX RT1060 is a high-performance Cortex-M7 at 600 MHz with large on-chip SRAM, useful for demanding embedded workloads. Support quality varies across these targets; ESP32 boards consistently have the broadest library coverage and the most active community.

### Hardware Comparison

| Board | CPU | RAM | Flash | Connectivity | Price (approx) | Best Use Case |
|-------|-----|-----|-------|-------------|----------------|---------------|
| **ESP32-WROOM DevKit** | Dual Xtensa LX6 @ 240 MHz | 520 KB | 4 MB | WiFi + BT + BLE | $8-15 | General IoT sensor, prototyping |
| **ESP32-WROVER DevKit** | Dual Xtensa LX6 @ 240 MHz | 520 KB + 4/8 MB PSRAM | 4-16 MB | WiFi + BT + BLE | $10-18 | Buffered telemetry, display projects |
| **ESP32-S3 DevKit** | Dual Xtensa LX7 @ 240 MHz | 512 KB + PSRAM | 8 MB+ | WiFi + BLE + USB | $10-20 | USB HID, faster processing |
| **ESP32-C3 DevKit** | Single RISC-V @ 160 MHz | 400 KB | 4 MB | WiFi + BLE | $5-10 | Low-power battery devices |
| **STM32 Nucleo-F746ZG** | Cortex-M7 @ 216 MHz | 320 KB | 1 MB | Ethernet (no WiFi) | $20-30 | Industrial, real-time control |
| **NXP i.MX RT1060** | Cortex-M7 @ 600 MHz | 1 MB on-chip | 256 KB + ext flash | Ethernet | $50+ | High-performance embedded |

### Flashing nanoFramework Firmware

Before you write any C# code, the nanoFramework firmware itself must be flashed onto the target chip. This replaces whatever factory firmware is on the device and installs the nanoFramework CLR. The process differs by chip family.

For ESP32 boards, the [nanoff tool](https://github.com/nanoframework/nanoFirmwareFlasher){:target="_blank" rel="noopener noreferrer"} (nanoFramework Firmware Flasher) automates the process. You connect the board over USB, run the tool with the target board identifier, and it downloads the correct firmware image from GitHub releases and flashes it to the chip. The tool handles erasing, writing, and verifying the firmware in a single step.

For STM32 boards, the STM32 Cube Programmer can write the nanoFramework firmware image directly over USB DFU or ST-Link. The nanoFramework GitHub releases section provides pre-built firmware images for supported boards.

Once the firmware is flashed, the chip reboots and immediately begins listening for nanoFramework deployment connections over USB. At that point, Visual Studio can discover the device and deploy your application to it.

---

## Development Environment

### Visual Studio and the nanoFramework Extension

nanoFramework development uses Visual Studio (not VS Code) with the [.NET nanoFramework Extension](https://marketplace.visualstudio.com/items?itemName=nanoframework.vscode-nanoframework){:target="_blank" rel="noopener noreferrer"} installed from the Visual Studio Marketplace. The extension adds project templates, a device explorer panel, and deployment and debugging capabilities. Visual Studio Community edition is free and fully sufficient.

The extension communicates with the connected device over a serial protocol called WIRE Protocol, which runs over the USB connection. When you click Debug, Visual Studio compiles your code to a managed assembly, transfers it to the device over USB, and starts the remote debugging session. You can set breakpoints in your C# code, inspect variables, and step through execution just as you would with a desktop application, though the stepping speed is slower due to the serial communication latency.

### Project Structure

A nanoFramework solution looks structurally similar to any other .NET solution, with a `.sln` file and one or more `.csproj` projects. The key difference is the target framework moniker in the project file, which uses `netnano1.0` or a hardware-specific variant like `netnano1.0_ESP32`. NuGet packages in the `nanoFramework.*` namespace are built against these target frameworks.

A minimal project contains:
- A `.csproj` referencing `nanoFramework.CoreLibrary` and any hardware-specific packages
- A `Program.cs` with a `Main` method as the entry point
- No async `Main`, no top-level statements (those require newer runtime features not available in nanoFramework)

```csharp
using System;
using System.Threading;

namespace MyDevice
{
    public class Program
    {
        public static void Main()
        {
            // Device entry point. No async, no top-level statements.
            while (true)
            {
                Console.WriteLine("Alive");
                Thread.Sleep(1000);
            }
        }
    }
}
```

### NuGet Packages

All nanoFramework libraries are distributed as NuGet packages with the `nanoFramework.` prefix. When you add a NuGet reference in a nanoFramework project, the package manager filters to packages targeting the `netnano` framework monikers, so standard .NET packages will not appear or install correctly.

Common packages include `nanoFramework.Hardware.Esp32`, `nanoFramework.Device.Gpio`, `nanoFramework.System.Net.Http`, and `nanoFramework.M2Mqtt`. Each package version is tied to a firmware version, and mismatches between the firmware on the device and the package version in your project cause deployment failures. The device explorer panel in Visual Studio shows the firmware version on the connected device, which helps you select the right package versions.

---

## Programming Model Differences

Writing C# for a microcontroller requires a different mindset than writing C# for a web service or desktop application. The same language, the same Visual Studio, but the constraints reshape every habit.

### What Is Available

The nanoFramework runtime provides a solid subset of the core .NET types. Primitive types like `bool`, `byte`, `int`, `long`, `float`, `double`, and `char` work as expected. `String` and `StringBuilder` are available. Basic collections like `ArrayList` and `Hashtable` are present, though not their generic `List<T>` and `Dictionary<TKey, TValue>` counterparts from `System.Collections.Generic`. The `Thread` class and basic synchronization primitives like `ManualResetEvent` and `Mutex` are available. Hardware access APIs for GPIO, SPI, I2C, UART, PWM, and ADC are provided through separate NuGet packages.

### What Is Not Available

Several features that .NET developers rely on daily are absent or severely restricted.

**LINQ** is not available. There is no `System.Linq` namespace. Filtering, projecting, and aggregating collections requires explicit loops.

**async/await** is absent. The `Task` type and `Task.Delay` do not exist. Asynchronous patterns use threads and blocking calls with `Thread.Sleep` instead. Some newer nanoFramework versions have limited task support, but it is not reliable across all targets and should not be counted on for production code.

**Reflection** is severely limited. You cannot enumerate types, invoke methods by name, or use attributes for runtime behavior in the way that frameworks like ASP.NET rely on.

**System.Text.Json** and Newtonsoft.Json do not work. JSON serialization requires either a nanoFramework-specific serializer or manual string construction for simple payloads.

**Most standard NuGet packages** will not install or run because they target `net6.0`, `net8.0`, or `netstandard2.0` rather than `netnano1.0`. Only packages built specifically for nanoFramework will work.

### Memory Constraints and Allocation Discipline

An ESP32-WROOM has 520 KB of SRAM shared between the firmware, the CLR heap, stack frames, and your application. In practice, your application might have 100 to 200 KB of usable managed heap. This sounds extreme compared to a web server, but it is workable if you think carefully about allocations.

The managed heap in nanoFramework has a garbage collector, but GC pressure on constrained hardware is costly and can cause noticeable pauses. The discipline to develop is avoiding allocations in hot paths such as sensor reading loops that run every second or faster.

String concatenation is a common source of hidden allocations. Each `+` operation on strings creates a new string object. In a loop that runs thousands of times, this generates thousands of short-lived objects that stress the GC. Use `StringBuilder` when building strings iteratively, and reuse the builder across iterations when possible.

```csharp
// Avoid: creates a new string object on every iteration
while (true)
{
    string message = "Temp: " + temperature.ToString();
    Publish(message);
    Thread.Sleep(5000);
}

// Prefer: reuse a StringBuilder to reduce allocations
var builder = new StringBuilder();
while (true)
{
    builder.Clear();
    builder.Append("Temp: ");
    builder.Append(temperature);
    Publish(builder.ToString());
    Thread.Sleep(5000);
}
```

Object pooling is another useful pattern. If your telemetry loop needs a buffer to format data before sending it, allocate the buffer once before the loop begins and reuse it on every iteration rather than allocating a new one each time.

```csharp
// Allocate once outside the loop
byte[] sendBuffer = new byte[128];

while (true)
{
    int length = FormatTelemetry(sendBuffer, temperature, humidity);
    mqttClient.Publish("sensors/env", sendBuffer, 0, length);
    Thread.Sleep(10000);
}
```

### Threading Model

Without async/await, concurrent behavior uses the `Thread` class directly. A typical device runs a main loop and one or more background threads for tasks like monitoring a button, watching a network connection, or sampling a sensor at a different rate than the publish interval.

```csharp
// Background thread for sensor sampling
var sensorThread = new Thread(() =>
{
    while (true)
    {
        latestTemperature = ReadTemperature();
        Thread.Sleep(1000); // sample every second
    }
});
sensorThread.IsBackground = true;
sensorThread.Start();

// Main thread handles publishing at a slower cadence
while (true)
{
    PublishTelemetry(latestTemperature);
    Thread.Sleep(30000); // publish every 30 seconds
}
```

Shared state between threads requires synchronization. `lock` works in nanoFramework, as does `ManualResetEvent` for signaling between threads.

---

## Built-in Libraries

### Hardware Access: GPIO and PWM

The `nanoFramework.Device.Gpio` package provides the `GpioController` class for reading and writing digital pins. This is the fundamental API for controlling LEDs, reading button states, toggling relays, and communicating with simple sensors.

```csharp
using nanoFramework.Hardware.Esp32;
using System.Device.Gpio;

var gpio = new GpioController();

// Configure a pin as output and drive it high
var led = gpio.OpenPin(2, PinMode.Output);
led.Write(PinValue.High);

// Configure a pin as input with an internal pull-up resistor
var button = gpio.OpenPin(0, PinMode.InputPullUp);
bool pressed = button.Read() == PinValue.Low;
```

PWM output for controlling servo motors or LED brightness uses the `nanoFramework.Device.Pwm` package, which provides a `PwmChannel` abstraction.

### I2C and SPI

Sensors often communicate over I2C or SPI buses. The `nanoFramework.Device.I2c` and `nanoFramework.Device.Spi` packages provide controller classes that manage the bus and perform read/write operations. Many common sensors (temperature, pressure, IMU, display controllers) have community-written device libraries in the nanoFramework repository that wrap these bus APIs with convenient, sensor-specific interfaces.

### ESP32-Specific Hardware

The `nanoFramework.Hardware.Esp32` package exposes capabilities specific to the ESP32 family.

**Deep sleep** is a power management mode where the processor stops executing and draws microamps rather than milliamps. The device can wake from deep sleep after a timer interval or when an external GPIO pin changes state. On a battery-powered sensor that reads temperature every five minutes, the device might spend 99% of its time in deep sleep, extending battery life from hours to months.

```csharp
using nanoFramework.Hardware.Esp32;

// Sleep for 5 minutes (in microseconds), then reboot and run Main() again
Sleep.EnableWakeupByTimer(TimeSpan.FromMinutes(5));
Sleep.StartDeepSleep();
// Code after this point does not execute; the device halts.
```

Each wake from deep sleep restarts execution from `Main()`. If you need to persist state across sleep cycles (such as a reading counter or a WiFi credential), write it to the non-volatile storage before sleeping and read it at startup.

**The watchdog timer** protects against hangs. If your code gets stuck in a loop or blocks indefinitely, the watchdog fires and resets the chip. You enable the watchdog with a timeout, and then your main loop must call the watchdog's reset method regularly to prevent a forced reboot.

```csharp
// Configure a 30-second watchdog timeout
var watchdog = new nanoFramework.Hardware.Esp32.Watchdog(30000);
watchdog.Enable();

while (true)
{
    DoWork();
    watchdog.Reset(); // must call before 30 seconds elapse
    Thread.Sleep(5000);
}
```

### Networking

The `nanoFramework.System.Net` package provides an HTTP client for making web requests. SSL/TLS is supported on ESP32, though you may need to supply the root CA certificate for your endpoint depending on the firmware build. The client API is synchronous, reflecting the threading model.

WiFi connection management on ESP32 uses the `Wireless80211` class from `nanoFramework.Hardware.Esp32`. Connecting to a network is a blocking operation, and handling reconnection after signal loss requires checking the connection state in a loop or background thread.

```csharp
using nanoFramework.Hardware.Esp32;

Wireless80211.Configure("MySSID", "MyPassword");
var result = Wireless80211.Connect();

if (result != WiFiConnectionStatus.Success)
{
    // Handle connection failure: retry, log, or enter deep sleep
}
```

### MQTT

MQTT is the dominant protocol for IoT telemetry because it is lightweight and designed for unreliable networks. The `nanoFramework.M2Mqtt` package provides an MQTT client that works on ESP32 with both plain TCP and TLS connections.

```csharp
using nanoFramework.M2Mqtt;
using System.Text;

var client = new MqttClient("mqtt.broker.local");
client.Connect("device-001");

// Publish a message
byte[] payload = Encoding.UTF8.GetBytes("{\"temp\":22.5}");
client.Publish("sensors/temperature", payload);

// Subscribe to a command topic
client.MqttMsgPublishReceived += (sender, args) =>
{
    string command = new string(Encoding.UTF8.GetChars(args.Message));
    HandleCommand(command);
};
client.Subscribe(new[] { "devices/device-001/commands" }, new[] { MqttQoSLevel.AtLeastOnce });
```

### Azure IoT Hub

For devices that report directly to Azure, the `nanoFramework.Azure.Devices` package provides a device client for Azure IoT Hub. It handles the underlying MQTT or AMQP connection, device-to-cloud telemetry, cloud-to-device commands, and device twin synchronization.

```csharp
using nanoFramework.Azure.Devices.Client;

var deviceClient = new DeviceClient(
    iotHubHostName: "myhub.azure-devices.net",
    deviceId: "my-device-001",
    sasKey: "base64-encoded-key");

deviceClient.Open();

// Send telemetry
var message = new Message("{\"temp\":22.5}");
deviceClient.SendMessage(message);

deviceClient.Close();
```

---

## Common Patterns

### Sensor Reading Loop

The most common pattern in nanoFramework devices is a loop that reads a sensor, formats the data, sends it somewhere, and then sleeps. The sleep interval depends on how frequently the application needs data and how aggressively it needs to conserve power.

```csharp
public static void Main()
{
    ConnectToWifi();
    var mqttClient = ConnectToMqtt();

    var builder = new StringBuilder();

    while (true)
    {
        float temperature = ReadTemperatureSensor();
        float humidity = ReadHumiditySensor();

        builder.Clear();
        builder.Append("{\"temp\":");
        builder.Append(temperature.ToString("F1"));
        builder.Append(",\"hum\":");
        builder.Append(humidity.ToString("F1"));
        builder.Append("}");

        byte[] payload = Encoding.UTF8.GetBytes(builder.ToString());
        mqttClient.Publish("sensors/env", payload);

        Thread.Sleep(30000);
    }
}
```

### WiFi Reconnection

WiFi connections on battery-powered or mobile devices drop unexpectedly. A robust device checks the connection state before each publish attempt and reconnects when needed, rather than assuming the connection established at startup will persist.

```csharp
private static void EnsureConnected(MqttClient client)
{
    if (!Wireless80211.IsConnected)
    {
        Wireless80211.Connect();
        Thread.Sleep(5000); // Allow DHCP to complete
    }

    if (!client.IsConnected)
    {
        client.Connect("device-001");
    }
}
```

### Deep Sleep with Timer Wake

A temperature sensor that only needs to report every five minutes gains nothing by staying awake between readings. Deep sleep reduces current draw from around 100-240 mA (active) to roughly 10-150 microamps depending on the chip configuration. Over time this difference is the gap between a battery lasting days and lasting months.

```csharp
public static void Main()
{
    // Read wakeup cause to differentiate first boot from timer wakeup
    var wakeupCause = Sleep.GetWakeupCause();

    // Read sensor, connect WiFi, publish reading
    ConnectToWifi();
    float temperature = ReadTemperatureSensor();
    PublishReading(temperature);
    DisconnectWifi();

    // Schedule next wakeup and sleep
    Sleep.EnableWakeupByTimer(TimeSpan.FromMinutes(5));
    Sleep.StartDeepSleep();
}
```

Each call to `Main()` is a complete cycle: wake, sense, send, sleep. The device keeps no long-running state; anything that needs to persist across cycles goes into non-volatile storage before sleeping.

### External Interrupt Wake

Some applications need to wake on an event rather than a timer. A door sensor, for example, should wake and send an alert when the door opens rather than polling on a schedule. GPIO wakeup assigns a pin as the wakeup source, and the device sleeps until that pin changes state.

```csharp
// Wake on GPIO 33 going low (door opens, pulling pin to ground)
Sleep.EnableWakeupByPin(Sleep.WakeupGPIOPin.Pin33, 0);
Sleep.StartDeepSleep();
```

### Watchdog-Protected Main Loop

Any production device running unattended should have a watchdog timer. Network calls, sensor reads, and MQTT publishes can all hang indefinitely if something goes wrong, and without a watchdog the device locks up until someone physically resets it.

```csharp
public static void Main()
{
    var watchdog = new nanoFramework.Hardware.Esp32.Watchdog(60000); // 60-second timeout
    watchdog.Enable();

    ConnectToWifi();

    while (true)
    {
        try
        {
            float reading = ReadSensor();
            PublishReading(reading);
        }
        catch (Exception ex)
        {
            // Log the error to non-volatile storage if needed
            Debug.WriteLine("Error: " + ex.Message);
        }

        watchdog.Reset();
        Thread.Sleep(10000);
    }
}
```

---

## When to Use nanoFramework vs .NET IoT Libraries

The choice between these two approaches comes down to what the device needs to do and the constraints it must operate within.

**Choose nanoFramework when** the device is battery-powered and needs to last weeks or months on a charge, when you are deploying dozens or hundreds of identical sensors where per-unit cost matters, when the device has a single focused job such as reading a sensor and publishing data, or when you need the device to boot and begin operating within a second or two of power-on.

**Choose .NET IoT Libraries when** you are prototyping and want the full .NET ecosystem available without thinking about memory budgets, when the device needs to run multiple services or complex logic concurrently, when the device is permanently mains-powered and power consumption is not a concern, or when you need libraries that only exist for full .NET such as ML.NET inference or advanced image processing.

| Consideration | nanoFramework (MCU) | .NET IoT Libraries (SBC) |
|---------------|---------------------|--------------------------|
| **Battery life** | Months to years with deep sleep | Hours to days at best |
| **Device cost** | $3 to $15 | $15 to $80+ |
| **API surface** | Subset of .NET | Full .NET |
| **NuGet ecosystem** | nanoFramework packages only | All of NuGet |
| **Development iteration speed** | Slower (flash + deploy cycle) | Fast (run on Pi, edit in place) |
| **Debugging experience** | Works but slower over serial | Full local debugging speed |
| **Mass deployment suitability** | High | Low to medium |
| **Complex processing** | Constrained | Unconstrained |
| **Boot time** | Seconds | 30+ seconds (Linux boot) |
| **Production reliability** | High (no OS layer) | Moderate (OS can interfere) |

---

## Limitations and Workarounds

### Incompatible NuGet Packages

The most common frustration when starting with nanoFramework is discovering that a NuGet package you rely on will not install. Packages targeting `net6.0`, `net8.0`, or `netstandard2.0` are incompatible because they assume a full CLR with a runtime API surface that nanoFramework does not provide.

The workaround is to search for nanoFramework-specific alternatives in the `nanoFramework.*` namespace on NuGet. If no package exists for the library you need, you have the option of porting the relevant portion yourself (for small, self-contained libraries) or rethinking whether a different approach avoids the dependency.

### JSON Without System.Text.Json

Since standard JSON serializers are unavailable, device code typically handles small JSON payloads manually with `StringBuilder` for output and simple string parsing for input, or uses the `nanoFramework.Json` package which provides basic serialization for simple types.

For telemetry that flows in one direction (device to cloud), hand-building the JSON string is usually straightforward and avoids any serializer dependency:

```csharp
builder.Clear();
builder.Append("{\"deviceId\":\"sensor-01\",\"temp\":");
builder.Append(temp.ToString("F2"));
builder.Append(",\"ts\":\"");
builder.Append(DateTime.UtcNow.ToString("o"));
builder.Append("\"}");
```

For inbound commands from the cloud, keeping the command format simple (a short string like `"restart"` or `"sleep"`) avoids the need for a JSON parser entirely.

### Debugging Latency

Stepping through code in the Visual Studio debugger over USB serial is noticeably slower than debugging desktop .NET code. Each step involves a round-trip over WIRE Protocol, which can make debugging tight loops tedious. The practical approach is to instrument code with `Debug.WriteLine` calls, run the device freely, and observe the output in the Output window. Reserve the step debugger for investigating specific logic problems where line-by-line execution is worth the wait.

### Uneven Board Support

Not all supported boards have the same level of library coverage or firmware stability. ESP32 boards have by far the most community attention and the broadest library ecosystem. STM32 boards have solid support for the boards that are officially listed, but adding an unsupported STM32 variant requires building custom firmware, which is an advanced undertaking. TI and NXP targets receive less community contribution and may have gaps in peripheral support.

Before committing to a board for a production design, check the nanoFramework GitHub repository to confirm that the specific peripherals you need (I2C, SPI, deep sleep, WiFi) are supported and recently maintained for that target.

### Memory Profiling

When a device starts throwing `OutOfMemoryException` or behaving erratically under load, the usual culprit is heap exhaustion. nanoFramework exposes `GC.Run(true)` to force a collection and returns the available heap through `nanoFramework.Runtime.Native.GC.Run(false)` (which runs GC but also returns heap size). Instrumenting the main loop to log available heap at each iteration makes it straightforward to identify where allocations are accumulating.

```csharp
// Log available heap for diagnostics during development
uint freeBytes = nanoFramework.Runtime.Native.GC.Run(false);
Debug.WriteLine("Free heap: " + freeBytes.ToString() + " bytes");
```

Remove or disable this logging before production deployment, since the GC call itself has a small overhead cost.
