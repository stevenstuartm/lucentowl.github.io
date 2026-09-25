---
title: "Localization and Globalization"
layout: guide
category: "WinUI 3"
subcategory: "Quality & Testing"
description: "Localizing a WinUI 3 app with MRT Core: .resw files and the default language, x:Uid and ResourceLoader, how Windows picks the app's language, in-app language choice, right-to-left layout, locale-aware formatting, and writing strings that translate."
tags: [localization, globalization, mrt-core, resw, x-uid, right-to-left, practical]
---

## Three Jobs, Not One

Microsoft splits the work of reaching other markets into three jobs, and each fails in its own way:

- **Globalization** makes the code work correctly in any language and region without changes. It covers date, number, and currency formats, sorting, and text direction. A globalization bug shows up as a date formatted "02/03" that half the world reads as the wrong month.
- **Localizability** separates everything a translator touches from the code, so that localizing needs no code changes. A localizability bug is a hard-coded string, or a sentence built by concatenation that can't be translated.
- **Localization** is the translation itself: strings, images, and anything else adapted for a market.

A WinUI 3 app does the second and third jobs with **MRT Core**, the Windows App SDK's resource management system. At build time MRT Core indexes every resource and its variants into a Package Resource Index file, `resources.pri`. At run time it picks the best variant for the current language, scale, and contrast. The API lives in `Microsoft.Windows.ApplicationModel.Resources`, not in UWP's `Windows.ApplicationModel.Resources`, and the two aren't interchangeable.

---

## Where Strings Live

Strings go in **Resources Files** (`.resw`), XML files of named entries, in a `Strings` folder with one subfolder per language. The folder names are BCP-47 language tags such as `en-US`, `de-DE`, or `ja`:

```
MyApp/
  Strings/
    en-US/
      Resources.resw
    de-DE/
      Resources.resw
    ar-SA/
      Resources.resw
```

One of these is the app's **default language**, set in `Package.appxmanifest` on the Application tab. It's the language MRT Core falls back to when none of the user's languages match, so it's the one language whose resources must be complete. Every other language can be partial. A string missing from `de-DE` falls back through the user's other languages and ends at the default. Resources in the default language still sit in a language-named folder, so MRT Core knows what language they are.

Each entry has a name, a value, and an optional comment:

```xml
<data name="Greeting.Text" xml:space="preserve">
  <value>Welcome back</value>
</data>
<data name="NewDocumentButton.Content" xml:space="preserve">
  <value>New</value>
  <comment>Toolbar button that creates a new document. Keep it short.</comment>
</data>
```

Resource names are case-insensitive and unique per file. Two rules come from how translation tools work rather than from MRT Core. Don't rename an entry after it has gone to translation, because tools track entries by name and a rename looks like one string deleted and another added. And fill in the comment for anything ambiguous, since "New" can be an adjective, a command, or a status, and many languages translate each differently.

---

## Localizing XAML with x:Uid

The `x:Uid` directive connects an element to entries in the resource file. An entry named `<uid>.<Property>` is a **property identifier**, and MRT Core applies its value to that property of every element carrying that `x:Uid` when the XAML loads:

```xml
<TextBlock x:Uid="Greeting" />
<Button x:Uid="NewDocumentButton" />
```

A resource value overrides any value set in the markup, so `Text="Placeholder"` on a localized `TextBlock` is replaced at load. Every property identifier for a uid has to exist on the element that uses it. `Greeting.Text` on a `Button` is a run-time error, because `Button` has no `Text` property. Give each element type its own uid. An entry with no dot, like `Farewell`, is a plain string for code and has no effect on an element with `x:Uid="Farewell"`.

Resource values can set any property that takes a string, not only text. `Greeting.Width` or `MainPage.FlowDirection` let a translator adjust layout per language, though content that sizes itself is usually better than a translated width.

### Attached Properties and Other Files

An attached property needs its namespace spelled out in the entry name, which is how an accessible name gets localized alongside the visible label:

```xml
<data name="SettingsButton.[using:Microsoft.UI.Xaml.Automation]AutomationProperties.Name" xml:space="preserve">
  <value>Settings</value>
</data>
```

Large apps split strings across files, such as `ErrorMessages.resw` next to `Resources.resw`. `Resources.resw` is the default, and a uid for any other file names the file first:

```xml
<TextBlock x:Uid="/ErrorMessages/PasswordTooWeak" />
```

---

## Loading Strings in Code

`ResourceLoader` reads the same files from C#. In a resource name, the dots of a property identifier become forward slashes:

```csharp
using Microsoft.Windows.ApplicationModel.Resources;

var loader = new ResourceLoader();
string farewell = loader.GetString("Farewell");
string greeting = loader.GetString("Greeting/Text");   // the entry named Greeting.Text
```

For a file other than `Resources.resw`, use the two-argument constructor. The one-argument constructor takes a path to a `.pri` file, not a file name, so `new ResourceLoader("ErrorMessages")` doesn't do what it looks like:

```csharp
var errors = new ResourceLoader(ResourceLoader.GetDefaultResourceFilePath(), "ErrorMessages");
string message = errors.GetString("MismatchedPasswords");
```

Code in a class library that calls `new ResourceLoader()` gets the host app's resources, which Microsoft recommends, since the app is usually localized more thoroughly than its libraries. A library that ships its own strings loads them from its own subtree, such as `"ContosoControl/Resources"` in place of `"ErrorMessages"`.

View models are where hard-coded strings tend to hide, because they build status and error messages in code. Route those through `ResourceLoader` too, or they stay in English when everything around them is translated.

---

## Which Language the App Runs In

For a packaged app, Windows computes an **app runtime language list**, which decides which resources load and which language `Windows.Globalization` formats dates and numbers in. It's built from three inputs, in order:

1. The app's **primary language override**, if the app has set one (see the next section).
2. The user's preferred display languages from **Settings > Time & language**, filtered to the languages the app supports.
3. If neither yields anything, the app's default language.

The app's supported languages come from its manifest. By default, `Package.appxmanifest` contains `<Resource Language="x-generate" />`, and the build expands it into one `<Resource>` entry for every **language qualifier** it finds, meaning every language tag in a resource's folder or file name, with the default language first. The Store lists those languages on the app's page. Store listing text such as the description and screenshots is entered per language in Partner Center, separately from the package.

A regional variant counts as a match. A user who prefers `en-GB` in an app that ships `en-US` strings gets the `en-US` strings, but dates and numbers formatted for `en-GB`, because the runtime list holds the user's variant.

### The App's Own Name and Title

The strings Windows shows outside the window come from the manifest, not from XAML. To localize the display name and short name, add entries such as `AppDisplayName` to `Resources.resw` and replace the literal in `Package.appxmanifest` with `ms-resource:AppDisplayName` (or `ms-resource:/ManifestResources/AppDisplayName` for an entry in another file). Microsoft's list of localizable manifest items covers the rest.

The window title is a special case. `Window` isn't a dependency object, and setting `Window.Title` through `x:Uid` fails with "Failed to assign to property 'Microsoft.UI.Xaml.Window.Title'" (microsoft-ui-xaml issue #10928, open). Set the title in code from `ResourceLoader` instead.

### Packaged and Unpackaged Apps Behave Differently

Two deployment details change which languages an app can actually use:

- **Unpackaged apps** resolve resources from the system display language rather than the user's preferred language list. The WinUI project still builds `resources.pri` next to the executable, and no manifest step is needed.
- **Bundles install only the languages the device needs.** A packaged app published as an `.msixbundle`, the format that splits an app into a main package and per-language resource packages, installs only the language resource packages that match the device's settings. Windows fetches more when the user adds an OS language and a Store update runs, and an app can request one itself with `PackageCatalog.AddResourcePackageAsync`, which needs a restart to take effect. An app with an in-app language picker either downloads the chosen language's package first, or keeps every language in the main package, by configuring the resource build not to split by language or by turning bundle generation off. Otherwise the picker offers languages that aren't installed.

---

## Letting Users Pick a Language

Most apps should follow the Windows display language and offer no picker of their own. An app that does need one, such as a kiosk app or an app used by people who share a device, sets `Microsoft.Windows.Globalization.ApplicationLanguages.PrimaryLanguageOverride`, added in Windows App SDK 1.6:

```csharp
using Microsoft.Windows.Globalization;

ApplicationLanguages.PrimaryLanguageOverride = "de-DE";
```

This class exists because the older `Windows.Globalization.ApplicationLanguages.PrimaryLanguageOverride` doesn't support unpackaged apps. The two are linked only one way. In a packaged process, setting the new property also sets the old one. Setting the old one doesn't show up in the new one's getter, since a 1.6 servicing release removed that synchronization.

### What the Override Reaches

The override is stored in the running process, and MRT Core applies it to resource lookups. Whether anything else sees it depends on packaging, because only a packaged process forwards it to Windows:

| | Packaged | Unpackaged |
| --- | --- | --- |
| `x:Uid` and `ResourceLoader` strings | Follow the override | Follow the override |
| `Windows.Globalization` formatters and `ApplicationLanguages.Languages` | Follow the override | Ignore it, so pass the language explicitly |
| WinUI's built-in control strings (such as a `ToggleSwitch`'s On and Off) | Follow the override | Reported not to follow it (microsoft-ui-xaml issue #10430, open) |
| .NET `CultureInfo` | Doesn't follow it | Doesn't follow it |

Two more limits come from the implementation. The setter rejects anything that isn't a well-formed language tag, including an empty string, so a "Use the Windows language" option can't clear the override and needs a relaunch without setting it. And the new property's getter starts empty on every launch (WindowsAppSDK issue #6118), so the app stores the user's choice in its own settings and sets the override again early at startup.

### Applying the Change

The override doesn't touch what's already on screen. Every `x:Uid` string was applied when its element loaded and stays as it was. A `ResourceLoader` applies the language once, when it's constructed, so a loader cached in a field or a singleton service keeps the old language too. Pages and loaders created after the override is set pick up the new strings, which was the fix for microsoft-ui-xaml issue #5940 in 1.6. That leaves three approaches:

| Approach | How | Cost |
| --- | --- | --- |
| **Restart** | Save the choice and relaunch, for example with `AppInstance.Restart` from `Microsoft.Windows.AppLifecycle` | Simplest and always consistent, but the user loses their place |
| **Reload the UI** | Set the override, create new `ResourceLoader` instances, and recreate the window's content or navigate to fresh pages | No restart, but state the old pages held has to be restored, and built-in control strings may lag in unpackaged apps |
| **Replace x:Uid** | Use a library such as the community [WinUI3Localizer](https://github.com/AndrewKeepCoding/WinUI3Localizer){:target="_blank" rel="noopener noreferrer"}, which applies strings through its own attached property and reloads them live | Switches instantly, but the app gives up `x:Uid` and MRT Core and ships its `.resw` files as loose files the library reads at run time |

A switch also has to reset what doesn't follow the override on its own: the root's `FlowDirection`, the .NET culture if the app formats with .NET, and, in an unpackaged app, any `Windows.Globalization` formatter.

### Looking Up One String in Another Language

`ResourceLoader` is a convenience over three lower-level types: a `ResourceManager` that opens the app's `resources.pri`, a `ResourceMap` of named resources, and a `ResourceContext` holding the qualifier values (language, scale, contrast) to match against. Microsoft's docs show building a context with its own language to fetch one string in that language, such as an error message for a support team:

```csharp
var manager = new ResourceManager();
ResourceContext context = manager.CreateResourceContext();
context.QualifierValues["Language"] = "en-US";

string text = manager.MainResourceMap
    .GetSubtree("Resources")
    .GetValue("Farewell", context)
    .ValueAsString;
```

This works only while no primary language override is set. MRT Core applies the override on top of the context's own values at every lookup, so with an override in place the lookup returns the override's language instead (WindowsAppSDK issue #6801, open as of 2.4).

---

## Right-to-Left Layout

Arabic, Hebrew, Persian, and Urdu read right to left, and the whole layout has to mirror, not just the text. `FrameworkElement.FlowDirection` does the mirroring. Set to `RightToLeft` on a page or its root panel, it's inherited by everything inside, so panels lay out from the right and a `Grid`'s first column moves to the right edge.

Windows doesn't set `FlowDirection` for the app. It stays `LeftToRight` even when the user's display language is Arabic, and it doesn't change if the user switches languages. The app sets it from the language it's showing:

```csharp
using System.Globalization;
using Microsoft.Windows.Globalization;

// In an unpackaged app, Languages ignores the override, so prefer the stored choice.
string language = string.IsNullOrEmpty(ApplicationLanguages.PrimaryLanguageOverride)
    ? ApplicationLanguages.Languages[0]
    : ApplicationLanguages.PrimaryLanguageOverride;

// RootGrid is the x:Name of the page's root panel.
RootGrid.FlowDirection = new CultureInfo(language).TextInfo.IsRightToLeft
    ? FlowDirection.RightToLeft
    : FlowDirection.LeftToRight;
```

The alternative is a `MainPage.FlowDirection` resource that each translation sets, which works without code but relies on every translator getting one value right.

Mirroring isn't automatic for everything the page contains. Directional elements such as back buttons, forward arrows, and transitions that slide in from the side usually need to flip. Some images shouldn't, such as a clock face, a logo, or a picture of a physical object. An `Image` inside a mirrored layout can be flipped with its own `FlowDirection`, and an image that needs a genuinely different version for right-to-left languages uses the `layoutdir-rtl` qualifier in its file name (`arrow.layoutdir-rtl.png`). Margins and padding should be symmetrical, since an asymmetric `Margin="24,0,8,0"` mirrors into a different visual gap.

The fastest check during development is setting `FlowDirection="RightToLeft"` on the root in any language. The full test runs with an RTL display language, where text shaping and fonts also change.


### Fonts and Line Height

Scripts differ in more than direction. East Asian text needs more line height than Latin text, and some languages stay legible only at larger minimum sizes, so fixed heights and tight line spacing that suit English can clip other languages. Stick to the standard type ramp, the built-in text styles such as `BodyTextBlockStyle` and `TitleTextBlockStyle`, which leave room, and use `Windows.Globalization.Fonts.LanguageFont` when the app needs the recommended font family, size, and weight for a specific language, such as for body text in a document editor.

---

## Formatting Dates, Numbers, and Currency

A hard-coded format string, such as `date.ToString("MM/dd/yyyy")` or a `$` concatenated onto a number, is correct in one region and wrong in most others. Two sets of APIs format correctly, and they take their language from different places:

| API | Takes its language from | Suits |
| --- | --- | --- |
| `Windows.Globalization.DateTimeFormatting` and `NumberFormatting` (`DateTimeFormatter`, `DecimalFormatter`, `CurrencyFormatter`) | The app runtime language list, then the user's regional format. The override reaches it only in packaged apps, and an unpackaged app passes the language to the constructor | Packaged apps that let users choose a language, and non-Gregorian calendars or other numeral systems |
| .NET `CultureInfo` (`ToString("d")`, `ToString("C")`, `string.Format` with a culture) | `CultureInfo.CurrentCulture`, which starts from the user's Windows regional format | Code shared with other .NET apps, and teams already using .NET formatting |

```csharp
using Windows.Globalization.DateTimeFormatting;
using Windows.Globalization.NumberFormatting;

string date = new DateTimeFormatter("shortdate").Format(DateTimeOffset.Now);

// An unpackaged app with a language picker passes the language explicitly:
string dateDe = new DateTimeFormatter("shortdate", new[] { "de-DE" }).Format(DateTimeOffset.Now);

var price = new CurrencyFormatter("EUR") { IsGrouped = true };   // grouping is off by default
string total = price.Format(1299.99);

var measure = new DecimalFormatter { FractionDigits = 2 };
string length = measure.Format(3.14159);
```

A currency code picks the currency, while the language decides the symbol's position, the separators, and the grouping character. `CurrencyFormatter("EUR")` formats the same amount differently for `de-DE` and `en-IE` users. Unlike .NET, the Windows number formatters don't group digits unless `IsGrouped` is set, so without it a German user sees `1299,99 €` rather than `1.299,99 €`.

The cheapest correct date is one the app doesn't format. `CalendarDatePicker`, `DatePicker`, and `TimePicker` format for the app's languages on their own, and Microsoft recommends the standard controls before custom formatting.

Pick one set and use it consistently. Mixing them produces a UI whose dates follow the app's chosen language while its prices follow the user's regional settings. An app with a language picker that formats with .NET has to set `CultureInfo.CurrentCulture` and `CurrentUICulture` (and `CultureInfo.DefaultThreadCurrentCulture` for other threads) when the language changes, because `PrimaryLanguageOverride` doesn't touch the .NET culture.

Formats aren't the only regional assumption. Language and region are separate settings, so a user in France can run Windows in Spanish. Take UI text from the language, and take region-specific content, like a news feed or a units default, from the region (`GlobalizationPreferences.HomeGeographicRegion`). Sort with the culture's rules rather than by character code, because not every language sorts alphabetically, even among those written in Latin script.

---

## Localizing Images and Other Files

Images and other files use the same qualifiers as strings, in either a folder name or a file name. A folder can use a bare language tag (`Assets/de-DE/banner.png`). In a file name the qualifier needs its name, `language-` (or the short form `lang-`):

```
Assets/banner.language-en-US.png
Assets/banner.language-de-DE.png
Assets/banner.png                   <- neutral fallback for every other language
```

The app refers to `Assets/banner.png` and MRT Core picks the variant. A file with no language qualifier is a neutral match, used when no language-specific one fits. Qualifiers combine with an underscore (`banner.language-de-DE_scale-200.png`), and the same mechanism selects images for display scale and contrast themes.

The cheapest localized image is one that never needed it. Text in an image has to be recreated for every language and can't be read by a screen reader, and symbols, gestures, animals, and colors carry different meanings across cultures. Keep text out of images, and prefer symmetrical artwork that survives mirroring.

---

## Writing Strings That Translate

Most localization defects start in the source-language strings, before any translator sees them.

**Translate whole sentences, not fragments.** `"The " + item + " could not be synchronized."` breaks in German, where the article changes with the noun (der Termin, die Aufgabe, das Dokument). Even the placeholder form `"The {0} could not be synchronized."` has the same problem. Give each case its own complete string, and use placeholders only for values like names and numbers that don't change the surrounding grammar.

**Let translators reorder placeholders.** `"Every {0} {1}"` with a month and a day reads correctly in English and backward in German. Use numbered placeholders and explain each one in the comment, so a translator can write `"{1} {0}"`.

**Don't reuse a string across contexts.** "On" and "Off" for a flight-mode toggle and for a Bluetooth toggle can need different words in Italian, and "Text" as a verb and as a noun differ in most languages. When in doubt, create separate entries.

**Handle plurals per language.** "1 file(s)" is an English workaround that doesn't generalize. Polish, for one, has three forms that depend on the number. At minimum, keep separate strings for one and many, and don't assume two forms are enough.

**Leave room to grow.** German and Finnish strings often run much longer than English, and East Asian scripts need more line height. Size controls to content rather than setting fixed widths or heights, allow wrapping, and test with long strings (the pseudo-localization below does this).

**Send translators only language.** Markup in a string, such as a `<link>` tag, tends to get translated along with the words around it. Keep markup out of resources, or say in the comment what must stay untouched. Access keys need a comment too, so the translated key matches a letter in the translated label.

---

## Testing Before Translations Arrive

**Pseudo-localization** finds localizability bugs before any money goes to translation. It replaces the strings with lengthened, accented, bracketed versions of themselves. The text runs roughly 40% longer than the original, with delimiters that show at a glance when a string is truncated. Anything still in plain English is hard-coded, and anything cut off at a bracket won't fit a longer language. The Multilingual App Toolkit, which used to produce this through XLIFF files and a pseudo-language inside Visual Studio, reached end of support on October 15, 2025, so a team now generates the pseudo-localized file with its own script or its translation tooling and ships it as an extra test language.

After that, a short manual pass catches most of the rest:

- Change the Windows display language and relaunch, and check the title bar and taskbar name as well as the window's content.
- Run in an RTL language, or with `FlowDirection="RightToLeft"` forced on the root, and look for icons, margins, and animations that didn't mirror correctly.
- Set a regional format that differs from the language (for example, English with German formats) and check that every date and number follows one of the two consistently.
- Build and install the real package, not just a debug launch, to catch languages that a bundle leaves out.
