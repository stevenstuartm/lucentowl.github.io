---
title: "Dialogs, Flyouts, and Command Surfaces"
layout: guide
category: "WinUI 3"
subcategory: "Controls & UI"
description: "Using ContentDialog, Flyout, MenuFlyout, TeachingTip, MenuBar, CommandBar, and CommandBarFlyout to present dialogs, contextual actions, and command surfaces in WinUI 3."
tags: [winui, winui-3, xaml, controls, dialogs, commands, ui-framework, desktop]
---

## Table of Contents

- [ContentDialog](#contentdialog)
- [Flyout](#flyout)
- [MenuFlyout](#menuflyout)
- [TeachingTip](#teachingtip)
- [MenuBar](#menubar)
- [CommandBar](#commandbar)
- [CommandBarFlyout](#commandbarflyout)
- [Choosing the Right Surface](#choosing-the-right-surface)

---

## ContentDialog

`ContentDialog` is a modal dialog that blocks interaction with the rest of the application until the user responds. It is the right control for decisions the app cannot proceed without, such as confirming a destructive action or collecting required input before continuing.

The dialog exposes three button slots: `PrimaryButtonText`, `SecondaryButtonText`, and `CloseButtonText`. You do not have to fill all three; a confirmation dialog that only needs Confirm and Cancel typically uses `PrimaryButtonText` and `CloseButtonText`. Clicking any button dismisses the dialog and returns a `ContentDialogResult` value, which is `Primary`, `Secondary`, or `None` for the close button.

```xml
<ContentDialog x:Name="DeleteDialog"
               Title="Delete item?"
               PrimaryButtonText="Delete"
               CloseButtonText="Cancel"
               DefaultButton="Close">
    <TextBlock Text="This action cannot be undone." TextWrapping="Wrap" />
</ContentDialog>
```

Showing the dialog in WinUI 3 requires setting `XamlRoot` before calling `ShowAsync`. In earlier XAML frameworks this was not necessary, but WinUI 3 supports multiple windows and needs to know which visual tree to host the dialog within:

```csharp
DeleteDialog.XamlRoot = this.XamlRoot;
var result = await DeleteDialog.ShowAsync();

if (result == ContentDialogResult.Primary)
{
    // Proceed with deletion
}
```

A common pattern is to assign `XamlRoot` at the point of showing the dialog rather than during page initialization, since `XamlRoot` may not be available until the page is loaded into the visual tree.

WinUI 3 only allows one `ContentDialog` per thread at a time. Attempting to show a second dialog while one is already open throws an exception. If your application can trigger dialogs from multiple code paths concurrently, you need a queuing mechanism or a guard flag. The simplest approach is a static semaphore around `ShowAsync` calls, though more sophisticated apps route all dialog requests through a centralized dialog service that serializes them.

The `Content` property accepts any XAML element, so dialogs can contain forms, progress indicators, or scrollable lists. For forms with validation, the `IsPrimaryButtonEnabled` property lets you disable the primary button until the form is valid:

```csharp
NameTextBox.TextChanged += (s, e) =>
{
    SaveDialog.IsPrimaryButtonEnabled = !string.IsNullOrWhiteSpace(NameTextBox.Text);
};
```

---

## Flyout

`Flyout` is a lightweight popup that is attached to a control and dismissed by tapping or clicking outside of it. Unlike a `ContentDialog`, it does not block the rest of the application, making it appropriate for optional detail views, confirmation prompts that are not critical, or any interaction where the user might want to reference the background content while the popup is open.

You attach a `Flyout` to a control through its `Flyout` property, or show it programmatically with `ShowAt`:

```xml
<Button Content="Show Options">
    <Button.Flyout>
        <Flyout>
            <StackPanel Spacing="8">
                <TextBlock Text="Choose a value" />
                <Slider Minimum="0" Maximum="100" />
            </StackPanel>
        </Flyout>
    </Button.Flyout>
</Button>
```

The `Placement` property controls which side of the target control the flyout appears on. Options include `Top`, `Bottom`, `Left`, `Right`, `Full` (centered in the window), and several auto-placement variants. When placement would push the flyout off-screen, the system automatically adjusts to keep it visible.

Calling `ShowAt(FrameworkElement target)` opens the flyout anchored to a specific element, which is useful when you want to show the flyout from code rather than from a button's built-in `Flyout` property:

```csharp
private void ShowDetailFlyout(FrameworkElement anchorElement)
{
    DetailFlyout.ShowAt(anchorElement);
}
```

A `Flyout` with `LightDismissOverlayMode` set to `On` draws a semi-transparent overlay behind it, similar to a modal, while still being light-dismissable. This is useful when the flyout content requires focused attention without fully blocking the UI.

---

## MenuFlyout

`MenuFlyout` is a specialized flyout that presents a list of commands rather than arbitrary content. It is the control behind context menus and button dropdowns throughout Windows applications.

The items inside a `MenuFlyout` can be `MenuFlyoutItem` for a regular command, `ToggleMenuFlyoutItem` for a checked or unchecked state, `MenuFlyoutSubItem` for a nested submenu, and `MenuFlyoutSeparator` to group related commands visually.

```xml
<Button Content="Actions">
    <Button.Flyout>
        <MenuFlyout>
            <MenuFlyoutItem Text="Rename" Click="RenameItem_Click">
                <MenuFlyoutItem.KeyboardAccelerators>
                    <KeyboardAccelerator Key="F2" />
                </MenuFlyoutItem.KeyboardAccelerators>
            </MenuFlyoutItem>
            <MenuFlyoutSeparator />
            <ToggleMenuFlyoutItem Text="Show Details"
                                  IsChecked="{x:Bind ShowDetails, Mode=TwoWay}" />
            <MenuFlyoutSubItem Text="Export As">
                <MenuFlyoutItem Text="CSV" Click="ExportCsv_Click" />
                <MenuFlyoutItem Text="JSON" Click="ExportJson_Click" />
            </MenuFlyoutSubItem>
            <MenuFlyoutSeparator />
            <MenuFlyoutItem Text="Delete" Click="DeleteItem_Click" />
        </MenuFlyout>
    </Button.Flyout>
</Button>
```

Keyboard accelerators on `MenuFlyoutItem` are visible in the item's label area automatically, so users can discover shortcuts by opening the menu. The `F2` accelerator in the example above will show as a hint next to the Rename item and will also fire the `Click` handler when pressed even when the menu is closed, provided the item is within the focused subtree.

For context menus triggered by right-click, attach a `MenuFlyout` to the `ContextFlyout` property of any `FrameworkElement`. The system positions it at the pointer location when the user right-clicks:

```xml
<ListView x:Name="ItemList" ContextFlyout="{StaticResource ItemContextMenu}" />
```

---

## TeachingTip

`TeachingTip` is a semi-persistent flyout designed for onboarding and feature discovery. Unlike a regular `Flyout`, it does not dismiss automatically when the user clicks elsewhere; it stays visible until the user explicitly closes it or your code hides it. This makes it suitable for guiding a user through a new feature or highlighting a control they have not yet noticed.

A targeted `TeachingTip` anchors itself to a specific control via the `Target` property and draws a tail pointing toward that control:

```xml
<TeachingTip x:Name="SearchTip"
             Title="Try the new search"
             Subtitle="Search across all documents at once using the bar above."
             Target="{x:Bind SearchBox}"
             PreferredPlacement="BottomLeft"
             CloseButtonContent="Got it"
             ActionButtonContent="Learn more"
             ActionButtonClick="SearchTip_ActionButtonClick" />
```

Setting `IsOpen="True"` in code shows the tip:

```csharp
SearchTip.IsOpen = true;
```

The `PreferredPlacement` property accepts options like `Top`, `Bottom`, `Left`, `Right`, and `Center`, as well as edge-aligned variants such as `TopLeft` and `BottomRight`. WinUI 3 uses this as a hint and may adjust placement to keep the tip on-screen.

An untargeted `TeachingTip` omits the `Target` property and appears centered in the window or in a position you control via `PreferredPlacement="Center"`. This suits announcements or guidance that is not tied to a specific UI element.

The `TailVisibility` property controls whether the tail is drawn. Setting it to `Collapsed` removes the tail entirely, turning the tip into a floating panel. This is sometimes appropriate for untargeted tips where a tail would point at nothing meaningful.

`TeachingTip` supports hero content through the `HeroContent` and `HeroContentPlacement` properties, letting you embed an illustration or screenshot above or below the title area. For simple guidance this is often unnecessary, but it can make onboarding flows more polished when the visual context is helpful.

---

## MenuBar

`MenuBar` provides a traditional horizontal menu strip along the top of a window, the kind seen in applications like Notepad or Visual Studio. It contains `MenuBarItem` elements, each of which represents a top-level menu like File, Edit, or View, and each `MenuBarItem` holds `MenuFlyoutItem`, `ToggleMenuFlyoutItem`, `MenuFlyoutSubItem`, and `MenuFlyoutSeparator` children.

```xml
<MenuBar>
    <MenuBarItem Title="File">
        <MenuFlyoutItem Text="New" Click="NewFile_Click">
            <MenuFlyoutItem.KeyboardAccelerators>
                <KeyboardAccelerator Modifiers="Control" Key="N" />
            </MenuFlyoutItem.KeyboardAccelerators>
        </MenuFlyoutItem>
        <MenuFlyoutItem Text="Open" Click="OpenFile_Click">
            <MenuFlyoutItem.KeyboardAccelerators>
                <KeyboardAccelerator Modifiers="Control" Key="O" />
            </MenuFlyoutItem.KeyboardAccelerators>
        </MenuFlyoutItem>
        <MenuFlyoutSeparator />
        <MenuFlyoutItem Text="Exit" Click="Exit_Click" />
    </MenuBarItem>
    <MenuBarItem Title="Edit">
        <MenuFlyoutItem Text="Undo" Click="Undo_Click">
            <MenuFlyoutItem.KeyboardAccelerators>
                <KeyboardAccelerator Modifiers="Control" Key="Z" />
            </MenuFlyoutItem.KeyboardAccelerators>
        </MenuFlyoutItem>
    </MenuBarItem>
</MenuBar>
```

Keyboard accelerators declared on `MenuFlyoutItem` children display as hints in the menu and fire globally when the shortcut is pressed, even with the menu closed. This means you do not need separate `KeyboardAccelerator` registrations on the page; declaring them on the menu items handles both discoverability and activation.

`MenuBar` fits naturally at the top of a `Grid` row, spanning the full window width above the content area. It is best suited for document-centric or power-user applications where users expect the traditional menu strip convention. For simpler applications with fewer commands, a `CommandBar` or `NavigationView` with settings items is usually more appropriate.

---

## CommandBar

`CommandBar` is a toolbar that presents a set of commands as icon-labeled buttons. It separates commands into two groups: primary commands, which are always visible, and secondary commands, which appear in an overflow menu when the user opens it. This lets you surface the most-used actions directly while keeping the toolbar from becoming cluttered.

Primary commands are `AppBarButton`, `AppBarToggleButton`, and `AppBarSeparator` elements placed in the `PrimaryCommands` collection. Secondary commands go in `SecondaryCommands` and appear in a list when the user clicks the overflow ellipsis:

```xml
<CommandBar>
    <CommandBar.PrimaryCommands>
        <AppBarButton Icon="Save" Label="Save" Click="Save_Click">
            <AppBarButton.KeyboardAccelerators>
                <KeyboardAccelerator Modifiers="Control" Key="S" />
            </AppBarButton.KeyboardAccelerators>
        </AppBarButton>
        <AppBarToggleButton Icon="Bold" Label="Bold"
                            IsChecked="{x:Bind IsBold, Mode=TwoWay}" />
        <AppBarSeparator />
        <AppBarButton Icon="Delete" Label="Delete" Click="Delete_Click" />
    </CommandBar.PrimaryCommands>
    <CommandBar.SecondaryCommands>
        <AppBarButton Label="Properties" Click="Properties_Click" />
        <AppBarButton Label="Export" Click="Export_Click" />
    </CommandBar.SecondaryCommands>
</CommandBar>
```

The `DefaultLabelPosition` property controls where labels appear relative to icons. `Right` places them to the right of each icon, which increases button width but improves label visibility. `Bottom` places them below the icon, which is the default. `Collapsed` hides labels entirely for a compact toolbar.

`IsOpen` controls whether the secondary commands overflow panel is open. Setting `IsSticky="True"` prevents the overflow panel from closing when the user clicks elsewhere, which is occasionally useful for complex secondary command sets.

`CommandBar` can be placed anywhere in a layout, not just at the top of the window. Content editors commonly place one at the bottom or inline within a content region. The `ClosedDisplayMode` property determines what the bar looks like when the secondary panel is closed: `Compact` shows icons without labels, `Minimal` shows only the overflow button, and `Hidden` hides the bar entirely until opened programmatically.

---

## CommandBarFlyout

`CommandBarFlyout` combines the structure of a `CommandBar` with the positioning flexibility of a `Flyout`. It appears on demand near a target element, making it the right control for contextual command surfaces that appear on right-click or text selection, similar to the mini toolbar that appears when selecting text in a word processor.

Like `CommandBar`, it has `PrimaryCommands` and `SecondaryCommands` collections. When the flyout first opens it shows only the primary commands in a compact strip. Opening the overflow reveals the secondary commands below:

```xml
<CommandBarFlyout x:Name="SelectionCommandBar">
    <AppBarButton Icon="Cut" Label="Cut" Click="Cut_Click" />
    <AppBarButton Icon="Copy" Label="Copy" Click="Copy_Click" />
    <AppBarButton Icon="Paste" Label="Paste" Click="Paste_Click" />
    <CommandBarFlyout.SecondaryCommands>
        <AppBarButton Label="Select All" Click="SelectAll_Click" />
        <AppBarButton Label="Format..." Click="Format_Click" />
    </CommandBarFlyout.SecondaryCommands>
</CommandBarFlyout>
```

Showing the flyout at a pointer position requires `ShowAt` with a `Point` argument:

```csharp
private void Canvas_RightTapped(object sender, RightTappedRoutedEventArgs e)
{
    SelectionCommandBar.ShowAt(Canvas, e.GetPosition(Canvas));
}
```

`CommandBarFlyout` also integrates with `TextCommandBarFlyout`, a specialized subclass pre-populated with text editing commands like cut, copy, paste, bold, italic, and underline. `RichEditBox` and `TextBox` use `TextCommandBarFlyout` automatically for their selection toolbar. You can replace the default by assigning your own instance to the `SelectionFlyout` property.

The `AlwaysExpanded` property forces the flyout to show both primary and secondary commands immediately without requiring the user to open the overflow. This suits cases where the secondary commands are equally important and the extra click to reveal them would be friction.

---

## Choosing the Right Surface

Each of these controls occupies a different position on the spectrum from blocking to ambient and from persistent to transient.

`ContentDialog` is for decisions the application genuinely cannot proceed without. The blocking behavior is a feature, not a limitation; it ensures the user responds before the app continues. Use it when skipping or dismissing the prompt without choosing would leave the app in an ambiguous state.

`Flyout` and `MenuFlyout` are for optional interactions attached to a specific control. A `Flyout` suits richer content like a form or a slider; a `MenuFlyout` suits a list of discrete commands. Neither is appropriate when the user needs to consult background content while the popup is open and the UI is sensitive to accidental dismissal.

`TeachingTip` is specifically for education, not for errors or decisions. Its persistence makes it suitable for introducing features that users might otherwise overlook, but using it for errors or warnings is confusing because users expect it to be dismissable on their own schedule.

`MenuBar` belongs in document-centric applications where users expect the traditional menu strip convention. It assumes keyboard-accelerator-fluent users who scan menus to discover commands. For touch-forward or simplified applications, the overhead of a full menu bar is rarely justified.

`CommandBar` suits applications where a set of commands should always be visible or quickly reachable without opening a menu. It works well when the primary commands represent the most frequent actions and the secondary overflow handles less-common ones. Placing it at the bottom of the window can improve reachability on touch devices.

`CommandBarFlyout` is the right choice for contextual commands that depend on what the user has selected or right-clicked. It avoids dedicating permanent screen space to commands that are only relevant in certain states. The compact primary command strip combined with the optional overflow mirrors what users expect from right-click menus in modern applications.

When in doubt, prefer the least intrusive surface that satisfies the interaction need. Reserve `ContentDialog` for genuinely blocking decisions, use flyouts for quick contextual actions, and rely on persistent command surfaces like `CommandBar` or `MenuBar` only when users need constant access to a stable command set.
