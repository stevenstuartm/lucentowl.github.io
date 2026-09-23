---
title: ".NET Format Strings"
layout: resource
type: cheatsheet
category: ".NET & C#"
description: "Standard and custom format specifiers for numbers, dates, times, and spans in .NET, plus the alignment syntax shared by composite formatting and string interpolation."
last_updated: 2026-09-23
tags: [formatting, format-strings, culture, datetime, numeric-formatting]
related_guides:
  - /study-guides/dotnet/c-sharp/fundamentals/strings-and-text.html
  - /study-guides/dotnet/c-sharp/libraries/console-and-environment.html
---

The same specifiers work in `ToString(format)`, composite formatting (`string.Format`, `Console.WriteLine`), and interpolated strings (`$"{value:format}"`).

Most of these are **culture-sensitive**: the separators, currency symbol, and date order come from the current culture unless you pass an `IFormatProvider`. For anything machine-read — file names, logs, wire formats — pass `CultureInfo.InvariantCulture` and use a round-trip specifier.

## Alignment

`{index,alignment:format}` — a positive alignment right-aligns, a negative one left-aligns, both padding to that width.

| Form | Result for `"ab"` |
|---|---|
| `{0,6}` | `····ab` |
| `{0,-6}` | `ab····` |
| `{0,10:N2}` with `42.5` | `······42.50` |

Alignment is a minimum, never a maximum: a value wider than the field is printed in full.

## Standard Numeric Formats

The digit after the letter is precision, which means decimal places for most specifiers and total digits for `G`, `E`, and `R`.

| Specifier | Meaning | `1234.5678` becomes |
|---|---|---|
| `C` / `C2` | Currency, using the culture's symbol and placement | `$1,234.57` |
| `D` / `D8` | Decimal integer, zero-padded to the given width. **Integer types only** | `D8` on `42` → `00000042` |
| `E` / `E2` | Scientific notation | `1.23E+003` |
| `F` / `F2` | Fixed-point | `1234.57` |
| `G` / `G4` | General: the shorter of fixed-point and scientific | `1235` |
| `N` / `N0` | Fixed-point with group separators | `1,234.57` / `1,235` |
| `P` / `P1` | Percent — **multiplies by 100** | `0.1234` → `12.3%` |
| `R` | Round-trip: the shortest string that parses back to the same value | |
| `X` / `x8` | Hexadecimal, uppercase or lowercase. **Integer types only** | `255` → `FF` |
| `B` | Binary. Integer types only (.NET 8) | `5` → `101` |

`P` multiplying by 100 is the specifier that most often surprises: format a value that is already a percentage and you get a hundredfold error with no exception.

## Custom Numeric Formats

| Pattern | Meaning |
|---|---|
| `0` | Digit placeholder; prints `0` when there is no digit |
| `#` | Digit placeholder; prints nothing when there is no digit |
| `.` | Decimal point (rendered using the culture's separator) |
| `,` | Group separator when between digit placeholders |
| `,` before the decimal point | Scales down by 1,000 per comma — `#,,` renders millions |
| `%` | Multiplies by 100 and inserts the percent symbol |
| `‰` | Multiplies by 1,000 and inserts the per-mille symbol |
| `E0`, `E+0`, `e-0` | Scientific notation |
| `;` | Section separator: `positive;negative;zero` |
| `\` or `'…'` | Escapes a literal character or run |

`"#,##0.00"` is the common money pattern: grouped, always at least one integer digit, always two decimals.

## Standard Date and Time Formats

| Specifier | Meaning | Culture-sensitive |
|---|---|---|
| `d` / `D` | Short / long date | Yes |
| `t` / `T` | Short / long time | Yes |
| `f` / `F` | Long date with short / long time | Yes |
| `g` / `G` | Short date with short / long time | Yes |
| `M` or `m` | Month and day | Yes |
| `Y` or `y` | Year and month | Yes |
| `s` | Sortable, `2026-09-23T14:05:09`. No offset, no `Z` | **No** |
| `o` or `O` | Round-trip, ISO 8601 with fractional seconds and offset | **No** |
| `r` or `R` | RFC 1123, `Tue, 23 Sep 2026 14:05:09 GMT` | **No** |
| `u` | Universal sortable, `2026-09-23 14:05:09Z` | **No** |

`O` is the one to persist and transmit: it is the only standard specifier that round-trips a `DateTime`'s `Kind` and a `DateTimeOffset`'s offset without loss.

`R` and `u` both append a UTC marker without converting the value, so passing a local time to either produces a string that claims to be UTC and is not.

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
| `K` | `Kind` or offset: `Z`, `+02:00`, or empty |
| `zz` / `zzz` | UTC offset, always signed |
| `:` / `/` | Time and date separators, **replaced by the culture's own** |
| `\` or `'…'` | Escapes a literal character or run |

`:` and `/` being culture-substituted is the trap in custom patterns. `"yyyy/MM/dd"` renders with dots in cultures that use them, so a pattern intended as a fixed wire format needs either `InvariantCulture` or escaped separators (`"yyyy'-'MM'-'dd"`).

A single custom specifier is ambiguous with a standard one, so `"d"` means short date, not day-of-month. Write `"%d"` when you want the single custom specifier.

## TimeSpan

| Specifier | Meaning |
|---|---|
| `c` | Constant, `[-][d.]hh:mm:ss[.fffffff]`. The default, culture-insensitive |
| `g` / `G` | General short / long, culture-sensitive |

Custom `TimeSpan` patterns use `d`, `h`, `m`, `s`, and `f`, and unlike dates they do **not** accept a single unescaped specifier — `%h` rather than `h`.

## Enums

| Specifier | Result |
|---|---|
| `G` | The member name, or a comma-separated list for a matching `[Flags]` combination |
| `D` | The underlying numeric value |
| `X` | The value in hexadecimal |
| `F` | Treats the value as flags regardless of whether `[Flags]` is applied |
