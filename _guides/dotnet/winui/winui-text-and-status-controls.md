---
title: "Text, Status, and Information Controls"
layout: guide
category: "WinUI 3"
subcategory: "Controls & UI"
description: "Displaying read-only text and status in WinUI 3: TextBlock and its fast rendering path, the Windows type ramp styles, RichTextBlock with overflow columns, ProgressBar and ProgressRing in determinate and indeterminate modes, InfoBar for app-state messages, InfoBadge for notification counts, and ToolTip placement and content."
tags: [textblock, type-ramp, progress-indicators, infobar, infobadge, tooltips, practical]
---

## Displaying Text

### TextBlock

`TextBlock` is the control for most read-only text in an app, such as labels, headings, and body copy. It is designed to show a single paragraph. It can contain line breaks but doesn't support indentation, and for multiple paragraphs Microsoft recommends `RichTextBlock`.

Content goes in one of two places. The `Text` property takes a plain string. The `Inlines` collection, which is the XAML content property, takes formatted elements from `Microsoft.UI.Xaml.Documents` such as `Run`, `Span`, `Bold`, `Italic`, `Underline`, `LineBreak`, and `Hyperlink`.

```xml
<TextBlock Text="Connected" />

<TextBlock>
    Status: <Bold>Connected</Bold>
    <LineBreak />
    <Run Foreground="{ThemeResource TextFillColorSecondaryBrush}">Last synced 2 minutes ago</Run>
</TextBlock>
```

The choice affects rendering cost. XAML lays out text on a **fast path** that uses much less memory and CPU for measuring and arranging, and only `TextBlock` gets it. The fast path applies only when:

- the text is set through the `Text` property. Any content in `Inlines`, even plain text written between the tags, drops to the slower path.
- `CharacterSpacing` is 0, its default.
- `TextTrimming` is `None`, `CharacterEllipsis`, or `WordEllipsis`. `Clip` drops to the slower path.

Non-default `Typography` attached properties, which turn on OpenType features such as small caps, also leave the fast path. The cost adds up in text repeated many times, such as list item templates. To see which text is on the fast path, set `DebugSettings.IsTextPerformanceVisualizationEnabled = true` in a debug build, and fast-path text renders bright green.

When text doesn't fit, `TextWrapping="Wrap"` flows it onto more lines and `MaxLines` caps how many. `TextTrimming="CharacterEllipsis"` or `"WordEllipsis"` cuts off the overflow with an ellipsis.

`IsTextSelectionEnabled="True"` lets the user select and copy the text. Turn it on for error messages and identifiers that a user may need to paste elsewhere. Keyboard users select such text with caret browsing, which F7 toggles.

### The Windows Type Ramp

WinUI defines keyed styles that match the Windows 11 type ramp, so headings and body text stay consistent with the system without hand-picked font sizes. They are not applied automatically. Set them explicitly with `{StaticResource}`. Sizes are in effective pixels (epx), which Windows scales for each display.

| Style key | Weight | Size (epx) |
| --- | --- | --- |
| `CaptionTextBlockStyle` | Regular | 12 |
| `BodyTextBlockStyle` | Regular | 14 |
| `BodyStrongTextBlockStyle` | Semibold | 14 |
| `BodyLargeTextBlockStyle` | Regular | 18 |
| `BodyLargeStrongTextBlockStyle` | Semibold | 18 |
| `SubtitleTextBlockStyle` | Semibold | 20 |
| `TitleTextBlockStyle` | Semibold | 28 |
| `TitleLargeTextBlockStyle` | Semibold | 40 |
| `DisplayTextBlockStyle` | Semibold | 68 |

```xml
<TextBlock Text="Account settings" Style="{StaticResource TitleTextBlockStyle}" />
```

The default font is Segoe UI Variable for English, European languages, Greek, and Russian. The ramp has no bold or italic styles. Microsoft's typography guidance uses Semibold for emphasis and avoids italics because they can reduce legibility, particularly for readers with dyslexia.

### RichTextBlock

`RichTextBlock` handles what `TextBlock` can't, including multiple paragraphs, indentation, embedded UI, and text that flows across columns. Its content property is `Blocks`, which holds `Paragraph` elements, and each paragraph holds inlines like those in a `TextBlock`. It has no `Text` property, so reading its content from code means walking the blocks.

```xml
<RichTextBlock TextIndent="12">
    <Paragraph>
        This guide covers controls for displaying
        <Bold>formatted text</Bold> and status.
    </Paragraph>
    <Paragraph>
        An inline image:
        <InlineUIContainer>
            <Image Source="Assets/Logo.png" Width="20" Height="20" />
        </InlineUIContainer>
    </Paragraph>
</RichTextBlock>
```

`TextIndent` on the `RichTextBlock` sets the indent for every paragraph, and `Paragraph.TextIndent` overrides it for one. `InlineUIContainer` embeds a single `UIElement` in the text flow. It can hold an image or an interactive control such as a `Button`, and a panel as its child holds several elements.

For multi-column layouts, set the `RichTextBlock`'s `OverflowContentTarget` to a `RichTextBlockOverflow` placed elsewhere in the layout. Text that doesn't fit in the first block continues in the overflow element, and each `RichTextBlockOverflow` can name another as its own `OverflowContentTarget` to form a chain. The content always originates in the `RichTextBlock`, and the overflow elements only display the remainder.

```xml
<Grid ColumnSpacing="24">
    <Grid.ColumnDefinitions>
        <ColumnDefinition />
        <ColumnDefinition />
    </Grid.ColumnDefinitions>
    <RichTextBlock OverflowContentTarget="{Binding ElementName=SecondColumn}">
        <Paragraph>Long article text...</Paragraph>
    </RichTextBlock>
    <RichTextBlockOverflow x:Name="SecondColumn" Grid.Column="1" />
</Grid>
```

## Showing Progress

### Choosing the Indicator

WinUI has two progress controls, and each has a determinate state, which shows how much of a task is done, and an indeterminate state, which shows only that work is underway. Microsoft's guidance gives the four combinations different meanings:

| | Determinate | Indeterminate |
| --- | --- | --- |
| `ProgressBar` | Known duration, user can keep working ("Downloading", "Installing") | Unknown duration, user can keep working ("Loading...", "Retrieving") |
| `ProgressRing` | Known duration, when a ring suits the layout better than a bar | Unknown duration, and the user must wait before continuing ("Signing in...", "Connecting...") |

The indeterminate ring is the only one that signals the app is blocked. Some operations need no indicator at all, such as a background download the user didn't start, or a task where only completion matters. When a virtualized list is loading items, show one `ProgressBar` at the top of the list rather than an indicator on each item.

### ProgressBar

A determinate `ProgressBar` fills according to `Value` between `Minimum` and `Maximum`. Setting `IsIndeterminate="True"` switches it to a continuous animation.

```xml
<ProgressBar Minimum="0" Maximum="100" Value="{x:Bind ViewModel.PercentDone, Mode=OneWay}" />
<ProgressBar IsIndeterminate="True" />
```

`ShowPaused="True"` and `ShowError="True"` switch the bar to paused and error visual states, which lets a paused download or a failed upload keep its progress on screen while showing that something changed. `Foreground` colors the filled part (the system accent color by default) and `Background` the unfilled track.

### ProgressRing

`IsActive` turns a `ProgressRing` on and off. Microsoft's reference contradicts itself on its default. The API metadata declares `true`, while the API prose says `false` and the design guidance tells you to set it to `true`. Set it explicitly, usually by binding it to the busy state. When `IsActive` is `false`, the ring is hidden but still reserves its space in the layout, so set `Visibility="Collapsed"` as well if the gap matters. The ring is indeterminate by default. For a determinate ring, set `IsIndeterminate="False"` and drive `Value` as with the bar.

```xml
<ProgressRing IsActive="{x:Bind ViewModel.IsSigningIn, Mode=OneWay}" Width="48" Height="48" />
```

The ring's minimum size is 20 by 20 epx. Set `Width` and `Height` to the same value. If you set only one, the ring falls back to the minimum, and if they differ, it uses the smaller.

## Messages, Badges, and Tooltips

### InfoBar

`InfoBar` shows a message about the state of the app inside the page layout. It takes up space like any other element rather than floating over content, and it stays until the user closes it or the app does. Microsoft's examples include lost connectivity, an automatic save that failed, and an expiring subscription. It is not for responding to a user action that doesn't change the app's state, for time-sensitive alerts, or for messages that aren't essential.

An `InfoBar` is hidden by default. Set `IsOpen="True"` to show it, which catches people out when a bar declared in XAML never appears.

```xml
<InfoBar IsOpen="{x:Bind ViewModel.IsOffline, Mode=OneWay}"
         Severity="Warning"
         Title="You're offline"
         Message="Changes will sync when the connection returns."
         IsClosable="False" />
```

- **`Severity`** is `Informational` (the default), `Success`, `Warning`, or `Error`. Each sets a color and icon that are designed for light, dark, and high-contrast themes, and each also sets how assistive technology treats the message. Put the meaning in `Title` or `Message` too, since color and icon alone don't reach every user.
- **Closing.** `IsClosable` defaults to `true`, showing a close button that sets `IsOpen` to `false`. Set it to `false` for a message that should stay until the condition clears. The `Closing` event reports why the bar is closing through `args.Reason` and can keep it open with `args.Cancel = true`.
- **Actions.** `ActionButton` takes any `ButtonBase`. A `Button` or `HyperlinkButton` there gets styling that matches the bar. `Content` adds custom XAML, such as a progress bar, on its own line below the message.
- **Screen readers.** Changing `Title`, `Message`, or `Severity` while the bar is open doesn't raise a new announcement. Close and reopen the bar so assistive technology reads the updated message.

Avoid opening and closing a bar rapidly. The flashing is hard on people with photosensitivity, and each appearance shifts the content below it.

### InfoBadge

`InfoBadge` is a small circle that marks a navigation item or control as having something new, like unread messages, new articles, or a non-blocking problem on another page. It is meant to be noticed and then ignored if the user chooses, so it is not for critical errors or anything that needs action before the user can continue.

The properties you set decide what it shows:

- **Dot.** No properties set. `Value` defaults to -1 and `IconSource` to `null`.
- **Icon.** Set `IconSource`, for example to a `SymbolIconSource`.
- **Number.** Set `Value` to a whole number of zero or more. If both `Value` and `IconSource` are set, `Value` wins.

```xml
<NavigationViewItem Content="Inbox" Icon="Mail">
    <NavigationViewItem.InfoBadge>
        <InfoBadge Value="{x:Bind ViewModel.UnreadCount, Mode=OneWay}"
                   Visibility="{x:Bind ViewModel.HasUnread, Mode=OneWay}" />
    </NavigationViewItem.InfoBadge>
</NavigationViewItem>
```

`NavigationViewItem.InfoBadge` is the main place for app-wide badges, and there `NavigationView` positions the badge for each pane layout (expanded, compact, or top) and announces it to screen readers. Microsoft recommends using one badge type throughout a `NavigationView`. Preset styles such as `AttentionValueInfoBadgeStyle` and `CriticalIconInfoBadgeStyle` cover the Attention, Informational, Success, Caution, and Critical colors.

A badge placed anywhere else is your responsibility. The badge itself can't take focus and has no screen reader support, so the parent element must be focusable and describe the badge, typically through `AutomationProperties.ItemStatus` or `AutomationProperties.FullDescription`. The app should also raise an automation event, through `AutomationPeer.RaiseAutomationEvent`, when the badge appears, disappears, or changes significantly. Hiding it with `Visibility.Collapsed` frees its layout space and can shift nearby elements, while `Opacity="0"` keeps the space reserved.

### ToolTip

A tooltip shows supplementary information about a control when the user hovers over it, gives it keyboard focus, or presses and holds it. It disappears when focus leaves or the pointer moves away, unless the pointer is moving toward the tooltip. On Windows 11, pressing Ctrl also dismisses it. Attach one with the `ToolTipService.ToolTip` attached property:

```xml
<Button ToolTipService.ToolTip="Refresh (F5)">
    <SymbolIcon Symbol="Refresh" />
</Button>
```

The value can be a string or any object, such as an `Image` for a preview.

By default a tooltip appears centered above the **pointer**, not above the control. The app window doesn't constrain it, so it can extend past the window's edges.

The `ToolTipService.Placement` attached property, or `Placement` on a `ToolTip` element, moves it to another side of the pointer with values such as `Top`, `Bottom`, `Left`, and `Right`. The offset properties and `PlacementRect` exist only on an explicit `ToolTip` element. `VerticalOffset` sets the gap for top and bottom placement, and `HorizontalOffset` for left and right.

When a tooltip covers the thing it describes, `PlacementRect` defines a rectangle, relative to the owner, that the tooltip anchors to and avoids covering as long as the screen has room. With it set, `Placement` puts the tooltip on that side of the rectangle instead of the pointer, so a rectangle matching the owner's bounds keeps the tooltip off the element entirely.

```xml
<Image Source="Assets/Chart.png" Width="96" Height="64">
    <ToolTipService.ToolTip>
        <ToolTip Content="Revenue by quarter" PlacementRect="0,0,96,64" />
    </ToolTipService.ToolTip>
</Image>
```

Microsoft's guidance keeps tooltips short, supplementary, and rare:

- **Label icon-only buttons.** A toolbar button that shows only an icon needs one. A button whose text already says what it does doesn't.
- **Don't carry essential or status information.** Errors, warnings, and status belong in another element, such as a flyout. Essential information belongs directly in the UI, where users don't have to hover to find it.
- **Don't put interactive controls inside.** Users can't reliably interact with a tooltip, because moving the mouse tends to dismiss it.
- **Mention keyboard shortcuts.** Keyboard accelerators appear in a control's default tooltip, so a custom tooltip should include them itself.

## Choosing a Status Control

| Situation | Control |
| --- | --- |
| A condition that affects the app or page, which the user should see and may act on | `InfoBar` |
| Something new or needing attention on a navigation item or control, which the user can check later | `InfoBadge` |
| A label or hint for one control, shown on hover or focus | `ToolTip` |
| Work in progress | `ProgressBar` or `ProgressRing`, chosen by the table in Showing Progress |
| Background work the user only occasionally checks, or a label explaining what a progress control is waiting on | A `TextBlock` status line |

Messages that must interrupt the user for a decision belong in a `ContentDialog`, and tips anchored to a control to teach a feature belong in a `TeachingTip`.
