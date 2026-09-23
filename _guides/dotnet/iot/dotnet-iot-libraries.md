---
title: ".NET IoT Libraries"
layout: guide
category: ".NET & C#"
subcategory: "IoT & Embedded"
description: "System.Device.Gpio and Iot.Device.Bindings on a Raspberry Pi: how the library reaches the pins, GPIO input and output, I2C, SPI, and PWM, device bindings for sensors, and the patterns for polling, cleanup, retries, and testable hardware code."
tags: [practical, iot, raspberry-pi, gpio, i2c, spi, pwm]
---

## What Are .NET IoT Libraries

The [.NET IoT Libraries](https://github.com/dotnet/iot){:target="_blank" rel="noopener noreferrer"} are a set of NuGet packages for writing C# applications that talk to hardware peripherals on Linux single-board computers like the Raspberry Pi. Rather than dropping into C or Python to toggle a GPIO pin or read a sensor over I2C, you work entirely in .NET, with dependency injection, async/await, logging, and unit testing all still available.

There are two primary packages. [System.Device.Gpio](https://www.nuget.org/packages/System.Device.Gpio){:target="_blank" rel="noopener noreferrer"} provides the low-level abstractions for GPIO, I2C, SPI, and PWM. [Iot.Device.Bindings](https://www.nuget.org/packages/Iot.Device.Bindings){:target="_blank" rel="noopener noreferrer"} sits on top of it and provides community-maintained, device-specific APIs for well over a hundred sensors, displays, and actuators. Most projects use both: a device binding for any hardware that has one, and raw `System.Device.Gpio` for everything else.

The main target is a Raspberry Pi running a 64-bit Linux OS such as Raspberry Pi OS. Other Linux boards work when they expose their pins through the standard Linux kernel interfaces. The bindings package also supports USB adapter chips such as the FTDI FT232H, which give a Windows, macOS, or Linux PC its own GPIO, I2C, and SPI pins. The library still carries a code path for Windows 10 IoT Core on a Raspberry Pi 2 or 3, but that is a legacy platform, not a place to start a project.

### How the Library Reaches the Pins

Your code never touches the hardware directly. It calls a `GpioController`, the controller delegates to a **driver**, and the driver talks to the Linux kernel. Which driver you get decides which device files the process needs, which pin modes work, and whether the code runs on a given board at all.

The parameterless `new GpioController()` picks the driver by detecting the board:

| Board | Driver chosen | Kernel interface |
| --- | --- | --- |
| Raspberry Pi 3, 4, 400, Zero W, Zero 2 W, Compute Module 3 and 4 | `RaspberryPi3Driver` | Memory-mapped GPIO registers through `/dev/gpiomem` |
| Raspberry Pi 5 | `LibGpiodDriver` or `LibGpiodV2Driver` on the RP1 chip | The GPIO character device (`/dev/gpiochipN`) through libgpiod |
| Any other Linux board | libgpiod v1, then libgpiod v2, then `SysFsDriver` | `/dev/gpiochip0`, falling back to the legacy `/sys/class/gpio` |

Two practical consequences follow. First, the Raspberry Pi 5 moved GPIO onto a separate I/O chip, so on a Pi 5 the library depends on the native libgpiod library being present, and code that assumed `/dev/gpiomem` does not carry over. Second, when the default guess is wrong for your board, pass a driver explicitly, for example `new GpioController(new LibGpiodDriver(gpioChip: 1))`.

Containers follow from the same table. GPIO does not work inside a Docker container by default, because the container can't see the host's device files. Map in the ones your driver needs (`/dev/gpiomem` or `/dev/gpiochipN`, plus `/dev/i2c-1` and `/dev/spidev0.0` for the buses) with `--device`, or run with `--privileged`. A privileged container is a reasonable trade for a single-purpose device where the security boundary is the physical box rather than the container runtime.

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

Both packages target .NET 8, so any .NET 8 or later project can use them. Target the current LTS release:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="System.Device.Gpio" Version="4.*" />
    <PackageReference Include="Iot.Device.Bindings" Version="4.*" />
  </ItemGroup>
</Project>
```

The 4.0 release removed APIs that older samples still use, including the `PinNumberingScheme` enum. A snippet that passes a numbering scheme to `GpioController`, or that comes from a 2.x or 3.x tutorial, may not compile against current packages.

### Deploying to the Raspberry Pi

The usual workflow is to write and compile on your development machine, publish a self-contained build, and copy it to the Pi over SSH. A self-contained publish carries the runtime with it, so the Pi doesn't need .NET installed.

```bash
dotnet publish -c Release -r linux-arm64 --self-contained true -o ./publish
scp -r ./publish/* user@raspberrypi.local:~/myapp/
ssh user@raspberrypi.local "chmod +x ~/myapp/MyIotApp && ~/myapp/MyIotApp"
```

Use `linux-arm64` for a 64-bit OS, which covers the Pi 3, 4, and 5 and other 64-bit Arm boards. Use `linux-arm` for a 32-bit OS or an older 32-bit-only board. A 64-bit OS is the better default on hardware that supports it. Current Raspberry Pi OS images have no default `pi` user, so substitute the account you created when flashing the card.

### Remote Debugging with VS Code

For interactive debugging, the [.NET debugger for VS Code](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csharp){:target="_blank" rel="noopener noreferrer"} supports remote attach over SSH. Install `vsdbg` on the Pi:

```bash
curl -sSL https://aka.ms/getvsdbgsh | /bin/sh /dev/stdin -v latest -l ~/vsdbg
```

Then configure a `launch.json` in VS Code with `pipeTransport` pointing at the Pi via SSH and at the `vsdbg` path. Breakpoints and stepping then work through hardware interactions as they would in any other application.

---

## GPIO with System.Device.Gpio

### What GPIO Is

General-purpose input/output pins are the basic digital signaling interface on single-board computers. A pin configured as an output can be driven high (3.3V on a Raspberry Pi) or low (0V), which turns things on and off. A pin configured as an input reads the current voltage level and reports it as high or low, which detects events like button presses or sensor triggers.

### Opening a Pin and Writing Output

`GpioController` is the entry point for all GPIO operations. The example below opens pin 17 as an output and blinks an LED:

```csharp
using System.Device.Gpio;

using var controller = new GpioController();

int ledPin = 17; // GPIO (BCM) number, not the physical header position
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

Pin numbers are the chip's GPIO numbers, which Raspberry Pi pinout diagrams label as BCM or GPIO numbers. GPIO 17 sits at physical header position 11. Current versions of the library accept only these logical numbers. Physical board numbering was removed in 4.0, so translate from a pinout diagram when wiring.

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

This polling approach works for simple scenarios. For anything timing-sensitive, event-driven GPIO is the better choice.

### Pull-Up and Pull-Down Resistors in Code

When a pin is disconnected from a definite voltage, it floats and reads unpredictably. A pull-up or pull-down resistor solves this by tying the pin to a known voltage through a large resistance. The Raspberry Pi has built-in pull resistors you can enable in code:

```csharp
// Pull-up: pin reads High when nothing is connected, Low when the button pulls it to ground
controller.OpenPin(buttonPin, PinMode.InputPullUp);

// Pull-down: pin reads Low when nothing is connected, High when the button connects it to 3.3V
controller.OpenPin(buttonPin, PinMode.InputPullDown);
```

`PinMode.InputPullUp` is the most common choice for a button wired between the GPIO pin and ground. The pin stays high until the button is pressed and pulls it low, which is called active-low signaling. Plain `PinMode.Input` enables no internal resistor, so a pin in that mode needs an external one.

Not every driver supports every mode on every board. `controller.IsPinModeSupported(pin, PinMode.InputPullUp)` answers the question at run time, which matters when the same code runs on more than one board.

### Event-Driven GPIO

Polling a pin in a loop wastes CPU time and can miss pulses shorter than the polling interval. `RegisterCallbackForPinValueChangedEvent` registers a delegate that the driver calls when the pin transitions:

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

Listen for `PinEventTypes.Rising`, `PinEventTypes.Falling`, or both with `PinEventTypes.Rising | PinEventTypes.Falling`, and unregister with `UnregisterCallbackForPinValueChangedEvent` when you no longer need the callback. The callback runs on a thread the driver owns rather than on your main thread, so anything it shares with the rest of the program needs the same care as any other cross-thread access.

When the program is async and waits for one event at a time, `await controller.WaitForEventAsync(pin, PinEventTypes.Falling, cancellationToken)` is the simpler shape: no callback, and cancellation works like any other awaited call.

A mechanical button bounces, closing and opening several times within a few milliseconds of a single press, so an edge callback can fire more than once per press. Debounce in code by ignoring edges that arrive within a short window of the last accepted one.

---

## Device Bindings with Iot.Device.Bindings

### How Device Bindings Work

Raw I2C and SPI communication requires you to know the sensor's exact register map, read the datasheet for the initialization sequence, and convert raw bytes into meaningful values yourself. Device bindings encapsulate all of that. Each binding is a C# class that handles the protocol details and exposes named properties and methods.

The [dotnet/iot repository](https://github.com/dotnet/iot/tree/main/src/devices){:target="_blank" rel="noopener noreferrer"} holds the bindings, one directory per device or device family. If a binding exists for your sensor, using it is almost always better than writing raw I2C or SPI code yourself.

### Reading a BME280 Temperature and Humidity Sensor

The BME280 is a common Bosch sensor that measures temperature, humidity, and barometric pressure over I2C or SPI. The binding handles the calibration data, compensation formulas, and oversampling configuration internally:

```csharp
using System.Device.I2c;
using Iot.Device.Bmxx80;
using UnitsNet;

// 0x76 when the SDO pin is tied to ground, 0x77 when it is tied high.
// Breakout boards differ, so confirm with i2cdetect.
var i2cSettings = new I2cConnectionSettings(busId: 1, deviceAddress: 0x76);
using var i2cDevice = I2cDevice.Create(i2cSettings);
using var bme280 = new Bme280(i2cDevice);

bme280.TemperatureSampling = Sampling.LowPower;
bme280.HumiditySampling = Sampling.LowPower;
bme280.PressureSampling = Sampling.LowPower;

while (true)
{
    // Triggers a single measurement, waits for it, and reads all three values
    var reading = await bme280.ReadAsync();

    if (reading.Temperature is Temperature temperature &&
        reading.Humidity is RelativeHumidity humidity &&
        reading.Pressure is Pressure pressure)
    {
        Console.WriteLine($"Temperature: {temperature.DegreesCelsius:F1}°C");
        Console.WriteLine($"Humidity:    {humidity.Percent:F1}%");
        Console.WriteLine($"Pressure:    {pressure.Hectopascals:F1} hPa");
    }

    await Task.Delay(TimeSpan.FromSeconds(5));
}
```

The binding represents physical quantities with [UnitsNet](https://www.nuget.org/packages/UnitsNet){:target="_blank" rel="noopener noreferrer"}. You get `Temperature`, `RelativeHumidity`, and `Pressure` values with unit conversion built in, rather than raw floats that could mean anything. Each value in the result is nullable, because a read can fail for one quantity and succeed for the others.

### Reading an Accelerometer

The MPU-6050 is a common 6-axis IMU (accelerometer plus gyroscope) used in robotics projects. Its binding lives in the `Iot.Device.Imu` namespace and follows the same pattern:

```csharp
using System.Device.I2c;
using Iot.Device.Imu;

var i2cSettings = new I2cConnectionSettings(busId: 1, deviceAddress: Mpu6050.DefaultI2cAddress); // 0x68
using var i2cDevice = I2cDevice.Create(i2cSettings);
using var mpu = new Mpu6050(i2cDevice);

while (true)
{
    var accel = mpu.GetAccelerometer();    // Vector3, m/s²
    var gyro = mpu.GetGyroscopeReading();  // Vector3, degrees per second
    Console.WriteLine($"Accel X:{accel.X:F2} Y:{accel.Y:F2} Z:{accel.Z:F2} m/s²");
    Console.WriteLine($"Gyro  X:{gyro.X:F2} Y:{gyro.Y:F2} Z:{gyro.Z:F2} °/s");
    await Task.Delay(100);
}
```

Unlike the BME280, this binding returns plain `System.Numerics.Vector3` values, so the unit lives only in the documentation and the source. The binding's README says the accelerometer reports in g, but the implementation multiplies by standard gravity and returns m/s². A sensor at rest reads about 9.8 on the vertical axis, not 1.0. When a binding returns raw numbers rather than UnitsNet types, check the unit against the source before building on it.

### Finding a Binding

Browse the [devices directory on GitHub](https://github.com/dotnet/iot/tree/main/src/devices){:target="_blank" rel="noopener noreferrer"} and search by sensor name or chip identifier. Each device directory has a README with wiring notes and sample code. One directory can cover a family of chips: the BME280 lives in `Bmxx80`, and the MPU-6050 in `Mpu6xxx9xxx`. If no binding exists for your component, the raw I2C and SPI APIs below are how you build your own.

---

## I2C Communication

### What I2C Is

I2C (Inter-Integrated Circuit) is a two-wire serial bus that lets one controller talk to many peripheral devices over the same pair of wires: SDA (data) and SCL (clock). Each peripheral answers to a 7-bit address, usually fixed by the chip with one or two pins that select among a few alternatives. The 7-bit space has 128 addresses, 16 of them reserved, so a bus can hold up to 112 devices in principle. In practice, address collisions between identical sensors and wiring capacitance run out long before that. Most sensors and small displays use I2C because it needs only two pins.

On the Raspberry Pi, I2C bus 1 is on physical pins 3 (SDA) and 5 (SCL) and appears to Linux as `/dev/i2c-1`. Enable it through `raspi-config`, or add `dtparam=i2c_arm=on` to `config.txt`, which current Raspberry Pi OS keeps at `/boot/firmware/config.txt` (older releases used `/boot/config.txt`).

### Opening an I2C Bus and Addressing a Device

```csharp
using System.Device.I2c;

// busId 1 = /dev/i2c-1 on Raspberry Pi
// deviceAddress is the 7-bit address of your sensor
var settings = new I2cConnectionSettings(busId: 1, deviceAddress: 0x48);
using var device = I2cDevice.Create(settings);
```

Run `i2cdetect -y 1` on the Pi to scan the bus and list the addresses that respond. The addresses of some common parts:

| Device | Address | Selected by |
|--------|---------|-------------|
| BME280 | 0x76 or 0x77 | SDO pin |
| MPU-6050 | 0x68 or 0x69 | AD0 pin |
| ADS1115 | 0x48 to 0x4B | ADDR pin |
| SSD1306 OLED | 0x3C or 0x3D | SA0 pin |
| MCP9808 | 0x18 to 0x1F | A0-A2 pins |

### Reading and Writing Registers

Most I2C sensors follow a register-based protocol: you write a register address to select what you want to read, then read back one or more bytes of data.

```csharp
// Write a register address followed by the value to store in it
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

`WriteRead` is a combined operation that many I2C devices require. The controller sends the register address without releasing the bus, then immediately reads the response, so no other transaction can slip in between. Using `Span<byte>` and `stackalloc` avoids heap allocations, which matters in tight polling loops.

On Linux, a failed transfer, such as a device that doesn't acknowledge its address, throws `IOException`.

### When to Use Raw I2C vs a Device Binding

Use a device binding whenever one exists. Writing raw I2C code correctly means reading the datasheet carefully, handling the initialization sequence, applying calibration data, and validating the bit-level protocol. A binding has already done all of that.

Raw I2C makes sense when you are prototyping with an obscure sensor that has no binding, contributing a new binding, or integrating a proprietary device. In those cases, the patterns above are the foundation.

---

## SPI Communication

### What SPI Is

SPI (Serial Peripheral Interface) is a synchronous bus that runs much faster than I2C. It uses three shared signals, SCLK (clock), MOSI (controller to peripheral), and MISO (peripheral to controller), plus one CS (chip select) line per device. The controller picks a device by pulling that device's CS line low rather than by sending an address. So adding an SPI device costs another GPIO pin, where adding an I2C device costs nothing but a free address.

{% include figure.html id="dn-i2c-vs-spi" %}

SPI is common for high-speed components like ADCs, displays, radio modules, and SD card interfaces, where I2C's speed would be the bottleneck.

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

`busId: 0, chipSelectLine: 0` maps to the Linux device `/dev/spidev0.0`, which appears once SPI is enabled with `raspi-config` or `dtparam=spi=on` in `config.txt`.

`SpiMode` controls the clock polarity (CPOL) and phase (CPHA). Mode 0 is the most common, but check your component's datasheet, since the wrong mode produces garbled data.

| SPI Mode | CPOL | CPHA | Clock idle | Data sampled on |
|----------|------|------|------------|-----------------|
| Mode 0   | 0    | 0    | Low        | Rising edge     |
| Mode 1   | 0    | 1    | Low        | Falling edge    |
| Mode 2   | 1    | 0    | High       | Falling edge    |
| Mode 3   | 1    | 1    | High       | Rising edge     |

### Full-Duplex Read and Write

SPI is full-duplex: the controller clocks data out on MOSI and simultaneously clocks data in on MISO. The `TransferFullDuplex` method reflects this:

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

Because every byte in is clocked by a byte out, a device that answers after a command needs either two separate transfers or one transfer padded with enough dummy bytes to clock in the full response.

### When to Use SPI vs I2C

The choice is usually dictated by what your component supports, but when you have options, a few factors decide it:

| | I2C | SPI |
|---|---|---|
| Wires | 2 shared (SDA, SCL) | 3 shared (SCLK, MOSI, MISO) plus 1 CS per device |
| Device selection | 7-bit address | Dedicated CS line |
| Speed | 100 kHz standard, 400 kHz fast mode; faster modes exist but aren't typical on a Pi | Tens of MHz is routine |
| Duplex | Half | Full |
| Best for | Many slow sensors on few pins | Displays, high-rate ADCs, SD cards |

Pick SPI when throughput matters, as it does for frequently refreshed displays, high-sample-rate ADCs, and SD cards. Pick I2C when you have many devices and few pins, since the wire count stays at two no matter how many devices share the bus. The Pi's I2C bus runs at 100 kHz unless you raise it with `dtparam=i2c_arm_baudrate` in `config.txt`.

---

## PWM

### What PWM Is

Pulse-width modulation (PWM) controls the average power delivered to a device by rapidly switching a digital signal on and off. The fraction of each period the signal spends high is the duty cycle. A 50% duty cycle delivers half the average power of a constant high signal. PWM is how you dim LEDs smoothly, control DC motor speed, and position servo motors without a dedicated DAC.

### Creating a PWM Channel

```csharp
using System.Device.Pwm;

// Hardware PWM: chip 0, channel 0 (GPIO 18 on a Raspberry Pi 4 with the overlay below)
using var pwmChannel = PwmChannel.Create(
    chip: 0,
    channel: 0,
    frequency: 1000,            // 1 kHz
    dutyCyclePercentage: 0.5);  // 50%; despite the name, the value is a 0.0-1.0 fraction

pwmChannel.Start();
```

The chip and channel numbers are the Linux PWM subsystem's (`/sys/class/pwm/pwmchipN`), not GPIO numbers, and a device-tree overlay decides which GPIO pin each channel drives. On a Raspberry Pi 4 and earlier, hardware PWM is available on GPIO 12 and 18 (channel 0) and GPIO 13 and 19 (channel 1), and `dtoverlay=pwm,pin=18,func=2` in `config.txt` routes channel 0 to GPIO 18. The Raspberry Pi 5 generates PWM on its RP1 chip, which uses different alternate functions and PWM chip numbering, so check the overlay README on your OS image and list `/sys/class/pwm` rather than assuming chip 0.

### LED Dimming

Gradually changing the duty cycle produces a smooth fade:

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

Hobby servo motors expect a 50 Hz PWM signal in which the pulse width encodes the target position. A 1 ms pulse typically corresponds to the minimum angle (0°), 1.5 ms to the center (90°), and 2 ms to the maximum (180°). Many servos use a wider range, so check the part's specification before driving it to the ends.

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

The bindings package also has a `ServoMotor` class in `Iot.Device.ServoMotor` that takes the pulse-width range and does this mapping for you.

### Software PWM vs Hardware PWM

Hardware PWM is generated by a dedicated timer peripheral. The signal stays steady regardless of what the CPU is doing, which matters for servos and anything else that reads timing precisely.

Software PWM is emulated by a thread toggling a GPIO pin. It works for LED dimming, where a few milliseconds of jitter is invisible, but it consumes CPU time and its timing irregularities can make motors audibly noisy. `System.Device.Gpio` includes `SoftwarePwmChannel` (in `System.Device.Pwm.Drivers`) for pins without hardware PWM. Prefer hardware PWM whenever timing precision matters.

---

## Common Patterns

### Sensor Polling Loop with Configurable Intervals

An IoT application spends most of its time waiting between readings. A `PeriodicTimer` gives the loop a fixed cadence without blocking a thread while it waits, and its `CancellationToken` lets the application shut down cleanly:

```csharp
public async Task RunSensorLoopAsync(
    TimeSpan interval,
    CancellationToken cancellationToken)
{
    using var timer = new PeriodicTimer(interval);

    try
    {
        do
        {
            try
            {
                await ReadAndPublishAsync(cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Sensor read failed");
                // Keep looping; transient failures are expected in hardware
            }
        }
        while (await timer.WaitForNextTickAsync(cancellationToken));
    }
    catch (OperationCanceledException)
    {
        // Shutdown requested
    }
}
```

A read that overruns the interval doesn't cause a burst of catch-up reads, because the timer collapses the missed ticks into one. The interval is a parameter rather than a hardcoded constant, so it can come from configuration and change without recompiling.

### Graceful Shutdown and Pin Cleanup

GPIO pins can keep their last state after a program exits, which can leave an LED on, a relay closed, or a motor running. Put the pin into a safe state before releasing it, and make that happen on every exit path through `IDisposable` and the host's shutdown:

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

Disposal only runs on an orderly exit. A crash, a `kill -9`, or a power cut skips it, so hardware that is dangerous when left on also needs a safe default in the circuit itself, such as a pull-down on the relay driver's input.

When the application runs as a hosted service, the host's shutdown token drives the loop:

```csharp
public class SensorService(SensorLoop loop) : BackgroundService
{
    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // stoppingToken is cancelled when the host starts shutting down
        return loop.RunAsync(TimeSpan.FromSeconds(5), stoppingToken);
    }
}
```

The generic host cancels `stoppingToken` on Ctrl+C or a SIGTERM from the OS, the loop ends, and the container disposes the singletons it created, including any that hold GPIO pins.

### Error Handling for I2C and SPI Failures

Hardware communication fails in ways software typically does not. An I2C device can stop responding after a brownout, a slow chip can miss a transaction, and loose wiring causes intermittent failures that surface as `IOException`. Treat these as expected, transient conditions:

```csharp
public async Task<Temperature?> TryReadTemperatureAsync(CancellationToken cancellationToken)
{
    const int maxAttempts = 3;

    for (int attempt = 1; attempt <= maxAttempts; attempt++)
    {
        try
        {
            var reading = await _bme280.ReadAsync();
            if (reading.Temperature is Temperature temperature)
                return temperature;

            _logger.LogWarning("Temperature read returned no value on attempt {Attempt}", attempt);
        }
        catch (IOException ex)
        {
            _logger.LogWarning(ex,
                "I2C communication error on attempt {Attempt} of {Max}",
                attempt, maxAttempts);
        }

        if (attempt < maxAttempts)
            await Task.Delay(TimeSpan.FromMilliseconds(100), cancellationToken);
    }

    _logger.LogError("Failed to read temperature after {Max} attempts", maxAttempts);
    return null;
}
```

Returning `null` after the last attempt lets the caller decide whether to skip the reading, raise an alert, or reset the sensor. Throwing on every transient failure tends to end the polling loop in a way that needs a manual restart.

### Dependency Injection and Testability

The hardware classes in `System.Device.Gpio` and the device bindings are concrete classes, and code that constructs them can't run without the hardware. A practical approach is to put your own interface in front of each sensor:

```csharp
public interface ITemperatureSensor
{
    Task<double?> ReadCelsiusAsync(CancellationToken cancellationToken = default);
}

public sealed class Bme280TemperatureSensor : ITemperatureSensor, IDisposable
{
    private readonly Bme280 _sensor;

    public Bme280TemperatureSensor(I2cDevice i2cDevice)
    {
        _sensor = new Bme280(i2cDevice) { TemperatureSampling = Sampling.LowPower };
    }

    public async Task<double?> ReadCelsiusAsync(CancellationToken cancellationToken = default)
    {
        var reading = await _sensor.ReadAsync();
        return reading.Temperature?.DegreesCelsius;
    }

    public void Dispose() => _sensor.Dispose();
}
```

The calling code depends only on `ITemperatureSensor`, so tests substitute a fake that returns canned values and the business logic runs with no hardware present. Integration tests that talk to real hardware stay separate and run only on a device with the sensor attached.

Register everything in the generic host:

```csharp
var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddSingleton(_ =>
    I2cDevice.Create(new I2cConnectionSettings(busId: 1, deviceAddress: 0x76)));

builder.Services.AddSingleton<ITemperatureSensor, Bme280TemperatureSensor>();
builder.Services.AddSingleton<SensorLoop>();
builder.Services.AddHostedService<SensorService>();

var host = builder.Build();
await host.RunAsync();
```

Singletons fit here because each object owns a physical resource that exists once: one bus handle, one sensor. The container disposes them at shutdown, which closes the I2C device.
