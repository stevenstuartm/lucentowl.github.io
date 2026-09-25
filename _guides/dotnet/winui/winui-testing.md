---
title: "Testing WinUI 3 Applications"
layout: guide
category: "WinUI 3"
subcategory: "Quality & Testing"
description: "Testing a WinUI 3 app at three levels: view models and services in a plain library project, XAML objects on the UI thread with the WinUI Unit Test App and [UITestMethod], and end-to-end flows through UI Automation with Appium (and the WinAppDriver it still depends on) or FlaUI."
tags: [testing, ui-automation, mstest, uitestmethod, appium, winappdriver, practical]
---

## Table of Contents

- [Three Places a Test Can Run](#three-places-a-test-can-run)
- [Keep Testable Code in a Library](#keep-testable-code-in-a-library)
- [What to Assert on a View Model](#what-to-assert-on-a-view-model)
- [Testing the Real Service Registrations](#testing-the-real-service-registrations)
- [Tests That Need the UI Thread](#tests-that-need-the-ui-thread)
- [End-to-End Tests Through UI Automation](#end-to-end-tests-through-ui-automation)
- [Keeping the Suite Useful](#keeping-the-suite-useful)

---

## Three Places a Test Can Run

Most types in the `Microsoft.UI.Xaml` namespaces can only be used on a UI thread inside a running XAML app. A plain test runner has no such thread, so a test that creates a `Button`, reads a dependency property, or constructs a custom control fails there. That rule decides where each test in a WinUI app has to run:

| Level | Runs in | Can exercise | Cost |
|---|---|---|---|
| Library tests | Any .NET test project, on any thread | View models, services, validation, navigation decisions | Milliseconds per test, runs anywhere |
| UI-thread tests | The **WinUI Unit Test App**, a small packaged WinUI app that hosts MSTest | Controls, dependency properties, anything built from XAML types | An app deploy and startup per run; Microsoft documents running them only from Visual Studio |
| End-to-end tests | A separate process driving the installed app through UI Automation, the Windows accessibility API | Whole user flows, as a user would perform them | Seconds per test, needs an interactive desktop, most prone to flakiness |

A healthy suite has many library tests, a few UI-thread tests, and a short list of end-to-end flows. The shape follows from how cheap each level is, and from how much of an app's logic can be kept out of reach of the UI thread.

---

## Keep Testable Code in a Library

Microsoft's [testing guidance for Windows App SDK apps](https://learn.microsoft.com/en-us/windows/apps/develop/testing/){:target="_blank" rel="noopener noreferrer"} recommends pulling the code under test out of the app project into a library that both the app and the tests reference. The app project is a Windows executable that carries pages, a `Window`, and packaging, which is more than a test needs to load to reach a view model.

A library that references no WinUI types can target plain `net10.0`. Its tests are then ordinary .NET tests in MSTest, xUnit, or NUnit, run by `dotnet test` on any build agent. View models built with the MVVM Toolkit qualify, since `CommunityToolkit.Mvvm` doesn't depend on WinUI. The work is keeping WinUI types out of the view model: a `Visibility` or `Brush` property belongs in a converter, a `Frame` belongs behind a navigation service, and a `DispatcherQueue` belongs at the edge of the app.

A view model test constructs the view model with fake services and checks its state:

```csharp
[TestClass]
public class ProductListViewModelTests
{
    [TestMethod]
    public async Task LoadCommand_FillsProductsFromService()
    {
        var service = new FakeProductService
        {
            Products = [new Product(1, "Widget"), new Product(2, "Gadget")]
        };
        var viewModel = new ProductListViewModel(service, new FakeNavigationService());

        await viewModel.LoadCommand.ExecuteAsync(null);

        Assert.AreEqual(2, viewModel.Products.Count);
        Assert.AreEqual("Widget", viewModel.Products[0].Name);
    }
}
```

When a library does have to reference WinUI, a test project that references it needs three changes, and the machine that runs it needs one more:

- Its `TargetFramework` has to match the library's Windows-specific one (for example `net10.0-windows10.0.26100.0`), instead of the template's plain `net10.0`.
- It lists `RuntimeIdentifiers` for `win-x86;win-x64;win-arm64`.
- It sets `<WindowsAppSdkBootstrapInitialize>true</WindowsAppSdkBootstrapInitialize>` so the test process loads the Windows App SDK runtime.
- The Windows App SDK runtime has to be installed on every machine that runs the tests.

That setup loads the runtime and nothing more. The test still runs without a UI thread, so it can test the library's non-XAML types but not its controls.

Test doubles, mocking libraries, and framework choice work the same here as in any .NET code. Nothing about them is specific to WinUI.

---

## What to Assert on a View Model

A view model's contract with its view is the bindings: properties that raise `PropertyChanged`, and commands that run and enable themselves at the right time. The tests that pay off check that contract, because a break in it fails silently at runtime. A button stays disabled, or a label stops updating, and nothing throws.

### Commands

A `[RelayCommand]` on an async method generates an `IAsyncRelayCommand`. Tests should await `ExecuteAsync` rather than call `Execute`. `Execute` is the `ICommand` method a button calls. It returns before the work finishes, so a test that calls it asserts too early, and an exception from the work doesn't fail the test where it happened. `ExecuteAsync` returns the task, which the test can await.

A button re-reads `CanExecute` only when the command raises `CanExecuteChanged`. With the MVVM Toolkit, `[NotifyCanExecuteChangedFor]` on the property does that. A test that checks only `CanExecute` passes even when the attribute is missing, so check the event too:

```csharp
[TestMethod]
public void SaveCommand_ReevaluatesWhenNameChanges()
{
    var viewModel = new EditProductViewModel(new FakeProductService());
    var raised = false;
    viewModel.SaveCommand.CanExecuteChanged += (_, _) => raised = true;

    viewModel.ProductName = "New Widget";

    Assert.IsTrue(raised);
    Assert.IsTrue(viewModel.SaveCommand.CanExecute(null));
}
```

### Property notifications

A generated property raises `PropertyChanged` for itself, so testing that adds little. The risk is a derived property, such as a `DisplayTotal` computed from `Quantity` and `Price`, whose notification depends on `[NotifyPropertyChangedFor]` or a hand-written call. Capture the raised names and assert on the derived one:

```csharp
[TestMethod]
public void Quantity_RaisesDisplayTotal()
{
    var viewModel = new OrderLineViewModel { Price = 2.50m };
    var raised = new List<string?>();
    viewModel.PropertyChanged += (_, e) => raised.Add(e.PropertyName);

    viewModel.Quantity = 4;

    CollectionAssert.Contains(raised, nameof(OrderLineViewModel.DisplayTotal));
}
```

### Navigation

A view model that navigates through an `INavigationService`, instead of holding a `Frame`, can be tested with a fake that records the calls. The interface below is the one a navigation service exposes when it maps view model types to pages:

```csharp
public sealed class FakeNavigationService : INavigationService
{
    public List<(Type Target, object? Parameter)> Calls { get; } = [];
    public int BackCount { get; private set; }

    public bool NavigateTo<TViewModel>(object? parameter = null)
    {
        Calls.Add((typeof(TViewModel), parameter));
        return true;
    }

    public bool GoBack()
    {
        BackCount++;
        return true;
    }
}

[TestMethod]
public async Task OpenCommand_NavigatesToDetailWithProductId()
{
    var navigation = new FakeNavigationService();
    var viewModel = new ProductListViewModel(new FakeProductService(), navigation);

    await viewModel.OpenCommand.ExecuteAsync(42);

    Assert.AreEqual((typeof(ProductDetailViewModel), (object?)42), navigation.Calls.Single());
}
```

The test checks the decision (which view model, which parameter), not that a page appeared. Whether the page mapping is right is a question for an end-to-end test.

### Threads

A test thread has no `DispatcherQueue`, so `DispatcherQueue.GetForCurrentThread()` returns `null` there. A view model that grabs the queue in its constructor can't be created in a test. Such a view model should take a dispatch interface instead, which the test implements by running the action inline.

---

## Testing the Real Service Registrations

A view model test with hand-built fakes proves the logic. It doesn't prove that the app's container can build that view model, and a missing registration surfaces only when a page first asks for it. A test that uses the app's own registrations catches that.

That requires the registrations to be callable from a test. Instead of a private method on `App`, put them in an extension method in the library, where the app and the tests both call it:

```csharp
public static class ServiceRegistration
{
    public static IServiceCollection AddAppServices(this IServiceCollection services)
    {
        services.AddSingleton<IProductRepository, SqliteProductRepository>();
        services.AddSingleton<IProductService, ProductService>();
        services.AddTransient<ProductListViewModel>();
        services.AddTransient<ProductDetailViewModel>();
        return services;
    }
}
```

The test replaces what touches disk, network, or the UI, and builds the provider with `ValidateOnBuild` and `ValidateScopes` on, so a missing dependency or a scope mistake fails the test instead of a page:

```csharp
[TestClass]
public class CompositionTests
{
    private ServiceProvider _provider = null!;

    [TestInitialize]
    public void Setup()
    {
        var services = new ServiceCollection().AddAppServices();

        // Swap the SQLite repository for an in-memory one.
        services.Replace(ServiceDescriptor.Singleton<IProductRepository, InMemoryProductRepository>());

        // The app registers its Frame-backed navigation service itself.
        services.AddSingleton<INavigationService, FakeNavigationService>();

        _provider = services.BuildServiceProvider(new ServiceProviderOptions
        {
            ValidateOnBuild = true,
            ValidateScopes = true
        });
    }

    [TestMethod]
    public async Task AddThenLoad_ReturnsTheNewProduct()
    {
        var viewModel = _provider.GetRequiredService<ProductListViewModel>();

        await viewModel.AddCommand.ExecuteAsync("Integration Widget");
        await viewModel.LoadCommand.ExecuteAsync(null);

        Assert.AreEqual("Integration Widget", viewModel.Products.Single().Name);
    }

    [TestCleanup]
    public void Teardown() => _provider.Dispose();
}
```

`Replace` lives in `Microsoft.Extensions.DependencyInjection.Extensions`. The in-memory repository proves the wiring and the logic above it, not the SQL. Queries belong in tests against a real database engine.

---

## Tests That Need the UI Thread

Some code can't leave the XAML world: a custom control's dependency properties, a templated control's state logic, a `UserControl`'s code-behind. Testing it needs a real UI thread, and that means running MSTest inside a WinUI app.

The **WinUI Unit Test App** template provides one. In Visual Studio it appears under C#, Windows, WinUI; from the command line it is `dotnet new winui-unittest` from the prerelease `Microsoft.WindowsAppSDK.WinUI.CSharp.Templates` package. The project is itself a packaged WinUI app. At launch its `UnitTestApp` class creates a `UnitTestAppWindow`, assigns that window's queue to `UITestMethodAttribute.DispatcherQueue`, and hands control to the MSTest client. A test marked `[UITestMethod]` is dispatched onto that queue, so it runs on the window's UI thread. A `[TestMethod]` in the same project doesn't run there.

The tested controls live in a WinUI class library that the test app references:

```csharp
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Microsoft.VisualStudio.TestTools.UnitTesting.AppContainer;

[TestClass]
public partial class RatingBadgeTests
{
    [UITestMethod]
    public void Value_AboveMaximum_IsClamped()
    {
        var badge = new RatingBadge { Maximum = 5 };

        badge.Value = 9;

        Assert.AreEqual(5, badge.Value);
    }
}
```

`UITestMethod` lives in the `...UnitTesting.AppContainer` namespace, not the usual one. The template's own sample test creates a `Grid` under `[UITestMethod]`. The same line under `[TestMethod]` would run off the UI thread and break the rule this level exists for.

A control created in a test isn't part of any window's element tree, so `Loaded` never fires for it. A test that depends on the loaded state has to put the control into the test app's window as content. The template keeps that window in a private `_window` field of `UnitTestApp`, so the app has to expose it to the tests first, for example through a static property.

Keep this level small. Each run builds, deploys, and starts an app. Microsoft documents running these tests from Visual Studio's Test Explorer and describes no command-line or CI route, so plan on them running on developer machines. A test that could run in the library project belongs there.

---

## End-to-End Tests Through UI Automation

An end-to-end test launches the real app and drives it from another process, clicking and typing as a user would. It finds elements through the same **UI Automation** tree that screen readers read, which is why accessibility work and testability reinforce each other.

### Choosing a driver

**WinAppDriver**, Microsoft's WebDriver server for Windows apps, was the original tool. It is no longer under active development, and its last stable release (1.2.1) dates from November 2020. Microsoft's testing page names **Appium** with the **Windows driver** (`appium-windows-driver`) as the successor. That driver works as a proxy that forwards commands to WinAppDriver, so WinAppDriver still has to be installed and remains a dependency. The Appium .NET client, for its part, can no longer talk to a standalone WinAppDriver server, because WinAppDriver predates the W3C standard version of WebDriver, the HTTP protocol that browser automation settled on and that Appium speaks.

| Tool | Between the test and the app | Machine prerequisites |
|---|---|---|
| [Appium](https://appium.io/){:target="_blank" rel="noopener noreferrer"} + [Windows driver](https://github.com/appium/appium-windows-driver){:target="_blank" rel="noopener noreferrer"} | Appium server (Node.js), the Windows driver, then WinAppDriver | Node.js, WinAppDriver, Developer Mode |
| Appium + [NovaWindows driver](https://github.com/AutomateThePlanet/appium-novawindows-driver){:target="_blank" rel="noopener noreferrer"} | Appium server and a third-party driver that reaches UI Automation without WinAppDriver | Node.js |
| [FlaUI](https://github.com/FlaUI/FlaUI){:target="_blank" rel="noopener noreferrer"} | Nothing; a .NET library wraps UI Automation inside the test process | None beyond the test project |

Appium fits a team that already uses WebDriver tooling or writes tests in several languages, at the cost of a Node.js server and, with the Windows driver, a dependency that hasn't had a stable fix since 2020. NovaWindows keeps the Appium API without WinAppDriver, though it takes its own `automationName`, so the sample below needs changes to use it. FlaUI removes the server and WinAppDriver but ties the tests to .NET and to FlaUI's own API.

### An Appium test

The Appium setup is `npm install -g appium`, then `appium driver install windows`, then `appium driver run windows install-wad` to install WinAppDriver (the driver stopped installing it in version 3), then `appium` to start the server, which listens on port 4723. The `app` capability is the app's Application User Model ID for a packaged app, or the path to the executable for an unpackaged one. The `Get-StartApps` PowerShell command lists installed apps with their IDs. The C# client is the `Appium.WebDriver` package. Version 5 and later use a non-generic `WindowsDriver` and find elements through `MobileBy`:

```csharp
using OpenQA.Selenium.Appium;
using OpenQA.Selenium.Appium.Windows;

[TestClass]
public class NewOrderFlowTests
{
    private static WindowsDriver? _session;

    [ClassInitialize]
    public static void Setup(TestContext _)
    {
        var options = new AppiumOptions
        {
            PlatformName = "Windows",
            AutomationName = "Windows",
            App = "<PackageFamilyName>!App"
        };

        _session = new WindowsDriver(new Uri("http://127.0.0.1:4723"), options);
        _session.Manage().Timeouts().ImplicitWait = TimeSpan.FromSeconds(5);
    }

    [TestMethod]
    public void SubmittingAnOrder_ShowsConfirmation()
    {
        _session!.FindElement(MobileBy.AccessibilityId("CustomerInput")).SendKeys("Contoso Ltd");
        _session.FindElement(MobileBy.AccessibilityId("QuantityInput")).SendKeys("3");
        _session.FindElement(MobileBy.AccessibilityId("SubmitOrderButton")).Click();

        var status = _session.FindElement(MobileBy.AccessibilityId("OrderStatusText"));
        Assert.AreEqual("Order submitted", status.Text);
    }

    [ClassCleanup]
    public static void Cleanup()
    {
        _session?.Quit();
        _session = null;
    }
}
```

The implicit wait makes each `FindElement` retry for up to five seconds, which absorbs most delays from navigation and data loading.

### Giving elements stable IDs

`MobileBy.AccessibilityId` matches the element's UI Automation **AutomationId**. When `AutomationProperties.AutomationId` isn't set, WinUI reports the element's `x:Name` instead, so named elements are findable without extra markup. Relying on that ties the tests to names chosen for code-behind, and renaming a field in a refactor breaks a test with no compile error. Setting the ID explicitly on every element a test touches makes it part of the contract. Accessibility Insights' Live Inspect shows the ID an element actually reports:

```xml
<TextBox x:Name="CustomerBox"
         AutomationProperties.AutomationId="CustomerInput"
         Header="Customer" />
```

Elements generated from a `DataTemplate` all carry the same `x:Name`, so a test can't tell list items apart by it. Bind their `AutomationId` to something unique in the item, such as its key.

### Where these tests run

End-to-end tests drive a real desktop, and WinAppDriver's CI guidance requires a build agent configured to run interactively. Keep them in a separate test project so the fast suites can run on any agent.

For web content hosted in a WebView2, Microsoft's testing page points to [Playwright's WebView2 support](https://playwright.dev/docs/webview2){:target="_blank" rel="noopener noreferrer"} rather than a Windows UI driver.

---

## Keeping the Suite Useful

**Put each test at the cheapest level that can catch the bug.** A wrong enable state is a view model test. A missing registration is a registration test. A control that clamps its value is a UI-thread test. A page that doesn't appear after login is the only one that needs end-to-end automation.

**Keep the end-to-end list short.** A few flows that carry the most risk, such as sign-in, the main data entry path, and moving between the app's major sections, cover more than a large suite that fails on timing and ends up disabled.

**Start every test from a known state.** Desktop apps keep state in memory and on disk between operations. In library tests, construct a fresh view model and fresh fakes per test. In end-to-end tests, reset the app's data store and relaunch the app, or return to a known starting page, before each test.

**Set AutomationIds as screens are built.** Adding them later means touching every screen at once, just when the first end-to-end test is needed.
