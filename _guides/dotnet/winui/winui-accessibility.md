---
title: "Accessibility in WinUI 3"
layout: guide
category: "WinUI 3"
subcategory: "Quality & Testing"
description: "Building accessible WinUI 3 applications with automation peers, screen reader support, keyboard navigation, high contrast themes, and UI Automation testing."
tags: [winui, winui-3, accessibility, screen-reader, keyboard-navigation, desktop, practical]
---

## Table of Contents

- [Why Accessibility Matters for Desktop Apps](#why-accessibility-matters-for-desktop-apps)
- [AutomationProperties: The Foundation](#automationproperties-the-foundation)
- [UI Automation and AutomationPeer Classes](#ui-automation-and-automationpeer-classes)
- [Custom Control Accessibility](#custom-control-accessibility)
- [Keyboard Navigation](#keyboard-navigation)
- [Screen Reader Support with Narrator](#screen-reader-support-with-narrator)
- [High Contrast Theme Support](#high-contrast-theme-support)
- [Testing Accessibility](#testing-accessibility)
- [WCAG Considerations for Desktop Apps](#wcag-considerations-for-desktop-apps)

---

## Why Accessibility Matters for Desktop Apps

Accessibility in desktop applications is often treated as an afterthought, something to bolt on before shipping rather than design for from the start. The consequence of that approach is expensive retrofitting. Accessibility features in WinUI 3 are mostly built into the controls themselves, but custom controls, complex layouts, and unusual interaction patterns require deliberate work to get right.

Windows has a long-established accessibility infrastructure called UI Automation (UIA). Assistive technologies like Narrator, JAWS, and NVDA all communicate with applications through this API, and WinUI 3 controls expose themselves to UIA through automation peers. When you build a standard `Button` or `ListBox`, the framework handles most of the UIA exposure automatically. When you build a custom control or compose existing controls in non-standard ways, you take on responsibility for that exposure yourself.

The good news is that WinUI 3 gives you the tools to do this well. `AutomationProperties`, `AutomationPeer` subclasses, and the `AccessibilityView` attached property cover the overwhelming majority of real-world scenarios.

---

## AutomationProperties: The Foundation

`AutomationProperties` is an attached property class that lets you annotate any `UIElement` with metadata that assistive technologies read. You can apply these properties in XAML without touching code-behind, which makes them easy to add incrementally.

The most commonly needed property is `AutomationProperties.Name`. Every interactive element should have a name that describes its purpose. Built-in controls infer this name from their content when possible: a `Button` with text content uses that text as its automation name automatically. Problems arise with icon-only buttons, image buttons, and controls whose visible label is separate from the control itself.

```xml
<!-- Icon-only button without accessible name - a screen reader reads nothing useful -->
<Button>
    <FontIcon Glyph="&#xE713;" />
</Button>

<!-- With an accessible name -->
<Button AutomationProperties.Name="Settings">
    <FontIcon Glyph="&#xE713;" />
</Button>
```

`AutomationProperties.LabeledBy` connects a control to a separate `TextBlock` that serves as its label. This is useful when the label is visually obvious from layout but not structurally associated in the accessibility tree.

```xml
<TextBlock x:Name="EmailLabel" Text="Email address" />
<TextBox AutomationProperties.LabeledBy="{x:Bind EmailLabel}" />
```

`AutomationProperties.HelpText` provides supplementary information beyond the name. Screen readers can optionally read this to the user when they focus an element. Use it for hints about expected input format or contextual notes that do not belong in the name itself.

```xml
<TextBox
    AutomationProperties.Name="Password"
    AutomationProperties.HelpText="Must be at least 12 characters and include a symbol." />
```

`AutomationProperties.LiveSetting` is for dynamic regions that update without user interaction. Setting it to `Polite` tells Narrator to announce changes after the user finishes their current task. Setting it to `Assertive` announces changes immediately, interrupting whatever the screen reader was doing. Use `Assertive` sparingly, reserving it for genuinely urgent updates like error messages or status alerts.

```xml
<TextBlock
    x:Name="StatusMessage"
    AutomationProperties.LiveSetting="Polite" />
```

In code, you update the text of this element normally and Narrator will announce the new content at the next appropriate moment.

`AutomationProperties.AccessibilityView` controls whether an element is visible in the accessibility tree. Setting it to `Raw` hides it from screen readers entirely. This is appropriate for purely decorative elements like background shapes or separators that carry no information and would only add noise to the reading experience.

```xml
<Rectangle Fill="Gray" AutomationProperties.AccessibilityView="Raw" />
```

---

## UI Automation and AutomationPeer Classes

Behind `AutomationProperties` lies the full UI Automation framework. Every WinUI 3 control has an associated `AutomationPeer` class that implements the UIA provider interface, exposing properties and control patterns to assistive technologies.

Control patterns are the structured behaviors that UIA defines for interactive elements. A button implements the `Invoke` pattern, which lets UIA clients programmatically click it. A checkbox implements the `Toggle` pattern. A list implements the `Selection` pattern. Assistive technologies use these patterns to understand what an element can do and to perform actions on the user's behalf.

When you use standard WinUI 3 controls, all of this is handled for you. The `ButtonAutomationPeer`, `CheckBoxAutomationPeer`, and other built-in peers implement the appropriate patterns. Understanding these patterns matters when you build custom controls that need to behave like a known control type.

---

## Custom Control Accessibility

A custom control that inherits from `Control` does not automatically expose itself to UIA in any meaningful way. You need to provide a custom `AutomationPeer` that describes the control to assistive technologies.

Creating a custom peer involves two steps: defining the peer class and overriding `OnCreateAutomationPeer` on your control to return an instance of it.

```csharp
// The custom control
public class RatingControl : Control
{
    protected override AutomationPeer OnCreateAutomationPeer()
        => new RatingControlAutomationPeer(this);
}
```

```csharp
// The automation peer
public class RatingControlAutomationPeer : FrameworkElementAutomationPeer, IRangeValueProvider
{
    private RatingControl RatingControl => (RatingControl)Owner;

    public RatingControlAutomationPeer(RatingControl owner) : base(owner) { }

    // Tell UIA what kind of control this is
    protected override AutomationControlType GetAutomationControlTypeCore()
        => AutomationControlType.Slider;

    // Provide a class name for additional identification
    protected override string GetClassNameCore()
        => nameof(RatingControl);

    // The accessible name, falling back to AutomationProperties.Name if set
    protected override string GetNameCore()
        => string.IsNullOrEmpty(base.GetNameCore()) ? "Rating" : base.GetNameCore();

    // IRangeValueProvider members
    public double Value => RatingControl.Value;
    public double Minimum => RatingControl.Minimum;
    public double Maximum => RatingControl.Maximum;
    public double SmallChange => 1;
    public double LargeChange => 1;
    public bool IsReadOnly => false;

    public void SetValue(double value)
    {
        if (!IsReadOnly)
            RatingControl.Value = (int)value;
    }
}
```

The peer inherits from `FrameworkElementAutomationPeer` and implements `IRangeValueProvider` to expose the slider-like behavior that a rating control has. Choosing the right `AutomationControlType` and the right control pattern interfaces tells screen readers how to describe the control and what keyboard interactions to announce.

When the control's state changes in a way that assistive technologies should know about, raise property changed events through the peer.

```csharp
// In RatingControl, when Value changes
private void NotifyValueChanged(double oldValue, double newValue)
{
    var peer = FrameworkElementAutomationPeer.FromElement(this) as RatingControlAutomationPeer;
    peer?.RaisePropertyChangedEvent(
        RangeValuePatternIdentifiers.ValueProperty,
        oldValue,
        newValue);
}
```

The [Microsoft.UI.Xaml.Automation.Peers namespace](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.automation.peers){:target="_blank" rel="noopener noreferrer"} lists all available peer base classes and pattern interfaces.

---

## Keyboard Navigation

Keyboard accessibility means that every function available through the mouse is also reachable and operable through the keyboard alone. In WinUI 3, Tab-based focus navigation is the primary mechanism, with arrow key navigation available for composite controls like lists and menus.

`IsTabStop` controls whether an element participates in Tab navigation. It defaults to `true` for interactive controls and `false` for non-interactive elements like `TextBlock`. Setting it to `false` on a button removes it from the Tab order, which is appropriate only when the button is decorative or its function is provided by another path.

`TabIndex` sets the explicit position of an element in the Tab sequence. The default behavior, where Tab visits elements in document order, is usually correct. Explicit `TabIndex` values are sometimes needed when layout order and reading order diverge, but they require careful management as the UI evolves.

```xml
<StackPanel>
    <!-- Visited first -->
    <TextBox TabIndex="0" Header="First name" />
    <!-- Visited second -->
    <TextBox TabIndex="1" Header="Last name" />
    <!-- Visited third -->
    <Button TabIndex="2" Content="Submit" />
</StackPanel>
```

`XYFocus` properties control directional navigation using arrow keys. This is especially useful for game-style layouts, media interfaces, or any UI designed for use with a remote control or gamepad, but it also benefits keyboard users navigating spatially organized content.

```xml
<Button x:Name="LeftBtn" Content="Left"
        XYFocus.Right="{x:Bind RightBtn}" />
<Button x:Name="RightBtn" Content="Right"
        XYFocus.Left="{x:Bind LeftBtn}" />
```

`FocusVisualKind` on `Application` or individual controls controls how the focus indicator renders. The default `HighVisibility` mode draws a visible focus rectangle, which is what most users need. Setting it to `Reveal` uses the Fluent Design reveal effect. Avoid `None` entirely because it removes the visual indication of focus, making keyboard navigation non-functional for sighted keyboard users.

For custom keyboard handling within a control, override `OnKeyDown` to intercept specific keys.

```csharp
protected override void OnKeyDown(KeyRoutedEventArgs e)
{
    if (e.Key == VirtualKey.Enter || e.Key == VirtualKey.Space)
    {
        // Activate the control
        ExecutePrimaryAction();
        e.Handled = true;
    }
    base.OnKeyDown(e);
}
```

Setting `e.Handled = true` prevents the key event from bubbling further up the visual tree, which avoids double-handling in parent controls.

---

## Screen Reader Support with Narrator

Narrator is the built-in Windows screen reader and the primary tool for testing WinUI 3 accessibility. It reads element names, roles, and states as the user navigates with Tab, arrow keys, or the mouse.

The interaction between WinUI 3 and Narrator flows through UIA. Narrator queries the automation peer for the element's name, control type, and state, then speaks or displays it in braille. This means that anything you expose correctly through `AutomationProperties` or a custom peer will work with Narrator and with third-party screen readers that also use UIA, such as JAWS and NVDA.

A few patterns cause consistent problems with Narrator. Nested interactive elements, such as a button inside a list item that is itself focusable, create confusion about what the user is interacting with. Group containers that aggregate multiple interactive children should generally have `AutomationProperties.AccessibilityView` set in a way that presents the group sensibly rather than exposing every inner element individually.

When a significant UI change happens without navigation, such as a dialog opening or a content region replacing itself, the user needs to be informed. For dialogs opened programmatically, set focus to the dialog's first interactive element immediately after opening it, which causes Narrator to announce the new context. For in-place content changes, use a live region with `AutomationProperties.LiveSetting`.

```csharp
// After opening a dialog, move focus to the first element
private async void OpenConfirmDialog()
{
    await ConfirmDialog.ShowAsync();
    // Focus is automatically managed by ContentDialog in WinUI 3,
    // but for custom dialogs, explicitly set focus:
    ConfirmButton.Focus(FocusState.Programmatic);
}
```

Narrator's scan mode, activated with Caps Lock + Space, lets users navigate through all elements on screen regardless of Tab order. Every element that carries information should be reachable in scan mode, which means that purely decorative elements should be hidden from the accessibility tree with `AutomationProperties.AccessibilityView="Raw"`.

---

## High Contrast Theme Support

Windows high contrast mode replaces the application's color scheme with a small set of system-defined colors that provide maximum contrast for users with low vision or photosensitivity. WinUI 3 controls handle this automatically through the built-in theme resources, but custom controls and custom styles can break in high contrast if they use hardcoded colors.

The solution is to use theme resources rather than literal color values. WinUI 3 defines a set of system color brushes that automatically resolve to the correct high contrast values when the user switches modes. Using `SystemControlForegroundBaseHighBrush` instead of a hardcoded `#1C1C1C` means your control will honor whatever the user has configured.

```xml
<!-- Breaks in high contrast because it ignores system colors -->
<Border Background="#E8E8E8" BorderBrush="#CCCCCC">
    <TextBlock Foreground="#1C1C1C" Text="Hello" />
</Border>

<!-- Respects high contrast because it uses theme resources -->
<Border Background="{ThemeResource SystemControlBackgroundAltHighBrush}"
        BorderBrush="{ThemeResource SystemControlForegroundBaseHighBrush}">
    <TextBlock Foreground="{ThemeResource SystemControlForegroundBaseHighBrush}" Text="Hello" />
</Border>
```

For custom visual states, verify that each state still provides enough contrast in high contrast mode. Colors that look distinct in normal mode can collapse to the same high contrast color, making states indistinguishable. Testing in both high contrast black and high contrast white modes covers the two most common configurations.

You can detect high contrast mode at runtime if you need to branch logic.

```csharp
using Microsoft.UI.Xaml.Media;

bool isHighContrast = AccessibilitySettings.HighContrast;
```

The `AccessibilitySettings` class is available through [Windows.UI.ViewManagement](https://learn.microsoft.com/en-us/uwp/api/windows.ui.viewmanagement.accessibilitysettings){:target="_blank" rel="noopener noreferrer"} and provides `HighContrast` and `HighContrastScheme` properties. You can subscribe to the `HighContrastChanged` event to update any runtime-computed values when the user switches modes.

---

## Testing Accessibility

Three tools cover most accessibility testing needs for WinUI 3 applications.

[Accessibility Insights for Windows](https://accessibilityinsights.io/docs/en/windows/overview/){:target="_blank" rel="noopener noreferrer"} is a free tool from Microsoft that inspects the UIA tree of any running application. It shows you exactly what a screen reader sees: the names, roles, states, and control patterns of every element. The FastPass feature checks for common issues like missing names and broken keyboard navigation automatically. Use it during development to verify that each screen exposes the accessibility tree you expect.

Narrator is your primary screen reader for manual testing. Enable it with Windows key + Ctrl + Enter and navigate through your application with Tab and arrow keys. Pay attention to what Narrator announces as you move between elements: whether names are descriptive, whether state changes are announced, and whether the reading order matches the visual order. Testing with Narrator gives you direct experience of what your users hear.

UI Automation test automation lets you drive accessibility testing from code. The `Microsoft.TestTools.UiAutomation` namespace provides classes for locating elements by their automation properties and invoking control patterns programmatically. This is particularly useful for regression testing, where you want to ensure that accessibility properties remain intact across code changes.

```csharp
// Example using UI Automation APIs in a test
var automation = new CUIAutomation8();
var root = automation.GetRootElement();
var condition = automation.CreatePropertyCondition(
    UIA_PropertyIds.UIA_NamePropertyId,
    "Settings");
var settingsButton = root.FindFirst(TreeScope.TreeScope_Descendants, condition);
var invokePattern = settingsButton?.GetCurrentPattern(UIA_PatternIds.UIA_InvokePatternId)
    as IUIAutomationInvokePattern;
invokePattern?.Invoke();
```

For a structured approach to checking compliance, the [Accessibility Insights FastPass checklist](https://accessibilityinsights.io/docs/en/windows/getstarted/fastpass/){:target="_blank" rel="noopener noreferrer"} walks through the most common failure categories in a defined order. Running FastPass on every screen in your application before each release catches regressions early.

---

## WCAG Considerations for Desktop Apps

[WCAG 2.1](https://www.w3.org/TR/WCAG21/){:target="_blank" rel="noopener noreferrer"} was written primarily for web content, but its four principles, perceivable, operable, understandable, and robust, translate directly to desktop applications. Many enterprise contracts and government procurements require WCAG 2.1 AA compliance regardless of platform.

Perceivability means that information is not conveyed through color alone. If a required field is indicated only by a red border, a color-blind user has no way to distinguish it from an optional field. Add a text indicator, an icon, or an `AutomationProperties.Name` that includes the required state.

Operability means that all functionality is available without a mouse. Every action reachable by mouse click should also be reachable by keyboard. Custom drag-and-drop interactions need keyboard alternatives, and any timed operations should give users enough time to respond or the ability to turn off timing.

Understandability means that controls behave predictably and that error messages describe both what went wrong and how to fix it. An error message that says only "Invalid input" is not understandable in the WCAG sense. An error message that says "Email address must include the @ symbol" is.

Robustness means that the application works correctly with current and future assistive technologies. Implementing UIA properly through `AutomationPeer` and `AutomationProperties`, rather than relying on hacks or workarounds, is what makes an application robust in this sense. An application that exposes its structure correctly through UIA will continue to work as Narrator and other assistive technologies evolve.

The Level AA success criteria most relevant to WinUI 3 applications include 1.4.3 (contrast ratio of at least 4.5:1 for normal text), 1.4.4 (text resize to 200% without loss of content), 2.1.1 (all functionality operable by keyboard), 2.4.7 (visible keyboard focus indicator), and 4.1.2 (name, role, and value programmatically determinable). Meeting these criteria requires combining proper use of `AutomationProperties`, high contrast theme support, keyboard navigation configuration, and custom automation peers for any non-standard controls.
