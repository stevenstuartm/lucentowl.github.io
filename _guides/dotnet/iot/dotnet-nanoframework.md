---
title: ".NET nanoFramework"
layout: guide
category: ".NET & C#"
subcategory: "IoT & Embedded"
description: "Running C# on microcontrollers with .NET nanoFramework: how it differs from .NET on a Linux board, flashing firmware and deploying code, the subset of .NET it provides, allocation and threading discipline, deep sleep, Wi-Fi and MQTT, and keeping an unattended device alive."
tags: [practical, iot, nanoframework, microcontrollers, esp32, deep-sleep, embedded]
---

## What .NET nanoFramework Is

[.NET nanoFramework](https://www.nanoframework.net){:target="_blank" rel="noopener noreferrer"} is a free, open-source platform for running C# directly on microcontrollers. A Raspberry Pi runs a full Linux operating system with gigabytes of RAM. A microcontroller has a few hundred kilobytes of RAM and runs code on bare metal, or on a small real-time kernel, with no general-purpose OS underneath. nanoFramework bridges that gap with a compact runtime and a subset of the .NET class library small enough to fit.

The source lives on [GitHub](https://github.com/nanoframework){:target="_blank" rel="noopener noreferrer"}, and libraries ship as NuGet packages with the `nanoFramework.` prefix. You write C# in Visual Studio or VS Code, deploy over USB, and debug with breakpoints on the device itself.

### nanoFramework vs .NET on a Linux Board

The two ways to run C# on hardware are often confused, and the difference decides almost everything else in this guide.

With **.NET on a single-board computer** such as a Raspberry Pi, the board runs Linux, and your application runs as an ordinary .NET process on top of it. You get the complete runtime: LINQ, async/await, System.Text.Json, and all of NuGet. Linux owns the hardware, and the .NET IoT libraries wrap the GPIO, I2C, and SPI interfaces it exposes.

With **nanoFramework on a microcontroller** such as an ESP32 or an STM32, there is no Linux. You flash the nanoFramework firmware onto the chip, and that firmware contains the runtime. Your compiled C# is deployed separately and runs inside it. You give up most of the .NET API surface in exchange for a device that costs a few dollars, draws milliwatts while running and microamps while asleep, and can run for months on a battery.

The code also runs differently. The compiler produces normal IL, a post-build step converts it into nanoFramework's compact format, and the firmware **interprets** it. There is no JIT. So CPU-heavy work runs far slower than the chip's clock speed suggests, and the time-critical parts of a driver live in the firmware's native code, not in C#.

---

## Hardware and Firmware

### Choosing a Target

ESP32 boards from Espressif are the most common nanoFramework target. The chips integrate Wi-Fi and Bluetooth, development boards are inexpensive, and the ESP32 gets the broadest library coverage and the most community attention. Several ESP32 variants are supported. Boards with external PSRAM give the managed heap megabytes to work with instead of a couple of hundred kilobytes.

STM32 microcontrollers from STMicroelectronics are the other large family, supported on a set of ST's Nucleo and Discovery boards. Most lack integrated Wi-Fi, so networking goes through Ethernet or an external radio module. Texas Instruments and NXP boards are also supported, with thinner library coverage.

Which boards and chip variants are supported changes release by release, so check the [reference and community targets](https://docs.nanoframework.net/content/reference-targets/index.html){:target="_blank" rel="noopener noreferrer"} in the documentation before buying hardware. Confirm that the specific peripherals you need, such as I2C, SPI, deep sleep, or Wi-Fi, are implemented and recently maintained for that target. A board outside the supported list means building custom firmware, which is a C/C++ and toolchain project, not a C# one.

### Flashing the Firmware

Before any C# can run, the nanoFramework firmware has to be flashed onto the chip. This replaces whatever the board shipped with and installs the runtime.

The [nano Firmware Flasher (`nanoff`)](https://github.com/nanoframework/nanoFirmwareFlasher){:target="_blank" rel="noopener noreferrer"} is a .NET global tool that handles this for ESP32, STM32, and TI targets. You connect the board, name the target, and it downloads the matching firmware image and writes it over serial, DFU, or JTAG depending on the chip. After a reboot the device waits for a connection from the IDE.

### Firmware and Package Versions

Many nanoFramework packages are two halves: a managed assembly from NuGet and a native implementation compiled into the firmware. Deployment checks that the native half on the device is the version the managed half expects, and fails when they don't match. When a package update breaks deployment, update the firmware with `nanoff` to a release that matches, or pin the package to the version the firmware supports. The IDE's device explorer shows the firmware version and native assemblies on the connected device.

---

## Development Environment

### IDE, Projects, and Packages

nanoFramework supports Visual Studio on Windows with the [.NET nanoFramework extension](https://github.com/nanoframework/nf-Visual-Studio-extension){:target="_blank" rel="noopener noreferrer"}, and VS Code on Windows, macOS, and Linux with the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=nanoframework.vscode-nanoframework){:target="_blank" rel="noopener noreferrer"}. Both add project templates, device discovery, deployment, and on-device debugging. The Visual Studio extension is the more complete of the two, and the VS Code extension's README lists its current debugging limitations.

Projects use a `.nfproj` file, an old-style project format with nanoFramework-specific additions, rather than an SDK-style `.csproj`. Only packages built for nanoFramework work, and packages built for `net8.0` or `netstandard2.0` don't, since they assume the full .NET class library. Search NuGet for the `nanoFramework.` prefix for the platform's own libraries, and the [nanoFramework.IoT.Device](https://github.com/nanoframework/nanoFramework.IoT.Device){:target="_blank" rel="noopener noreferrer"} repository for sensor and display bindings.

The template's entry point is a classic `Program` class with a static `Main`:

```csharp
using System;
using System.Threading;

namespace MyDevice
{
    public class Program
    {
        public static void Main()
        {
            while (true)
            {
                Console.WriteLine("Alive");
                Thread.Sleep(1000);
            }
        }
    }
}
```

`Main` should never return on a device that is meant to keep working. An always-on application loops forever, and a battery-powered one ends each cycle in deep sleep, as described below.

### Debugging

The IDE talks to the device over nanoFramework's Wire Protocol, carried over the USB serial connection. Starting a debug session builds the project, deploys it, and attaches, so breakpoints, variable inspection, and stepping work on the chip. Each step is a round trip over serial, which makes stepping through a tight loop slow. For timing-sensitive code, instrument with `Debug.WriteLine`, let the device run freely, and read the output in the IDE. Keep the step debugger for logic problems where line-by-line execution is worth the wait.

---

## Programming Model Differences

The language is the same C#, but the constraints change most habits carried over from server or desktop code.

### What Is Available

The core library covers the primitive types, `string`, arrays, exceptions, `DateTime` and `TimeSpan`, and basic threading: `Thread`, `Monitor` (so `lock` works), `Interlocked`, `ManualResetEvent`, `AutoResetEvent`, and `System.Threading.Timer`. `ArrayList` is in the core library; `Hashtable` comes from the `nanoFramework.System.Collections` package, and `StringBuilder` from `nanoFramework.System.Text`. Hardware access (GPIO, I2C, SPI, PWM, ADC, serial) comes from separate `nanoFramework.System.Device.*` packages.

Reflection is available as a subset. `Assembly.GetTypes`, `Type.GetMethods`, `MethodBase.Invoke`, and `GetCustomAttributes` all exist, which is how the `nanoFramework.Json` serializer reads your types. What's missing is the heavier surface: there are no properties in the reflection model and no code generation.

### What Is Not Available

**Generic collections.** The core library contains only a handful of generic types, the `Action`, `Func`, and `EventHandler<T>` delegates. There is no `List<T>` or `Dictionary<TKey, TValue>`, so collections are the non-generic `ArrayList` and `Hashtable`, with a cast on every read.

**LINQ.** There is no `System.Linq`. Filtering, projecting, and aggregating are explicit loops.

**async/await.** There is no `Task`, no `Task.Delay`, and no async `Main`. Concurrency uses threads, and waiting uses `Thread.Sleep` or a wait handle.

**System.Text.Json and Newtonsoft.Json.** Neither runs. Use the `nanoFramework.Json` package, or build small payloads by hand.

**Most of NuGet.** Any package that targets full .NET assumes APIs the platform doesn't have. When a dependency has no nanoFramework equivalent, the options are porting the part you need, if it is small and self-contained, or changing the design so the device doesn't need it.

### Memory and Allocation Discipline

An ESP32 without PSRAM has about 520 KB of SRAM, shared between the firmware, its network stack, thread stacks, and the managed heap. What remains for your objects is often around a hundred kilobytes, and the exact figure depends on the firmware build. Check it on your own device, as shown under Measuring Free Memory below.

The managed heap has a garbage collector, and on this hardware a collection is slow and blocks everything else while it runs. The habit to build is not allocating in code that runs repeatedly, such as a sensor loop that fires every second.

Building strings is the most common hidden allocation. A concatenation such as `"{\"temp\":" + t.ToString("F1") + ",\"hum\":" + h.ToString("F1") + "}"` creates each number's string, then the combined string. A `StringBuilder` created once and cleared on each pass appends into the same buffer:

```csharp
var builder = new StringBuilder();

while (true)
{
    builder.Clear();
    builder.Append("{\"temp\":");
    builder.Append(ReadTemperature().ToString("F1"));
    builder.Append(",\"hum\":");
    builder.Append(ReadHumidity().ToString("F1"));
    builder.Append("}");

    byte[] payload = Encoding.UTF8.GetBytes(builder.ToString());
    mqttClient.Publish("sensors/env", payload);

    Thread.Sleep(30000);
}
```

The final `ToString` and `GetBytes` still allocate once per message, but none of the intermediate strings do. The same rule applies to buffers: allocate a byte array for bus reads once, outside the loop, and read into it on every pass.

### Threading Model

Without async/await, concurrency is `Thread` directly. The runtime schedules managed threads itself inside the interpreter. A typical device runs a main loop plus one or two background threads, for example to sample a sensor faster than the publish interval:

```csharp
private static readonly object _sync = new object();
private static float _latestTemperature;

public static void Main()
{
    var sensorThread = new Thread(() =>
    {
        while (true)
        {
            float reading = ReadTemperature();
            lock (_sync) { _latestTemperature = reading; }
            Thread.Sleep(1000); // sample every second
        }
    });
    sensorThread.Start();

    while (true)
    {
        float snapshot;
        lock (_sync) { snapshot = _latestTemperature; }
        PublishTelemetry(snapshot);
        Thread.Sleep(30000); // publish every 30 seconds
    }
}
```

Every thread costs a stack out of the same small RAM, so keep the count low. Signal between threads with `ManualResetEvent` or `AutoResetEvent` rather than polling a flag.

---

## Built-in Libraries

### GPIO

The `nanoFramework.System.Device.Gpio` package provides a `GpioController` in the `System.Device.Gpio` namespace, deliberately shaped like the one in .NET's IoT libraries. `OpenPin` returns a `GpioPin` you read and write directly:

```csharp
using System.Device.Gpio;

var gpio = new GpioController();

// Output: drive the on-board LED (GPIO 2 on many ESP32 dev boards)
GpioPin led = gpio.OpenPin(2, PinMode.Output);
led.Write(PinValue.High);

// Input with the internal pull-up; the button pulls the pin to ground
GpioPin button = gpio.OpenPin(0, PinMode.InputPullUp);
bool pressed = button.Read() == PinValue.Low;
```

`GpioPin` also has a `ValueChanged` event for edge-driven input and a `DebounceTimeout` property that filters out a mechanical button's bounce.

### I2C, SPI, and PWM

The `nanoFramework.System.Device.I2c`, `nanoFramework.System.Device.Spi`, and `nanoFramework.System.Device.Pwm` packages provide the bus and PWM classes. On an ESP32, most peripherals can be routed to almost any pin, so you usually assign pins in code with the `Configuration` class from `nanoFramework.Hardware.Esp32` before opening the bus. Sensor and display drivers from nanoFramework.IoT.Device wrap these buses in device-specific classes, and many are ports of .NET's own IoT bindings.

### Deep Sleep on ESP32

`nanoFramework.Hardware.Esp32` exposes ESP32-specific features, and the most important is deep sleep. In deep sleep the CPU and most of the chip power down, current falls from tens of milliamps to microamps, and only a small low-power domain stays on to wake the chip. A sensor that reports every five minutes and spends the rest of the time asleep lasts orders of magnitude longer on a battery than one that stays awake.

Waking from deep sleep is a reboot. RAM is lost, and execution starts again from `Main`. So a deep-sleep device isn't a loop with a pause in it. Each boot is one complete cycle:

```csharp
using nanoFramework.Hardware.Esp32;

public static void Main()
{
    // Tells a timer wake apart from a power-on or a pin wake
    Sleep.WakeupCause cause = Sleep.GetWakeupCause();

    ConnectToWifi();
    PublishReading(ReadTemperatureSensor());

    Sleep.EnableWakeupByTimer(TimeSpan.FromMinutes(5));
    Sleep.StartDeepSleep();
    // Nothing after StartDeepSleep runs
}
```

Anything that must survive between cycles, such as a reading counter or the time of the last successful upload, has to be written to flash before sleeping and read back at startup.

A device can also sleep until a pin changes rather than for a fixed time. A door sensor should wake when the door opens, not poll:

```csharp
// Wake when GPIO 33 goes low (the door opening pulls the pin to ground)
Sleep.EnableWakeupByPin(Sleep.WakeupGpioPin.Pin33, 0);
Sleep.StartDeepSleep();
```

### Wi-Fi

On ESP32, the `nanoFramework.System.Device.Wifi` package provides `WifiNetworkHelper`, which connects, waits for an address, and can wait for the clock to be set:

```csharp
using System.Threading;
using nanoFramework.Networking;

var cts = new CancellationTokenSource(60000);

bool connected = WifiNetworkHelper.ConnectDhcp(
    "MySSID",
    "MyPassword",
    reconnectionKind: WifiReconnectionKind.Automatic,
    requiresDateTime: true,
    token: cts.Token);

if (!connected)
{
    // Inspect WifiNetworkHelper.Status and HelperException, then retry or sleep
}
```

The call blocks until the connection is up or the token expires. `WifiReconnectionKind.Automatic` has the firmware rejoin the network after it drops. `requiresDateTime: true` matters more than it looks, because the device has no battery-backed clock by default. Until the time is set over the network, `DateTime.UtcNow` returns a date near the start of the epoch, which breaks TLS certificate validation and every timestamp you send.

HTTP comes from the `nanoFramework.System.Net.Http` package, which provides an `HttpClient` with a synchronous API. TLS needs the server's root CA certificate on the device, supplied either in code or through the device's stored configuration.

### MQTT

The `nanoFramework.M2Mqtt` package provides an MQTT client that works over plain TCP or TLS:

```csharp
using System.Text;
using nanoFramework.M2Mqtt;
using nanoFramework.M2Mqtt.Messages;

var client = new MqttClient("mqtt.broker.local");
client.Connect("device-001");

// Publish a message
byte[] payload = Encoding.UTF8.GetBytes("{\"temp\":22.5}");
client.Publish("sensors/temperature", payload);

// Receive commands
client.MqttMsgPublishReceived += (sender, args) =>
{
    string command = new string(Encoding.UTF8.GetChars(args.Message));
    HandleCommand(command);
};
client.Subscribe(new[] { "devices/device-001/commands" }, new[] { MqttQoSLevel.AtLeastOnce });
```

Like the rest of the platform, the client is synchronous: `Connect` and `Publish` block the calling thread, and received messages arrive on a thread the client owns. Keep command formats simple, such as a short string like `restart` or `sleep`, so the device doesn't need to parse JSON at all.

For Azure IoT Hub, the `nanoFramework.Azure.Devices.Client` package provides a `DeviceClient` that connects over MQTT with a SAS key or an X.509 certificate. It sends telemetry with `SendMessage`, and it supports device twins and direct methods.

---

## Keeping an Unattended Device Alive

### Reconnect Before Every Publish

Wi-Fi and broker connections drop, and a device that assumes its startup connection is still up will fail silently from then on. Check both before each publish and reconnect when needed:

```csharp
private static void EnsureConnected(MqttClient client)
{
    if (WifiNetworkHelper.Status != NetworkHelperStatus.NetworkIsReady)
    {
        WifiNetworkHelper.Reconnect(requiresDateTime: true, token: new CancellationTokenSource(30000).Token);
    }

    if (!client.IsConnected)
    {
        client.Connect("device-001");
    }
}
```

A deep-sleep device mostly avoids this problem, because it connects fresh on every wake.

### Recovering From Hangs

A device in a cupboard or on a pole can't be power-cycled by hand, and a network call or a sensor read that never returns leaves it stuck until someone does. The standard defence is a watchdog: a hardware timer that resets the chip unless the application keeps proving it's alive.

nanoFramework's ESP32 library doesn't expose the chip's watchdog timers to C#, so a C# application has to build this itself or add it in hardware. Two approaches work:

- **A software supervisor.** Record a timestamp at the end of each successful loop iteration. A separate thread checks it periodically and calls `Power.RebootDevice()` from `nanoFramework.Runtime.Native` when it's too old. This recovers from a hung managed call, but not from a fault that stops the runtime itself.
- **An external watchdog.** A supervisor chip or a power-management IC with a watchdog, which a GPIO pin or a bus write resets on each loop. This covers every kind of hang, at the cost of a part on the board.

Wrap each loop iteration in a catch-all `try`/`catch` as well, so that one bad reading is logged and skipped rather than ending `Main`.

### Measuring Free Memory

An `OutOfMemoryException`, or erratic behaviour that grows worse the longer the device runs, usually means the heap is being exhausted. `nanoFramework.Runtime.Native.GC.Run` forces a collection and returns the free heap in bytes, which makes it easy to watch during development:

```csharp
// Force a collection (true also compacts) and report free heap
uint freeBytes = nanoFramework.Runtime.Native.GC.Run(true);
Debug.WriteLine("Free heap: " + freeBytes.ToString() + " bytes");
```

Log it once per loop iteration. A number that drifts steadily down points at something accumulating, and one that dips at the same point every cycle shows where the large allocation is. Remove the call from production builds, since forcing a collection costs time and blocks the device while it runs.

---

## When to Use nanoFramework vs .NET on a Linux Board

**Choose nanoFramework** when the device runs on a battery for weeks or months, when you are deploying many identical units and per-unit cost matters, or when the device has one focused job such as reading a sensor and publishing the value.

**Choose .NET on a Linux board** when you are prototyping and don't want to budget memory, when the device runs several services or complex logic, when it has mains power, or when you need libraries that exist only for full .NET, such as ML inference or image processing.

| Consideration | nanoFramework (microcontroller) | .NET on a Linux board |
|---------------|---------------------|--------------------------|
| **Operating system** | None, or a small real-time kernel inside the firmware | Linux |
| **RAM** | Hundreds of KB, a few MB with PSRAM | Hundreds of MB to several GB |
| **Code execution** | Interpreted | JIT or ahead-of-time compiled |
| **Power** | Milliwatts running, microwatts in deep sleep | Watts |
| **API surface** | Subset of .NET, no generic collections, LINQ, or async | Full .NET |
| **Packages** | nanoFramework packages only | All of NuGet |
| **Startup** | Seconds or less from power-on | Tens of seconds for Linux to boot |
| **Unit cost** | A few dollars for the chip | Tens of dollars for the board |
