---
title: "Accessibility in WinUI 3"
layout: guide
category: "WinUI 3"
subcategory: "Quality & Testing"
description: "Making a WinUI 3 app work with screen readers, keyboards, contrast themes, and text scaling: how UI Automation sees the app, naming and structuring elements, announcing changes, custom automation peers, and testing against WCAG 2.2."
tags: [accessibility, ui-automation, automation-peers, screen-reader, contrast-themes, wcag, practical]
---

## How Assistive Technology Sees a WinUI App

A screen reader never looks at pixels. Narrator, JAWS, and NVDA read a desktop app through **UI Automation** (UIA), the Windows accessibility API, which presents the app as a tree of automation elements. Each element answers three questions: its **name** (what the screen reader says), its **role** (button, list item, slider), and, where it has one, its **value** (the text in a box, the position of a slider). Everything a screen reader user can do in the app happens through that tree.

WinUI builds the tree from **automation peers**. Every built-in control creates a peer, such as `ButtonAutomationPeer` for `Button`, which reports the control's name, role, and state to UIA and exposes **control patterns**, the interfaces through which UIA operates the control. A button supports the Invoke pattern, a check box the Toggle pattern, a slider the RangeValue pattern. When a screen reader user presses "activate", the screen reader calls the pattern, not a mouse click.

UIA offers the tree in three views. The **raw** view holds nearly every element, the **control** view holds interactive controls and structural landmarks, and the **content** view holds what carries user-facing information. Screen readers and inspection tools mostly work from the control view.

{% include figure.html id="winui-automation-tree" %}

Built-in controls get all of this right on their own. The work falls on the app in four places:

- Elements whose name can't be inferred, such as icon-only buttons and images.
- Changes that happen without the user moving focus, such as a status message appearing.
- Custom controls, which have no peer until the app provides one.
- Styling that overrides the system's colors or text size.

---

## Naming and Describing Elements

`AutomationProperties` is a set of attached properties that set what an element reports to UIA, in XAML, on any element. They override what the element's peer would report by default.

### Where the Name Comes From

Many elements name themselves. A `TextBlock` uses its text, and a `Button` or other `ContentControl` converts its content to a string. The gaps are elements with no text content: an icon-only button, an `Image`, a chart. Those need `AutomationProperties.Name`.

```xml
<!-- Narrator announces only "button" -->
<Button>
    <FontIcon Glyph="&#xE713;" />
</Button>

<!-- Narrator announces "Settings, button" -->
<Button AutomationProperties.Name="Settings">
    <FontIcon Glyph="&#xE713;" />
</Button>
```

Don't put the role in the name. The screen reader appends the role from the peer, so a name of "Settings button" is read as "Settings button, button". UIA truncates names at 2,048 characters. Names are user-facing text, so localize them like any other string. With an `x:Uid` on the element, the resource key targets the attached property as `SettingsButton.[using:Microsoft.UI.Xaml.Automation]AutomationProperties.Name`.

### Labels and Descriptions

A form field's accessible name should match its visible label. When the label is a separate `TextBlock`, `AutomationProperties.LabeledBy` points the field at it, so the same text drives both what's shown and what's spoken:

```xml
<TextBlock x:Name="EmailLabel" Text="Email address" />
<TextBox AutomationProperties.LabeledBy="{x:Bind EmailLabel}" />
```

The same technique captions an image with visible text. `AutomationProperties.HelpText` adds a description for context the name shouldn't carry, like an input format. Narrator reads it on request rather than with every announcement, so it can't hold information the user needs to operate the field.

### Hiding Decoration

Purely decorative elements, such as a background shape, a divider, or an icon beside text that already says the same thing, add noise to screen-reader navigation. `AutomationProperties.AccessibilityView="Raw"` moves an element out of the control and content views, where screen readers look, while leaving it in the raw view for diagnostic tools:

```xml
<Rectangle Height="1" Fill="{ThemeResource DividerStrokeColorDefaultBrush}"
           AutomationProperties.AccessibilityView="Raw" />
```

Control templates do the same for their internal parts. A composed control whose children would each show up separately can hide them this way, as long as the control itself reports everything they conveyed.

### Names for Data-Bound Items

A `ListView` or `GridView` item built from a data template has a container, the `ListViewItem` or `GridViewItem`, and like other content controls the container derives its name by converting its content to a string. A bound model object without a `ToString` override converts to its type name, so every row is announced as something like "MyApp.Models.Order". Give each item a real name, either by overriding `ToString` on the model or by setting `AutomationProperties.Name` on the container in the list's `ContainerContentChanging` event. Then check the result with a screen reader after the data loads, since the name exists only once binding has run.

---

## Structuring a Page with Headings and Landmarks

A sighted user scans a page by its headings and regions. A screen reader user does the same thing through two properties. `AutomationProperties.HeadingLevel` marks an element, usually a `TextBlock`, as a heading from `Level1` to `Level9`. `AutomationProperties.LandmarkType` marks a container as a `Main`, `Navigation`, `Search`, `Form`, or `Custom` region (a custom one is named with `LocalizedLandmarkType`). A landmark container should hold everything in that region and nothing from another, so regions sit side by side rather than inside each other. Screen readers can then jump between regions and headings, and Narrator lists a window's landmarks with Caps Lock+F5 and its headings with Caps Lock+F6.

```xml
<Grid ColumnDefinitions="240, *" RowDefinitions="Auto, *">
    <AutoSuggestBox Grid.ColumnSpan="2" PlaceholderText="Search orders"
                    AutomationProperties.LandmarkType="Search" />

    <ListView Grid.Row="1" x:Name="Sections"
              AutomationProperties.LandmarkType="Navigation" />

    <ScrollViewer Grid.Row="1" Grid.Column="1"
                  AutomationProperties.LandmarkType="Main">
        <StackPanel>
            <TextBlock Text="Orders" Style="{StaticResource TitleTextBlockStyle}"
                       AutomationProperties.HeadingLevel="Level1" />
            <TextBlock Text="Open orders" Style="{StaticResource SubtitleTextBlockStyle}"
                       AutomationProperties.HeadingLevel="Level2" />
        </StackPanel>
    </ScrollViewer>
</Grid>
```

A visual style doesn't make text a heading. A `TitleTextBlockStyle` text block is still plain text to UIA until `HeadingLevel` is set. For keyboard users, the matching convention is F6 to move between the major panes, as File Explorer and Outlook do, which Microsoft recommends alongside landmarks in any app with several regions.

---

## Announcing Changes the User Didn't Cause

When focus moves, the screen reader announces the newly focused element. A change elsewhere, such as a save confirmation, a validation error, or a search result count, produces no announcement unless the app asks for one. WCAG treats these as status messages, and there are two ways to announce them. A live region suits text that stays on screen, like a result count. A notification event suits a transient confirmation that may never be visible.

### Live Regions

`AutomationProperties.LiveSetting` marks an element as a **live region** whose changes a screen reader should report. `Polite` waits until the screen reader finishes its current speech, and `Assertive` interrupts it, which suits only urgent messages. The screen reader learns of a change through the `LiveRegionChanged` automation event, so after changing the content, raise it through the element's peer:

```xml
<TextBlock x:Name="StatusMessage" AutomationProperties.LiveSetting="Polite" />
```

```csharp
StatusMessage.Text = $"{results.Count} results";

AutomationPeer peer = FrameworkElementAutomationPeer.FromElement(StatusMessage)
                      ?? FrameworkElementAutomationPeer.CreatePeerForElement(StatusMessage);
peer?.RaiseAutomationEvent(AutomationEvents.LiveRegionChanged);
```

### Notification Events

`AutomationPeer.RaiseNotificationEvent` announces a string that doesn't have to appear on screen at all, which suits confirmations like "Saved" that the UI shows only as an icon. The last argument is an **activity id**, a non-localized string that groups related notifications, and the processing argument says what the screen reader does when several arrive from the same activity:

| `AutomationNotificationProcessing` | Behavior |
| --- | --- |
| `All` | Delivers every notification |
| `MostRecent` | Interrupts the current notification with the newest |
| `CurrentThenMostRecent` | Finishes the current one, then reads only the latest, so a burst of progress updates doesn't pile up |
| `ImportantAll`, `ImportantMostRecent` | The same, delivered as soon as possible (Microsoft warns that `ImportantAll` can flood the user) |

```csharp
AutomationPeer peer = FrameworkElementAutomationPeer.FromElement(SaveButton)
                      ?? FrameworkElementAutomationPeer.CreatePeerForElement(SaveButton);
peer?.RaiseNotificationEvent(
    AutomationNotificationKind.ActionCompleted,
    AutomationNotificationProcessing.MostRecent,
    "Document saved",
    "SaveStatus");
```

When new UI appears in place of the old, such as a panel that expands or a step in a wizard, announcing it is usually the wrong fix. Move keyboard focus into it with `Focus(FocusState.Programmatic)`, and the screen reader announces the focused element as it would any other focus change.

---

## Giving a Custom Control an Automation Peer

A control derived directly from `Control` has no peer of its own, because the base `Control` class has none. Until the control overrides `OnCreateAutomationPeer`, a screen reader can't tell what it is or operate it. The peer's job is to report the control's role and to implement the control patterns that match its behavior.

Start by deriving from the closest built-in base class. A custom range control derived from `RangeBase` should return a peer derived from `RangeBaseAutomationPeer`, which already implements the RangeValue pattern, so the custom peer may need only a class name. A control derived from `Control` needs a peer derived from `FrameworkElementAutomationPeer`, which supplies bounding rectangle, focus, and enabled state from the element itself.

The sample below is a star rating built on `Control`. It reports itself as a slider and implements `IRangeValueProvider`. A peer that implements a pattern interface also has to return itself from `GetPatternCore` for that pattern, because UIA asks the peer for one pattern at a time by its `PatternInterface` identifier rather than checking which interfaces it implements.

```csharp
using System;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Automation.Peers;
using Microsoft.UI.Xaml.Automation.Provider;
using Microsoft.UI.Xaml.Controls;

public sealed class StarRating : Control
{
    // Value, Minimum, and Maximum are dependency properties (not shown).
    // Value's property-changed callback calls OnValueChanged.

    protected override AutomationPeer OnCreateAutomationPeer()
        => new StarRatingAutomationPeer(this);

    private void OnValueChanged(double oldValue, double newValue)
    {
        if (AutomationPeer.ListenerExists(AutomationEvents.PropertyChanged) &&
            FrameworkElementAutomationPeer.FromElement(this) is StarRatingAutomationPeer peer)
        {
            peer.RaisePropertyChangedEvent(
                RangeValuePatternIdentifiers.ValueProperty, oldValue, newValue);
        }
    }
}

// partial lets the CsWinRT generator add the interface support that trimming and AOT need.
public sealed partial class StarRatingAutomationPeer : FrameworkElementAutomationPeer, IRangeValueProvider
{
    public StarRatingAutomationPeer(StarRating owner) : base(owner) { }

    private StarRating Rating => (StarRating)Owner;

    protected override string GetClassNameCore() => nameof(StarRating);

    protected override AutomationControlType GetAutomationControlTypeCore()
        => AutomationControlType.Slider;

    protected override object GetPatternCore(PatternInterface patternInterface)
        => patternInterface == PatternInterface.RangeValue
            ? this
            : base.GetPatternCore(patternInterface);

    public double Value => Rating.Value;
    public double Minimum => Rating.Minimum;
    public double Maximum => Rating.Maximum;
    public double SmallChange => 1;
    public double LargeChange => 1;
    public bool IsReadOnly => !Rating.IsEnabled;

    public void SetValue(double value)
    {
        if (IsReadOnly)
        {
            return;   // a disabled rating ignores the request
        }
        Rating.Value = Math.Clamp(Math.Round(value), Minimum, Maximum);
    }
}
```

Four details in the sample carry over to any peer:

- **`GetClassNameCore` is the minimum override** for a new peer. It isn't spoken, so it needs no localization.
- **Pick a specific `AutomationControlType`.** UIA supplies a localized spoken role for every type except `Custom`, which leaves the peer to provide one through `GetLocalizedControlTypeCore`.
- **Route pattern calls through the control's own logic.** `SetValue` sets the same property that a click or an arrow key sets, so every path runs the same validation and visual state changes.
- **Raise events only when someone is listening.** `ListenerExists` skips building the event when no UIA client subscribes, and `FromElement` returns `null` when no peer has been created yet.

The peer gives screen readers access, but it doesn't give keyboard users a way to operate the control. The control still handles the arrow keys itself, and the peer can report its shortcuts through `GetAcceleratorKeyCore` and `GetAccessKeyCore`.

---

## Keyboard Access

WCAG's keyboard criterion asks that every function available with a pointer also work from the keyboard, and a screen reader user depends on the keyboard entirely. Built-in controls handle their own keys. The app's share is keeping the Tab order logical, giving custom interactions (drag-and-drop, canvas editing, hover-only commands) a keyboard path, and never hiding the focus indicator.

WinUI's focus visuals have no setting that turns them off, and a custom template shouldn't find another way. Static text stays out of the Tab order. Screen reader users reach it by moving through elements with the Narrator key and the arrow keys, which doesn't depend on focus, so putting a `TextBlock` in the Tab order to make it readable only adds stops that do nothing.

---

## Supporting Contrast Themes

Windows **contrast themes** (Aquatic, Desert, Dusk, and Night sky, under **Settings > Accessibility > Contrast themes**) replace the app's palette with a small set of user-chosen system colors, usually at contrast ratios of 7:1 or higher. They're separate from the light and dark themes. Built-in controls follow them automatically. Custom styling breaks them in two ways: a hard-coded color stays fixed while the text around it changes to the theme's colors, and an explicit `Foreground` on text inside a list item template stops it from inverting when the item is selected.

The fix is a `HighContrast` entry in the app's theme dictionaries that maps each custom brush to a **SystemColor** resource. Both references use `{ThemeResource}`, which re-resolves when the theme changes, where `{StaticResource}` resolves once at load:

```xml
<ResourceDictionary.ThemeDictionaries>
    <ResourceDictionary x:Key="Default">
        <SolidColorBrush x:Key="BrandedPanelBrush" Color="#E6E6E6" />
    </ResourceDictionary>
    <ResourceDictionary x:Key="HighContrast">
        <SolidColorBrush x:Key="BrandedPanelBrush" Color="{ThemeResource SystemColorWindowColor}" />
    </ResourceDictionary>
</ResourceDictionary.ThemeDictionaries>
```

Each SystemColor has a role and a partner it's meant to sit on:

| Resource | Use for | Pair with |
| --- | --- | --- |
| `SystemColorWindowColor` | Page, pane, and popup backgrounds | `SystemColorWindowTextColor` |
| `SystemColorWindowTextColor` | Body text, headings, non-interactive UI | `SystemColorWindowColor` |
| `SystemColorButtonFaceColor` / `SystemColorButtonTextColor` | Interactive UI at rest | Each other |
| `SystemColorHighlightColor` / `SystemColorHighlightTextColor` | Selected, hovered, pressed, or in-progress UI | Each other |
| `SystemColorHotlightColor` | Hyperlinks only | `SystemColorWindowColor` |
| `SystemColorGrayTextColor` | Disabled UI only, not secondary text | `SystemColorWindowColor` |

By default, `HighContrastAdjustment` draws text in the contrast theme's text color over a solid backplate, so content stays readable even when the app's styling is wrong. It's set per element on `UIElement` or app-wide on `Application`. Once the app's resources handle contrast themes correctly, set it to `None` so the intended styling shows. An app that has to react in code, for example to swap a bitmap for a contrast-theme version, uses `Microsoft.UI.System.ThemeSettings`, created per window and raising `Changed` when the setting flips. In a `Window` subclass such as `MainWindow`:

```csharp
_themeSettings = ThemeSettings.CreateForWindowId(AppWindow.Id);   // keep the reference
_themeSettings.Changed += (settings, _) =>
    DispatcherQueue.TryEnqueue(() => UseContrastAssets(settings.HighContrast));
```

The object stops raising `Changed` once the app releases its last reference, so hold it in a field. Test in all four built-in themes, since users can also edit each theme's colors. Left Alt+Left Shift+Print Screen toggles a contrast theme on and off.

---

## Text Size and Contrast Ratios

### Contrast in the Default Themes

Contrast themes are an opt-in accommodation, not a substitute for readable defaults. Text needs a contrast ratio of at least 4.5:1 against its background in the light and dark themes too. WCAG lowers that to 3:1 for large text (18 point, or 14 point bold) and exempts logos, inactive UI, and decorative text. Contrast ratio is a luminance calculation, so two hues that look distinct, like red on green, can still fail it. Check with a contrast tool, which for a desktop app often means sampling a screenshot.

### Text Scaling

**Settings > Accessibility > Text size** lets users enlarge text across apps, up to 225%, without changing the size of everything else. WinUI text controls follow it by default through `IsTextScaleFactorEnabled`, which is `true` on `TextBlock`, `RichTextBlock`, `Control`, `FontIcon`, and related types. Smaller font sizes grow more than larger ones.

The breakage is in layout. Text that grows inside a fixed `Height`, a fixed-width column, or a single-line container gets clipped. Design for it by letting text containers size to content, allowing wrapping, and testing at the maximum setting. Setting `IsTextScaleFactorEnabled="False"` removes the user's control and should be rare. When other UI has to scale with the text, such as an icon drawn as an image, `Windows.UI.ViewManagement.UISettings.TextScaleFactor` (1.0 to 2.25) and its `TextScaleFactorChanged` event report the setting.

---

## Testing Accessibility

Microsoft recommends automated checks as a gate on every change, plus manual screen reader and keyboard passes for the flows that need judgment.

[Accessibility Insights for Windows](https://accessibilityinsights.io/docs/windows/overview){:target="_blank" rel="noopener noreferrer"} is the primary tool. **Live Inspect** shows the UIA properties of whatever is under the pointer or has focus. **FastPass** runs automated checks on a window and walks through a keyboard tab-stop test in a few minutes, and **Troubleshooting** digs into a specific issue, including the events a control raises. The older Windows SDK tools (Inspect, AccEvent, AccScope) still work, but Microsoft steers new work to Accessibility Insights.

For the automated gate itself, [Axe.Windows](https://github.com/microsoft/axe-windows){:target="_blank" rel="noopener noreferrer"}, the rules engine behind Accessibility Insights, is a NuGet package that scans a running app from a test, so the same checks can fail a build.

A Narrator pass covers what no automated check can: whether names make sense in context and whether the reading order matches the visual order.

| Action | Keys |
| --- | --- |
| Start or stop Narrator | Windows+Ctrl+Enter |
| Move through elements, including static text | Caps Lock+Left/Right arrow |
| Activate the current element | Caps Lock+Enter |
| List the window's landmarks, or its headings | Caps Lock+F5, Caps Lock+F6 |
| Show all Narrator commands | Caps Lock+F1 |
| Developer mode (masks the screen, shows only what UIA exposes) | Ctrl+Caps Lock+F12 |

Insert works as the Narrator key in place of Caps Lock. A keyboard-only pass then checks that Tab visits every interactive element in a sensible order, that arrow keys work inside composite controls, and that Enter or Space activates every command.

UI test frameworks for desktop apps find elements through the same UIA tree, so the accessibility work also serves testing. Setting `AutomationProperties.AutomationId` on elements gives tests a stable handle that doesn't change with localization, and a test that asserts a control's name or invokes its pattern checks the accessibility contract on every build.

---

## WCAG and Desktop Apps

The Web Content Accessibility Guidelines are written for the web, but they're the yardstick for desktop software too. W3C's WCAG2ICT guidance interprets each Level A and AA criterion for non-web software. Level A is the minimum, Level AA is what laws and contracts cite, and Level AAA is aspirational. The current version is [WCAG 2.2](https://www.w3.org/TR/WCAG22/){:target="_blank" rel="noopener noreferrer"}, a W3C Recommendation since October 2023 and also published as ISO/IEC 40500:2025. Procurement rules pin specific versions. US Section 508 applies WCAG 2.0 Level AA to software, and Europe's EN 301 549 v4.1.1, published in September 2026, adopts WCAG 2.2, though v3.2.1 (WCAG 2.1 AA) stays the legal reference for the European Accessibility Act until the EU cites the new version. WCAG 3.0 is a working draft that W3C doesn't expect to finish for years.

The Level A and AA criteria that land most directly on a WinUI app:

| Criterion | What it asks | Where the WinUI work is |
| --- | --- | --- |
| 1.1.1 Non-text Content (A) | Text alternatives for images and icons | `AutomationProperties.Name` on images and icon-only buttons |
| 1.3.1 Info and Relationships (A) | Structure available programmatically | `HeadingLevel`, `LandmarkType`, `LabeledBy` |
| 1.4.1 Use of Color (A) | Color isn't the only signal | Pair a red border with text or an icon, and put the state in the name |
| 1.4.3 Contrast (Minimum) (AA) | 4.5:1 for text, 3:1 for large text | Default themes, not only contrast themes |
| 1.4.4 Resize Text (AA) | Text scales to 200% without loss | Text scaling with layouts that grow |
| 1.4.11 Non-text Contrast (AA) | 3:1 for control boundaries and focus indicators | Custom borders and focus visuals |
| 2.1.1 Keyboard (A) | Everything works from the keyboard | Keyboard paths for custom interactions |
| 2.1.2 No Keyboard Trap (A) | Focus can always move away from a component | Custom controls that handle Tab or arrow keys themselves |
| 2.4.3 Focus Order (A) | Focus moves in an order that preserves meaning | Tab order that follows reading order |
| 2.4.7 Focus Visible (AA) | The focus indicator is visible | Never suppress focus visuals |
| 2.4.11 Focus Not Obscured (Minimum) (AA, new in 2.2) | The focused element isn't entirely hidden by the app's own content | Sticky bars and overlays that can cover a focused item |
| 2.5.7 Dragging Movements (AA, new in 2.2) | Anything done by dragging also works with single clicks or taps | Drag-to-reorder, sliders, and canvas editing |
| 2.5.8 Target Size (Minimum) (AA, new in 2.2) | Pointer targets at least 24 by 24 CSS pixels (WCAG2ICT reads these as device-independent pixels, WinUI's effective pixels), or spaced apart | Small custom buttons and dense toolbars |
| 4.1.2 Name, Role, Value (A) | Every control reports all three | Automation peers for custom controls |
| 4.1.3 Status Messages (AA) | Status changes announced without moving focus | Live regions and notification events |
