---
title: "Data Binding in WinUI 3"
layout: guide
category: "WinUI 3"
subcategory: "Data & MVVM"
description: "How WinUI 3 data binding connects controls to data: where {x:Bind} and {Binding} each find their source, binding modes and update timing, change notification with INotifyPropertyChanged and ObservableCollection, converting values with functions or converters, binding inside data templates, and tracking down bindings that fail silently."
tags: [data-binding, x-bind, inotifypropertychanged, observablecollection, value-converters, compiled-bindings, practical]
---

## Two Binding Systems

A binding connects a property on a control, the **target**, to a property on some object, the **source**, so that the control shows the source's value without code copying it across. Instead of writing `titleText.Text = viewModel.Title` every time the title changes, the markup declares the connection and the binding keeps the two in step. View models stay free of any reference to controls, which is what lets them be tested without a UI.

WinUI has two ways to declare a binding, and they differ in where they look for the source:

| | `{x:Bind}` | `{Binding}` |
| --- | --- | --- |
| Path starts at | The page, user control, or window class itself | The element's `DataContext`, the data object it inherits from its parent, or an explicit `Source`, `ElementName`, or `RelativeSource` |
| Resolved | At compile time, into generated code in the `obj` folder | At runtime, by looking up names on whatever object it finds |
| Default mode | `OneTime` | `OneWay` |
| Mistyped path | Build error | Nothing shown, plus a message in the debugger output |
| Inside a `DataTemplate` | Needs `x:DataType` naming the item type | Works against whatever item it gets |
| Extras | Functions in the path, event handlers, element names as fields | Bindings created in code, sources whose type is only known at runtime |

`DataContext` is a property on every `FrameworkElement` whose value, when not set, is inherited from the parent. Setting it on a page once makes it the default source for every `{Binding}` below. `{x:Bind}` ignores it and resolves each path against the page's own class, so `{x:Bind ViewModel.Title}` needs a `ViewModel` property in the page's code-behind:

```csharp
public sealed partial class OrdersPage : Page
{
    // The root of every {x:Bind ViewModel...} path on this page.
    public OrderViewModel ViewModel { get; } = new();

    public OrdersPage()
    {
        InitializeComponent();
        DataContext = ViewModel;   // only needed by {Binding}
    }
}
```

{% include figure.html id="winui-binding-source-roots" %}

The property has to hold the view model before the bindings first read it, which the next section times. A `Window` can be an `{x:Bind}` root too. `Window` isn't a `FrameworkElement` and has no `DataContext`, so `{Binding}` in a window takes its source from a `DataContext` set on the window's root content element.

Prefer `{x:Bind}`. A renamed property or a typo breaks the build instead of producing an empty control at runtime, and the generated code avoids runtime lookups. `{Binding}` remains the tool for three cases. The first is a source whose type isn't known at compile time, such as a dictionary parsed from JSON, or items of unrelated types that happen to share a property name. The second is a binding built in code. The third is markup in a resource dictionary without a code-behind class, where `{x:Bind}` can't generate code.

---

## Binding Modes and Update Timing

A binding's **mode** says which way values flow and for how long:

| Mode | Flow | Typical use |
| --- | --- | --- |
| `OneTime` | Source to target, once, when the binding initializes | Values that never change while the page is shown |
| `OneWay` | Source to target, again on every change notification | Labels, status text, lists that update |
| `TwoWay` | Both ways: source changes update the control, and user edits update the source | Input controls bound to view model properties |

```xml
<!-- x:Bind: OneTime unless told otherwise -->
<TextBlock Text="{x:Bind ViewModel.CustomerName}" />

<!-- OneWay: follows later changes -->
<TextBlock Text="{x:Bind ViewModel.StatusMessage, Mode=OneWay}" />

<!-- TwoWay: user input flows back to the view model -->
<TextBox Text="{x:Bind ViewModel.SearchQuery, Mode=TwoWay}" />
```

The different defaults cause the most common `{x:Bind}` bug. A binding without `Mode=OneWay` shows the value the property held when the page loaded and ignores every later change. The binding looks correct during development, when the data is usually ready before the page loads, and goes stale in the real app. Microsoft chose `OneTime` as the default because change tracking costs generated code. `x:DefaultBindMode="OneWay"` on an element changes the default for every `{x:Bind}` inside it.

### When a Two-Way Binding Writes Back

`UpdateSourceTrigger` decides when a `TwoWay` binding copies the control's value into the source:

| Value | Writes back | Supported by |
| --- | --- | --- |
| `Default` | `PropertyChanged` for most properties, `LostFocus` for `TextBox.Text` | Both |
| `PropertyChanged` | On every change, such as each keystroke | Both |
| `LostFocus` | When the control loses focus | Both |
| `Explicit` | Only when code calls `UpdateSource` on the binding, obtained with `GetBindingExpression` | `{Binding}` only |

The `TextBox.Text` default means a view model bound to a text box sees the text only when the user leaves the box, so a Save button that reads the view model while focus is still in the box can miss the last edit. Set `UpdateSourceTrigger=PropertyChanged` for search-as-you-type or a live preview. The setting only reaches a `TextBox` you bind directly. Binding `NumberBox.Text`, whose text box lives inside its template, with `PropertyChanged` has no effect.

### When x:Bind First Reads Its Source

The generated code initializes a page's or user control's `{x:Bind}` bindings during its `Loading` event, just before its first layout. A `ViewModel` property still `null` at that point gives every binding a `null` source. A `Window` has no `Loading` event, and its generated code starts the bindings when the window is first activated instead. Data that arrives later, typically from an `async` load started in the constructor or `OnNavigatedTo`, reaches `OneWay` bindings through change notification. `OneTime` bindings never see it unless code calls `this.Bindings.Update()` after the data arrives, which re-reads every binding on the page once. For data that is loaded once and then never changes, `OneTime` bindings plus a single `Bindings.Update()` cost less than making everything `OneWay`.

---

## Change Notification

`OneWay` and `TwoWay` bindings react to changes only when the source announces them. A property that changes silently leaves the control showing the old value, and nothing reports an error.

### INotifyPropertyChanged

A source object announces property changes by implementing `INotifyPropertyChanged`, whose single event, `PropertyChanged`, carries the name of the property that changed. The binding subscribes to it and re-reads that property.

```csharp
using System.ComponentModel;
using System.Runtime.CompilerServices;

public class ProductViewModel : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    private string _name = string.Empty;
    public string Name
    {
        get => _name;
        set
        {
            if (_name != value)
            {
                _name = value;
                OnPropertyChanged();
            }
        }
    }

    protected void OnPropertyChanged([CallerMemberName] string? propertyName = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}
```

`[CallerMemberName]` fills in `"Name"` from the setter that calls it, so a rename can't leave a stale string behind. The equality check skips the event when the value didn't change, which avoids redundant UI updates and stops a `TwoWay` binding from echoing a value back and forth. A property computed from others, such as `FullName` from `FirstName` and `LastName`, gets no notification of its own, so the setters it depends on raise `PropertyChanged` for it too.

The CommunityToolkit.Mvvm source generators write this pattern for you from an annotated field, and most WinUI view models use them rather than hand-written setters.

Raise `PropertyChanged`, and change an `ObservableCollection`, on the UI thread. The binding updates the control from whatever thread raised the event, and a WinUI control touched from another thread throws.

### ObservableCollection

A property notification covers replacing a whole value. A list needs to announce items added, removed, or moved within it, which is what `INotifyCollectionChanged` and its `CollectionChanged` event do. `ObservableCollection<T>` implements it, and a list control bound to one updates only the rows that changed. A `List<T>` raises nothing, so items added after the first display never appear.

```csharp
public class OrderViewModel
{
    public ObservableCollection<LineItem> LineItems { get; } = new();

    public void AddItem(LineItem item) => LineItems.Add(item);    // one row appears
    public void RemoveItem(LineItem item) => LineItems.Remove(item); // one row goes
}
```

Replacing the collection is a different kind of change. After `LineItems = new ObservableCollection<LineItem>(fresh)`, the list is still bound to the old instance and shows the old items. The new instance reaches the control only if the property raises `PropertyChanged` and the binding is `OneWay`, and the control then rebuilds the whole list.

`ObservableCollection<T>` has no `AddRange`, so loading 500 items with `Add` raises 500 notifications, each of which the list control processes. For a full reload, either build a new collection and assign it to a notifying property, which the list handles as one change, or call `Clear` and re-add, which drops the selection along with the old items.

---

## Converting Values

A bound value often isn't the type or form the target property needs, such as a `DateTime` shown as text in the user's format or a status enum that picks a color. Three places can do the conversion.

**A property on the view model.** Exposing `DueDateText` alongside `DueDate` keeps the logic testable and needs no XAML machinery. It stops scaling when many properties need the same treatment.

**A function in an `{x:Bind}` path.** The last step of an `x:Bind` path can be a method call, and its arguments are themselves binding paths:

```xml
<Page xmlns:local="using:MyApp">
    <TextBlock Text="{x:Bind local:Formatters.ShortDate(ViewModel.DueDate), Mode=OneWay}" />
</Page>
```

```csharp
public static class Formatters
{
    public static string ShortDate(DateTime value) => value.ToString("d");
    public static string Price(decimal value) => value.ToString("C");
}
```

With `Mode=OneWay`, the binding re-runs the function whenever an argument's property raises `PropertyChanged`. A function can take several arguments, so it also covers what WPF did with `MultiBinding`, which WinUI doesn't have. The argument types must match the bound values, because the binding performs no narrowing conversions, and the return type must match the target property. A `TwoWay` function binding names a second function for the reverse direction with `BindBack`.

**A value converter.** A class implementing `IValueConverter` works with both binding systems and is the only option for `{Binding}`:

```csharp
using Microsoft.UI.Xaml.Data;

public class DurationToTextConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language) =>
        value is TimeSpan t ? $"{(int)t.TotalHours}h {t.Minutes:00}m" : string.Empty;

    public object ConvertBack(object value, Type targetType, object parameter, string language) =>
        throw new NotSupportedException();
}
```

```xml
<Page.Resources>
    <local:DurationToTextConverter x:Key="DurationToText" />
</Page.Resources>

<TextBlock Text="{Binding Elapsed, Converter={StaticResource DurationToText}}" />
```

`Convert` runs on the way to the target, and `ConvertBack` only for `TwoWay` bindings, so a one-way converter can throw there. The `language` argument carries the binding's `ConverterLanguage`, and `ConverterParameter` passes a fixed value from markup into both methods. The Community Toolkit's `CommunityToolkit.WinUI.Converters` package ships common converters ready-made. In `{x:Bind}` property bindings, a `bool` converts to `Visibility` without any converter, as the `{x:Bind}` reference documents. That conversion doesn't apply to function bindings or to `{Binding}`, where Microsoft points to the toolkit's `BoolToVisibilityConverter`.

Two binding properties handle missing values without a converter. `TargetNullValue` supplies what to show when the value at the end of the path is `null`. `FallbackValue` supplies what to show when the path can't be resolved at all, such as when an object partway along it is `null`.

---

## Binding Inside Data Templates

A `DataTemplate` describes how to display one item, and a list control stamps it out for each item in its collection. Inside a template, the source changes. `{Binding}` resolves against the item, because the list sets each generated element's `DataContext` to the item it shows. `{x:Bind}` resolves against the item too, but it has to know the item's type at compile time, so the template declares it with `x:DataType`:

```csharp
public record Product(string Name, string Category, decimal Price);
```

```xml
<ListView ItemsSource="{x:Bind ViewModel.Products, Mode=OneWay}">
    <ListView.ItemTemplate>
        <DataTemplate x:DataType="local:Product">
            <Grid ColumnDefinitions="*, Auto" ColumnSpacing="12" Padding="8">
                <StackPanel>
                    <TextBlock Text="{x:Bind Name}" Style="{StaticResource BodyStrongTextBlockStyle}" />
                    <TextBlock Text="{x:Bind Category}" Style="{StaticResource CaptionTextBlockStyle}" />
                </StackPanel>
                <TextBlock Grid.Column="1" Text="{x:Bind local:Formatters.Price(Price)}" />
            </Grid>
        </DataTemplate>
    </ListView.ItemTemplate>
</ListView>
```

`Price` is a `decimal`, which is what `Formatters.Price` takes. Function arguments get no narrowing conversion, so the source property's type has to match the parameter's.

Without `x:DataType`, `{x:Bind}` in a template fails to compile. With it, every item the template receives has to be that type, or a type derived from it, because the generated code treats each item as that type. An interface or base class works as the declared type when the collection mixes related types.

Because an `{x:Bind}` path inside a template starts at the item, the template can't reach the page's view model the way the page's own bindings do. A command that acts on an item, such as Delete, is usually easier to expose on the item itself, or to invoke from the page with the item passed as the parameter, than to reach back out of the template.

Choosing between several templates per item, and grouping items under headers with `CollectionViewSource`, are list-control features built on top of this. `CollectionViewSource` in WinUI provides grouping and a shared current item, not sorting or filtering. Sort or filter the collection in the view model before binding it.

---

## Finding Bindings That Fail Silently

A failing binding usually shows an empty control rather than an error, so the two systems need different habits.

With `{x:Bind}`, most failures surface at build time. The generated code lives in files like `OrdersPage.g.cs` in the `obj` folder, and a breakpoint there shows exactly when a binding reads its source. Turning on **Break On Unhandled Exceptions** in Visual Studio stops the debugger inside that generated code when a binding throws.

With `{Binding}`, a wrong path produces nothing on screen. When the debugger is attached, Visual Studio lists each failure in the **Output** window and in the **XAML Binding Failures** window, with the path it couldn't resolve and the type it looked on.

A binding that compiles, reports no failure, and still shows stale or empty data usually comes down to one of these:

- **The binding is `OneTime`.** An `{x:Bind}` without `Mode=OneWay` read the source once at initialization, possibly before an `async` load finished.
- **`ViewModel` was assigned after initialization.** The page doesn't announce changes to its own properties, so even `OneWay` bindings keep reading `null`. Assign it earlier, or call `Bindings.Update()` afterward.
- **The source never announces the change.** The property doesn't raise `PropertyChanged`, or the collection is a `List<T>`.
- **There is no source.** A `{Binding}` whose `DataContext` was never set, or was set on a different element, resolves against `null`.
- **The collection instance was replaced.** The control is still bound to the old one.
- **The edit hasn't been written back yet.** A two-way `TextBox.Text` binding updates the source only when the box loses focus.
- **The notification came from another thread.** The update threw instead of reaching the control.
- **It works in Debug and goes empty in a Native AOT build.** `{Binding}` and `DisplayMemberPath` look properties up at runtime, which AOT compilation can't do by reflection. CsWinRT's guidance is to make each C# class used as their source `partial` and mark it `[WinRT.GeneratedBindableCustomProperty]`, so a source generator produces the lookup. `{x:Bind}` needs neither.
