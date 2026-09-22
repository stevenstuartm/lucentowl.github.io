---
title: "Industrial Predictive Maintenance and Condition Monitoring"
layout: guide
category: IoT
subcategory: Industrial IoT
description: "Deciding when to maintain industrial equipment from its condition: maintenance strategies from reactive to prescriptive, the P-F interval and criticality, vibration, thermal, ultrasonic, oil, and motor current techniques, route, online, and wireless monitoring, high-frequency sampling with edge FFT, remaining useful life, alarm management with ISA-18.2, and closing the loop with maintenance."
tags: [advanced, predictive-maintenance, condition-monitoring, vibration-analysis, remaining-useful-life, alarm-management, p-f-interval]
---

## Maintenance Strategies

Every maintenance program decides when to intervene on equipment. The strategies differ in what triggers the intervention.

| Strategy | Trigger | Fits | Costs |
|---|---|---|---|
| Reactive (run to failure) | The equipment fails | Cheap, non-critical items with spares, where failure has no safety or production consequence | Unplanned downtime, emergency labor, secondary damage |
| Preventive (time- or usage-based) | A calendar interval or operating hours | Failures that are strongly age-related, such as wear parts and lubrication | Replaces healthy parts, and a disturbed machine can fail soon after maintenance |
| Condition-based | A measured condition crosses a limit | Failures that give warning through a measurable symptom | Monitoring equipment and the people to act on it |
| Predictive | A trend projected forward shows when the condition will reach the limit | Condition-based cases where knowing the time to failure lets work be planned into a shutdown | Data, models, and the history to build them |
| Prescriptive | A system recommends the specific action and timing | Mature programs with rich failure and repair history | The most data and integration of all |

These are not rungs to climb for every asset. A plant uses all of them at once, choosing separately for each way each asset can fail. Reliability-centered maintenance (RCM) formalizes that choice by asking, for every such failure, what the consequence is and whether any task can detect or prevent it. Many failures turn out not to be age-related at all, which is why fixed-interval replacement often does less than expected, and why condition monitoring exists.

The economic case rests on the difference between planned and unplanned work. Unplanned failures bring emergency labor, expedited parts, disrupted production schedules, and sometimes damage to surrounding equipment. Predicting a failure lets the same repair happen in a scheduled window with parts on hand. How large the difference is varies by plant, and a business case should use the site's own downtime and repair costs rather than industry averages.

---

## The P-F Interval

Condition monitoring depends on a failure giving warning. The **P-F curve**, from RCM, describes that warning. **P** is the point at which a developing failure first becomes detectable, and **F** is functional failure, when the asset can no longer do its job. The **P-F interval** between them is the window in which the failure can be found and dealt with.

Two rules follow. First, inspections must happen more often than the P-F interval, or the failure can start and finish between them. The [conventional RCM interval](https://www.aladon.com/rcm-on-condition-task-interval-determination/){:target="_blank" rel="noopener noreferrer"} is about half the P-F interval. Some RCM practice refines this by working from the **net** P-F interval, the P-F interval minus the time needed to plan and carry out the repair, and by inspecting several times per P-F interval for high-consequence failures, since a single inspection can miss a developing fault. A bearing failure with an eight-week P-F interval, checked every four weeks, is found with at least four weeks left to act.

Second, techniques detect a failure at different points on the curve. For a rolling-element bearing, an illustrative sequence runs from ultrasound and high-frequency vibration (enveloping), which pick up the earliest surface damage, to vibration spectra showing defect frequencies as damage grows, then rising temperature, and finally audible noise and heat felt by hand shortly before failure. Published P-F curves disagree on the exact order, and it differs by failure, but the principle holds. A technique that detects earlier buys a longer P-F interval, which permits less frequent monitoring and more time to plan. The P-F interval of each way an asset fails, not a general preference for more data, should decide whether an asset needs continuous monitoring, a weekly route, or nothing at all.

---

## Criticality: Deciding What to Monitor

A plant cannot monitor everything at the highest intensity, and should not try. **Criticality ranking** scores each asset on the consequence of its failure (production loss, safety, environmental impact, repair cost), how long it takes to repair, and whether a standby unit exists. A single compressor with no spare, feeding the whole plant and taking weeks to repair, is critical. A pump with an installed spare that can be swapped in an hour is not.

Criticality combines with the P-F interval to set the strategy for each asset:

- **Critical, with short P-F intervals** (days), gets continuous online monitoring, often with protection systems that trip the machine.
- **Critical, with long P-F intervals** (weeks to months), is served by periodic routes or wireless sensors that report every few hours.
- **Non-critical assets** get periodic inspection or run to failure.

Applying continuous monitoring uniformly spends budget on assets where it adds little.

---

## Monitoring Techniques

### Vibration

Rotating machinery vibrates in patterns that reveal its condition, and most faults have a characteristic signature in the frequency spectrum.

| Fault | Signature |
|---|---|
| Imbalance | Strong peak at running speed (1× the shaft rotation frequency), mainly radial |
| Misalignment | Peaks at 1× and 2× running speed, often with high axial vibration |
| Mechanical looseness | Many harmonics of running speed, sometimes at half-multiples |
| Rolling-element bearing defects | Peaks at the bearing's defect frequencies, which depend on its geometry and speed, often with sidebands |
| Gear defects | Sidebands around the gear mesh frequency, spaced at the running speed of the damaged gear |
| Pump vane pass | A peak at the number of impeller vanes times running speed, which is normal unless it grows |

Bearing defect frequencies (conventionally called BPFO, BPFI, BSF, and FTF, for the outer race, inner race, rolling elements, and cage) range from a fraction of running speed (the cage, at roughly 0.4 times) to about ten times running speed, so at most a few hundred hertz on typical industrial machines. But the earliest bearing damage produces tiny impacts that ring the structure at its resonances, in the kilohertz range. **Envelope analysis** (demodulation) filters that high-frequency band, extracts its envelope, and reveals the defect frequency as the repetition rate of the impacts. That is why bearing monitoring needs high sampling rates even though the defect frequencies themselves are low.

Knowing which conditions show up at which frequencies separates vibration analysis from curve fitting. A model that has never been told a five-vane impeller produces a normal peak at five times running speed will treat that peak as an anomaly. Programs therefore pair data scientists with vibration analysts and mechanical engineers, and analysts are often certified to the categories in ISO 18436-2.

### Measurement Quantities

Vibration is measured as one of three quantities, and each suits a different frequency range. **Displacement**, in micrometers peak-to-peak, emphasizes low frequencies and is what proximity probes measure on shafts. **Velocity**, usually as RMS in millimeters per second over roughly 10 Hz to 1 kHz, tracks the overall mechanical energy of most machine faults and is the standard quantity for overall severity. **Acceleration**, in g, emphasizes high frequencies and is what bearing and gear monitoring and envelope analysis work from. Accelerometers are the usual sensor, and velocity is derived from their signal by integration. Alarm limits only make sense when they name the quantity, the units, and the frequency band.

Overall vibration severity is judged against the ISO 20816 series, which replaced ISO 10816 for casing vibration and ISO 7919 for shaft vibration. Its [part for industrial machines above 15 kW](https://www.iso.org/standard/78311.html){:target="_blank" rel="noopener noreferrer"} sorts machines by type, size, and foundation, and defines zones, chiefly in RMS velocity for casing measurements with displacement limits for low-speed machines, from newly commissioned (A) through acceptable for long-term operation (B) and limited operation until repair (C) to damage likely (D).

Large turbomachinery on fluid-film (sleeve) bearings is monitored differently. The shaft moves within its bearing clearance, so **proximity probes** measure shaft displacement directly instead of casing acceleration, typically in pairs that trace the shaft's orbit. These machines usually have permanently installed protection systems built to API 670 that trip the machine on excessive vibration. Condition monitoring reads from that system rather than duplicating it.

### Operating State and Sensor Bandwidth

A vibration or temperature reading only means something compared with readings taken under the same conditions. A pump at half speed vibrates differently from the same pump at full speed, and a motor bearing runs hotter under full load. Condition monitoring therefore tags each measurement with the operating state, such as speed, load, and running or stopped, and compares like with like. Machines on variable-frequency drives need a speed reference (a tachometer or the drive's speed signal) so that spectra can be plotted in orders of running speed rather than hertz, which keeps fault peaks in place as speed changes. Captures taken during startup, shutdown, or changeovers are either filtered out or analyzed separately. The **baseline** each asset is compared with, used for alarm limits later in this guide, is built from readings in its normal operating states, and it has to be rebuilt after repairs, overhauls, or process changes.

The sensor and its mounting also limit what can be measured. A stud-mounted industrial accelerometer can respond usefully into the kilohertz range needed for envelope analysis. Magnetic mounts, adhesive pads, and many wireless sensors lose response far lower, sometimes at a few kilohertz or less. A 25.6 kHz sample rate is wasted if the sensor cannot pass the frequencies being sampled, so the sensor and mount have to be chosen for the faults the program needs to catch.

### Thermal

Heat is a symptom of friction, overload, poor lubrication, and electrical resistance. **Infrared thermography** surveys electrical panels, switchgear, motor control centers, conveyors, and rotating equipment for hot spots. Electrical inspections have to happen under load, because a loose connection only heats when current flows. **Embedded temperature sensors** in motor windings and bearings give continuous trends. A bearing that normally runs at 65 °C and climbs by a degree every two weeks gives warning long before any alarm limit, which is time to plan a repair into a scheduled shutdown.

### Ultrasonic

Airborne and structure-borne ultrasound, above about 20 kHz and beyond human hearing, comes from friction, impacts, turbulent flow, and electrical discharge. It detects:

- Very early bearing damage and poor lubrication, where ultrasound levels rise before vibration changes, and where technicians can lubricate by ear until the level drops rather than by a fixed quantity
- Compressed air and gas leaks, located from several meters away with a handheld detector, so a leak survey can cover a whole plant quickly
- Partial discharge, arcing, and tracking in medium- and high-voltage equipment, before visible damage
- Leaking valves and steam traps, and cavitation in pumps

### Oil Analysis

Lubricating oil carries evidence of what is happening inside oil-lubricated machines such as gearboxes, hydraulic systems, compressors, and engines. It says little about grease-lubricated rolling-element bearings, which make up much of a plant's bearing population, since there is no oil to sample.

Periodic samples sent to a lab are tested for **wear metals** by spectrometry, which shows which components are wearing (iron from gears and bearings, copper from bushings). Spectrometry only detects particles below roughly 3 to 10 micrometers, depending on the instrument, so it tracks gradual wear well but can miss the larger particles that fatigue spalling sheds. **Particle counts**, reported as an ISO 4406 cleanliness code, and **ferrography**, which examines particle shape to distinguish normal rubbing wear from fatigue or cutting, cover those larger particles. Samples are also tested for **contamination** by water, fuel, or dirt, and for **oil condition** through viscosity, oxidation, and additive depletion.

For gear and sliding wear, a rising wear-metal trend across successive samples can appear before vibration or temperature change. Online particle counters and oil-condition sensors now bring some of these measurements into continuous monitoring.

### Motor Current and Electrical Signatures

**Motor current signature analysis** reads the current drawn by an induction motor, usually from the motor control center rather than at the machine. Broken rotor bars, eccentricity, and some driven-load problems appear as sidebands around the supply frequency. Because it needs no sensor on the machine itself, it suits motors that are hard to reach, such as submersible pumps.

| Technique | Detects best | Where it sits on the P-F curve | Typical deployment |
|---|---|---|---|
| Vibration | Imbalance, misalignment, looseness, bearing and gear defects | Early for bearings with envelope analysis | Routes, online systems, wireless sensors |
| Ultrasound | Early bearing damage, lubrication, leaks, electrical discharge | Earliest for bearings and electrical discharge | Handheld surveys, some permanent sensors |
| Oil analysis | Gear and sliding wear, contamination, lubricant degradation in oil-lubricated machines | Early for gear and sliding wear, weak for bearing fatigue | Periodic lab samples, some online sensors |
| Thermal | Electrical faults, friction, overload | Later for mechanical faults, earlier for electrical | Thermography surveys, embedded sensors |
| Motor current | Rotor and electrical faults, some load faults | Middle | Measured at the motor control center |

No single technique catches every kind of fault, so programs combine them per asset according to the failures RCM analysis identified.

---

## Route, Online, and Wireless Monitoring

**Route-based monitoring** sends a technician with a portable data collector around a fixed list of measurement points on a schedule, often monthly. It is cheap per point and puts a trained person at the machine, but it only sees the machine on route days and cannot catch fast failures.

**Online monitoring** permanently installs sensors wired to a monitoring system. It catches fast-developing faults and transients, and on critical turbomachinery it is often combined with protection systems that trip the machine on high vibration. It is the most expensive option per point, largely because of cabling.

**Wireless sensors** fill the space between them. Battery-powered vibration and temperature sensors take a measurement every few minutes to hours, often computing features and short spectra on board, and forward them over a mesh network. They avoid the cabling that dominates wired installation cost, which makes monitoring economical for assets that never justified wiring. Industrial mesh standards include [WirelessHART](https://www.fieldcommgroup.org/technologies/wirelesshart){:target="_blank" rel="noopener noreferrer"} (IEC 62591) and ISA100 Wireless (IEC 62734), both of which route through neighboring devices so a sensor deep in a plant needs no line of sight to a gateway. Many vendor wireless systems use proprietary radios or low-power wide-area network (LPWAN) links instead. Battery life depends heavily on how often and how long the sensor samples, so a sensor's reporting interval is a tradeoff between P-F coverage and battery replacement visits.

---

## High-Frequency Data at the Edge

### Sampling Rates and Volume

To capture a frequency, a signal must be sampled at more than twice that frequency (the Nyquist criterion). Vibration analyzers conventionally sample at 2.56 times the highest frequency of interest to leave room for the anti-aliasing filter. Monitoring up to 10 kHz, for envelope analysis of bearing resonances, therefore means sampling at about 25.6 kHz.

The volume adds up fast. At 25.6 kHz with 16-bit samples, one sensor produces about 51 KB per second, or roughly 4.4 GB per day. Fifty such measurement points produce about 220 GB of raw data a day. Streaming that continuously to the cloud costs more in bandwidth and storage than most programs can justify.

### Reducing It at the Edge

The standard answer is to process near the sensor and keep features, not raw samples.

1. **Compute spectra at the edge.** A fast Fourier transform (FFT) on the edge device or the sensor turns each capture into a spectrum, and envelope processing turns it into an envelope spectrum.
2. **Extract features.** These include overall velocity levels, energy in each fault-frequency band, and statistics that respond to impacts, such as crest factor (peak divided by RMS) and kurtosis (how spiky the signal's distribution is), both of which rise when a bearing starts producing sharp impacts and can fall back as damage spreads and the signal turns broadband, so a falling value is not proof of recovery. The features are what trends and anomaly models consume.
3. **Send spectra periodically and features often.** As a worked example, twenty 4-byte features every five seconds plus a 3,200-line spectrum of 4-byte values every five minutes come to about 60 bytes per second, against 51 KB per second raw. That is nearly a thousandfold reduction, and the exact figure depends on the cadence chosen.
4. **Keep raw data locally and send it on triggers.** A rolling buffer of raw waveforms is kept on the edge device. A lightweight anomaly check on the device compares features with the asset's baseline, and when it fires, or when an alarm or an analyst requests it, the buffer is uploaded so analysts get full resolution around the events that matter.

{% include figure.html id="iot-vibration-edge-reduction" %}

Downstream, features and spectra go to the time-series and analytics stores like any other telemetry, and the plant historian often receives the overall levels alongside process data so operators can see them in context.

---

## From Detection to Remaining Useful Life

Condition data supports three increasingly ambitious questions.

**Is something wrong?** Anomaly detection learns what healthy operation looks like for an asset and flags departures. It needs only healthy data, which is plentiful, so it is where most programs start.

**What is wrong?** Diagnosis classifies the fault, such as an outer-race bearing defect, misalignment, or cavitation. It relies on the frequency signatures above, and on labeled examples of each fault, which are much scarcer.

**How long until it fails?** **Remaining useful life (RUL)** estimation projects the condition forward to a failure threshold. Three families of methods are used.

- **Physics-based models** use degradation relationships from engineering, such as bearing fatigue life as a function of load, speed, and lubrication. They are interpretable and need little failure data, but only exist where the physics is understood.
- **Data-driven models** learn degradation from historical run-to-failure data, using methods from trend extrapolation of a health indicator to recurrent networks. They need that history, which most plants lack, because critical equipment is designed not to fail and failures are rarely recorded with the data leading up to them.
- **Reliability and survival models** fit failure-time distributions such as Weibull to fleets of similar assets, conditioned on current health. They produce a distribution of failure times rather than a single date, which suits planning. "70% chance of failure within six weeks" is more useful to a planner than a point estimate that implies false precision.

Because labeled failures are scarce, the most robust systems are hybrids. Physics and domain rules set the structure, anomaly detection flags change, and data-driven components refine estimates as failure history slowly accumulates.

---

## Alarm Management

### Alarms People Can Act On

Condition monitoring produces alarms, and alarms are only useful if people can act on them. Too many alarms, or alarms set too close to normal operation, train operators to ignore them. During an upset, a cascade of hundreds of simultaneous alarms can overwhelm operators exactly when clear information matters most.

### The ISA-18.2 Lifecycle

[ANSI/ISA-18.2](https://www.isa.org/standards-and-publications/isa-standards/isa-18-series-of-standards){:target="_blank" rel="noopener noreferrer"} (published internationally as IEC 62682) defines an alarm management lifecycle. It starts with an alarm philosophy document, then **rationalizes** every alarm, confirming that each one requires an operator action, has a defined consequence and response time, and carries a priority that matches its consequence. It continues through implementation, monitoring, and management of change. ISA-18.2 and the EEMUA 191 guideline give benchmarks. A steady state of no more than about one alarm per operator every ten minutes is manageable, and more than ten alarms in ten minutes counts as an **alarm flood**. Stale alarms, active for more than 24 hours, and chattering alarms that toggle repeatedly are measured and eliminated too.

### Trends and Baselines Instead of Fixed Limits

Static thresholds are also a blunt instrument for slowly developing faults. **Statistical process control** watches whether a variable has left its normal pattern of variation, not just whether it crossed a limit. Shewhart charts catch large sudden shifts. Exponentially weighted moving average (EWMA) and cumulative sum (CUSUM) charts accumulate small deviations and catch gradual drift earlier, with fewer false alarms than tightening a fixed threshold. For condition monitoring, alarm limits set per asset from its own baseline, such as a multiple of its normal RMS velocity in the same operating state, usually work better than generic limits, with ISO 20816 zones as the outer bound.

### Routing Findings to the Right People

Condition monitoring findings for maintenance planners and process alarms for control room operators serve different audiences with different response times. A developing bearing defect weeks from failure needs a work order, not an operator alarm, and routing such findings into the control room adds load for people who cannot act on them. The exception is protection-level vibration on critical machines, which signals imminent damage and does belong with operators, usually through the machine protection system.

---

## Closing the Loop With Maintenance

A prediction is only worth the work order it produces. Programs that deliver value connect condition findings to the computerized maintenance management system (CMMS) or enterprise asset management (EAM) system, where a finding above a threshold creates an inspection or repair request with the evidence attached, and planners schedule it into the next suitable window.

The loop has to run back as well. When a technician inspects or repairs an asset after a prediction, the finding needs to be recorded in a structured form covering whether a fault was found, which component and fault type, how severe it was, and what was done. Those records are the labels that let models improve and let the team measure how often predictions are right. Without them, programs stall. Models never learn from false alarms, planners never learn how far to trust predictions, and nobody can show the program's return.

ISO 17359 sets out general guidelines for this kind of program, from choosing which assets and failures to monitor through setting alarm criteria to reviewing results, and ISO 13374 describes the data-processing stages from raw measurements to recommended actions.

The organizational side decides the outcome as much as the technical one. Clear thresholds for when a prediction triggers work, named owners for reviewing findings, and regular reviews of hits and misses build the trust that makes planners act on a prediction instead of waiting for the machine to prove it.
