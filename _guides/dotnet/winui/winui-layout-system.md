---
title: "WinUI 3 Layout System"
layout: guide
category: "WinUI 3"
subcategory: "WinUI Fundamentals"
description: "How WinUI 3 sizes and positions elements: effective pixels, the measure and arrange passes, margin, padding, and alignment within a layout slot, the built-in and Community Toolkit panels and when to use each, and adaptive layouts with VisualStateManager and AdaptiveTrigger."
tags: [xaml-layout, layout-panels, measure-arrange, effective-pixels, visual-state-manager, responsive-design, fundamentals]
---

## Effective Pixels

Every size and position in WinUI, from `Width="120"` to `Margin="16"`, is in **effective pixels** (epx), not physical pixels. Windows gives each display a scale factor based on its pixel density and typical viewing distance, and WinUI multiplies every epx value by it. A 120 epx button is 120 physical pixels wide at 100% scaling and 240 at 200%, so it looks the same size on a laptop screen and on a 4K monitor.

A fixed size is therefore not a DPI problem, because it scales with the display. Its problem is that it doesn't adapt to the window or to the content. A fixed-width button clips its label when the text grows, whether from translation into a longer language or from the user's text-size setting.

Microsoft's guidance is to keep sizes, margins, and padding in multiples of 4 epx. Scale factors move in steps of 25% (100%, 125%, 150%, and so on), and 4 epx times any of them is a whole number of physical pixels, so those values render sharply. Text sizes are exempt.

---

## The Measure and Arrange Passes

WinUI positions elements in two passes over the element tree. A **panel** is an element whose job is to size and place its children, such as a `Grid` or a `StackPanel`, and every panel takes part in both passes.

In the **measure** pass, the window offers its size to the root element, and from there each panel calls `Measure` on each of its children, passing the space it can offer. Each child works out how much it needs, measuring its own children first if it has any, and reports that as its `DesiredSize`. A panel can offer infinite space in a direction, which tells the child it can be as large as it likes that way.

In the **arrange** pass, which starts once measuring is done, each panel calls `Arrange` on each child with a final rectangle, its **layout slot**. The panel decides the slot from the desired sizes, its own rules, and the space it was given. A child that asked for 200 epx of height can receive 120 if that is all there is, and it then draws within 120 and is clipped.

{% include figure.html id="winui-measure-arrange" %}

The split lets panels nest freely. Measuring asks what each element needs before anything is placed, and arranging places everything once all the needs are known. When something changes, WinUI runs the passes again, and it can skip straight to arrange when only a property that affects placement, such as `HorizontalAlignment`, changed. Layout runs asynchronously. Setting `Width` doesn't update `ActualWidth` on the next line. `ActualWidth` and `ActualHeight` hold an element's final size only after the next layout pass, when its `SizeChanged` event fires. Code that needs a rendered size reads it in a `SizeChanged` or `Loaded` handler. `Width` and `Height` are only requests, and they read as `NaN` when unset.

---

## Sizing and Placing an Element

Within its layout slot, an element's size and position come from four groups of properties on `FrameworkElement` and its subclasses.

**Size.** `Width` and `Height` request a size. `MinWidth`, `MaxWidth`, `MinHeight`, and `MaxHeight` bound it while leaving it fluid, which usually serves better than a fixed value.

**Margin** is empty space outside the element. `Margin="20"` applies 20 epx on every side, and `Margin="0,10,5,25"` applies left, top, right, and bottom, in that order. The parent leaves room for the margin inside the element's slot, but the margin isn't part of the element. It isn't included in `ActualWidth`, and clicks on it don't reach the element. Margins between neighbors add up, so two adjacent elements with 10 epx margins sit 20 epx apart.

**Padding** is space inside the element, between its edge or border and its content. Unlike margin, it isn't defined on every element. `Control`, `Border`, `Grid`, `StackPanel`, `RelativePanel`, and `TextBlock` each have a `Padding` property, and `Canvas` and shapes don't. `Grid`, `StackPanel`, and `RelativePanel` also have their own `BorderBrush`, `BorderThickness`, and `CornerRadius`, so they don't need to be wrapped in a `Border` to draw one.

**Alignment.** `HorizontalAlignment` (`Left`, `Center`, `Right`, `Stretch`) and `VerticalAlignment` (`Top`, `Center`, `Bottom`, `Stretch`) decide where the element sits when its slot is bigger than it needs. `Stretch` is the default and fills the slot. Two things override it. Setting an explicit `Width` or `Height` cancels `Stretch` in that direction, and the element is centered instead. And many controls change the default in their style. A `Button` defaults to `Left` and `Center`, so a button in a `Grid` cell sizes to its content rather than filling the cell, while a `Border` or `Rectangle` in the same cell fills it.

{% include figure.html id="winui-layout-slot" %}

When content is larger than the space it gets, alignment decides which side is clipped. A `Left`-aligned element that is too wide loses its right edge.

---

## The Layout Panels

Children tell their parent panel how they want to be placed through attached properties such as `Grid.Row`, and only the immediate parent reads them. Panels differ in how they position children and in how they treat a child's `Stretch` alignment, and those two rules decide which panel fits a layout.

### Grid

`Grid` divides its space into rows and columns, and each child occupies a cell. It is the usual root of a page's layout because it can express most arrangements, and it's the panel whose sizing rules take the most practice.

Each `RowDefinition` height and `ColumnDefinition` width takes one of three kinds of value:

- **A number** (`Height="44"`) is a fixed size in epx.
- **`Auto`** sizes the row to the largest child in it. To find that size, the `Grid` measures the row's children with unlimited height, or a column's with unlimited width.
- **Star** (`*`, `2*`) shares whatever space the fixed and `Auto` rows leave. `*` and `2*` split it one-third and two-thirds. A definition with no size is `*`.

Row and column definitions also accept `MinHeight`, `MaxHeight`, `MinWidth`, and `MaxWidth`. A typical window layout uses all three kinds of size:

```xml
<Grid>
    <Grid.RowDefinitions>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="*"/>
        <RowDefinition Height="28"/>
    </Grid.RowDefinitions>

    <TitleBar Grid.Row="0" Title="Contoso"/>
    <CommandBar Grid.Row="1"/>
    <Frame Grid.Row="2" x:Name="ContentFrame"/>
    <TextBlock Grid.Row="3" Text="Ready" Margin="12,4"/>
</Grid>
```

The title bar and command bar rows take their controls' heights, the content frame gets everything left over, and the status row is fixed at the bottom. As the window grows taller, only the star row changes. (The `TitleBar` control replaces the system title bar only when the window extends its content into the title bar area, which is set up on the window.) `Grid.RowSpan` and `Grid.ColumnSpan` let a child cover several cells, and `RowSpacing` and `ColumnSpacing` add gaps between them.

A `Grid` respects `Stretch`, so a child with no size set fills its cell. It clips content larger than the panel and holds its children to its own bounds. Several children in the same cell overlap, with later children drawn on top. A single-cell `Grid`, with no row or column definitions, is the efficient way to layer elements, such as text centered over an image.

### StackPanel

`StackPanel` places its children in one line, vertically by default or horizontally with `Orientation="Horizontal"`. `Spacing` adds an even gap between children without giving each one a margin.

In the stacking direction the panel offers each child infinite space, so a child gets exactly the size it asks for. In the other direction it respects `Stretch`, so the children of a vertical stack fill its width. It suits short, linear groups: a row of buttons, a column of form fields, a label beside its value. It never wraps, and children beyond its edge are clipped.

The infinite space has two consequences that catch people. A child can't fill the remaining height of a vertical stack, because the stack has no remaining height to give. That layout needs a `Grid` with a star row. And a scrolling control can't scroll inside one. A `ListView` or `ScrollViewer` in a vertical `StackPanel` measures itself as tall as all of its content, never shows a scroll bar, and runs off the bottom of the window. A `ListView` in that position also loses virtualization, the optimization that creates elements only for the items on screen, so it creates every item up front. An `Auto` row in a `Grid` has the same effect, because it also measures with unlimited height. Put a scrolling control in a star-sized `Grid` row, where the `Grid` gives it a finite height, or set its `MaxHeight`.

{% include figure.html id="winui-unbounded-list" %}

### RelativePanel

`RelativePanel` places each child in relation to the panel's edges or to named siblings, using attached properties in three families:

| Family | Examples | Meaning |
| --- | --- | --- |
| Panel alignment | `AlignTopWithPanel`, `AlignRightWithPanel`, `AlignHorizontalCenterWithPanel` | Line an edge or center up with the panel's |
| Sibling alignment | `AlignLeftWith`, `AlignBottomWith`, `AlignVerticalCenterWith` | Line an edge or center up with a named sibling's |
| Sibling position | `Above`, `Below`, `LeftOf`, `RightOf` | Place next to a named sibling |

```xml
<RelativePanel>
    <TextBlock x:Name="NameLabel" Text="Name"/>
    <TextBox x:Name="NameBox"
             RelativePanel.Below="NameLabel"
             RelativePanel.AlignLeftWithPanel="True"
             RelativePanel.AlignRightWithPanel="True"/>
    <Button Content="Submit"
            RelativePanel.Below="NameBox"
            RelativePanel.AlignRightWithPanel="True"/>
</RelativePanel>
```

A child with no relationship sits in the top-left corner. Relationships on one child combine, so `Below` plus `AlignRightWithPanel` puts the button under the text box at the panel's right edge. `RelativePanel` ignores `Stretch` unless two relationships pin opposite edges, as the text box above is pinned to both sides of the panel and so stretches between them.

Its strength is layouts that rearrange at different window sizes. Moving the text box beside its label, for example, means replacing its `Below` relationship with `RightOf` and `AlignVerticalCenterWith`, a few property changes where a `Grid` would need its rows and columns reworked. Its cost is that a long chain of relationships becomes hard to follow, and renaming one element breaks every relationship that names it.

### Canvas

`Canvas` places each child at the coordinates in its `Canvas.Left` and `Canvas.Top` attached properties. It does no sizing. `Stretch` is ignored, and a child without an explicit size is its content size. It doesn't clip children that extend past it, and `Canvas.ZIndex` changes which children draw on top.

`Canvas` fits content whose coordinates mean something, such as a diagram editor, a drawing surface, or a chart drawn from data. For ordinary UI it is the wrong panel, because nothing in it responds to the window's size.

### VariableSizedWrapGrid

`VariableSizedWrapGrid` places children in cells of equal size and wraps to a new column when it runs out of room. Its default orientation is `Vertical`, which fills a column top to bottom before starting the next. `MaximumRowsOrColumns` sets how many cells a column holds before it wraps. `ItemWidth` and `ItemHeight` set the cell size, or the first child's size sets it for all. A child can cover several cells with the `VariableSizedWrapGrid.RowSpan` and `ColumnSpan` attached properties, which makes the panel suited to tile layouts with a few larger tiles.

List controls such as `ListView` and `GridView` use their own **items panels**, including `ItemsStackPanel` and `ItemsWrapGrid`, which lay out the list's items. Those panels work only inside a list and can't be used for general layout.

### Toolkit Panels

The [Windows Community Toolkit](https://learn.microsoft.com/en-us/dotnet/communitytoolkit/windows/){:target="_blank" rel="noopener noreferrer"} adds panels that WinUI doesn't include, in the `CommunityToolkit.WinUI.Controls.Primitives` package under the `CommunityToolkit.WinUI.Controls` namespace:

- **`WrapPanel`** places children in a line and wraps to the next line at the panel's edge, which suits tags, chips, and other items of varying width. `HorizontalSpacing` and `VerticalSpacing` set the gaps.
- **`DockPanel`** docks each child to an edge with `DockPanel.Dock`, and the last child fills what is left, the arrangement WPF and Windows Forms developers know.
- **`UniformGrid`** divides its space into equal cells, useful for dashboards and button pads.

```xml
<Page xmlns:controls="using:CommunityToolkit.WinUI.Controls" ...>
    <controls:DockPanel>
        <CommandBar controls:DockPanel.Dock="Top"/>
        <TextBlock controls:DockPanel.Dock="Bottom" Text="Ready"/>
        <Frame x:Name="ContentFrame"/>
    </controls:DockPanel>
</Page>
```

### Choosing a Panel

| Panel | Use it for | Avoid it for |
| --- | --- | --- |
| `Grid` | Page structure, forms with aligned columns, anything that fills the window, layering | Rarely the wrong choice |
| `StackPanel` | Short runs of controls in one direction | A child that must fill remaining space, or a scrolling list |
| `RelativePanel` | Layouts that rearrange at different window sizes | Large layouts with long chains of relationships |
| `Canvas` | Drawing surfaces and coordinate-based content | General UI |
| `VariableSizedWrapGrid` | A fixed set of tiles, some spanning several cells | Large or data-bound collections, which belong in a list control |
| Toolkit `WrapPanel` | Items of varying width that should reflow | Very long collections |
| Toolkit `DockPanel` | Edge-docked chrome around one content area | Anything a star-sized `Grid` already expresses simply |

Real layouts nest panels: a `Grid` for the page's regions, a `StackPanel` for a row of buttons inside one of them. Nesting has a cost that matters mainly inside the template a list repeats for every item, where one panel fewer per item adds up. When no panel fits, a custom panel derives from `Panel` and overrides `MeasureOverride` and `ArrangeOverride`, which are its side of the two passes above.

---

## Adaptive Layout with VisualStateManager

A layout that works at 1400 epx wide can fall apart at 500. Panels handle small changes by stretching and wrapping, but a large change, such as collapsing a side pane or moving a label above its field, needs a different set of property values. `VisualStateManager` holds those sets as named **visual states** and switches between them.

A visual state contains setters that change properties on named elements. A visual state group holds states that exclude each other, and only one state per group is active at a time. There are two ways to choose it.

### State Triggers

A **state trigger** in markup activates its state when a condition holds. `AdaptiveTrigger` activates when the app's window is at least `MinWindowWidth` wide, at least `MinWindowHeight` tall, or both when both are set.

```xml
<Page ...>
    <Grid>
        <VisualStateManager.VisualStateGroups>
            <VisualStateGroup>
                <VisualState x:Name="Wide">
                    <VisualState.StateTriggers>
                        <AdaptiveTrigger MinWindowWidth="640"/>
                    </VisualState.StateTriggers>
                    <VisualState.Setters>
                        <Setter Target="Sidebar.Visibility" Value="Visible"/>
                        <Setter Target="ContentArea.(Grid.Column)" Value="1"/>
                        <Setter Target="ContentArea.(Grid.ColumnSpan)" Value="1"/>
                    </VisualState.Setters>
                </VisualState>
            </VisualStateGroup>
        </VisualStateManager.VisualStateGroups>

        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="280"/>
            <ColumnDefinition Width="*"/>
        </Grid.ColumnDefinitions>
        <StackPanel x:Name="Sidebar" Visibility="Collapsed"/>
        <Frame x:Name="ContentArea" Grid.ColumnSpan="2"/>
    </Grid>
</Page>
```

The markup outside the states is the narrow layout, with the sidebar collapsed and the content spanning both columns. At 640 epx and wider the `Wide` state applies its setters. Below that they're removed and the markup's own values return, so the narrow layout needs no state of its own. For another breakpoint, add a state to the group with a larger threshold.

When several triggers in a group are active at once, a custom trigger outranks an `AdaptiveTrigger` met by its width, which outranks one met by its height. Among triggers that still tie, the first declared wins.

Microsoft's design guidance puts its breakpoints at 640 and 1008 epx, dividing windows into small, medium, and large, and suggests 12 epx gutters in small windows and 24 epx above that. The thresholds compare against the app's window, not the screen, since a window on a large monitor can still be narrow.

Three details trip people up:

- **Where the groups go.** Triggers only run automatically when `VisualStateManager.VisualStateGroups` is set on the root element inside the `Page`, the `Grid` above, not on the `Page` itself.
- **Attached properties in setters** need parentheses around the attached property's name, as in `ContentArea.(Grid.Column)`.
- **Collapsed isn't unloaded.** An element with `Visibility="Collapsed"` takes no space but is still created at startup. For large sections shown only in some states, the `x:Load` attribute defers creating them until they're needed.

For a condition `AdaptiveTrigger` can't express, derive a custom trigger from `StateTriggerBase` and call its `SetActive` method when the condition changes. `StateTrigger`, which is active while its `IsActive` property is true, covers the simple case of binding a state to a Boolean.

### GoToState from Code

`VisualStateManager.GoToState(this, "Wide", false)` switches to a state directly. The first argument is a `Control`, usually the `Page` or a `UserControl`, whose root element holds the state groups. The last argument says whether to play any transition animations the states define, and `false` switches instantly. `GoToState` is the older mechanism, and it is still the right one when the condition is something only code knows.

The main case is size that isn't the window's. `AdaptiveTrigger` measures only the window, so a layout inside a resizable pane or one side of a split view can't use it. Make that pane a `UserControl` with its own state groups, handle its `SizeChanged` event, and call `GoToState` on it there. Controls use the same call to switch between their own states, such as pressed and disabled.
