---
title: "Basic Input Controls in WinUI 3"
layout: guide
category: "WinUI 3"
subcategory: "Controls & UI"
description: "A guide to the foundational input controls in WinUI 3 including buttons, toggles, sliders, text entry, and selection controls for building interactive interfaces."
tags: [winui, winui-3, xaml, controls, ui-framework, desktop, practical]
---

WinUI 3 ships with a rich set of input controls that handle the most common interaction patterns in desktop applications. Understanding these controls, knowing when to reach for each one, and knowing how to configure them well saves considerable time compared to building custom interaction logic from scratch. This guide walks through the foundational input controls grouped by their purpose.

## Table of Contents

- [The Button Family](#the-button-family)
- [Toggle Controls](#toggle-controls)
- [CheckBox](#checkbox)
- [RadioButtons](#radiobuttons)
- [Slider](#slider)
- [ComboBox](#combobox)
- [TextBox](#textbox)
- [PasswordBox](#passwordbox)
- [NumberBox](#numberbox)
- [AutoSuggestBox](#autosuggestbox)
- [RichEditBox](#richeditbox)

## The Button Family

Buttons are the most direct way for users to trigger an action. WinUI 3 provides several button types, each suited to a different context.

`Button` is the baseline. It fires a `Click` event when pressed and supports the `Command` property for MVVM scenarios. Command binding is almost always preferable to code-behind event handlers because it keeps the view decoupled from logic and makes the enabled state automatic through `ICommand.CanExecute`.

```xml
<Button Content="Save" Command="{x:Bind ViewModel.SaveCommand}" />
```

`RepeatButton` fires `Click` continuously while held down, not just once. This is useful for controls like increment/decrement steppers or scroll actions where holding a button should keep advancing a value.

`HyperlinkButton` renders as an inline text link and is the right choice when navigating to a URI or another page in the application. It accepts a `NavigateUri` for external links or a `Click` handler for in-app navigation.

`DropDownButton` combines a label with a chevron that opens a `Flyout`. It is useful when a primary label needs to reveal a small set of related choices rather than committing to a single action immediately.

`SplitButton` splits the control into two hit areas: a primary action on the left and a dropdown on the right. The left side fires `Click` for the default action while the right side opens a `Flyout` with alternatives. A formatting toolbar that applies the last-used format on the left while letting the user choose a different format from the dropdown on the right is a good example of when this works well.

```xml
<SplitButton Content="Format" Click="OnFormatClick">
    <SplitButton.Flyout>
        <MenuFlyout>
            <MenuFlyoutItem Text="Bold" />
            <MenuFlyoutItem Text="Italic" />
        </MenuFlyout>
    </SplitButton.Flyout>
</SplitButton>
```

## Toggle Controls

Two controls represent on/off state: `ToggleButton` and `ToggleSwitch`. They look different and belong in different contexts.

`ToggleButton` looks and behaves like a regular button but stays visually "pressed" when active. It is well suited to toolbars where multiple formatting or view options can be toggled independently, such as bold, italic, and underline in a text editor. The `IsChecked` property holds its state, and it can participate in `ToggleButton` groups when multiple related options need to work together.

`ToggleSwitch` renders as a horizontal switch with an on/off label and is the right control for settings pages. Its visual language communicates an immediate effect, so users understand that flipping it changes something right now rather than staging a change for later confirmation. Avoid using `ToggleSwitch` in toolbars; the switch metaphor implies persistent settings rather than mode toggles tied to a focused document or selection.

```xml
<ToggleSwitch Header="Enable notifications" IsOn="{x:Bind ViewModel.NotificationsEnabled, Mode=TwoWay}" />
```

## CheckBox

`CheckBox` represents a boolean choice that the user opts into or out of. In its default two-state form, it is checked or unchecked. The `IsChecked` property is a nullable bool, which opens the door to a third indeterminate state when `IsThreeState` is set to true.

The three-state mode makes sense when the checkbox summarizes the state of a collection of child checkboxes. If some children are checked and others are not, the parent checkbox shows the indeterminate state to signal the mixed condition rather than implying all-or-nothing. A "Select All" checkbox above a list of items with independent checkboxes is the canonical example. Setting `IsChecked` to `null` puts the control in the indeterminate state programmatically.

```xml
<CheckBox Content="Select all" IsThreeState="True" IsChecked="{x:Bind ViewModel.SelectAllState, Mode=TwoWay}" />
```

For straightforward yes/no options where there is no parent/child relationship, stick to the default two-state behavior and leave `IsThreeState` at false.

## RadioButtons

WinUI 3 introduced the `RadioButtons` control as the recommended replacement for manually grouping legacy `RadioButton` elements. The difference matters in practice. The older approach required developers to assign the same `GroupName` to each `RadioButton` and handle layout manually. `RadioButtons` wraps a collection of items, manages mutual exclusivity automatically, and provides built-in keyboard navigation that meets accessibility standards without extra work.

The control accepts items directly or through data binding via `ItemsSource`. It can display a header above the group and supports both `MaxColumns` for multi-column layouts and single-column vertical stacking.

```xml
<RadioButtons Header="Theme" SelectedIndex="0">
    <RadioButton Content="Light" />
    <RadioButton Content="Dark" />
    <RadioButton Content="System default" />
</RadioButtons>
```

Keyboard navigation within the group follows a roving tabindex pattern, meaning tab moves focus into and out of the group as a whole while arrow keys move between options inside it. This behavior is correct per ARIA guidelines and does not require manual implementation when using `RadioButtons`.

## Slider

`Slider` lets users choose a numeric value from a continuous or stepped range by dragging a thumb along a track. The basic configuration involves `Minimum`, `Maximum`, and `Value`. When the range should snap to specific increments, `StepFrequency` controls the step size and `SnapsTo` determines whether snapping applies to steps, tick marks, or not at all.

Tick marks can be shown with `TickFrequency` and `TickPlacement`. Setting `TickPlacement` to `Outside`, `Inline`, or `Both` controls where marks appear relative to the track. Showing ticks communicates the discrete nature of the choices, which matters when users need to land on meaningful values like 25%, 50%, 75%.

`Orientation` can be `Horizontal` or `Vertical`. Vertical sliders are less common but appropriate for controls like a volume fader in an audio interface.

```xml
<Slider Minimum="0" Maximum="100" StepFrequency="5"
        TickFrequency="10" TickPlacement="Outside"
        Value="{x:Bind ViewModel.Volume, Mode=TwoWay}" />
```

## ComboBox

`ComboBox` presents a collapsed list that expands when the user clicks it, allowing selection of one item from a set of options. It is the right choice when the list of options is long enough that showing them all inline would consume too much vertical space.

Items can be declared inline in XAML or bound through `ItemsSource`. For data binding, `DisplayMemberPath` points to the property on each item object that should display as the label, and `SelectedValuePath` identifies the backing value property.

```xml
<ComboBox ItemsSource="{x:Bind ViewModel.Countries}"
          DisplayMemberPath="Name"
          SelectedValuePath="Code"
          SelectedValue="{x:Bind ViewModel.SelectedCountryCode, Mode=TwoWay}" />
```

Setting `IsEditable="True"` converts the ComboBox into an editable combo, where the user can type a value that is not in the list. This is appropriate when the list covers common choices but the user may have a custom value to enter. Be careful with editable combos in situations where only the listed values are valid; `AutoSuggestBox` is usually a better fit for open-ended text entry with suggestions.

## TextBox

`TextBox` covers the majority of text input needs. For a single line of input, the default configuration works. Setting `AcceptsReturn="True"` enables multi-line entry. `TextWrapping="Wrap"` keeps long lines visible rather than scrolling horizontally.

`PlaceholderText` sets the greyed-out hint text shown when the field is empty, which is useful for communicating expected input format without needing a separate label for obvious fields.

Input validation can be approached through two events with different timing. `TextChanged` fires after each keystroke and delivers the committed value. `TextChanging` fires before the text is updated, giving the handler a chance to intercept and modify or cancel the change before it appears. `TextChanging` is more appropriate for real-time filtering, such as preventing non-numeric characters from being entered into a field that expects only digits.

```xml
<TextBox PlaceholderText="Search..." TextChanging="OnSearchTextChanging" />
```

For longer blocks of unformatted user text such as notes or comments, increase `MinHeight` and set `AcceptsReturn` and `TextWrapping` together. Avoid using `TextBox` as a display-only surface; read-only labels belong in `TextBlock` elements, which carry no interactive affordance and communicate clearly that the content is not editable.

## PasswordBox

`PasswordBox` provides a secure text entry field that masks characters as the user types. Unlike `TextBox`, it does not expose a `Text` property that can be data-bound in the usual way. The password value is retrieved through the `Password` property, which returns a plain string, so the application is still responsible for handling that value securely once it has been read.

`PasswordRevealMode` controls whether the reveal button appears. The options are `Peek` (the default, showing the button), `Hidden` (no reveal button at all), and `Visible` (shows the password without any button, useful if a separate show/hide toggle is implemented externally).

```xml
<PasswordBox PlaceholderText="Enter password" PasswordRevealMode="Peek" />
```

## NumberBox

`NumberBox` is the right control whenever numeric input is required with validation. Unlike a plain `TextBox` with manual parsing logic, `NumberBox` enforces numeric input natively, handles formatting, and optionally shows increment and decrement spin buttons.

`SpinButtonPlacementMode` controls the spin button behavior. Setting it to `Compact` shows buttons only when the control has focus; `Inline` always shows them. Setting it to `Hidden` removes them, which is appropriate when the user will always type a value directly.

`SmallChange` and `LargeChange` configure how much the value moves per spin button click and per Page Up/Page Down key press respectively. `NumberFormatter` accepts a formatter object from the Windows.Globalization.NumberFormatting namespace to control decimal precision, currency symbols, and other display options.

`NumberBox` also accepts basic mathematical expressions when `AcceptsExpression="True"` is set. A user can type something like `10 + 5` and the control evaluates it to `15` on commit. This is a convenience for productivity applications where the user may want to compute a value rather than type the result directly.

```xml
<NumberBox Header="Quantity" Value="{x:Bind ViewModel.Quantity, Mode=TwoWay}"
           SpinButtonPlacementMode="Compact"
           SmallChange="1" Minimum="0" Maximum="1000" />
```

## AutoSuggestBox

`AutoSuggestBox` combines a text field with a dropdown suggestion list that updates as the user types. It is the standard pattern for search fields and anywhere the application can offer useful completions based on partial input.

The `TextChanged` event fires as the user types. The handler receives the current text and a reason code indicating whether the change came from user input or programmatic assignment. The handler is responsible for filtering or fetching candidates and then assigning them to `ItemsSource` to populate the dropdown.

`QuerySubmitted` fires when the user presses Enter or selects a suggestion. The event arguments carry both the chosen suggestion object (if a suggestion was selected) and the query text (if the user submitted without selecting). This distinction matters because the application may need to handle search-by-text differently from navigating to a specific matched item.

`SuggestionChosen` fires when the user highlights a suggestion through keyboard navigation before committing, which can be used to preview or pre-fill related fields.

```xml
<AutoSuggestBox PlaceholderText="Search contacts..."
                TextChanged="OnSearchTextChanged"
                QuerySubmitted="OnQuerySubmitted" />
```

Keep the suggestion list short and meaningful. Showing more than around eight items at a time creates a list that the user must scroll through, which defeats the purpose of type-ahead filtering.

## RichEditBox

`RichEditBox` is a full rich-text editor control that supports bold, italic, underline, font changes, paragraph alignment, and other formatting through its document model. Content is manipulated programmatically through the `Document` property, which exposes an `ITextDocument` interface with methods for getting and setting selection, applying formatting, and loading or saving RTF content.

Use `RichEditBox` when the application genuinely needs to let users produce formatted text, such as a notes editor, an email composition field, or a simple word processor. For plain text input, even multi-line text, `TextBox` is simpler and faster to configure. It also avoids the complexity of the document model. `RichEditBox` does not support `PlaceholderText` or straightforward two-way data binding; getting and setting content requires interacting with the document API directly.

```csharp
// Reading content as plain text
string plainText;
RichEditor.Document.GetText(Windows.UI.Text.TextGetOptions.None, out plainText);

// Applying bold to the current selection
RichEditor.Document.Selection.CharacterFormat.Bold = Windows.UI.Text.FormatEffect.On;
```

The choice between `TextBox` and `RichEditBox` comes down to whether formatting is a feature the application needs to support. If users just need to enter and read text, use `TextBox`. If formatting is part of the value being captured, use `RichEditBox`.
