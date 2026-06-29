---
title: "XAML Fundamentals in WinUI 3"
layout: guide
category: "WinUI 3"
subcategory: "WinUI Fundamentals"
description: "Core XAML concepts for WinUI 3 including syntax, namespaces, markup extensions, compiled bindings with x:Bind, and the dependency property system."
tags: [winui, winui-3, xaml, data-binding, dependency-properties, fundamentals, desktop]
---

## Table of Contents

- [XAML Syntax Basics](#xaml-syntax-basics)
- [XAML Namespaces](#xaml-namespaces)
- [Markup Extensions](#markup-extensions)
- [Compiled Bindings with x:Bind](#compiled-bindings-with-xbind)
- [Dependency Properties](#dependency-properties)
- [Attached Properties](#attached-properties)
- [Type Converters](#type-converters)

---

## XAML Syntax Basics

XAML is an XML-based language where each XML element represents an instantiated .NET object. When the XAML parser encounters a `<Button>` element, it creates an instance of the `Button` class, sets properties on it, and adds it to the visual tree. Understanding this direct mapping from markup to objects makes the rest of XAML's mechanics much easier to reason about.

Properties can be set in two ways. The attribute syntax is the most compact form, where you write the property name as an XML attribute directly on the element.

```xml
<Button Content="Click me" Width="120" HorizontalAlignment="Center" />
```

When a property value is too complex to express as a plain string, you use property-element syntax instead. This creates a child element named `TypeName.PropertyName` and nests the value inside it.

```xml
<Button>
    <Button.Content>
        <StackPanel Orientation="Horizontal">
            <Image Source="icon.png" Width="16" />
            <TextBlock Text="Click me" />
        </StackPanel>
    </Button.Content>
</Button>
```

Most XAML controls designate one property as their content property, which the XAML parser treats as a shorthand. For `Button`, the content property is `Content`, and for layout panels like `StackPanel`, it is `Children`. Because of this convention, you can nest child elements directly inside a panel without writing `<StackPanel.Children>` explicitly. The parser fills in the property assignment automatically based on which property carries the `[ContentProperty]` attribute in the class definition.

---

## XAML Namespaces

Every XAML file declares at least two XML namespaces at the root element. The default namespace, typically `xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"`, maps to the WinUI 3 control library and tells the parser where to look when resolving unqualified element names like `<Grid>` or `<TextBox>`. The second namespace, `xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"`, provides core XAML language features such as `x:Name`, `x:Key`, `x:Bind`, and `x:Class`.

The `x:Class` attribute on the root element connects the XAML file to its code-behind by specifying the fully qualified type name that the partial class in C# defines. Without this, there is no generated code-behind class and no `InitializeComponent` call.

When you need to reference types from your own application code or a third-party library, you declare a custom namespace with a `using` prefix that mirrors C# namespace imports.

```xml
xmlns:local="using:MyApp.Controls"
xmlns:vm="using:MyApp.ViewModels"
xmlns:toolkit="using:CommunityToolkit.WinUI.UI.Controls"
```

After declaring `xmlns:local`, you can place `<local:MyCustomControl />` in the markup and the parser will resolve it to `MyApp.Controls.MyCustomControl`. The `using:` syntax is specific to WinUI 3 and Windows App SDK; it differs from WPF's older CLR-namespace syntax but accomplishes the same goal.

---

## Markup Extensions

Markup extensions let you set property values to something more dynamic than a literal string. In XAML, you recognize a markup extension by its curly-brace syntax inside an attribute value.

`{StaticResource}` retrieves a value from a `ResourceDictionary` by key at load time. Once the resource is resolved, the property value is set and stays fixed for the lifetime of the object. This makes it appropriate for values that do not change with the application theme, such as a fixed icon size or a shared data template.

`{ThemeResource}` works similarly but registers a listener so that when the application theme changes between light, dark, or high-contrast, the property value updates automatically. Any color brush or style that should respond to the user's theme choice should use `{ThemeResource}` rather than `{StaticResource}`.

`{x:Null}` explicitly sets a property to `null`. This is useful when an inherited or default property value is non-null and you need to clear it, such as removing a background brush.

`{x:Type}` provides a `Type` object reference for a given type name. It appears occasionally in control templates and style triggers when a value of type `Type` is expected rather than an instance of the type.

`{TemplateBinding}` is used exclusively inside a `ControlTemplate` to bind a property of a template element to a property of the templated control. When you write `<Border Background="{TemplateBinding Background}">` inside a button's template, the border's background follows whatever value the consuming code sets on the `Button.Background` property. This is what makes generic control templates reusable across different visual contexts.

A key thing to understand is that markup extensions are not magic; they are classes that implement a specific interface and that the XAML parser invokes at parse or load time. `StaticResource` resolves its key by walking up the resource dictionary tree. `ThemeResource` does the same but additionally subscribes to theme-change events. This mechanical understanding helps when you encounter a resource that fails to resolve or a theme that does not update as expected.

---

## Compiled Bindings with x:Bind

The traditional `{Binding}` markup extension uses reflection at runtime to resolve property paths, which carries a performance cost and defers any errors to runtime. `{x:Bind}` takes a different approach by generating C# binding code at compile time, based on the `x:Class` declared at the root of the XAML file.

Because `x:Bind` generates strongly-typed code, the compiler can catch errors in property paths that `{Binding}` would only surface at runtime. If you misspell a property name or bind to a type-incompatible property, the project will fail to build rather than silently displaying nothing at runtime.

The default binding mode for `{x:Bind}` is `OneTime`, meaning the value is read once when the control is initialized and never updated again. This is intentionally conservative and produces the best performance. If you need the UI to reflect changes to the data, you switch to `OneWay`, which requires the source to implement `INotifyPropertyChanged`. For two-directional synchronization between the UI and the data model, such as a text box writing back to a view model property, you use `TwoWay`, which additionally requires the source to have a settable property.

```xml
<!-- OneTime (default): resolved once at initialization -->
<TextBlock Text="{x:Bind Title}" />

<!-- OneWay: updates when Title raises PropertyChanged -->
<TextBlock Text="{x:Bind Title, Mode=OneWay}" />

<!-- TwoWay: syncs both directions -->
<TextBox Text="{x:Bind SearchQuery, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}" />
```

`x:Bind` paths are rooted at the code-behind class rather than the `DataContext`. This means that to bind to a view model, you typically expose it as a property on the page and write `{x:Bind ViewModel.Title}` rather than just `{x:Bind Title}`. It also means `x:Bind` can reach any public property or method directly on the page class, which is useful for event handler bindings like `{x:Bind OnButtonClicked}`.

For collection controls like `ListView`, `x:Bind` inside an `ItemTemplate` binds relative to the item type rather than the page class. You need to specify the item type in the `DataTemplate` using `x:DataType`, which is how the compiler knows what type to generate against.

```xml
<ListView ItemsSource="{x:Bind ViewModel.Items}">
    <ListView.ItemTemplate>
        <DataTemplate x:DataType="local:ProductItem">
            <TextBlock Text="{x:Bind Name}" />
        </DataTemplate>
    </ListView.ItemTemplate>
</ListView>
```

The performance advantage of `x:Bind` is most visible in collection scenarios where many items are rendered. Each binding path is a direct property access in generated code rather than a reflected lookup, so the difference compounds across many bound elements.

---

## Dependency Properties

Dependency properties are WinUI 3's property system built on top of ordinary C# properties. They exist because the standard .NET property system, which is just a backing field with a getter and setter, cannot support the full feature set that a UI framework requires. Binding needs a way to listen for value changes. Styling needs to apply values without overwriting local values. Animation needs to temporarily override a value and restore it afterward. Inheritance needs to propagate values down the visual tree without storing them on every element.

Dependency properties solve all of these through a unified value resolution system. Instead of a single backing field, a dependency property has a priority-ordered stack of possible value sources. The resolved value at any moment is the highest-priority value that has been set, evaluated in order: animation, local assignment, template binding, style setter, property inheritance, and finally the default value from the property's metadata.

To define a custom dependency property in a `UserControl` or `DependencyObject` subclass, you register it with the property system using a static field and a registration call.

```csharp
public static readonly DependencyProperty HeaderTextProperty =
    DependencyProperty.Register(
        nameof(HeaderText),
        typeof(string),
        typeof(MyCard),
        new PropertyMetadata(string.Empty, OnHeaderTextChanged));

public string HeaderText
{
    get => (string)GetValue(HeaderTextProperty);
    set => SetValue(HeaderTextProperty, value);
}

private static void OnHeaderTextChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
{
    var card = (MyCard)d;
    // respond to the change
}
```

The `PropertyMetadata` object carries the default value and an optional property-changed callback. The callback fires whenever the resolved value changes through any mechanism, including binding updates, style application, or direct assignment. This is how a control can react to property changes without overriding a setter.

Once `HeaderText` is registered as a dependency property, consumers can bind to it, set it through a style, or animate it, all without any additional work in the control. The property system handles everything through the `GetValue` and `SetValue` calls in the wrapper property.

---

## Attached Properties

Attached properties extend the dependency property system to allow one type to define a property that can be set on instances of completely different types. Layout panels use this pattern extensively to let child elements communicate their positioning requirements to the panel without the elements needing to know anything about the specific panel type.

When you write `Grid.Row="1"` on a `TextBox`, you are setting an attached property. The `Grid` class defines `RowProperty` as an attached dependency property, and the parser calls `Grid.SetRow(textBox, 1)`. The value is stored in the `TextBox`'s dependency property store, associated with the `Grid.RowProperty` key, and the `Grid` reads it back during its layout pass using `Grid.GetRow(child)`.

Other examples include `Canvas.Left`, `Canvas.Top`, `ScrollViewer.IsVerticalScrollChainingEnabled`, and `ToolTipService.ToolTip`. Each of these attaches behavior or data to elements without requiring those elements to inherit from a special base class.

Creating a custom attached property follows a similar pattern to a regular dependency property, but uses `RegisterAttached` and static `Get`/`Set` accessor methods instead of instance wrappers.

```csharp
public static readonly DependencyProperty BadgeCountProperty =
    DependencyProperty.RegisterAttached(
        "BadgeCount",
        typeof(int),
        typeof(BadgeHelper),
        new PropertyMetadata(0));

public static int GetBadgeCount(DependencyObject obj) =>
    (int)obj.GetValue(BadgeCountProperty);

public static void SetBadgeCount(DependencyObject obj, int value) =>
    obj.SetValue(BadgeCountProperty, value);
```

In XAML, after declaring the appropriate namespace prefix, consumers can write `local:BadgeHelper.BadgeCount="3"` on any element. A style trigger or property-changed callback can then use this value to drive visual behavior, making attached properties a clean way to extend the behavior of existing controls without subclassing them.

---

## Type Converters

XAML attribute values are always strings at the markup level, but the properties they target often expect non-string types like `Thickness`, `Color`, `GridLength`, or `FontWeight`. Type converters bridge this gap automatically so you can write `Margin="8,4,8,4"` instead of constructing a `Thickness` object in property-element syntax.

Each type that participates in this system has a corresponding type converter registered through metadata. When the XAML parser encounters an attribute value destined for a `Thickness` property, it looks up the converter for `Thickness`, passes the string `"8,4,8,4"` to it, and gets back a properly constructed `Thickness(8, 4, 8, 4)` instance. This happens transparently for all standard WinUI 3 types.

The same mechanism handles enumeration values. Writing `HorizontalAlignment="Center"` works because the parser recognizes that `HorizontalAlignment` is an enum and uses the standard enum converter to parse `"Center"` into `HorizontalAlignment.Center`. Brush strings like `"#FF0078D4"` or named colors like `"Transparent"` are handled by a brush converter that the parser invokes on any property of type `Brush`.

Type converters are one reason that compact attribute syntax feels natural for such a wide range of property types. For types without a registered converter, you must use property-element syntax and construct the value explicitly in markup, or provide it through a markup extension like `{StaticResource}`. Understanding when the parser can convert automatically versus when you need to be explicit prevents a common class of "the property isn't accepting my value" confusion.
