---
title: ".NET Format Strings"
layout: resource
type: cheatsheet
category: ".NET & C#"
description: "Standard and custom format specifiers for numbers, dates, times, time spans, and enums in .NET, plus the alignment syntax shared by composite formatting and string interpolation, with the culture traps each one carries."
last_updated: 2026-09-23
tags: [formatting, format-strings, culture, datetime, numeric-formatting]
related_guides:
  - /study-guides/dotnet/c-sharp/fundamentals/strings-and-text.html
  - /study-guides/dotnet/c-sharp/fundamentals/dates-times-and-numbers.html
  - /study-guides/dotnet/c-sharp/libraries/console-and-environment.html
---

The same specifiers work in `ToString(format)`, composite formatting (`string.Format`, `Console.WriteLine`), and interpolated strings (`$"{value:format}"`). Examples show `en-US` output.

Most of these are **culture-sensitive**. The separators, currency symbol, and date order come from the current culture unless you pass an `IFormatProvider`, and interpolation uses the current culture too. For anything machine-read, such as logs and wire formats, pass `CultureInfo.InvariantCulture` (or use `string.Create(CultureInfo.InvariantCulture, $"...")` for interpolation) and a round-trip specifier. File names are the exception, because Windows rejects the colons in `O` output. Use a custom pattern such as `yyyyMMdd'T'HHmmss` there.

## Alignment

The syntax is `{index,alignment:format}`. A positive alignment right-aligns and a negative one left-aligns, both padding to that width.

| Form | Result |
|---|---|
| `{0,6}` with `"ab"` | `····ab` |
| `{0,-6}` with `"ab"` | `ab····` |
| `{0,10:N2}` with `42.5` | `·····42.50` |

Alignment is a minimum, never a maximum, so a value wider than the field is printed in full.

## Standard Numeric Formats

The digit after the letter is the precision. It means decimal places for `C`, `E`, `F`, `N`, and `P`, minimum digits for `D`, `X`, and `B`, and significant digits for `G`. `R` ignores it.

| Specifier | Meaning | `1234.5678` becomes |
|---|---|---|
| `C` / `C2` | Currency, using the culture's symbol and placement | `$1,234.57` |
| `D` / `D8` | Decimal integer, zero-padded to the given width. **Integer types only** (a `double` throws `FormatException`) | `D8` on `42` → `00000042` |
| `E` / `E2` | Scientific notation, six decimals by default | `1.234568E+003` / `1.23E+003` |
| `F` / `F2` | Fixed-point | `1234.57` for `F2` |
| `G` / `G4` | General: the more compact of fixed-point and scientific | `1234.5678` / `1235` |
| `N` / `N0` | Fixed-point with group separators | `1,234.57` for `N2`, `1,235` for `N0` |
| `P` / `P1` | Percent, which **multiplies by 100** | `0.1234` → `12.3%` for `P1` |
| `R` | Round-trip: the shortest string that parses back to the same value. Since .NET Core 3.0, a plain `ToString()` on `double` and `float` already produces this. On .NET Framework, `R` can fail to round-trip, so use `G17` for `double` and `G9` for `float` there | `1234.5678` |
| `X` / `x8` | Hexadecimal, uppercase or lowercase. **Integer types only** | `255` → `FF` / `000000ff` |
| `B` | Binary. Integer types only (.NET 8) | `5` → `101` |

`P` multiplying by 100 is the specifier that most often surprises. Format a value that is already a percentage and you get a hundredfold error with no exception.

## Custom Numeric Formats

| Pattern | Meaning |
|---|---|
| `0` | Digit placeholder that prints `0` when there is no digit |
| `#` | Digit placeholder that prints nothing when there is no digit |
| `.` | Decimal point, rendered as the culture's separator |
| `,` | Group separator when between digit placeholders |
| `,` immediately before the decimal point, or at the end | Scales down by 1,000 per comma, so `#,,` renders `1234567890` as `1235` (millions). `#,##0,` groups and scales at once, giving `1,234,568` |
| `%` | Multiplies by 100 and inserts the percent symbol |
| `‰` | Multiplies by 1,000 and inserts the per-mille symbol |
| `E0`, `E+0`, `e-0` | Scientific notation |
| `;` | Section separator, `positive;negative;zero`, so `0;(0);zero` renders `-5` as `(5)` |
| `\` or `'…'` | Escapes a literal character or run |

`"#,##0.00"` is the common money pattern, grouped with at least one integer digit and exactly two decimals.

## Standard Date and Time Formats

| Specifier | Meaning | Culture-sensitive |
|---|---|---|
| `d` / `D` | Short / long date | Yes |
| `t` / `T` | Short / long time | Yes |
| `f` / `F` | Long date with short / long time | Yes |
| `g` / `G` | Short date with short / long time | Yes |
| `M` or `m` | Month and day | Yes |
| `Y` or `y` | Year and month | Yes |
| `U` | Long date and time, **converted to UTC first**. `DateTime` only. A `DateTimeOffset` throws `FormatException` | Yes |
| `s` | Sortable, `2026-09-23T14:05:09`. No offset, no `Z` | **No** |
| `o` or `O` | Round-trip ISO 8601 with seven fractional digits, then `Z` for UTC, the offset for a local `DateTime` or any `DateTimeOffset`, and nothing for `Unspecified` | **No** |
| `r` or `R` | RFC 1123, `Wed, 23 Sep 2026 14:05:09 GMT` | **No** |
| `u` | Universal sortable, `2026-09-23 14:05:09Z` | **No** |

`O` is the one to persist and transmit. It is the only standard specifier that round-trips a `DateTime`'s `Kind` and a `DateTimeOffset`'s offset without loss.

On a `DateTime`, `R` and `u` append a UTC marker without converting the value, so a local time produces a string that claims to be UTC and is not. Call `ToUniversalTime()` first. A `DateTimeOffset` is converted to UTC automatically.

## Custom Date and Time Formats

| Pattern | Meaning |
|---|---|
| `yy` / `yyyy` | Two-digit / four-digit year |
| `M` / `MM` / `MMM` / `MMMM` | Month number, padded number, abbreviated name, full name |
| `d` / `dd` / `ddd` / `dddd` | Day number, padded number, abbreviated weekday, full weekday |
| `h` / `hh` | 12-hour clock, unpadded / padded |
| `H` / `HH` | 24-hour clock, unpadded / padded |
| `m` / `mm` | Minutes |
| `s` / `ss` | Seconds |
| `f`-`fffffff` | Fractional seconds, always shown |
| `F`-`FFFFFFF` | Fractional seconds, trailing zeros omitted |
| `tt` | AM/PM designator |
| `K` | `Kind` or offset: `Z`, `-04:00`, or empty for `Unspecified` |
| `z` / `zz` / `zzz` | UTC offset, always signed: `-4`, `-04`, `-04:00`. On a `DateTime` with `Local` or `Unspecified` kind it prints the local machine's offset, and on `Utc` it prints `+00:00` |
| `:` / `/` | Time and date separators, **replaced by the culture's own** |
| `\` or `'…'` | Escapes a literal character or run |

`:` and `/` being culture-substituted is the trap in custom patterns. `"yyyy/MM/dd"` renders `2026.09.23` under `de-DE`, and `"HH:mm"` renders `14.05` under `fi-FI`. A pattern meant as a fixed wire format needs `InvariantCulture` or quoted separators (`"yyyy'/'MM'/'dd"`). Hyphens are never substituted, so `"yyyy-MM-dd"` is safe as written.

A pattern of one letter is read as a standard specifier, so `"d"` means short date, not day-of-month, and `"h"` throws `FormatException` because no standard `h` exists. Write `"%d"` or `"%h"` to get the single custom specifier.

## TimeSpan

| Specifier | Meaning |
|---|---|
| `c` | Constant, `[-][d.]hh:mm:ss[.fffffff]`. The default, and culture-insensitive |
| `g` / `G` | General short / long, culture-sensitive. `g` drops zero days and trailing fractional zeros, `G` always shows both |

Custom `TimeSpan` patterns use `d`, `h`, `m`, `s`, `f`, and `F`, and unlike date patterns they treat every other character as an error, including `:` and `.`. Escape them. `@"hh\:mm"` or `"hh':'mm"` works, and `"hh:mm"` throws `FormatException`. A single specifier needs `%` here too.

Custom `TimeSpan` patterns have no sign specifier, so `TimeSpan.FromHours(-2)` formatted with `@"hh\:mm"` prints `02:00` with no error. Check `ts < TimeSpan.Zero` and add the sign yourself, or use `c`, which keeps it.

## Enums

| Specifier | Result |
|---|---|
| `G` | The member name, a comma-separated list for a matching `[Flags]` combination, or the number when no member matches |
| `D` | The underlying numeric value |
| `X` | The value in hexadecimal, padded to the underlying type's width (`00000001` for an `int` enum) |
| `F` | Treats the value as flags regardless of whether `[Flags]` is applied |
