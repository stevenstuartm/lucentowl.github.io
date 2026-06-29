---
title: "Styling, Theming, and Fluent Design"
layout: guide
category: "WinUI 3"
subcategory: "Styling & Resources"
description: "Customizing the appearance of WinUI 3 applications through styles, lightweight styling, control templates, Fluent Design integration, and theme switching between light, dark, and high contrast modes."
tags: [winui, winui-3, xaml, styling, theming, fluent-design, desktop, practical]
---

## Table of Contents

- [XAML Styles](#xaml-styles)
- [Lightweight Styling](#lightweight-styling)
- [Control Templates](#control-templates)
- [Fluent Design System](#fluent-design-system)
- [Theme Switching](#theme-switching)
- [Creating Custom Theme Resources](#creating-custom-theme-resources)
- [Best Practices](#best-practices)

---

## XAML Styles

A Style in WinUI 3 is a collection of property assignments packaged as a reusable resource. Styles are composed of `Setter` elements, each mapping a dependency property on the target type to a value. A simple button style might set the background, corner radius, and font weight through a handful of setters, allowing every button in the application to share those values from one definition rather than repeating attributes on every element.

```xml
<Style x:Key="PrimaryButtonStyle" TargetType="Button">
    <Setter Property="Background" Value="{ThemeResource AccentButtonBackground}" />
    <Setter Property="Foreground" Value="{ThemeResource AccentButtonForeground}" />
    <Setter Property="CornerRadius" Value="8" />
    <Setter Property="FontWeight" Value="SemiBold" />
</Style>
```

The distinction between explicit styles and implicit styles shapes how they are applied. An explicit style carries an `x:Key`, so it must be assigned deliberately on each control through `Style="{StaticResource PrimaryButtonStyle}"`. This approach works well when only certain controls of a given type should adopt the style. An implicit style omits the `x:Key` and relies on `TargetType` alone; once placed in a resource dictionary, it automatically applies to every instance of that type within the scope where it is defined. Implicit styles are convenient for establishing consistent defaults across a page or application, though they can produce surprises if a style defined in an outer scope unexpectedly affects controls deeper in the tree.

Style inheritance through `BasedOn` lets you build a hierarchy without duplicating setters. A derived style references its parent through `BasedOn="{StaticResource BaseButtonStyle}"` and then adds or overrides specific setters. This keeps base definitions thin and lets specialized variants extend them without copying.

```xml
<Style x:Key="LargeButtonStyle" TargetType="Button"
       BasedOn="{StaticResource PrimaryButtonStyle}">
    <Setter Property="Padding" Value="24,12" />
    <Setter Property="FontSize" Value="16" />
</Style>
```

One important constraint: a style can only set properties that are defined as dependency properties on the target type. Regular CLR properties are not settable through Setter elements.

---

## Lightweight Styling

Most customization needs in WinUI 3 do not require rewriting a control's template. Controls expose internal named resources for their colors, brushes, thicknesses, and corner radii, and you can override those resources at any scope in the resource hierarchy to change how the control looks without touching its structure.

This approach is called lightweight styling. A Button, for example, uses resources named `ButtonBackground`, `ButtonBackgroundPointerOver`, `ButtonBackgroundPressed`, and `ButtonBackgroundDisabled` to paint itself across its visual states. If you redefine any of those names in a closer scope, the control picks up your value instead of the default from the WinUI theme dictionary.

```xml
<!-- Override just the default background in a Page's resources -->
<Page.Resources>
    <SolidColorBrush x:Key="ButtonBackground" Color="#1A1A2E" />
    <SolidColorBrush x:Key="ButtonBackgroundPointerOver" Color="#16213E" />
</Page.Resources>
```

The scoping rules follow the standard XAML resource lookup: when a control resolves a `ThemeResource`, the runtime walks up the visual tree from the control, checking each element's resource dictionary, then the application dictionary, and finally the WinUI theme dictionaries. Placing an override inside a specific panel affects only controls within that panel, while placing it in `App.xaml` makes it application-wide.

Lightweight styling also applies through a `Style` using setters that reference those same named resources.

```xml
<Style x:Key="CustomButtonStyle" TargetType="Button">
    <Setter Property="Background"
            Value="{ThemeResource ButtonBackground}" />
    <Setter Property="Resources">
        <Setter.Value>
            <ResourceDictionary>
                <SolidColorBrush x:Key="ButtonBackground"
                                 Color="#0F3460" />
                <SolidColorBrush x:Key="ButtonBackgroundPointerOver"
                                 Color="#533483" />
            </ResourceDictionary>
        </Setter.Value>
    </Setter>
</Style>
```

Finding the correct resource names for a given control requires consulting the [WinUI source on GitHub](https://github.com/microsoft/microsoft-ui-xaml){:target="_blank" rel="noopener noreferrer"} or the [WinUI 3 Gallery](https://aka.ms/winui3/gallery){:target="_blank" rel="noopener noreferrer"}, both of which expose the default generic.xaml definitions and all the named theme resources used by each control.

---

## Control Templates

When lightweight styling is not enough because you need to restructure the visual layout of a control, a `ControlTemplate` gives you complete control over every element the control renders. The template defines the full visual tree, and the control's logic binds to named parts within it.

Controls communicate their expectations through two conventions. A `TemplatePart` attribute on the control class declares that it will look for an element with a specific name and type; if found, the control uses it for specific behavior. A `TextBox`, for example, expects a part named `ContentElement` of type `ScrollViewer` to host its editable text. If your template omits a required part, the corresponding feature silently stops working rather than throwing an exception, which makes testing templates carefully important.

Visual states define how the control's appearance changes in response to interaction. The `TemplateVisualState` attributes on the control class enumerate the valid states and the groups they belong to. Inside your template, you wire up these states through `VisualStateManager.VisualStateGroups`:

```xml
<ControlTemplate TargetType="Button">
    <Grid x:Name="RootGrid" CornerRadius="{TemplateBinding CornerRadius}">
        <VisualStateManager.VisualStateGroups>
            <VisualStateGroup x:Name="CommonStates">
                <VisualState x:Name="Normal" />
                <VisualState x:Name="PointerOver">
                    <VisualState.Setters>
                        <Setter Target="RootGrid.Background"
                                Value="{ThemeResource ButtonBackgroundPointerOver}" />
                    </VisualState.Setters>
                </VisualState>
                <VisualState x:Name="Pressed">
                    <VisualState.Setters>
                        <Setter Target="RootGrid.Background"
                                Value="{ThemeResource ButtonBackgroundPressed}" />
                    </VisualState.Setters>
                </VisualState>
            </VisualStateGroup>
        </VisualStateManager.VisualStateGroups>
        <ContentPresenter x:Name="ContentPresenter"
                          Content="{TemplateBinding Content}"
                          Padding="{TemplateBinding Padding}" />
    </Grid>
</ControlTemplate>
```

`TemplateBinding` pulls property values from the control instance into the template, letting the consumer of the control set properties like `Padding` or `FontSize` without needing to know how the template uses them internally. Properties bound this way read from the control at render time, so changes to the control's properties automatically flow into the template.

Templates are heavyweight to maintain and easy to get wrong because the control still expects specific part names and visual state names. Prefer lightweight styling when the goal is only changing colors, sizes, or brushes.

---

## Fluent Design System

WinUI 3 implements the [Fluent Design System](https://learn.microsoft.com/en-us/windows/apps/design/){:target="_blank" rel="noopener noreferrer"} at a low level, so many of its principles are available without any extra configuration. Rounded corners appear by default on controls through the `ControlCornerRadius` and `OverlayCornerRadius` theme resources. Depth is expressed through the layered color system where background surfaces use different tones depending on their elevation in the UI hierarchy.

Acrylic material, which creates a translucent blurred background, is available through `AcrylicBrush`. You can apply it to any background property, though it is most commonly used on navigation panels, title bars, and flyout surfaces.

```xml
<Grid>
    <Grid.Background>
        <AcrylicBrush TintColor="#FF202020"
                      TintOpacity="0.8"
                      FallbackColor="#FF202020" />
    </Grid.Background>
</Grid>
```

The `FallbackColor` handles cases where acrylic is unavailable, such as when the user's machine is running in battery saver mode or when the window is minimized and the compositor disables transparency. Always supply a solid fallback.

Motion in Fluent Design is expressed through the animation system built into WinUI. Controls animate their visual state transitions by default using `RepositionThemeAnimation`, `FadeInThemeAnimation`, and similar named animations that align with the Fluent timing curves. You can reference these in your own templates through `ThemeAnimation` elements inside visual states.

The Fluent Design resource system means that many of the design decisions are already made for you. The `SystemAccentColor` surfaces the user's chosen accent color from Windows settings, and WinUI exposes it through a family of derived brushes such as `SystemAccentColorLight1` and `SystemAccentColorDark2`. Using these resources ensures your application follows the user's personalization choices.

---

## Theme Switching

WinUI 3 applications respond to Windows theme settings automatically when you use `ThemeResource` markup extensions instead of `StaticResource`. The difference is significant: `StaticResource` resolves once at load time and never updates, while `ThemeResource` re-evaluates whenever the active theme changes. Mixing the two is a common source of controls that look correct in one theme but remain stuck in the wrong colors in another.

The active theme is controlled by the `RequestedTheme` property, which exists on `Application`, `Window`, and individual `FrameworkElement` instances. Setting it on the `Application` applies globally; setting it on a specific element creates a local override that affects that element and its descendants.

```xml
<!-- In App.xaml for a default dark theme -->
<Application RequestedTheme="Dark" ...>
```

To let users switch themes at runtime, set `RequestedTheme` on the root element in response to a control change:

```csharp
private void OnThemeToggled(object sender, RoutedEventArgs e)
{
    if (Content is FrameworkElement root)
    {
        root.RequestedTheme = root.RequestedTheme == ElementTheme.Dark
            ? ElementTheme.Light
            : ElementTheme.Dark;
    }
}
```

Note that `Application.RequestedTheme` cannot be changed after startup; that property is read at launch to establish the initial theme. Runtime switching must go through a `FrameworkElement`, typically the root `Grid` or `Window.Content`.

WinUI 3 also supports High Contrast themes, which are accessibility modes in Windows that replace colors with high-contrast system colors. Controls built on WinUI automatically adapt to High Contrast when they use the correct theme resources, because the WinUI theme dictionaries include a separate High Contrast dictionary alongside Light and Dark. Custom brushes that you define with hard-coded colors will not adapt, which is why theme-aware resource definitions matter for accessibility.

To detect the current system theme programmatically, use `UISettings`:

```csharp
var uiSettings = new Windows.UI.ViewManagement.UISettings();
var background = uiSettings.GetColorValue(
    Windows.UI.ViewManagement.UIColorType.Background);
bool isDark = background == Windows.UI.Color.FromArgb(255, 0, 0, 0);
```

---

## Creating Custom Theme Resources

Defining your own resources that respond to theme changes follows the same pattern WinUI uses internally. You create a `ResourceDictionary` with a `ThemeDictionaries` section containing three child dictionaries keyed as `Light`, `Dark`, and `HighContrast`.

```xml
<ResourceDictionary>
    <ResourceDictionary.ThemeDictionaries>
        <ResourceDictionary x:Key="Light">
            <SolidColorBrush x:Key="AppSurfaceBrush" Color="#F5F5F5" />
            <SolidColorBrush x:Key="AppAccentBrush" Color="#0063B1" />
        </ResourceDictionary>
        <ResourceDictionary x:Key="Dark">
            <SolidColorBrush x:Key="AppSurfaceBrush" Color="#1C1C1C" />
            <SolidColorBrush x:Key="AppAccentBrush" Color="#60CDFF" />
        </ResourceDictionary>
        <ResourceDictionary x:Key="HighContrast">
            <SolidColorBrush x:Key="AppSurfaceBrush"
                             Color="{ThemeResource SystemColorWindowColor}" />
            <SolidColorBrush x:Key="AppAccentBrush"
                             Color="{ThemeResource SystemColorHighlightColor}" />
        </ResourceDictionary>
    </ResourceDictionary.ThemeDictionaries>
</ResourceDictionary>
```

Any resource defined inside `ThemeDictionaries` and referenced with `ThemeResource` will automatically serve the correct variant for the active theme. Resources defined outside `ThemeDictionaries` in the same dictionary are theme-neutral and behave like `StaticResource` values regardless of the markup extension used to reference them.

For the High Contrast dictionary, prefer mapping to the Windows system color resources like `SystemColorWindowColor` and `SystemColorButtonTextColor` rather than hard-coding specific colors. Windows surfaces these system colors correctly for each High Contrast theme variant, so deferring to them keeps your application compatible with all the contrast modes a user might have configured.

Organizing themed resource dictionaries in separate files keeps `App.xaml` from becoming unwieldy. A common pattern places the theme dictionaries in a `Themes/` folder and merges them into `App.xaml` through `ResourceDictionary.MergedDictionaries`.

```xml
<Application.Resources>
    <ResourceDictionary>
        <ResourceDictionary.MergedDictionaries>
            <ResourceDictionary Source="Themes/BrandBrushes.xaml" />
            <ResourceDictionary Source="Themes/Typography.xaml" />
        </ResourceDictionary.MergedDictionaries>
    </ResourceDictionary>
</Application.Resources>
```

---

## Best Practices

The styling system in WinUI 3 forms a natural escalation path, and the most maintainable applications move up it only when necessary. Lightweight styling through resource overrides handles the majority of visual customization with the least risk, since the control retains its original template and all its built-in behavior. A full `ControlTemplate` is the right tool when you genuinely need a different structure, but it carries an ongoing maintenance burden because any changes to the default template in future WinUI versions will not automatically flow into your custom copy.

Always use `ThemeResource` for any color, brush, or size value that you want to behave correctly in both Light and Dark modes. Reaching for `StaticResource` or a hard-coded value is fine for values that genuinely should not change with the theme, like a brand color that appears identically in all modes, but avoid it for anything that is meant to track the system appearance.

Define shared styles in resource dictionaries merged at the `Application` level, and prefer scoping styles to the narrowest reasonable level. A style defined on a single page cannot accidentally affect controls in other pages, whereas an implicit style in `App.xaml` affects every matching control in the entire application. The narrower the scope, the fewer surprises when the project grows.

When extending or overriding existing WinUI control styles, copy the base style from the WinUI source or the document outline in Visual Studio as a starting point rather than writing one from scratch. This preserves the visual states, template parts, and accessibility behaviors that the control expects. Removing a visual state from a copied template is much safer than reconstructing one you forgot.

For accessibility, test High Contrast mode deliberately. The Windows Settings High Contrast themes are easy to enable and will immediately reveal any hard-coded colors that are not adapting. Controls that use only WinUI theme resources pass this test automatically; custom brushes require explicit High Contrast dictionary entries.

Fluent Design resources like corner radii, surface colors, and the accent color palette are defined as named resources precisely so that applications participate in the system-wide design language without manual coordination. Using `ControlCornerRadius`, `SystemAccentColor`, and the layered background brushes like `LayerFillColorDefaultBrush` means your application will look at home alongside other well-crafted Windows applications.
