---
title: "Building Custom Controls"
layout: guide
category: "WinUI 3"
subcategory: "Controls & UI"
description: "Creating reusable UI components in WinUI 3 through UserControls for composition and templated controls for fully customizable, redistributable components."
tags: [winui, winui-3, xaml, controls, custom-controls, dependency-properties, desktop, practical]
---

## Table of Contents

- [When to Build a Custom Control](#when-to-build-a-custom-control)
- [UserControl: Composition-Based Approach](#usercontrol-composition-based-approach)
- [Templated Controls: Inheriting from Control](#templated-controls-inheriting-from-control)
- [Dependency Properties](#dependency-properties)
- [Template Parts and Visual States](#template-parts-and-visual-states)
- [Attached Properties](#attached-properties)
- [Content Properties and Custom Panels](#content-properties-and-custom-panels)
- [Packaging and Distributing Custom Controls](#packaging-and-distributing-custom-controls)

---

## When to Build a Custom Control

The most common reasons to build a custom control are reuse, encapsulation, and distribution. Reuse means that a pattern of controls and behavior appears repeatedly across your application and you want a single source of truth for that pattern. Encapsulation means that a piece of UI has its own internal complexity and you want consuming code to interact with a simple public surface rather than managing a tangle of inner elements. Distribution means you want to publish the control as a library so other projects or teams can consume it without depending on your application code.

Before building anything custom, check whether the existing WinUI 3 controls can satisfy the need through styling or templating alone. Replacing the control template of a built-in control is almost always cheaper than writing a new one from scratch. Custom controls carry ongoing maintenance responsibility, so the benefit must justify the investment.

Once you have decided to build something, you face a choice between two fundamental approaches: the UserControl and the templated control.

A UserControl is the right choice when you are composing existing controls into a reusable unit and do not need consumers to restyle the internal visual tree. A templated control, sometimes called a Custom Control, is the right choice when the control must be fully styleable, when it will be redistributed as a library, or when the visual structure needs to vary significantly across themes and contexts.

---

## UserControl: Composition-Based Approach

A UserControl bundles a XAML layout and a code-behind class into a single reusable component. You create one with the "User Control" item template in Visual Studio, which produces a `.xaml` file and a `.xaml.cs` file that together define the component.

The XAML file describes the internal layout using any combination of existing controls. The code-behind class inherits from `UserControl` and handles events, exposes properties, and coordinates internal state. From the outside, a UserControl looks like any other control: you place it in XAML by its type name, set properties on it, and wire up events.

```xml
<!-- RatingControl.xaml -->
<UserControl
    x:Class="MyApp.Controls.RatingControl"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <StackPanel Orientation="Horizontal" Spacing="4">
        <RepeatButton x:Name="DecreaseButton" Content="-" Click="DecreaseButton_Click" />
        <TextBlock x:Name="ValueDisplay" VerticalAlignment="Center" />
        <RepeatButton x:Name="IncreaseButton" Content="+" Click="IncreaseButton_Click" />
    </StackPanel>
</UserControl>
```

The public API of a UserControl is defined through dependency properties. Regular CLR properties work for simple cases, but dependency properties make the control's surface bindable, animatable, and styleable in the same way as built-in control properties. Defining the dependency property in the code-behind gives consumers the full XAML property system.

```csharp
// RatingControl.xaml.cs
public sealed partial class RatingControl : UserControl
{
    public static readonly DependencyProperty ValueProperty =
        DependencyProperty.Register(
            nameof(Value),
            typeof(int),
            typeof(RatingControl),
            new PropertyMetadata(0, OnValueChanged));

    public int Value
    {
        get => (int)GetValue(ValueProperty);
        set => SetValue(ValueProperty, value);
    }

    private static void OnValueChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        var control = (RatingControl)d;
        control.ValueDisplay.Text = e.NewValue.ToString();
    }

    public RatingControl()
    {
        InitializeComponent();
    }

    private void IncreaseButton_Click(object sender, RoutedEventArgs e) => Value++;
    private void DecreaseButton_Click(object sender, RoutedEventArgs e) => Value--;
}
```

The primary limitation of the UserControl approach is that consumers cannot replace the visual tree. The inner layout is sealed inside the XAML file. A consumer who wants to change the look of the control must subclass it or ask the author to expose more properties. For controls that will be shipped in a library and used by teams with different design requirements, this constraint becomes a real problem. That is where templated controls become necessary.

---

## Templated Controls: Inheriting from Control

A templated control inherits from `Control` directly, or from another appropriate base class like `ContentControl` or `ItemsControl`. Its visual appearance is defined entirely in a resource dictionary called `Generic.xaml`, which lives in a `Themes` folder at the root of the project. Consumers can replace the default template by providing their own `ControlTemplate`, which means the control's logic and its appearance are fully decoupled.

Creating a templated control involves three steps: defining the class, setting the default style key, and writing the default template in `Generic.xaml`.

```csharp
// ToggleCard.cs
[TemplatePart(Name = "PART_ToggleButton", Type = typeof(ToggleButton))]
[TemplateVisualState(Name = "Normal", GroupName = "CommonStates")]
[TemplateVisualState(Name = "Expanded", GroupName = "CommonStates")]
public class ToggleCard : Control
{
    public ToggleCard()
    {
        DefaultStyleKey = typeof(ToggleCard);
    }
}
```

The `DefaultStyleKey` assignment tells the XAML framework where to find the default style. The framework resolves this by looking in `Generic.xaml` for a style whose `TargetType` matches `typeof(ToggleCard)`.

The `Themes/Generic.xaml` file must be included in the project and registered as a merged resource dictionary. In a class library project, the file appears automatically when using the "Custom Control" item template. In a standalone project you may need to add the merge manually.

```xml
<!-- Themes/Generic.xaml -->
<ResourceDictionary
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:local="using:MyApp.Controls">

    <Style TargetType="local:ToggleCard">
        <Setter Property="Template">
            <Setter.Value>
                <ControlTemplate TargetType="local:ToggleCard">
                    <Border Background="{TemplateBinding Background}"
                            BorderBrush="{TemplateBinding BorderBrush}"
                            BorderThickness="{TemplateBinding BorderThickness}"
                            CornerRadius="8">
                        <StackPanel>
                            <ToggleButton x:Name="PART_ToggleButton"
                                          Content="{TemplateBinding Header}" />
                            <ContentPresenter x:Name="PART_ContentArea" />
                        </StackPanel>
                    </Border>
                </ControlTemplate>
            </Setter.Value>
        </Setter>
    </Style>
</ResourceDictionary>
```

The `TemplateBinding` extension connects template properties back to the control's own dependency properties, allowing the outer style or inline assignment to flow into the template.

---

## Dependency Properties

Dependency properties are the foundation of every custom control's public API. They participate in the XAML property system, which means they support data binding, animation, styling through setters, and property inheritance. A regular CLR property does none of these things automatically.

Registering a dependency property requires a static field of type `DependencyProperty` and a corresponding CLR property wrapper that calls `GetValue` and `SetValue`.

```csharp
public static readonly DependencyProperty HeaderProperty =
    DependencyProperty.Register(
        nameof(Header),
        typeof(string),
        typeof(ToggleCard),
        new PropertyMetadata(string.Empty, OnHeaderChanged));

public string Header
{
    get => (string)GetValue(HeaderProperty);
    set => SetValue(HeaderProperty, value);
}

private static void OnHeaderChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
{
    // Called whenever the value changes, including through binding or animation.
    // d is the control instance; cast it to access members.
    var control = (ToggleCard)d;
    control.UpdateHeaderDisplay((string)e.NewValue);
}
```

The `PropertyMetadata` constructor accepts a default value and an optional `PropertyChangedCallback`. The callback receives the `DependencyObject` instance and an event args object carrying both the old and new values. Because the callback is static, accessing instance members requires casting `d` to the control type.

One detail worth noting: the CLR wrapper's getter and setter should contain only `GetValue` and `SetValue` calls. The XAML compiler sometimes bypasses the wrapper entirely when setting properties from XAML markup, calling `SetValue` directly. Logic placed in the setter body will not run in those cases; it belongs in the `PropertyChangedCallback` instead.

---

## Template Parts and Visual States

A templated control interacts with its visual tree through named template parts and visual states. Template parts are elements with known names that the control looks up after its template is applied. Visual states are named states that the control transitions between in response to changes in its own condition.

The `TemplatePart` attribute on the class declares the parts the control expects. This serves as documentation for template authors and enables tooling to validate templates.

After the template is applied, the framework calls `OnApplyTemplate`. This is where the control retrieves its template parts using `GetTemplateChild` and wires up event handlers.

```csharp
private ToggleButton? _toggleButton;

protected override void OnApplyTemplate()
{
    base.OnApplyTemplate();

    // Detach from the previous template's part, if any.
    if (_toggleButton != null)
        _toggleButton.Checked -= ToggleButton_Checked;

    _toggleButton = GetTemplateChild("PART_ToggleButton") as ToggleButton;

    if (_toggleButton != null)
        _toggleButton.Checked += ToggleButton_Checked;

    // Sync the visual state to the current property values.
    UpdateVisualState(useTransitions: false);
}

private void ToggleButton_Checked(object sender, RoutedEventArgs e)
{
    IsExpanded = true;
}
```

Always detach event handlers from the previous template's parts before attaching to the new ones. If `GetTemplateChild` returns null because a custom template omitted the part, the control should degrade gracefully rather than throw.

Visual states are driven by `VisualStateManager.GoToState`. Defining the `TemplateVisualState` attribute on the class documents which states exist in each group so template authors know what state names to define.

```csharp
private void UpdateVisualState(bool useTransitions)
{
    VisualStateManager.GoToState(
        this,
        IsExpanded ? "Expanded" : "Normal",
        useTransitions);
}
```

The corresponding states in the template use `VisualStateGroup` and `VisualState` elements, each optionally containing a `Storyboard` that animates the transition.

---

## Attached Properties

An attached property is a dependency property defined on one class but intended to be set on instances of other classes. The classic example is `Grid.Row`, which is defined on `Grid` but set on any child element placed inside a grid.

Custom attached properties follow the same registration pattern as regular dependency properties but use `DependencyProperty.RegisterAttached` and expose static `Get` and `Set` accessor methods rather than a CLR property wrapper.

```csharp
public static class ControlExtensions
{
    public static readonly DependencyProperty BadgeCountProperty =
        DependencyProperty.RegisterAttached(
            "BadgeCount",
            typeof(int),
            typeof(ControlExtensions),
            new PropertyMetadata(0));

    public static int GetBadgeCount(DependencyObject obj)
        => (int)obj.GetValue(BadgeCountProperty);

    public static void SetBadgeCount(DependencyObject obj, int value)
        => obj.SetValue(BadgeCountProperty, value);
}
```

In XAML, this property can be set on any element using the attached syntax:

```xml
<Button local:ControlExtensions.BadgeCount="3" Content="Notifications" />
```

Attached properties are useful for layout hints, behaviors, and metadata that a panel or decorator reads from its children. A custom panel might use attached properties to carry per-child layout constraints in the same way that `Grid` uses `Row` and `Column`. A behavior system might use attached properties to attach interaction logic to elements without subclassing them.

---

## Content Properties and Custom Panels

The `ContentProperty` attribute marks one dependency property as the default content property for a class. When a consumer places child elements inside a control's XAML tags without specifying a property name, the XAML parser assigns them to the content property automatically.

```csharp
[ContentProperty(Name = nameof(Content))]
public class ToggleCard : Control
{
    public static readonly DependencyProperty ContentProperty =
        DependencyProperty.Register(
            nameof(Content),
            typeof(object),
            typeof(ToggleCard),
            new PropertyMetadata(null));

    public object? Content
    {
        get => GetValue(ContentProperty);
        set => SetValue(ContentProperty, value);
    }
}
```

With this in place, a consumer can write child elements directly inside `<local:ToggleCard>` tags and they will be assigned to `Content` without requiring an explicit property element.

Custom layout panels require a different approach. A panel inherits from `Panel` and overrides two methods: `MeasureOverride` and `ArrangeOverride`. `MeasureOverride` receives the available size, asks each child how much space it needs by calling `child.Measure(availableSize)`, and returns the total desired size for the panel. `ArrangeOverride` receives the final size allocated to the panel and places each child by calling `child.Arrange(rect)` with the rectangle it should occupy.

```csharp
public class HorizontalWrapPanel : Panel
{
    protected override Size MeasureOverride(Size availableSize)
    {
        double rowWidth = 0;
        double rowHeight = 0;
        double totalHeight = 0;

        foreach (UIElement child in Children)
        {
            child.Measure(new Size(availableSize.Width, availableSize.Height));
            var desired = child.DesiredSize;

            if (rowWidth + desired.Width > availableSize.Width)
            {
                totalHeight += rowHeight;
                rowWidth = 0;
                rowHeight = 0;
            }

            rowWidth += desired.Width;
            rowHeight = Math.Max(rowHeight, desired.Height);
        }

        totalHeight += rowHeight;
        return new Size(availableSize.Width, totalHeight);
    }

    protected override Size ArrangeOverride(Size finalSize)
    {
        double x = 0;
        double y = 0;
        double rowHeight = 0;

        foreach (UIElement child in Children)
        {
            var desired = child.DesiredSize;

            if (x + desired.Width > finalSize.Width)
            {
                y += rowHeight;
                x = 0;
                rowHeight = 0;
            }

            child.Arrange(new Rect(x, y, desired.Width, desired.Height));
            x += desired.Width;
            rowHeight = Math.Max(rowHeight, desired.Height);
        }

        return finalSize;
    }
}
```

The two-pass layout model, measuring first and arranging second, lets parents give children the information they need to report their size before any final positions are committed.

---

## Packaging and Distributing Custom Controls

Sharing custom controls between projects or teams requires placing them in a class library. In the WinUI 3 ecosystem, this means creating a Windows App SDK class library project rather than a standard .NET class library, because the controls depend on WinUI types that are part of the Windows App SDK runtime.

The `Themes/Generic.xaml` file must be included in the library project and registered through the application's merged resource dictionaries or through the library's own assembly-level resource registration. Without this, the default styles defined in `Generic.xaml` will not be resolved at runtime and controls will appear blank or throw exceptions.

```xml
<!-- In the consuming app's App.xaml, if manual merge is needed -->
<Application.Resources>
    <ResourceDictionary>
        <ResourceDictionary.MergedDictionaries>
            <XamlControlsResources xmlns="using:Microsoft.UI.Xaml.Controls" />
            <ResourceDictionary Source="ms-appx:///MyControlLibrary/Themes/Generic.xaml" />
        </ResourceDictionary.MergedDictionaries>
    </ResourceDictionary>
</Application.Resources>
```

For NuGet packaging, the library project file needs a few additions. The `PackageId`, `Version`, `Authors`, and `Description` properties define the package identity. Any asset files that must be delivered alongside the assembly, such as `Generic.xaml` or image assets embedded in the library, should be included in the package through appropriate `<Content>` or `<EmbeddedResource>` entries so they are present at the correct path when the package is installed.

The [Windows App SDK documentation](https://learn.microsoft.com/en-us/windows/apps/winui/winui3/){:target="_blank" rel="noopener noreferrer"} covers the specific project templates and SDK references needed to set up a library project correctly. Pay attention to the `TargetFramework` and `RuntimeIdentifiers` settings; WinUI 3 library projects targeting .NET 6 or later with the Windows App SDK require specific configurations that differ from general .NET class libraries.

Controls in a redistributed library should expose their dependency properties with conservative defaults so they render reasonably without any configuration. Documentation for template authors, especially the list of `TemplatePart` names and `TemplateVisualState` groups declared through attributes on the class, is the primary contract between the control author and anyone who wants to write a custom template.
