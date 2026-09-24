---
title: "Threading and the UI Thread in WinUI 3"
layout: guide
category: "WinUI 3"
subcategory: "Data & MVVM"
description: "Which thread may touch WinUI 3 objects and bound view model state, and how work gets back to it: the DispatcherQueue and its priorities, await and Progress<T>, TryEnqueue and the toolkit's EnqueueAsync, UI-thread timers, feeding collections from background work, multiple windows, and diagnosing wrong-thread errors."
tags: [threading, ui-thread, dispatcherqueue, thread-affinity, dispatcherqueuetimer, practical]
---

## One Thread Owns the UI

A WinUI app's UI thread runs a message loop. Each pass takes the next piece of work from a queue and runs it to completion, whether that is an input event, a layout pass, a binding update, or one of your event handlers. Nothing else runs on that thread in the meantime, so a handler that spends two seconds parsing a file freezes the window for two seconds. The window can't repaint, respond to the mouse, or run an animation until the handler returns.

### XAML Objects Belong to Their Thread

Nearly every XAML object, whether a control, a brush, a style, or a template, derives from `DependencyObject` and is bound to the UI thread that created it. `Window` is the notable class that doesn't derive from it, but its content does, and a window belongs to the thread that created it. [Microsoft's documentation](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.dependencyobject){:target="_blank" rel="noopener noreferrer"} states the rule plainly. Only code running on that thread can change or even read a dependency property, and every member except the `DispatcherQueue` property throws when called from another thread. The exception is a `COMException` with the COM error code `0x8001010E` (`RPC_E_WRONG_THREAD`), whose message reads "The application called an interface that was marshalled for a different thread."

The rule reaches past controls into your view models. When a view model raises `PropertyChanged` or `CollectionChanged`, the bound control updates itself inside that event, on whichever thread raised it. A property set from a thread-pool thread therefore makes the control read its new value off the UI thread, and the control throws. Any view model state that the UI binds to is UI-thread state, even though the view model is an ordinary C# class.

That is also why view models shouldn't derive from `DependencyObject`. A plain class with `INotifyPropertyChanged` can at least be created and tested on any thread, while a `DependencyObject` can't be touched anywhere but its UI thread.

### One UI Thread by Default

By default an app has exactly one UI thread, and every window it opens shares it. Microsoft's multiple-windows documentation describes each `Window` as sharing "the same UI processing thread (including the event dispatcher) from which they were created." The containment that decides what code may do is therefore thread first, then windows. A thread owns a queue, and the queue serves every window created on that thread. Hosting WinUI on more than one UI thread is possible, and it changes where a dispatcher comes from (see [Multiple Windows and Multiple UI Threads](#multiple-windows-and-multiple-ui-threads)).

---

## The DispatcherQueue

A [`DispatcherQueue`](https://learn.microsoft.com/en-us/windows/apps/develop/dispatcherqueue){:target="_blank" rel="noopener noreferrer"} (`Microsoft.UI.Dispatching`) is the queue that feeds a thread's message loop. It holds work items in priority order and runs them one at a time on its own thread. A thread has at most one, and has none until the code that owns the thread's message loop creates it. For a WinUI app's UI thread, the XAML framework creates it when the generated `Main` calls `Application.Start`, before your `App` is constructed. Code that needs a queue on a thread of its own creates one with `DispatcherQueueController.CreateOnDedicatedThread()`, which starts a new thread running a queue, or `CreateOnCurrentThread()`, which attaches one to the calling thread and leaves running the message loop to the caller.

Code on any thread can add work to the queue, and that is the only sanctioned way for a background thread to affect the UI. The background thread never touches a control. It posts a delegate, and the UI thread runs the delegate when it reaches it. Work arrives by two routes, both covered below. An `await` in a method that started on the UI thread posts the rest of the method back through the queue, and other code queues a delegate explicitly with `TryEnqueue`.

{% include figure.html id="winui-ui-thread-queue" %}

### Getting a Queue

There are three ways to reach a UI thread's queue:

| Source | Returns |
| --- | --- |
| `element.DispatcherQueue` on any `DependencyObject` | The queue of the thread that owns the element. It is the one member of the element that any thread may read |
| `window.DispatcherQueue` on a `Window` | The queue of the window's thread |
| `DispatcherQueue.GetForCurrentThread()` | The calling thread's queue, or `null` if it has none, which is the case on every thread-pool thread. Useful only when called on the UI thread |

Reading it from an element is the safest choice, because it always names the thread that owns the element you are about to update. Code ported from UWP may still read `DependencyObject.Dispatcher`, which always returns `null` in a Windows App SDK app. `CoreDispatcher.RunAsync` becomes `DispatcherQueue.TryEnqueue`.

`HasThreadAccess` reports whether the calling thread is the queue's thread, which lets a helper run a delegate directly when it is already on the right thread and queue it otherwise.

### Priorities

Each work item carries a `DispatcherQueuePriority`, and the queue always runs higher-priority work first:

| Priority | Runs |
| --- | --- |
| `High` | First, alongside the system's own high-priority work |
| `Normal` | Once no `High` work is waiting. The default |
| `Low` | Only when nothing else is waiting. New `High` or `Normal` work goes ahead of it |

`Normal` fits nearly every update. `High` work runs ahead of everything queued at `Normal`, so overusing it delays the rest of the app's updates. `Low` suits work the user isn't waiting for, like refreshing a status indicator or warming a cache of rendered content, which then yields to anything the user does.

---

## Getting Back to the UI Thread

### await Returns to the UI Thread on Its Own

Most code never calls the queue directly, because `await` does it. When an `await` pauses, it captures the current `SynchronizationContext` and later posts the rest of the method back to it. WinUI's generated `Main` installs a `DispatcherQueueSynchronizationContext` on the UI thread, and posting to that context enqueues onto the UI thread's `DispatcherQueue`. So a method that starts on the UI thread, such as an event handler or a command, resumes on the UI thread after each `await`:

```csharp
private async Task LoadReportAsync(string path)
{
    IsBusy = true;                                            // UI thread

    string json = await File.ReadAllTextAsync(path);          // I/O; the UI thread is free meanwhile
    Report report = await Task.Run(() => Report.Parse(json)); // CPU-heavy parse on the thread pool

    CurrentReport = report;                                   // back on the UI thread
    IsBusy = false;
}
```

`Task.Run` moves the CPU-heavy parse off the UI thread, and the `await` on it brings the method back. That is the everyday shape of responsive WinUI code. Slow work goes to the thread pool as a task, and the method assigns bound state only after it has awaited the result.

Three things break the return trip:

- **`ConfigureAwait(false)` in UI code.** It tells that `await` not to capture the context, so the rest of that method runs on the thread pool. Code after it can't touch bound state.
- **Code inside `Task.Run`.** Everything inside the lambda runs on the thread pool, so setting a bound property there throws. Return a result from the lambda and assign it after the `await`, as the sample does.
- **A custom `Main`.** A project that defines `DISABLE_XAML_GENERATED_MAIN` and writes its own entry point has to install the synchronization context itself, or call the generated `XamlGeneratedProgram.XamlGeneratedMain()`. Without the context, every `await` in UI code resumes on the thread pool.

Blocking on a task with `.Result` or `.Wait()` on the UI thread is a separate trap. The UI thread waits for a continuation that can only run on the UI thread, and the app deadlocks.

### Reporting Progress with Progress&lt;T&gt;

`Progress<T>` captures the `SynchronizationContext` that is current when it is constructed and invokes its callback through that context. Create it on the UI thread, pass it as `IProgress<T>` into work running anywhere, and every `Report` call runs the callback on the UI thread:

```csharp
var progress = new Progress<double>(fraction => DownloadPercent = fraction * 100); // created on the UI thread

await _downloader.DownloadAsync(url, destination, progress, token);
```

The downloader knows nothing about WinUI or threads. It calls `progress.Report(bytesRead / (double)totalBytes)` from whatever thread its loop happens to run on. A `Progress<T>` created on a thread with no context, such as a thread-pool thread, runs its callback on the thread pool instead, and a callback that sets bound state throws.

### Code That Starts Elsewhere Uses TryEnqueue

Some code never started on the UI thread, so there is no captured context to return to. Common sources include:

- a `System.Timers.Timer` or `System.Threading.Timer` callback
- an event raised by a service, SDK, or device on its own thread, such as a sensor reading or a network-status change
- a message handler registered with a real-time connection library
- work started with `Task.Run` that needs to update the UI partway through

These dispatch explicitly with `TryEnqueue`:

```csharp
public sealed partial class TelemetryPage : Page
{
    public TelemetryPage()
    {
        InitializeComponent();
        _monitor.ReadingReceived += OnReadingReceived;   // raised on a thread-pool thread
    }

    private void OnReadingReceived(object? sender, Reading reading)
    {
        bool queued = DispatcherQueue.TryEnqueue(() =>
        {
            ViewModel.LatestTemperature = reading.Temperature;   // runs on the UI thread
        });

        if (!queued)
        {
            _monitor.ReadingReceived -= OnReadingReceived;       // the queue is shutting down
        }
    }
}
```

`TryEnqueue` returns as soon as the delegate is queued, before it runs. Its `bool` result is `false` once the queue has stopped accepting work during shutdown (see [Shutdown](#shutdown)), and the delegate is then dropped rather than run. An exception thrown inside the delegate surfaces on the UI thread, where the background caller can't catch it, so a delegate that can fail catches its own exceptions.

The delegate also runs later than the code that queued it. Anything it reads from shared state may have changed by then, which is why the sample captures `reading` as a parameter instead of reading a field that the next event would overwrite.

### Awaiting the Result with EnqueueAsync

`TryEnqueue` returns only a `bool`, so the caller can't wait for the delegate to finish, get a value back, or see its exceptions. The Windows Community Toolkit's [`DispatcherQueueExtensions`](https://learn.microsoft.com/en-us/dotnet/communitytoolkit/windows/extensions/dispatcherqueueextensions){:target="_blank" rel="noopener noreferrer"}, in the `CommunityToolkit.WinUI.Extensions` package and the `CommunityToolkit.WinUI` namespace, adds `EnqueueAsync`, which returns a task:

```csharp
using CommunityToolkit.WinUI;

// On a background thread: ask the UI thread for the current selection, then continue here.
IReadOnlyList<Item> selected = await dispatcherQueue.EnqueueAsync(
    () => ViewModel.SelectedItems.ToList());
```

Overloads cover an `Action`, a `Func<T>`, and asynchronous delegates, each with an optional priority. When the caller is already on the queue's thread, `EnqueueAsync` runs the delegate immediately instead of queuing it. An exception thrown by the delegate faults the returned task, and a queue that refuses the work faults it with an `InvalidOperationException`, so both reach the caller's `await`.

Awaiting the UI thread from background work ties the two together. The background work now waits behind every input event and layout pass queued ahead of it. Blocking on the returned task instead of awaiting it, from code the UI thread is itself waiting for, deadlocks. Reach for `EnqueueAsync` when the background code needs a value only the UI thread holds, and use `TryEnqueue` when it only needs to hand a result over.

### Choosing a Route Back

| Mechanism | Use when | Caller can await it | Exceptions reach the caller |
| --- | --- | --- | --- |
| `await` | The method started on the UI thread | Yes | Yes |
| `Progress<T>` | Long-running work reports intermediate values | No | No |
| `TryEnqueue` | Code started elsewhere hands a result to the UI | No | No |
| `EnqueueAsync` | Code started elsewhere needs a value or completion from the UI thread | Yes | Yes |

---

## Where View Models Get Their Queue

A view model that has to dispatch needs a queue from somewhere. The common pattern is to call `DispatcherQueue.GetForCurrentThread()` in the constructor, which works only when the constructor runs on the UI thread. A view model built on a thread-pool thread, for example by a DI container resolving it from background work, gets `null`, and the failure shows up later as a `NullReferenceException` at the first dispatch. Checking the result in the constructor moves the failure to where the mistake is:

```csharp
_dispatcherQueue = DispatcherQueue.GetForCurrentThread()
    ?? throw new InvalidOperationException("Create this view model on the UI thread.");
```

Taking the queue as a constructor parameter works better. It makes the dependency visible, and the code that creates the view model, which knows which window it is for, can pass that window's queue.

A `DispatcherQueue` is hard to supply in a unit test, because a test thread has no queue and nothing runs one. Two designs keep view models testable:

- **Keep dispatching at the edge.** A view model whose state changes only in commands and `await` continuations never needs a queue, because that code already runs on the UI thread. Dispatch where a background event enters the app instead, in the page, the service adapter, or the code that subscribes to it, as the telemetry sample does.
- **Hide it behind a small interface.** When a view model has to receive background events itself, give it an interface with one method, like `void Run(Action action)`. The app implements it with `TryEnqueue`, and a test implements it by calling the action inline.

---

## Feeding Collections from Background Work

`ObservableCollection<T>` isn't thread-safe, and its `CollectionChanged` event has the same rule as `PropertyChanged`. The list control bound to it updates inside the event, so an `Add` from a background thread throws. WPF offers `BindingOperations.EnableCollectionSynchronization` to let bindings coordinate with background writers. WinUI has no equivalent, since its `BindingOperations` class has only `SetBinding`, so every change to a bound collection has to happen on the UI thread.

When items arrive faster than a person can read them, dispatching one delegate per item floods the queue, and the window spends its time on list updates instead of input. A common shape is to let background code append to a thread-safe buffer and let a UI-thread timer move whatever has accumulated into the bound collection:

```csharp
private readonly ConcurrentQueue<LogEntry> _pending = new();
private readonly DispatcherQueueTimer _flushTimer;

public LogPage()
{
    InitializeComponent();

    _flushTimer = DispatcherQueue.CreateTimer();
    _flushTimer.Interval = TimeSpan.FromMilliseconds(100);
    _flushTimer.Tick += (_, _) =>
    {
        while (_pending.TryDequeue(out LogEntry? entry))
        {
            ViewModel.Entries.Add(entry);   // UI thread
        }
    };
    _flushTimer.Start();

    _logSource.EntryWritten += (_, entry) => _pending.Enqueue(entry);   // any thread
}
```

The producer never touches the collection, and the UI thread updates the list at most ten times a second however fast entries arrive. Each `Add` still raises its own `CollectionChanged`, so a burst of thousands of items becomes thousands of list updates inside one tick. Reducing that cost is a collection-design question rather than a threading one.

---

## Timers and Which Thread They Tick On

.NET and WinUI offer several timers, and the choice decides whether the callback can touch the UI:

| Timer | Callback runs on | Touching bound state |
| --- | --- | --- |
| `DispatcherQueueTimer`, from `DispatcherQueue.CreateTimer()` | The queue's thread | Safe when created from a UI thread's queue |
| `DispatcherTimer` (`Microsoft.UI.Xaml`) | The UI thread | Safe |
| `PeriodicTimer`, awaited in a loop started on the UI thread | The UI thread, because each `await` resumes there | Safe |
| `System.Timers.Timer` | A thread-pool thread | Needs `TryEnqueue` |
| `System.Threading.Timer` | A thread-pool thread | Needs `TryEnqueue` |

`DispatcherQueueTimer` repeats by default (`IsRepeating` is `true`) and exposes `Interval`, `Start`, `Stop`, and a `Tick` event. It guarantees only that a tick doesn't fire before the interval. Ticks run at a priority below even idle work, so a busy UI thread delays them. It also doesn't keep the queue's message loop running on its own. When the loop ends, pending ticks stop.

`DispatcherTimer` has the same shape as the WPF and UWP timers of that name, which makes it the familiar choice for ported code, though it is a separate WinUI type. It fires `Tick` at its `Interval` until `Stop` is called, and it suits periodic UI updates. `DispatcherQueueTimer` is the lower-level timer on the queue itself, and the one the toolkit's helpers extend.

For search-as-you-type, the toolkit's [`Debounce`](https://learn.microsoft.com/en-us/dotnet/communitytoolkit/windows/extensions/dispatcherqueuetimerextensions){:target="_blank" rel="noopener noreferrer"} extension on `DispatcherQueueTimer` runs an action only after input has paused for an interval, with each new call restarting the wait. Use one timer per debounced action, because `Debounce` takes over the timer's settings.

---

## Multiple Windows and Multiple UI Threads

With the default single UI thread, every window's `DispatcherQueue` is the same queue, and a dispatcher captured from any window can update any window.

WinUI can also run on more than one UI thread. Windows App SDK 2.5.1, for example, fixed a fatal exit during XAML shutdown in apps hosting WinUI 3 on more than one UI thread. Each additional UI thread needs its own queue and message loop, and each window's objects belong to the thread that created that window, and a queue captured from one window can't update another window's controls. Code that serves several windows then has to take the queue from the element it is about to update, never from a single app-wide field.

### No Protection Against Reentrancy

UWP ran its UI thread as an Application STA, a variant of COM's single-threaded apartment that blocked reentrancy. The Windows App SDK uses a standard STA, [which doesn't provide the same safeguards](https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/migrate-to-windows-app-sdk/guides/threading){:target="_blank" rel="noopener noreferrer"}. While your code is waiting inside a call that keeps pumping messages, such as a nested message loop, the UI thread can run other queued work, including another event handler that changes the state your code was in the middle of using. Code ported from UWP that assumed a handler couldn't be interrupted this way may now misbehave, and Microsoft names reentrancy into XAML controls as one case to watch for.

---

## Shutdown

When the app exits, the UI thread leaves its message loop and shuts its queue down in a fixed order:

1. `ShutdownStarting` is raised, for app code, and the queue drains the work already in it.
2. `FrameworkShutdownStarting` is raised, for frameworks, and the queue drains again.
3. The queue stops accepting work, and from here `TryEnqueue` returns `false`.
4. `FrameworkShutdownCompleted` is raised, then `ShutdownCompleted`.

The `TryEnqueue` API reference puts it more broadly, saying the queue refuses new work once shutdown has been requested, so code shouldn't count on a late enqueue getting in.

Background work that outlives the window runs into this. A download still reporting progress, or a service still raising events, tries to dispatch to a queue that no longer accepts work. Give that work a `CancellationToken` and cancel it when the window closes, and treat a `false` from `TryEnqueue` as the signal to stop dispatching, as the telemetry sample does by unsubscribing.

---

## Diagnosing Wrong-Thread Errors

A wrong-thread bug usually appears as `RPC_E_WRONG_THREAD` from a property setter or a collection change, often intermittently, because it depends on which thread a callback happened to run on. To find where execution left the UI thread:

- **Assert the thread where state changes.** `Debug.Assert(dispatcherQueue.HasThreadAccess)`, on the page's queue or the one a view model was given, at the top of a handler or in a setter turns an intermittent crash into a failure at the line that caused it.
- **Walk back from the failing line to the last thread switch.** It is nearly always a `ConfigureAwait(false)`, code inside `Task.Run`, a `Progress<T>` created off the UI thread, or a callback that a library invoked on its own thread.
- **Read stowed exceptions from crash dumps.** XAML often records an error and decides later that it is fatal, so the process ends with exception code `0xC000027B` after the stack that caused it has unwound. The direct call stack then points at the wrong place. Microsoft's threading migration guidance recommends opening the dump in WinDbg and using the community `!pde.dse` extension command to list the stowed exceptions, the first of which is usually the one that matters.
