---
title: "Resource Management in WinUI 3"
layout: guide
category: "WinUI 3"
subcategory: "Styling & Resources"
description: "How WinUI 3 finds and applies XAML resources: ResourceDictionary keys, the lookup from an element up to the app and the framework, merged dictionaries and their order, StaticResource versus ThemeResource, theme dictionaries for light, dark, and high contrast, changing resources from code, and where resources should live for startup performance."
tags: [resourcedictionary, merged-dictionaries, themeresource, theme-dictionaries, high-contrast, fundamentals]
---

## What Resources Are For

A XAML resource is an object defined once under a key and referenced by that key wherever it's needed. A brand color used on forty controls lives in one `SolidColorBrush` resource, and changing the brand color means editing one line. Brushes, colors, styles, control and data templates, storyboards, value converters, and plain values such as a `Thickness` or an `x:Double` all work as resources.

A resource has to be shareable, because one resource can be referenced from many places in the element tree while an element can sit at only one place in it. That rules out controls, panels, shapes, and anything else derived from `UIElement`. A custom class can be a resource if it has a parameterless constructor and doesn't derive from `UIElement`, which is how a value converter gets created from markup.

---

## ResourceDictionary and Keys

Resources live in a `ResourceDictionary`. Every `FrameworkElement` has a `Resources` property that holds one, and so does `Application`. A WinUI `Window` isn't a `FrameworkElement` and has no `Resources`, so the `<Window.Resources>` familiar from WPF doesn't exist. Resources for one window go on its root element, such as the top-level `Grid`, or in `Application.Resources`. Each resource takes a key through `x:Key`, and markup references it with `{StaticResource key}` or `{ThemeResource key}`:

```xml
<Page.Resources>
    <SolidColorBrush x:Key="PrimaryBrush" Color="#0078D4" />
    <Thickness x:Key="CardPadding">16,12,16,12</Thickness>
</Page.Resources>

<Border Padding="{StaticResource CardPadding}" Background="{StaticResource PrimaryBrush}" />
```

Every resource needs a key. A `Style`, `ControlTemplate`, or `DataTemplate` that sets `TargetType` and has no `x:Key` is keyed by that type instead. The framework applies such an implicit style or template to every matching element in scope that doesn't set its own, and markup can't reference it by name, since `{StaticResource}` takes only string keys. Give resources an `x:Key`, not an `x:Name`. An `x:Name` on a resource generates a code-behind field and makes the resource get created as soon as its dictionary is, and Microsoft's pages disagree on whether markup can look it up by that name at all.

Keys must be unique within one dictionary. The same key can appear in dictionaries at different levels, and the lookup order below decides which one a reference gets.

---

## How a Reference Is Resolved

When XAML loads and meets `{StaticResource CardPadding}`, the framework searches in this order and stops at the first match:

1. The `Resources` of the element that makes the reference, then of each parent up to the root of that XAML, usually the page.
2. `Application.Resources`, including every dictionary it merges. In an app built from the project template, that includes `XamlControlsResources`, which supplies the WinUI control styles and theme brushes such as `TextFillColorPrimaryBrush`.
3. The system resources that Windows supplies, such as `SystemColorWindowTextColor` and `SystemAccentColor`.

{% include figure.html id="winui-resource-lookup" %}

If no level has the key, loading throws a XAML parse exception. That holds for `{ThemeResource}` as much as `{StaticResource}`, and the markup compiler doesn't always catch it, so a misspelled key can surface only when the page loads.

Because the search stops at the first match, a key defined on a page shadows the same key in `Application.Resources`, and a key on a `Border` shadows the page's key for the elements inside that `Border`. A section of the UI can override an app-wide value this way on purpose. The same mechanism produces confusing results when two unrelated resources share a name by accident, and prefixing keys by area, such as `Card` or `Nav`, keeps that rare.

Within one dictionary, a resource can reference only resources defined above it in the file, because forward references aren't supported. A brush goes before the style that uses it. The same rule applies across levels. App resources load before any page, so a page can reference them freely, but an app resource can't reference a page's.

---

## Merged Dictionaries

A dictionary can pull in other dictionaries through its `MergedDictionaries` collection, which is how resources get split across files. Each file has a `<ResourceDictionary>` root and contains only resources. A dictionary file usually has no code-behind. The exception is one whose templates use `{x:Bind}`, which needs an `x:Class` and a code-behind class, and is merged by instantiating that class rather than through `Source`. `MergedDictionaries` is a property of `ResourceDictionary`, so using it means writing the dictionary element out explicitly instead of letting `Resources` create one implicitly. This is `App.xaml` as the project template creates it, with app files added:

```xml
<Application.Resources>
    <ResourceDictionary>
        <ResourceDictionary.MergedDictionaries>
            <XamlControlsResources xmlns="using:Microsoft.UI.Xaml.Controls" />
            <ResourceDictionary Source="Styles/Colors.xaml" />
            <ResourceDictionary Source="Styles/Typography.xaml" />
            <ResourceDictionary Source="Styles/Controls.xaml" />
        </ResourceDictionary.MergedDictionaries>

        <SolidColorBrush x:Key="BrandBrush" Color="#0078D4" />
    </ResourceDictionary>
</Application.Resources>
```

`XamlControlsResources` holds the WinUI control styles and theme resources, and it defines a large number of keys. A dictionary later in the list wins over an earlier one, so Microsoft says to list `XamlControlsResources` first, where it can't override the app's own styles and resources.

Order matters because of how lookup searches a dictionary. It checks the dictionary's own keys first, then the merged dictionaries in the reverse of their declared order. `BrandBrush` above beats any `BrandBrush` in the merged files, and a key defined in both `Colors.xaml` and `Controls.xaml` resolves to the one in `Controls.xaml`. Key uniqueness is enforced only inside one dictionary, so that collision raises no error, and reordering the list can silently change which value the app uses. The same rule works on purpose as a fallback chain: a default in an early file and a user preference in a later one, as long as the key isn't also defined in the dictionary that does the merging.

Merged files can merge further files, so a `Styles/All.xaml` can gather the others and `App.xaml` merge only that one.

---

## StaticResource vs ThemeResource

`{StaticResource}` resolves once, when the XAML loads, and the property keeps that value. Microsoft compares it to a find-and-replace done at load time.

`{ThemeResource}` resolves the same way at load and again each time the theme changes, whether the user switched Windows between light and dark, turned on a contrast theme, or the app set `RequestedTheme` to force a theme on part of the tree. Each time, the property gets the resource from the new theme's dictionary, one of the per-theme dictionaries described in the next section.

A value that differs between themes therefore takes `{ThemeResource}` wherever it's used, which mostly means brushes and colors and occasionally sizes and fonts. A `{StaticResource}` reference to a theme-dependent brush shows the right color at launch and keeps it after the user switches themes, a bug that testing in one theme never shows. A value that's the same in every theme, such as a converter or a fixed padding, takes `{StaticResource}`, since Microsoft recommends `{ThemeResource}` only for values that can change between themes.

The framework's own brushes, such as `TextFillColorPrimaryBrush`, `CardBackgroundFillColorDefaultBrush`, and `SystemFillColorCriticalBrush`, all vary by theme, and the built-in control templates reference them with `{ThemeResource}`. App markup that uses them should do the same.

---

## Theme Dictionaries

A dictionary's `ThemeDictionaries` collection holds one dictionary per theme, keyed `Light`, `Dark`, and `HighContrast`, each defining the same keys with different values. A `{ThemeResource}` reference picks the dictionary that matches the theme in effect:

```xml
<!-- Styles/Colors.xaml -->
<ResourceDictionary
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <ResourceDictionary.ThemeDictionaries>
        <ResourceDictionary x:Key="Light">
            <SolidColorBrush x:Key="CardSurfaceBrush" Color="#FFFFFF" />
            <SolidColorBrush x:Key="CardAccentBrush" Color="#0063B1" />
        </ResourceDictionary>
        <ResourceDictionary x:Key="Dark">
            <SolidColorBrush x:Key="CardSurfaceBrush" Color="#2B2B2B" />
            <SolidColorBrush x:Key="CardAccentBrush" Color="#60CDFF" />
        </ResourceDictionary>
        <ResourceDictionary x:Key="HighContrast">
            <SolidColorBrush x:Key="CardSurfaceBrush" Color="{ThemeResource SystemColorWindowColor}" />
            <SolidColorBrush x:Key="CardAccentBrush" Color="{ThemeResource SystemColorHighlightColor}" />
        </ResourceDictionary>
    </ResourceDictionary.ThemeDictionaries>
</ResourceDictionary>
```

Each theme's dictionary should define every key. When one is missing a key, lookup can fail after the user switches to that theme, and the app won't look right.

The `HighContrast` dictionary maps to the `SystemColor...Color` resources rather than to fixed colors. A contrast theme lets the user choose the exact colors, and those resources carry the user's choices, so hardcoded hex values there override the setting the user relies on. They're referenced with `{ThemeResource}` so they update when the user changes those colors.

That is the one exception to a rule for definitions inside theme dictionaries. They reference other resources with `{StaticResource}`, not `{ThemeResource}`. Only values that don't depend on the app's theme, the `SystemColor...` colors and `SystemAccentColor`, take `{ThemeResource}` there. The rule exists because brushes, unlike most XAML objects, are shared by every element that references them. When part of the tree sets a different `RequestedTheme`, re-evaluating a `{ThemeResource}` inside a shared brush for one subtree changes it for the other too, and a dark page can pick up light colors after a light-themed flyout opens.

For the same reason, define `Light` and `Dark` separately rather than a single `Default` dictionary. `Default` is accepted as a key, but a `Default` plus `HighContrast` pair breaks the same way once parts of the app run in different themes.

---

## Changing Resources from Code

Code reaches a dictionary through an element's `Resources` property or `Application.Current.Resources`, and reads it like any other dictionary:

```csharp
if (Application.Current.Resources.TryGetValue("BrandBrush", out object value))
{
    var brandBrush = (SolidColorBrush)value;
}
```

Lookup from code is narrower than lookup from markup. It searches that one dictionary and its merged dictionaries, where the last declared still wins, but it never moves up to a parent element or on to `Application.Resources`. A page's `Resources` won't find a brush defined at the app level.

Adding or replacing an entry at run time doesn't reach markup that has already loaded, because each reference resolved when its XAML was parsed. Pages loaded afterward do see the new entry. An app that adds resources in code does it in `OnLaunched`, before the first page loads, and not in the `App` constructor, where Microsoft says it can't be done.

Changing a property on a resource object is different from replacing the entry. Because brushes are shared, setting `Color` on a brush resource changes it for every element that uses the brush.

---

## Where Resources Should Live

Placement decides which elements can reach a resource, and it also affects startup time. `App.xaml` and every file it merges are parsed when the app starts, whether or not the first page uses them. A resource that only one page references belongs in that page's `Resources`, unless it's the page the app opens on, and app-level resources are for what several pages share. Merging a file parses the whole file even when the page uses one resource from it, so a file merged into the first page should hold only what startup needs.

Unused resources cost little otherwise, since a dictionary creates each resource the first time something requests it, apart from those declared with `x:Name`. A `UserControl` is the exception to watch. A dictionary declared inside one is copied for every instance, so a `UserControl` repeated many times, such as in a list, should take its resources from the page or the app.

Split the app-level files the way people search for things. Files by kind, such as colors and brushes, typography, spacing, and control styles, suit most apps, since someone looking for a brush opens `Colors.xaml`. A large app whose sections look different adds per-feature files merged by the pages that use them, leaving `App.xaml` for what the whole app shares. Theme dictionaries fit in the colors file, which puts every theme-dependent value in one place.
