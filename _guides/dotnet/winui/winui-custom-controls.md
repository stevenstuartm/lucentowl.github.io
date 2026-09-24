---
title: "Building Custom Controls"
layout: guide
category: "WinUI 3"
subcategory: "Controls & UI"
description: "Building reusable WinUI 3 components: when a UserControl's composition is enough, how a templated control separates its logic from a replaceable template through Generic.xaml, template parts, and visual states, how a custom panel measures and arranges its children, and what changes when controls ship in a class library."
tags: [custom-controls, usercontrol, templated-controls, generic-xaml, visual-state-manager, custom-panels, practical]
---

## Choosing What to Build

A custom control earns its maintenance cost when a piece of UI repeats across an app, hides internal complexity behind a small public surface, or has to ship as a library for other apps. Before writing one, check whether something smaller does the job:

| Need | Reach for |
| --- | --- |
| A built-in control with different colors, sizes, or brushes | Lightweight styling, which overrides the theme resources the control's template reads |
| A built-in control with a different visual structure | A replacement `ControlTemplate` for that control |
| Extra behavior on existing controls, such as selecting all text on focus | An attached property with a property-changed callback, which adds behavior without subclassing |
| A built-in control with extra properties or logic of its own | A class derived from that control, with a style based on the control's default style |
| Several existing controls composed into one reusable piece, used inside one app | A `UserControl` |
| A control whose look other apps or teams must be able to replace, or that ships in a library | A templated control |

A class derived from a built-in control might not pick up the WinUI styles on its own. Give it a style whose `TargetType` is the new class and whose `BasedOn` is the base control's default style, such as `BasedOn="{StaticResource DefaultContentDialogStyle}"`, so it keeps the base control's template and visual states.

The last two rows are the subject of most of this guide. A `UserControl` is a fixed composition. Its XAML is part of the control, and consumers get the structure it ships with. A templated control keeps only its logic in code, and its look lives in a template that any consumer can swap for their own. What a consumer can change decides which one to build.

---

## Building a UserControl

Visual Studio's **User Control** item template, under the WinUI tab of Add New Item, creates a `.xaml` file and a code-behind class that derives from `UserControl`. The XAML composes existing controls, and the class exposes the properties and events consumers use. From outside, a consumer places it in markup by type name like any other control.

```xml
<!-- ContactCard.xaml -->
<UserControl
    x:Class="MyApp.Controls.ContactCard"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <StackPanel Orientation="Horizontal" Spacing="12">
        <PersonPicture DisplayName="{x:Bind DisplayName, Mode=OneWay}" Width="48" />
        <StackPanel VerticalAlignment="Center">
            <TextBlock Text="{x:Bind DisplayName, Mode=OneWay}" FontWeight="SemiBold" />
            <TextBlock Text="{x:Bind Email, Mode=OneWay}" />
        </StackPanel>
        <Button Content="Message" Click="MessageButton_Click" />
    </StackPanel>
</UserControl>
```

```csharp
// ContactCard.xaml.cs
public sealed partial class ContactCard : UserControl
{
    public static readonly DependencyProperty DisplayNameProperty =
        DependencyProperty.Register(nameof(DisplayName), typeof(string),
            typeof(ContactCard), new PropertyMetadata(string.Empty));

    public static readonly DependencyProperty EmailProperty =
        DependencyProperty.Register(nameof(Email), typeof(string),
            typeof(ContactCard), new PropertyMetadata(string.Empty));

    public string DisplayName
    {
        get => (string)GetValue(DisplayNameProperty);
        set => SetValue(DisplayNameProperty, value);
    }

    public string Email
    {
        get => (string)GetValue(EmailProperty);
        set => SetValue(EmailProperty, value);
    }

    public event EventHandler? MessageRequested;

    public ContactCard()
    {
        InitializeComponent();
    }

    private void MessageButton_Click(object sender, RoutedEventArgs e) =>
        MessageRequested?.Invoke(this, EventArgs.Empty);
}
```

`DisplayName` and `Email` are dependency properties so that a page can bind them, as in `<controls:ContactCard DisplayName="{x:Bind ViewModel.Name, Mode=OneWay}" />`. A plain C# property can't be a binding target.

### Binding the Inner Controls to the Control's Own Properties

Inside the UserControl's XAML, `{x:Bind}` resolves paths against the control's own class, so `{x:Bind DisplayName}` reads the control's `DisplayName` property directly. Each binding says `Mode=OneWay` because `x:Bind` defaults to one-time, and the inner text would otherwise never update after load.

Don't set `DataContext = this` in the constructor to reach the same properties with `{Binding}`. `DataContext` flows down from the page, and a consumer's `{Binding}` on the control's properties resolves against it. Overwriting it inside the control makes those bindings look for their paths on the control instead of on the page's data, and they stop resolving without throwing.

### Where a UserControl Stops

A consumer can set the properties the author exposed, and styles in scope still apply to the controls inside. An implicit `Button` style in `App.xaml` restyles the card's button, and lightweight-styling brushes placed in the card's `Resources` recolor it. What a consumer can't do is change the structure. The inner `StackPanel`, the order of its children, and which elements exist at all are fixed in the control's XAML, and no style can target one specific inner element.

Within one app, where the author and the consumers are the same team, that is usually fine. For a control that other teams restyle, or that has to look different across apps, every structural request becomes a new property or a fork of the control. That is the point where a templated control pays for its extra complexity.

---

## Building a Templated Control

A templated control derives from `Control`, or from `ContentControl` when it should host arbitrary content the way a `Button` does, in which case its template places that content with a `ContentPresenter`. Its class holds only logic. Its appearance comes from a `ControlTemplate`, and the class ships a default one that any consumer can replace.

The example here is `CopyField`, a line of text with a copy button that changes its icon to a check mark after a copy. The class and its default template agree on three names: a button part called `CopyButton` and two visual states called `Normal` and `Copied`. The class looks up the part and switches the states by name, so any template that uses those names works with the same logic.

{% include figure.html id="winui-templated-control-contract" %}

That flexibility has costs a `UserControl` doesn't have. The template has no code-behind, so the class can only reach its elements by name and has to cope when one is missing. The names become a contract that breaks without a build error when either side changes. And the default template sits in a resource dictionary, away from the class it belongs to.

### The Class and Its Default Style

Visual Studio's **Templated Control** item template adds the class file and a `Themes/Generic.xaml` file for its default style. The folder and file names are required. The XAML framework looks for that exact path in the project that defines the control, so the app never merges `Generic.xaml` into its own resources.

```csharp
// CopyField.cs
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Windows.ApplicationModel.DataTransfer;

[TemplatePart(Name = "CopyButton", Type = typeof(Button))]
[TemplateVisualState(GroupName = "CopyStates", Name = "Normal")]
[TemplateVisualState(GroupName = "CopyStates", Name = "Copied")]
public partial class CopyField : Control
{
    private Button? _copyButton;
    private bool _copied;

    public CopyField()
    {
        DefaultStyleKey = typeof(CopyField);
    }

    public static readonly DependencyProperty TextProperty =
        DependencyProperty.Register(nameof(Text), typeof(string),
            typeof(CopyField), new PropertyMetadata(string.Empty, OnTextChanged));

    public string Text
    {
        get => (string)GetValue(TextProperty);
        set => SetValue(TextProperty, value);
    }

    private static void OnTextChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        // New text hasn't been copied yet.
        var field = (CopyField)d;
        field._copied = false;
        field.UpdateStates(useTransitions: true);
    }

    protected override void OnApplyTemplate()
    {
        base.OnApplyTemplate();

        if (_copyButton != null)
        {
            _copyButton.Click -= CopyButton_Click;
            _copyButton.LostFocus -= CopyButton_LostFocus;
        }

        _copyButton = GetTemplateChild("CopyButton") as Button;

        if (_copyButton != null)
        {
            _copyButton.Click += CopyButton_Click;
            _copyButton.LostFocus += CopyButton_LostFocus;
        }

        UpdateStates(useTransitions: false);
    }

    private void CopyButton_Click(object sender, RoutedEventArgs e)
    {
        var package = new DataPackage();
        package.SetText(Text);
        Clipboard.SetContent(package);
        _copied = true;
        UpdateStates(useTransitions: true);
    }

    // Keyboard users leave by tabbing away, pointer users by moving off.
    private void CopyButton_LostFocus(object sender, RoutedEventArgs e) => Reset();

    protected override void OnPointerExited(PointerRoutedEventArgs e)
    {
        base.OnPointerExited(e);
        Reset();
    }

    private void Reset()
    {
        _copied = false;
        UpdateStates(useTransitions: true);
    }

    private void UpdateStates(bool useTransitions) =>
        VisualStateManager.GoToState(this, _copied ? "Copied" : "Normal", useTransitions);
}
```

`DefaultStyleKey = typeof(CopyField)` tells the framework to use the style in `Generic.xaml` whose `TargetType` is `CopyField` as this control's default. The default template travels inside that style, as the value of its `Template` setter, which is why "default style" and "default template" refer to the same file. The framework applies the style when the app supplies no template of its own.

```xml
<!-- Themes/Generic.xaml -->
<ResourceDictionary
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:local="using:MyApp.Controls">

    <Style TargetType="local:CopyField">
        <Setter Property="IsTabStop" Value="False" />
        <Setter Property="Background" Value="{ThemeResource CopyFieldBackground}" />
        <Setter Property="Padding" Value="8,4" />
        <Setter Property="Template">
            <Setter.Value>
                <ControlTemplate TargetType="local:CopyField">
                    <Grid ColumnSpacing="8"
                          Background="{TemplateBinding Background}"
                          Padding="{TemplateBinding Padding}">
                        <VisualStateManager.VisualStateGroups>
                            <VisualStateGroup x:Name="CopyStates">
                                <VisualState x:Name="Normal" />
                                <VisualState x:Name="Copied">
                                    <VisualState.Setters>
                                        <Setter Target="CopyIcon.Symbol" Value="Accept" />
                                    </VisualState.Setters>
                                </VisualState>
                            </VisualStateGroup>
                        </VisualStateManager.VisualStateGroups>
                        <Grid.ColumnDefinitions>
                            <ColumnDefinition Width="*" />
                            <ColumnDefinition Width="Auto" />
                        </Grid.ColumnDefinitions>
                        <TextBlock Text="{TemplateBinding Text}" VerticalAlignment="Center" />
                        <Button x:Name="CopyButton" Grid.Column="1"
                                AutomationProperties.Name="Copy">
                            <SymbolIcon x:Name="CopyIcon" Symbol="Copy" />
                        </Button>
                    </Grid>
                </ControlTemplate>
            </Setter.Value>
        </Setter>
    </Style>
</ResourceDictionary>
```

`{TemplateBinding Text}` shows the control's `Text` property inside the template, and `Background` and `Padding` pass through the same way, which is how a consumer's `<local:CopyField Background="..." />` reaches the inner `Grid`. A `TemplateBinding` is always one-way, and the two property types must match because it accepts no converter. A template that needs either uses `{Binding RelativeSource={RelativeSource TemplatedParent}}`, whose source is the control the template is applied to. `{x:Bind}` also works in a template that sets `TargetType`, but only in a resource dictionary that has a code-behind class, and `Generic.xaml` doesn't have one by default.

`IsTabStop` is `False` because a `Control` is a tab stop by default. Without the setter, keyboard focus lands on the `CopyField` itself, which has no focus visual by default, before it reaches the button inside. Defaults such as `Padding` belong in style setters or property metadata rather than the constructor, where they would be local values that outrank any style the app applies.

### Making the Default Style Restylable

A consumer who likes the structure but not the colors shouldn't have to copy the whole template. The `Background` setter above reads `{ThemeResource CopyFieldBackground}`, a key the control defines for itself, which makes that brush a lightweight-styling resource of the control's own. Microsoft recommends aliasing such keys to the built-in resources of the control the new one resembles, in all three theme dictionaries so each theme resolves. `Default` is the one the dark theme uses:

```xml
<!-- Themes/Generic.xaml, alongside the style -->
<ResourceDictionary.ThemeDictionaries>
    <ResourceDictionary x:Key="Default">
        <StaticResource x:Key="CopyFieldBackground" ResourceKey="TextControlBackground" />
    </ResourceDictionary>
    <ResourceDictionary x:Key="Light">
        <StaticResource x:Key="CopyFieldBackground" ResourceKey="TextControlBackground" />
    </ResourceDictionary>
    <ResourceDictionary x:Key="HighContrast">
        <StaticResource x:Key="CopyFieldBackground" ResourceKey="TextControlBackground" />
    </ResourceDictionary>
</ResourceDictionary.ThemeDictionaries>
```

The control now follows the system theme and matches text boxes by default, and an app can recolor every `CopyField` by defining `CopyFieldBackground` in its own resources.

### OnApplyTemplate and Template Parts

The template's elements don't exist when the constructor runs, so the class can't reach its parts there. The framework calls `OnApplyTemplate` once it has built the visual tree from the template, and that override is where the class finds each part with `GetTemplateChild` and attaches its handlers. Don't use the `Loaded` event for this, because Microsoft's documentation warns that `Loaded` can fire before the template is applied. The override should call `base.OnApplyTemplate()`, which carries built-in layout behavior.

`GetTemplateChild` returns `null` when the template has no element with that name. A consumer's template may leave a part out on purpose, such as a read-only look with no copy button, so the class checks for `null` and loses that one feature rather than throwing. The framework runs `OnApplyTemplate` whenever `ApplyTemplate` is called, and Microsoft describes that as something app code or a layout pass can trigger. So the override first detaches from any part it found on an earlier run, which keeps a stale button from holding a handler.

### Visual States

The control decides *when* it is in a state, and the template decides what that state *looks like*. `GoToState(this, "Copied", true)` asks for a state by name, and the template defines each state's setters in a `VisualStateGroup` on its root element.

All of the sample's state changes go through `UpdateStates`, which reads the control's fields and picks a state. The property-changed callback, the click handler, and `OnApplyTemplate` each call it, so the visuals follow the control's condition however it changed. Calling it at the end of `OnApplyTemplate`, without a transition, makes a newly applied template start in the right state. A property can also change before any template exists. `GoToState` then finds no states and does nothing, and the call in `OnApplyTemplate` catches up. The same holds for parts, so a property-changed callback that touches a part has to check it for `null`.

A state name the template doesn't define isn't an error. `GoToState` does nothing and returns `false`, which is what lets a consumer's template skip a state it has no look for. It is also how a typo in a state name goes unnoticed.

### The Contract With Template Authors

`TemplatePart` and `TemplateVisualState` declare the names a replacement template has to use: each part's name and type, and each state's name and group. They are documentation for whoever writes the next template. Nothing in the attributes makes a template include the parts. WPF controls prefix part names with `PART_`, while Microsoft's WinUI `OnApplyTemplate` example uses plain names like `UpButton`. Either works, since the lookup is an exact string match.

Once a control ships, those names are public API. Renaming a part or a state breaks every consumer template that uses the old name, and nothing fails at build time. Each template silently loses the feature tied to that name.

A templated control derived straight from `Control` also exposes little about itself to UI Automation, the interface screen readers read. Overriding `OnCreateAutomationPeer` to return a custom automation peer gives it a name, a control type, and the patterns assistive technology uses to operate it.

---

## Building a Custom Panel

When no panel produces a layout, a class derived from `Panel` provides its own side of the two layout passes. `MeasureOverride` calls `Measure` on every child and returns the size the panel wants. `ArrangeOverride` calls `Arrange` on every child with the rectangle it gets and returns the size the panel used. Check the built-in panels and the Community Toolkit's `WrapPanel`, `DockPanel`, and `UniformGrid` first. Write your own for a layout none of them express, such as children placed evenly around a circle:

```csharp
using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Foundation;

public partial class RadialPanel : Panel
{
    protected override Size MeasureOverride(Size availableSize)
    {
        double largest = 0;
        foreach (UIElement child in Children)
        {
            // Let each child take the size it wants.
            child.Measure(new Size(double.PositiveInfinity, double.PositiveInfinity));
            largest = Math.Max(largest,
                Math.Max(child.DesiredSize.Width, child.DesiredSize.Height));
        }

        // Offered infinite space, report a finite size based on the children.
        double fallback = largest * 4;
        return new Size(
            double.IsInfinity(availableSize.Width) ? fallback : availableSize.Width,
            double.IsInfinity(availableSize.Height) ? fallback : availableSize.Height);
    }

    protected override Size ArrangeOverride(Size finalSize)
    {
        if (Children.Count == 0)
            return finalSize;

        double centerX = finalSize.Width / 2;
        double centerY = finalSize.Height / 2;
        double radius = Math.Min(finalSize.Width, finalSize.Height) / 2;
        double step = 2 * Math.PI / Children.Count;

        for (int i = 0; i < Children.Count; i++)
        {
            UIElement child = Children[i];
            Size size = child.DesiredSize;

            // Start at the top and go clockwise, keeping each child inside the circle.
            double angle = i * step - Math.PI / 2;
            double r = radius - Math.Max(size.Width, size.Height) / 2;
            double x = centerX + r * Math.Cos(angle) - size.Width / 2;
            double y = centerY + r * Math.Sin(angle) - size.Height / 2;

            child.Arrange(new Rect(x, y, size.Width, size.Height));
        }

        return finalSize;
    }
}
```

The measure pass is where panels most often go wrong. A panel inside a `ScrollViewer` or an `Auto` row can be offered infinite width or height, and returning that infinity as its own desired size can throw an exception in the layout system. So the sample computes a finite fallback from its children. Every child gets a `Measure` call even when a panel ignores the result, because an element only takes part in layout after it has been measured and arranged.

A panel that needs per-child settings, as `Grid` needs a row and column, defines them as attached properties and reads them for each child in both passes. WinUI doesn't re-run layout when such a property changes, so its property-changed callback calls `InvalidateMeasure` on the panel. A panel only positions its children. Anything the user interacts with, such as scroll bars, belongs in a control that uses the panel. Microsoft's [BoxPanel example](https://learn.microsoft.com/en-us/windows/apps/design/layout/boxpanel-example-custom-panel){:target="_blank" rel="noopener noreferrer"} walks through a complete panel.

---

## Shipping Controls in a Class Library

Controls meant for more than one app go in a project made from Visual Studio's WinUI **Class Library** template rather than a generic .NET class library, so the project is set up for WinUI's XAML from the start. Each templated control keeps its default style in the library's own `Themes/Generic.xaml`, and the framework finds it there without the consuming app merging anything. A library with many controls often keeps each control's style in a dictionary of its own and merges those into `Generic.xaml`, so the file stays a short list of merges. Each merge's `Source` names the library's assembly, as in `ms-appx:///MyControlLibrary/Themes/CopyField.xaml`. A path without it, such as `ms-appx:///Themes/CopyField.xaml`, resolves against the consuming app's package instead, and the dictionary isn't found at runtime. Renaming the library project breaks every such path.

A project reference from an app in the same solution works without extra setup. Packing the library as a NuGet package is harder than it looks. The package has to carry the compiled XAML (`.xbf`) and asset files at the paths the app expects, and the default pack output doesn't always put them there. The open [microsoft-ui-xaml issue #10970](https://github.com/microsoft/microsoft-ui-xaml/issues/10970){:target="_blank" rel="noopener noreferrer"} documents packages that build and then crash at startup because a control's resources can't be found. Test every package build in a fresh app before publishing it.

A control used by people who can't read its source should render sensibly with no properties set, so give each dependency property a default that works on its own, and document the part and state names alongside the control.
