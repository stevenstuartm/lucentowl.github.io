---
title: "IoT Hardware and Electronics Basics"
layout: guide
category: IoT
subcategory: IoT Foundations
description: "GPIO, I2C, SPI, PWM, and other communication interfaces, common sensor types, power management, and a comparison of starter hardware platforms for IoT development."
tags: [iot, embedded, sensors, microcontrollers, raspberry-pi, fundamentals, hardware]
---

## Why Hardware Knowledge Matters for IoT Software Developers

IoT development sits at the intersection of software and the physical world, and that boundary is where most integration problems live. A developer who understands how a sensor actually produces a signal, how that signal travels across a communication bus, and how power consumption shapes device behavior will debug failures faster and make better architectural decisions than one who treats the hardware as a black box.

This guide covers the foundational hardware concepts that IoT developers encounter regularly, regardless of which platform or language they use. The focus is on understanding how things work and why, not on memorizing pin numbers or register addresses.

---

## Communication Interfaces

Hardware components talk to each other through communication interfaces. Each interface was designed for a specific set of trade-offs around speed, wire count, distance, and device complexity. Choosing the wrong interface for a sensor or peripheral is one of the most common early mistakes in IoT development.

### GPIO: General Purpose Input/Output

GPIO pins are the most fundamental interface on any microcontroller or single-board computer. Each GPIO pin is a digital connection that a program can configure as either an input (reading a signal from the outside world) or an output (sending a signal out to a device).

When configured as an output, a GPIO pin can be set HIGH (typically 3.3V or 5V, depending on the platform) or LOW (0V). This is how you turn an LED on and off, trigger a relay, or signal another chip. When configured as an input, the program reads whether the pin is currently HIGH or LOW, which is how you detect a button press or read a simple digital sensor.

The concept of pull-up and pull-down resistors is worth understanding early. A GPIO pin that is not actively driven to HIGH or LOW is in a "floating" state, meaning it might read HIGH or LOW unpredictably based on electrical noise. Pull-up resistors connect the pin to the supply voltage through a high-value resistor (typically 10k ohm), so the pin reads HIGH unless something actively pulls it LOW. Pull-down resistors connect to ground instead, making the default state LOW. Many microcontrollers have built-in pull-up or pull-down resistors that can be enabled in software, saving the need to add physical resistors to the circuit. Buttons are the classic example: without a pull-up or pull-down, a button circuit will read erratically when the button is not pressed.

GPIO is the right choice for simple, binary interactions: turning things on and off, reading digital outputs from sensors, and toggling indicator lights. For communicating with more sophisticated peripherals, you need one of the protocol-based interfaces described next.

### I2C: Inter-Integrated Circuit

I2C uses just two wires to connect a microcontroller with one or more peripheral devices. One wire carries the clock signal (SCL) and the other carries the data (SDA). Both lines are shared by all devices on the bus, which is what makes I2C attractive for connecting multiple sensors without consuming many GPIO pins.

Each device on the I2C bus has a unique 7-bit address, allowing the controller to direct communication to a specific device. A typical I2C bus might simultaneously connect a temperature sensor at address 0x44, a display controller at address 0x3C, and an inertial measurement unit at address 0x68, all sharing the same two wires. The controller initiates every transaction; peripherals only respond when addressed.

I2C supports multiple speed grades. The original "Standard Mode" runs at 100 kbps, "Fast Mode" at 400 kbps, and "Fast Mode Plus" at 1 Mbps. Most hobbyist and commercial sensors operate at Standard or Fast Mode. Higher speeds are available in the specification but rarely required in typical IoT work.

The main practical limitation of I2C is that two devices cannot share the same address. Many sensor families offer slight address variations (often controlled by a hardware pin that you tie HIGH or LOW) to work around this, but it requires attention. I2C is also more appropriate for short distances on a single PCB or within a small enclosure; it is not designed for runs of several meters.

I2C is the right interface when you need to connect several low-to-medium speed sensors to a device with limited GPIO pins, and when simplicity of wiring matters more than raw throughput.

### SPI: Serial Peripheral Interface

SPI uses four wires rather than two, specifically MOSI (Master Out Slave In), MISO (Master In Slave Out), SCLK (the clock), and CS (Chip Select, sometimes called SS for Slave Select). The distinction between MOSI and MISO means data flows in both directions simultaneously, making SPI a full-duplex interface. The controller can send a command while receiving a response in the same clock cycle.

The Chip Select line is what allows multiple SPI devices to share the same MOSI, MISO, and SCLK lines. The controller pulls a specific device's CS line LOW to select it, sends data, then releases it HIGH. Each additional SPI device requires its own dedicated CS line back to the controller, which means adding peripherals costs one GPIO pin per device.

SPI runs significantly faster than I2C. Speeds of 10 Mbps to 50 Mbps are common for SPI, and some devices support even higher rates. This makes SPI the preferred interface for peripherals that need to move large amounts of data quickly, such as display controllers, SD card modules, and high-speed ADC chips.

SPI is the right choice when throughput matters more than wire count, when the peripheral requires full-duplex communication, or when the sensor or module you need simply only offers SPI. Display modules and high-resolution ADCs are the most common examples.

### UART: Asynchronous Serial Communication

UART (Universal Asynchronous Receiver/Transmitter) is the oldest and most straightforward serial interface. It uses two wires, TX (transmit) and RX (receive), and each end sends data independently on its own wire. Unlike I2C and SPI, UART has no shared clock signal; both sides must be configured to the same baud rate (the number of bits per second) for communication to work. Common baud rates include 9600, 115200, and 921600 bps.

UART is strictly point-to-point, meaning one transmitter connects to one receiver. It does not support multiple devices on the same pair of wires the way I2C does. This limits its use for building sensor networks, but it makes UART modules very simple to integrate.

GPS modules almost universally use UART to stream NMEA sentences (standardized position data strings). Debug consoles on embedded systems typically expose a UART interface so a developer can connect a serial terminal and see log output. Cellular modems, Bluetooth modules operating in "transparent mode," and barcode scanners are other common UART peripherals.

The practical appeal of UART is simplicity. There is no addressing scheme, no protocol negotiation, and no clock line to configure. If both sides agree on the baud rate and the data format, communication just works.

### Interface Comparison

The choice between I2C, SPI, and UART depends on your specific needs. This table summarizes the key differences:

| Property | I2C | SPI | UART |
|---|---|---|---|
| **Wire count** | 2 (SDA, SCL) | 4+ (MOSI, MISO, SCLK, CS per device) | 2 (TX, RX) |
| **Topology** | Multi-device bus | Point-to-point with CS per device | Point-to-point only |
| **Duplex** | Half-duplex | Full-duplex | Full-duplex |
| **Typical speed** | 100 kbps to 1 Mbps | 1 Mbps to 50+ Mbps | 9.6 kbps to 1+ Mbps |
| **Addressing** | 7-bit device address | Chip Select line per device | None |
| **Best for** | Multiple slow/medium sensors | High-speed peripherals, displays | GPS, modems, debug output |
| **Complexity** | Medium (address conflicts possible) | Low per device, more wiring | Very low |

---

## Signal Types

Not all data from the physical world arrives as simple HIGH/LOW digital values. Many real-world phenomena are continuous, varying smoothly over a range rather than switching between two states. Two important signal concepts bridge the gap between analog reality and digital computation.

### PWM: Pulse Width Modulation

Digital output pins can only be fully on or fully off, but many real-world applications need something in between: a dimmed LED rather than fully bright or fully off, a motor spinning at half speed rather than full speed or stopped. PWM achieves this by switching the output on and off very rapidly, controlling the ratio of time spent HIGH versus LOW within each cycle.

The duty cycle is the percentage of each cycle during which the signal is HIGH. A 50% duty cycle means the pin is HIGH half the time and LOW half the time. A 25% duty cycle means it is on for one quarter of each cycle. If the switching happens fast enough (typically hundreds or thousands of times per second), the device receiving the signal perceives an average effect rather than the individual pulses. An LED with a 50% duty cycle appears to glow at roughly half brightness because the human eye cannot perceive switching faster than about 60 Hz.

PWM is how microcontrollers control servo motors (where the pulse width encodes a position angle rather than a power level), regulate LED brightness for displays and indicators, and drive some types of audio output. Many microcontrollers have dedicated hardware PWM controllers that handle the switching automatically, freeing the processor from having to toggle a pin in software thousands of times per second.

The key parameters to understand for any PWM application are the frequency (how many cycles per second) and the duty cycle (the proportion of each cycle spent HIGH). Different devices have different requirements: servo motors typically expect a 50 Hz signal with pulse widths between 1 ms and 2 ms, while LED dimming can use frequencies from a few hundred Hz to tens of kHz.

### ADC and DAC: Crossing the Analog-Digital Boundary

An Analog-to-Digital Converter (ADC) measures a continuously varying voltage and converts it to a digital number that software can work with. A microphone converts sound pressure into a varying voltage; an ADC turns that varying voltage into a stream of numbers representing the audio signal. A temperature sensor with an analog output produces a voltage proportional to temperature; the ADC converts that voltage into a number the program can compare against thresholds.

The resolution of an ADC determines how finely it can distinguish between voltage levels. A 10-bit ADC divides the input range into 1,024 steps (2 to the power of 10). A 12-bit ADC provides 4,096 steps, and a 16-bit ADC provides 65,536. Higher resolution means smaller differences in voltage can be detected, which matters when the signal you are measuring changes slowly or subtly.

Sampling rate is the other critical parameter: how many times per second the ADC takes a measurement. Audio applications require sampling rates of at least 8,000 samples per second to capture the full range of speech, and 44,100 samples per second for CD-quality audio. Slower phenomena like temperature and pressure can be sampled much less frequently, perhaps once per second or even less.

A Digital-to-Analog Converter (DAC) does the reverse: it takes a digital number and produces a corresponding analog voltage. DACs are used for audio output, generating reference voltages for other circuits, and controlling devices that expect an analog signal. Not all microcontrollers include DAC hardware; many small platforms only have ADC inputs and use PWM as a substitute for true analog output.

---

## Power Considerations

Power management is one of the areas where IoT development diverges most sharply from typical server-side or desktop software development. A web service can assume reliable mains power. A battery-powered sensor node may need to operate for months or years without a battery replacement, which forces a completely different approach to how the software uses the hardware.

### Power Sources

Mains-powered devices (plugged into a wall socket) have no practical power ceiling and generate negligible amounts of heat from typical IoT electronics. The design challenge is simply providing the right voltages: most microcontrollers and sensors run on 3.3V, while mains power comes in at 120V or 240V AC, so a power supply that converts and regulates is needed.

Battery-powered devices face a constrained energy budget. The capacity of a battery is measured in milliampere-hours (mAh): a 2000 mAh battery can supply 2000 mA for one hour, or 200 mA for ten hours, or 2 mA for 1000 hours. Real devices vary their current draw considerably, but this relationship is the foundation of battery life estimation.

The critical insight is that radio transmitters are by far the most power-hungry components in typical IoT nodes. An ESP32 transmitting over WiFi can draw 200 to 300 mA during active transmission, while the same device in deep sleep might draw only 10 to 100 microamperes. If a device transmits frequently, the radio dominates the power budget regardless of everything else.

### Sleep Modes and Energy Conservation

Most modern microcontrollers support multiple sleep or low-power modes that trade off power consumption against how quickly the processor can wake up and resume operation. Deep sleep typically disables almost all processor functions and keeps only a real-time clock or an external interrupt source running to wake the device at the right time.

A practical pattern for battery-powered sensors is to wake up, take a reading, transmit the data, and immediately return to deep sleep. If the sensor only needs to report once per minute, the device might spend less than one second out of every sixty actually active, dramatically reducing average current consumption. Getting the math right requires understanding how much current each phase draws and for how long.

Aggressive use of sleep modes can extend battery life from days to months or even years. The specific sleep modes available and their current consumption figures are documented in the datasheet for each microcontroller.

### Power Budgets

Estimating battery life before deploying a device is straightforward arithmetic once you know the current draw during each phase of operation. The approach is to calculate the charge consumed per cycle of operation and compare it against the battery capacity.

For example: if a device wakes up for 500 ms and draws 50 mA on average (taking a reading and transmitting), then sleeps for 59.5 seconds drawing 20 microamperes, the average current over the full 60-second cycle is dominated by the sleep current. The math works out to roughly (50 mA * 0.5 s + 0.02 mA * 59.5 s) / 60 s, which is approximately 0.44 mA average current. A 2000 mAh battery would theoretically last about 4,500 hours, or roughly six months.

Real-world performance is lower than this theoretical figure because battery capacity decreases at higher discharge rates, temperature affects capacity significantly, and batteries cannot be fully discharged without damage. A reasonable conservative estimate is to target 70% of the theoretical figure.

### Energy Harvesting

Some IoT deployments use energy harvesting to charge batteries or directly power devices from ambient energy sources, avoiding battery replacement entirely. Solar panels are the most common approach: even a small solar cell can supply enough power to keep a sensor node running in outdoor environments or near windows. Indoor solar is possible with higher-efficiency cells, but the energy available indoors is substantially lower than outdoors.

Vibration harvesting converts mechanical energy from machinery or vehicle movement into electrical power, which is practical in industrial monitoring scenarios where heavy equipment is always running. Thermal harvesting uses temperature differentials (such as the difference between a pipe carrying hot fluid and the surrounding air) to generate small amounts of power through thermoelectric modules.

Energy harvesting systems require careful power management because the supply is intermittent and variable. They typically combine a harvesting element with a small battery or supercapacitor that buffers energy for periods when the source is unavailable.

---

## Common Sensor Types

Sensors are the physical world's API. Each sensor category has characteristic behaviors that affect how you wire it, how you read it, and how you interpret the data it produces.

### Temperature and Humidity

Temperature and humidity sensors are among the most common in IoT deployments. The DHT22 (also sold as AM2302) is a popular entry-level sensor that uses a single-wire protocol to send both temperature and humidity readings digitally. It is inexpensive, easy to connect, and accurate enough for most environmental monitoring applications. The BME280 offers temperature, humidity, and barometric pressure over I2C or SPI, making it compact and well-suited for weather stations and indoor air quality monitors. The BME280 is generally preferred for production use because of its I2C integration and better accuracy.

Most temperature sensors produce a value in degrees Celsius that software reads over a digital interface. Some older or simpler sensors produce an analog voltage proportional to temperature, which requires an ADC to interpret.

### Motion and Acceleration

PIR (Passive Infrared) sensors detect motion by sensing changes in infrared radiation from moving warm bodies (like people or animals). They produce a simple digital output: HIGH when motion is detected, LOW when not. PIR sensors are used in alarm systems, automatic lighting, and presence detection. They are not directional and cannot determine speed or distance.

Accelerometers measure acceleration along one or more axes, which reveals both intentional motion and the constant pull of gravity. Measuring the orientation of gravity lets you determine the tilt or inclination of a device. Measuring changes in acceleration over time lets you detect vibration, shocks, or step counts. Most modern accelerometers communicate over I2C or SPI and include configurable sensitivity ranges (often measured in multiples of g, where 1g is the gravitational acceleration at Earth's surface). An IMU (Inertial Measurement Unit) combines an accelerometer with a gyroscope (which measures rotation rate) and sometimes a magnetometer, providing a complete picture of orientation and motion.

### Light

A photoresistor (also called an LDR, Light Dependent Resistor) is the simplest light sensor: its resistance decreases as light intensity increases. Because it is a passive component with varying resistance rather than a digital output, it requires connection to an ADC or a voltage divider circuit to produce a readable signal. Photoresistors are good for basic light-sensing applications like detecting day/night transitions.

Ambient light sensors are more sophisticated ICs that measure illuminance in lux (the standard unit of light intensity as perceived by the human eye) and report over I2C. They incorporate spectral filtering to match human visual perception, making them appropriate for display brightness control and lighting automation. The BH1750 is a widely used example.

### Pressure and Gas

Barometric pressure sensors like the BMP280 and BME280 measure atmospheric pressure in hectopascals (hPa), which enables altitude estimation and weather prediction. Pressure falls as altitude increases at a predictable rate, so a calibrated pressure sensor can calculate elevation with reasonable accuracy.

Gas sensors detect specific chemical species in the air. The CCS811 measures CO2 equivalent and volatile organic compound (VOC) concentrations. The MQ series of sensors detect gases like methane, propane, alcohol vapor, and carbon monoxide through analog outputs. Gas sensors often require a warm-up period after power-on before their readings stabilize, and many drift over time and require periodic calibration against known concentrations.

### GPS Modules

GPS modules receive signals from GNSS satellites and compute a position fix (latitude, longitude, altitude) along with timing information. Nearly all GPS modules communicate over UART, streaming NMEA-formatted sentences at a configurable baud rate, typically 9600 bps. The software reads and parses these strings to extract position data.

A GPS module requires a clear view of the sky to acquire and maintain satellite lock. Initial lock after power-on (called Time to First Fix, or TTFF) can take 30 to 60 seconds cold or 1 to 5 seconds if the module retains almanac data from a previous session. Indoor use is generally not practical.

### How Sensors Connect

Most modern sensors offer a choice of digital or analog output. A sensor with digital output communicates over I2C, SPI, or UART and handles the analog-to-digital conversion internally. Digital sensors are generally easier to use, more accurate, and more noise-resistant, because the signal traveling over the wire is digital and therefore immune to the small voltage fluctuations that would corrupt an analog reading.

Sensors with analog output produce a voltage proportional to the measured value. The host microcontroller must read this voltage through its ADC and convert it to a meaningful measurement value using a formula from the sensor's datasheet. Analog sensors are simpler (fewer components, no protocol) but more susceptible to noise on long wire runs and require an ADC channel on the microcontroller.

When selecting sensors for a project, prefer I2C sensors when connecting multiple peripherals to conserve GPIO pins, use SPI when a sensor requires high data rates, and fall back to analog sensors only when digital alternatives are unavailable or significantly more expensive.

---

## Starter Hardware Platforms

The choice of hardware platform shapes almost every other decision in an IoT project: which languages are available, how much processing power you have, whether you can run an operating system, and how long a battery will last. The platforms below represent the most common starting points for software developers entering IoT.

### Raspberry Pi 4 and Pi 5

The Raspberry Pi is a full single-board computer running Linux. It has a multi-core ARM processor, RAM measured in gigabytes, USB ports, HDMI output, a microSD card for storage, and built-in WiFi and Bluetooth. It also exposes a 40-pin GPIO header that provides access to digital I/O, I2C, SPI, and UART interfaces.

For .NET developers, the Raspberry Pi offers the most complete experience because it runs a full Linux distribution that supports .NET 8 and later. The [.NET IoT Libraries](https://github.com/dotnet/iot){:target="_blank" rel="noopener noreferrer"} provide abstractions for GPIO, I2C, SPI, and UART that work directly on the Raspberry Pi. You write C# applications, deploy them to the Pi over SSH or directly, and they run as standard Linux processes.

The trade-off is power consumption. The Raspberry Pi 4 draws between 600 mA and 1200 mA depending on load, making it impractical for most battery-powered applications without substantial battery capacity. It is the right choice for always-on applications like a home hub, a network-connected display, or a gateway that aggregates data from many sensor nodes.

### ESP32

The ESP32 is a system-on-chip microcontroller with built-in WiFi and Bluetooth, a dual-core 240 MHz processor, and around 520 KB of SRAM. It runs no operating system in the traditional sense, though frameworks like FreeRTOS are commonly used as a task scheduler. It is available on small development boards for a few dollars.

The ESP32 can run [.NET nanoFramework](https://www.nanoframework.net/){:target="_blank" rel="noopener noreferrer"}, which is a trimmed-down implementation of .NET designed for microcontrollers. nanoFramework supports C# and provides libraries for GPIO, I2C, SPI, UART, WiFi, and more. The programming model is familiar to .NET developers, though the constraints of the environment (limited RAM, no garbage collection guarantee, no NuGet ecosystem parity) require adjusting expectations.

The ESP32's deep sleep current consumption of around 10 microamperes makes it well-suited for battery-powered sensor nodes. A device that wakes briefly to take a reading and transmit over WiFi, then returns to deep sleep, can run on common AA batteries for months. Its low cost makes it practical to deploy in quantity.

### STM32 (Nucleo and Discovery Boards)

STM32 microcontrollers from STMicroelectronics are ARM Cortex-M processors widely used in industrial, automotive, and commercial embedded systems. The Nucleo and Discovery development boards provide STM32 chips on breadboard-friendly carrier boards with built-in debuggers and USB connectivity.

STM32 devices also support .NET nanoFramework, bringing C# development to industrial-grade hardware. STM32 chips are available with a wide range of processor speeds, memory sizes, peripheral sets, and power profiles, making them suitable for applications from simple sensor nodes to complex real-time control systems.

The trade-off compared to the ESP32 is that STM32 boards typically require more configuration and a more sophisticated toolchain. They do not have built-in WiFi or Bluetooth; connectivity requires adding separate radio modules. For developers building commercial products or working in industrial environments where reliability and component longevity matter, STM32 is a natural choice.

### Arduino

Arduino is a family of microcontroller boards paired with an approachable C/C++ development environment that has dominated hobbyist electronics education for years. Its ecosystem of libraries, shields (add-on boards), and community tutorials is enormous.

Arduino is not .NET-compatible. There is no supported path to running C# on standard Arduino boards. Including it here is worth doing because the Arduino ecosystem produces enormous amounts of documentation and example circuits for sensors and peripherals, much of which transfers directly to wiring diagrams and electrical concepts even if the code does not. When looking for how to wire a particular sensor, Arduino documentation is often the most abundant resource available, and the circuit diagrams apply regardless of the target platform.

### Hardware Platform Comparison

| Platform | Processor | RAM | Built-in Connectivity | .NET Support | Best Use Case | Approx. Price |
|---|---|---|---|---|---|---|
| **Raspberry Pi 4** | ARM Cortex-A72 (quad-core, 1.5 GHz) | 2-8 GB | WiFi, BT, Ethernet | .NET 8+ (full) | Gateways, hubs, vision, audio, ML | $35-75 |
| **Raspberry Pi 5** | ARM Cortex-A76 (quad-core, 2.4 GHz) | 4-8 GB | WiFi, BT, Ethernet | .NET 8+ (full) | Higher-performance version of above | $60-80 |
| **ESP32** | Xtensa LX6 (dual-core, 240 MHz) | ~520 KB SRAM | WiFi, BT | .NET nanoFramework | Battery sensors, cheap nodes, WiFi/BLE devices | $3-10 |
| **STM32 (Nucleo)** | ARM Cortex-M (varies) | 16 KB to 1 MB+ | None (add separately) | .NET nanoFramework | Industrial control, real-time systems | $10-25 |
| **Arduino (Uno/Nano)** | AVR ATmega (8-bit, 16 MHz) | 2 KB SRAM | None | None | Learning circuits, C/C++ only | $3-25 |

---

## Choosing Your First Hardware

The decision of where to start is simpler than the range of options might suggest, particularly for .NET developers coming from server-side or desktop backgrounds.

### The Recommended Starting Point

Start with a Raspberry Pi, which runs Linux and full .NET, and where the mental model maps directly to what a .NET developer already knows: you write an application, deploy it, and it runs. The I/O interactions happen through library calls rather than requiring you to understand every detail of the underlying hardware protocol. Debugging works through familiar tools, and when something goes wrong, the full Linux diagnostic ecosystem is available.

Once you have the software development workflow comfortable and have worked with GPIO, I2C sensors, and UART devices, adding an ESP32 to the mix makes immediate sense. The ESP32 handles the battery-powered nodes that report to a Raspberry Pi gateway; the Pi handles the aggregation, local processing, and cloud connectivity.

This two-platform approach covers the majority of practical IoT architectures: cheap, low-power sensor nodes communicating with a more capable gateway.

### What to Include in a Starter Kit

A practical starter kit for IoT development should include the hardware platform itself alongside a set of components that cover the most common early exercises. A breadboard allows components to be connected temporarily without soldering, using jumper wires to route connections between rows. A set of assorted jumper wires covers both male-to-male connections between breadboard rows and male-to-female connections from a Raspberry Pi GPIO header to breadboard components.

For sensors, a DHT22 or BME280 covers temperature and humidity, a PIR sensor covers motion detection, and an HC-SR04 ultrasonic distance sensor adds range measurement. A few common LEDs in red, green, and yellow with appropriate current-limiting resistors (220 ohm to 470 ohm) allow the classic first exercises of blinking lights and visual indicators. A push button and pull-up resistor demonstrate digital input reading.

An I2C OLED display (typically 0.96 inch, 128x64 pixels) is a practical early addition because it demonstrates I2C communication and provides a way to display sensor readings directly on the device without needing a connected monitor. These modules are widely available for a few dollars.

Starting with this set covers GPIO, I2C, analog input, and digital input within the first few sessions of experimentation. Each subsequent project expands from this base rather than requiring starting from scratch.

---

## Electrical Safety Basics

IoT development at the voltage levels used by microcontrollers (3.3V and 5V) is safe to touch and experiment with freely. These voltages cannot cause dangerous electrical shock under normal conditions. The risk at these voltages is to the components, not to the developer.

Reversed polarity (connecting positive voltage to a ground pin or negative voltage to a power pin) can damage or destroy microcontrollers and sensors immediately. Always double-check power connections before applying power to a new circuit, particularly for polarity-sensitive components like electrolytic capacitors and LEDs.

Connecting 5V signals to a 3.3V input can also damage components. The Raspberry Pi's GPIO pins are 3.3V logic; applying 5V to them can damage the processor. When interfacing with components that operate at 5V, a level shifter (a small circuit that translates between voltage levels) is needed.

Exceeding a GPIO pin's current rating is another common failure mode. Most GPIO pins can safely source or sink around 8 to 16 mA. Connecting an LED directly to a GPIO pin without a current-limiting resistor will draw too much current and may damage the pin. The resistor value needed depends on the LED's forward voltage and the supply voltage, but 220 to 470 ohm is a reasonable starting range for standard LEDs on 3.3V systems.

When working with higher voltages, such as when controlling mains-powered lights or motors through relays, the safety calculus changes significantly. The relay's control side (connected to the microcontroller) operates at low voltage and is safe; the relay's load side (connected to mains power) is dangerous and requires appropriate precautions and enclosures.

---

## Key Takeaways

The foundational hardware knowledge for IoT development is not vast, but it does require shifting mental models in a few important ways.

Communication interfaces are a selection problem, not a memorization problem. Understanding what each interface (GPIO, I2C, SPI, UART) optimizes for lets you choose correctly when a sensor datasheet says it supports both I2C and SPI, or when you need to connect a sixth sensor to a bus that only supports eight addresses.

Power is a first-class design concern in battery-powered deployments in a way that simply does not exist in server-side development. The difference between a device that lasts two weeks and one that lasts two years is almost entirely in how aggressively sleep modes are used and how infrequently the radio transmits.

Platform choice shapes everything downstream. For .NET developers, the Raspberry Pi provides the gentlest on-ramp because it requires the least adjustment to existing workflows, while the ESP32 with nanoFramework represents the first step into genuinely constrained environments where memory, power, and real-time behavior require active attention.

The components are cheap and forgiving in most cases. The best approach is to acquire a small starter kit, wire up the examples from sensor datasheets, and read the data those sensors produce. Understanding how the hardware actually behaves in practice is faster and more durable than reading about it in the abstract.
