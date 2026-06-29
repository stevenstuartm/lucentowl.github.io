---
title: "WinUI 3 Layout System"
layout: guide
category: "WinUI 3"
subcategory: "WinUI Fundamentals"
description: "Understanding the WinUI 3 layout system including layout panels, the measure-arrange cycle, spacing and alignment, and building responsive adaptive layouts."
tags: [winui, winui-3, xaml, xaml-layout, responsive-design, desktop, fundamentals]
---

## Table of Contents

- [The Measure-Arrange Cycle](#the-measure-arrange-cycle)
- [Grid](#grid)
- [StackPanel](#stackpanel)
- [RelativePanel](#relativepanel)
- [Canvas](#canvas)
- [VariableSizedWrapGrid](#variablesizedwrapgrid)
- [Margin, Padding, and Alignment](#margin-padding-and-alignment)
- [Responsive Layout with VisualStateManager](#responsive-layout-with-visualstatemanager)
- [Choosing the Right Panel](#choosing-the-right-panel)

---

## The Measure-Arrange Cycle

Every time WinUI renders a window, it runs a two-pass layout algorithm that determines where each element ends up on screen. Understanding this cycle helps explain why layouts behave the way they do and how to avoid common pitfalls.

The first pass is the measure pass. Starting from the root element and working downward through the visual tree, each panel asks its children: "Given this much available space, how much space do you need?" Children report their desired size, which may be smaller than, equal to, or (in special cases) larger than the space offered. Panels use these reported sizes to make decisions about how to distribute available space among their children.

The second pass is the arrange pass. With desired sizes in hand, each panel positions its children within the space actually allocated to them, not necessarily the space they desired. A child that wanted 200 pixels of height might receive only 120 pixels if the panel has constraints to enforce. The child must render within whatever rectangle the parent allocates.

This two-pass system matters for a practical reason: it separates negotiation from commitment. During measure, elements can report their needs without yet knowing their final position. During arrange, parents make final placement decisions with full knowledge of all their children's needs. The result is a composable system where panels can be nested freely, each making locally correct decisions that add up to a globally correct layout.

When you set a fixed `Width` or `Height` on an element, you short-circuit part of this negotiation for that element. The element ignores the available space offered by the measure pass and reports its fixed size instead. This is sometimes intentional, but it also means the element will clip or overflow if the window shrinks below that size, which is why hardcoded dimensions are often better replaced with alignment and sizing constraints.

---

## Grid

Grid is the workhorse of WinUI layout. It divides space into rows and columns, and children occupy cells within that grid. Most complex UI compositions rely on one or more Grid panels at their core.

Rows and columns are defined using `RowDefinition` and `ColumnDefinition` elements, each accepting a `Height` or `Width` value. Three sizing modes control how those dimensions work:

- **Star sizing** (`*` or `2*`) distributes remaining space proportionally. A row with `Height="*"` gets whatever space is left after fixed and Auto rows are satisfied. Two star rows split the remainder equally; `*` and `2*` split it one-third and two-thirds.
- **Auto sizing** measures the tallest (or widest) child in that row (or column) and allocates exactly that much space, nothing more.
- **Pixel sizing** allocates a fixed number of device-independent pixels regardless of content or window size.

A typical app shell uses a combination: a fixed-height title bar row, an Auto-height toolbar row, a star-height content row that fills the remaining space, and a fixed-height status bar row at the bottom.

Children declare which cell they occupy using attached properties.

```xml
<Grid>
    <Grid.RowDefinitions>
        <RowDefinition Height="48"/>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="*"/>
        <RowDefinition Height="24"/>
    </Grid.RowDefinitions>

    <TitleBar Grid.Row="0"/>
    <Toolbar Grid.Row="1"/>
    <ContentArea Grid.Row="2"/>
    <StatusBar Grid.Row="3"/>
</Grid>
```

`RowSpan` and `ColumnSpan` allow a child to occupy multiple cells. An overlay panel that covers several columns, or a sidebar that spans multiple rows, uses these properties. The child still participates in the measure-arrange cycle normally; it simply receives the combined space of all cells it spans.

Grid is the right choice when your layout has a clear grid structure, when you need precise control over how space is divided, or when elements need to be positioned relative to each other across rows and columns. It handles both simple two-column forms and complex multi-region app shells with equal facility.

---

## StackPanel

StackPanel arranges children in a single line, either horizontally or vertically, by stacking them one after another. It is the simplest panel for ordered, linear arrangements.

The `Orientation` property controls the direction. `Vertical` (the default) stacks children top to bottom; `Horizontal` stacks them left to right. Children are given as much space as they need in the stacking direction and as much space as the panel itself has in the perpendicular direction.

The `Spacing` property adds uniform gaps between children without requiring each child to carry its own margin. Setting `Spacing="8"` inserts 8 pixels of space between every adjacent pair of children, which is far cleaner than individually setting `Margin="0,0,0,8"` on each child.

StackPanel works well for small, linear groups of related controls: a column of form fields, a row of action buttons, a list of labels. Where it breaks down is in scenarios requiring precise proportional sizing. StackPanel does not know the total available space in its stacking direction; it simply grows as large as its content demands. If you need a child to fill remaining space, StackPanel cannot express that. Grid with star sizing is the correct tool instead.

StackPanel also has no concept of wrapping. If a horizontal StackPanel's children exceed the available width, they overflow and clip rather than wrapping to a new line. For wrapping behavior, look at `ItemsWrapGrid` inside an `ItemsControl`, or the `VariableSizedWrapGrid` panel.

---

## RelativePanel

RelativePanel positions children relative to other named siblings or relative to the panel's own edges. Unlike Grid, which partitions space into cells, RelativePanel lets you express positional relationships directly: "this element should be to the right of that element" or "this element should align with the panel's right edge."

Children use attached properties from the `RelativePanel` class to declare their relationships.

```xml
<RelativePanel>
    <TextBlock x:Name="Label" Text="Name:"/>
    <TextBox x:Name="Input"
             RelativePanel.RightOf="Label"
             RelativePanel.AlignTopWith="Label"/>
    <Button Content="Submit"
            RelativePanel.Below="Input"
            RelativePanel.AlignRightWithPanel="True"/>
</RelativePanel>
```

RelativePanel is particularly useful for layouts that cannot be cleanly described as a grid. A floating action button anchored to the bottom-right corner, a label and value pair where the value wraps independently, or a set of controls that rearrange based on their content sizes are all good candidates. It also appears frequently inside `VisualStateManager` transitions, where elements need to reposition themselves relative to each other when the window width changes.

The main caveat is that RelativePanel can become difficult to reason about as the number of elements grows. When elements form a chain of dependencies, a single renaming or restructuring can break multiple relationships. For complex, grid-like layouts, Grid remains clearer and easier to maintain.

---

## Canvas

Canvas places children at absolute coordinates using `Canvas.Left` and `Canvas.Top` attached properties. It does not participate in the measure-arrange negotiation in any meaningful way for its children; each child is placed exactly where you tell it to go.

```xml
<Canvas Width="400" Height="300">
    <Ellipse Canvas.Left="50" Canvas.Top="80" Width="100" Height="100" Fill="Blue"/>
    <TextBlock Canvas.Left="60" Canvas.Top="120" Text="Label"/>
</Canvas>
```

Canvas is appropriate for drawing surfaces where coordinates are meaningful in themselves, such as a custom chart, a diagram editor, or a game-style overlay. It is also useful for UI overlays that need to appear at specific positions regardless of surrounding content, and for animating elements along explicit paths where coordinate control is necessary.

For general application layout, Canvas is the wrong choice. It does not respond to window resizing, does not reflow content, and places the burden of layout math entirely on the developer. An interface built primarily with Canvas will not scale to different screen sizes or DPI settings without significant additional code. Every other panel is a better default for general UI composition.

---

## VariableSizedWrapGrid

VariableSizedWrapGrid arranges children in a wrapping grid where each child can span multiple rows or columns. It is designed for tile-like interfaces where items have different sizes but need to flow together in a grid pattern.

Children declare how many cells they occupy using `VariableSizedWrapGrid.RowSpan` and `VariableSizedWrapGrid.ColumnSpan` attached properties. The panel fills cells from left to right, wrapping to the next row when a row is full, similar to how text wraps in a paragraph. Items that are too wide to fit on the current row start a new row automatically.

This panel appears most often inside `ScrollViewer` controls, where a collection of mixed-size tiles needs to flow and wrap as the collection grows. It works with `ItemsControl` via the `ItemsPanel` template when you want tile-based item layouts.

For collections with uniform-size items, `ItemsWrapGrid` inside an `ItemsControl` is generally simpler and more flexible. VariableSizedWrapGrid is the right choice specifically when items genuinely need to span different numbers of grid cells.

---

## Margin, Padding, and Alignment

Margin, padding, and alignment are the tools that fine-tune placement within whatever space a panel allocates. Getting these right is what separates layouts that feel polished from those that feel cramped or haphazard.

Margin is space outside an element's border. It pushes the element away from its neighbors or from its containing panel's edges. `Margin="16"` adds 16 pixels on all four sides. `Margin="16,8,16,8"` follows the CSS convention of left, top, right, bottom. Margin participates in the measure pass: a child with a 16-pixel margin reports its desired size as its content size plus 32 pixels (16 on each side), so the parent allocates space accordingly.

Padding is space inside an element's border, between the border and its content. It is a property of the element itself, not of its relationship to siblings. A `Button` with `Padding="12,8"` has 12 pixels of horizontal padding and 8 pixels of vertical padding inside the button boundary, pushing the content label inward. Not every element supports padding; panels and content controls do, but simple shapes and many primitives do not.

`HorizontalAlignment` and `VerticalAlignment` control how an element fills the space allocated to it by its parent. The options are `Stretch` (fills the allocated space), `Left`/`Top` (anchors to the near edge), `Right`/`Bottom` (anchors to the far edge), and `Center` (centers within the allocated space). The default for most elements is `Stretch`, which is why a `Button` placed directly in a `Grid` cell fills the entire cell unless you change its alignment.

The practical principle here is to avoid hardcoded widths and heights whenever possible. A button with `Width="120"` will look exactly right on a 1920x1080 display and awkward on a 3840x2160 display, or clipped on a small surface device. Using `HorizontalAlignment="Left"` and letting the button size to its content produces a more robust result. When a minimum size matters, prefer `MinWidth` over `Width`.

---

## Responsive Layout with VisualStateManager

WinUI applications run on devices ranging from small tablets to ultra-wide desktop monitors. VisualStateManager provides a structured way to redefine layout at different window sizes, without duplicating markup or writing imperative resize handlers.

Visual states are named configurations of property values. `AdaptiveTrigger` activates a state when the window width crosses a defined threshold. Inside each state, setters override the default values of properties on named elements.

```xml
<VisualStateManager.VisualStateGroups>
    <VisualStateGroup>
        <VisualState x:Name="NarrowLayout">
            <VisualState.StateTriggers>
                <AdaptiveTrigger MinWindowWidth="0"/>
            </VisualState.StateTriggers>
            <VisualState.Setters>
                <Setter Target="Sidebar.Visibility" Value="Collapsed"/>
                <Setter Target="ContentArea.(Grid.ColumnSpan)" Value="2"/>
            </VisualState.Setters>
        </VisualState>
        <VisualState x:Name="WideLayout">
            <VisualState.StateTriggers>
                <AdaptiveTrigger MinWindowWidth="720"/>
            </VisualState.StateTriggers>
            <VisualState.Setters>
                <Setter Target="Sidebar.Visibility" Value="Visible"/>
                <Setter Target="ContentArea.(Grid.ColumnSpan)" Value="1"/>
            </VisualState.Setters>
        </VisualState>
    </VisualStateGroup>
</VisualStateManager.VisualStateGroups>
```

States are evaluated from most specific to least specific within a group. The `MinWindowWidth="0"` state applies at any width, but `MinWindowWidth="720"` overrides it when the window is 720 pixels or wider. This means you define your narrow (default) layout as the base, then layer wider layouts on top. The approach is similar to mobile-first responsive design in CSS.

AdaptiveTrigger responds only to window width by default. For more complex conditions, such as checking a data property or responding to both width and height, you can implement `IStateTrigger` to create a custom trigger. Most common breakpoint scenarios, however, are handled well by AdaptiveTrigger alone.

A common pattern is to define three breakpoints: a narrow layout where panels collapse into a single column, a medium layout where a sidebar appears alongside the main content, and a wide layout where additional panels or expanded controls become visible. Each transition collapses or rearranges named elements using setters, keeping the logic declarative and easy to follow.

For rearrangements that involve changing a child's position within a Grid or RelativePanel, the setter syntax uses parentheses around the attached property name, as shown with `(Grid.ColumnSpan)` in the example above. This is a XAML quirk worth remembering: attached properties in setter targets require the parenthesized form.

---

## Choosing the Right Panel

No single panel fits every situation, but developing a mental model for when to reach for each one makes layout decisions faster and more confident.

Start with Grid when the layout has a two-dimensional structure, when elements need to be aligned across rows and columns, or when you need precise control over how space is divided. Grid should be your default for any non-trivial composition. It handles most layouts cleanly and scales well as requirements change.

Reach for StackPanel when you have a simple, ordered sequence of elements in one direction and do not need any element to fill remaining space proportionally. Button toolbars, vertical form fields, and small groups of related labels are all natural fits.

Use RelativePanel when elements need to position themselves relative to specific siblings rather than along a grid structure, or when you need the layout to reorganize based on sibling relationships during VisualState transitions.

Reserve Canvas for drawing surfaces and overlays where absolute positioning is inherent to the use case. Avoid it for anything that needs to respond to window size or content changes.

Use VariableSizedWrapGrid for tile interfaces where items span varying numbers of grid cells and need to wrap as a collection grows.

The most effective layouts often nest these panels. A Grid defines the major regions of the window. A StackPanel organizes the controls within a toolbar. A RelativePanel positions a floating action button within a content area. Each panel handles the aspect of layout it is designed for, and the composition does not force any single panel to solve problems it was not built to handle.

Panels are inexpensive to nest. The measure-arrange cycle handles deeply nested hierarchies without meaningful performance cost in typical UI scenarios, so prefer clarity of structure over attempts to flatten the visual tree. A layout that clearly expresses its structure in markup is easier to maintain and adapt than one that achieves a similar result through a single complex panel with many hacks.
