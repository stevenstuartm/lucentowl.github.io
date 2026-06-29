---
title: ".NET IoT Libraries"
layout: guide
category: IoT
subcategory: .NET IoT Development
description: "System.Device.Gpio and Iot.Device.Bindings for Raspberry Pi development, covering GPIO, I2C, SPI, and PWM communication with sensors and actuators using C#."
tags: [iot, dotnet, raspberry-pi, sensors, embedded, fundamentals, practical]
---

## What Are .NET IoT Libraries

The [.NET IoT Libraries](https://github.com/dotnet/iot){:target="_blank" rel="noopener noreferrer"} are a set of NuGet packages that let you write C# applications to interact with hardware peripherals on Linux single-board computers like the Raspberry Pi. Rather than dropping into C or Python to toggle a GPIO pin or read a sensor over I2C, you can work entirely in .NET, with full access to the ecosystem you already know including dependency injection, async/await, logging, and unit testing.

There are two primary packages. [System.Device.Gpio](https://www.nuget.org/packages/System.Device.Gpio){:target="_blank" rel="noopener noreferrer"} provides the low-level abstractions for GPIO, I2C, SPI, and PWM. [Iot.Device.Bindings](https://www.nuget.org/packages/Iot.Device.Bindings){:target="_blank" rel="noopener noreferrer"} sits on top of that and provides community-maintained, device-specific APIs for hundreds of sensors, displays, and actuators. Most projects use both: device bindings for any hardware that has one, and raw `System.Device.Gpio` for everything else.

The primary supported platform is Raspberry Pi running a 64-bit Linux OS like Raspberry Pi OS. Other Linux SBCs such as HummingBoard and BeagleBone work as well, provided the board exposes its GPIO pins through the standard Linux kernel interfaces. Windows IoT Core, once Microsoft's answer to embedded Windows, is deprecated and is not a target for these libraries.

---

## Project Setup

### Creating the Project

A console app is the right starting point for most IoT work. From your development machine:

```bash
dotnet new console -n MyIotApp
cd MyIotApp
dotnet add package System.Device.Gpio
dotnet add package Iot.Device.Bindings
```

Target .NET 8 or later. The IoT libraries track the current LTS release and take advantage of runtime improvements in newer versions. In your `.csproj`, confirm the target framework:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="System.Device.Gpio" Version="3.*" />
    <PackageReference Include="Iot.Device.Bindings" Version="3.*" />
  </ItemGroup>
</Project>
```

### Deploying to the Raspberry Pi

The recommended workflow is to write and compile on your development machine, then publish a self-contained binary and copy it to the Pi over SSH. You do not need .NET installed on the Pi when publishing self-contained.

```bash
dotnet publish -c Release -r linux-arm64 --self-contained true -o ./publish
scp -r ./publish/* pi@raspberrypi.local:/home/pi/myapp/
ssh pi@raspberrypi.local "chmod +x /home/pi/myapp/MyIotApp && /home/pi/myapp/MyIotApp"
```

Use `linux-arm64` for Raspberry Pi 4 and 5 running a 64-bit OS. For older Pi models or a 32-bit OS, use `linux-arm` instead.

### Remote Debugging with VS Code

For an interactive debugging experience, the [.NET debugger for VS Code](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csharp){:target="_blank" rel="noopener noreferrer"} supports remote attach over SSH. Install `vsdbg` on the Pi:

```bash
curl -sSL https://aka.ms/getvsdbgsh | /bin/sh /dev/stdin -v latest -l ~/vsdbg
```

Then configure a `launch.json` in VS Code with `pipeTransport` pointing at the Pi via SSH and the `vsdbg` path. With this setup you can set breakpoints and step through hardware interactions just as you would with a normal application.

---

## GPIO with System.Device.Gpio

### What GPIO Is

General-purpose input/output pins are the basic digital signaling interface on single-board computers. A pin configured as an output can be driven high (3.3V on a Raspberry Pi) or low (0V), which lets you turn things on and off. A pin configured as an input reads the current voltage level and reports it as high or low, which lets you detect events like button presses or sensor triggers.

### Opening a Pin and Writing Output

`GpioController` is the entry point for all GPIO operations. The example below opens pin 17 as an output and blinks an LED:

```csharp
using System.Device.Gpio;

using var controller = new GpioController();

int ledPin = 17; // BCM pin numbering
controller.OpenPin(ledPin, PinMode.Output);

for (int i = 0; i < 10; i++)
{
    controller.Write(ledPin, PinValue.High); // LED on
    Thread.Sleep(500);
    controller.Write(ledPin, PinValue.Low);  // LED off
    Thread.Sleep(500);
}

controller.ClosePin(ledPin);
```

The `GpioController` uses BCM (Broadcom chip) pin numbers by default on the Raspberry Pi, which is the numbering scheme printed on most pinout diagrams. Pass `PinNumberingScheme.Board` to the constructor if you prefer the physical board numbering instead.

### Reading Digital Input

Reading a button or switch works the same way, with `PinMode.Input` and a call to `Read`:

```csharp
using System.Device.Gpio;

using var controller = new GpioController();

int buttonPin = 22;
controller.OpenPin(buttonPin, PinMode.Input);

while (true)
{
    PinValue value = controller.Read(buttonPin);
    Console.WriteLine(value == PinValue.High ? "Button pressed" : "Button released");
    Thread.Sleep(50);
}
```

This polling approach works for simple scenarios. For anything timing-sensitive or battery-sensitive, event-driven GPIO is a better choice.

### Pull-Up and Pull-Down Resistors in Code

When a pin is disconnected from a definite voltage, it floats and reads unpredictably. Physical pull-up or pull-down resistors solve this by tying the pin to a known voltage through a large resistance. The Raspberry Pi has built-in configurable pull resistors, and you can enable them in code:

```csharp
// Pull-up: pin reads High when nothing is connected, Low when the button pulls it to ground
controller.OpenPin(buttonPin, PinMode.InputPullUp);

// Pull-down: pin reads Low when nothing is connected, High when button connects it to 3.3V
controller.OpenPin(buttonPin, PinMode.InputPullDown);
```

`PinMode.InputPullUp` is the most common choice for buttons wired between the GPIO pin and ground. The pin stays reliably high until the button is pressed and pulls it low. This is called active-low signaling.

### Event-Driven GPIO

Polling a pin in a tight loop wastes CPU time and can miss very short pulses. The `RegisterCallbackForPinValueChangedEvent` method registers a delegate that the runtime calls when the pin transitions, without any polling overhead on your side:

```csharp
using System.Device.Gpio;

using var controller = new GpioController();
int buttonPin = 22;
controller.OpenPin(buttonPin, PinMode.InputPullUp);

controller.RegisterCallbackForPinValueChangedEvent(
    buttonPin,
    PinEventTypes.Falling, // Falling = High to Low (button press with pull-up wiring)
    OnButtonPressed);

Console.WriteLine("Waiting for button press. Press Ctrl+C to exit.");
Thread.Sleep(Timeout.Infinite);

void OnButtonPressed(object sender, PinValueChangedEventArgs args)
{
    Console.WriteLine($"Button pressed on pin {args.PinNumber} at {DateTime.Now:T}");
}
```

You can listen for `PinEventTypes.Rising`, `PinEventTypes.Falling`, or both with `PinEventTypes.Rising | PinEventTypes.Falling`. Unregister the callback with `UnregisterCallbackForPinValueChangedEvent` when you no longer need it.

---

## Device Bindings with Iot.Device.Bindings

### How Device Bindings Work

Raw I2C and SPI communication requires you to know the exact register map of the sensor, read the datasheet to understand the initialization sequence, and manually convert raw byte arrays into meaningful values. Device bindings encapsulate all of that. Each binding is a C# class that handles the protocol details and exposes a clean API with named properties and methods.

The [dotnet/iot repository](https://github.com/dotnet/iot/tree/main/src/devices){:target="_blank" rel="noopener noreferrer"} contains bindings for over two hundred components, organized by manufacturer and device family. If a binding exists for your sensor, using it is almost always preferable to writing raw I2C or SPI code yourself.

### Reading a BME280 Temperature and Humidity Sensor

The BME280 is a popular sensor from Bosch that measures temperature, humidity, and barometric pressure over I2C or SPI. The device binding handles the calibration data, compensation formulas, and oversampling configuration internally:

```csharp
using System.Device.I2c;
using Iot.Device.Bmxx80;
using Iot.Device.Bmxx80.PowerMode;
using UnitsNet;

// Standard BME280 I2C address is 0x76; SDO pin high gives 0x77
var i2cSettings = new I2cConnectionSettings(busId: 1, deviceAddress: 0x76);
using var i2cDevice = I2cDevice.Create(i2cSettings);
using var bme280 = new Bme280(i2cDevice);

bme280.TemperatureSampling = Sampling.LowPower;
bme280.HumiditySampling = Sampling.LowPower;
bme280.PressureSampling = Sampling.LowPower;

while (true)
{
    bme280.SetPowerMode(Bmxx80PowerMode.Forced);
    await Task.Delay(bme280.GetMeasurementDuration());

    if (bme280.TryReadTemperature(out Temperature temperature) &&
        bme280.TryReadHumidity(out RelativeHumidity humidity) &&
        bme280.TryReadPressure(out Pressure pressure))
    {
        Console.WriteLine($"Temperature: {temperature.DegreesCelsius:F1}°C");
        Console.WriteLine($"Humidity:    {humidity.Percent:F1}%");
        Console.WriteLine($"Pressure:    {pressure.Hectopascals:F1} hPa");
    }

    await Task.Delay(TimeSpan.FromSeconds(5));
}
```

Notice that the binding uses [UnitsNet](https://www.nuget.org/packages/UnitsNet){:target="_blank" rel="noopener noreferrer"} to represent physical quantities. You get `Temperature`, `RelativeHumidity`, and `Pressure` objects with unit conversion built in, rather than raw floats that could mean anything.

### Reading an Accelerometer

The MPU-6050 is a common 6-axis IMU (accelerometer plus gyroscope) used in robotics projects. Its binding follows the same pattern:

```csharp
using System.Device.I2c;
using Iot.Device.Mpu6050;

var i2cSettings = new I2cConnectionSettings(busId: 1, deviceAddress: 0x68);
using var i2cDevice = I2cDevice.Create(i2cSettings);
using var mpu = new Mpu6050(i2cDevice);

while (true)
{
    var accel = mpu.GetAccelerometer();
    var gyro = mpu.GetGyroscope();
    Console.WriteLine($"Accel X:{accel.X:F2} Y:{accel.Y:F2} Z:{accel.Z:F2} g");
    Console.WriteLine($"Gyro  X:{gyro.X:F2} Y:{gyro.Y:F2} Z:{gyro.Z:F2} dps");
    await Task.Delay(100);
}
```

### Finding a Binding

Browse the [devices directory on GitHub](https://github.com/dotnet/iot/tree/main/src/devices){:target="_blank" rel="noopener noreferrer"} and search by sensor name or chip identifier. Each device subdirectory contains a README with wiring diagrams and example code. If a binding does not exist for your component, the raw I2C and SPI APIs described in the next sections are how you build your own.

---

## I2C Communication

### What I2C Is

I2C (Inter-Integrated Circuit) is a two-wire serial bus that lets a controller device communicate with multiple peripheral devices over the same pair of wires: SDA (data) and SCL (clock). Each peripheral has a 7-bit address hardwired into it, so a single I2C bus can support up to 127 devices simultaneously. Most sensors and displays use I2C because it requires only two pins and short wiring runs.

On the Raspberry Pi, I2C bus 1 is exposed on physical pins 3 (SDA) and 5 (SCL). Enable it through `raspi-config` or by adding `dtparam=i2c_arm=on` to `/boot/config.txt`.

### Opening an I2C Bus and Addressing a Device

```csharp
using System.Device.I2c;

// busId 1 = /dev/i2c-1 on Raspberry Pi
// deviceAddress is the 7-bit address of your sensor
var settings = new I2cConnectionSettings(busId: 1, deviceAddress: 0x48);
using var device = I2cDevice.Create(settings);
```

### Reading and Writing Registers

Most I2C sensors follow a register-based protocol: you write a register address to select what you want to read, then read back one or more bytes of data.

```csharp
// Write a single byte (e.g., configuration register address followed by value)
byte[] configCommand = [0x01, 0x04]; // register 0x01, value 0x04
device.Write(configCommand);

// Read two bytes from the device (e.g., a 16-bit measurement)
Span<byte> readBuffer = stackalloc byte[2];
device.Read(readBuffer);
short rawValue = (short)((readBuffer[0] << 8) | readBuffer[1]);

// WriteRead: send a register address, then immediately read the response
Span<byte> writeBuffer = stackalloc byte[1];
Span<byte> result = stackalloc byte[2];
writeBuffer[0] = 0x00; // register 0x00 = conversion result
device.WriteRead(writeBuffer, result);
```

`WriteRead` is a combined operation that many I2C devices require. The controller sends the register address without releasing the bus, then immediately reads the response. Using `Span<byte>` and `stackalloc` avoids heap allocations, which matters in tight sensor polling loops.

### When to Use Raw I2C vs a Device Binding

Use a device binding whenever one exists. Writing raw I2C code correctly requires reading the datasheet carefully, handling the initialization sequence, accounting for calibration data, and validating the bit-level protocol. A binding gets all of that right so you do not have to.

Raw I2C makes sense when you are prototyping with an obscure sensor that has no binding, contributing a new binding to the community, or integrating a proprietary device from a vendor. In those cases, the patterns above are the foundation.

---

## SPI Communication

### What SPI Is

SPI (Serial Peripheral Interface) is a four-wire synchronous bus that operates at much higher speeds than I2C. The four signals are SCLK (clock), MOSI (controller to peripheral), MISO (peripheral to controller), and CS (chip select, one per device). Because CS is per-device rather than address-based, adding more SPI devices requires more GPIO pins for chip select lines.

SPI is common for high-speed components like ADCs, LCD displays, radio modules, and SD card interfaces where I2C's speed or electrical limitations would be a bottleneck.

### Opening an SPI Device

```csharp
using System.Device.Spi;

var settings = new SpiConnectionSettings(busId: 0, chipSelectLine: 0)
{
    ClockFrequency = 1_000_000, // 1 MHz
    Mode = SpiMode.Mode0,       // CPOL=0, CPHA=0
    DataBitLength = 8
};

using var device = SpiDevice.Create(settings);
```

`SpiMode` controls the clock polarity (CPOL) and phase (CPHA). Mode 0 (CPOL=0, CPHA=0) is the most common, but check your component's datasheet since using the wrong mode produces garbled data.

| SPI Mode | CPOL | CPHA | Clock idle | Data sampled on |
|----------|------|------|------------|-----------------|
| Mode 0   | 0    | 0    | Low        | Rising edge     |
| Mode 1   | 0    | 1    | Low        | Falling edge    |
| Mode 2   | 1    | 0    | High       | Falling edge    |
| Mode 3   | 1    | 1    | High       | Rising edge     |

### Full-Duplex Read and Write

SPI is full-duplex: the controller clocks out data on MOSI and simultaneously clocks in data on MISO. The `TransferFullDuplex` method reflects this:

```csharp
// Send a command byte and receive a response byte simultaneously
byte[] writeBuffer = [0x80]; // command to read from address 0x00
byte[] readBuffer = new byte[1];
device.TransferFullDuplex(writeBuffer, readBuffer);

// Write only (response ignored)
device.Write([0x40, 0xAA]); // two-byte command

// Read only (send dummy bytes to generate clock)
Span<byte> receiveBuffer = stackalloc byte[4];
device.Read(receiveBuffer);
```

For devices that use a request-response pattern where you send a command and then read the result, you typically need two separate transfers or a transfer with enough dummy bytes to clock in the full response.

### When to Use SPI vs I2C

The choice between SPI and I2C is usually dictated by what your component supports, but when you have options, a few factors push the decision.

SPI is better when throughput matters. An SPI bus at 10-50 MHz is common and practical; I2C tops out at 3.4 MHz in high-speed mode and typically runs at 400 kHz in real circuits. Displays that refresh frequently, high-sample-rate ADCs, and SD card readers all benefit from SPI's speed.

I2C is better when you need to connect many devices with minimal wiring. Two wires for the entire bus versus four wires plus one CS line per device adds up quickly in a dense sensor network.

---

## PWM

### What PWM Is

Pulse-width modulation (PWM) controls the average power delivered to a device by rapidly switching a digital signal on and off. The fraction of time the signal spends high is the duty cycle, expressed as a percentage. A 50% duty cycle delivers half the average power of a constant high signal. PWM is how you dim LEDs smoothly, control the speed of DC motors, and position servo motors without a dedicated DAC.

### Creating a PWM Channel

```csharp
using System.Device.Pwm;

// Hardware PWM: channel 0 on the Raspberry Pi GPIO pin 18 (PWM0)
using var pwmChannel = PwmChannel.Create(
    chip: 0,
    channel: 0,
    frequency: 1000,      // 1 kHz
    dutyCyclePercentage: 0.5); // 50% duty cycle

pwmChannel.Start();
```

On the Raspberry Pi, hardware PWM is available on GPIO 12 (PWM0), GPIO 13 (PWM1), GPIO 18 (PWM0), and GPIO 19 (PWM1) depending on alternate function assignments. Enable the PWM overlay in `/boot/config.txt` with `dtoverlay=pwm,pin=18,func=2` for GPIO 18.

### LED Dimming

Gradually changing the duty cycle produces a smooth fade effect:

```csharp
using System.Device.Pwm;

using var pwmChannel = PwmChannel.Create(chip: 0, channel: 0, frequency: 1000);
pwmChannel.Start();

// Fade in
for (double duty = 0; duty <= 1.0; duty += 0.01)
{
    pwmChannel.DutyCycle = duty;
    await Task.Delay(20);
}

// Fade out
for (double duty = 1.0; duty >= 0; duty -= 0.01)
{
    pwmChannel.DutyCycle = duty;
    await Task.Delay(20);
}

pwmChannel.Stop();
```

### Servo Motor Positioning

Hobby servo motors expect a 50 Hz PWM signal where the pulse width encodes the target position. A 1 ms pulse typically corresponds to the minimum angle (0°), a 1.5 ms pulse to the center (90°), and a 2 ms pulse to the maximum angle (180°).

```csharp
using System.Device.Pwm;

// Servos expect 50 Hz
using var servo = PwmChannel.Create(chip: 0, channel: 0, frequency: 50);
servo.Start();

void SetAngle(double degrees)
{
    // Map 0-180 degrees to 1ms-2ms pulse width
    double minPulse = 0.001; // 1 ms
    double maxPulse = 0.002; // 2 ms
    double period = 1.0 / 50; // 20 ms at 50 Hz

    double pulseWidth = minPulse + (degrees / 180.0) * (maxPulse - minPulse);
    servo.DutyCycle = pulseWidth / period;
}

SetAngle(0);
await Task.Delay(1000);
SetAngle(90);
await Task.Delay(1000);
SetAngle(180);
await Task.Delay(1000);
```

### Software PWM vs Hardware PWM

Hardware PWM is generated by dedicated timer peripherals in the Raspberry Pi's chip. The signal is rock-solid regardless of what the CPU is doing, which matters for servo motors and anything else that interprets timing with precision.

Software PWM is emulated by a thread toggling a GPIO pin. It works for LED dimming where a few milliseconds of jitter is invisible, but it consumes CPU time and can produce audible noise in motors due to timing irregularities. The `System.Device.Gpio` library includes a software PWM implementation for pins that do not have hardware PWM, but prefer hardware PWM whenever timing precision matters.

---

## Common Patterns

### Sensor Polling Loop with Configurable Intervals

Most IoT applications spend the majority of their time waiting between readings. A properly structured polling loop uses `Task.Delay` rather than `Thread.Sleep` so the thread is returned to the pool during idle time, and respects a `CancellationToken` so the application can shut down cleanly:

```csharp
public async Task RunSensorLoopAsync(
    TimeSpan interval,
    CancellationToken cancellationToken)
{
    while (!cancellationToken.IsCancellationRequested)
    {
        try
        {
            await ReadAndPublishAsync(cancellationToken);
        }
        catch (OperationCanceledException)
        {
            break;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sensor read failed");
            // Continue the loop; transient failures are expected in hardware
        }

        try
        {
            await Task.Delay(interval, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            break;
        }
    }
}
```

The interval is a configuration value, not a hardcoded constant. This lets you adjust the polling rate at runtime or through environment variables without recompiling.

### Graceful Shutdown and Pin Cleanup

GPIO pins hold their state when a program exits abruptly, which can leave an LED on, a relay closed, or a motor running. Use `IDisposable` patterns and host lifetime hooks to ensure cleanup:

```csharp
public class LedController : IDisposable
{
    private readonly GpioController _gpio;
    private readonly int _pin;
    private bool _disposed;

    public LedController(int pin)
    {
        _gpio = new GpioController();
        _pin = pin;
        _gpio.OpenPin(pin, PinMode.Output);
        _gpio.Write(pin, PinValue.Low);
    }

    public void TurnOn() => _gpio.Write(_pin, PinValue.High);
    public void TurnOff() => _gpio.Write(_pin, PinValue.Low);

    public void Dispose()
    {
        if (!_disposed)
        {
            _gpio.Write(_pin, PinValue.Low); // ensure off before releasing
            _gpio.ClosePin(_pin);
            _gpio.Dispose();
            _disposed = true;
        }
    }
}
```

When running as a hosted service in a generic host, connect cleanup to the application lifetime:

```csharp
public class SensorService : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // stoppingToken is cancelled when the host is shutting down
        await RunSensorLoopAsync(TimeSpan.FromSeconds(5), stoppingToken);
    }
}
```

The `BackgroundService` base class wires the `stoppingToken` to the host's shutdown signal, so Ctrl+C or a SIGTERM from the OS triggers clean teardown automatically.

### Error Handling for I2C and SPI Failures

Hardware communication fails in ways software typically does not. I2C devices can become unresponsive after a brownout, SPI transactions can time out if a chip is slow to respond, and loose wiring causes intermittent failures that appear as exceptions. Treat these as expected transient conditions:

```csharp
public async Task<Temperature?> TryReadTemperatureAsync()
{
    const int maxRetries = 3;

    for (int attempt = 1; attempt <= maxRetries; attempt++)
    {
        try
        {
            if (_bme280.TryReadTemperature(out Temperature temp))
                return temp;

            _logger.LogWarning("Temperature read returned false on attempt {Attempt}", attempt);
        }
        catch (IOException ex)
        {
            _logger.LogWarning(ex,
                "I2C communication error on attempt {Attempt} of {Max}",
                attempt, maxRetries);
        }

        if (attempt < maxRetries)
            await Task.Delay(TimeSpan.FromMilliseconds(100));
    }

    _logger.LogError("Failed to read temperature after {Max} attempts", maxRetries);
    return null;
}
```

After exhausting retries, returning null (or a `Result` type) lets the caller decide whether to skip the reading, trigger an alert, or initiate a sensor reset. Throwing up the stack on every transient failure tends to crash the polling loop in ways that require a manual restart.

### Dependency Injection and Testability

The hardware interaction classes in `System.Device.Gpio` do not implement interfaces, which makes pure unit testing difficult. A practical approach is to introduce your own abstractions:

```csharp
public interface ITemperatureSensor
{
    Task<double?> ReadCelsiusAsync(CancellationToken cancellationToken = default);
}

public class Bme280TemperatureSensor : ITemperatureSensor
{
    private readonly Bme280 _sensor;

    public Bme280TemperatureSensor(I2cDevice i2cDevice)
    {
        _sensor = new Bme280(i2cDevice);
        _sensor.TemperatureSampling = Sampling.LowPower;
    }

    public async Task<double?> ReadCelsiusAsync(CancellationToken cancellationToken = default)
    {
        _sensor.SetPowerMode(Bmxx80PowerMode.Forced);
        await Task.Delay(_sensor.GetMeasurementDuration(), cancellationToken);

        return _sensor.TryReadTemperature(out Temperature temp)
            ? temp.DegreesCelsius
            : null;
    }
}
```

The calling code depends only on `ITemperatureSensor`. In tests, you substitute a fake implementation that returns canned values. Integration tests that actually talk to hardware stay separate and run only on devices with the sensor attached. This boundary makes business logic easy to unit test without any hardware present.

Register everything in the generic host:

```csharp
var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddSingleton(_ =>
{
    var settings = new I2cConnectionSettings(1, 0x76);
    return I2cDevice.Create(settings);
});

builder.Services.AddSingleton<ITemperatureSensor, Bme280TemperatureSensor>();
builder.Services.AddHostedService<SensorService>();

var host = builder.Build();
await host.RunAsync();
```

---

## Supported Hardware

### Raspberry Pi 4 and 5

Raspberry Pi 4 and 5 are the primary development targets. Both run a 64-bit Arm processor, support standard I2C and SPI buses on their 40-pin GPIO headers, and have hardware PWM channels available. The `linux-arm64` runtime identifier covers both.

Raspberry Pi OS (64-bit) is the recommended operating system. Ubuntu Server 22.04 and 24.04 LTS for ARM64 also work and may be preferable in production scenarios where you want a more minimal base image and long-term OS support.

### Other Linux SBCs

The .NET IoT libraries work on any Linux SBC that exposes GPIO through the Linux kernel's standard `gpio` and `gpiod` subsystems. Common alternatives include HummingBoard (NXP i.MX), BeagleBone Black (TI AM335x), and ROCK Pi boards. The runtime identifier for non-Pi ARM64 boards is still `linux-arm64` and for 32-bit ARM boards it is `linux-arm`.

Driver support varies by board. Some SBCs require board-specific overlays or device tree changes to expose I2C and SPI buses, and not all boards support hardware PWM on every GPIO pin. Check the board's documentation to confirm which buses are available and on which pins.

### What Does Not Work

Windows IoT Core is deprecated and not a supported target. Raspberry Pi OS running in 32-bit mode on a 64-bit Pi 4 or 5 will work with `linux-arm`, but 64-bit OS is recommended for access to the full memory address space and better runtime performance.

GPIO interaction also does not work inside a Docker container by default. The container needs access to the host's `/dev/gpiomem` and I2C/SPI device files, which requires running with `--privileged` or with explicit `--device` flags. Privileged containers are acceptable for single-purpose IoT applications where the security boundary is the physical device itself rather than the container runtime.

---

## Quick Reference

### Package Reference

| Package | NuGet | Purpose |
|---------|-------|---------|
| [System.Device.Gpio](https://www.nuget.org/packages/System.Device.Gpio){:target="_blank" rel="noopener noreferrer"} | `System.Device.Gpio` | GPIO, I2C, SPI, PWM primitives |
| [Iot.Device.Bindings](https://www.nuget.org/packages/Iot.Device.Bindings){:target="_blank" rel="noopener noreferrer"} | `Iot.Device.Bindings` | Device-specific sensor and actuator APIs |
| [UnitsNet](https://www.nuget.org/packages/UnitsNet){:target="_blank" rel="noopener noreferrer"} | `UnitsNet` | Physical units (temperature, pressure, etc.) |

### Communication Protocol Comparison

| Protocol | Wires | Speed | Addressing | Best For |
|----------|-------|-------|------------|----------|
| GPIO     | 1 per signal | Instantaneous | Pin number | Simple on/off, digital signals |
| I2C      | 2 (SDA, SCL) | 100 kHz to 3.4 MHz | 7-bit address | Many sensors, short distances |
| SPI      | 4+ (SCLK, MOSI, MISO, CS) | 1-50+ MHz | Chip select pin | High-speed displays, ADCs, SD cards |
| PWM      | 1 | N/A (frequency-based) | Channel number | Motor control, LED dimming, servos |

### GPIO PinMode Reference

| PinMode | Use |
|---------|-----|
| `Output` | Drive the pin high or low |
| `Input` | Read pin state (floating, needs external resistor) |
| `InputPullUp` | Read pin state with internal pull-up to 3.3V |
| `InputPullDown` | Read pin state with internal pull-down to ground |

### Common I2C Device Addresses

| Device | Default Address | Notes |
|--------|----------------|-------|
| BME280 | 0x76 or 0x77 | SDO pin selects address |
| MPU-6050 | 0x68 or 0x69 | AD0 pin selects address |
| ADS1115 | 0x48 to 0x4B | ADDR pin selects address |
| SSD1306 OLED | 0x3C or 0x3D | SA0 pin selects address |
| MCP9808 | 0x18 to 0x1F | A0-A2 pins select address |

Use `i2cdetect -y 1` on the Raspberry Pi to scan the bus and display all connected device addresses.
