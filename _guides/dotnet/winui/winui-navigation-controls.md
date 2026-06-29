---
title: "Navigation Controls and Patterns"
layout: guide
category: "WinUI 3"
subcategory: "Controls & UI"
description: "Implementing navigation in WinUI 3 applications using NavigationView, TabView, BreadcrumbBar, and the Frame and Page navigation model."
tags: [winui, winui-3, xaml, navigation, controls, ui-framework, desktop, practical]
---

## Table of Contents

- [The Navigation Model](#the-navigation-model)
- [NavigationView](#navigationview)
- [NavigationView Features](#navigationview-features)
- [TabView](#tabview)
- [BreadcrumbBar](#breadcrumbbar)
- [Frame Navigation](#frame-navigation)
- [Choosing a Navigation Pattern](#choosing-a-navigation-pattern)
- [Deep Linking and Activation-Based Navigation](#deep-linking-and-activation-based-navigation)

---

## The Navigation Model

WinUI 3 navigation is built around two primitives: the `Frame` control and the `Page` class. A `Frame` acts as a host that loads and displays `Page` instances, maintaining a navigation stack so users can move backward and forward through their history. This design separates the shell of the application, which contains persistent chrome like navigation menus and toolbars, from the content area that changes as the user navigates.

When a user navigates from one page to another, the `Frame` pushes the current page onto its back stack and loads the new page. The `CanGoBack` and `CanGoForward` properties reflect whether history exists in each direction, and both the `GoBack()` and `GoForward()` methods honor that stack. Pages can receive typed parameters during navigation, allowing parent pages or the shell to pass context, such as a selected item or a deep-link identifier, to the destination page without relying on global state.

This model applies consistently whether you are building a simple two-page app or a complex multi-level hierarchy. The `Frame` does not care about your navigation structure; it simply records where you have been and loads what you ask it to load.

---

## NavigationView

`NavigationView` is the primary navigation control in WinUI 3 applications and corresponds to the Fluent Design navigation patterns Microsoft uses across Windows itself. It combines a pane, which holds the navigation items, with a content area where a `Frame` typically lives.

The `PaneDisplayMode` property controls how the pane presents itself.

- **Left** keeps the pane open and visible alongside the content. This works well for desktop applications where screen space is abundant.
- **LeftCompact** shows only icons by default, expanding to show labels on hover or programmatic request. It preserves space while keeping navigation accessible.
- **LeftMinimal** collapses the pane entirely behind a hamburger button, revealing it as an overlay when toggled. This suits narrower windows or content-heavy layouts.
- **Top** moves the navigation items into a horizontal bar above the content area, similar to a traditional menu bar or browser tab strip.

One of the more useful aspects of `NavigationView` is its built-in adaptive behavior. When you leave `PaneDisplayMode` set to `Auto`, the control automatically switches between Left, LeftCompact, and LeftMinimal depending on the window width. The thresholds are configurable via `CompactModeThresholdWidth` and `ExpandedModeThresholdWidth`, so you can tune the breakpoints to match your content.

A minimal `NavigationView` wired to a `Frame` looks like this in XAML:

```xml
<NavigationView x:Name="NavView"
                SelectionChanged="NavView_SelectionChanged"
                IsBackButtonVisible="Visible"
                BackRequested="NavView_BackRequested">
    <NavigationView.MenuItems>
        <NavigationViewItem Content="Home" Tag="HomePage" Icon="Home" />
        <NavigationViewItem Content="Settings" Tag="SettingsPage" Icon="Setting" />
    </NavigationView.MenuItems>
    <Frame x:Name="ContentFrame" />
</NavigationView>
```

In the code-behind, the `SelectionChanged` handler resolves the tag to a page type and calls `ContentFrame.Navigate()`:

```csharp
private void NavView_SelectionChanged(NavigationView sender,
    NavigationViewSelectionChangedEventArgs args)
{
    if (args.IsSettingsSelected)
    {
        ContentFrame.Navigate(typeof(SettingsPage));
        return;
    }

    var item = args.SelectedItem as NavigationViewItem;
    if (item?.Tag is string tag)
    {
        var pageType = tag switch
        {
            "HomePage" => typeof(HomePage),
            "SettingsPage" => typeof(SettingsPage),
            _ => null
        };
        if (pageType != null)
            ContentFrame.Navigate(pageType);
    }
}
```

---

## NavigationView Features

Beyond the basic pane and item list, `NavigationView` exposes several features that make it practical for real applications.

The built-in back button appears in the top-left corner when `IsBackButtonVisible` is set to `Visible` or `Auto`. Setting it to `Auto` shows the button only when `IsBackEnabled` is true, which you should keep synchronized with `ContentFrame.CanGoBack`. The `BackRequested` event fires when the user clicks the button, and in the handler you call `ContentFrame.GoBack()`.

A search box can be embedded in the pane by assigning an `AutoSuggestBox` to the `AutoSuggestBox` property on `NavigationView`. This gives you a standard search entry point without building your own layout. The `NavigationView` handles positioning the box within the pane header area.

The settings item at the bottom of the pane is included by default and raises `SelectionChanged` with `args.IsSettingsSelected == true`. You can hide it by setting `IsSettingsVisible="False"` if your app handles settings elsewhere.

The `FooterMenuItems` collection lets you place items at the bottom of the pane above the settings item, which is useful for secondary actions like profile management or help links. The `PaneHeader` and `PaneFooter` content properties accept arbitrary XAML for more custom layouts within the pane.

When you have many navigation items that are data-driven rather than static, `MenuItemsSource` accepts a collection and `MenuItemTemplate` controls the item presentation. This is preferable to programmatically adding `NavigationViewItem` instances in code-behind, since it keeps the view model in control of navigation structure.

---

## TabView

`TabView` addresses a different pattern: applications where the user maintains multiple concurrent documents or sessions, similar to a web browser or a code editor. Each tab hosts independent content, and the user can open, close, and reorder tabs freely.

The control exposes `TabItems` for a static list and `TabItemsSource` for data binding. Each `TabViewItem` has a `Header` for the tab label and a `Content` for what appears in the tab body.

```xml
<TabView AddTabButtonClick="TabView_AddTabButtonClick"
         TabCloseRequested="TabView_TabCloseRequested">
    <TabView.TabItems>
        <TabViewItem Header="Document 1">
            <Frame x:Name="Tab1Frame" />
        </TabViewItem>
    </TabView.TabItems>
</TabView>
```

The `TabCloseRequested` event fires when the user clicks the close button on a tab. Your handler is responsible for actually removing the tab from the `TabItems` collection; the control does not remove it automatically. This gives you the opportunity to prompt for unsaved changes before committing to the close.

`TabView` supports drag-to-reorder within the same window by default. With additional setup using `CanTearOutTabs` (available from WinUI 3 1.6 onwards), tabs can be dragged out into new windows, which is the pattern used by apps like Microsoft Edge. Tear-out requires coordinating window creation and passing state to the new window, but the `TabView` handles the drag gesture itself.

When binding `TabItemsSource`, use `TabItemTemplate` to define how each data item maps to a `TabViewItem`:

```xml
<TabView TabItemsSource="{x:Bind Documents}"
         TabItemTemplate="{StaticResource DocumentTabTemplate}" />
```

---

## BreadcrumbBar

`BreadcrumbBar` displays a hierarchical path to the current location and lets users navigate directly to any ancestor by clicking it. It is the right control when your content is organized as a tree or folder hierarchy and users need to understand where they are relative to the root.

The control binds to an `ItemsSource` of path nodes and uses `ItemTemplate` to control how each node appears. When the user clicks a node, the `BreadcrumbBarItemClicked` event fires with the index of the clicked item.

```xml
<BreadcrumbBar ItemsSource="{x:Bind BreadcrumbItems}"
               BreadcrumbBarItemClicked="BreadcrumbBar_ItemClicked">
    <BreadcrumbBar.ItemTemplate>
        <DataTemplate x:DataType="local:BreadcrumbNode">
            <BreadcrumbBarItem Content="{x:Bind Label}" />
        </DataTemplate>
    </BreadcrumbBar.ItemTemplate>
</BreadcrumbBar>
```

In the `BreadcrumbBarItemClicked` handler, truncate the `BreadcrumbItems` collection back to the clicked index and navigate the `Frame` to the corresponding page:

```csharp
private void BreadcrumbBar_ItemClicked(BreadcrumbBar sender,
    BreadcrumbBarItemClickedEventArgs args)
{
    // Trim items after the clicked index
    while (BreadcrumbItems.Count > args.Index + 1)
        BreadcrumbItems.RemoveAt(BreadcrumbItems.Count - 1);

    ContentFrame.Navigate(typeof(FolderPage), BreadcrumbItems[args.Index]);
}
```

`BreadcrumbBar` does not navigate on its own; it reflects a path that your code maintains. When the user navigates forward into a subfolder, you append to `BreadcrumbItems`. When they click an ancestor in the bar, you truncate and navigate back. The control automatically collapses intermediate items with an ellipsis when space is constrained.

---

## Frame Navigation

The `Frame` class exposes a straightforward API for programmatic navigation. `Navigate(Type pageType)` loads the specified page type into the frame. An overload accepts a parameter object, which the destination page retrieves through `e.Parameter` in its `OnNavigatedTo` override:

```csharp
// Navigate and pass a parameter
ContentFrame.Navigate(typeof(DetailPage), selectedItem.Id);

// In DetailPage.xaml.cs
protected override void OnNavigatedTo(NavigationEventArgs e)
{
    base.OnNavigatedTo(e);
    var id = (int)e.Parameter;
    // Load data for this id
}
```

The `Navigating` event fires before the navigation commits, giving you a chance to cancel it or record state. `Navigated` fires after the new page is loaded. Both events carry context about the source page, destination type, parameter, and navigation mode, which is useful for synchronizing navigation controls like `NavigationView` selection state.

`NavigationCacheMode` on a `Page` controls whether the page instance is reused. Setting it to `Enabled` keeps the page in memory when you navigate away, so returning to it restores its state without re-running initialization code. `Required` forces the page to always be cached regardless of memory pressure. The default, `Disabled`, creates a fresh instance every time. Cache with care: keeping many pages in memory can increase the application's working set significantly.

You can also clear the navigation stack programmatically by calling `ContentFrame.BackStack.Clear()`, which is useful after a login flow where you do not want the user to navigate back to the login page.

---

## Choosing a Navigation Pattern

The right navigation pattern depends on the structure of your content and how users move through it.

A left-pane navigation with `NavigationView` suits applications with five to ten top-level sections where users move between areas freely, such as a settings app, a productivity tool, or a dashboard. The persistent pane keeps all destinations visible and eliminates the need to hunt for navigation controls.

Top navigation fits when the sections are roughly equal in prominence and the horizontal space is available. Browser-style apps and document editors sometimes use this layout to keep the content area as tall as possible.

Tab-based navigation with `TabView` works when users genuinely work across multiple independent items simultaneously. If a user needs to compare two records or keep a reference document open while editing another, tabs make that natural. Avoid tabs when each navigation destination is sequential rather than concurrent, since tabs imply independence.

Breadcrumb navigation with `BreadcrumbBar` complements either of the above patterns when content lives in a deep hierarchy. A file manager might use `NavigationView` for top-level drives and shares, then `BreadcrumbBar` to show the current folder path within the content area. The two controls work together naturally.

For wizard-style flows where the user moves through a linear sequence, a plain `Frame` with explicit Next and Back buttons is often clearer than any of the above controls. The navigation controls are designed for non-linear exploration; linear flows benefit from explicit directionality.

---

## Deep Linking and Activation-Based Navigation

Windows applications can be launched with arguments that specify an initial destination, such as through a protocol activation, a notification click, or a file association. WinUI 3 exposes this through activation events in `App.xaml.cs`.

The `OnLaunched` override receives a `LaunchActivatedEventArgs` with an `Arguments` string for command-line launches. For other activation kinds, subscribe to `AppInstance.GetCurrent().Activated`:

```csharp
protected override void OnLaunched(Microsoft.UI.Xaml.Application.LaunchActivatedEventArgs args)
{
    m_window = new MainWindow();
    m_window.Activate();

    AppInstance.GetCurrent().Activated += OnActivated;
}

private void OnActivated(object sender, AppActivationArguments args)
{
    if (args.Kind == ExtendedActivationKind.Protocol)
    {
        var protocolArgs = args.Data as ProtocolActivatedEventArgs;
        var uri = protocolArgs?.Uri;
        DispatcherQueue.TryEnqueue(() => NavigateToUri(uri));
    }
}
```

The `NavigateToUri` method parses the URI, resolves the destination page type, and calls `ContentFrame.Navigate()` with any relevant parameters extracted from the URI path or query string. Because the activation can arrive while the window is already running (if the app instance is shared), the navigation must be dispatched back to the UI thread via `DispatcherQueue`.

When launching from a notification, the `ToastNotificationActivatedEventArgs` carries a launch argument string you define when constructing the notification. Parse that string in the same `Activated` handler and navigate accordingly.

A clean approach is to define a central navigation service or static helper that accepts a destination enum or string and maps it to a page type. This keeps the activation handler thin and puts the mapping logic in one place, which becomes more valuable as the number of navigable destinations grows.

---

## Key Takeaways

Navigation in WinUI 3 is layered by design. The `Frame` and `Page` primitives handle the mechanics of loading content and maintaining history. `NavigationView`, `TabView`, and `BreadcrumbBar` sit above that foundation and provide the visual structure users recognize from Windows applications. Choosing among them is a question of content structure: sectioned apps use `NavigationView`, concurrent documents use `TabView`, and deep hierarchies use `BreadcrumbBar`, often in combination.

Parameter passing through `Navigate()` and `OnNavigatedTo` keeps pages decoupled from each other. `NavigationCacheMode` gives you control over memory versus initialization cost. Activation-based navigation ties the app into the broader Windows launch model, allowing users to arrive at a specific destination from notifications, protocols, or file associations without starting at the home page.
