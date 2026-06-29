---
title: "Data Binding in WinUI 3"
layout: guide
category: "WinUI 3"
subcategory: "Data & MVVM"
description: "Understanding data binding modes, change notification with INotifyPropertyChanged, value converters, data templates, and CollectionViewSource for presenting data in WinUI 3."
tags: [winui, winui-3, xaml, data-binding, mvvm, collections, desktop, practical]
---

## Table of Contents

- [What Data Binding Is and Why It Matters](#what-data-binding-is-and-why-it-matters)
- [Binding Modes](#binding-modes)
- [INotifyPropertyChanged](#inotifypropertychanged)
- [ObservableCollection](#observablecollection)
- [Value Converters](#value-converters)
- [Data Templates](#data-templates)
- [DataTemplateSelector](#datatemplateselector)
- [CollectionViewSource](#collectionviewsource)
- [Binding Failures and Debugging](#binding-failures-and-debugging)

---

## What Data Binding Is and Why It Matters

Data binding is the mechanism that connects properties on your XAML controls to properties on your data objects, without requiring you to write imperative code that manually copies values back and forth. Instead of writing `myTextBlock.Text = viewModel.Title` every time the title changes, you declare the connection in XAML and let the binding system manage synchronization for you.

This separation matters for several reasons. Your view models and models can be written and tested independently of any UI code, because they contain no references to controls or XAML. The XAML file becomes a declarative description of how data should be presented rather than a sequence of assignments. When the underlying data changes, the UI responds automatically through the binding infrastructure rather than through manually wired event handlers.

WinUI 3 provides two binding systems that serve the same goal but work differently. The classic `{Binding}` markup extension has been part of the XAML ecosystem since WPF and resolves property paths at runtime using reflection. The newer `{x:Bind}` extension generates strongly-typed C# code at compile time, which gives it better performance and the ability to catch errors before the application ever runs. Both appear regularly in WinUI 3 code, and understanding the differences between them shapes how you structure binding declarations throughout the application.

---

## Binding Modes

Both binding systems support the same set of binding modes, though their defaults differ in a way that catches developers off guard.

`OneTime` reads the source value once when the binding is first evaluated and sets the target property. After that initial read, the binding system ignores any changes to the source. This mode is appropriate for data that never changes during the lifetime of the control, such as labels populated from a configuration object or items in a static lookup list.

`OneWay` establishes a live connection from source to target. When the source property changes, the binding system propagates the new value to the target control. Changes to the target control do not flow back to the source. This is the right choice for read-only display properties like a status label or a progress indicator.

`TwoWay` synchronizes values in both directions. When the source changes, the target updates. When the user modifies the target, such as typing in a `TextBox`, the new value is written back to the source property. This mode is appropriate for any input control where the user's interaction is meant to update the data model.

```xml
<!-- x:Bind: OneTime is the default, so these two are equivalent -->
<TextBlock Text="{x:Bind Title}" />
<TextBlock Text="{x:Bind Title, Mode=OneTime}" />

<!-- x:Bind: OneWay keeps the label in sync with changes -->
<TextBlock Text="{x:Bind ViewModel.StatusMessage, Mode=OneWay}" />

<!-- x:Bind: TwoWay writes user input back to the view model -->
<TextBox Text="{x:Bind ViewModel.SearchQuery, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}" />
```

The default mode difference between the two systems is worth memorizing. `{x:Bind}` defaults to `OneTime`, which means a binding that appears to work during development might silently stop updating when the source changes, because you forgot to add `Mode=OneWay`. `{Binding}` defaults to `OneWay`, which is a more forgiving starting point. Neither default is wrong; they reflect different design priorities. `{x:Bind}` trades the safer default for better performance by only subscribing to change notifications when explicitly asked to.

`UpdateSourceTrigger` controls when a `TwoWay` binding writes back to the source. The default for most properties is `LostFocus`, meaning the source updates when the user moves away from the control. Setting it to `PropertyChanged` causes the source to update on every keystroke, which is useful for search fields or live-preview scenarios.

---

## INotifyPropertyChanged

For `OneWay` or `TwoWay` bindings to respond to source changes, the source object must give the binding system a way to detect when a property value has changed. `INotifyPropertyChanged` is the interface that provides this capability. It defines a single event, `PropertyChanged`, which the binding system subscribes to when it establishes a live binding.

A minimal manual implementation of the interface looks like this:

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

    protected void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
```

The `[CallerMemberName]` attribute on the `propertyName` parameter causes the compiler to fill in the calling property's name automatically, so `OnPropertyChanged()` inside the `Name` setter automatically raises `PropertyChanged` with `"Name"` as the argument. This avoids brittle string literals that can become stale when properties are renamed.

The equality check before assigning the new value is a small but important detail. Without it, setting a property to its current value still raises `PropertyChanged`, which can trigger unnecessary UI updates and, in `TwoWay` binding scenarios, create feedback loops.

Writing this boilerplate for every property in every view model becomes tedious quickly. The [CommunityToolkit.Mvvm](https://learn.microsoft.com/en-us/dotnet/communitytoolkit/mvvm/){:target="_blank" rel="noopener noreferrer"} library provides an `ObservableObject` base class and source generators that reduce this to annotated fields, generating the full property implementation automatically at compile time.

```csharp
using CommunityToolkit.Mvvm.ComponentModel;

public partial class ProductViewModel : ObservableObject
{
    [ObservableProperty]
    private string _name = string.Empty;
}
```

The source generator produces a `Name` property with the full `INotifyPropertyChanged` implementation, including the equality check and the `OnPropertyChanged` call.

---

## ObservableCollection

`INotifyPropertyChanged` handles changes to individual properties on an object, but collection controls like `ListView` and `GridView` need to know when items are added to, removed from, or reordered within the collection itself. `ObservableCollection<T>` provides this through a separate interface, `INotifyCollectionChanged`, which fires `CollectionChanged` events whenever the collection's contents are modified.

When you add an item to an `ObservableCollection<T>`, the collection raises a `CollectionChanged` event with an action of `Add` and a reference to the new item. The bound `ListView` receives this notification and inserts the corresponding visual item without redrawing the entire list. The same granular notifications fire for removals and moves, keeping the UI synchronized efficiently.

```csharp
public class OrderViewModel : ObservableObject
{
    public ObservableCollection<LineItem> LineItems { get; } = new();

    public void AddItem(LineItem item)
    {
        LineItems.Add(item); // ListView updates automatically
    }

    public void RemoveItem(LineItem item)
    {
        LineItems.Remove(item); // ListView removes just this row
    }
}
```

One behavior that surprises developers is that replacing the entire collection does not notify the UI. If you write `LineItems = new ObservableCollection<LineItem>(freshData)`, the `ListView` is still watching the original collection instance. The binding to `LineItems` itself would need to be live (`OneWay`) and the `LineItems` property would need to raise `PropertyChanged` for the control to pick up the new collection reference. Adding `[ObservableProperty]` or implementing the property with `OnPropertyChanged()` in the setter handles this case, but it causes the list control to repopulate from scratch rather than applying incremental updates.

For bulk updates where you want to replace all items without the cost of individual add/remove notifications, the `CommunityToolkit.Mvvm` library provides an `ObservableCollection<T>` extension method that batches changes. For the straightforward case, clearing and re-adding items works, though it also resets scroll position and selection state.

---

## Value Converters

Binding connects a source property to a target property, but source and target are often different types or require different representations. A boolean `IsActive` property might need to display as `Visibility.Visible` or `Visibility.Collapsed`. A `DateTime` stored as UTC might need to display in the user's local time with a specific format. Value converters transform the value as it travels between source and target.

A value converter implements `IValueConverter`, which requires two methods. `Convert` transforms the source value into the form expected by the target property. `ConvertBack` performs the reverse transformation for `TwoWay` bindings; if the binding is `OneWay`, `ConvertBack` can throw `NotImplementedException`.

```csharp
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Data;

public class BoolToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        return value is bool b && b ? Visibility.Visible : Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
    {
        return value is Visibility v && v == Visibility.Visible;
    }
}
```

Converters are declared as resources so they can be referenced by key in binding expressions. The most common place to declare them is in `App.xaml` or in the page's `Resources` section.

```xml
<Page.Resources>
    <local:BoolToVisibilityConverter x:Key="BoolToVisibility" />
</Page.Resources>

<!-- Usage in a binding -->
<Border Visibility="{x:Bind ViewModel.IsLoading, Mode=OneWay,
        Converter={StaticResource BoolToVisibility}}" />
```

The `parameter` argument to `Convert` lets you pass a static value from the XAML declaration to influence conversion logic. A single `BoolToVisibilityConverter` could accept a parameter like `"Invert"` to reverse the logic, rather than requiring a separate `InvertedBoolToVisibilityConverter` class.

Common converters worth having in a project include converters for boolean-to-visibility, null-to-visibility, string formatting, enum-to-description, and numeric formatting. Rather than writing these from scratch, the [WinUI 3 Gallery](https://github.com/microsoft/WinUI-Gallery){:target="_blank" rel="noopener noreferrer"} and `CommunityToolkit.WinUI` provide ready-made implementations.

---

## Data Templates

A `DataTemplate` defines the visual structure used to represent a data object in a collection control or a content presenter. Instead of telling a `ListView` to display a list of strings, you can give it a template that describes how each `Product` object should appear, combining an image, a name label, and a price, all bound to properties of the data object.

```xml
<ListView ItemsSource="{x:Bind ViewModel.Products, Mode=OneWay}">
    <ListView.ItemTemplate>
        <DataTemplate x:DataType="local:Product">
            <Grid ColumnDefinitions="Auto,*,Auto" Padding="8">
                <Image Grid.Column="0" Source="{x:Bind ThumbnailUrl}"
                       Width="48" Height="48" />
                <StackPanel Grid.Column="1" Margin="12,0,0,0">
                    <TextBlock Text="{x:Bind Name}" Style="{ThemeResource BodyStrongTextBlockStyle}" />
                    <TextBlock Text="{x:Bind Category}" Style="{ThemeResource CaptionTextBlockStyle}" />
                </StackPanel>
                <TextBlock Grid.Column="2" Text="{x:Bind Price}" />
            </Grid>
        </DataTemplate>
    </ListView.ItemTemplate>
</ListView>
```

The `x:DataType` attribute on the `DataTemplate` tells the `x:Bind` compiler what type the data context within the template represents. Without it, `x:Bind` has no way to generate strongly-typed binding code, and you would need to fall back to `{Binding}` for properties inside the template. The type specified in `x:DataType` must match the actual runtime type of the items in the collection for bindings to resolve correctly.

When a `DataTemplate` is reused across multiple locations, it makes sense to define it as a resource in `App.xaml` or in a `ResourceDictionary` file, giving it an `x:Key`. Content controls like `ContentPresenter` and `ContentControl` have a `ContentTemplate` property that accepts a `DataTemplate`, which is how detail panels typically display a selected item.

---

## DataTemplateSelector

A single `DataTemplate` describes a uniform visual representation for every item in a collection. When items in a collection have different types or different display requirements based on their state, a `DataTemplateSelector` allows the control to choose a template dynamically for each item.

`DataTemplateSelector` is an abstract class with one method to override: `SelectTemplateCore`. You receive the data item as an argument and return the appropriate `DataTemplate`.

```csharp
public class MessageTemplateSelector : DataTemplateSelector
{
    public DataTemplate? SentTemplate { get; set; }
    public DataTemplate? ReceivedTemplate { get; set; }

    protected override DataTemplate? SelectTemplateCore(object item)
    {
        if (item is ChatMessage message)
        {
            return message.IsSent ? SentTemplate : ReceivedTemplate;
        }
        return base.SelectTemplateCore(item);
    }
}
```

The template selector is declared as a resource, with its template properties set to other resources.

```xml
<Page.Resources>
    <DataTemplate x:Key="SentMessageTemplate" x:DataType="local:ChatMessage">
        <Border Background="{ThemeResource AccentFillColorDefaultBrush}"
                HorizontalAlignment="Right" CornerRadius="8" Padding="12,8">
            <TextBlock Text="{x:Bind Body}" Foreground="White" />
        </Border>
    </DataTemplate>

    <DataTemplate x:Key="ReceivedMessageTemplate" x:DataType="local:ChatMessage">
        <Border Background="{ThemeResource CardBackgroundFillColorDefaultBrush}"
                HorizontalAlignment="Left" CornerRadius="8" Padding="12,8">
            <TextBlock Text="{x:Bind Body}" />
        </Border>
    </DataTemplate>

    <local:MessageTemplateSelector x:Key="MessageSelector"
        SentTemplate="{StaticResource SentMessageTemplate}"
        ReceivedTemplate="{StaticResource ReceivedMessageTemplate}" />
</Page.Resources>

<ListView ItemsSource="{x:Bind ViewModel.Messages, Mode=OneWay}"
          ItemTemplateSelector="{StaticResource MessageSelector}" />
```

Note that when using a `DataTemplateSelector`, you assign `ItemTemplateSelector` on the collection control rather than `ItemTemplate`. The two properties are mutually exclusive; setting `ItemTemplate` overrides the selector.

---

## CollectionViewSource

Presenting raw collections works well for simple cases, but many scenarios require sorting, grouping, or filtering the data before displaying it. `CollectionViewSource` wraps an existing collection and exposes a view over it that applies these transformations without modifying the source collection itself.

Grouping is the most common use of `CollectionViewSource`. To group a flat list of contacts by their first initial, you configure a `CollectionViewSource` with `IsSourceGrouped="True"` and provide a collection already organized into groups. The `ListView` or `GridView` then renders group headers automatically when bound to the `CollectionViewSource.View` property.

```xml
<Page.Resources>
    <CollectionViewSource x:Key="GroupedContacts"
                          IsSourceGrouped="True"
                          Source="{x:Bind ViewModel.ContactGroups, Mode=OneWay}" />
</Page.Resources>

<ListView ItemsSource="{Binding Source={StaticResource GroupedContacts}}">
    <ListView.GroupStyle>
        <GroupStyle>
            <GroupStyle.HeaderTemplate>
                <DataTemplate>
                    <TextBlock Text="{Binding Key}"
                               Style="{ThemeResource TitleTextBlockStyle}" />
                </DataTemplate>
            </GroupStyle.HeaderTemplate>
        </GroupStyle>
    </ListView.GroupStyle>
    <ListView.ItemTemplate>
        <DataTemplate x:DataType="local:Contact">
            <TextBlock Text="{x:Bind FullName}" />
        </DataTemplate>
    </ListView.ItemTemplate>
</ListView>
```

Notice the use of `{Binding Source={StaticResource GroupedContacts}}` on the `ItemsSource`. The `CollectionViewSource` is not the data directly; you bind to its `View` property, which `{Binding}` resolves automatically when you provide the `CollectionViewSource` as the source. Attempting to use `{x:Bind}` directly with a `CollectionViewSource` requires explicitly binding to the `.View` property because `x:Bind` does not apply this implicit resolution.

The source data for grouped display typically needs to be pre-grouped on the view model side into a collection of objects, where each group object exposes a `Key` and implements `IEnumerable` over its items. LINQ's `GroupBy` combined with a `ToObservableCollection` helper is a common pattern for building these group structures from a flat source.

---

## Binding Failures and Debugging

When a binding silently shows nothing or displays incorrect data, finding the cause depends on which binding system you used.

`{x:Bind}` failures often manifest as compile errors when the property path is wrong, because the generated code references actual C# properties. If the project builds but the value does not appear, common causes include the mode being `OneTime` when you intended `OneWay`, the source property not raising `PropertyChanged`, or an `x:DataType` mismatch in a `DataTemplate` causing the bindings inside the template to target the wrong type.

`{Binding}` failures are quieter. The runtime resolves paths using reflection and swallows errors silently, showing nothing rather than crashing. The Visual Studio Output window is the first place to look; the binding system writes diagnostic messages there when it cannot resolve a path or encounters a type mismatch. A message like `Error: BindingExpression path error: 'ProductNme' property not found on 'ProductViewModel'` points directly to a misspelling.

To enable more verbose binding diagnostics, you can attach a `PresentationTraceSources` listener in WPF, though WinUI 3 uses a somewhat different diagnostic surface through the Windows App SDK. The [XAML Hot Reload](https://learn.microsoft.com/en-us/visualstudio/xaml-tools/xaml-hot-reload){:target="_blank" rel="noopener noreferrer"} tooling in Visual Studio can help observe the live element tree and the values actually bound to properties.

A practical debugging workflow starts by simplifying the binding. Replace a complex path like `{x:Bind ViewModel.Order.Customer.Name, Mode=OneWay}` with a direct property on the page to verify that the binding infrastructure is working, then restore the full path once the simpler case succeeds. For collection bindings, confirming that the source collection is not null and contains the expected items before the binding is evaluated eliminates a common source of empty list displays.

When converters are involved, temporarily removing the converter from the binding expression and checking whether the raw value appears confirms whether the issue is in the binding path itself or in the conversion logic. A converter that throws an exception during `Convert` will cause the binding to fall back silently in some cases, so adding a breakpoint inside the converter is often faster than reading diagnostics.

The compile-time guarantees of `{x:Bind}` make it significantly easier to maintain as a codebase grows, because property renames and type changes surface as build errors rather than invisible runtime failures. Preferring `{x:Bind}` and reserving `{Binding}` for cases where `{x:Bind}` cannot reach the data context, such as certain `CollectionViewSource` scenarios, keeps the binding surface as auditable as possible.
