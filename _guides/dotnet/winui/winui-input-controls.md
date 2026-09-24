---
title: "Input Controls in WinUI 3"
layout: guide
category: "WinUI 3"
subcategory: "Controls & UI"
description: "Choosing and configuring WinUI 3's input controls: the button family, toggles and check boxes, RadioButtons, ComboBox, and SelectorBar for picking one option, Slider and NumberBox for numbers, TextBox and its three text events, PasswordBox, AutoSuggestBox, RichEditBox, the date and time pickers, ColorPicker, RatingControl, and the Community Toolkit's SettingsCard, SettingsExpander, and Segmented."
tags: [buttons, text-input, numberbox, date-time-pickers, radiobuttons, community-toolkit, practical]
---

## Buttons

### Button and Its Click

`Button` starts an immediate action, such as submitting a form. It raises `Click` when the user releases a mouse press over it, taps it, or presses Enter or Space while it has focus. It also has a `Command` property that takes an `ICommand`, which is the usual choice in MVVM code because the command's `CanExecute` result enables and disables the button without extra code.

```xml
<Button Content="Save" Command="{x:Bind ViewModel.SaveCommand}" />
```

A button's `Content` can be any object. Text is typical, but a `StackPanel` holding an icon and a label works too. Don't use a `Button` to move to another page. Microsoft's guidance reserves navigation for `HyperlinkButton`, which is styled as a link.

### Specialized Buttons

| Control | Behavior | Typical use |
| --- | --- | --- |
| `RepeatButton` | Raises `Click` repeatedly while held. `Delay` sets the wait before repeating starts and `Interval` the time between repeats, both in milliseconds | Increment and decrement steppers |
| `HyperlinkButton` | Looks like a link. `NavigateUri` opens a URI, or handle `Click` for in-app navigation | Links and navigation |
| `DropDownButton` | A button with a chevron that opens its `Flyout`. It still has `Click`, but you rarely handle it | A small set of related choices behind one label |
| `SplitButton` | Two halves. The main half raises `Click`, the chevron half opens the `Flyout` | Repeat the last choice, or pick another |
| `ToggleSplitButton` | Like `SplitButton`, but the main half toggles on and off. `IsChecked` is a plain `bool`, and it raises `IsCheckedChanged` rather than `Checked` and `Unchecked` | A feature with variants, such as list formatting with a choice of bullet style |
| `ToggleButton` | A button that stays pressed while on | See On/Off Choices |

`SplitButton` and `ToggleSplitButton` behave differently under touch. A tap on either half opens the flyout, so the main half's `Click` never fires. The flyout's items must therefore apply the action themselves, not just record which option was picked. For `ToggleSplitButton`, the flyout also needs an item that turns the feature off.

```xml
<SplitButton Content="Highlight" Click="OnHighlightClick">
    <SplitButton.Flyout>
        <MenuFlyout>
            <MenuFlyoutItem Text="Yellow" Click="OnHighlightColorClick" />
            <MenuFlyoutItem Text="Green" Click="OnHighlightColorClick" />
        </MenuFlyout>
    </SplitButton.Flyout>
</SplitButton>
```

## On/Off Choices

### ToggleSwitch or CheckBox

Both hold a binary value. They differ in when the value takes effect.

`ToggleSwitch` acts immediately, like a light switch. Flipping it changes something now, so it suits a settings page where each change applies as it is made. Its state is `IsOn`, and it raises `Toggled`. The default On and Off labels are localized automatically, and `OnContent` and `OffContent` replace them.

`CheckBox` records a choice that takes effect later. Use one on a form that the user must still submit, for optional items, or when the user can select several related options. With a toggle switch, "on" is unambiguous. A check box on a settings page leaves the user wondering whether checking it has already turned the feature on.

```xml
<ToggleSwitch Header="Notifications" IsOn="{x:Bind ViewModel.NotificationsEnabled, Mode=TwoWay}" />
```

`ToggleButton` is a third option. It's a button that stays pressed while on, as a bold or italic button in an editor's toolbar might. Inside a `CommandBar`, use `AppBarToggleButton` instead. Microsoft's guidance prefers a check box, radio button, or toggle switch unless the UI specifically benefits from a button.

### CheckBox's Indeterminate State

`CheckBox.IsChecked` is a `bool?`. With `IsThreeState="True"`, it can also be `null`, which displays as indeterminate. The indeterminate state means "some but not all of the sub-items are set," as in a "Select all" box above a list of options. It isn't a third value in its own right. For low, medium, and high, use three radio buttons.

Your code sets the indeterminate state by assigning `null` when the children are mixed. The catch is that with `IsThreeState` on, the user's own clicks also cycle through indeterminate. Microsoft's sample handles the `Indeterminate` event and, when all children are already checked, sets the parent to `false` instead, so the user never lands on the mixed state directly.

To react to changes in code, handle `Click`, which fires on every change, or handle both `Checked` and `Unchecked`, which fire independently. Handling only `Checked` misses the user clearing the box.

Because `IsChecked` is nullable, binding it to a plain `bool` needs a cast in `x:Bind` (`{x:Bind (x:Boolean)Box.IsChecked, Mode=OneWay}`) or a value converter.

## Picking One Option from a Set

### Choosing the Control

| Situation | Control |
| --- | --- |
| Two options that read as one yes/no choice | A single `CheckBox` or `ToggleSwitch`, not two radio buttons |
| Up to about eight options the user should see side by side | `RadioButtons` |
| A few views or data sets to switch between, one selected at a time | `SelectorBar` |
| Two to five options shown as one connected bar of buttons, including multi-select | `Segmented` (Community Toolkit) |
| More than eight options, or options of secondary importance | `ComboBox` |
| Values from a continuous range | `Slider` |

The thresholds come from Microsoft's design guidance. Radio buttons give way to a combo box above eight options, and a combo box with fewer than five options is often better as radio buttons.

### RadioButtons

WinUI has two ways to build a group of radio buttons. Individual `RadioButton` controls form a group when they share a parent panel or the same `GroupName`, and you lay them out yourself. The `RadioButtons` control, which Microsoft recommends, takes the options as items and handles layout, spacing, and keyboard navigation for you. It populates like an `ItemsControl`, either from items in XAML or from `ItemsSource`, and exposes the choice through `SelectedIndex`, `SelectedItem`, and `SelectionChanged`.

```xml
<RadioButtons Header="Theme" SelectedIndex="{x:Bind ViewModel.ThemeIndex, Mode=TwoWay}">
    <x:String>Light</x:String>
    <x:String>Dark</x:String>
    <x:String>Use system setting</x:String>
</RadioButtons>
```

The keyboard behavior is the main reason to prefer it. Tab moves focus into the group and lands on the selected item. If nothing is selected, focus lands on the first item without selecting it. Inside the group, the arrow keys move between items and selection follows focus. Ctrl plus an arrow key moves focus without selecting, and Space then selects. Focus does not wrap from the last item back to the first, so screen reader users can tell where the list begins and ends. Once the user selects an option, they can't clear the group back to no selection. Code can, by setting `SelectedIndex` to -1 or `SelectedItem` to `null`.

`MaxColumns` spreads the items across columns, filling each column top to bottom before starting the next. Setting it to the item count puts them all in one row. If you place `RadioButton` elements inside `RadioButtons` (to set `AutomationProperties.Name` on each, for example), their `GroupName` is ignored. Handle selection on the individual buttons or on the group, not both, because both sets of events fire.

### ComboBox

`ComboBox` shows the current selection and expands to a list when clicked. Items come from XAML or `ItemsSource`. For bound objects, `DisplayMemberPath` names the property shown as the label and `SelectedValuePath` names the property that `SelectedValue` returns.

```xml
<ComboBox Header="Country"
          ItemsSource="{x:Bind ViewModel.Countries}"
          DisplayMemberPath="Name"
          SelectedValuePath="Code"
          SelectedValue="{x:Bind ViewModel.SelectedCountryCode, Mode=TwoWay}" />
```

Setting `SelectedIndex` or `SelectedItem` from code before the items are loaded throws. When the items come from code, set the default selection in the `Loaded` handler. By default, `SelectionChanged` fires only when the user commits a choice, not while they arrow through the open list. Set `SelectionChangedTrigger="Always"` for a font picker that should preview each item as the user moves through it.

`IsEditable="True"` lets the user type a value that isn't in the list. The `TextSubmitted` event fires when the typed text matches no item and the user presses Enter or moves focus away. Validate it there. Setting `e.Handled = true` stops `SelectedItem` from updating and leaves the box in editing mode, but the invalid text stays in it. To put the previous value back, reset `Text` yourself, for example from `SelectedValue`. Use an editable combo box when the list covers the common values but others are allowed. For open-ended search with suggestions, `AutoSuggestBox` fits better.

### SelectorBar and Segmented

Both switch between a few views, and they differ in origin and flexibility.

`SelectorBar` is built into WinUI. Each `SelectorBarItem` has `Text`, an `Icon`, or both, and at most one item is selected at a time. Handle `SelectionChanged` and read `SelectedItem` to navigate a `Frame` or swap the data a list shows. If nothing is selected when the bar gets focus, it selects the first item, and `SelectionChanged` fires for that too, as it does for selections made from code. It has no `ItemsSource` and no `SelectedIndex`, because it is meant for a short, fixed set declared in XAML. Microsoft suggests `RadioButtons` instead when nothing should be selected by default and the choice isn't about switching views.

```xml
<SelectorBar SelectionChanged="OnViewSelectionChanged">
    <SelectorBarItem Text="Recent" Icon="Clock" IsSelected="True" />
    <SelectorBarItem Text="Shared" Icon="Share" />
    <SelectorBarItem Text="Favorites" Icon="Favorite" />
</SelectorBar>
```

`Segmented`, from the Community Toolkit, renders its options as one connected bar of buttons, which suits a switch like grid, list, and details. It is best with two to five items and has no overflow, so it doesn't scale to longer lists. It supports single and multiple selection, and in single mode it selects the first item automatically unless `AutoSelection` is `false`. `SegmentedItem` takes `Content`, an `Icon`, or both. It ships in the `CommunityToolkit.WinUI.Controls.Segmented` package under the `CommunityToolkit.WinUI.Controls` namespace, with the prefix below declared as `xmlns:toolkit="using:CommunityToolkit.WinUI.Controls"`.

```xml
<toolkit:Segmented SelectedIndex="0">
    <toolkit:SegmentedItem Content="Grid" />
    <toolkit:SegmentedItem Content="List" />
    <toolkit:SegmentedItem Content="Details" />
</toolkit:Segmented>
```

## Numbers and Ranges

### Slider

A slider fits values the user thinks of as a relative amount, like volume or brightness, and benefits from seeing each change as it happens. If the user needs an exact, known number, or will prefer the keyboard, use `NumberBox` instead.

`Minimum`, `Maximum`, and `Value` define the range. `StepFrequency` sets the interval between allowed values, and `TickFrequency` sets the interval between tick marks. `SnapsTo` decides which of the two the thumb snaps to, and it defaults to `StepValues`. `TickPlacement` positions the marks:

| `TickPlacement` | Where tick marks appear |
| --- | --- |
| `None` | No tick marks |
| `TopLeft` | Above a horizontal track, left of a vertical one |
| `BottomRight` | Below a horizontal track, right of a vertical one |
| `Outside` | On both sides of the track |
| `Inline` | On the track itself |

```xml
<Slider Header="Volume" Minimum="0" Maximum="100"
        StepFrequency="5" TickFrequency="10" TickPlacement="Outside"
        Value="{x:Bind ViewModel.Volume, Mode=TwoWay}" />
```

Show tick marks when the snap points aren't obvious. A 200-pixel slider with 200 steps doesn't need them, but one with 10 steps does. `Orientation="Vertical"` suits values the user already pictures vertically, such as temperature. Microsoft's guidance puts a vertical slider's maximum at the top.

### NumberBox

`NumberBox` is a text box for numbers. Its `Value` is a `double`, and its `Text` holds the same value as a string. When the user clears the box, `Value` becomes `double.NaN`, not zero, so bind it to a `double` property and treat `NaN` as empty.

```xml
<NumberBox Header="Quantity"
           Value="{x:Bind ViewModel.Quantity, Mode=TwoWay}"
           Minimum="0" Maximum="1000"
           SmallChange="1" LargeChange="10"
           SpinButtonPlacementMode="Compact" />
```

The box accepts any typed text and validates it when the user presses Enter or moves focus away. With the default `ValidationMode` of `InvalidInputOverwritten`, text that isn't a number or a valid expression reverts to the last valid value. `Disabled` turns that off so you can validate yourself.

- **Stepping.** `SmallChange` applies to the arrow keys, the mouse wheel, and the spin buttons. `LargeChange` applies to Page Up and Page Down.
- **Spin buttons.** `SpinButtonPlacementMode` defaults to `Hidden`. `Inline` shows the buttons beside the box, and `Compact` shows them in a flyout while the box has focus. The buttons disable themselves when another step would pass `Minimum` or `Maximum`.
- **Expressions.** With `AcceptsExpression="True"`, typing `10 + 5 * 2` evaluates to 20 on commit. The operators are `^`, `*`, `/`, `+`, and `-` in that order of precedence, with parentheses to override it.
- **Formatting.** `NumberFormatter` takes a formatter from `Windows.Globalization.NumberFormatting`, such as `DecimalFormatter` or `CurrencyFormatter`, which also controls rounding.

## Text Entry

| Input | Control |
| --- | --- |
| Plain text, one line or many | `TextBox` |
| A password or other secret | `PasswordBox` |
| A search term, with suggestions as the user types | `AutoSuggestBox` |
| One of a list of values, or a custom value | `ComboBox` with `IsEditable="True"` |
| A number | `NumberBox` |
| A formatted document | `RichEditBox` |

### TextBox

`TextBox` takes plain, unformatted text. Set `AcceptsReturn="True"` and `TextWrapping="Wrap"` together for multi-line input, and give a multi-line box a fixed `Height` or `MaxHeight` so it doesn't grow as the user types. `Header` labels the box above it and stays visible, while `PlaceholderText` disappears once the user types. All the text-entry controls here have both properties, as do `NumberBox`, `ComboBox`, and `CalendarDatePicker`. `ToggleSwitch`, `Slider`, `RadioButtons`, `DatePicker`, and `TimePicker` have only `Header`.

A few behaviors catch people out:

- **`MaxLength` doesn't limit pasted text.** Handle the `Paste` event if the limit matters.
- **`InputScope` performs no validation.** `InputScope="Number"` shows the number layout on the touch keyboard, but a hardware keyboard can still type anything.
- **Read-only should be a temporary state.** A read-only `TextBox` looks editable. For text that is never editable, use a `TextBlock`.
- **The clear-all button appears only on editable, non-wrapping boxes.** It shows while the box has text and focus, and never when `IsReadOnly` or `AcceptsReturn` is true or `TextWrapping` is anything but `NoWrap`.
- **Expect to build your own validation display.** The current `TextBox` API and those of the other input controls have no properties for showing validation errors, so apps typically place their own error text next to the field.

### The Three Text-Change Events

`TextBox` raises three events for each change, and they differ in timing and in what the handler may do.

| Event | When it fires | What the handler can do |
| --- | --- | --- |
| `BeforeTextChanging` | Synchronously, before `Text` updates | Read the proposed text from `args.NewText` and reject it with `args.Cancel = true` |
| `TextChanging` | Synchronously, after `Text` holds the new value but before it renders | Adjust `Text` and the selection without flicker. Do nothing else here, because the event can fire during layout, when changing the visual tree may crash the app |
| `TextChanged` | Asynchronously, after the new text renders | Anything, including showing UI or starting a search |

To keep a field digits-only, cancel in `BeforeTextChanging`, since only that event can reject the change before it lands:

```csharp
private void OnDigitsBeforeTextChanging(TextBox sender, TextBoxBeforeTextChangingEventArgs args)
{
    args.Cancel = args.NewText.Any(c => !char.IsAsciiDigit(c));
}
```

For a numeric field that needs more than digits, `NumberBox` is usually the better control.

### PasswordBox

`PasswordBox` masks what the user types. Its value is the `Password` property, a plain `string`. Unlike in WPF, `Password` is a dependency property, so it can be bound. The app still holds the password as an ordinary string once it reads it. `PasswordChanged` fires on each edit, and `PasswordChar` replaces the default bullet.

`PasswordRevealMode` has three values:

- **`Peek`** (the default) shows a reveal button that displays the password only while pressed. The button appears only after the box first gets focus and the user types, and only if the box is wider than a minimum width. If focus leaves and returns, it stays hidden until the box is cleared.
- **`Hidden`** never reveals the password.
- **`Visible`** shows the password in clear text with no button.

A "Show password" check box that switches between `Hidden` and `Visible` gives the user a reveal that doesn't need to be held down. `PasswordBox` supports only the `Password` and `NumericPin` input scopes.

### AutoSuggestBox

`AutoSuggestBox` is a text box with a suggestion list, and it's the standard search box. Using it means handling three moments:

- **`TextChanged`** fires whenever the text changes. Check `args.Reason`, and filter suggestions only when it is `AutoSuggestionBoxTextChangeReason.UserInput`. The other reasons come from your own code or from the user choosing a suggestion.
- **`SuggestionChosen`** fires when the user arrows through the list or clicks an item. If `TextMemberPath` is set, the box updates its text to the highlighted item without extra code. Handle the event only when the text needs building from more than one property.
- **`QuerySubmitted`** fires when the user commits. `args.QueryText` always holds the text. `args.ChosenSuggestion` holds the item if the user picked it from the list, and is `null` if they pressed Enter or the query icon in the text box.

```xml
<AutoSuggestBox PlaceholderText="Search contacts" QueryIcon="Find"
                DisplayMemberPath="Name" TextMemberPath="Name"
                TextChanged="OnSearchTextChanged"
                QuerySubmitted="OnSearchQuerySubmitted" />
```

```csharp
private void OnSearchTextChanged(AutoSuggestBox sender, AutoSuggestBoxTextChangedEventArgs args)
{
    if (args.Reason == AutoSuggestionBoxTextChangeReason.UserInput)
    {
        sender.ItemsSource = _contacts
            .Where(c => c.Name.Contains(sender.Text, StringComparison.OrdinalIgnoreCase))
            .ToList();
    }
}

private void OnSearchQuerySubmitted(AutoSuggestBox sender, AutoSuggestBoxQuerySubmittedEventArgs args)
{
    if (args.ChosenSuggestion is Contact contact)
        OpenContact(contact);
    else
        RunSearch(args.QueryText);
}
```

When a search finds nothing, show a single "No results" item so the user knows the search ran.

### RichEditBox

`RichEditBox` edits formatted documents, with bold and italic text, fonts, paragraph alignment, lists, and images. Microsoft positions it for working with documents such as `.rtf` files, not for collecting input from a form. For plain text, even long multi-line text, `TextBox` is simpler.

It has no bindable `Text` property. Content lives in `Document`, a `RichEditTextDocument` from the `Microsoft.UI.Text` namespace. Code written for UWP uses `Windows.UI.Text` for these types, and that doesn't carry over to WinUI 3. The document loads and saves through streams, reads its text, and exposes the current selection for formatting:

```csharp
using Microsoft.UI.Text;

// Read the document as plain text
Editor.Document.GetText(TextGetOptions.None, out string plainText);

// Toggle bold on the current selection
ITextCharacterFormat format = Editor.Document.Selection.CharacterFormat;
format.Bold = FormatEffect.Toggle;
Editor.Document.Selection.CharacterFormat = format;

// Save as RTF. SaveToStream takes a WinRT IRandomAccessStream,
// such as one from StorageFile.OpenAsync(FileAccessMode.ReadWrite)
Editor.Document.SaveToStream(TextGetOptions.FormatRtf, randomAccessStream);
```

The control has no formatting toolbar of its own, so the app supplies the bold, italic, and alignment buttons. It does support `Header` and `PlaceholderText` like the other text controls. It can also edit math equations typed in UnicodeMath, a plain-text notation where `1/2` becomes ½, and read or write them as MathML. Math mode is off until you call `Document.SetMathMode(RichEditMathMode.MathOnly)`.

## Dates and Times

WinUI has four date and time controls, and Microsoft's guidance picks among them by whether the calendar itself helps the user.

| Control | Use it to pick | Example |
| --- | --- | --- |
| `CalendarDatePicker` | One date from a drop-down calendar, when the day of the week or the surrounding dates matter | An appointment or departure date |
| `DatePicker` | One known date, when calendar context doesn't matter | A date of birth |
| `CalendarView` | One or more dates from a calendar that stays visible | Scheduling across several days |
| `TimePicker` | One time value | An arrival time |

In C#, all of them use `DateTimeOffset` for dates. Date properties can't be set as XAML attribute strings, because the XAML parser has no string-to-date conversion, so set them in code or through a binding.

### CalendarDatePicker

The control shows placeholder text ("select a date" by default) until the user picks a date, then shows the date. Clicking it opens a calendar over the rest of the UI. Its `Date` property is a `DateTimeOffset?` and is `null` until a date is chosen, and clicking the selected date again clears it. `DateChanged` reports changes. `MinDate` and `MaxDate` limit the range, and a `Date` set in code outside that range is clamped to the nearest bound.

```xml
<CalendarDatePicker Header="Departure" PlaceholderText="Choose a date"
                    DateChanged="OnDepartureDateChanged" />
```

The internal calendar allows only single selection. When the user needs to pick several dates, or the calendar should stay open, use `CalendarView`.

### CalendarView

`CalendarView` shows a calendar that the user navigates by month, year, or decade. `SelectionMode` is `Single` by default, `Multiple` for picking several dates, or `None` for display only. Microsoft's overview pages say the control can select "a range of dates," but that means `Multiple` mode. There is no mode that selects a contiguous range from a start and end date. The selected dates are in the `SelectedDates` collection, and `SelectedDatesChanged` reports changes.

To customize individual days, handle `CalendarViewDayItemChanging`, whose `args.Item` is the day being rendered. Set `IsBlackout` to make a day unselectable, or call `SetDensityColors` to draw up to 10 colored bars that show how busy a day is. The event supports phased rendering. Each call checks `args.Phase`, does that phase's work, and calls `args.RegisterUpdateCallback` to be invoked again for the next phase. Days the user scrolls past before all phases finish skip the remaining work.

```xml
<CalendarView SelectionMode="Multiple"
              SelectedDatesChanged="OnSelectedDatesChanged"
              CalendarViewDayItemChanging="OnDayItemChanging" />
```

### DatePicker and TimePicker

`DatePicker` and `TimePicker` display their value in a compact entry point. Clicking it opens a picker surface with one scrolling column per component. Dates have day, month, and year columns, formatted for the user's locale, and times on a 12-hour clock have hour, minute, and AM/PM. `DatePicker` can hide a column with `DayVisible`, `MonthVisible`, or `YearVisible`.

Each control has two value properties. `DatePicker.SelectedDate` (a `DateTimeOffset?`) and `TimePicker.SelectedTime` (a `TimeSpan?`) are `null` until the user picks a value, and while they are `null` the picker shows its field names. Bind to these and handle `SelectedDateChanged` and `SelectedTimeChanged`. The older non-nullable `Date` and `Time` properties can't represent "unset," so they report 12/31/1600 and a zero `TimeSpan` instead, which code can mistake for a value the user chose.

`MinYear` and `MaxYear` default to 100 years before and after today. If you set only one of them, check that it still forms a valid range with the other's default, or the picker has no selectable dates. Unlike the date properties, `SelectedTime` can be set as a XAML string such as `SelectedTime="14:15"`.

```xml
<DatePicker Header="Arrival date" SelectedDateChanged="OnArrivalDateChanged" />
<TimePicker Header="Arrival time" MinuteIncrement="15"
            SelectedTimeChanged="OnArrivalTimeChanged" />
```

`MinuteIncrement` limits the minute column to multiples of a step, and `ClockIdentifier` switches between `"12HourClock"` (the default) and `"24HourClock"`. The two controls are often placed together, with the handlers combining the date and time into one value.

## Color and Rating

### ColorPicker

`ColorPicker` lets the user choose a color from a spectrum or type RGB, HSV, or hex values. Read the result from `Color` or handle `ColorChanged`. The control can be pared down to fit the task:

- **Casual picking.** `ColorSpectrumShape="Ring"` with the text inputs hidden gives a simple wheel and slider, suited to picking a highlighter color.
- **Precise picking.** The default square spectrum shows more of the gamut, and the text inputs let the user refine the value.
- **Transparency.** `IsAlphaEnabled="True"` adds an opacity slider and text box.

Binding `Color` directly applies each change as the user drags. In a flyout, Microsoft recommends committing only when the user confirms, either with OK and Cancel buttons or when the flyout closes.

### RatingControl

`RatingControl` shows and sets a star rating. `MaxRating` sets the number of stars. A common pattern sets `PlaceholderValue` to the average rating of all users, which displays until the user rates the item, with `Caption` carrying a label such as the number of ratings. `IsClearEnabled` controls whether the user can remove a rating once set.

`Value` is a `double`, so an unrated control can't report `null`. The API declares its default as -1, so treat any value below zero as "not rated". For ratings the user can't change, such as those on reviews in a long list, set `IsReadOnly="True"`. Microsoft recommends read-only mode for large virtualized lists, partly for performance.

```xml
<RatingControl Caption="Your rating" ValueChanged="OnRatingChanged" />
```

## Settings Pages with SettingsCard and SettingsExpander

The Windows Community Toolkit's settings controls reproduce the card layout of the Windows 11 Settings app, which is otherwise tedious to build from `Grid` and `Border`. They ship in the `CommunityToolkit.WinUI.Controls.SettingsControls` package under the `CommunityToolkit.WinUI.Controls` namespace, declared here as `xmlns:toolkit="using:CommunityToolkit.WinUI.Controls"`.

A `SettingsCard` is one row. It has a `Header`, an optional `Description`, an optional `HeaderIcon`, and its content, typically a toggle switch, combo box, or button, sits on the right. When the card gets narrow, the content wraps below the header.

```xml
<toolkit:SettingsCard Header="Dark mode"
                      Description="Use the dark theme across the app">
    <toolkit:SettingsCard.HeaderIcon>
        <FontIcon Glyph="&#xE793;" />
    </toolkit:SettingsCard.HeaderIcon>
    <ToggleSwitch IsOn="{x:Bind ViewModel.IsDarkMode, Mode=TwoWay}" />
</toolkit:SettingsCard>
```

`IsClickEnabled="True"` turns the whole card into a button that raises `Click` or runs `Command`, for a setting that opens a detail page or an external link. A clickable card shows an action icon, which `ActionIcon` replaces and `IsActionIconVisible="False"` hides.

`SettingsExpander` groups related cards under one header that expands and collapses. It can have its own content on the right like a card, and its `Items` are `SettingsCard` elements, so a setting moves in or out of a group by moving its XAML. It is also an `ItemsControl`, so `ItemsSource` and an `ItemTemplate` can generate the cards from data.

```xml
<toolkit:SettingsExpander Header="Notifications"
                          Description="Choose how the app notifies you">
    <toolkit:SettingsExpander.Items>
        <toolkit:SettingsCard Header="Show notifications">
            <ToggleSwitch IsOn="{x:Bind ViewModel.NotificationsEnabled, Mode=TwoWay}" />
        </toolkit:SettingsCard>
        <toolkit:SettingsCard Header="Play a sound">
            <ToggleSwitch IsOn="{x:Bind ViewModel.SoundsEnabled, Mode=TwoWay}" />
        </toolkit:SettingsCard>
    </toolkit:SettingsExpander.Items>
</toolkit:SettingsExpander>
```
