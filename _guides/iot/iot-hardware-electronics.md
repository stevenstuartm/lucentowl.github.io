---
title: "IoT Hardware and Electronics Basics"
layout: guide
category: IoT
subcategory: Foundations
description: "The hardware a software developer meets in IoT: GPIO, I2C, SPI, and UART, PWM and analog conversion, power budgets and sleep modes, common sensor types, choosing between microcontrollers and single-board computers, and basic electrical safety."
tags: [fundamentals, microcontrollers, sensors, gpio, i2c, power-management, embedded]
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

Pull-up and pull-down resistors come up early. A GPIO pin that is not actively driven to HIGH or LOW is in a "floating" state, meaning it might read HIGH or LOW unpredictably based on electrical noise. Pull-up resistors connect the pin to the supply voltage through a high-value resistor (typically 10k ohm), so the pin reads HIGH unless something actively pulls it LOW. Pull-down resistors connect to ground instead, making the default state LOW. Many microcontrollers have built-in pull-up or pull-down resistors that can be enabled in software, saving the need to add physical resistors to the circuit. Buttons are the classic example: without a pull-up or pull-down, a button circuit will read erratically when the button is not pressed.

GPIO is the right choice for simple, binary interactions: turning things on and off, reading digital outputs from sensors, and toggling indicator lights. For communicating with more sophisticated peripherals, you need one of the protocol-based interfaces described next.

### I2C: Inter-Integrated Circuit

I2C uses just two wires to connect a microcontroller with one or more peripheral devices. One wire carries the clock signal (SCL) and the other carries the data (SDA). Both lines are shared by all devices on the bus, which is what makes I2C attractive for connecting multiple sensors without consuming many GPIO pins.

Each device on the I2C bus has a unique address, usually 7 bits (the specification also allows 10-bit addressing), allowing the controller to direct communication to a specific device. A typical I2C bus might simultaneously connect a temperature sensor at address 0x44, a display controller at address 0x3C, and an inertial measurement unit at address 0x68, all sharing the same two wires. The controller initiates every transaction; peripherals only respond when addressed.

The [I2C-bus specification](https://www.nxp.com/docs/en/user-guide/UM10204.pdf){:target="_blank" rel="noopener noreferrer"} defines several speed grades: Standard-mode at 100 kbit/s, Fast-mode at 400 kbit/s, Fast-mode Plus at 1 Mbit/s, and High-speed mode at 3.4 Mbit/s, plus a one-directional Ultra Fast-mode. Most sensors run at Standard-mode or Fast-mode, and the faster grades are rarely needed in IoT work.

The main practical limitation of I2C is that two devices cannot share the same address. Many sensor families offer slight address variations (often controlled by a hardware pin that you tie HIGH or LOW) to work around this, but it requires attention. I2C is also more appropriate for short distances on a single PCB or within a small enclosure; it is not designed for runs of several meters.

I2C is the right interface when you need to connect several low-to-medium speed sensors to a device with limited GPIO pins, and when simplicity of wiring matters more than raw throughput.

### SPI: Serial Peripheral Interface

SPI uses four wires rather than two, specifically MOSI (Master Out Slave In), MISO (Master In Slave Out), SCLK (the clock), and CS (Chip Select, sometimes called SS for Slave Select). The distinction between MOSI and MISO means data flows in both directions simultaneously, making SPI a full-duplex interface. The controller can send a command while receiving a response in the same clock cycle.

The Chip Select line is what allows multiple SPI devices to share the same MOSI, MISO, and SCLK lines. The controller pulls a specific device's CS line LOW to select it, sends data, then releases it HIGH. Each additional SPI device requires its own dedicated CS line back to the controller, which means adding peripherals costs one GPIO pin per device.

SPI runs significantly faster than I2C. Clock rates in the tens of megahertz are common, limited by the peripheral and by trace length. This makes SPI the preferred interface for peripherals that need to move large amounts of data quickly, such as display controllers, SD card modules, and high-speed ADC chips.

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
| **Typical speed** | 100 kbit/s to 1 Mbit/s (3.4 Mbit/s high-speed) | Several to tens of Mbit/s | 9.6 kbit/s to about 1 Mbit/s |
| **Addressing** | 7-bit (or 10-bit) device address | Chip Select line per device | None |
| **Best for** | Multiple slow/medium sensors | High-speed peripherals, displays | GPS, modems, debug output |
| **Complexity** | Medium (address conflicts possible) | Low per device, more wiring | Very low |

---

## Signal Types

Not all data from the physical world arrives as simple HIGH/LOW digital values. Many real-world phenomena are continuous, varying smoothly over a range rather than switching between two states. Two important signal concepts bridge the gap between analog reality and digital computation.

### PWM: Pulse Width Modulation

Digital output pins can only be fully on or fully off, but many real-world applications need something in between: a dimmed LED rather than fully bright or fully off, a motor spinning at half speed rather than full speed or stopped. PWM achieves this by switching the output on and off very rapidly, controlling the ratio of time spent HIGH versus LOW within each cycle.

The duty cycle is the percentage of each cycle during which the signal is HIGH. A 50% duty cycle means the pin is HIGH half the time and LOW half the time. A 25% duty cycle means it is on for one quarter of each cycle. If the switching happens fast enough (typically hundreds or thousands of times per second), the device receiving the signal perceives an average effect rather than the individual pulses. An LED at a 50% duty cycle appears to glow at roughly half brightness, because at a high enough frequency the eye averages the pulses instead of seeing flicker.

PWM is how microcontrollers control servo motors (where the pulse width encodes a position angle rather than a power level), regulate LED brightness for displays and indicators, and drive some types of audio output. Many microcontrollers have dedicated hardware PWM controllers that handle the switching automatically, freeing the processor from having to toggle a pin in software thousands of times per second.

The key parameters to understand for any PWM application are the frequency (how many cycles per second) and the duty cycle (the proportion of each cycle spent HIGH). Different devices have different requirements: servo motors typically expect a 50 Hz signal with pulse widths between 1 ms and 2 ms, while LED dimming can use frequencies from a few hundred Hz to tens of kHz.

### ADC and DAC: Crossing the Analog-Digital Boundary

An Analog-to-Digital Converter (ADC) measures a continuously varying voltage and converts it to a digital number that software can work with. A microphone converts sound pressure into a varying voltage. An ADC turns that varying voltage into a stream of numbers representing the audio signal. A temperature sensor with an analog output produces a voltage proportional to temperature. The ADC converts that voltage into a number the program can compare against thresholds.

The resolution of an ADC determines how finely it can distinguish between voltage levels. A 10-bit ADC divides the input range into 1,024 steps (2 to the power of 10). A 12-bit ADC provides 4,096 steps, and a 16-bit ADC provides 65,536. Higher resolution means smaller differences in voltage can be detected, which matters when the signal you are measuring changes slowly or subtly.

Sampling rate is the other critical parameter: how many times per second the ADC takes a measurement. Audio applications require sampling rates of at least 8,000 samples per second to capture the full range of speech, and 44,100 samples per second for CD-quality audio. Slower phenomena like temperature and pressure can be sampled much less frequently, perhaps once per second or even less.

A Digital-to-Analog Converter (DAC) does the reverse. It takes a digital number and produces a corresponding analog voltage. DACs are used for audio output, generating reference voltages for other circuits, and controlling devices that expect an analog signal. Not all microcontrollers include DAC hardware; many small platforms only have ADC inputs and use PWM as a substitute for true analog output.

---

## Power Considerations

Power management is one of the areas where IoT development diverges most sharply from typical server-side or desktop software development. A web service can assume reliable mains power. A battery-powered sensor node may need to operate for months or years without a battery replacement, which forces a completely different approach to how the software uses the hardware.

### Power Sources

Mains-powered devices (plugged into a wall socket) have no practical power ceiling and generate negligible amounts of heat from typical IoT electronics. The design challenge is providing the right voltages. Most microcontrollers and sensors run on 3.3V, while mains power comes in at 120V or 240V AC, so a power supply that converts and regulates is needed.

Battery-powered devices face a constrained energy budget. The capacity of a battery is measured in milliampere-hours (mAh). A 2000 mAh battery can supply 2000 mA for one hour, or 200 mA for ten hours, or 2 mA for 1000 hours. Real devices vary their current draw considerably, but this relationship is the foundation of battery life estimation.

Radio transmitters are by far the most power-hungry components in typical IoT nodes. An ESP32 transmitting over Wi-Fi can draw a few hundred milliamps, while the same chip in deep sleep draws around ten microamps, a difference of four orders of magnitude. If a device transmits frequently, the radio dominates the power budget regardless of everything else.

### Sleep Modes and Energy Conservation

Most modern microcontrollers support multiple sleep or low-power modes that trade off power consumption against how quickly the processor can wake up and resume operation. Deep sleep typically disables almost all processor functions and keeps only a real-time clock or an external interrupt source running to wake the device at the right time.

A practical pattern for battery-powered sensors is to wake up, take a reading, transmit the data, and immediately return to deep sleep. If the sensor only needs to report once per minute, the device might spend less than one second out of every sixty actually active, dramatically reducing average current consumption. Getting the math right requires understanding how much current each phase draws and for how long.

Aggressive use of sleep modes can extend battery life from days to months or even years. The specific sleep modes available and their current consumption figures are documented in the datasheet for each microcontroller.

### Power Budgets

Estimating battery life before deploying a device is straightforward arithmetic once you know the current draw during each phase of operation. The approach is to calculate the charge consumed per cycle of operation and compare it against the battery capacity.

For example: if a device wakes up for 500 ms and draws 50 mA on average (taking a reading and transmitting), then sleeps for 59.5 seconds drawing 20 microamperes, the average current over the full 60-second cycle is dominated by the sleep current. The math works out to roughly (50 mA * 0.5 s + 0.02 mA * 59.5 s) / 60 s, which is approximately 0.44 mA average current. A 2000 mAh battery would theoretically last about 4,500 hours, or roughly six months.

Real-world performance is lower than this theoretical figure because battery capacity decreases at higher discharge rates, temperature affects capacity significantly, and batteries cannot be fully discharged without damage. A common rule of thumb is to plan on roughly 70% of the theoretical figure and then measure the real device.

### Energy Harvesting

Some IoT deployments use energy harvesting to charge batteries or directly power devices from ambient energy sources, avoiding battery replacement entirely. Solar panels are the most common approach, and even a small solar cell can supply enough power to keep a sensor node running in outdoor environments or near windows. Indoor solar is possible with higher-efficiency cells, but the energy available indoors is substantially lower than outdoors.

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

A photoresistor (also called an LDR, Light Dependent Resistor) is the simplest light sensor. Its resistance decreases as light intensity increases. Because it is a passive component with varying resistance rather than a digital output, it requires connection to an ADC or a voltage divider circuit to produce a readable signal. Photoresistors are good for basic light-sensing applications like detecting day/night transitions.

Ambient light sensors are more sophisticated ICs that measure illuminance in lux (the standard unit of light intensity as perceived by the human eye) and report over I2C. They incorporate spectral filtering to match human visual perception, making them appropriate for display brightness control and lighting automation. The BH1750 is a widely used example.

### Pressure and Gas

Barometric pressure sensors like the BMP280 and BME280 measure atmospheric pressure in hectopascals (hPa), which enables altitude estimation and weather prediction. Pressure falls as altitude increases at a predictable rate, so a calibrated pressure sensor can calculate elevation with reasonable accuracy.

Gas sensors detect specific chemical species in the air. Metal-oxide air-quality sensors estimate volatile organic compound (VOC) levels and an equivalent CO2 figure. Specific parts in this category turn over quickly (the once-common CCS811 is discontinued), so check a part's lifecycle status before designing it in. The MQ series of sensors detect gases like methane, propane, alcohol vapor, and carbon monoxide through analog outputs. Gas sensors often require a warm-up period after power-on before their readings stabilize, and many drift over time and require periodic calibration against known concentrations.

### GPS Modules

GPS modules receive signals from GNSS satellites and compute a position fix (latitude, longitude, altitude) along with timing information. Most GPS modules communicate over UART, streaming NMEA-formatted sentences at a configurable baud rate, typically 9600 bps. The software reads and parses these strings to extract position data.

A GPS module requires a clear view of the sky to acquire and maintain satellite lock. The time to a first fix (TTFF) after a cold start, with no stored satellite data, is typically tens of seconds. A hot start, where the module still holds recent orbit data from a previous session, can take only a second or two. Indoor use is generally not practical.

### How Sensors Connect

Most modern sensors offer a choice of digital or analog output. A sensor with digital output communicates over I2C, SPI, or UART and handles the analog-to-digital conversion internally. Digital sensors are generally easier to use, more accurate, and more noise-resistant, because the signal traveling over the wire is digital and therefore immune to the small voltage fluctuations that would corrupt an analog reading.

Sensors with analog output produce a voltage proportional to the measured value. The host microcontroller must read this voltage through its ADC and convert it to a meaningful measurement value using a formula from the sensor's datasheet. Analog sensors are simpler (fewer components, no protocol) but more susceptible to noise on long wire runs and require an ADC channel on the microcontroller.

When selecting sensors for a project, prefer I2C sensors when connecting multiple peripherals to conserve GPIO pins, use SPI when a sensor requires high data rates, and fall back to analog sensors only when digital alternatives are unavailable or significantly more expensive.

---

## Choosing a Platform Class

The first hardware decision is not which board but which class of processor, because the class decides whether you run an operating system, which languages are practical, and whether a battery can last months or hours. Two classes cover most IoT work.

| Property | Microcontroller (MCU) | Single-board computer (SBC) |
|---|---|---|
| **Operating system** | None, or a small RTOS such as FreeRTOS or Zephyr | Full Linux |
| **Memory** | Kilobytes to a few megabytes of RAM | Gigabytes of RAM |
| **Power** | Microamps in deep sleep; suits batteries | Hundreds of milliamps to amps; needs mains or a large battery |
| **Boot and determinism** | Starts in milliseconds; predictable timing | Boots in seconds; timing depends on the OS scheduler |
| **Development model** | Firmware image flashed to the chip | Applications deployed as ordinary processes |
| **Typical role** | Battery sensor node, simple actuator controller | Gateway, hub, local analytics, vision |

### Single-Board Computers

A Raspberry Pi is the common example. It runs Linux on a multi-core Arm processor, has gigabytes of RAM, USB, networking, and built-in Wi-Fi and Bluetooth, and exposes a 40-pin header carrying GPIO, I2C, SPI, and UART. Because it runs a normal operating system, it supports .NET on Linux, and the [.NET IoT Libraries](https://github.com/dotnet/iot){:target="_blank" rel="noopener noreferrer"} provide GPIO, I2C, SPI, and PWM access from C#. Applications deploy and debug like any Linux process.

The cost is power. Recent Pi models are specified for 5V supplies rated at several amps, which suits always-on roles like a home hub, a local display, or a gateway aggregating many sensor nodes, and rules out months on a battery.

### Microcontrollers

The ESP32 family from Espressif is a common low-cost example with built-in Wi-Fi and Bluetooth. The original ESP32 pairs two 240 MHz cores with about 520 KB of SRAM, and its deep-sleep current in the datasheet is on the order of 10 microamps. That figure is for the chip; a development board's regulator and USB circuitry can draw far more, so battery estimates should be measured on the production board. STM32 parts from STMicroelectronics are Arm Cortex-M microcontrollers common in industrial and commercial products, spanning a wide range of speed, memory, and power. Most STM32 lines need an external radio, though some integrate one, like the STM32WB (Bluetooth LE) and STM32WL (LoRa).

Both families can run [.NET nanoFramework](https://www.nanoframework.net/){:target="_blank" rel="noopener noreferrer"}, a trimmed-down .NET runtime for microcontrollers, though most microcontroller firmware is written in C or C++. Arduino boards are the other common entry point. Their C++ environment and very large library of community examples make Arduino material a practical reference for how to wire a sensor even when the target platform is something else.

### A Practical Starting Pair

For developers coming from server-side work, an SBC is the gentler start because the workflow matches what they already know, and the I/O happens through library calls. Once GPIO, I2C, and UART feel familiar, adding a microcontroller for battery-powered nodes that report to the SBC acting as a gateway reproduces the shape of most real deployments: cheap, low-power nodes feeding a more capable local device that handles aggregation and cloud connectivity.

---

## Electrical Safety Basics

IoT development at the voltage levels used by microcontrollers (3.3V and 5V) is safe to touch and experiment with freely. These voltages cannot cause dangerous electrical shock under normal conditions. The risk at these voltages is to the components, not to the developer.

Reversed polarity (connecting positive voltage to a ground pin or negative voltage to a power pin) can damage or destroy microcontrollers and sensors immediately. Always double-check power connections before applying power to a new circuit, particularly for polarity-sensitive components like electrolytic capacitors and LEDs.

Connecting 5V signals to a 3.3V input can also damage components. The Raspberry Pi's GPIO pins are 3.3V logic. Applying 5V to them can damage the processor. When interfacing with components that operate at 5V, a level shifter (a small circuit that translates between voltage levels) is needed.

Exceeding a GPIO pin's current rating also damages hardware. Safe per-pin current varies by chip from a few milliamps to a few tens of milliamps, and there is often a lower limit for all pins combined, so read the datasheet. Connecting an LED directly to a GPIO pin without a current-limiting resistor will draw too much current and may damage the pin. The resistor value needed depends on the LED's forward voltage and the supply voltage, but 220 to 470 ohm is a reasonable starting range for standard LEDs on 3.3V systems.

When working with higher voltages, such as when controlling mains-powered lights or motors through relays, the safety calculus changes significantly. The relay's control side (connected to the microcontroller) operates at low voltage and is safe; the relay's load side (connected to mains power) is dangerous and requires appropriate precautions and enclosures.

---

## Key Takeaways

The foundational hardware knowledge for IoT development is not vast, but it does require shifting mental models in a few important ways.

Communication interfaces are a selection problem, not a memorization problem. Understanding what each interface (GPIO, I2C, SPI, UART) optimizes for lets you choose correctly when a sensor datasheet says it supports both I2C and SPI, or when you need several copies of a sensor that offers only two selectable I2C addresses.

Power is a first-class design concern in battery-powered deployments in a way that simply does not exist in server-side development. The difference between a device that lasts two weeks and one that lasts two years is almost entirely in how aggressively sleep modes are used and how infrequently the radio transmits.

Platform class shapes everything downstream. A single-board computer requires the least adjustment for a server-side developer, while a microcontroller is the first step into environments where memory, power, and timing need active attention.

The components are cheap and forgiving in most cases, so a few sensors, a breadboard, and jumper wires are enough to wire up datasheet examples and read the data they produce. Understanding how the hardware actually behaves in practice is faster and more durable than reading about it in the abstract.
