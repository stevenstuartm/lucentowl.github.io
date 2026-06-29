---
title: "Text, Status, and Information Controls"
layout: guide
category: "WinUI 3"
subcategory: "Controls & UI"
description: "Displaying text, progress, status messages, and date/time selection in WinUI 3 using TextBlock, RichTextBlock, ProgressBar, InfoBar, and date/time picker controls."
tags: [winui, winui-3, xaml, controls, ui-framework, desktop, practical]
---

## Table of Contents

- [TextBlock](#textblock)
- [RichTextBlock](#richtextblock)
- [ProgressBar](#progressbar)
- [ProgressRing](#progressring)
- [InfoBar](#infobar)
- [Tooltip](#tooltip)
- [CalendarDatePicker](#calendardatepicker)
- [CalendarView](#calendarview)
- [DatePicker and TimePicker](#datepicker-and-timepicker)
- [Choosing the Right Feedback Control](#choosing-the-right-feedback-control)

---

## TextBlock

`TextBlock` is the standard control for displaying read-only text in WinUI 3. It is lightweight and renders efficiently, making it the default choice for labels, headings, body copy, and any static text that does not need editing.

At its simplest, `TextBlock` takes a `Text` property:

```xml
<TextBlock Text="Hello, World!" FontSize="24" FontWeight="Bold" />
```

For more nuanced formatting within a single block, `TextBlock` supports inline elements placed inside its `Inlines` collection. You can mix `Run` elements with `Bold`, `Italic`, `Underline`, `LineBreak`, and `Hyperlink` spans to produce rich inline formatting without switching to the heavier `RichTextBlock`:

```xml
<TextBlock>
    <Run Text="Status: " />
    <Bold><Run Text="Connected" /></Bold>
    <LineBreak />
    <Italic><Run Text="Last synced 2 minutes ago" /></Italic>
</TextBlock>
```

Two properties control what happens when text exceeds the available space. `TextWrapping="Wrap"` allows the text to flow across multiple lines, while `TextTrimming="CharacterEllipsis"` or `"WordEllipsis"` truncates the text and appends an ellipsis when wrapping is disabled. Combining a fixed height with `TextTrimming` is a common pattern for constrained layouts like cards or list items.

`IsTextSelectionEnabled="True"` allows users to select and copy text from a `TextBlock`. This is off by default to preserve the feel of a label, but enabling it is good practice for content like error messages or identifiers that users may need to copy.

---

## RichTextBlock

When a document-like layout is needed, `RichTextBlock` provides a richer content model built around `Paragraph` and `Block` elements. Where `TextBlock` deals in inline spans, `RichTextBlock` organises content in paragraphs, each of which contains its own collection of inlines.

```xml
<RichTextBlock>
    <Paragraph>
        <Bold>Introduction</Bold>
    </Paragraph>
    <Paragraph>
        This guide covers the controls used for displaying
        <Italic>formatted text</Italic> and status feedback.
    </Paragraph>
</RichTextBlock>
```

`RichTextBlock` also supports `InlineUIContainer`, which lets you embed arbitrary XAML elements such as images or custom controls inline within text flow. This makes it suitable for documentation viewers, help content, or any scenario where text and visuals need to be composed together.

One particularly useful capability is multi-column text layout using `RichTextBlockOverflow`. You place a `RichTextBlock` with its content, then add one or more `RichTextBlockOverflow` controls elsewhere in the layout, each linked to the previous via its `OverflowContentTarget` property. Text that does not fit in the primary block flows into the overflow targets, enabling newspaper-style column layouts without manual pagination logic.

```xml
<RichTextBlock x:Name="PrimaryBlock" OverflowContentTarget="{x:Bind SecondaryBlock}">
    <Paragraph>Long article text...</Paragraph>
</RichTextBlock>
<RichTextBlockOverflow x:Name="SecondaryBlock" />
```

Hyperlinks within `RichTextBlock` use the `Hyperlink` inline element, which can navigate to a URI or fire a `Click` event, making it straightforward to build inline links in help text or documentation.

---

## ProgressBar

`ProgressBar` displays linear progress feedback. It operates in two modes: determinate and indeterminate. In determinate mode, you set `Minimum`, `Maximum`, and `Value` properties to represent actual progress toward a known total. In indeterminate mode, set `IsIndeterminate="True"` and the bar animates continuously to signal that work is happening without conveying how much remains.

```xml
<!-- Determinate: 60% complete -->
<ProgressBar Minimum="0" Maximum="100" Value="60" Width="300" />

<!-- Indeterminate: background work with unknown duration -->
<ProgressBar IsIndeterminate="True" Width="300" />
```

Two additional states communicate outcomes. `ShowPaused="True"` renders the bar in a muted style to indicate that progress has been suspended, for example when a download is paused by the user. `ShowError="True"` renders the bar in red to signal that the operation has failed partway through. These states are useful when you want to preserve the progress indicator in the UI while communicating a change in the operation's health.

`ProgressBar` suits scenarios where the feedback appears within a content area, such as below a list header during a data load or above a form during a save operation. Its horizontal footprint integrates naturally into vertical layouts.

---

## ProgressRing

`ProgressRing` provides circular progress feedback and is almost always used in indeterminate mode to indicate that the application is busy. It fits naturally in contexts where space is roughly equal in both dimensions, such as centered over a content panel, within a button during a submission, or overlaid on an image while it loads.

```xml
<ProgressRing IsActive="True" Width="48" Height="48" />
```

Sizing the ring with explicit `Width` and `Height` values gives you control over its visual weight. Small rings (around 20px) work well inline with text or inside compact controls, while larger rings (48px or more) are appropriate when centered over a full content area.

Unlike `ProgressBar`, `ProgressRing` does not have determinate mode in the same practical sense. Although `WinUI 3` technically supports a value range, the ring is most commonly left indeterminate. When you need to convey a percentage, `ProgressBar` communicates that more clearly. The ring is the right choice when the message is simply "please wait" rather than "you are 40% done."

---

## InfoBar

`InfoBar` is a notification control designed to surface persistent, contextually relevant messages within a page. It supports four severity levels through the `Severity` property: `Informational`, `Success`, `Warning`, and `Error`. Each level applies an appropriate icon and color scheme automatically, so the visual language is consistent without manual styling.

```xml
<InfoBar
    IsOpen="True"
    Severity="Warning"
    Title="Connectivity issue"
    Message="Some data may be out of date. Check your network connection." />
```

`InfoBar` is dismissable by default, showing a close button that sets `IsOpen` to `False`. You can suppress the close button by setting `IsClosable="False"` for messages that should remain visible until the underlying condition resolves, such as an ongoing service outage.

Action buttons make `InfoBar` more than a passive notification. The `ActionButton` property accepts any `ButtonBase`-derived control, so you can attach a `Button` or `HyperlinkButton` to let users respond directly within the bar, for example to retry a failed operation or navigate to a settings page.

```xml
<InfoBar IsOpen="True" Severity="Error" Title="Upload failed">
    <InfoBar.ActionButton>
        <Button Content="Retry" Click="RetryButton_Click" />
    </InfoBar.ActionButton>
</InfoBar>
```

`InfoBar` is better than a dialog for non-blocking feedback that applies to the current page context. Dialogs interrupt the user's flow and demand a response; `InfoBar` sits in the page and waits. Reserve dialogs for decisions that genuinely require immediate input before the user can continue.

---

## Tooltip

`Tooltip` surfaces brief contextual help when the user hovers over or focuses a control. It is attached to any element through `ToolTipService.ToolTip`:

```xml
<Button Content="Submit">
    <ToolTipService.ToolTip>
        <ToolTip Content="Send the form to the server" />
    </ToolTipService.ToolTip>
</Button>
```

For a simple string, you can assign the tooltip directly to the attached property without the nested `ToolTip` element:

```xml
<Button Content="Submit" ToolTipService.ToolTip="Send the form to the server" />
```

Placement is controlled through `ToolTipService.Placement`, which accepts values like `Top`, `Bottom`, `Left`, and `Right`. The default placement is above the target element, which works well in most cases, but adjusting placement is useful when the tooltip would otherwise be clipped by the window edge.

Rich content tooltips are possible by placing layout panels and controls inside the `ToolTip.Content`. A tooltip containing an image and a description, for instance, can provide a preview without opening a new panel. Keep tooltip content concise regardless; a tooltip that requires reading is a sign that the information belongs in the UI itself.

---

## CalendarDatePicker

`CalendarDatePicker` provides a compact date selection experience. It displays as a text field showing the selected date, and when activated it opens a flyout containing a full month calendar. This makes it a good choice when date selection is one of several inputs on a form and the calendar should not dominate the layout.

```xml
<CalendarDatePicker
    PlaceholderText="Select a date"
    DateChanged="CalendarDatePicker_DateChanged" />
```

The selected date is available through the `Date` property, which is of type `DateTimeOffset?`. The null value indicates that no date has been chosen, which is useful for distinguishing an empty field from a chosen date. You can constrain the selectable range using `MinDate` and `MaxDate`.

---

## CalendarView

`CalendarView` displays the calendar directly in the page rather than in a flyout, making it appropriate when date selection is the primary activity on a screen or when you want users to see context around the date they are selecting. It supports single, multiple, and range selection modes through the `SelectionMode` property.

```xml
<CalendarView
    SelectionMode="Single"
    SelectedDatesChanged="CalendarView_SelectedDatesChanged" />
```

In `Multiple` mode, the user can tap individual dates to add or remove them from the selection, which suits scenarios like scheduling recurring events. In `Range` mode, the user selects a start and end date, useful for booking or date range filters.

`CalendarView` exposes density indicators through the `CalendarViewDayItemChanging` event, letting you mark specific dates with visual cues to communicate that something is scheduled or notable on those days.

---

## DatePicker and TimePicker

`DatePicker` and `TimePicker` use spinner-style selectors rather than a calendar flyout, presenting separate columns for each component of the date or time. `DatePicker` shows day, month, and year columns, while `TimePicker` shows hour, minute, and AM/PM columns.

```xml
<DatePicker Header="Appointment date" />
<TimePicker Header="Appointment time" />
```

The spinner format is familiar on touch-first or compact displays, where a full calendar flyout might feel heavyweight. On desktop, user preference varies, so choosing between `CalendarDatePicker` and `DatePicker` often comes down to whether the calendar context adds value for the task. Selecting a birthdate, for example, benefits from `DatePicker` because users typically know the date and do not need to navigate a calendar. Selecting a meeting date benefits from `CalendarDatePicker` because users may want to see the surrounding week.

`DatePicker` and `TimePicker` are frequently used together. Placing them side by side under a shared header creates a coherent date-and-time entry experience without requiring a custom compound control.

---

## Choosing the Right Feedback Control

Selecting among `InfoBar`, `TeachingTip`, `ContentDialog`, and `Tooltip` depends on two dimensions: whether the message blocks the user's flow and whether it relates to a specific element or to the page as a whole.

`Tooltip` is the least intrusive option. It appears on hover or focus and disappears when the user moves away. Use it for explanatory hints about a specific control, such as what a button does or what format a field expects. Never use a tooltip to surface errors or important status; users will miss it.

`InfoBar` works at the page level. It communicates conditions that affect the current view without interrupting the user's task. A warning that the data shown may be stale, a success message after a background save, or an error that the user should acknowledge at their convenience are all good matches for `InfoBar`.

`TeachingTip` is a persistent, dismissable callout that can point to a specific element in the UI. It suits onboarding flows or feature discovery, where you want to draw attention to a capability the user has not yet explored. Unlike `Tooltip`, it stays visible until dismissed, and unlike `InfoBar`, it can be anchored to a particular control.

`ContentDialog` is the appropriate choice when the application genuinely cannot proceed without a user decision. Confirmation before a destructive action, a required terms acceptance, or a blocking error that must be acknowledged before continuing are all situations that warrant a dialog. For anything that can be deferred or ignored, prefer `InfoBar` or `TeachingTip` to avoid interrupting the user unnecessarily.

A practical way to think through the decision is to ask whether the user can reasonably ignore the message. If ignoring it would cause data loss or leave the application in an inconsistent state, use a dialog. If ignoring it is fine and the user can act on it later or not at all, use `InfoBar`. If the message explains a specific control, use a `Tooltip`. If you are guiding the user toward a feature, use a `TeachingTip`.
