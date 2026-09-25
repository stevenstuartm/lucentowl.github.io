---
title: "Styling, Theming, and Fluent Design"
layout: guide
category: "WinUI 3"
subcategory: "Styling & Resources"
description: "Changing how WinUI 3 controls look without losing their built-in behavior: styles based on the default control styles, lightweight styling through the resources each control reads, retemplating as a last resort, the Fluent resources for corners, color, type, and acrylic, and switching between light and dark themes at run time."
tags: [xaml-styles, lightweight-styling, control-templates, requestedtheme, acrylic, practical]
---

## Three Levels of Customization

WinUI gives an app three ways to change how a control looks, and each costs more than the one before it. The control's template is the tree of elements it draws itself with, and its states are the appearances it switches between, such as pressed or disabled:

| Level | What changes | What the control keeps |
| --- | --- | --- |
| Style | Property values, such as padding, font, and corner radius | Its template, states, and future updates, when the style is based on the control's default style |
| Lightweight styling | The brushes and sizes the template reads in each state, such as the pointer-over background | Its template, states, and future updates |
| Retemplating | The template itself: which elements the control is built from | Only what the new template reproduces |

Go only as far down this list as the design needs. Microsoft says the best way to stay current with WinUI's visual styles is to avoid custom styles and templates, and an app that replaces a built-in style or template stops getting changes to it.

---

## Styles

A `Style` is a reusable set of property values for one type of control. It names a `TargetType` and holds `Setter` elements, each pairing a property with a value:

```xml
<Style x:Key="PrimaryButtonStyle" TargetType="Button"
       BasedOn="{StaticResource DefaultButtonStyle}">
    <Setter Property="CornerRadius" Value="8" />
    <Setter Property="FontWeight" Value="SemiBold" />
    <Setter Property="Padding" Value="20,8" />
</Style>
```

```xml
<Button Content="Save" Style="{StaticResource PrimaryButtonStyle}" />
```

A style with an `x:Key` applies only to the controls that set `Style` to it. A style with no key is implicit, and applies to every control of its target type in scope that doesn't set a style of its own. An implicit style in `App.xaml` changes every matching control in the app, which is what makes it convenient for defaults and surprising when a page didn't expect it.

The `BasedOn` line matters more than it looks. WinUI's current look for each control lives in a named default style, such as `DefaultButtonStyle` or `DefaultTextBoxStyle`. A style that isn't based on it can leave the control without the current template and visual states, so Microsoft says to base a style on `Default<ControlName>Style` for any WinUI control that provides one. A class derived from a built-in control, such as a custom `ContentDialog`, needs an implicit style for the new type based on the parent's default style, or it may not get the WinUI look at all.

`BasedOn` also chains app styles. A `LargeButtonStyle` based on `PrimaryButtonStyle` inherits its setters and adds or overrides its own, and a derived style can target the base style's type or any type derived from it.

A setter can target only a dependency property. A value set directly on the control, such as `<Button Padding="4" Style="...">`, wins over the style's setter for that property.

Colors are where styles fall short. A setter for `Background` changes the button at rest, but the default template's pointer-over and pressed states paint the background from their own resources, so under the pointer the button shows the stock color again. The same happens to a `Background` set directly on the control. Changing a control's colors in every state is what lightweight styling is for.

---

## Lightweight Styling

A control's template doesn't hardcode its colors. Each state reads a named resource, and the names follow a pattern. A `Button` paints its background with `ButtonBackground` at rest, `ButtonBackgroundPointerOver` under the pointer, `ButtonBackgroundPressed` while pressed, and `ButtonBackgroundDisabled` when disabled, with the same suffixes on `ButtonForeground` and `ButtonBorderBrush`. Defining a resource with one of those names closer to the control than the WinUI default makes the template use it instead. The control keeps its template, its states, and its accessibility support, and only the values change.

Because these values differ between themes, the overrides go in theme dictionaries, one per theme:

```xml
<Page.Resources>
    <ResourceDictionary>
        <ResourceDictionary.ThemeDictionaries>
            <ResourceDictionary x:Key="Light">
                <SolidColorBrush x:Key="ButtonBackground" Color="Transparent" />
                <SolidColorBrush x:Key="ButtonForeground" Color="MediumSlateBlue" />
                <SolidColorBrush x:Key="ButtonBorderBrush" Color="MediumSlateBlue" />
                <SolidColorBrush x:Key="ButtonForegroundPointerOver" Color="SlateBlue" />
            </ResourceDictionary>
            <ResourceDictionary x:Key="Dark">
                <SolidColorBrush x:Key="ButtonBackground" Color="Transparent" />
                <SolidColorBrush x:Key="ButtonForeground" Color="LightSteelBlue" />
                <SolidColorBrush x:Key="ButtonBorderBrush" Color="LightSteelBlue" />
                <SolidColorBrush x:Key="ButtonForegroundPointerOver" Color="White" />
            </ResourceDictionary>
        </ResourceDictionary.ThemeDictionaries>
    </ResourceDictionary>
</Page.Resources>
```

Where the overrides live sets how far they reach, following the normal resource lookup. In a page's resources they restyle every button on that page, and in `App.xaml` every button in the app. To restyle one control, put them in that control's own `Resources`:

```xml
<CheckBox Content="Special CheckBox">
    <CheckBox.Resources>
        <ResourceDictionary>
            <ResourceDictionary.ThemeDictionaries>
                <ResourceDictionary x:Key="Light">
                    <SolidColorBrush x:Key="CheckBoxCheckBackgroundFillChecked" Color="Purple" />
                    <SolidColorBrush x:Key="CheckBoxCheckBackgroundStrokeChecked" Color="Purple" />
                </ResourceDictionary>
                <ResourceDictionary x:Key="Dark">
                    <SolidColorBrush x:Key="CheckBoxCheckBackgroundFillChecked" Color="Plum" />
                    <SolidColorBrush x:Key="CheckBoxCheckBackgroundStrokeChecked" Color="Plum" />
                </ResourceDictionary>
            </ResourceDictionary.ThemeDictionaries>
        </ResourceDictionary>
    </CheckBox.Resources>
</CheckBox>
```

Both samples are shortened and override only some states. A real override covers every state the design touches. A button with a custom `ButtonBackground` and the default `ButtonBackgroundPointerOver` jumps back to the stock color under the pointer, and a custom `ButtonBorderBrush` needs its `PointerOver` and `Pressed` versions too.

Each control's resource names are in its theme resources file, such as `Button_themeresources.xaml`. The files are in the WinUI source on GitHub under `controls/dev/`, most in `CommonStyles/` and the rest in the control's own folder. The Windows App SDK NuGet package ships the same definitions for the version the app uses, in `Microsoft.WinUI/Themes/generic.xaml` inside the package folder.

---

## Retemplating a Built-In Control

A control's `Template` property holds a `ControlTemplate`, the tree of elements the control draws itself with. Replacing it is the only way to change a control's structure, such as putting a `CheckBox`'s label under its box. The template is usually set through a style:

```xml
<Style x:Key="StackedCheckBoxStyle" TargetType="CheckBox"
       BasedOn="{StaticResource DefaultCheckBoxStyle}">
    <Setter Property="Template">
        <Setter.Value>
            <ControlTemplate TargetType="CheckBox">
                <!-- Start from the full default template and change only what the design needs -->
            </ControlTemplate>
        </Setter.Value>
    </Setter>
</Style>
```

Start from a copy of the control's default template rather than writing one from scratch. The `generic.xaml` in the app's Windows App SDK package has the version the app actually runs, which the GitHub source may have moved past. The control's code looks for elements with particular names and switches between particular visual states, and a template written from memory misses some. A missing part or state quietly breaks whatever depended on it, including accessibility support, so keep every name and every state from the copy, even ones the design doesn't seem to need.

Inside the template, `{TemplateBinding Padding}` and similar references pass the control's own property values through to template elements, so a consumer who sets `Padding` on the control still gets it.

A retemplated control is frozen at the version it was copied from. When a later WinUI release fixes the default template or changes its look, the copy doesn't change, and the control starts to look out of place beside its unmodified neighbors. Retemplate only when lightweight styling can't produce the design.

---

## Fluent Design Resources

WinUI's default styles already follow Fluent Design, Microsoft's design system for Windows. App-defined visuals match it by using the same named resources instead of hardcoded values.

- **Corners.** `ControlCornerRadius` rounds controls such as buttons and text boxes, and `OverlayCornerRadius` rounds larger surfaces such as flyouts and dialogs. Redefining either in `App.xaml` changes the rounding across the app.
- **Surface and text colors.** Layered fill brushes such as `LayerFillColorDefaultBrush` and `CardBackgroundFillColorDefaultBrush` give surfaces their elevation, and `TextFillColorPrimaryBrush` and `TextFillColorSecondaryBrush` color text. All of them vary by theme, so they're referenced with `{ThemeResource}`.
- **Accent.** `SystemAccentColor` is the accent color the user picked in Windows settings, with lighter and darker variants from `SystemAccentColorLight1` to `Light3` and `SystemAccentColorDark1` to `Dark3`. These are colors, not brushes, so they go in a brush's `Color`. `AccentFillColorDefaultBrush` is the ready-made accent brush the built-in controls use. An app with a brand color defines its own `SystemAccentColor` as a `Color` resource in `App.xaml`. In the WinUI source, the accent brushes are built from the variants rather than from `SystemAccentColor` itself, so a brand override that has to reach accent buttons defines the variants too.
- **Type.** Text styles such as `BodyTextBlockStyle`, `SubtitleTextBlockStyle`, and `TitleTextBlockStyle` apply the Windows type ramp, its fixed set of text sizes and weights, to a `TextBlock`.

**Acrylic** is a translucent, blurred material. An `AcrylicBrush` used as an element's background is in-app acrylic, which blurs the app's own content behind it. Microsoft recommends it for supporting surfaces that overlap content, such as a pane that opens over the page. For a plain vertical pane beside the content, Microsoft recommends an opaque background. Many built-in popups, including `MenuFlyout`, `ComboBox`, and `AutoSuggestBox`, already draw acrylic while open. The theme resource `AcrylicInAppFillColorDefaultBrush` gives the standard in-app acrylic without building a brush by hand:

```xml
<Grid Background="{ThemeResource AcrylicInAppFillColorDefaultBrush}">
```

Acrylic turns into a solid color when the user has turned off transparency effects in Windows settings, when Battery Saver is on, and on low-end hardware. In a Windows contrast theme, the user's chosen background color replaces it. A custom `AcrylicBrush` sets `FallbackColor` to control that solid color. Acrylic that shows the desktop behind the whole window is a window backdrop, set through the window rather than a brush.

---

## Switching Themes

By default an app follows the Windows setting for light or dark mode. There are two ways to override it, and they behave differently.

`Application.RequestedTheme` sets the theme for the whole app, but only at startup, in `App.xaml` or the `App` constructor. Setting it while the app runs throws `NotSupportedException`, so a theme choice made through this property takes effect on the next launch.

`FrameworkElement.RequestedTheme` can change at any time, and the value is inherited by everything inside the element unless a descendant sets its own. A WinUI `Window` has no `RequestedTheme`, so switching the whole window at run time means setting it on the window's root element:

```csharp
private void ApplyTheme(ElementTheme theme)
{
    if (window.Content is FrameworkElement root)
    {
        root.RequestedTheme = theme;
    }
}
```

`ElementTheme.Light` and `ElementTheme.Dark` force a theme. `ElementTheme.Default` is meant to hand the choice back to the app's theme, which normally follows Windows, but the `FrameworkElement.RequestedTheme` API reference also carries a note that `Default` always results in dark, so check a "use system setting" option with Windows in light mode. An app that offers the choice saves it in settings and applies it to the root element at startup, and to each new window it opens, since each window has its own root.

The window behind the root also has to follow the theme. Without a window backdrop, a root forced to dark while Windows is in light mode can still show the light window background behind it. A backdrop such as Mica follows the theme by itself. An app without one can give the root a theme-aware background, such as `{ThemeResource SolidBackgroundFillColorBaseBrush}`, a workaround reported to the WinUI repository that has to be removed again if a backdrop is added later.

Every `{ThemeResource}` reference inside the element resolves again when its theme changes, and a `{StaticResource}` reference to a theme-dependent brush keeps its old color. That is the most common reason part of a page stays dark after switching to light.

To find out which theme an element is actually using, read its `ActualTheme` property, which resolves `Default` to the theme in effect, and handle `ActualThemeChanged` to react when it changes. The event fires whenever the element's resolved theme changes, which includes a Windows change only while the element follows the system theme rather than a forced one.

A contrast theme overrides all of this. When the user turns one on, `RequestedTheme` is ignored and the app draws with the contrast theme's colors, so anything the app colored with its own resources needs a `HighContrast` entry in its theme dictionaries. Turning on a contrast theme in Windows settings while the app runs is the quickest way to find hardcoded colors.
