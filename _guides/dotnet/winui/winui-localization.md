---
title: "Localization and Globalization"
layout: guide
category: "WinUI 3"
subcategory: "Quality & Testing"
description: "Localizing WinUI 3 applications using .resw resource files, x:Uid markup, right-to-left layout support, locale-aware formatting, and runtime language switching."
tags: [winui, winui-3, localization, globalization, internationalization, desktop, practical]
---

## Table of Contents

- [What Localization Means in WinUI 3](#what-localization-means-in-winui-3)
- [Resource Files and Directory Structure](#resource-files-and-directory-structure)
- [Localizing XAML with x:Uid](#localizing-xaml-with-xuid)
- [Localizing Multiple Properties from One x:Uid](#localizing-multiple-properties-from-one-xuid)
- [Accessing Resources from Code](#accessing-resources-from-code)
- [Right-to-Left Layout Support](#right-to-left-layout-support)
- [Date, Number, and Currency Formatting](#date-number-and-currency-formatting)
- [Runtime Language Switching](#runtime-language-switching)
- [Image and Asset Localization](#image-and-asset-localization)
- [Preparing an App for Localization](#preparing-an-app-for-localization)

---

## What Localization Means in WinUI 3

Localization and globalization are related but distinct concerns. Globalization is the practice of designing an application so that it can work correctly in multiple locales without code changes, covering things like date formatting, currency symbols, and text directionality. Localization is the process of supplying locale-specific content, most commonly translated strings, for a particular market. WinUI 3 provides infrastructure for both through the Windows resource management system and the `Windows.Globalization` namespace.

The Windows resource system uses `.resw` files for string resources. These are XML files that map string keys to translated values and live in a specific directory layout that the runtime uses to select the right file for the user's language settings. XAML binds to these resources through the `x:Uid` attribute, and code retrieves them through a `ResourceLoader` instance. The system handles locale matching automatically, falling back through the language list until it finds a match.

---

## Resource Files and Directory Structure

The runtime discovers `.resw` files through a naming convention. Language-specific resources live in a folder named `Strings`, with one subfolder per locale named using a BCP-47 language tag such as `en-US`, `fr-FR`, or `ar-SA`. Inside each subfolder, the resource file is named `Resources.resw` by default.

```
MyApp/
  Strings/
    en-US/
      Resources.resw
    fr-FR/
      Resources.resw
    ar-SA/
      Resources.resw
```

Each `.resw` file contains a list of name-value pairs. The name is the resource key your code and XAML will reference. The value is the translated string. Visual Studio provides a built-in editor for these files, though they are plain XML and can be edited in any text editor.

```xml
<!-- Strings/en-US/Resources.resw -->
<data name="WelcomeMessage.Text" xml:space="preserve">
  <value>Welcome to the app</value>
</data>
<data name="SignInButton.Content" xml:space="preserve">
  <value>Sign in</value>
</data>
```

The naming convention for XAML-bound resources follows the pattern `UidValue.PropertyName`. The portion before the dot is the `x:Uid` value you assign to the XAML element, and the portion after the dot is the property on that element you want to set. This dot-separated format is what allows a single `x:Uid` to set multiple properties on one element.

When the application runs, the resource manager evaluates the user's language list and selects the best matching folder. If no exact match exists, it tries partial matches such as `fr` before `fr-FR`, and if nothing matches it falls back to the neutral language resources defined at the top of the `Strings` folder. Providing a neutral fallback is important for languages where you support the language but not every regional variant.

---

## Localizing XAML with x:Uid

The `x:Uid` attribute is the primary way to bind XAML elements to resource strings without writing code. When you add `x:Uid` to a XAML element, the resource system looks up all resource keys that start with that uid value followed by a dot, and sets the corresponding properties automatically when the page loads.

```xml
<TextBlock x:Uid="WelcomeMessage" />
<Button x:Uid="SignInButton" />
```

With the `.resw` entries shown earlier, the runtime will set `WelcomeMessage.Text` on the `TextBlock` and `SignInButton.Content` on the `Button`. The property names in the resource file must match actual properties on the element type. If a property name does not exist on the element, the runtime silently ignores that resource entry.

One practical consideration is that `x:Uid` overrides any value set directly in XAML for the same property. If you write `<TextBlock x:Uid="WelcomeMessage" Text="Placeholder" />`, the resource system will replace "Placeholder" with the localized string at load time. This can cause confusion during development when you are iterating on layout and expect to see your placeholder text, so teams sometimes leave the `Text` attribute empty or omit it entirely on elements that carry an `x:Uid`.

---

## Localizing Multiple Properties from One x:Uid

A single `x:Uid` can populate several properties at once. This is useful for controls where both the visible content and an accessibility property need translated values.

```xml
<Button x:Uid="SubmitButton" />
```

```xml
<!-- Strings/en-US/Resources.resw -->
<data name="SubmitButton.Content" xml:space="preserve">
  <value>Submit</value>
</data>
<data name="SubmitButton.AutomationProperties.Name" xml:space="preserve">
  <value>Submit the form</value>
</data>
```

The resource system supports attached property names in the key, so `AutomationProperties.Name` refers to the attached property `AutomationProperties.Name` on the element. This pattern ensures that screen readers receive the more descriptive string while the button face shows the shorter label, and both strings are managed through the same resource file without any code.

Images can also be described this way. An `Image` element with `x:Uid` can receive an `AutomationProperties.Name` value that describes the image content for screen readers, with that description translated per locale.

---

## Accessing Resources from Code

When localization logic needs to happen in C# rather than in XAML, `ResourceLoader` provides access to the same resource files.

```csharp
var loader = new ResourceLoader();
string welcomeText = loader.GetString("WelcomeMessage/Text");
```

Note the difference in syntax between XAML and code. In `.resw` files the key is `WelcomeMessage.Text` (dot-separated), but `ResourceLoader.GetString` uses a forward slash to separate the uid from the property name. This is a common source of confusion when looking up resources from code for the first time.

For resources in a named file other than `Resources.resw`, you construct the loader with the file name:

```csharp
var loader = new ResourceLoader("Errors");
string errorText = loader.GetString("NetworkTimeout");
```

This would load from `Strings/en-US/Errors.resw`. Splitting resources across multiple files by category, such as separating error messages, UI labels, and onboarding text, helps large applications keep their resource files organized and makes it easier for translators to understand the context of each string.

---

## Right-to-Left Layout Support

Languages like Arabic, Hebrew, and Persian read from right to left. Supporting these languages requires more than translating strings; the entire layout must mirror horizontally so that content flows in the direction the reader expects.

WinUI 3 handles this through the `FlowDirection` property, which exists on every `FrameworkElement`. Setting `FlowDirection` to `RightToLeft` on a root element causes all panels, controls, and text within that subtree to mirror their layout. Content that was at the left edge appears at the right edge, navigation that opens from the left opens from the right, and text alignment flips to match the reading direction.

The recommended approach is to set `FlowDirection` at the window or page root based on the active language rather than hardcoding it for specific languages. The `ResourceContext` or the active language can be checked at runtime to determine the appropriate direction.

```csharp
string language = Windows.Globalization.ApplicationLanguages.Languages[0];
var culture = new System.Globalization.CultureInfo(language);
rootGrid.FlowDirection = culture.TextInfo.IsRightToLeft
    ? FlowDirection.RightToLeft
    : FlowDirection.LeftToRight;
```

Some elements need to be excluded from mirroring even in RTL layouts. Icons that represent real-world objects with a fixed orientation, such as a back arrow or a clock face, should not flip. WinUI 3 provides `AutoMirroringEnabled` on certain controls, and you can override `FlowDirection` locally on any element to prevent it from inheriting the parent's direction.

Testing RTL layouts requires running the application with an RTL language active or overriding the language in the app manifest. Adding Arabic (`ar-SA`) as a supported language and switching the system language is the most thorough test, but many layout issues are visible simply by setting `FlowDirection` to `RightToLeft` on the root during development.

---

## Date, Number, and Currency Formatting

Hard-coding date or number format strings creates subtle bugs that only appear for users in locales that use different conventions. The `Windows.Globalization.DateTimeFormatting` and `Windows.Globalization.NumberFormatting` namespaces provide locale-aware formatting that respects the user's regional settings automatically.

For dates and times, `DateTimeFormatter` accepts a format template or a pattern string and produces output appropriate for the user's locale:

```csharp
using Windows.Globalization.DateTimeFormatting;

var formatter = new DateTimeFormatter("shortdate");
string formatted = formatter.Format(DateTimeOffset.Now);
// Produces "2/24/2026" in en-US, "24/02/2026" in fr-FR, etc.
```

The template strings like `"shortdate"`, `"longtime"`, and `"month day"` produce culturally appropriate formats without requiring knowledge of each locale's conventions. You can also use pattern strings for precise control while still respecting locale-specific separators and ordering.

For numbers, `DecimalFormatter` handles general numbers and `CurrencyFormatter` handles monetary values:

```csharp
using Windows.Globalization.NumberFormatting;

var currencyFormatter = new CurrencyFormatter("USD");
string price = currencyFormatter.Format(1299.99);
// Produces "$1,299.99" in en-US, "1 299,99 $US" in fr-FR

var decimalFormatter = new DecimalFormatter();
decimalFormatter.FractionDigits = 2;
string measurement = decimalFormatter.Format(3.14159);
```

`CurrencyFormatter` uses the user's locale to determine grouping separators, decimal separators, and currency symbol placement. Passing a currency code like `"USD"` or `"EUR"` tells the formatter what currency to represent, but the locale controls how that currency is displayed.

The .NET `CultureInfo` class and its associated format providers work correctly in WinUI 3 applications as well. `string.Format`, `ToString("C")`, and `ToString("d")` all respect the current culture when used with appropriate overloads. Teams already familiar with .NET globalization can continue using those APIs; the Windows.Globalization namespace is most valuable when you need the Windows-specific calendar systems, language lists, or phonetic sorting.

---

## Runtime Language Switching

WinUI 3 does not support true runtime language switching without restarting the application. The resource system loads the appropriate language files based on the language list at startup, and changing the language while the application is running does not automatically cause all resource lookups to re-execute. Elements already loaded into the visual tree retain their current string values.

For applications that need to support in-app language selection, the practical approach is to write the selected language to application settings, then prompt the user to restart. This is the same pattern many desktop applications use and is generally accepted by users as a reasonable behavior.

A community package called [WinUI3Localizer](https://github.com/AndrewKeepCoding/WinUI3Localizer){:target="_blank" rel="noopener noreferrer"} provides runtime language switching without application restart. It works by bypassing the standard resource loader and managing string lookups through its own mechanism, allowing language changes to propagate to bound elements dynamically. Teams that require runtime switching without restart can evaluate this package as an alternative to the built-in resource system.

The `ApplicationLanguages.PrimaryLanguageOverride` property in `Windows.Globalization` allows you to override the language the resource system uses, but this override only takes effect the next time the resource context is evaluated, which typically means after the next application launch. Setting this property in response to a user selection and then restarting is the supported pattern.

---

## Image and Asset Localization

The Windows resource system extends beyond strings to images and other assets. When images contain culture-specific text, symbols, or iconography, you can provide locale-specific versions using the same directory convention.

For images, the convention uses qualifiers in the file name rather than separate folders. A file named `Resources/flag.en-US.png` will be selected over `Resources/flag.png` when the active language is English (United States). The resource system resolves these qualifiers during packaging, so the application bundle contains all variants and the runtime selects the appropriate one based on the active language.

For most applications, image localization is limited to images that contain text, such as diagrams, screenshots, or marketing artwork that was designed for a specific language. Purely graphical images rarely need localization. Accessibility descriptions for those images, however, do need localization and can be handled through the `x:Uid` pattern described earlier.

---

## Preparing an App for Localization

Designing for localization from the start costs far less than retrofitting it later. A few practices make the difference between an application that localizes cleanly and one that requires significant rework.

Avoid concatenating strings to form sentences. A pattern like `"Hello, " + username + "!"` breaks in languages where the user's name comes before the greeting, or where gendered forms change the surrounding words. Instead, use format strings from resources such as `"Hello, {0}!"` and substitute values at runtime using `string.Format` or the `ResourceLoader` equivalent. This gives translators control over word order without requiring code changes.

Do not assume text length. German and Finnish strings are often significantly longer than their English equivalents, and Arabic and Hebrew strings can be shorter but require different layout considerations. Controls with fixed widths that look fine in English may overflow in German. Design layouts to accommodate expansion of around 30 to 40 percent over English string lengths, use wrapping text where appropriate, and test with longer languages during development rather than after translation.

Keep strings out of code. Resource strings should live in `.resw` files, not in string literals scattered through view models or code-behind. This includes error messages, status text, and any other user-visible content. When strings are in code, translators cannot find them without understanding the codebase; when they are in resource files, translators work entirely with the resource tool of their choice.

Provide context for translators in the resource file comments. A string like `"New"` is ambiguous without context: it could be an adjective meaning recently created, a button label that creates a new item, or an abbreviation for something else entirely. The `.resw` file supports a `comment` element on each entry for exactly this purpose. Filling in those comments before sending files to translation significantly reduces back-and-forth with translators and improves translation quality.

```xml
<data name="NewDocumentButton.Content" xml:space="preserve">
  <value>New</value>
  <comment>Label for a toolbar button that creates a new document. Keep short.</comment>
</data>
```

Test with pseudolocalization before you have real translations. Pseudolocalization replaces Latin characters with accented equivalents and wraps strings in brackets, making it easy to see which strings are hard-coded (they remain unchanged) and which are correctly loaded from resources (they appear in pseudo-translated form). It also reveals layout issues caused by longer strings. Visual Studio includes a pseudolocalization tool, and it is far cheaper to catch layout problems during development than after translations arrive.

Finally, mark the language support in the app manifest. The `uap:SupportedLocale` entries in `Package.appxmanifest` inform the Windows Store and deployment tooling which languages the application supports. Without these entries, the packaging system may not include the correct resource files in distributed builds, leading to missing translations that were present in local development builds but absent from installed packages.
