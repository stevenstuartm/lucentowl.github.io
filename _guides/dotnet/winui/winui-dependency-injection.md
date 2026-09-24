---
title: "Dependency Injection in WinUI 3"
layout: guide
category: "WinUI 3"
subcategory: "Data & MVVM"
description: "Wiring Microsoft.Extensions.DependencyInjection into a WinUI 3 app when the framework constructs pages itself: the composition root in App, getting view models into pages, a navigation service view models can call, a service scope per window, and adding the generic host for logging, configuration, and hosted services."
tags: [dependency-injection, composition-root, generic-host, navigation-service, service-scopes, practical]
---

## WinUI Constructs Your Pages

Constructor injection works by having the container build each object and pass in what its constructor asks for. That works for a WinUI app's services and view models, which the app creates. It stops at the objects WinUI creates itself:

| Object | Created by | Can take constructor parameters |
| --- | --- | --- |
| `App` | The generated `Main`, through `Application.Start` | No |
| `Page` | `Frame.Navigate(typeof(SomePage))`, through the page's parameterless constructor | No |
| `Window` | Your code, usually in `App.OnLaunched` | Yes, but only if your code resolves it from the container |
| View models and services | The container | Yes |

A page can't declare `public ProductsPage(ProductsViewModel viewModel)`, because the `Frame` would have nothing to pass. Every pattern in this guide follows from where that boundary sits. The container owns everything behind the view models, and something at the page boundary has to reach into the container on the page's behalf.

The container itself is the standard `Microsoft.Extensions.DependencyInjection` one, and its lifetimes, scopes, disposal rules, and validation behave in a WinUI app exactly as they do in any other .NET process. What changes is that there is no HTTP request to give scoped services a natural boundary, so the app decides where scopes begin and end.

---

## The Composition Root in App

The composition root is the one place where an app registers its services and builds the container. In a WinUI app that is `App`, which exists before any window and lives as long as the process. Build the container before `InitializeComponent`, so that anything declared in `App.xaml` that resolves services finds the container already there:

```csharp
public partial class App : Application
{
    private Window? _mainWindow;

    public App()
    {
        Services = ConfigureServices();
        InitializeComponent();
    }

    public static new App Current => (App)Application.Current;

    public IServiceProvider Services { get; }

    private static IServiceProvider ConfigureServices()
    {
        var services = new ServiceCollection();

        services.AddSingleton<IProductService, ProductService>();
        services.AddSingleton<INavigationService, NavigationService>();

        services.AddTransient<ShellViewModel>();
        services.AddTransient<ProductsViewModel>();
        services.AddTransient<ProductDetailViewModel>();

        return services.BuildServiceProvider(new ServiceProviderOptions
        {
            ValidateScopes = true,
            ValidateOnBuild = true
        });
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        _mainWindow = new MainWindow();
        _mainWindow.Activate();
    }
}
```

Turning on both validation options makes a registration mistake fail at startup instead of on the first navigation to the page that needed it. Services that wrap the rest of the app, like data access and navigation, are singletons. View models are transient, so each page gets its own.

`App.Current.Services` is the one static route into the container, and pages are the only code that should use it. The MVVM Toolkit offers the same thing ready-made as [`Ioc.Default`](https://learn.microsoft.com/en-us/dotnet/communitytoolkit/mvvm/ioc){:target="_blank" rel="noopener noreferrer"}, a shared `IServiceProvider` you configure once with `Ioc.Default.ConfigureServices(provider)` and resolve from with `Ioc.Default.GetRequiredService<T>()`. It changes where the static lives, not the trade-off.

---

## Getting a View Model into a Page

### Resolve It in the Page's Constructor

The page is the edge where the container has to be asked directly. It resolves its view model once, in its constructor, and exposes it as a typed property that `{x:Bind}` can use:

```csharp
public sealed partial class ProductsPage : Page
{
    public ProductsViewModel ViewModel { get; }

    public ProductsPage()
    {
        ViewModel = App.Current.Services.GetRequiredService<ProductsViewModel>();
        InitializeComponent();
    }
}
```

```xml
<ListView ItemsSource="{x:Bind ViewModel.Products, Mode=OneWay}" />
```

This is a service-locator call, which hides a dependency inside the class instead of declaring it in the constructor. The cost is contained here, because a page is thin and has nothing else to test. Keep the calls confined to pages. A view model that needs a service takes it as a constructor parameter, so a test can construct it with fakes.

Pages are constructed on the UI thread, so a view model resolved this way is created there too. That matters for any view model that captures the UI thread's dispatcher in its constructor.

### The Page Cache Decides the View Model's Lifetime

A transient registration gives each resolution a new instance, but the page's constructor only runs when the `Frame` creates a new page. So the page's `NavigationCacheMode`, not the registration, decides how long a view model lasts. A page that isn't cached gets a new view model on every visit, and one that is cached brings its view model back with its state intact. When state has to outlive any single page, such as a shopping cart shown on several pages, put it in a singleton service that the view models share.

A transient view model that implements `IDisposable` is tracked by the provider that resolved it until that provider is disposed. Resolved from the root provider, as the constructor above does, it lives until the app exits, so every visit to a page that isn't cached leaks one instance. Keep view models free of `IDisposable`, or resolve them from a scope that ends with the window (see [A Scope per Window](#a-scope-per-window)).

Passing a resolved view model as the navigation parameter doesn't get around the parameterless constructor either, because navigation parameters should be basic types. Pass an identifier and let the target view model load what it identifies.

---

## A Navigation Service View Models Can Call

A view model decides when to navigate, but it shouldn't hold a `Frame`, which is a UI object that ties it to the UI and makes it untestable. A navigation service puts the `Frame` behind an interface. The service is a singleton, but the `Frame` it drives doesn't exist until the shell page has loaded, so the shell hands it over:

```csharp
public interface INavigationService
{
    bool NavigateTo<TViewModel>(object? parameter = null);
    bool GoBack();
}

public sealed class NavigationService : INavigationService
{
    private static readonly Dictionary<Type, Type> PageTypes = new()
    {
        [typeof(ProductsViewModel)] = typeof(ProductsPage),
        [typeof(ProductDetailViewModel)] = typeof(ProductDetailPage),
    };

    private Frame? _frame;

    public void Attach(Frame frame) => _frame = frame;

    public bool NavigateTo<TViewModel>(object? parameter = null) =>
        _frame?.Navigate(PageTypes[typeof(TViewModel)], parameter) ?? false;

    public bool GoBack()
    {
        if (_frame is not { CanGoBack: true }) return false;
        _frame.GoBack();
        return true;
    }
}
```

The map from view model to page is an explicit dictionary rather than a name convention resolved with `Type.GetType("MyApp.Views." + name)`. A renamed page then breaks the build instead of a navigation at runtime. The explicit `typeof` references also keep the lookup visible to the trimmer, which removes unused code when current WinUI project templates publish a release build, while a type looked up by a computed string draws a trimming warning the compiler can't resolve.

The shell page attaches its frame, and view models navigate through the interface:

```csharp
public ShellPage()
{
    InitializeComponent();
    Loaded += (_, _) =>
    {
        var navigation = (NavigationService)App.Current.Services.GetRequiredService<INavigationService>();
        navigation.Attach(ContentFrame);
        navigation.NavigateTo<ProductsViewModel>();
    };
}
```

```csharp
public partial class ProductsViewModel(INavigationService navigation) : ObservableObject
{
    [RelayCommand]
    private void OpenProduct(Product product) =>
        navigation.NavigateTo<ProductDetailViewModel>(product.Id);
}
```

The target page receives the parameter in `OnNavigatedTo` and passes it on:

```csharp
protected override async void OnNavigatedTo(NavigationEventArgs e)
{
    base.OnNavigatedTo(e);
    await ViewModel.LoadAsync((int)e.Parameter);
}
```

`OnNavigatedTo` is an `async void` override, so an exception from `LoadAsync` escapes to the app's unhandled-exception handler. Have `LoadAsync` catch its own failures and turn them into state the page can show. View models that need to know when they are navigated to or away from often get it through a small interface of their own, such as `INavigationAware`, which the page's `OnNavigatedTo` and `OnNavigatedFrom` overrides forward to. That keeps `Frame` types out of the view model.

A singleton navigation service holds one frame, which fits an app with one main window. An app with several windows needs one per window.

---

## A Scope per Window

A single-window app can stop at the singleton navigation service. The pattern here is for apps that open several windows of the same kind, such as one per document.

A scoped service lives as long as the scope that created it. ASP.NET Core creates one per request. A desktop app has no request, but a window is a natural unit. It has its own navigation history, editing session, and view models, and all of them should be disposed when the window closes. Registering those services as scoped and creating one scope per window gives each window its own copies, while singletons stay shared across all of them:

{% include figure.html id="winui-di-window-scopes" %}

```csharp
services.AddScoped<INavigationService, NavigationService>();
services.AddScoped<DocumentSession>();
```

The window is created by app code, so it can create its scope, and pages find that scope through the frame they were navigated in:

```csharp
public static class WindowScopes
{
    private static readonly ConditionalWeakTable<Frame, IServiceProvider> Providers = new();

    public static void Register(Frame frame, IServiceProvider provider) =>
        Providers.AddOrUpdate(frame, provider);

    public static IServiceProvider For(Frame frame) =>
        Providers.TryGetValue(frame, out IServiceProvider? provider)
            ? provider
            : throw new InvalidOperationException("This frame has no window scope.");
}

public sealed partial class DocumentWindow : Window
{
    public DocumentWindow()
    {
        InitializeComponent();

        IServiceScope scope = App.Current.Services.CreateScope();
        Closed += (_, _) => scope.Dispose();   // disposes the window's scoped and transient services
        WindowScopes.Register(ContentFrame, scope.ServiceProvider);

        var navigation = (NavigationService)scope.ServiceProvider.GetRequiredService<INavigationService>();
        navigation.Attach(ContentFrame);
        navigation.NavigateTo<ProductsViewModel>();
    }
}
```

A page in that window resolves its view model from the scope instead of from `App.Current.Services`. The page's `Frame` property is set by the time `OnNavigatedTo` runs, so that is where it looks the scope up:

```csharp
public ProductsViewModel? ViewModel { get; private set; }

protected override async void OnNavigatedTo(NavigationEventArgs e)
{
    base.OnNavigatedTo(e);
    ViewModel ??= WindowScopes.For(Frame).GetRequiredService<ProductsViewModel>();
    Bindings.Update();
    await ViewModel.LoadAsync();
}
```

The `??=` keeps the existing view model when a cached page is navigated to again, and `Bindings.Update()` makes `{x:Bind}` read the view model that was just assigned. Transient view models resolved from the scope are disposed with it, which also removes the root-provider leak described earlier.

`ConditionalWeakTable` holds each frame's provider only as long as the frame itself is alive, so once a closed window's frame is no longer referenced, its entry is cleaned up with it and nothing has to remove it. `Window` has no `DataContext`, so a window that needs its own view model exposes it as a property, the same way a page does, and `{x:Bind}` in the window's XAML roots at the window class.

Scope validation catches the mistake this pattern invites. With `ValidateScopes` on, a page that resolves a scoped service from `App.Current.Services` instead of its window's scope throws, rather than quietly receiving one instance shared by every window.

---

## Adding the Generic Host

The [generic host](https://learn.microsoft.com/en-us/dotnet/core/extensions/generic-host){:target="_blank" rel="noopener noreferrer"} (`Microsoft.Extensions.Hosting`) builds the same container and adds logging through `ILogger<T>`, configuration from `appsettings.json` and environment variables through `IConfiguration`, and hosted services, which are classes the host starts with the app and stops with it, for work like periodic sync. A WinUI app can build it in `App`'s constructor, with no custom entry point:

```csharp
public partial class App : Application
{
    private readonly IHost _host;
    private Window? _mainWindow;

    public App()
    {
        HostApplicationBuilder builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
        {
            ContentRootPath = AppContext.BaseDirectory
        });

        builder.ConfigureContainer(new DefaultServiceProviderFactory(new ServiceProviderOptions
        {
            ValidateScopes = true,
            ValidateOnBuild = true
        }));

        builder.Services.AddSingleton<IProductService, ProductService>();
        builder.Services.AddSingleton<INavigationService, NavigationService>();
        builder.Services.AddTransient<ProductsViewModel>();
        // ...the rest of the view models
        builder.Services.AddHostedService<CatalogSyncService>();

        _host = builder.Build();
        InitializeComponent();
    }

    public static new App Current => (App)Application.Current;

    public IServiceProvider Services => _host.Services;

    protected override async void OnLaunched(LaunchActivatedEventArgs args)
    {
        DispatcherShutdownMode = DispatcherShutdownMode.OnExplicitShutdown;

        _mainWindow = new MainWindow();
        _mainWindow.Closed += OnMainWindowClosed;
        _mainWindow.Activate();

        await _host.StartAsync();
    }

    private async void OnMainWindowClosed(object sender, WindowEventArgs args)
    {
        await _host.StopAsync();
        _host.Dispose();
        Exit();
    }
}
```

Several details differ from a console or server host:

- **Set the content root explicitly.** The builder looks for `appsettings.json` in its content root, which defaults to the process's current directory. That directory depends on how the app was launched, so setting it to `AppContext.BaseDirectory` makes configuration load from the app's own folder. Mark `appsettings.json` to copy to the output directory so it ships with the app.
- **Turn validation on yourself.** The host enables scope validation only when its environment is `Development`, and it defaults to `Production`, so a shipped app loses the checks the plain container had. `ConfigureContainer` restores them.
- **Await `StartAsync` instead of calling `Start`.** `Start` blocks the calling thread until every hosted service has started. On the UI thread, a hosted service whose startup awaits something that needs to resume on the UI thread would deadlock the app, and anything slow would hold the window frozen before it appears.
- **Keep the app alive until the host has stopped.** `Application.Start` sets `DispatcherShutdownMode` to `OnLastWindowClose`, so closing the last window ends the UI thread's event loop and the process with it, without waiting for an `await` in a `Closed` handler. Setting `OnExplicitShutdown` keeps the loop running after the window closes, so the handler can stop the host, dispose it and its singletons, and then call `Exit`.
- **Don't assume which thread a hosted service runs on.** Since .NET 10, a `BackgroundService` runs all of `ExecuteAsync` on a background thread, and a plain `IHostedService.StartAsync` may start on the UI thread and continue elsewhere. A hosted service that updates the UI dispatches to the UI thread first.

A custom `Main`, enabled by defining `DISABLE_XAML_GENERATED_MAIN`, isn't needed for any of this. Apps write one for other reasons, like redirecting activation to an existing instance, and since Windows App SDK 2.3 a custom `Main` can call the generated `XamlGeneratedProgram.XamlGeneratedMain()` instead of repeating its startup code.
