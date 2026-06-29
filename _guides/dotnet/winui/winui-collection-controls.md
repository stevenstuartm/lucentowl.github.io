---
title: "Collection Controls in WinUI 3"
layout: guide
category: "WinUI 3"
subcategory: "Controls & UI"
description: "Displaying collections of data using ListView, GridView, TreeView, FlipView, and ItemsRepeater in WinUI 3 with virtualization and custom layouts."
tags: [winui, winui-3, xaml, controls, collections, data-binding, desktop, practical]
---

## Table of Contents

- [UI Virtualization](#ui-virtualization)
- [ListView](#listview)
- [GridView](#gridview)
- [ItemTemplate and DataTemplate](#itemtemplate-and-datatemplate)
- [TreeView](#treeview)
- [FlipView](#flipview)
- [ItemsRepeater](#itemsrepeater)
- [Selection Handling](#selection-handling)
- [Performance Considerations](#performance-considerations)


## UI Virtualization

When displaying collections with tens or hundreds of items, rendering every item at once is wasteful. Most items sit outside the visible viewport and serve no purpose being in the visual tree. UI virtualization solves this by only creating UI elements for the items currently visible to the user, and then recycling those containers as scrolling occurs.

WinUI 3's collection controls like `ListView` and `GridView` build virtualization in at the panel level. As the user scrolls, the underlying `VirtualizingStackPanel` or `ItemsWrapGrid` hands off a container from an item scrolling out of view to an item scrolling into view. The control rebinds the data to that recycled container rather than instantiating a new one. This keeps memory consumption flat and scroll performance smooth even with large collections.

Virtualization only works when the collection control has a constrained height. If a `ListView` sits inside a `StackPanel` without a height limit, the layout system will expand it to fit all items, defeating virtualization entirely. Place collection controls inside a `Grid` row with a fixed or star-sized height, or use `MaxHeight`, to ensure the scroll viewport exists and virtualization can engage.


## ListView

`ListView` is the standard control for displaying a vertically scrolling list of items. It works directly with any `IEnumerable` source bound to its `ItemsSource` property and supports everything from simple string collections to complex view-model objects.

```xml
<ListView ItemsSource="{x:Bind ViewModel.Orders, Mode=OneWay}"
          SelectionMode="Single"
          SelectedItem="{x:Bind ViewModel.SelectedOrder, Mode=TwoWay}">
    <ListView.ItemTemplate>
        <DataTemplate x:DataType="models:Order">
            <StackPanel>
                <TextBlock Text="{x:Bind OrderNumber}" Style="{StaticResource SubtitleTextBlockStyle}" />
                <TextBlock Text="{x:Bind CustomerName}" Foreground="{ThemeResource TextFillColorSecondaryBrush}" />
            </StackPanel>
        </DataTemplate>
    </ListView.ItemTemplate>
</ListView>
```

Selection is configured through the `SelectionMode` property, which accepts `Single`, `Multiple`, `Extended`, and `None`. Single allows one item at a time. Multiple lets the user select any combination of items using checkboxes that appear on hover. Extended matches the familiar Windows Explorer pattern where clicking selects one item, while holding Shift or Ctrl extends or toggles the selection. None disables selection entirely, which is appropriate when the list is purely informational and interaction happens through buttons within each item template.

Grouping a `ListView` requires an `ICollectionView` or `CollectionViewSource` that exposes groups, along with a `GroupStyle` that defines how each group header renders:

```xml
<Page.Resources>
    <CollectionViewSource x:Name="OrdersViewSource"
                          Source="{x:Bind ViewModel.GroupedOrders}"
                          IsSourceGrouped="True" />
</Page.Resources>

<ListView ItemsSource="{x:Bind OrdersViewSource.View}">
    <ListView.GroupStyle>
        <GroupStyle>
            <GroupStyle.HeaderTemplate>
                <DataTemplate x:DataType="IInspectable">
                    <TextBlock Text="{Binding Key}" Style="{StaticResource TitleTextBlockStyle}" />
                </DataTemplate>
            </GroupStyle.HeaderTemplate>
        </GroupStyle>
    </ListView.GroupStyle>
</ListView>
```

Incremental loading connects to large data sources that fetch pages on demand. Bind `ItemsSource` to a collection that implements `ISupportIncrementalLoading` and `ListView` will automatically request more items as the user approaches the end of the loaded data.


## GridView

`GridView` displays items in a wrapping grid rather than a vertical list, making it a natural fit for image galleries, app libraries, card-based UIs, and any scenario where items have roughly equal visual weight. Its API mirrors `ListView` closely: both share `ItemsSource`, `ItemTemplate`, `SelectionMode`, and grouping support through `GroupStyle`.

The primary difference between the two is the underlying panel. `ListView` uses `VirtualizingStackPanel` by default, while `GridView` uses `ItemsWrapGrid`, which flows items left-to-right and wraps to a new row when the available width is filled. You control item sizing through `ItemsWrapGrid.MaximumRowsOrColumns` and by setting a fixed size on the item container via `ItemContainerStyle`.

Choose `GridView` when items are visually equal and spatial browsing matters. Choose `ListView` when items have a clear primary-to-secondary information hierarchy that reads naturally in a vertical list.


## ItemTemplate and DataTemplate

Every collection control in WinUI 3 uses a `DataTemplate` to define how each item in the source collection renders on screen. A `DataTemplate` is a fragment of XAML that gets stamped out for each visible item, with bindings evaluated against that item's data object.

The `x:DataType` attribute on a `DataTemplate` enables compiled bindings, which are faster than reflection-based bindings and provide compile-time safety:

```xml
<DataTemplate x:DataType="models:Product">
    <Grid ColumnDefinitions="Auto, *">
        <Image Grid.Column="0" Source="{x:Bind ThumbnailUrl}" Width="64" Height="64" />
        <StackPanel Grid.Column="1" Margin="12,0,0,0">
            <TextBlock Text="{x:Bind Name}" />
            <TextBlock Text="{x:Bind Price, Converter={StaticResource CurrencyConverter}}" />
        </StackPanel>
    </Grid>
</DataTemplate>
```

When a single collection contains items of different types and each type needs a different visual representation, use a `DataTemplateSelector`. Subclass `DataTemplateSelector` in C#, override `SelectTemplateCore`, and return the appropriate `DataTemplate` based on the item's runtime type or properties:

```csharp
public class MessageTemplateSelector : DataTemplateSelector
{
    public DataTemplate SentTemplate { get; set; }
    public DataTemplate ReceivedTemplate { get; set; }

    protected override DataTemplate SelectTemplateCore(object item)
    {
        var message = (ChatMessage)item;
        return message.IsSent ? SentTemplate : ReceivedTemplate;
    }
}
```

Assign the selector to the collection control's `ItemTemplateSelector` property instead of `ItemTemplate`, and declare both templates as resources so the selector can reference them.


## TreeView

`TreeView` displays hierarchical data with nodes that expand and collapse to reveal children. It is the right choice for file-system browsers, organizational charts, categorized settings panels, and any data that has a parent-child relationship at multiple levels.

Populate a `TreeView` by binding `ItemsSource` to a flat or nested collection. When the data is hierarchical view-model objects, set `ItemsSource` at the control level and configure `TreeViewItem.ItemsSource` through an `ItemContainerStyle` or by using `ItemTemplate` with an `x:DataType` pointing at your node class:

```xml
<TreeView ItemsSource="{x:Bind ViewModel.RootNodes}"
          SelectionMode="Single"
          SelectedItem="{x:Bind ViewModel.SelectedNode, Mode=TwoWay}">
    <TreeView.ItemTemplate>
        <DataTemplate x:DataType="models:FileNode">
            <TreeViewItem ItemsSource="{x:Bind Children}"
                          IsExpanded="{x:Bind IsExpanded, Mode=TwoWay}">
                <StackPanel Orientation="Horizontal" Spacing="8">
                    <FontIcon Glyph="{x:Bind Icon}" />
                    <TextBlock Text="{x:Bind Name}" />
                </StackPanel>
            </TreeViewItem>
        </DataTemplate>
    </TreeView.ItemTemplate>
</TreeView>
```

`TreeView` supports selection modes similar to `ListView`: `Single`, `Multiple`, and `None`. In `Multiple` mode, checkboxes appear on each node and selecting a parent automatically selects its children. Drag-and-drop reordering is available through `CanDragItems` and `AllowDrop`, and the `DragItemsStarting` and `Drop` events give you control over what actually moves in your data model when the user rearranges nodes.


## FlipView

`FlipView` shows one item at a time and lets the user navigate between items by swiping or clicking the navigation arrows that appear on hover. It is well suited for image galleries, onboarding flows, product carousels, and any scenario where the user focuses on a single item and advances through a sequence.

```xml
<FlipView ItemsSource="{x:Bind ViewModel.Photos}" Height="400">
    <FlipView.ItemTemplate>
        <DataTemplate x:DataType="models:Photo">
            <Image Source="{x:Bind Url}" Stretch="UniformToFill" />
        </DataTemplate>
    </FlipView.ItemTemplate>
</FlipView>
```

Navigation buttons appear automatically on non-touch input. On touch screens, the user swipes left or right. Bind `SelectedIndex` or `SelectedItem` to your view model to drive or read the current position programmatically.

`FlipView` does not virtualize by default in the same way `ListView` does because it pre-loads adjacent items for smooth transitions. Keep the item count reasonable or load images lazily within the template to avoid loading large resources for unseen items. A `BitmapImage` with `DecodePixelWidth` set to the display size avoids loading full-resolution images into memory unnecessarily.


## ItemsRepeater

`ItemsRepeater` is a low-level, non-opinionated repeater control that stamps out an `ItemTemplate` for each item in its source collection. Unlike `ListView` and `GridView`, it has no built-in selection, no scrolling, no header or footer, and no keyboard navigation. What it offers in return is complete layout flexibility and a lighter runtime footprint.

Because `ItemsRepeater` does not include a `ScrollViewer`, you wrap it in one explicitly. Virtualization still occurs when a `ScrollViewer` is present, because `ItemsRepeater` integrates with the layout system to only realize items that fall within the scroll viewport.

```xml
<ScrollViewer>
    <ItemsRepeater ItemsSource="{x:Bind ViewModel.Cards}">
        <ItemsRepeater.Layout>
            <UniformGridLayout MinItemWidth="200" MinItemHeight="200"
                               ItemsStretch="Fill" MaximumRowsOrColumns="4" />
        </ItemsRepeater.Layout>
        <ItemsRepeater.ItemTemplate>
            <DataTemplate x:DataType="models:Card">
                <Border CornerRadius="8" Background="{ThemeResource CardBackgroundFillColorDefaultBrush}" Padding="16">
                    <TextBlock Text="{x:Bind Title}" />
                </Border>
            </DataTemplate>
        </ItemsRepeater.ItemTemplate>
    </ItemsRepeater>
</ScrollViewer>
```

Two built-in layouts cover most needs. `StackLayout` arranges items in a vertical or horizontal line, similar to a `StackPanel`. `UniformGridLayout` places items in a grid where each cell has the same dimensions, wrapping to the next row as needed. For completely custom arrangements like a masonry or staggered layout, subclass `VirtualizingLayout` and implement the measure and arrange passes directly.

Use `ItemsRepeater` when you need layout control that `ListView` or `GridView` cannot provide, when you want to manage selection entirely in your view model without the control's built-in state getting in the way, or when composing a repeater inside a larger custom control where the overhead of a full list control is unnecessary.


## Selection Handling

Collection controls surface selection through two complementary mechanisms: events and bindable properties. The `SelectionChanged` event fires whenever the selection changes and provides `AddedItems` and `RemovedItems` collections on the event arguments, useful for side effects like loading a detail view:

```csharp
private void OrderList_SelectionChanged(object sender, SelectionChangedEventArgs e)
{
    if (e.AddedItems.Count > 0)
    {
        ViewModel.LoadOrderDetail((Order)e.AddedItems[0]);
    }
}
```

For MVVM patterns, binding `SelectedItem` directly to a view-model property is cleaner than wiring up event handlers. With `Mode=TwoWay`, the binding keeps the control's selection state and the view-model property in sync in both directions:

```xml
<ListView ItemsSource="{x:Bind ViewModel.Orders, Mode=OneWay}"
          SelectedItem="{x:Bind ViewModel.SelectedOrder, Mode=TwoWay}" />
```

Multi-selection requires `SelectedItems`, but that property is read-only and cannot be bound two-way directly. The standard approach is to handle `SelectionChanged` and sync the added and removed items into an `ObservableCollection` on the view model, or to use a behavior from a library like the [MVVM Toolkit's EventToCommandBehavior](https://learn.microsoft.com/en-us/dotnet/communitytoolkit/mvvm/){:target="_blank" rel="noopener noreferrer"} to route the event to a command.

Maintaining selection across data refreshes requires care. If the `ItemsSource` collection is replaced wholesale, the control clears its selection. Instead, use an `ObservableCollection` and add or remove items individually, which allows the control to preserve selection for items that remain in the list.


## Performance Considerations

Virtualization is only as effective as the item templates allow. A template with deeply nested panels, many bindings, or expensive converters runs during container recycling on the UI thread. If the template is slow to bind, scrolling will stutter even with virtualization engaged. Keep templates as shallow as possible and defer loading expensive content like images until after the initial layout pass using `x:Load` or opacity-based lazy loading.

Compiled bindings declared with `x:Bind` are significantly faster than classic `Binding` expressions because the binding code is generated at compile time rather than resolved through reflection at runtime. Use `x:Bind` in `DataTemplate` elements, and always specify `x:DataType` so the compiler can generate the binding accessors.

Avoid placing a `ListView` or `GridView` inside a `ScrollViewer`. When a collection control is inside a `ScrollViewer`, the outer scroll view expands to contain all items, and the inner virtualization panel never gets a constrained viewport. The result is that all items are realized at once and virtualization stops working. If the page layout requires scrolling content alongside a list, structure the layout so the collection control itself owns the scroll behavior through its built-in `ScrollViewer`.

`ObservableCollection` triggers a full re-layout of the items panel when many items are added rapidly in a loop, because each `Add` fires a separate `CollectionChanged` notification. For bulk updates, either use `AddRange` from a library that supports batch notifications, or reassign `ItemsSource` to a new list after building it, which triggers a single reset notification. The tradeoff is that reassigning the source causes the control to clear and rebuild visible items, which may cause a visible flicker in some layouts.

Finally, consider image memory when displaying photo-heavy collections. Binding directly to a URL string triggers the image pipeline to decode the full image. Set `DecodePixelWidth` and `DecodePixelHeight` on the `BitmapImage` to match the display size, reducing memory consumption significantly in dense grids.
