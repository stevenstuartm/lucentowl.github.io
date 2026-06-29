---
title: "Input Handling and Gestures"
layout: guide
category: "WinUI 3"
subcategory: "Window & Input"
description: "Handling pointer, touch, pen, keyboard, and gesture input in WinUI 3 including focus management, keyboard accelerators, and the XamlUICommand system."
tags: [winui, winui-3, xaml, input, gestures, keyboard, accessibility, desktop]
---

## Table of Contents

- [Unified Pointer Model](#unified-pointer-model)
- [PointerPointProperties](#pointerpointproperties)
- [Pointer Capture](#pointer-capture)
- [Gesture Recognition](#gesture-recognition)
- [Keyboard Input](#keyboard-input)
- [Keyboard Accelerators](#keyboard-accelerators)
- [Focus Management](#focus-management)
- [XamlUICommand and StandardUICommand](#xamluicommand-and-standarduicommand)
- [Hit Testing](#hit-testing)


## Unified Pointer Model

WinUI 3 handles mouse, touch, and pen input through a single unified pointer model rather than separate event hierarchies. Every pointing device produces `PointerRoutedEventArgs` on the same set of events, so a single handler can process all three input types without branching on device kind upfront.

The core events are `PointerPressed`, `PointerMoved`, and `PointerReleased`, with `PointerEntered` and `PointerExited` providing hit-region transitions. All of these are routed events, so they bubble up the visual tree and can be handled at any ancestor element.

```csharp
private void OnPointerPressed(object sender, PointerRoutedEventArgs e)
{
    var point = e.GetCurrentPoint(this);
    var position = point.Position; // Point in element-local coordinates
    var deviceType = point.PointerDeviceType; // Mouse, Touch, or Pen
}
```

Marking `e.Handled = true` stops the event from bubbling further, which matters when a parent element also handles the same event. Leave it unhandled when you want both a child and a parent to respond.


## PointerPointProperties

Each `PointerPoint` exposes a `Properties` object that carries device-specific data beyond simple position. For a pen, `Pressure` gives a normalized value between 0 and 1 representing how hard the stylus is pressed, and `XTilt` and `YTilt` describe the angle of the pen relative to the screen surface.

For touch, `ContactRect` and `ContactRectRaw` return the estimated area of finger contact rather than a single coordinate. This is valuable for touch-aware layouts that need to distinguish a precise tap from a broad thumb press.

Mouse input adds `IsLeftButtonPressed`, `IsRightButtonPressed`, and `IsMiddleButtonPressed`, along with `MouseWheelDelta` on scroll events. Checking `PointerDeviceType` before accessing pressure or contact rect avoids reading irrelevant data.

```csharp
private void OnPointerMoved(object sender, PointerRoutedEventArgs e)
{
    var props = e.GetCurrentPoint(this).Properties;
    if (e.Pointer.PointerDeviceType == PointerDeviceType.Pen)
    {
        double pressure = props.Pressure;
        // Adjust stroke width based on pressure
    }
}
```


## Pointer Capture

Under normal circumstances a pointer event stops being delivered to an element once the pointer leaves its bounds. Pointer capture changes this: after calling `element.CapturePointer(e.Pointer)`, all subsequent events from that pointer route to the capturing element regardless of where the pointer travels.

This is the standard mechanism for drag operations. Without capture, dragging outside the control bounds would cause the element to stop receiving `PointerMoved` events mid-drag.

```csharp
private void OnPointerPressed(object sender, PointerRoutedEventArgs e)
{
    _isDragging = true;
    ((UIElement)sender).CapturePointer(e.Pointer);
}

private void OnPointerReleased(object sender, PointerRoutedEventArgs e)
{
    _isDragging = false;
    ((UIElement)sender).ReleasePointerCapture(e.Pointer);
}
```

An element can hold capture for multiple pointers simultaneously, which enables two-finger gestures where each pointer is tracked independently. The `PointerCaptureLost` event fires when capture is released, either programmatically or because the system reclaimed it (for example, when an application loses focus).


## Gesture Recognition

Higher-level touch gestures are surfaced through manipulation events rather than raw pointer events. To receive manipulation events, set the `ManipulationMode` property on the element to indicate which gestures it supports. The options include `TranslateX`, `TranslateY`, `Scale`, `Rotate`, and combinations thereof, plus `TranslateInertia`, `ScaleInertia`, and `RotateInertia` to enable physics-based deceleration after the fingers lift.

```xml
<Border ManipulationMode="TranslateX,TranslateY,Scale,ScaleInertia"
        ManipulationStarted="OnManipulationStarted"
        ManipulationDelta="OnManipulationDelta"
        ManipulationCompleted="OnManipulationCompleted">
    <!-- content -->
</Border>
```

The `ManipulationDelta` event fires continuously during the gesture and carries cumulative and delta transforms in its `Delta` and `Cumulative` properties. `Delta.Scale` gives the scale ratio since the last event, while `Cumulative.Scale` gives the total scale from when the manipulation started.

```csharp
private void OnManipulationDelta(object sender, ManipulationDeltaRoutedEventArgs e)
{
    var composite = _transform;
    composite.TranslateX += e.Delta.Translation.X;
    composite.TranslateY += e.Delta.Translation.Y;
    composite.ScaleX *= e.Delta.Scale;
    composite.ScaleY *= e.Delta.Scale;
    myElement.RenderTransform = composite;
}
```

When inertia flags are set in `ManipulationMode`, the system continues firing `ManipulationDelta` after the fingers lift, gradually reducing the delta values as momentum decays. `ManipulationCompleted` fires once when the gesture and any inertia phase finishes.


## Keyboard Input

Keyboard events in WinUI 3 follow the same routed event pattern as pointer events. `KeyDown` fires when a key is pressed and `KeyUp` fires on release. Both carry a `VirtualKey` enum value that identifies the key.

```csharp
private void OnKeyDown(object sender, KeyRoutedEventArgs e)
{
    if (e.Key == VirtualKey.Escape)
    {
        ClosePanel();
        e.Handled = true;
    }
}
```

Modifier keys like Ctrl, Shift, and Alt do not change the `VirtualKey` reported on the primary key event. Instead, check the current state of modifier keys using `InputKeyboardSource.GetKeyStateForCurrentThread` or the older `CoreWindow.GetForCurrentThread().GetKeyState`. A more ergonomic approach is to read the keyboard modifiers via `KeyRoutedEventArgs.KeyStatus`, which includes `IsMenuKeyDown` for Alt.

For detecting Ctrl+S or similar combinations, query the Ctrl key state inside the `KeyDown` handler:

```csharp
private void OnKeyDown(object sender, KeyRoutedEventArgs e)
{
    var ctrlState = InputKeyboardSource.GetKeyStateForCurrentThread(VirtualKey.Control);
    bool ctrlDown = ctrlState.HasFlag(CoreVirtualKeyStates.Down);

    if (ctrlDown && e.Key == VirtualKey.S)
    {
        SaveDocument();
        e.Handled = true;
    }
}
```

Text input characters are better captured through `TextCompositionStarted` and related events, or through a `TextBox` directly, because raw key codes do not account for IME composition, dead keys, or keyboard layout remapping.


## Keyboard Accelerators

Keyboard accelerators offer a cleaner alternative to manual key-state checking in `KeyDown`. Adding a `KeyboardAccelerator` to any `UIElement` declares a shortcut at the control level, and the framework dispatches it without requiring the element to have focus.

```xml
<Button Content="Save">
    <Button.KeyboardAccelerators>
        <KeyboardAccelerator Modifiers="Control" Key="S" />
    </Button.KeyboardAccelerators>
</Button>
```

Accelerators registered this way invoke the element's `Click` event or `Command` automatically. For more control, handle the `Invoked` event on the accelerator itself:

```xml
<KeyboardAccelerator Modifiers="Control" Key="S" Invoked="OnSaveAccelerator" />
```

By default, WinUI shows accelerator hints in tooltips and flyouts without extra work. Menu items display the shortcut text automatically when a matching `KeyboardAccelerator` is attached to the same command. Setting `KeyboardAccelerator.ScopeOwner` limits an accelerator to a specific subtree, which prevents global shortcuts from conflicting with accelerators that are only meaningful inside a particular panel or dialog.

The `IsEnabled` property on `KeyboardAccelerator` allows shortcuts to be toggled without removing them from the element, which is useful when disabling commands contextually.


## Focus Management

Tab navigation follows the visual order of elements in the tree by default. Setting `TabIndex` overrides this order numerically, and setting `IsTabStop="False"` removes an element from the tab sequence entirely without disabling it. Container controls like `StackPanel` are excluded from tab stop by default; only leaf controls like `Button` and `TextBox` participate.

```xml
<TextBox TabIndex="1" />
<TextBox TabIndex="3" />
<TextBox TabIndex="2" /> <!-- receives focus second despite visual order -->
```

For spatial navigation in game-pad and remote scenarios, the `XYFocusUp`, `XYFocusDown`, `XYFocusLeft`, and `XYFocusRight` properties explicitly wire focus movement between elements. Without them, WinUI uses a heuristic based on element positions, which works adequately for simple grids but can produce confusing focus jumps in irregular layouts.

Programmatic focus moves are handled through `FocusManager.TryMoveFocus` and `FocusManager.TryFocusAsync`. `TryMoveFocus` accepts a `FocusNavigationDirection` and moves focus in that direction from the currently focused element, respecting tab stops. `TryFocusAsync` moves focus to a specific element:

```csharp
await FocusManager.TryFocusAsync(targetElement, FocusState.Programmatic);
```

The `FocusState` argument communicates why focus moved. `FocusState.Programmatic` suppresses the visual focus indicator on some control styles, which is appropriate when the user did not trigger the navigation. `FocusState.Keyboard` keeps the indicator visible.

`FocusVisualKind` on a control determines whether the focus rectangle is drawn by the system (`HighVisibility`) or by the control's own style (`Reveal`). High visibility mode draws a thick outer rect suitable for accessibility, while reveal mode integrates with the control's Fluent Design styling.


## XamlUICommand and StandardUICommand

The `XamlUICommand` class bundles a command definition, its icon, label, description, and keyboard accelerator into a single reusable object. Rather than defining a shortcut on one control and an icon on another, a `XamlUICommand` keeps these synchronized in one place.

```csharp
var saveCommand = new XamlUICommand
{
    Label = "Save",
    Description = "Save the current document",
    IconSource = new SymbolIconSource { Symbol = Symbol.Save },
    KeyboardAccelerators = { new KeyboardAccelerator { Modifiers = VirtualKeyModifiers.Control, Key = VirtualKey.S } }
};
saveCommand.ExecuteRequested += (cmd, args) => SaveDocument();
saveCommand.CanExecuteRequested += (cmd, args) => args.CanExecute = HasUnsavedChanges();
```

Assign the command to multiple controls and all of them share the same label, icon, and accelerator without duplication:

```xml
<AppBarButton Command="{x:Bind SaveCommand}" />
<MenuFlyoutItem Command="{x:Bind SaveCommand}" />
```

`StandardUICommand` extends this with a set of built-in commands such as `Copy`, `Paste`, `Cut`, `Delete`, `Undo`, `Redo`, `Select`, `SelectAll`, `Open`, `Save`, and `SaveAs`. These carry the platform-standard labels, icons, and keyboard shortcuts automatically, so applications that use standard editing operations do not need to redeclare the common shortcuts.

```csharp
var deleteCommand = new StandardUICommand(StandardUICommandKind.Delete);
deleteCommand.ExecuteRequested += (cmd, args) => DeleteSelectedItem();
```

Using `StandardUICommand` for common operations also benefits accessibility, since assistive technologies recognize the semantic meaning of standard commands beyond just their label text.


## Hit Testing

When a pointer event arrives, WinUI walks the visual tree from front to back to find the topmost element whose bounds contain the pointer position. This is hit testing. Only elements that are visible, have a non-zero opacity, and have `IsHitTestVisible` set to `true` participate.

Setting `IsHitTestVisible="False"` makes an element completely transparent to input. The element remains visible on screen but pointer events pass through it to whatever lies underneath. This is useful for decorative overlays or visual indicators that should not intercept clicks intended for controls beneath them.

```xml
<Grid>
    <Button Content="Clickable" />
    <Border IsHitTestVisible="False" Background="#20FF0000" />
    <!-- The red overlay is visible but clicks reach the Button -->
</Grid>
```

`Background="Transparent"` alone does not disable hit testing; a transparent background still participates in hit testing by default. Setting `Background` to `null` (no brush) causes a panel to be hit-testable only on its children, not on the empty space between them. This distinction matters for containers like `Grid` where you may want clicks on empty areas to fall through.

Custom shapes that draw outside their layout bounds can use the `UIElement.TransformToVisual` and geometry intersection methods to implement custom hit testing logic, though this is rarely necessary for standard controls.

Custom hit testing becomes relevant when building ink canvases, game-style interfaces, or non-rectangular controls. In these scenarios, override `HitTestCore` in a custom panel or use `VisualTreeHelper.FindElementsInHostCoordinates` to query which elements intersect a given point or rectangle:

```csharp
var elements = VisualTreeHelper.FindElementsInHostCoordinates(
    new Point(x, y),
    rootElement);
```

This returns elements in z-order from front to back, which lets you implement custom dispatch logic or find all elements under a point rather than just the topmost one.
