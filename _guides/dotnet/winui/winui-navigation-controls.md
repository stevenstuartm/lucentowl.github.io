---
title: "Navigation Controls and Patterns"
layout: guide
category: "WinUI 3"
subcategory: "Controls & UI"
description: "Moving between pages in WinUI 3: how a Frame loads pages and keeps back and forward history, passing parameters, cancelling navigation and caching pages, wiring NavigationView to a Frame, document tabs with TabView, BreadcrumbBar paths, and choosing among them."
tags: [navigationview, tabview, breadcrumbbar, frame-navigation, back-stack, practical]
---

## Frame and Page

WinUI 3 navigation rests on two classes. A `Page` is a unit of UI, usually one XAML file and its code-behind. A `Frame` is a control that shows one page at a time and records where the user has been. The navigation controls later in this guide, `NavigationView`, `TabView`, and `BreadcrumbBar`, never navigate on their own. They raise events, and your handlers call methods on a `Frame`.

A new project has no `Frame` or `Page`, only a `MainWindow`. Add a `Frame` in one of two places:

- **As the window's content.** Create it in `App.OnLaunched`, navigate it to the first page, and assign it to `Window.Content`. This suits apps without persistent chrome.
- **Inside a `NavigationView`.** The window hosts a `NavigationView`, and a `Frame` inside it shows the selected page. This is the usual shape for apps with several sections.

Navigation history belongs to one `Frame`. An app can have several, such as a content frame inside a `NavigationView` and one per document tab, and each keeps its own history. A page reaches the frame that hosts it through its `Frame` property.

### Navigating and Passing Parameters

`Frame.Navigate` takes the page's type, not an instance. The frame creates the page through its parameterless constructor, so a page can't receive services as constructor arguments. Apps that use dependency injection resolve the page's view model inside the page or route navigation through a navigation service of their own. An overload takes a parameter object, and the destination page reads it in its `OnNavigatedTo` override:

```csharp
// On the orders page
Frame.Navigate(typeof(OrderDetailPage), order.Id);

// OrderDetailPage.xaml.cs
protected override void OnNavigatedTo(NavigationEventArgs e)
{
    base.OnNavigatedTo(e);
    if (e.Parameter is int orderId)
        ViewModel.Load(orderId);
}
```

Pass an identifier, not the object itself. The frame's history keeps a reference to every parameter, so passing a large object keeps it in memory for as long as the entry exists. `Frame.GetNavigationState` serializes the history to a string so it can be restored later. It supports only basic types such as strings, numbers, and GUIDs, and throws if an entry holds anything else.

A third overload takes a `NavigationTransitionInfo`, which picks the animation played as the page enters, such as a slide or a drill-in.

### Back and Forward History

The frame keeps two lists of `PageStackEntry` objects. `BackStack` holds the pages before the current one, and `ForwardStack` holds pages the user backed out of. `Navigate` pushes the current page onto the back stack. `GoBack` moves the current page onto the forward stack and makes the top of the back stack current again, and `GoForward` does the reverse. `CanGoBack` and `CanGoForward` report whether each stack has anything in it.

{% include figure.html id="winui-frame-back-stack" %}

Both stacks are ordinary lists, so you can edit them. After a sign-in flow, call `BackStack.Clear()` so Back doesn't return to the sign-in page, or remove one entry to skip a page the user shouldn't revisit. `IsNavigationStackEnabled` set to `false` stops the frame from recording navigation at all.

The frame doesn't draw a back button. Supply one through `NavigationView`'s built-in button, the back button of the `TitleBar` control (the control that draws a custom window title bar), or a `Button` with the `TitleBarBackButtonStyle` resource, and call `GoBack` from its handler. Microsoft recommends placing it at the top left and showing it disabled, not hidden, when `CanGoBack` is `false`, so the UI around it doesn't shift. To let Alt+Left or a mouse's back button go back too, route them to the same `GoBack` call with a keyboard accelerator (a shortcut key attached to an element) and a pointer handler.

### Page Lifecycle Hooks

A page gets three overrides as navigation passes through it, and the frame raises matching events:

| When | Page override | Frame event | Use it to |
| --- | --- | --- | --- |
| Before the page is left | `OnNavigatingFrom` | `Navigating` | Cancel navigation by setting `e.Cancel = true` |
| After the page becomes current | `OnNavigatedTo` | `Navigated` | Read the parameter and load data |
| After the page stops being current | `OnNavigatedFrom` | `Navigated` (the same event as the row above) | Save state, unsubscribe from events |

Each handler's arguments include `NavigationMode`, which says whether the navigation was `New`, `Back`, `Forward`, or `Refresh`. The frame raises `NavigationFailed` when a page can't be loaded, and `NavigationStopped` when a new navigation interrupts one in progress.

Cancelling suits unsaved changes, with one limit. `OnNavigatingFrom` returns `void`, so it can't wait for the user to answer a dialog. Cancel the navigation, show the dialog, and navigate again once the user has decided:

```csharp
protected override void OnNavigatingFrom(NavigatingCancelEventArgs e)
{
    if (ViewModel.HasUnsavedChanges)
    {
        e.Cancel = true;
        _ = ConfirmAndLeaveAsync(e.SourcePageType, e.Parameter);
    }
    base.OnNavigatingFrom(e);
}
```

`ConfirmAndLeaveAsync` stands for your own method. It asks the user, saves or discards, clears the unsaved flag, and calls `Frame.Navigate` with the same page and parameter. For a back navigation (`e.NavigationMode` is `Back`), it calls `Frame.GoBack` instead.

### Page Caching

By default every navigation creates a new instance of the page, so returning to a page resets its controls. `Page.NavigationCacheMode` changes that:

| Value | Behavior |
| --- | --- |
| `Disabled` (default) | A new instance on every navigation |
| `Enabled` | The instance is cached and reused until the frame's `CacheSize` limit is exceeded |
| `Required` | The instance is cached and reused regardless of `CacheSize` |

A cached page keeps its field values and control state, and its constructor doesn't run again. `OnNavigatedTo` still runs on every visit, so do per-visit work such as refreshing data there. Each cached page holds all of its UI in memory, so cache the pages users return to often, not every page.

## NavigationView

`NavigationView` is the top-level navigation control for apps with several sections. It pairs a pane of navigation items with a content area, which usually holds the `Frame`.

### Pane Display Modes

`PaneDisplayMode` decides where the pane sits and how much of it shows:

| Mode | What the user sees |
| --- | --- |
| `Left` | An expanded pane with icons and labels beside the content |
| `LeftCompact` | Icons only, until the menu button opens the pane over the content |
| `LeftMinimal` | Only the menu button, until it opens the pane over the content |
| `Top` | Items in a horizontal bar above the content. Items that don't fit move to an overflow menu |
| `Auto` (default) | `LeftMinimal` at 640 pixels wide or less, `LeftCompact` from 641 to 1007, and `Left` from 1008 |

`CompactModeThresholdWidth` and `ExpandedModeThresholdWidth` move the `Auto` breakpoints. To switch between `Top` on wide windows and `LeftMinimal` on narrow ones, set `PaneDisplayMode` from a visual state with an `AdaptiveTrigger`, which applies the state's setters once the window passes a given width.

### Wiring Items to the Frame

Tapping an item raises `ItemInvoked` and, when the tapped item wasn't already selected, `SelectionChanged`. Handle one of them for navigation, not both:

- **`ItemInvoked`** fires on every tap, including a tap on the item that's already selected. Navigating there reloads the page and pushes a duplicate history entry unless you check for it.
- **`SelectionChanged`** also fires when code sets `SelectedItem`. Code that syncs the selection after a back navigation raises it too, so the handler needs the same duplicate check.

Microsoft's sample uses `ItemInvoked` with a duplicate check, and syncs the selection and back button from the frame's `Navigated` event. Nothing loads until you navigate the first time, so navigate to the home page and select its item when the view loads.

```xml
<NavigationView x:Name="NavView"
                ItemInvoked="NavView_ItemInvoked"
                BackRequested="NavView_BackRequested">
    <NavigationView.MenuItems>
        <NavigationViewItem Content="Home" Tag="Home" Icon="Home" />
        <NavigationViewItem Content="Orders" Tag="Orders" Icon="List" />
    </NavigationView.MenuItems>
    <Frame x:Name="ContentFrame" Navigated="ContentFrame_Navigated" />
</NavigationView>
```

```csharp
private static readonly Dictionary<string, Type> Pages = new()
{
    ["Home"] = typeof(HomePage),
    ["Orders"] = typeof(OrdersPage),
};

private void NavView_ItemInvoked(NavigationView sender, NavigationViewItemInvokedEventArgs args)
{
    Type? pageType = args.IsSettingsInvoked
        ? typeof(SettingsPage)
        : Pages.GetValueOrDefault(args.InvokedItemContainer?.Tag as string ?? "");

    // Invoking the current page's item again would push a duplicate entry.
    if (pageType is not null && pageType != ContentFrame.CurrentSourcePageType)
        ContentFrame.Navigate(pageType, null, args.RecommendedNavigationTransitionInfo);
}

private void NavView_BackRequested(NavigationView sender, NavigationViewBackRequestedEventArgs args)
{
    if (ContentFrame.CanGoBack)
        ContentFrame.GoBack();
}

private void ContentFrame_Navigated(object sender, NavigationEventArgs e)
{
    NavView.IsBackEnabled = ContentFrame.CanGoBack;
    NavView.SelectedItem = e.SourcePageType == typeof(SettingsPage)
        ? NavView.SettingsItem
        : NavView.MenuItems.Concat(NavView.FooterMenuItems).OfType<NavigationViewItem>()
              .FirstOrDefault(i => Pages.GetValueOrDefault(i.Tag as string ?? "") == e.SourcePageType);
}
```

A page with no pane item of its own, such as a detail page reached from a list, matches nothing, so the sync clears the selection. Map such pages to their parent section's item if the highlight should stay.

A cancelled navigation breaks this loop. `NavigationView` marks the tapped item selected before it raises `ItemInvoked`, and when the page cancels in `OnNavigatingFrom`, `Navigated` never fires to put the selection back. The pane then highlights a page that isn't showing, so reset `SelectedItem` to the current page's item wherever you cancel.

For items that come from data rather than markup, bind `MenuItemsSource` and set `MenuItemTemplate`. `args.InvokedItem` then holds the data object.

### The Back Button

`NavigationView` draws a back button at the top left of the pane, and like its items it only raises an event. `IsBackButtonVisible` defaults to `Auto`, which shows the button on desktop. `IsBackEnabled` enables it, and `BackRequested` doesn't fire while it's `false`, so keep it in step with `CanGoBack` as the sample does. When the pane is open as an overlay in `LeftCompact` or `LeftMinimal`, the back button closes the pane instead of raising `BackRequested`.

An app that draws its own title bar with the `TitleBar` control lets that control own the back and menu buttons. Set `IsBackButtonVisible="Collapsed"` and `IsPaneToggleButtonVisible="False"` on the `NavigationView`, and forward the title bar's `BackRequested` and `PaneToggleRequested` events to the frame and pane.

### Pane Content

Beyond `MenuItems`, the pane has a few fixed slots:

- **The settings item** appears by default, at the bottom of a left pane and at the right end of a top pane. It raises the navigation events with `IsSettingsInvoked` or `IsSettingsSelected` set. Hide it with `IsSettingsVisible="False"`.
- **`FooterMenuItems`** puts navigation items at the end of the pane, before the settings item. Items there share one selection with `MenuItems`.
- **`PaneHeader` and `PaneFooter`** hold arbitrary content. Put anything that isn't a navigation item there rather than in `FooterMenuItems`.
- **`AutoSuggestBox`** places a search box in the pane for app-wide search.
- **`NavigationViewItemHeader` and `NavigationViewItemSeparator`** label and divide groups of items.

### Hierarchical Items

A `NavigationViewItem` can hold its own `MenuItems`, or bind `MenuItemsSource`, to show children that expand beneath it. Hierarchy shows in `Left`, `LeftCompact`, and `Top`. Any depth works, but Microsoft recommends keeping it shallow and considers two levels ideal. When a parent has no page of its own, set its `SelectsOnInvoked` to `false` so tapping it expands it without selecting it. `ItemInvoked` still fires for that tap, so the handler has to ignore parents. If parents do have pages, prefer `Left` or `Top`, because in `LeftCompact` the user has to navigate to the parent each time to reach its children.

## TabView

`TabView` holds a strip of tabs, each a `TabViewItem` with a `Header`, an optional icon, and `Content`. Microsoft distinguishes two uses:

- **Document tabs**, as in a browser, where the user opens, closes, reorders, and moves tabs between windows. This is `TabView`'s default configuration.
- **Static tabs**, a fixed set of pages like a settings window. Turn off `IsAddTabButtonVisible`, `CanReorderTabs`, and each tab's `IsClosable`. With more than a few static destinations, Microsoft recommends `NavigationView` instead.

### Opening and Closing Tabs

The add button raises `AddTabButtonClick`, and a tab's close button raises `TabCloseRequested`. The control changes nothing itself. Your handlers add and remove the tabs, which is where you can prompt about unsaved changes before a close. Bound to a collection through `TabItemsSource`, the handlers edit the collection, and `TabItemTemplate` must have a `TabViewItem` as its root:

```xml
<TabView TabItemsSource="{x:Bind Documents}"
         AddTabButtonClick="TabView_AddTabButtonClick"
         TabCloseRequested="TabView_TabCloseRequested">
    <TabView.TabItemTemplate>
        <DataTemplate x:DataType="local:DocumentTab">
            <TabViewItem Header="{x:Bind Title, Mode=OneWay}">
                <local:DocumentEditor Document="{x:Bind}" />
            </TabViewItem>
        </DataTemplate>
    </TabView.TabItemTemplate>
</TabView>
```

```csharp
public ObservableCollection<DocumentTab> Documents { get; } = new();

private void TabView_AddTabButtonClick(TabView sender, object args)
    => Documents.Add(new DocumentTab("Untitled"));

private void TabView_TabCloseRequested(TabView sender, TabViewTabCloseRequestedEventArgs args)
    => Documents.Remove((DocumentTab)args.Item);
```

The header binds `OneWay` so a renamed document updates its tab, which works only if `DocumentTab` raises property-change notifications through `INotifyPropertyChanged`. When the selected tab closes, `TabView` selects the next one. If the window should close with its last tab, close it in the same handler.

A tab's content is usually a `UserControl` or a `Page`. A tab whose content needs its own page-to-page history can hold a `Frame`, which keeps a separate back stack per tab.

### Tab Appearance and Keyboard

`TabWidthMode` sizes the tabs: `Equal` (the default), `SizeToContent`, or `Compact`, which shrinks unselected tabs to their icons. `CloseButtonOverlayMode="OnPointerOver"` shows close buttons on unselected tabs only while the pointer is over them. When tabs overflow the strip, scroll buttons appear at its ends.

Some keyboard behavior is built in. Arrow keys move focus within the strip, Ctrl+Tab and Ctrl+Shift+Tab select the next and previous tab, and Ctrl+F4 raises `TabCloseRequested`. The browser shortcuts users expect, such as Ctrl+T for a new tab, Ctrl+W to close, Ctrl+1 through Ctrl+8 to jump to a tab, and Ctrl+9 for the last tab, are yours to add with keyboard accelerators.

### Tearing Tabs Out into Windows

From Windows App SDK 1.6, setting `CanTearOutTabs="True"` lets the user drag a tab out of the strip. The new window appears during the drag, so it can be snapped or maximized in one motion. The control handles the gesture, and the app handles the windows through four events. The first two identify the new window by `AppWindow.Id`, the ID of the system window object that every XAML `Window` exposes through its `AppWindow` property.

| Event | Raised on | Your handler |
| --- | --- | --- |
| `TabTearOutWindowRequested` | The source `TabView`, when a tab first leaves the strip | Creates a window containing a `TabView` and sets `args.NewWindowId` to the window's `AppWindow.Id` |
| `TabTearOutRequested` | The source `TabView`, once the window exists | Moves the tab from the source to the new window's `TabView` |
| `ExternalTornOutTabsDropping` | A `TabView` the torn-out tab is dragged over | Sets `AllowDrop` to accept the tab |
| `ExternalTornOutTabsDropped` | The same `TabView`, after it accepts | Removes the tab from its original `TabView` and inserts it at `DropIndex` |

With tear-out on, the older drag-and-drop tab events such as `TabDroppedOutside` aren't raised. Tear-out also means the app now has several windows. It has to track them, find the right one to close when its last tab closes, and make sure each window's content gets the services and state it needs.

Tabs can also sit in the window's title bar to save vertical space. That requires extending the window's content into the title bar area, and reserving part of the strip, typically a `TabStripFooter`, as a drag region, the area the user grabs to move the window. Without one, the whole title bar drags and the tabs stop receiving clicks.

## BreadcrumbBar

`BreadcrumbBar` shows the path from a root to the current location, separated by chevrons, and lets the user jump back to any level. When the path doesn't fit, an ellipsis replaces the leftmost items and opens a flyout listing them.

It has no `Items` collection. Set `ItemsSource` to your own path objects, which display through `ToString()` or an `ItemTemplate`. Clicking an item raises `ItemClicked` with the item's `Index` and `Item`. Like the other controls, it doesn't navigate. Your code keeps the path. Append an item when the user drills down. When they click an ancestor, trim the path back to it and show that location. The last item is the current location, and Microsoft recommends doing nothing when it's clicked.

```xml
<BreadcrumbBar ItemsSource="{x:Bind Crumbs}" ItemClicked="Breadcrumb_ItemClicked" />
```

```csharp
public ObservableCollection<Folder> Crumbs { get; } = new();

private void Breadcrumb_ItemClicked(BreadcrumbBar sender, BreadcrumbBarItemClickedEventArgs args)
{
    if (args.Index == Crumbs.Count - 1)
        return;

    while (Crumbs.Count > args.Index + 1)
        Crumbs.RemoveAt(Crumbs.Count - 1);

    ShowFolder((Folder)args.Item);
}
```

Bind to an `ObservableCollection` so the bar updates as the path changes. `ShowFolder` stands for whatever displays a location, which might navigate a `Frame` or reload a list on the same page. With only two levels, Microsoft recommends a plain back button instead.

## Choosing a Navigation Pattern

| Content structure | Control | Notes |
| --- | --- | --- |
| 5 to 10 equally important top-level sections | `NavigationView`, `Left` | Makes the sections prominent, at the cost of content width |
| 5 or fewer top-level sections, or labels that icons can't convey | `NavigationView`, `Top` | Leaves more room for content, and extra items overflow to a menu |
| Documents or pages the user opens, closes, and keeps side by side | `TabView` | Built for dynamic tabs. It can show static tabs too, but with more than a few, prefer `NavigationView` |
| A hierarchy several levels deep, such as folders | `BreadcrumbBar` | Not for two levels, where a back button is enough |
| A few views of one page's content, one at a time | `SelectorBar` | Switches content within a page rather than navigating a frame |

The controls combine. A file manager might use `NavigationView` for top-level locations, with a `BreadcrumbBar` above the content showing the folder path. A document app might put a `TabView` in the title bar, with a `Frame` inside each tab.

A linear flow, such as a setup wizard, fits none of these. The navigation controls assume the user moves between destinations freely, while a wizard moves in one direction. A `Frame` with explicit Next and Back buttons usually makes that direction clearer.
