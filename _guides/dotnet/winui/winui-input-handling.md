---
title: "Input Handling and Gestures"
layout: guide
category: "WinUI 3"
subcategory: "Window & Input"
description: "How WinUI 3 delivers pointer, touch, pen, and keyboard input: routed events, hit testing, pointer capture, manipulations, keyboard accelerators, access keys, and focus navigation."
tags: [practical, pointer-events, gestures, hit-testing, keyboard-accelerators, access-keys, focus-navigation]
---

## Table of Contents

- [Routed Input Events](#routed-input-events)
- [Hit Testing](#hit-testing)
- [Pointer Input](#pointer-input)
- [Gestures and Manipulations](#gestures-and-manipulations)
- [Keyboard Input](#keyboard-input)
- [Keyboard Accelerators](#keyboard-accelerators)
- [Access Keys](#access-keys)
- [Focus](#focus)


## Routed Input Events

The input events on `UIElement` are routed events. The pointer, key, focus, tap, and manipulation events all start at one element and then bubble to its parent, that parent's parent, and so on up to the root, so a handler on a `Grid` hears input aimed at any of its children. Every handler along the route receives the same event-data object.

Two properties of that object matter for almost every handler:

- **`sender`** is the element where the handler is attached, which changes as the event climbs. **`OriginalSource`** stays fixed on the element that raised the event. A control draws itself from a template of child elements, so for input that element is often a template part rather than something you declared. A pointer over the edge of a `Button` usually reports the `Border` inside the button's template.
- **`Handled`**, when set to `true`, stops the event reaching the remaining handlers on the route. `GotFocus` and `LostFocus` have no `Handled` property and always bubble to the root.

Controls use `Handled` themselves. A `Button` handles `PointerPressed` internally because it turns that press into `Click`, so a `PointerPressed` handler attached to a `Button` with `+=` doesn't run. When you need to see an event a control has already handled, register with `AddHandler` and pass `true` for `handledEventsToo`:

```csharp
myButton.AddHandler(UIElement.PointerPressedEvent,
    new PointerEventHandler(OnButtonPointerPressed), handledEventsToo: true);
```

Use it sparingly. The control marked the event handled so that its own behavior would win, and reacting to it anyway can break that behavior.

Routing follows the main visual tree only. A `Popup` or `ToolTip` sits outside that tree, so events from its content never reach the popup itself or the page behind it. Attach handlers to elements inside the popup instead.


## Hit Testing

Before a pointer event can bubble, WinUI has to decide which element it starts at. It walks the elements under the pointer from front to back and picks the topmost one that is hit-test visible. That element is the event's source, and the pointer passes through anything that isn't hit-test visible to whatever lies beneath.

An element is hit-test visible only when all of these hold:

- `Visibility` is `Visible`.
- Its `Background` or `Fill` is not `null`.
- If it is a control, `IsEnabled` is `true`.
- It has a nonzero `ActualWidth` and `ActualHeight`.
- `IsHitTestVisible` is `true`.

A `null` brush and a `Transparent` brush both draw nothing, but only the `Transparent` one is hit-testable. A `Grid` with no `Background` receives clicks only on its children, and clicks on its empty space fall through. Set `Background="Transparent"` when the empty space has to respond, such as a drag surface or a dismiss-on-click overlay. `TextBlock` has no `Background` and is still hit-testable across its whole area, and an `Image` is hit-testable over its full rectangle even where the image is transparent.

`Opacity` is not on the list. An element with `Opacity="0"` is invisible and still catches every click. To make a visible element ignore input, set `IsHitTestVisible="False"`:

```xml
<Grid>
    <Button Content="Clickable" />
    <Border IsHitTestVisible="False" Background="#20FF0000" />
    <!-- The red tint draws over the button, and clicks pass through to it -->
</Grid>
```

To see every element under a point rather than just the topmost one, call `VisualTreeHelper.FindElementsInHostCoordinates`. It takes the point in window coordinates, which is what `GetCurrentPoint(null)` returns, and lists the elements from topmost down. The second argument names an element to stop at: the list ends with that element, keeping only it and whatever draws above it, and comes back empty if the element isn't under the point.

```csharp
Point windowPoint = e.GetCurrentPoint(null).Position;
IEnumerable<UIElement> stack =
    VisualTreeHelper.FindElementsInHostCoordinates(windowPoint, RootGrid);
```

By default it returns only hit-testable elements. The overload with a third `includeAllElements` argument also returns elements that aren't hit-testable, such as those with `null` brushes. It helps with image-map overlays and with finding which element is swallowing clicks meant for something beneath it.


## Pointer Input

WinUI reports mouse, touch, pen, and touchpad input through one set of pointer events. A single handler serves every device, and it checks the device type only when it needs device-specific data. Each finger in multi-touch and each pen is its own pointer with its own ID.

### The Pointer Events

| Event | Fires when |
|---|---|
| `PointerEntered` / `PointerExited` | The pointer moves into or out of the element's bounds. Mouse and touchpad fire these with no button pressed, touch only while in contact, and pen also while hovering in range. |
| `PointerMoved` | The pointer changes position, button state, pressure, tilt, or contact size over the element. |
| `PointerPressed` / `PointerReleased` | A press starts or ends: touch down or up, mouse button down or up, pen down or up. |
| `PointerWheelChanged` | The mouse wheel turns. |
| `PointerCanceled` | The platform cancels the pointer, for example when a pen comes into range and cancels touch, or the display configuration changes. |
| `PointerCaptureLost` | The element loses capture of the pointer (see below). |

`PointerPressed` and `PointerReleased` don't always arrive in pairs. A pointer can end with `PointerCanceled`, `PointerCaptureLost`, or `PointerExited` instead, so code that tracks a press needs to clean up in all of them.

The mouse is one pointer, not one per button. Pressing a second button while the first is held arrives as a `PointerMoved` event, not a second `PointerPressed`.

### Reading Device Data

`e.GetCurrentPoint(element)` returns a `PointerPoint` whose `Position` is relative to the element you pass, or to the window if you pass `null`. Its `PointerDeviceType` says which kind of device produced it, and its `Properties` object carries the device-specific data:

| Device | Useful properties |
|---|---|
| Mouse | `IsLeftButtonPressed`, `IsRightButtonPressed`, `IsMiddleButtonPressed`, `IsXButton1Pressed`, `IsXButton2Pressed`, `MouseWheelDelta`, `IsHorizontalMouseWheel` |
| Pen | `Pressure`, `XTilt`, `YTilt`, `Twist`, `IsBarrelButtonPressed`, `IsEraser`, `IsInverted`, `IsInRange` |
| Touch | `ContactRect` (the estimated contact area), `TouchConfidence` |
| Any | `IsPrimary` (the first pointer in a multi-pointer sequence), `PointerUpdateKind` |

```csharp
private void OnCanvasPointerMoved(object sender, PointerRoutedEventArgs e)
{
    // Every point since the last event, not just the latest one
    foreach (PointerPoint point in e.GetIntermediatePoints(DrawingCanvas))
    {
        if (point.PointerDeviceType == PointerDeviceType.Pen && point.IsInContact)
        {
            double width = 1 + point.Properties.Pressure * 8;
            AddStrokePoint(point.Position, width);
        }
    }
}
```

A fast pen stroke produces more points than there are `PointerMoved` events. `GetCurrentPoint` returns only the latest point, which draws a jagged line. `GetIntermediatePoints` returns every point since the previous event, in order, ending with the same point `GetCurrentPoint` gives.

### Changing the Cursor

The cursor shown over an element comes from `UIElement.ProtectedCursor`, which defaults to `null` (no change). The property is `protected`, so only a class derived from the element can set it, typically in a custom control:

```csharp
public sealed class ResizeHandle : Grid
{
    public ResizeHandle() =>
        ProtectedCursor = InputSystemCursor.Create(InputSystemCursorShape.SizeWestEast);
}
```

A descendant's cursor wins over its ancestor's, and a captured pointer keeps the capturing element's cursor wherever it moves.

### Capturing a Pointer for Drags

Pointer events normally stop once the pointer leaves an element's bounds. A drag that strays outside the element would stop receiving `PointerMoved` halfway through. Pointer capture prevents that. After `CapturePointer`, every event from that pointer goes to the capturing element wherever the pointer travels, and `PointerReleased` arrives even if the release happens outside it.

Capture succeeds only while the pointer is in contact (a mouse button down, a finger or pen touching), so call it from the `PointerPressed` handler:

```csharp
private void OnThumbPointerPressed(object sender, PointerRoutedEventArgs e)
{
    var thumb = (UIElement)sender;
    if (thumb.CapturePointer(e.Pointer))
    {
        _dragStart = e.GetCurrentPoint(Track).Position;
        e.Handled = true;
    }
}

private void OnThumbPointerReleased(object sender, PointerRoutedEventArgs e)
{
    ((UIElement)sender).ReleasePointerCapture(e.Pointer);
    EndDrag();
}

private void OnThumbPointerCaptureLost(object sender, PointerRoutedEventArgs e)
{
    EndDrag();
}
```

Capture is per pointer, so an element can hold several at once and track two fingers independently. `PointerCaptureLost` fires when the pointer is released, when another element captures it, or when code captures another pointer. There is no matching "capture gained" event. Treat `PointerCaptureLost` as a second way a drag can end, since it can arrive instead of `PointerReleased`.


## Gestures and Manipulations

WinUI recognizes gestures at two levels above raw pointer events.

### Tap, Double-Tap, Right-Tap, and Hold

`Tapped`, `DoubleTapped`, `RightTapped`, and `Holding` are routed events that need no configuration. `RightTapped` fires for a mouse right-click when the button is released, and for a touch press-and-hold when the finger lifts, after a `Holding` event on the same element. For a context menu, though, the recommended route is the element's `ContextFlyout` property, which opens and closes the menu for you. Without it, handle `ContextRequested` rather than `RightTapped`. It also fires for a context request from a non-pointer device such as the keyboard, and in that case `args.TryGetPosition` returns `false` and the menu should open at the element instead of at a point. Mouse input doesn't raise `Holding` by default, however long a button stays down. These events report the device type and a position through `GetPosition`, but not per-pointer details, so drop to pointer events only when you need those.

### Manipulations for Pan, Zoom, and Rotate

Continuous gestures such as dragging, pinch-zooming, and rotating arrive as manipulation events. An element raises them only after you set its `ManipulationMode` to something other than the default `System` or `None`. The flags name what the element accepts: `TranslateX`, `TranslateY`, `TranslateRailsX`, `TranslateRailsY` (translation in a rails mode that holds to one axis), `Rotate`, `Scale`, and the inertia flags `TranslateInertia`, `RotateInertia`, and `ScaleInertia`, which keep the gesture coasting after the fingers lift.

`ManipulationDelta` fires repeatedly during the gesture. Its `Delta` holds the change since the previous event and its `Cumulative` holds the total since the gesture started, each with `Translation`, `Scale`, `Rotation`, and `Expansion`. Applying `Delta` to a transform makes the element follow the fingers:

```xml
<Border x:Name="Photo"
        ManipulationMode="TranslateX,TranslateY,Scale,ScaleInertia"
        ManipulationDelta="OnPhotoManipulationDelta">
    <Border.RenderTransform>
        <CompositeTransform x:Name="PhotoTransform" />
    </Border.RenderTransform>
    <Image Source="Assets/photo.jpg" />
</Border>
```

```csharp
private void OnPhotoManipulationDelta(object sender, ManipulationDeltaRoutedEventArgs e)
{
    PhotoTransform.TranslateX += e.Delta.Translation.X;
    PhotoTransform.TranslateY += e.Delta.Translation.Y;
    PhotoTransform.ScaleX *= e.Delta.Scale;
    PhotoTransform.ScaleY *= e.Delta.Scale;
}
```

With an inertia flag set, `ManipulationDelta` keeps firing after the fingers lift, with shrinking deltas as the motion decays. `ManipulationInertiaStarting` fires at the moment of release and lets you change the deceleration, and `ManipulationCompleted` fires once when the gesture and any inertia have finished.

Before writing a manipulation handler, check whether a control already does the job. `ScrollViewer` provides panning and pinch-zoom with the system's own physics, and the platform guidance is to build custom interactions only when the built-in controls can't support the scenario.


## Keyboard Input

### Key Events and Modifier State

Keyboard events go to the element that has focus and bubble from there. `KeyDown` fires when a key goes down and repeats while it is held, and `KeyUp` fires on release. `e.Key` is a `Windows.System.VirtualKey`. For a game controller, `Key` is the mapped value (the A button reports `Space`) and `OriginalKey` is the raw button.

A modifier doesn't change the `Key` reported for the key pressed with it, so Ctrl+S arrives as `VirtualKey.S`. Read the modifier state with `InputKeyboardSource.GetKeyStateForCurrentThread` from `Microsoft.UI.Input`. A desktop app has no `CoreWindow`, so the UWP-era `CoreWindow.GetForCurrentThread().GetKeyState` fails in code ported from UWP.

```csharp
private void OnEditorKeyDown(object sender, KeyRoutedEventArgs e)
{
    if (e.Key == VirtualKey.Escape)
    {
        CloseFindPanel();
        e.Handled = true;
        return;
    }

    var ctrl = InputKeyboardSource.GetKeyStateForCurrentThread(VirtualKey.Control);
    if (ctrl.HasFlag(CoreVirtualKeyStates.Down) && e.Key == VirtualKey.G)
    {
        GoToNextMatch();
        e.Handled = true;
    }
}
```

`e.KeyStatus` adds details about the press itself, such as `RepeatCount`, `WasKeyDown` (true for an auto-repeat), and `IsMenuKeyDown` (Alt held). For a shortcut like the Ctrl+G above, a keyboard accelerator is usually the better tool, as the next section shows. `KeyDown` is for keys that only mean something while a particular element has focus.

### Text Is Not Keys

Key events report keys, not the characters they produce. Shift, dead keys, and an IME composing one character from several keystrokes all sit between the two. To receive typed characters, handle `CharacterReceived`, which fires after `KeyDown` with the resulting character, or use a `TextBox`. Because `CharacterReceived` comes after `KeyDown`, marking `KeyDown` handled in a text control cancels the character.

### The Order Keyboard Input Is Processed

When a key goes down, WinUI runs through these steps and stops at whichever one marks the input handled:

1. `PreviewKeyDown`, starting at the focused element.
2. Keyboard accelerators declared on the focused element, then that element's `OnKeyDown` (the protected method a custom control overrides to handle its own keys), then its `KeyDown` event.
3. The same three on the parent, and so on up to the root.

If nothing on that route handles the keystroke, WinUI looks elsewhere in the window for a matching accelerator that isn't limited to part of the tree (the next section covers that scoping). `CharacterReceived` follows `KeyDown` for text input, and `PreviewKeyUp` and `KeyUp` follow when the key is released.

{% include figure.html id="winui-key-routing" %}

Two consequences come out of this order. An accelerator that fires marks `KeyDown` handled, so a `KeyDown` handler further up the tree doesn't see that keystroke. And `PreviewKeyDown` runs before everything else, which makes it the one place that can intercept a key a control would otherwise consume.


## Keyboard Accelerators

A keyboard accelerator is a shortcut like Ctrl+S or F5 declared on the element it invokes. The framework watches for the key combination, so you write no `KeyDown` code, and the element doesn't need focus for the shortcut to work.

### Declaring an Accelerator

Add a `KeyboardAccelerator` to the element's `KeyboardAccelerators` collection. `Modifiers` defaults to `None`, so a single key like F2 or Delete works on its own.

```xml
<Button Content="Save" Click="OnSave">
    <Button.KeyboardAccelerators>
        <KeyboardAccelerator Modifiers="Control" Key="S" />
    </Button.KeyboardAccelerators>
</Button>
```

When the shortcut fires, WinUI invokes the element through its UI Automation pattern. A pattern is the standard action a control exposes to assistive technology, such as "invoke" for a button or "toggle" for a check box, and the accelerator uses the same one. WinUI tries them in this priority: Invoke (a `Button`, which raises `Click` and runs its `Command`), Toggle (a `CheckBox`), Selection (a `ListView`), then Expand/Collapse (a `ComboBox`). An element with none of these patterns needs an `Invoked` handler, and without one the accelerator does nothing but log a debug message. Handle `Invoked` also when the shortcut should do something other than the element's own action, such as refreshing a list rather than selecting in it. Setting `args.Handled = true` there skips the automation pattern and stops the accelerator bubbling further.

```xml
<ListView x:Name="TrackList">
    <ListView.KeyboardAccelerators>
        <KeyboardAccelerator Key="F5" Invoked="OnRefreshInvoked" />
    </ListView.KeyboardAccelerators>
</ListView>
```

A `KeyboardAccelerator` object can't be shared. Adding the same instance to two elements fails, so each element declares its own. An accelerator auto-repeats while the key is held, and that can't be turned off.

### Scope and Conflicts

An accelerator is global by default, meaning it's unscoped and the window-wide search at the end of keyboard processing can find it from anywhere. When two match, the first one found in the visual tree wins.

Setting `ScopeOwner` makes an accelerator work only while focus is inside the named element. This is how a context menu's shortcuts stay tied to the list they act on:

```xml
<ListView x:Name="FileList">
    <ListView.ContextFlyout>
        <MenuFlyout>
            <MenuFlyoutItem Text="Rename">
                <MenuFlyoutItem.KeyboardAccelerators>
                    <KeyboardAccelerator Key="F2" ScopeOwner="{x:Bind FileList}" />
                </MenuFlyoutItem.KeyboardAccelerators>
            </MenuFlyoutItem>
        </MenuFlyout>
    </ListView.ContextFlyout>
</ListView>
```

Three more rules decide whether an accelerator fires:

- **A disabled element disables its accelerators.** `KeyboardAccelerator.IsEnabled="False"` turns off one shortcut without touching the element. If a parent declares the same combination, the parent's still fires.
- **Some control accelerators beat app accelerators.** Built-in shortcuts, such as Ctrl+A in a `ListView`, apply only while focus is on that control or one of its children. Some of them also override an app accelerator with the same keys. While a `TextBox` has focus, Ctrl+C copies its selected text and an app's Ctrl+C accelerator is ignored.
- **Closed flyouts differ, by report.** Microsoft doesn't document how accelerators inside a closed flyout behave. The report in microsoft-ui-xaml issue [#448](https://github.com/microsoft/microsoft-ui-xaml/issues/448){:target="_blank" rel="noopener noreferrer"} says that items in a closed `MenuFlyout` still fire and commands in a closed `CommandBarFlyout` don't. Issue [#5437](https://github.com/microsoft/microsoft-ui-xaml/issues/5437){:target="_blank" rel="noopener noreferrer"} adds that a command-bound `MenuFlyoutItem`'s accelerator can keep the enabled state from when the menu was last open. Put a shortcut that has to work on an element that is always in the tree.

### Overriding a Control's Built-In Shortcut

Because a focused control's own shortcut wins, replacing it means intercepting the key in `PreviewKeyDown`, before the control sees it. Microsoft advises against overriding built-in shortcuts because users expect them to behave the same everywhere, but when a custom editor has to replace Ctrl+C, this is how:

```csharp
private void OnEditorPreviewKeyDown(object sender, KeyRoutedEventArgs e)
{
    var ctrl = InputKeyboardSource.GetKeyStateForCurrentThread(VirtualKey.Control);
    if (ctrl.HasFlag(CoreVirtualKeyStates.Down) && e.Key == VirtualKey.C)
    {
        CopyAsRichText();
        e.Handled = true;
    }
}
```

### Showing Shortcuts to Users

Users learn shortcuts by seeing them, and WinUI shows them without extra work. A `MenuFlyoutItem` or `ToggleMenuFlyoutItem` shows its first accelerator next to its text. Other controls show it in their tooltip, and a tooltip you set yourself replaces that. `AppBarButton` and `AppBarToggleButton` also show the shortcut as label text when they sit in a `CommandBar`'s overflow menu. `KeyboardAcceleratorPlacementMode="Hidden"` suppresses the hint, and `KeyboardAcceleratorTextOverride` on menu items and app bar buttons changes the text shown.

Only the first accelerator is displayed. Narrator also announces only the first, as each modifier followed by the key ("Control+Shift+A"), and `AutomationProperties.AcceleratorKey` overrides that text. Setting the property changes only what is announced and adds no shortcut.

When one action appears on several surfaces, such as a toolbar button and a menu item, a `XamlUICommand` can hold the accelerator along with the label and icon, and every control whose `Command` is set to it picks the shortcut up.


## Access Keys

An accelerator runs an action directly, while an access key reaches a visible control. Pressing Alt shows a small badge, called a keytip, next to every control that has an `AccessKey`, and typing the letters in a badge invokes that control. A single-character access key also works as a direct Alt+key shortcut with no keytips shown.

```xml
<CommandBar AccessKey="M">
    <AppBarButton Icon="Refresh" Label="Refresh" AccessKey="R" IsAccessKeyScope="True">
        <AppBarButton.Flyout>
            <MenuFlyout>
                <MenuFlyoutItem Text="Refresh all" AccessKey="A" />
                <MenuFlyoutItem Text="Refresh selected" AccessKey="S" />
            </MenuFlyout>
        </AppBarButton.Flyout>
    </AppBarButton>
</CommandBar>
```

`IsAccessKeyScope="True"` starts a nested scope. The flyout's keys appear only after the user presses R, so the same letter can be reused in different scopes and the screen doesn't fill with badges at once. Within one scope, if two elements share a key, the first added to the visual tree wins and the rest are ignored. If one key is a prefix of another ("A" and "AB"), the single-character key wins. Pressing Enter, Esc, Tab, or an arrow key leaves access-key mode and returns keystrokes to the app.

Access keys and accelerators are localized the same way, through `x:Uid` and the resource file, since a letter that suits "Home" in English rarely suits the translated word.


## Focus

Keyboard, game controller, and assistive technology users all operate the app through focus. Only one element in the app has keyboard focus at a time, and that element receives key events. Logical focus is a separate idea. Each focus scope, such as the main tree or an open popup, remembers one focused element, so the app can hold several elements with logical focus while only one of them has keyboard focus.

### Tab Order

Every interactive control is in the tab order by default, since `IsEnabled` and `IsTabStop` both default to `true`. Layout panels such as `Grid` and `StackPanel` aren't interactive controls and aren't tab stops. The default order comes from the element tree, the order elements appear in XAML, which doesn't always match where layout places them on screen. A `Grid` that positions its children with `Grid.Row` and `Grid.Column` can tab in an order that doesn't follow the screen.

`TabIndex` overrides the default order. Lower values come first, and a control without a `TabIndex` goes after every control that has one. The numbers only compare within one container. The children of a panel form their own scope, and Tab works through that whole scope before moving on. So numbering controls 1 to 10 across two nested panels doesn't interleave them, because the panel is ordered among its siblings as a unit. `IsTabStop="False"` removes a control from the tab order without disabling it.

```xml
<TextBox Header="First name" TabIndex="1" />
<TextBox Header="Email" TabIndex="3" />
<TextBox Header="Last name" TabIndex="2" />
```

`TabFocusNavigation` on a container sets how Tab moves through its children:

| Value | Tab behavior inside the container |
|---|---|
| `Local` (default) | Tab visits each child in turn, then leaves the container |
| `Once` | The container and its children take a single tab stop |
| `Cycle` | Tab loops back to the first child and never leaves |

`Once` suits a toolbar, paired with arrow-key navigation inside it (below). `Cycle` suits a region that should keep focus until the user dismisses it.

### Arrow-Key and D-Pad Navigation

Focus can also move directionally, to the best candidate in the pressed direction. A game controller's D-pad and a remote control move focus this way. The keyboard's arrow keys do it only inside a container where `XYFocusKeyboardNavigation="Enabled"`, which its children inherit. With every ancestor left at the default `Auto`, the arrow keys don't move focus between controls at all. A nested container set to `Disabled` blocks arrow navigation into itself and its children.

When the automatic choice picks the wrong target in an irregular layout, `XYFocusUp`, `XYFocusDown`, `XYFocusLeft`, and `XYFocusRight` on a `UIElement` name the element that should receive focus in each direction. The `XYFocusUpNavigationStrategy` property and its three siblings change how the candidate is chosen:

| Strategy | Picks |
|---|---|
| `Projection` (used when every ancestor is `Auto`) | The first element hit by projecting the focused element's edge in the pressed direction |
| `NavigationDirectionDistance` | The element closest to the axis of the pressed direction |
| `RectilinearDistance` | The closest element by horizontal plus vertical distance |

```xml
<StackPanel XYFocusKeyboardNavigation="Enabled">
    <StackPanel Orientation="Horizontal">
        <Button Content="Previous" />
        <Button Content="Play" XYFocusDown="{x:Bind VolumeSlider}" />
        <Button Content="Next" />
    </StackPanel>
    <Slider x:Name="VolumeSlider" Header="Volume" Width="300" HorizontalAlignment="Left" />
</StackPanel>
```

Keep directional areas out of an explicit tab order. Tab should enter the area and the arrow keys should move within it, and setting `TabIndex` on its children fights that.

### Moving Focus in Code

`element.Focus(FocusState)` moves focus to a specific element. It returns `true` only when both keyboard focus and logical focus land on it. The `FocusState` argument (`Keyboard`, `Pointer`, or `Programmatic`) tells the control's template how focus arrived, and templates use it to decide whether to draw the focus visual, which is meant for keyboard navigation. Pass `Keyboard` when the move answers a key press and `Programmatic` when it doesn't.

`FocusManager.TryMoveFocus(FocusNavigationDirection)` moves focus relative to the current element, following the tab order for `Next` and `Previous` and wrapping at either end. In desktop apps, the overload without options has been reported to throw a `COMException` (microsoft-ui-xaml issue [#5593](https://github.com/microsoft/microsoft-ui-xaml/issues/5593){:target="_blank" rel="noopener noreferrer"}, closed without a fix). A WinUI contributor answering in that issue says non-UWP apps need the overload that takes `FindNextElementOptions`, with `SearchRoot` set to the window's root element, `element.XamlRoot.Content`. A `SearchRoot` below the root allows only `Up`, `Down`, `Left`, and `Right`, not `Next` or `Previous`. The API reference doesn't state either rule.

To find out which element has focus, call `FocusManager.GetFocusedElement(xamlRoot)` with the `XamlRoot` of the window you're asking about. The parameterless `GetFocusedElement()` is deprecated, and Microsoft says to pass the `XamlRoot` to get correct behavior when the app has more than one window.

`FocusManager.FindNextElement` returns the directional candidate without moving to it, and its `FindNextElementOptions` can limit the search to a `SearchRoot`, exclude a region, or override the strategy.

```csharp
private void OnGridKeyDown(object sender, KeyRoutedEventArgs e)
{
    if (e.Key != VirtualKey.Down) return;

    var options = new FindNextElementOptions { SearchRoot = BoardGrid };
    if (FocusManager.FindNextElement(FocusNavigationDirection.Down, options) is Control next)
    {
        next.Focus(FocusState.Keyboard);
        e.Handled = true;
    }
}
```

Focus changes raise four routed events in order: `LosingFocus`, `GettingFocus`, `LostFocus`, `GotFocus`. The first two are synchronous and let you redirect focus through `args.TryRedirect` or cancel it with `args.TryCancel`, which is how a list sends incoming focus to its selected item. Calling `Focus` or `TryMoveFocus` while those two are bubbling throws. `LostFocus` and `GotFocus` are asynchronous, so focus may already have moved again by the time they run.

### Focus Visuals

The focus visual is the rectangle drawn around the focused control during keyboard navigation. `Application.FocusVisualKind` sets its style for the whole app. The default, `HighVisibility`, draws a solid outer and inner rectangle in contrasting colors. The other values are `Reveal`, which adds a glow, and `DottedLine`. `FrameworkElement.FocusVisualPrimaryBrush`, `FocusVisualSecondaryBrush`, and their matching thickness properties customize the high-visibility rectangle per element. A custom control gets the same system-drawn visual by setting `UseSystemFocusVisuals="True"`, usually in its default style.
