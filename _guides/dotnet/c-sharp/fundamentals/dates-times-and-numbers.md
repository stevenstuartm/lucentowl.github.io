---
title: "Dates, Times, and Numbers"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "Choosing among DateTime, DateTimeOffset, DateOnly, and TimeOnly; instants versus wall-clock time; time zones, daylight saving gaps, and storing future events; measuring elapsed time; testable time with TimeProvider; and where float, double, and decimal lose precision, how rounding modes differ, and generic parsing with IParsable."
tags: [datetime, datetimeoffset, time-zones, timeprovider, decimal, rounding, practical]
---

## Instants and Wall-Clock Time

Every date-and-time value answers one of two different questions, and most date bugs come from storing the answer to one and reading it as the other.

An **instant** is a single point on the global timeline, the same moment everywhere. "The payment was captured at 14:05:09 UTC" is an instant. Converting it to any time zone changes how it is displayed, never which moment it is.

A **wall-clock time** is what a clock on a particular wall reads, a date and a time of day with no statement about where. "The store opens at 09:00" and "the meeting is at 10:00 on 3 March" are wall-clock times. They only become instants once a time zone is attached, and the same wall-clock reading is a different instant in every zone.

```
                         one instant: 2026-03-01 12:00:00 UTC
                                          │
      ┌───────────────────────────────────┼───────────────────────────────────┐
      │                                   │                                   │
 New York wall clock              London wall clock                 Tokyo wall clock
 2026-03-01 07:00 (-05:00)        2026-03-01 12:00 (+00:00)         2026-03-01 21:00 (+09:00)
```

The .NET types differ mainly in which of those two things they can represent without losing information.

## Choosing a Type

| Type | Represents | Use for |
|------|------------|---------|
| `DateTimeOffset` | An instant, plus the UTC offset it was observed at | Timestamps: when something happened. Microsoft's recommended default |
| `DateTime` with `Kind = Utc` | An instant, in UTC | Timestamps where a library or database column requires `DateTime` |
| `DateTime` with `Kind = Unspecified` | A wall-clock reading with no zone | Rarely what you want. See below |
| `DateOnly` (.NET 6) | A calendar date with no time | Birthdays, holidays, due dates, a SQL `date` column |
| `TimeOnly` (.NET 6) | A time of day, wrapping at midnight | Opening hours, a daily alarm, a shift start |
| `TimeSpan` | A duration | Elapsed time, timeouts, intervals |
| `TimeZoneInfo` | A zone's rules: offsets and daylight saving transitions over time | Converting between an instant and a wall-clock time in a named place |

A future local event (a meeting at 10:00 in Paris next March) is the one common case no single type covers. It needs a wall-clock time **and** a zone ID, stored together, for reasons the time zone section explains.

## DateTime and Its Kind

`DateTime` stores a date and time plus a `Kind` of `Utc`, `Local`, or `Unspecified`. `Kind` is a label rather than a zone, and several operations ignore or misread it.

```csharp
var utc = new DateTime(2026, 3, 1, 12, 0, 0, DateTimeKind.Utc);
var local = new DateTime(2026, 3, 1, 12, 0, 0, DateTimeKind.Local);

bool same = utc == local;   // true: comparison looks only at the date and time, not Kind
```

Those two values are different instants unless the machine happens to be on UTC, yet `==` calls them equal because comparison ignores `Kind`. Sorting, `Max`, and subtraction ignore it the same way.

`Unspecified` is where most `DateTime` bugs start. It is the `Kind` of anything built with the constructor, parsed from a string without an offset, or read from a database column that stores no offset. The two conversion methods then disagree about what it means. `ToUniversalTime()` assumes an `Unspecified` value is **local** time, and `ToLocalTime()` assumes it is **UTC**, so one stored value can shift in either direction, by a different amount on each server's time zone.

```csharp
var stored = new DateTime(2026, 3, 1, 12, 0, 0);   // Unspecified
// On a machine at UTC-05:00:
stored.ToUniversalTime();   // 17:00: treated as local
stored.ToLocalTime();       // 07:00: treated as UTC

// State what the value is as soon as it enters the program
var utc = DateTime.SpecifyKind(stored, DateTimeKind.Utc);
```

`DateTime.SpecifyKind` changes the label without changing the digits, which is the right fix when the value is known to be UTC but arrived unlabelled. Code that uses `DateTime` for instants should create values with `DateTime.UtcNow`, label anything read from storage, and keep `Kind = Utc` end to end.

`DateTime.Now` returns local time. On a server, local time is whatever zone the host happens to be configured in, it can jump backwards an hour in autumn, and it makes behaviour depend on deployment. Server code should use UTC and convert to a zone only for display.

## DateTimeOffset

A `DateTimeOffset` is a date and time plus the offset from UTC at which it was observed, such as `2026-03-01 07:00 -05:00`. Because the offset is part of the value, it always identifies exactly one instant, which is why Microsoft's guidance is to treat it as the default date-and-time type.

```csharp
var utc = new DateTimeOffset(2026, 3, 1, 12, 0, 0, TimeSpan.Zero);
var paris = new DateTimeOffset(2026, 3, 1, 13, 0, 0, TimeSpan.FromHours(1));

bool sameInstant = utc == paris;            // true: comparison is by instant
bool identical = utc.EqualsExact(paris);    // false: the offsets differ
```

The offset only survives if storage keeps it. SQL Server's `datetimeoffset` column does, and Entity Framework Core maps `DateTimeOffset` to it by default. A column with no offset, such as `datetime2`, keeps only the digits, and they come back as an `Unspecified` `DateTime`. A column's name is not a guarantee either. PostgreSQL's `timestamp with time zone` normalizes every value to UTC and discards the original offset. Whichever type the code uses, check what the database provider actually stores, or values shift silently on the round trip.

### An Offset Is Not a Time Zone

`-05:00` is shared by New York in winter, Bogotá all year, and several other zones with different daylight saving rules. The offset records what the clock read at one moment. It does not record which zone the reading came from or how that zone's offset will change. So arithmetic on a `DateTimeOffset` keeps the offset fixed even when the real zone's offset would change. On 8 March 2026, New York clocks jump from 02:00 straight to 03:00 as the city moves from -05:00 to -04:00:

```csharp
// 01:30 in New York, half an hour before the jump
var before = new DateTimeOffset(2026, 3, 8, 1, 30, 0, TimeSpan.FromHours(-5));

var later = before.AddHours(1);
// 02:30 -05:00: the correct instant, but not a time any New York clock showed that night

var ny = TimeZoneInfo.FindSystemTimeZoneById("America/New_York");
var shown = TimeZoneInfo.ConvertTime(later, ny);
// 03:30 -04:00: what New York clocks actually read
```

`DateTimeOffset` is right for recording when something happened. Working out what a clock in a particular place will read needs `TimeZoneInfo`.

## Time Zones

`TimeZoneInfo` holds a zone's full history of offsets and daylight saving rules, and converts between instants and that zone's wall-clock time.

```csharp
TimeZoneInfo tokyo = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tokyo");

DateTimeOffset nowInTokyo = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tokyo);
DateTime wallClock = new DateTime(2026, 7, 1, 9, 0, 0);          // Unspecified: a wall-clock reading
DateTime asUtc = TimeZoneInfo.ConvertTimeToUtc(wallClock, tokyo);
```

**Zone IDs come in two naming systems.** Windows historically used its own names (`"Eastern Standard Time"`). Linux and macOS use the names from the IANA time zone database (`"America/New_York"`), the public registry of zones and their rule history. Since .NET 6, `FindSystemTimeZoneById` accepts either form. On Windows that relies on the ICU Unicode library that .NET uses for globalization. .NET falls back to NLS, Windows' older built-in globalization APIs, on versions before Windows 10 1903 and Windows Server 2019, or when an app opts into it, and IANA names fail under NLS. They also fail in globalization-invariant mode, which runs without any culture data. `TimeZoneInfo.TryConvertIanaIdToWindowsId` and its counterpart convert between the two. IANA IDs are the portable choice for anything stored or exchanged. The zone data itself comes from the operating system, so minimal container images that omit it fail to find zones that work on a developer machine.

### Gaps and Overlaps

Daylight saving transitions make some wall-clock times impossible and others ambiguous. When New York springs forward, clocks jump from 01:59:59 to 03:00, so 02:30 that night never happens. When it falls back, clocks run from 01:00 to 01:59:59 twice, so 01:30 happens twice, an hour apart.

```
Spring forward, 2026-03-08
  UTC                 06:00   06:30   07:00   07:30   08:00
  New York clock      01:00   01:30   03:00   03:30   04:00
                                     ▲
                                     02:00-02:59 never shown

Fall back, 2026-11-01
  UTC                 04:00   05:00   05:30   06:00   06:30   07:00
  New York clock      00:00   01:00   01:30   01:00   01:30   02:00
                              └── EDT ──┘     └── EST ──┘
                              01:00-01:59 shown twice
```

EDT is Eastern Daylight Time (-04:00) and EST is Eastern Standard Time (-05:00). The UTC row never repeats or skips. Only the wall clock does, which is why converting from an instant to a local time always works and converting back sometimes has zero answers or two.

```csharp
bool never = ny.IsInvalidTime(new DateTime(2026, 3, 8, 2, 30, 0));     // true
bool twice = ny.IsAmbiguousTime(new DateTime(2026, 11, 1, 1, 30, 0));  // true
```

Converting an invalid time to UTC throws `ArgumentException`, and converting an ambiguous one silently picks the standard-time (EST) reading. Code that turns user-entered local times into instants, such as scheduling and booking systems, has to decide what each case means and check for it.

### Storing Future Events

For a past event, store the instant, and nothing about it can change. A future event scheduled in local time is different. Governments change daylight saving rules and zone offsets, sometimes with only weeks of notice. If a 10:00 Paris meeting next March is stored as a UTC instant computed today, and the rules change before then, the stored instant no longer corresponds to 10:00 in Paris. Store what the user actually chose, the wall-clock time and the IANA zone ID, and compute the instant when it's needed, using whatever rules are current then.

For applications where time zone correctness is central, the [NodaTime](https://nodatime.org/){:target="_blank" rel="noopener noreferrer"} library models instants, zoned times, and local times as separate types, which makes these distinctions compiler-enforced rather than conventions.

## DateOnly and TimeOnly

`DateOnly` and `TimeOnly` (.NET 6) represent a date with no time and a time with no date. Before they existed, a birthday was a `DateTime` at midnight, and converting it to UTC for storage could move it to the previous day.

```csharp
var due = new DateOnly(2026, 1, 31);
var nextMonth = due.AddMonths(1);            // 2026-02-28: clamps to the last valid day

var shiftStart = new TimeOnly(18, 0);
var shiftEnd = shiftStart.AddHours(8);       // 02:00: wraps past midnight

var today = DateOnly.FromDateTime(DateTime.Now);
DateTime startOfDay = due.ToDateTime(TimeOnly.MinValue);
```

A `TimeOnly` has no zone, so "the store opens at 09:00" is only an instant once combined with a date and the store's `TimeZoneInfo`. Data access support arrived after the types did. Entity Framework Core maps them to SQL Server's `date` and `time` columns from EF Core 8, and earlier versions need a value converter.

## Measuring Elapsed Time

Subtracting two `DateTime.Now` or `DateTime.UtcNow` readings measures the difference between two readings of the system clock. That clock can be adjusted while the code runs, by time synchronization or by hand, so the result can be wrong or even negative. Elapsed time should come from a monotonic timer that only moves forward:

```csharp
long start = Stopwatch.GetTimestamp();
DoWork();
TimeSpan elapsed = Stopwatch.GetElapsedTime(start);
```

`Stopwatch.GetTimestamp()` and the static `Stopwatch.GetElapsedTime` (.NET 7) measure without allocating a `Stopwatch` object. A `Stopwatch` instance does the same job when the measurement needs to be paused and resumed.

## Testable Time with TimeProvider

Code that calls `DateTime.UtcNow` or `Task.Delay` directly can only be tested at whatever the clock says now, and only as fast as the clock moves. A test for "the token expires after 30 minutes" would have to wait 30 minutes. `TimeProvider` (.NET 8, and available for older targets through the `Microsoft.Bcl.TimeProvider` package) is an abstract class that represents the clock, so code can take it as a dependency:

```csharp
public record Token(DateTimeOffset IssuedAt);

public class TokenService(TimeProvider time)
{
    public bool IsExpired(Token token) =>
        time.GetUtcNow() >= token.IssuedAt + TimeSpan.FromMinutes(30);
}

// Production
var service = new TokenService(TimeProvider.System);
```

`TimeProvider` supplies `GetUtcNow()`, `GetLocalNow()`, `LocalTimeZone`, monotonic `GetTimestamp()` and `GetElapsedTime()`, and `CreateTimer()`. `Task.Delay`, `Task.WaitAsync`, and the `CancellationTokenSource` constructor all have overloads that take a `TimeProvider`, so waits and timeouts can be controlled too.

In tests, `FakeTimeProvider` from the `Microsoft.Extensions.TimeProvider.Testing` package starts at a fixed time and moves only when told to:

```csharp
var fake = new FakeTimeProvider(new DateTimeOffset(2026, 1, 1, 9, 0, 0, TimeSpan.Zero));
var service = new TokenService(fake);
var token = new Token(IssuedAt: fake.GetUtcNow());

fake.Advance(TimeSpan.FromMinutes(29));
Assert.False(service.IsExpired(token));

fake.Advance(TimeSpan.FromMinutes(1));
Assert.True(service.IsExpired(token));
```

Advancing the fake clock also fires any timers and completes any `Task.Delay` created through it, so time-based logic can be tested instantly and deterministically.

## Parsing and Formatting Dates

Date parsing and formatting use the current culture unless told otherwise, and the same text means different dates in different cultures. `"03/04/2026"` is 4 March in the United States and 3 April in most of Europe. For any date a program will read back, use the ISO 8601 round-trip format and the invariant culture:

```csharp
string stored = timestamp.ToString("o", CultureInfo.InvariantCulture);
// "2026-03-01T12:00:00.0000000+00:00" for a DateTimeOffset

var parsed = DateTimeOffset.Parse(stored, CultureInfo.InvariantCulture);

var exact = DateTime.ParseExact("2026-03-01", "yyyy-MM-dd", CultureInfo.InvariantCulture);
```

When parsing into `DateTime`, a string with an offset or a trailing `Z` is converted to **local** time by default. `DateTimeStyles.RoundtripKind` preserves the `Kind` the string describes, and `DateTimeStyles.AdjustToUniversal` converts to UTC instead. Parsing into `DateTimeOffset` avoids the question, since it keeps the offset.

## Choosing a Numeric Type for Fractions

| Type | Base | Significant digits | Range | Special values | Speed |
|------|------|--------------------|-------|----------------|-------|
| `float` | 2 | about 6 to 9 | about ±3.4 × 10³⁸ | `NaN`, `±Infinity` | Hardware |
| `double` | 2 | about 15 to 17 | about ±1.7 × 10³⁰⁸ | `NaN`, `±Infinity` | Hardware |
| `decimal` | 10 | 28 to 29 | about ±7.9 × 10²⁸ | None; overflow throws | Slower, implemented in software |

Because `decimal` stores an integer together with a scale (the power of ten that places the decimal point), any decimal number with up to 28 significant digits is held exactly. The binary types can't hold most decimal fractions exactly, and that difference drives every rule below.

### Where Each Loses Precision

**`double` loses decimal fractions immediately and errors accumulate.** Adding 0.1 ten times gives `0.9999999999999999`, not `1`. Each individual error is tiny, but sums over many values, and especially differences of nearly equal values, can magnify them. The order of additions also changes the result, so the same data summed in a different order can give a slightly different answer.

**`float` runs out of digits early.** With roughly 7 significant digits, a `float` can't distinguish 16,777,216 from 16,777,217, so it silently fails as a counter or an accumulator past that point. It suits large arrays of measurements, graphics, and machine-learning weights, where memory matters more than precision.

**`decimal` is exact for decimal input, not for all arithmetic.** `1m / 3 * 3` is `0.9999999999999999999999999999`, because one third has no finite decimal expansion. What `decimal` guarantees is that amounts written in decimal, like prices and tax rates, are stored and added exactly, which is why it is the type for money.

The practical rule is to use `decimal` for money and other quantities humans write in decimal and expect to add up exactly, and `double` for measurements, science, statistics, and anything computed with functions like `Math.Sqrt`, `Math.Pow`, and `Math.Sin`, which take and return `double`.

### Comparing Floating-Point Values

Because a computed `double` rarely lands exactly on the value written in source, `==` between computed values is fragile. Compare within a tolerance chosen for the domain instead:

```csharp
bool close = Math.Abs(a - b) < 1e-9;                                   // absolute tolerance
bool relClose = Math.Abs(a - b) <= 1e-12 * Math.Max(Math.Abs(a), Math.Abs(b));  // relative
```

An absolute tolerance suits values of known scale, like coordinates in metres. A relative one suits values whose magnitude varies widely.

## Rounding

`Math.Round` rounds to the nearest value, and when the input is exactly halfway it defaults to **`MidpointRounding.ToEven`**, also called banker's rounding. Halfway values round to whichever neighbour is even, so over many roundings the results don't drift upwards. That default surprises people who expect the rule taught in school:

```csharp
Math.Round(2.5m);                                     // 2
Math.Round(3.5m);                                     // 4
Math.Round(2.5m, MidpointRounding.AwayFromZero);      // 3
Math.Round(0.125m, 2);                                // 0.12
Math.Round(0.125m, 2, MidpointRounding.AwayFromZero); // 0.13
```

`MidpointRounding` also has three directed modes that apply to every value, not only midpoints. Rounding to a whole number:

| Input | `ToEven` (default) | `AwayFromZero` | `ToZero` | `ToNegativeInfinity` | `ToPositiveInfinity` |
|-------|--------------------|----------------|----------|----------------------|----------------------|
| 2.5 | 2 | 3 | 2 | 2 | 3 |
| 2.7 | 3 | 3 | 2 | 2 | 3 |
| -2.5 | -2 | -3 | -2 | -3 | -2 |

When rounding is a business rule, such as invoice totals, tax, or interest, pass the mode explicitly so the rule is visible in the code rather than inherited from a default.

Converting to an integer rounds in two different ways depending on how it's written. A cast truncates toward zero, while `Convert.ToInt32` **rounds to even**, so `(int)2.5` is `2`, `Convert.ToInt32(2.5)` is `2`, and `Convert.ToInt32(3.5)` is `4`.

Round `double` values for display, not for exactness. `Math.Round(2.135, 2)` returns `2.13`, not the `2.14` that banker's rounding of a true midpoint would give, because `2.135` is stored as a binary value close to it and the rounding scales that value by a power of ten, which introduces error of its own. The documentation for `Math.Round` gives this example and warns that midpoint values may not round as expected. `Math.Round(2.135m, 2)` on the `decimal` returns `2.14`, so when exact rounding at a decimal digit matters, the value should be a `decimal`.

## Generic Parsing and Formatting

Every built-in numeric and date type implements `IParsable<T>` and `ISpanParsable<T>` (.NET 7). These interfaces declare `Parse` and `TryParse` as static abstract members, meaning the interface requires a static method and generic code can call it through the type parameter. That lets one generic method parse any of them:

```csharp
static T ReadSetting<T>(string raw) where T : IParsable<T> =>
    T.Parse(raw, CultureInfo.InvariantCulture);

int port = ReadSetting<int>("8080");
decimal rate = ReadSetting<decimal>("0.0825");
DateOnly start = ReadSetting<DateOnly>("2026-03-01");
```

The formatting side has two interfaces. `IFormattable.ToString(format, provider)` is what `string.Format` calls with a format specifier and culture. `ISpanFormattable.TryFormat` writes the same output into a caller's buffer without allocating a string, and interpolated strings use it in preference when a type implements it, as every built-in numeric and date type does. A custom type that implements `IParsable<T>` and `IFormattable` works with generic parsing code and with format specifiers, and adding `ISpanFormattable` lets interpolation format it without an intermediate string.

## Key Takeaways

**Decide whether a value is an instant or a wall-clock time.** Instants go in `DateTimeOffset` or UTC `DateTime`. Wall-clock times need a zone before they mean anything.

**`DateTime.Kind` is a label that comparisons ignore.** Two `DateTime` values with different kinds compare equal when their digits match, and `Unspecified` converts as local.

**An offset is not a time zone.** Arithmetic on a `DateTimeOffset` keeps its offset across daylight saving changes. Use `TimeZoneInfo` with IANA IDs to get what a clock in a place reads.

**Store future local events as wall-clock time plus zone ID.** Zone rules change, and an instant computed today can point at the wrong hour next year.

**Measure elapsed time with `Stopwatch.GetTimestamp`, not the wall clock,** and inject `TimeProvider` so time-dependent code can be tested without waiting.

**Use `decimal` for money and `double` for measurement.** Compare doubles with a tolerance, remember `Math.Round` defaults to banker's rounding, and pass the midpoint mode when rounding is a business rule.
