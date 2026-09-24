---
title: "Dialogs, Flyouts, and Command Surfaces"
layout: guide
category: "WinUI 3"
subcategory: "Controls & UI"
description: "Presenting decisions, contextual content, and commands in WinUI 3: modal ContentDialog and its one-at-a-time rule, light-dismiss flyouts, menus and context menus, MenuBar, CommandBar and CommandBarFlyout, TeachingTip, sharing one command across surfaces with XamlUICommand, and choosing the right surface for a message or action."
tags: [contentdialog, flyout, menuflyout, commandbar, teachingtip, xamluicommand, practical]
---

## Blocking or Light Dismiss

The surfaces in this guide split on whether the rest of the app waits for the user.

A **dialog** is modal. It blocks interaction with the window until the user presses one of its buttons, so it suits decisions the app can't proceed without. Everything else here is **light dismiss**. A flyout, menu, or command bar flyout closes when the user taps outside it, presses Esc, or presses the system back button, and the app carries on either way. A light-dismiss surface that takes focus when it opens keeps keyboard focus inside itself until it closes. A tap outside that closes one is absorbed rather than passed to whatever was underneath, so reaching a button behind an open flyout takes a second tap.

`TeachingTip` sits between the two. It isn't modal, but by default it stays open until the user closes it.

Each surface belongs to one window. A dialog covers the window you assign it to, and stays inside it. A flyout, menu, or teaching tip opens from an element in a window, but it isn't necessarily confined there. Since Windows App SDK 1.4, setting its `ShouldConstrainToRootBounds` property to `false` lets it extend past the window's edges.

## ContentDialog

### Showing a Dialog

Create a `ContentDialog`, set its `XamlRoot`, and await `ShowAsync`. `XamlRoot` identifies the window's content tree the dialog appears over. WinUI 3 apps can have several windows, so the dialog can't assume one, and `ShowAsync` throws if it isn't set. From a page, use the page's `XamlRoot`, which is `null` until the page is loaded into the window, so a dialog can't be shown from the page's constructor. `Window` has no `XamlRoot` of its own, so from window code use its root element's. Call `ShowAsync` on the window's UI thread. Code running elsewhere, such as a background sync callback, has to dispatch back to that thread first.

```csharp
var dialog = new ContentDialog
{
    XamlRoot = this.XamlRoot,
    Title = "Delete this order?",
    Content = "The order and its history are removed permanently.",
    PrimaryButtonText = "Delete",
    CloseButtonText = "Cancel",
    DefaultButton = ContentDialogButton.Close
};

if (await dialog.ShowAsync() == ContentDialogResult.Primary)
    await ViewModel.DeleteOrderAsync();
```

`ShowAsync` returns `Primary`, `Secondary`, or `None`. The close button returns `None`, and so do Esc and the system back button, so `None` means "the user backed out" however they did it.

`Content` takes any element, so a dialog can hold a small form. A dialog complex enough to need its own XAML can be a class that derives from `ContentDialog`, made by adding a blank page and changing its root element and base class. A derived dialog doesn't pick up the WinUI style automatically. Give it a style `BasedOn="{StaticResource DefaultContentDialogStyle}"` in its resources.

### The Three Buttons

| Button | Role | Position | Result |
| --- | --- | --- | --- |
| `CloseButtonText` | The safe action, such as Cancel or Close. Microsoft says every dialog should have one | Rightmost | `None` |
| `PrimaryButtonText` | The main "do it" action | Leftmost | `Primary` |
| `SecondaryButtonText` | An optional second "do it" action | Middle | `Secondary` |

`DefaultButton` gives one button the accent style, the filled, highlighted look of a recommended action, and makes Enter press it, unless focus is in a control that handles Enter itself. No button is the default unless you set one. For a destructive action, making the safe button the default protects users who press Enter by habit. `IsPrimaryButtonEnabled` disables the primary button, such as until a form in the dialog is valid.

Button labels should answer the dialog's question, such as "Delete" and "Cancel" rather than "OK" and "Cancel". Microsoft also advises against using a dialog for errors tied to one place on the page, such as a validation error on a field. Show those inline next to the field.

### Keeping a Dialog Open

Pressing a button closes the dialog. To check something first, handle `PrimaryButtonClick` (or `SecondaryButtonClick` or `CloseButtonClick`) and set `args.Cancel = true` to keep it open. For async work, take a deferral, an object that tells the dialog to wait until you call its `Complete` method before deciding whether to close:

```csharp
private async void RenameDialog_PrimaryButtonClick(ContentDialog sender,
    ContentDialogButtonClickEventArgs args)
{
    var deferral = args.GetDeferral();
    try
    {
        if (!await ViewModel.TryRenameAsync(NameBox.Text))
        {
            args.Cancel = true;
            ErrorText.Text = "That name is already taken.";
        }
    }
    finally
    {
        deferral.Complete();
    }
}
```

The `Closing` event runs for every close, whichever way it happened, and can also cancel.

### One Dialog at a Time

Opening a second `ContentDialog` while one is open throws. The two Microsoft pages describe the scope differently. The API reference says one per thread, even when the dialogs belong to separate windows. The dialogs guide says one per window. Plan for the stricter reading, because windows that share a UI thread share the limit.

The failure shows up when two independent code paths each decide to ask the user something, such as a background sync error arriving while a delete confirmation is open. Route every dialog through one gate:

```csharp
public static class DialogGate
{
    private static readonly SemaphoreSlim Gate = new(1, 1);

    // Runs one dialog, or a chain of dialogs, while no other gated dialog can open.
    public static async Task<T> RunAsync<T>(Func<Task<T>> showDialogs)
    {
        await Gate.WaitAsync();
        try { return await showDialogs(); }
        finally { Gate.Release(); }
    }

    public static Task<ContentDialogResult> ShowQueuedAsync(this ContentDialog dialog)
        => RunAsync(async () => await dialog.ShowAsync());
}
```

The gate is static, so it also serializes dialogs across windows on different UI threads, which is stricter than the platform needs but harmless. To chain dialogs deliberately, where the second depends on the first answer, show both inside one `RunAsync` call so the gate stays held until the last one closes. Microsoft's own suggestion, showing the second dialog from the first one's `Closing` handler, works without a gate. With one, the gate is released when the first dialog's `ShowAsync` returns, while the second is still open, and a queued dialog would then throw.

## Flyout

A `Flyout` is a light-dismiss container for arbitrary content, anchored to an element. Attach it through a `Button`'s `Flyout` property, and the button opens it:

```xml
<Button Content="Filter">
    <Button.Flyout>
        <Flyout Placement="Bottom">
            <StackPanel Spacing="8">
                <TextBlock Text="Minimum total" />
                <Slider Minimum="0" Maximum="1000" />
            </StackPanel>
        </Flyout>
    </Button.Flyout>
</Button>
```

Elements without a `Flyout` property use the `FlyoutBase.AttachedFlyout` attached property, and your code opens it with `FlyoutBase.ShowAttachedFlyout(element)`. To open one from code without attaching it, call `ShowAt(element)`, or `ShowAt(element, new FlyoutShowOptions { ... })` to set the placement or a pointer position for that one opening. Call `Hide()` to close it from code, such as from an Apply button inside the flyout. A flyout defined once in resources can be attached to several elements.

`Placement` accepts `Top`, `Bottom`, `Left`, `Right`, edge-aligned variants such as `BottomEdgeAlignedLeft`, and `Full`, which stretches the flyout and centers it in the window. If the preferred side has no room, the flyout picks another.

Two properties adjust light dismiss:

- **`OverlayInputPassThroughElement`** lets a tap outside the flyout both close it and reach that element, so a user can move quickly between related buttons that each open a flyout. Microsoft warns against passing through to destructive buttons such as Delete.
- **`LightDismissOverlayMode`** controls the dimming layer behind the flyout. The default, `Auto`, draws it only on Xbox. `On` and `Off` force it either way.

Microsoft's guidance is to not use a `Flyout` in place of a tooltip, for a short description that disappears on its own, or in place of a context menu, for a list of commands.

## Menus and Context Menus

### Menu or Context Menu

Both show a list of commands, and they differ in what hosts them:

- **A menu** hangs off an element whose job is to show more commands, such as a button or a `MenuBar` heading. The user left-clicks or taps it, and it's attached through `Flyout` or `FlyoutBase.AttachedFlyout`.
- **A context menu** hangs off an element with another job, such as a list item, an image, or text. The user right-clicks or presses and holds, and it's attached through the element's `ContextFlyout` property. The element opens it, so no code is needed.

A `MenuFlyout` serves either role. For context menus, though, Microsoft recommends `CommandBarFlyout`, covered after `CommandBar` below.

### MenuFlyout

A `MenuFlyout` holds five kinds of item:

| Item | Use |
| --- | --- |
| `MenuFlyoutItem` | Run a command |
| `ToggleMenuFlyoutItem` | Turn an option on or off |
| `RadioMenuFlyoutItem` | Pick one of a group sharing a `GroupName` |
| `MenuFlyoutSubItem` | Open a nested menu |
| `MenuFlyoutSeparator` | Divide groups of items |

```xml
<Button Content="Sort">
    <Button.Flyout>
        <MenuFlyout>
            <RadioMenuFlyoutItem Text="By date" GroupName="Sort" IsChecked="True" />
            <RadioMenuFlyoutItem Text="By customer" GroupName="Sort" />
            <MenuFlyoutSeparator />
            <ToggleMenuFlyoutItem Text="Descending" IsChecked="{x:Bind ViewModel.SortDescending, Mode=TwoWay}" />
            <MenuFlyoutSubItem Text="Group by">
                <MenuFlyoutItem Text="Status" Click="GroupByStatus_Click" />
                <MenuFlyoutItem Text="Region" Click="GroupByRegion_Click" />
            </MenuFlyoutSubItem>
        </MenuFlyout>
    </Button.Flyout>
</Button>
```

Keyboard accelerators, the shortcut keys declared in an element's `KeyboardAccelerators`, appear next to the text of a `MenuFlyoutItem` or `ToggleMenuFlyoutItem` automatically, which makes menus the place users discover shortcuts.

### MenuBar

A `MenuBar` shows several top-level menus in a row, usually at the top of the window, such as File, Edit, and View. Each `MenuBarItem` has a `Title` and holds the same items as a `MenuFlyout`:

```xml
<MenuBar>
    <MenuBarItem Title="File">
        <MenuFlyoutItem Text="New" Click="NewFile_Click">
            <MenuFlyoutItem.KeyboardAccelerators>
                <KeyboardAccelerator Modifiers="Control" Key="N" />
            </MenuFlyoutItem.KeyboardAccelerators>
        </MenuFlyoutItem>
        <MenuFlyoutItem Text="Open..." Click="OpenFile_Click" />
        <MenuFlyoutSeparator />
        <MenuFlyoutItem Text="Exit" Click="Exit_Click" />
    </MenuBarItem>
    <MenuBarItem Title="View">
        <RadioMenuFlyoutItem Text="List" GroupName="Layout" IsChecked="True" />
        <RadioMenuFlyoutItem Text="Grid" GroupName="Layout" />
    </MenuBarItem>
</MenuBar>
```

Microsoft suggests it for apps whose commands need more organization or grouping than a single menu gives.

## CommandBar

A `CommandBar` is a toolbar. It has three areas:

- **Content**, on the left, for any element, such as a title or a search box.
- **Primary commands**, on the right, as icon buttons. Items go here by default.
- **Secondary commands**, in an overflow menu behind a "see more" (…) button.

Commands are `AppBarButton`, `AppBarToggleButton`, and `AppBarSeparator`. Any other element, such as a `SplitButton`, goes inside an `AppBarElementContainer`. Pressing "see more" opens the bar, which reveals the primary commands' labels and the overflow menu.

{% include figure.html id="winui-commandbar-anatomy" %}

```xml
<CommandBar DefaultLabelPosition="Right">
    <AppBarButton Icon="Add" Label="New order" Click="NewOrder_Click" />
    <AppBarButton Icon="Refresh" Label="Refresh" Click="Refresh_Click">
        <AppBarButton.KeyboardAccelerators>
            <KeyboardAccelerator Key="F5" />
        </AppBarButton.KeyboardAccelerators>
    </AppBarButton>
    <AppBarSeparator />
    <AppBarToggleButton Icon="Filter" Label="Filters" IsChecked="{x:Bind ViewModel.ShowFilters, Mode=TwoWay}" />
    <CommandBar.SecondaryCommands>
        <AppBarButton Label="Export" Click="Export_Click" />
        <AppBarButton Label="Print" Click="Print_Click" />
    </CommandBar.SecondaryCommands>
</CommandBar>
```

When the bar narrows, such as when the user resizes the window, primary commands move into the overflow menu, and back out when there's room. Add them in order of importance so the most important stay visible, or set each one's `DynamicOverflowOrder` to control the order explicitly. `IsDynamicOverflowEnabled="False"` turns the behavior off, at the risk of clipping the content area.

Labels sit below icons by default, where they show only while the bar is open. `DefaultLabelPosition="Right"` puts them beside the icons, always visible, and Microsoft suggests it for larger windows. `Collapsed` hides them. In the overflow menu, labels always sit to the right of icons. An accelerator on an `AppBarButton` appears in its tooltip, and in its label when it's in the overflow menu.

`ClosedDisplayMode` sets what the closed bar shows:

| Mode | Closed bar shows |
| --- | --- |
| `Compact` (default) | Content, primary command icons, and the "see more" button |
| `Minimal` | A thin strip that opens the bar when pressed |
| `Hidden` | Nothing. Open it from code with `IsOpen` or by changing the mode |

An open bar closes when the user interacts elsewhere. `IsSticky="True"` keeps it open, and Microsoft advises against it because it breaks the light-dismiss behavior users expect. A command bar can sit at the top of the window, the bottom, or inline within the content. Microsoft suggests the top on larger screens, where it's easier to notice.

## CommandBarFlyout

A `CommandBarFlyout` is a floating command bar anchored to an element. It has `PrimaryCommands`, shown as a horizontal row of buttons with their icons and labels, and `SecondaryCommands`, shown as a menu below them. It has two display modes:

- **Collapsed** shows the primary commands, plus a "see more" button if there are secondary commands.
- **Expanded** shows the primary commands and the secondary menu.

It's Microsoft's recommended control for context menus. Put common commands such as Cut, Copy, Paste, Delete, or Share in the primary row, and the rest in the secondary menu. A `CommandBarFlyout` with only secondary commands looks and behaves like a `MenuFlyout`, so it covers the plain case too.

One difference from `MenuFlyout` affects shortcuts. A GitHub issue first filed against WinUI 2 and still open ([microsoft-ui-xaml #448](https://github.com/microsoft/microsoft-ui-xaml/issues/448){:target="_blank" rel="noopener noreferrer"}) reports that accelerators on commands inside a closed `CommandBarFlyout` don't fire, while those in a closed `MenuFlyout` do. Declare the shortcut on the element that owns the context menu if it has to work while the menu is closed.

Unlike `CommandBar`, a flyout's primary commands don't move into the overflow when space runs short. They can be cut off, so keep the row short. `AlwaysExpanded="True"` keeps the secondary menu showing and removes the "see more" button.

How the flyout opens decides which mode it starts in. The flyout's `ShowMode` property sets it, or `FlyoutShowOptions.ShowMode` for a single opening from code:

| Opened | Show mode | Starts | Takes focus |
| --- | --- | --- | --- |
| Proactively, such as when the user selects text or taps an image | `Transient` | Collapsed | No |
| Reactively, as a context menu on right-click | `Standard` | Expanded | Yes |

Assigning the flyout to `ContextFlyout` handles the reactive case for you. For the proactive case, show it from code with a position and a transient show mode:

```xml
<Image Source="{x:Bind ViewModel.Photo}" Tapped="Photo_Tapped"
       FlyoutBase.AttachedFlyout="{x:Bind PhotoCommands}"
       ContextFlyout="{x:Bind PhotoCommands}" />
```

```csharp
private void Photo_Tapped(object sender, TappedRoutedEventArgs e)
{
    var element = (FrameworkElement)sender;
    FlyoutBase.GetAttachedFlyout(element)?.ShowAt(element, new FlyoutShowOptions
    {
        Position = e.GetPosition(element),
        ShowMode = FlyoutShowMode.Transient
    });
}
```

Here `PhotoCommands` is a `CommandBarFlyout` declared in the page's resources with an `x:Name`.

### Text Controls Have One Built In

`TextBox`, `TextBlock`, `RichEditBox`, `RichTextBlock`, and `PasswordBox` show a `TextCommandBarFlyout` automatically, both when the user selects text and as their context menu. It shows only the commands that apply at that moment: Cut, Copy, Paste, Undo, and Select All, a proofing command for a misspelled selection, and Bold, Italic, and Underline in an editable `RichEditBox`. You can't customize it, but you can replace it. Assign your own flyout to `SelectionFlyout` for the selection case and to `ContextFlyout` for right-click. Setting `SelectionFlyout` to `null` shows nothing on selection.

## TeachingTip

A `TeachingTip` points out a feature or a better way to do something. It has a `Title`, a `Subtitle`, optional `Content`, and optional hero content, edge-to-edge content such as an illustration, placed at the top or bottom with `HeroContentPlacement`. It can hold an action button (`ActionButtonContent`, handled through `ActionButtonClick` or `ActionButtonCommand`) alongside its close button. It takes no layout space, so it can be declared anywhere in the page or in resources.

```xml
<Button x:Name="ExportButton" Content="Export">
    <Button.Resources>
        <TeachingTip x:Name="ExportTip"
                     Target="{x:Bind ExportButton}"
                     Title="Export to Excel"
                     Subtitle="Exports keep your filters and column order."
                     CloseButtonContent="Got it" />
    </Button.Resources>
</Button>
```

Open it by setting `IsOpen = true`. Two things set it apart from a flyout:

- **It stays open by default.** The user closes it with its close button. `IsLightDismissEnabled="True"` makes it close when the user interacts elsewhere and removes the close button, which Microsoft recommends for tips in scrollable areas. The `Closing` event can cancel or defer the close.
- **It can have no target.** With `Target` set, a tail points at the target, and the tip prefers to sit above it. Without one, it has no tail and sits relative to the window's content, by default centered at the bottom. `PreferredPlacement` offers 13 placement modes in either case, though without a target some pairs, such as `TopRight` and `RightTop`, land in the same corner, and `TailVisibility="Collapsed"` removes the tail from a targeted tip.

Microsoft's guidance is that tips are temporary, so they shouldn't carry anything critical. Don't use them for errors or important status changes, and show them sparingly, staggered across long sessions or several sessions.

## Sharing One Command Across Surfaces

The same action often appears on several surfaces: a command bar button, a context menu item, and a keyboard shortcut. Wiring a `Click` handler, label, icon, and accelerator on each copy duplicates all of it. `AppBarButton`, `MenuFlyoutItem`, and other buttons have a `Command` property instead, which takes an `ICommand`, and two WinUI classes add the presentation to it:

- **`XamlUICommand`** bundles a `Label`, `IconSource`, `Description`, `KeyboardAccelerators`, and an access key with the behavior, raised through its `ExecuteRequested` and `CanExecuteRequested` events. A control whose `Command` is set to one takes its label, icon, and shortcut from it.
- **`StandardUICommand`** derives from it with those properties preset for common commands. `new StandardUICommand(StandardUICommandKind.Delete)` comes with the Delete label, icon, and accelerator, so only the behavior is left to supply.

```xml
<Page.Resources>
    <XamlUICommand x:Key="ArchiveCommand" Label="Archive"
                   Description="Move the order to the archive"
                   ExecuteRequested="ArchiveCommand_ExecuteRequested">
        <XamlUICommand.IconSource>
            <SymbolIconSource Symbol="Folder" />
        </XamlUICommand.IconSource>
        <XamlUICommand.KeyboardAccelerators>
            <KeyboardAccelerator Modifiers="Control" Key="E" />
        </XamlUICommand.KeyboardAccelerators>
    </XamlUICommand>
</Page.Resources>

<CommandBar>
    <AppBarButton Command="{StaticResource ArchiveCommand}" />
</CommandBar>

<ListView ItemsSource="{x:Bind ViewModel.Orders}">
    <ListView.ContextFlyout>
        <MenuFlyout>
            <MenuFlyoutItem Command="{StaticResource ArchiveCommand}" />
        </MenuFlyout>
    </ListView.ContextFlyout>
</ListView>
```

A view model's command, such as one from the MVVM Toolkit, can be bound to `Command` directly. `XamlUICommand` also has a `Command` property that can hold one, a way to keep the label, icon, and shortcut in the XAML command while the behavior lives in the view model.

Microsoft's commanding guidance also recommends putting every contextual command in a context menu, even when it's also available another way. A command reachable only by hovering, for example, can't be used on a touch-only device.

## Choosing a Surface

### For a Message or Decision

| The app needs to | Use | Because |
| --- | --- | --- |
| Get a decision before it can continue | `ContentDialog` | It blocks until the user answers |
| Report an error in one field | Inline text beside the field | It keeps the error where the problem is. Microsoft advises against dialogs here |
| Report app-wide status the user should see or act on, such as lost connectivity | `InfoBar` | It stays in the page without blocking, until dismissed or resolved. Use a dialog only if the app can't be used at all until the user responds |
| Describe a control briefly on hover or focus | `ToolTip` | It disappears on its own. Microsoft advises against tooltips for errors or status |
| Show optional detail or a small form on request | `Flyout` | It closes as soon as the user moves on |
| Teach a feature the user may have missed | `TeachingTip` | It points at the feature and waits to be read. Not for errors or anything critical |

A message that must reach the user while the app isn't in front belongs outside the window, in an app notification.

### For Commands

| Commands that | Use |
| --- | --- |
| Many commands, organized into named menus | `MenuBar` |
| Frequent commands that should always be visible | `CommandBar` |
| A button whose job is to offer more commands | `MenuFlyout` on the button, or a `DropDownButton`, a button styled with a chevron to show it opens a menu |
| Commands for the element under the pointer or selection | `CommandBarFlyout` as a context menu |
| Commands that appear as the user selects or taps something | `CommandBarFlyout` opened with `Transient` |

When the same command appears in several of these, define it once as a `XamlUICommand` or `StandardUICommand`. Prefer the least intrusive surface that works, and save the dialog for decisions the app can't continue without.
