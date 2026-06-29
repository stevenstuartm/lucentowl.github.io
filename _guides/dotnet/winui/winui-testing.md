---
title: "Testing WinUI 3 Applications"
layout: guide
category: "WinUI 3"
subcategory: "Quality & Testing"
description: "Testing strategies for WinUI 3 applications including ViewModel unit testing, UI testing with MSTest UITestMethod, end-to-end testing with WinAppDriver, and integration testing patterns."
tags: [winui, winui-3, testing, unit-testing, ui-testing, mvvm, desktop, practical]
---

## Table of Contents

- [Testing WinUI 3 Applications](#testing-winui-3-applications)
- [ViewModel Unit Testing](#viewmodel-unit-testing)
- [Testing Commands](#testing-commands)
- [Testing Property Notifications](#testing-property-notifications)
- [Mocking Services and Navigation](#mocking-services-and-navigation)
- [MSTest with UITestMethod](#mstest-with-uitestmethod)
- [UI Automation with WinAppDriver](#ui-automation-with-winappdriver)
- [Integration Testing Patterns](#integration-testing-patterns)
- [Test Project Setup](#test-project-setup)
- [Desktop Testing Best Practices](#desktop-testing-best-practices)

---

## Testing WinUI 3 Applications

Testing desktop applications presents different challenges from testing web or service code. A WinUI 3 application runs on the Windows App SDK runtime, some operations must execute on a specific UI thread, and the app itself packages and deploys as a self-contained Windows application. None of these constraints exist when testing a plain class library.

The practical response is to separate your concerns clearly enough that most of your logic never touches the UI at all. ViewModels, services, repositories, and domain logic can all be tested with standard unit testing tools, no XAML required. The remaining UI-specific code benefits from a narrower set of techniques: thread-aware test execution for controls, UI automation frameworks for end-to-end flows, and integration test harnesses that wire up a real DI container against test doubles.

A well-tested WinUI 3 application will have a large base of fast ViewModel and service unit tests, a smaller set of thread-bound UI component tests, and a narrow layer of end-to-end UI automation tests that validate the most critical user flows.

---

## ViewModel Unit Testing

Because a ViewModel is a plain C# class with no XAML dependencies, you can test it with any standard .NET test framework such as MSTest, NUnit, or xUnit. None of these require a special test host or UI thread. You simply create an instance of the ViewModel, interact with it, and assert on its state.

```csharp
[TestClass]
public class ProductListViewModelTests
{
    [TestMethod]
    public async Task LoadProductsAsync_PopulatesCollection()
    {
        var fakeService = new FakeProductService();
        fakeService.Products = new List<Product>
        {
            new Product { Id = 1, Name = "Widget" },
            new Product { Id = 2, Name = "Gadget" }
        };

        var viewModel = new ProductListViewModel(fakeService);

        await viewModel.LoadProductsAsync();

        Assert.AreEqual(2, viewModel.Products.Count);
        Assert.AreEqual("Widget", viewModel.Products[0].Name);
    }
}
```

The ViewModel receives its dependencies through constructor injection, which is what makes this pattern testable. When the real `IProductService` calls a database or remote API, the fake returns predictable data immediately. The test validates the ViewModel's behavior in isolation.

---

## Testing Commands

Commands are observable objects that ViewModels expose for the View to bind to. Testing them means verifying three things: that the command executes correctly, that `CanExecute` returns the right value under different conditions, and that state changes after execution are reflected in the ViewModel's properties.

```csharp
[TestMethod]
public void SaveCommand_IsDisabled_WhenNameIsEmpty()
{
    var viewModel = new EditProductViewModel(new FakeProductService());
    viewModel.ProductName = string.Empty;

    bool canExecute = viewModel.SaveCommand.CanExecute(null);

    Assert.IsFalse(canExecute);
}

[TestMethod]
public async Task SaveCommand_ExecutesAndSetsIsSaved()
{
    var fakeService = new FakeProductService();
    var viewModel = new EditProductViewModel(fakeService);
    viewModel.ProductName = "New Widget";

    await viewModel.SaveCommand.ExecuteAsync(null);

    Assert.IsTrue(viewModel.IsSaved);
    Assert.AreEqual(1, fakeService.SaveCallCount);
}
```

When using [CommunityToolkit.Mvvm](https://learn.microsoft.com/en-us/dotnet/communitytoolkit/mvvm/){:target="_blank" rel="noopener noreferrer"}, the generated `AsyncRelayCommand` and `RelayCommand` types expose `CanExecute` as a method and `ExecuteAsync` for awaitable commands, both of which test cleanly without any UI involvement.

---

## Testing Property Notifications

A ViewModel that implements `INotifyPropertyChanged` must raise `PropertyChanged` whenever a bound property changes. If it does not, the View silently stops updating and bugs appear only at runtime. Testing property notifications directly is straightforward.

```csharp
[TestMethod]
public void SearchQuery_RaisesPropertyChanged()
{
    var viewModel = new SearchViewModel(new FakeSearchService());
    var raisedProperties = new List<string>();

    viewModel.PropertyChanged += (_, e) =>
        raisedProperties.Add(e.PropertyName ?? string.Empty);

    viewModel.SearchQuery = "test query";

    CollectionAssert.Contains(raisedProperties, nameof(viewModel.SearchQuery));
}
```

Subscribing to `PropertyChanged` before modifying the property and then asserting that the expected property name appeared in the captured events is a reliable pattern. For ViewModels built with `CommunityToolkit.Mvvm`, the source-generated setters raise `PropertyChanged` automatically, but it is still worth verifying that computed or derived properties fire correctly when their dependencies change.

---

## Mocking Services and Navigation

ViewModels depend on services for data access, logging, navigation, and other cross-cutting concerns. For unit tests, those services should be replaced with test doubles that return controlled results. There are two practical approaches: hand-written fakes and mock frameworks.

Hand-written fakes work well for services with a small number of methods and when the test suite needs to observe call counts or configure different responses per test:

```csharp
public class FakeNavigationService : INavigationService
{
    public List<string> NavigatedTo { get; } = new();
    public bool NavigateWasCalled => NavigatedTo.Count > 0;

    public void Navigate(string destination, object? parameter = null)
    {
        NavigatedTo.Add(destination);
    }

    public void GoBack() { }
}
```

Mock frameworks like [Moq](https://github.com/devlooped/moq){:target="_blank" rel="noopener noreferrer"} or [NSubstitute](https://nsubstitute.github.io/){:target="_blank" rel="noopener noreferrer"} are more concise when you need to configure behavior per-test without writing a separate class:

```csharp
[TestMethod]
public async Task DeleteCommand_NavigatesBackAfterDeletion()
{
    var mockNav = new Mock<INavigationService>();
    var mockService = new Mock<IProductService>();
    mockService.Setup(s => s.DeleteAsync(It.IsAny<int>())).ReturnsAsync(true);

    var viewModel = new ProductDetailViewModel(mockService.Object, mockNav.Object);
    viewModel.ProductId = 42;

    await viewModel.DeleteCommand.ExecuteAsync(null);

    mockNav.Verify(n => n.GoBack(), Times.Once);
}
```

Navigation deserves particular attention because navigating in a ViewModel typically means calling a navigation service rather than directly manipulating a `Frame`. That indirection is exactly what makes it testable. A ViewModel that directly references a `Frame` cannot be unit tested without instantiating a real UI.

---

## MSTest with UITestMethod

Some code genuinely requires the UI thread. Custom controls, behaviors that interact with `DispatcherQueue`, or ViewModel logic that updates an `ObservableCollection` bound to a live control all need to run in a context where the UI infrastructure is initialized. MSTest provides a mechanism for this through the WinUI test app template.

When creating a test project from the [MSTest WinUI App template](https://learn.microsoft.com/en-us/windows/apps/winui/winui3/winui-unit-tests){:target="_blank" rel="noopener noreferrer"} in Visual Studio, the project structure includes a WinUI application host alongside your test code. Tests that need to run on the UI thread are marked with `[UITestMethod]` instead of `[TestMethod]`.

```csharp
[TestClass]
public class MyControlTests
{
    [UITestMethod]
    public void MyControl_DisplaysPlaceholderText_WhenEmpty()
    {
        var control = new SearchBox();
        control.PlaceholderText = "Enter search term";

        // Measure and arrange so layout runs
        control.Measure(new Windows.Foundation.Size(300, 48));
        control.Arrange(new Windows.Foundation.Rect(0, 0, 300, 48));

        Assert.AreEqual("Enter search term", control.PlaceholderText);
    }
}
```

The test runner executes `[UITestMethod]` methods on the UI thread, which means controls can be instantiated, layout can run, and properties that require UI infrastructure will behave correctly. Tests marked with `[TestMethod]` continue to run on background threads as normal.

Use `[UITestMethod]` selectively. If a test does not touch UI elements or the UI thread, marking it `[UITestMethod]` adds unnecessary overhead. Reserve it for tests that would fail or hang without proper UI thread context.

---

## UI Automation with WinAppDriver

End-to-end testing validates that the whole application works from the user's perspective. [WinAppDriver](https://github.com/microsoft/WinAppDriver){:target="_blank" rel="noopener noreferrer"} is an automation server built on the WebDriver protocol that launches your packaged application and simulates real user input including clicks, keyboard entry, and gestures.

WinAppDriver tests run against a deployed application. The driver launches it, finds elements by their `AutomationId` or other accessibility properties, interacts with them, and asserts on the resulting UI state. Tests are authored in C# using the [Appium.WebDriver](https://github.com/appium/dotnet-client){:target="_blank" rel="noopener noreferrer"} client:

```csharp
[TestClass]
public class LoginFlowTests
{
    private static WindowsDriver<WindowsElement>? _session;

    [ClassInitialize]
    public static void Setup(TestContext _)
    {
        var options = new AppiumOptions();
        options.AddAdditionalCapability("app", @"C:\path\to\MyApp.exe");
        options.AddAdditionalCapability("deviceName", "WindowsPC");

        _session = new WindowsDriver<WindowsElement>(
            new Uri("http://127.0.0.1:4723"),
            options);
        _session.Manage().Timeouts().ImplicitWait = TimeSpan.FromSeconds(5);
    }

    [TestMethod]
    public void Login_WithValidCredentials_NavigatesToDashboard()
    {
        var usernameField = _session!.FindElementByAccessibilityId("UsernameInput");
        var passwordField = _session.FindElementByAccessibilityId("PasswordInput");
        var loginButton = _session.FindElementByAccessibilityId("LoginButton");

        usernameField.SendKeys("testuser@example.com");
        passwordField.SendKeys("ValidPassword1!");
        loginButton.Click();

        var dashboardTitle = _session.FindElementByAccessibilityId("DashboardTitle");
        Assert.AreEqual("Dashboard", dashboardTitle.Text);
    }

    [ClassCleanup]
    public static void Cleanup()
    {
        _session?.Quit();
        _session = null;
    }
}
```

For elements to be findable by `AutomationId`, XAML controls must have the `AutomationProperties.AutomationId` attribute set:

```xml
<TextBox x:Name="UsernameInput"
         AutomationProperties.AutomationId="UsernameInput"
         PlaceholderText="Email address" />
```

WinAppDriver tests are slower than unit tests because they launch a real process and interact with real UI. Keep the end-to-end suite focused on the flows that carry the most business risk: authentication, critical data entry, and navigation between major sections of the app.

---

## Integration Testing Patterns

Integration tests validate that components work together correctly without simulating full end-to-end UI flows. In WinUI 3, this typically means testing a ViewModel wired to a real service against a test database or an in-memory substitute, while keeping the UI out of the picture.

The DI container your application uses in production can be reconfigured for tests by replacing real services with test doubles that use local data:

```csharp
[TestClass]
public class ProductWorkflowTests
{
    private ServiceProvider? _services;

    [TestInitialize]
    public void Setup()
    {
        var services = new ServiceCollection();

        // Real ViewModel under test
        services.AddTransient<ProductListViewModel>();

        // Real service logic but in-memory database
        services.AddSingleton<IProductRepository, InMemoryProductRepository>();
        services.AddTransient<IProductService, ProductService>();

        _services = services.BuildServiceProvider();
    }

    [TestMethod]
    public async Task AddAndRetrieve_RoundTrip_WorksCorrectly()
    {
        var viewModel = _services!.GetRequiredService<ProductListViewModel>();

        await viewModel.AddProductAsync("Integration Widget", 19.99m);
        await viewModel.LoadProductsAsync();

        Assert.AreEqual(1, viewModel.Products.Count);
        Assert.AreEqual("Integration Widget", viewModel.Products[0].Name);
    }

    [TestCleanup]
    public void Teardown()
    {
        _services?.Dispose();
    }
}
```

This pattern tests the full object graph from ViewModel through service to repository without requiring a database connection, a UI thread, or a running application. The `InMemoryProductRepository` stores data in a `Dictionary` or `List` for the duration of the test and is discarded afterward.

Navigation flows are a common integration testing target. Rather than running the full app, construct a test navigation service that records transitions and assert that the ViewModel navigated to the expected destination with the correct parameters.

---

## Test Project Setup

WinUI 3 test projects require some configuration to work correctly. There are two distinct project types, and choosing the wrong one leads to frustrating failures.

A standard MSTest, NUnit, or xUnit project targeting `net8.0-windows10.0.19041.0` works for ViewModel and service tests that have no UI dependencies. Add your ViewModel project as a reference, install whichever test framework you prefer, and run tests with the normal dotnet test command.

For tests requiring the UI thread via `[UITestMethod]`, use the MSTest WinUI App template. This creates a project with a WinUI application host that bootstraps the runtime before test execution. The template is available in Visual Studio's new project dialog when the Windows App SDK workload is installed.

Key NuGet packages for a standard ViewModel test project:

- `Microsoft.VisualStudio.TestPlatform.MSTest.TestAdapter` and `MSTest.TestFramework` for MSTest
- `Moq` or `NSubstitute` for mocking
- `Microsoft.Extensions.DependencyInjection` for integration test container setup

For WinAppDriver tests, add the `Appium.WebDriver` package and ensure WinAppDriver is installed and running on port 4723 before the test session starts.

---

## Desktop Testing Best Practices

Desktop applications have characteristics that differ from web services, and the testing strategy should account for them.

Prioritize ViewModel coverage. The logic in ViewModels is where most bugs live: incorrect state transitions, missing validation, command guards that fire at the wrong time. A high-coverage ViewModel test suite catches these problems cheaply and quickly.

Set `AutomationProperties.AutomationId` on interactive controls from the start. Retrofitting automation IDs into an existing codebase when you need to add end-to-end tests is tedious. Treating it as a standard practice alongside naming controls makes the app testable as it is built.

Keep end-to-end tests narrow and stable. WinAppDriver tests are sensitive to timing, layout changes, and packaging issues. A small suite covering the five or ten most critical paths is more valuable than a large suite that flakes constantly and gets disabled.

Use the [Windows Application Driver GitHub repository](https://github.com/microsoft/WinAppDriver){:target="_blank" rel="noopener noreferrer"} for sample test patterns and known workarounds. WinAppDriver is mature but has quirks around certain control types, and the issue tracker is a useful reference when elements are not found or interactions behave unexpectedly.

Test state isolation matters more in desktop apps than in stateless web APIs. Desktop applications often hold significant in-process state across operations. Tests should leave the application in a clean state so that subsequent tests do not inherit leftover data. In ViewModel tests, constructing a fresh ViewModel per test method is the simplest guarantee. In end-to-end tests, resetting the backing data store or navigating to a known starting screen before each test serves the same purpose.

Finally, testing async code requires care. ViewModels frequently have async load methods that populate collections. Tests must await those methods and, in cases where the ViewModel dispatches updates back to the UI thread through a `DispatcherQueue`, additional synchronization may be needed. When running outside the UI thread context, consider whether the ViewModel's thread dispatching logic needs to be configurable so that tests can bypass it and assert directly on the underlying collections.
