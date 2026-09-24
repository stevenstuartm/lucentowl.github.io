---
title: "Collection Controls in WinUI 3"
layout: guide
category: "WinUI 3"
subcategory: "Controls & UI"
description: "Displaying collections in WinUI 3: how UI virtualization works and what breaks it, choosing among ListView, GridView, ItemsView, TreeView, FlipView, and ItemsRepeater, item templates and template selectors, grouping, selection modes and click mode, and keeping scrolling smooth with phased rendering."
tags: [listview, gridview, itemsview, itemsrepeater, treeview, ui-virtualization, practical]
---

## UI Virtualization

A collection control shows each data item inside a **container**, a small piece of UI such as a `ListViewItem` that holds the item's template and draws its hover and selection states. A list of ten thousand orders doesn't need ten thousand containers, because only a screenful is visible at once. **UI virtualization** creates containers only for the items in or near the **viewport**, the visible part of the list. An item that has a container is said to be **realized**. "Near" is generous. `ItemsStackPanel`, for example, defaults to a `CacheLength` of 4, which buffers two viewports' worth of items on each side of the visible one. As the user scrolls, containers for items that leave the range are recycled. The control rebinds them to the items entering it instead of creating new ones, so memory stays roughly flat and scrolling stays responsive however long the list.

{% include figure.html id="winui-virtualization-recycling" %}

`ListView` and `GridView` virtualize through their default **items panels**, `ItemsStackPanel` and `ItemsWrapGrid`, which arrange their containers. `ItemsView` and `ItemsRepeater` virtualize through their layout objects. `TreeView` does not virtualize at all. `ItemsRepeater` virtualizes against the viewport of the `ScrollViewer` you wrap it in. `ListView`, `GridView`, and `ItemsView` scroll themselves, so their virtualization depends on their own size, and it silently stops when the control is given unlimited space in the scrolling direction:

- **A `StackPanel` or an `Auto`-sized `Grid` row.** Both measure their children with unlimited height, so a `ListView` inside grows to fit every item, has no scroll bar, and realizes them all.
- **An outer `ScrollViewer`.** Wrapping a `ListView` or `GridView` in another scroll viewer has the same effect. Let the collection control's own scrolling handle the list.
- **A replacement items panel.** If you change `ItemsPanel`, keep `ItemsStackPanel` or `ItemsWrapGrid`. Other panels can turn virtualization off.

Put a collection control in a star-sized `Grid` row, or give it a `Height` or `MaxHeight`.

{% include figure.html id="winui-unbounded-list" %}

## Choosing a Collection Control

| Control | What it gives you | Use it for |
| --- | --- | --- |
| `ListView` | A vertical, virtualized list with selection, click, grouping, drag-and-drop, and incremental loading built in | Text-focused lists read top to bottom, such as messages or search results |
| `GridView` | The same features as `ListView`, laid out in rows that wrap | Image-focused collections, such as galleries and product catalogs |
| `ItemsView` | Selection and invocation over a pluggable layout, with the layout switchable at run time while keeping the selection | Collections that switch between list, grid, and custom layouts |
| `TreeView` | Expandable, nested nodes with optional multi-select, without virtualization | Hierarchies, such as folders or categories |
| `FlipView` | One item at a time, with swipe, arrow-key, and button navigation | Small collections viewed one by one, such as a product's photos |
| `ItemsRepeater` | Virtualized layout of templated items and nothing else | A building block for a custom collection control |

For data in columns, like a table or spreadsheet, none of these fit well. Microsoft's `ListView` guidance points to the Community Toolkit's `DataGrid`, but the current Toolkit (version 8 and later) doesn't include a WinUI 3 `DataGrid`. The documented package targets UWP and Uno in Toolkit 7.1, so a WinUI 3 table means an older package, a third-party grid, or a `ListView` with a column-aligned template.

## ListView and GridView

`ListView` and `GridView` both derive from `ListViewBase`, so they share their properties, events, and behavior and differ only in default layout. Everything in this section applies to both.

### Populating the List

Items come either from the `Items` collection, declared in XAML or added in code, or from `ItemsSource`, bound to a collection. Use one or the other. With `ItemsSource` set, items declared in XAML are ignored and adding to `Items` from code throws.

Bind `ItemsSource` to an `ObservableCollection<T>` when the list changes after it's shown. The control listens for its change notifications and updates only what changed. A plain `List<T>` gives no notifications, so later additions never appear.

### Item Templates

A `DataTemplate` in `ItemTemplate` defines how each item looks. Its bindings evaluate against the item it's stamped out for. With `x:Bind` in a template, `x:DataType` must name the item type.

```xml
<ListView ItemsSource="{x:Bind ViewModel.Orders, Mode=OneWay}"
          SelectedItem="{x:Bind ViewModel.SelectedOrder, Mode=TwoWay}">
    <ListView.ItemTemplate>
        <DataTemplate x:DataType="models:Order">
            <StackPanel Padding="0,8">
                <TextBlock Text="{x:Bind OrderNumber}" Style="{StaticResource BodyStrongTextBlockStyle}" />
                <TextBlock Text="{x:Bind CustomerName}" Foreground="{ThemeResource TextFillColorSecondaryBrush}" />
            </StackPanel>
        </DataTemplate>
    </ListView.ItemTemplate>
</ListView>
```

Without a template, each item displays its `ToString()` result, or the property named by `DisplayMemberPath`.

When one collection holds items that need different visuals, such as sent and received messages in a chat, derive from `DataTemplateSelector`, override `SelectTemplateCore`, and assign the selector to `ItemTemplateSelector` instead of setting `ItemTemplate`:

```csharp
public partial class MessageTemplateSelector : DataTemplateSelector
{
    public DataTemplate SentTemplate { get; set; }
    public DataTemplate ReceivedTemplate { get; set; }

    protected override DataTemplate SelectTemplateCore(object item)
        => ((ChatMessage)item).IsSent ? SentTemplate : ReceivedTemplate;

    protected override DataTemplate SelectTemplateCore(object item, DependencyObject container)
        => SelectTemplateCore(item);
}
```


```xml
<Page.Resources>
    <local:MessageTemplateSelector x:Key="MessageSelector"
        SentTemplate="{StaticResource SentMessageTemplate}"
        ReceivedTemplate="{StaticResource ReceivedMessageTemplate}" />
</Page.Resources>

<ListView ItemsSource="{x:Bind ViewModel.Messages}"
          ItemTemplateSelector="{StaticResource MessageSelector}" />
```

A selector has a cost under virtualization. A recycled container can be reused only for an item that needs the same template, and the control checks just five recycled candidates for a match. When the templates are unevenly mixed through the list, the control keeps creating new containers during scrolling, which gives back much of what virtualization saves. The `ChoosingItemContainer` event lets you manage a pool of containers per template yourself, and Microsoft calls it the faster option. When the items differ only in a detail, such as an icon, one template that binds that detail avoids the problem entirely.

### Item Layout

The control wraps each item in a container (`ListViewItem` or `GridViewItem`) that provides selection visuals and hover states, and the `ItemsPanel` lays out the containers. `ListView` uses `ItemsStackPanel`, which stacks items vertically. `GridView` uses `ItemsWrapGrid`, which places items left to right and wraps to a new row. Change either through an `ItemsPanelTemplate`:

```xml
<GridView ItemsSource="{x:Bind ViewModel.Photos}">
    <GridView.ItemsPanel>
        <ItemsPanelTemplate>
            <ItemsWrapGrid Orientation="Horizontal" MaximumRowsOrColumns="4" />
        </ItemsPanelTemplate>
    </GridView.ItemsPanel>
</GridView>
```

A horizontal `ListView` needs an `ItemsStackPanel` with `Orientation="Horizontal"`, and its internal scroll viewer switched from vertical to horizontal scrolling. The default `ListView` style disables horizontal scrolling, so set all four attached properties:

```xml
<ListView ScrollViewer.HorizontalScrollMode="Enabled"
          ScrollViewer.HorizontalScrollBarVisibility="Auto"
          ScrollViewer.VerticalScrollMode="Disabled"
          ScrollViewer.VerticalScrollBarVisibility="Hidden">
    <ListView.ItemsPanel>
        <ItemsPanelTemplate>
            <ItemsStackPanel Orientation="Horizontal" />
        </ItemsPanelTemplate>
    </ListView.ItemsPanel>
</ListView>
```

Style the item containers, for example to set padding or a minimum size, with `ItemContainerStyle`.

### Grouping

To show grouped data with headers, bind through a `CollectionViewSource` with `IsSourceGrouped="True"`. Its `Source` is a collection of groups, where each group is itself a collection of items with a key, such as the result of LINQ's `GroupBy` materialized with `ToList()`. `GroupStyle.HeaderTemplate` defines how each group header renders.

```xml
<Page.Resources>
    <CollectionViewSource x:Name="OrdersByStatus"
                          Source="{x:Bind ViewModel.GroupedOrders}"
                          IsSourceGrouped="True" />
</Page.Resources>

<ListView ItemsSource="{x:Bind OrdersByStatus.View}">
    <ListView.GroupStyle>
        <GroupStyle>
            <GroupStyle.HeaderTemplate>
                <DataTemplate>
                    <TextBlock Text="{Binding Key}" Style="{StaticResource SubtitleTextBlockStyle}" />
                </DataTemplate>
            </GroupStyle.HeaderTemplate>
        </GroupStyle>
    </ListView.GroupStyle>
</ListView>
```

With grouping, `ItemsPanel` lays out the groups, not the items inside them.

### Selection and Click

`SelectionMode` and `IsItemClickEnabled` together decide how the user interacts with items:

| Interaction | Settings | Event | Read the result from |
| --- | --- | --- | --- |
| Display only | `SelectionMode="None"` | None | Nothing |
| One item at a time (the default) | `SelectionMode="Single"` | `SelectionChanged` | `SelectedItem`, `SelectedIndex` |
| Any number, each click toggles | `SelectionMode="Multiple"` | `SelectionChanged` | `SelectedItems` |
| Click selects one, Ctrl and Shift extend | `SelectionMode="Extended"` | `SelectionChanged` | `SelectedItems` |
| Items act like buttons | `SelectionMode="None"`, `IsItemClickEnabled="True"` | `ItemClick` | `ItemClickEventArgs.ClickedItem` |

`Multiple` mode shows a check box on each item. `Extended` behaves like `Single` until the user holds Ctrl to add items or Shift to select a range. With click enabled alongside a selection mode, `ItemClick` fires first. If its handler navigates away, `SelectionChanged` may never fire.

`SelectedItem`, `SelectedIndex`, and `SelectedItems` stay in sync. In multi-select modes, `SelectedItem` is the first item selected. Setting `SelectedIndex` out of range throws, while setting `SelectedItem` to something not in the list is ignored.

`SelectionChanged` reports what changed through `e.AddedItems` and `e.RemovedItems`, which hold at most one item each unless the user Shift-selects a range. Binding `SelectedItem` two-way to a view model property is the simpler route for single selection. `SelectedItems` is read-only and can't be bound, so for multi-selection handle `SelectionChanged` and copy the changes into the view model, or route the event to a command with an event-to-command behavior.

To select or clear many items from code, use `SelectAll`, `SelectRange`, and `DeselectRange` rather than editing `SelectedItems` one item at a time. The range methods work by index, so virtualized items stay virtualized, and each call raises `SelectionChanged` once. `SelectAll` and `SelectRange` throw unless `SelectionMode` is `Multiple` or `Extended`. There's no deselect-all method. Call `DeselectRange` with a range covering the whole list.

Setting `CanReorderItems` and `AllowDrop` to `true` lets users drag items to reorder them. With an `ObservableCollection` as the source, the control applies each move to the collection as a `Remove` followed by an `Add`, so code watching `CollectionChanged` sees both. Built-in reordering doesn't work on grouped lists. Dragging items between two lists or out to other apps goes through the general drag-and-drop events.

## ItemsView

`ItemsView` is a newer collection control built from `ItemsRepeater`, `ItemContainer`, and `ScrollView`, a newer scrolling control distinct from the `ScrollViewer` inside `ListView`. It covers most of what `ListView` and `GridView` do, with virtualization, selection, keyboard and pointer input, and accessibility built in. Its layout is a replaceable object rather than a fixed items panel, so the same `ItemsView` can switch from a list to a grid at run time without losing its selection.

```xml
<ItemsView ItemsSource="{x:Bind ViewModel.Photos}" SelectionMode="Multiple">
    <ItemsView.Layout>
        <LinedFlowLayout LineHeight="160" LineSpacing="4" MinItemSpacing="4" />
    </ItemsView.Layout>
    <ItemsView.ItemTemplate>
        <DataTemplate x:DataType="models:Photo">
            <ItemContainer AutomationProperties.Name="{x:Bind Title}">
                <Image Source="{x:Bind Thumbnail}" Stretch="UniformToFill" />
            </ItemContainer>
        </DataTemplate>
    </ItemsView.ItemTemplate>
</ItemsView>
```

A few differences from `ListView` matter in practice:

- **The template's root must be an `ItemContainer`.** Any other root throws. `ItemContainer` draws the selection and hover visuals that `ListViewItem` draws for a `ListView`.
- **Three layouts ship with it.** `StackLayout` (the default) gives a list. `UniformGridLayout` gives a grid of equal cells. `LinedFlowLayout` gives rows of equal height with items of varying width, suited to photos of mixed aspect ratios.
- **There is no `Items` collection.** Content comes only from `ItemsSource`.
- **Clicking uses different names.** `IsItemInvokedEnabled` and `ItemInvoked` replace `IsItemClickEnabled` and `ItemClick`.
- **Selection methods ignore `SelectionMode`.** `Select`, `Deselect`, `SelectAll`, and `InvertSelection` work in any mode. `SelectAll` followed by `InvertSelection` clears the selection.

Microsoft's `ItemsView` guidance doesn't cover grouping or incremental loading, and `x:Phase` rendering works only in `ListView` and `GridView`. For grouped lists, data that loads as the user scrolls, or templates heavy enough to need phasing, `ListView` and `GridView` remain the documented route.

## TreeView

`TreeView` shows nested data as nodes that expand and collapse. Build it in one of two ways. Bind `ItemsSource` to your own hierarchical objects and put a `TreeViewItem` in the template, binding its `ItemsSource` to each object's children. Or create `TreeViewNode` objects yourself and add them to `RootNodes`, with each node's data in `Content`.

```xml
<TreeView ItemsSource="{x:Bind ViewModel.RootFolders}" SelectionMode="Single">
    <TreeView.ItemTemplate>
        <DataTemplate x:DataType="models:FolderNode">
            <TreeViewItem ItemsSource="{x:Bind Children}" Content="{x:Bind Name}" />
        </DataTemplate>
    </TreeView.ItemTemplate>
</TreeView>
```

Selection is off by default. `SelectionMode` accepts `None`, `Single`, and `Multiple`. In `Multiple` mode each node gets a check box, and checking a parent checks all its children. A parent whose children are partly selected shows an indeterminate check box. Only realized nodes are affected. `SelectAll` selects just the nodes created so far, and the children of a selected parent become selected as they are realized. Read the selection from `SelectedNodes`, or from `SelectedItem` and `SelectedItems` for the data objects.

`TreeView` doesn't virtualize, so every realized node keeps its UI. For large or expensive hierarchies, such as a file system, load children only when a node opens. With the node-based approach, set `HasUnrealizedChildren = true` on a node so it shows an expand chevron with no children yet, then add the children in the `Expanding` event handler. Removing them again in `Collapsed` keeps memory down for big trees.

`ItemInvoked` fires when the user invokes a node, treating it like a button instead of selecting it, which suits trees that navigate or open files. `CanDragItems` and `CanReorderItems` default to `true` on `TreeView`, unlike `ListView`, so users can drag nodes to rearrange them within the tree unless you set both to `false`. `DragItemsStarting` and `DragItemsCompleted` report each drag. Moving nodes between two trees takes app code. `AllowDrop` only makes a tree a drop target, and the app handles `DragOver` and `Drop` to create the node in the target and removes it from the source when the drag completes.

## FlipView

`FlipView` shows one item at a time. Users swipe on touch, use the arrow keys, or click the navigation buttons that appear when a mouse hovers. It flips horizontally by default, and a vertical `VirtualizingStackPanel` as its `ItemsPanel` makes it flip vertically.

```xml
<FlipView x:Name="Gallery" ItemsSource="{x:Bind ViewModel.PhotoUrls}" Height="300">
    <FlipView.ItemTemplate>
        <DataTemplate x:DataType="x:String">
            <Image Source="{x:Bind}" Stretch="Uniform" />
        </DataTemplate>
    </FlipView.ItemTemplate>
</FlipView>
<PipsPager NumberOfPages="{x:Bind ViewModel.PhotoUrls.Count}"
           SelectedPageIndex="{x:Bind Gallery.SelectedIndex, Mode=TwoWay}"
           HorizontalAlignment="Center" />
```

Microsoft recommends it for collections of up to about 25 items, because flipping through more gets tedious. The exception is a photo album, which typically opens a flip view from a grid of thumbnails. Pair it with a position indicator. A `PipsPager` bound to `SelectedIndex` works for small sets, and for 10 or more items Microsoft recommends a film strip of thumbnails.

## ItemsRepeater

`ItemsRepeater` is a building block rather than a finished control. It turns a collection into templated elements, arranges them with a layout, and virtualizes them. It has no control template of its own, no selection, no item containers, and no default styling. Its keyboard support is limited to arrow-key focus movement, and it provides no built-in accessibility experience. Use it inside a custom collection control, or wherever you need a layout that the other controls can't produce. Microsoft recommends it over the older `ItemsControl` even for simple repeated content, because `ItemsControl` doesn't virtualize.

It doesn't scroll on its own. Put it inside a `ScrollViewer`.

```xml
<ScrollViewer>
    <ItemsRepeater ItemsSource="{x:Bind ViewModel.Cards}">
        <ItemsRepeater.Layout>
            <UniformGridLayout MinItemWidth="200" MinItemHeight="120"
                               MinRowSpacing="12" MinColumnSpacing="12"
                               ItemsStretch="Fill" />
        </ItemsRepeater.Layout>
        <ItemsRepeater.ItemTemplate>
            <DataTemplate x:DataType="models:Card">
                <Border Padding="16" CornerRadius="8"
                        Background="{ThemeResource CardBackgroundFillColorDefaultBrush}">
                    <TextBlock Text="{x:Bind Title}" />
                </Border>
            </DataTemplate>
        </ItemsRepeater.ItemTemplate>
    </ItemsRepeater>
</ScrollViewer>
```

Its documentation covers `StackLayout` (the default, vertical) and `UniformGridLayout`. For anything else, such as a masonry layout, derive from `VirtualizingLayout`. It has no `ItemTemplateSelector` property, so a `DataTemplateSelector` goes directly in `ItemTemplate`. Because it presents only the template, items get no padding, hover states, or selection visuals unless the template adds them.

Recycling changes how per-item setup works:

- **Lifecycle events replace `Loaded` and `Unloaded`.** A recycled element may never leave the visual tree, so those events aren't reliable. `ElementPrepared` fires when an element is readied for an item, whether new or recycled. `ElementClearing` fires when it goes back to the recycle pool, and `ElementIndexChanged` when its item's index changes, such as when an item before it is added or removed.
- **Resets are cheaper with stable keys.** Replacing the whole collection (a `Reset` notification) normally rebuilds everything from the top. If the source implements `IKeyIndexMapping`, the repeater matches existing elements to items by key and keeps the scroll position.
- **Incremental loading doesn't apply.** `ISupportIncrementalLoading` has no effect on `ItemsRepeater`. Watch the `ScrollViewer`'s `ViewChanged` event and load more when the viewport nears the end.

## Keeping Scrolling Smooth

Virtualization caps how many elements exist, but every container that scrolls into view still has to be rebound on the UI thread. A heavy template stutters even with virtualization working.

- **Keep templates small.** Each element in a template is multiplied by every realized item. Flatten nested panels and prefer a single `Grid` over panels inside panels.
- **Use `x:Bind` in item templates.** Compiled bindings avoid the reflection that `{Binding}` uses at run time, and they are required for phasing.
- **Phase the template.** In a `ListView` or `GridView`, `x:Phase` on an element defers its binding to a later pass. The control renders phase 0 for every visible item first, so fast scrolling shows at least the item titles, and it fills in later phases as time allows. Elements waiting for their phase stay hidden, so recycled containers don't flash stale data. Until phase 0 renders, `ShowsScrollingPlaceholders`, on by default, draws a gray placeholder for each item. The `ContainerContentChanging` event gives the same control from code. Phasing works only in `ListViewBase` controls and only on `x:Bind` bindings.
- **Size decoded images to their display size.** An image decoded at full resolution for a 64-pixel thumbnail wastes memory in every realized item.
- **Batch large updates.** Each `Add` to an `ObservableCollection` raises a separate change notification. Build large sets before binding them, or load them through a pattern designed for batches.