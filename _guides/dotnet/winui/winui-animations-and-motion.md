---
title: "Animations and Motion"
layout: guide
category: "WinUI 3"
subcategory: "Styling & Resources"
description: "Choosing and building motion in WinUI 3: the theme and page transitions controls already provide, implicit property transitions, storyboards and which of them run off the UI thread, visual state transitions, connected animations, composition animations, the Community Toolkit's AnimationBuilder, Lottie and AnimatedIcon, and Fluent timing and easing."
tags: [storyboards, theme-transitions, connected-animations, composition-animations, easing, lottie, practical]
---

## Choosing a Mechanism

WinUI has several ways to animate, each suited to a different job. Earlier rows in this table cost less code and give up less control:

| Need | Reach for |
| --- | --- |
| Standard motion for content appearing, moving, or navigating | Theme transitions and page transitions |
| One property that should change smoothly whenever it's set | An implicit property transition, such as `OpacityTransition` |
| A specific sequence of property changes started from code or a visual state | A storyboard |
| One element traveling from one page to the next | A connected animation |
| Physics, input-driven, or scroll-driven motion that must never stall | A composition animation |
| Show and hide animations declared in XAML, or short fluent code | The Community Toolkit's animations |
| Motion drawn by a designer | Lottie, through `AnimatedVisualPlayer` or `AnimatedIcon` |

---

## Start with the Motion WinUI Already Has

Motion tells the user what changed: an item sliding into a list shows where it went, and a page that slides in from the right reads as a step forward. WinUI's controls already do most of this. `ListView` and `GridView` animate items being added, removed, and reordered, flyouts and menus animate open and closed, and buttons react to the pointer. An app that replaces those templates loses the built-in motion along with them.

The next layer is the animation library, which applies Windows' standard motion to app elements without any timing code. There are two kinds, and they differ in what triggers them.

**Theme transitions** run automatically when something happens to an element, such as its first appearance or a change of position. They're added to an element's `Transitions` collection, or to a container's `ChildrenTransitions` or `ItemContainerTransitions` so every child takes part, one after another:

```xml
<ItemsControl ItemsSource="{x:Bind ViewModel.Cards}">
    <ItemsControl.ItemContainerTransitions>
        <TransitionCollection>
            <EntranceThemeTransition />
            <RepositionThemeTransition />
        </TransitionCollection>
    </ItemsControl.ItemContainerTransitions>
</ItemsControl>
```

| Transition | Runs when |
| --- | --- |
| `EntranceThemeTransition` | An element or a container's children first appear |
| `RepositionThemeTransition` | An element moves to a new position, such as when a sibling is removed |
| `AddDeleteThemeTransition` | Items are added to or removed from a container |
| `ReorderThemeTransition` | Items change order, typically by drag and drop |
| `ContentThemeTransition` | An element's content changes |
| `PaneThemeTransition`, `EdgeUIThemeTransition` | A large pane or a small bar slides in from an edge |
| `PopupThemeTransition` | A popup appears |

**Theme animations**, such as `FadeInThemeAnimation`, `FadeOutThemeAnimation`, `PopInThemeAnimation`, and `DrillInThemeAnimation`, have no trigger of their own. They go inside a storyboard, described below, and run when it starts or when a visual state uses it.

**Page transitions** come from the `Frame`. `Frame.Navigate` takes a `NavigationTransitionInfo` that picks the motion for that navigation:

```csharp
// A forward step into detail
ContentFrame.Navigate(typeof(OrderDetailPage), orderId, new DrillInNavigationTransitionInfo());

// A move between peer sections, such as tabs
ContentFrame.Navigate(typeof(ReportsPage), null,
    new SlideNavigationTransitionInfo { Effect = SlideNavigationTransitionEffect.FromRight });
```

`EntranceNavigationTransitionInfo` gives the default page entrance, and `SuppressNavigationTransitionInfo` turns the transition off for one navigation.

---

## Implicit Transitions on a Property

Sometimes a property just needs to change smoothly instead of jumping, with nothing to trigger by hand. Several `UIElement` properties take a transition object that animates every change to them:

```xml
<Border x:Name="DetailsPanel" Opacity="{x:Bind ViewModel.DetailsOpacity, Mode=OneWay}">
    <Border.OpacityTransition>
        <ScalarTransition Duration="0:0:0.25" />
    </Border.OpacityTransition>
</Border>
```

`OpacityTransition` and `RotationTransition` take a `ScalarTransition`, and `TranslationTransition` and `ScaleTransition` take a `Vector3Transition`. `Panel`, `Border`, and `ContentPresenter` have a `BackgroundTransition` that takes a `BrushTransition`, which only animates between solid color brushes. Setting the property from code or through a binding then animates instead of snapping, so a view model can change a value without knowing it's animated.

---

## Storyboarded Animations

A `Storyboard` animates dependency properties over time, and it's what an app writes when the library doesn't have the motion it needs. Each animation inside names a target element with `Storyboard.TargetName` and a property with `Storyboard.TargetProperty`. `DoubleAnimation` animates numbers, `ColorAnimation` colors, and `PointAnimation` points:

```xml
<Page.Resources>
    <Storyboard x:Name="ShowPanelStoryboard">
        <DoubleAnimation Storyboard.TargetName="Panel"
                         Storyboard.TargetProperty="Opacity"
                         From="0" To="1" Duration="0:0:0.25" />
        <DoubleAnimation Storyboard.TargetName="Panel"
                         Storyboard.TargetProperty="(UIElement.RenderTransform).(TranslateTransform.Y)"
                         From="24" To="0" Duration="0:0:0.25" />
    </Storyboard>
</Page.Resources>
```

```csharp
ShowPanelStoryboard.Begin();
```

A storyboard declared with `x:Name` in the page's resources is a field in code-behind, so `Begin()` starts it with no arguments, and `Stop`, `Pause`, and `Resume` control it afterward. The `Completed` event fires when it finishes. Starting one in the page's `Loaded` handler, rather than earlier, keeps it from being cut off while the rest of the page loads. A property path such as `(UIElement.RenderTransform).(TranslateTransform.Y)` steps into a sub-property, and it only works if the element already has a `TranslateTransform` as its `RenderTransform`.

Key-frame animations such as `DoubleAnimationUsingKeyFrames` pass through several values in turn. Their key frames interpolate linearly (`LinearDoubleKeyFrame`), jump (`DiscreteDoubleKeyFrame`), follow a Bezier curve (`SplineDoubleKeyFrame`), or use an easing function (`EasingDoubleKeyFrame`). `ObjectAnimationUsingKeyFrames` with `DiscreteObjectKeyFrame` is the only way to animate a value that isn't a number, color, or point, such as `Visibility` or a brush resource, and control templates use it for exactly that.

### Dependent and Independent Animations

Where a storyboard runs depends on what it animates. Besides the UI thread, every WinUI app has a composition thread that prepares what reaches the screen, and animations it can run by itself keep going while the UI thread is busy. An animation of `Opacity`, of a sub-property of `RenderTransform`, `Projection`, or `Clip`, of `Canvas.Left` or `Canvas.Top`, or of a `SolidColorBrush`'s `Color` is independent in this sense, and the composition thread runs it. Almost anything else, such as `Width`, `Height`, or `Margin`, is dependent, because every frame changes layout on the UI thread.

A dependent animation doesn't run at all by default, and nothing reports it except a warning in the debug output. It runs only when the animation sets `EnableDependentAnimation="True"`. The default is deliberate, to make the UI-thread cost a conscious choice. Moving an element with `TranslateTransform` instead of `Margin`, or growing it with `ScaleTransform` instead of `Width`, gives the same look as an independent animation.

---

## Visual State Transitions

Controls change appearance through visual states, and a change of state is instant by default. A `VisualTransition` in the state group animates it, generating an animation from the old and new values. It only works for properties the states animate with a storyboard, and only for number, color, and point values. A state that uses `VisualState.Setters` still snaps, so states meant to transition smoothly hold a zero-length animation instead of a setter:

```xml
<VisualStateGroup x:Name="CommonStates">
    <VisualStateGroup.Transitions>
        <VisualTransition From="PointerOver" To="Normal" GeneratedDuration="0:0:0.2" />
        <VisualTransition To="Pressed" GeneratedDuration="0:0:0.05" />
    </VisualStateGroup.Transitions>
    <VisualState x:Name="Normal" />
    <VisualState x:Name="PointerOver">
        <Storyboard>
            <DoubleAnimation Storyboard.TargetName="RootBorder" Storyboard.TargetProperty="Opacity"
                             To="0.9" Duration="0" />
        </Storyboard>
    </VisualState>
    <VisualState x:Name="Pressed">
        <Storyboard>
            <DoubleAnimation Storyboard.TargetName="RootBorder" Storyboard.TargetProperty="Opacity"
                             To="0.8" Duration="0" />
        </Storyboard>
    </VisualState>
</VisualStateGroup>
```

For a state that uses setters, an `OpacityTransition` on the element gives the same smoothing. A transition with only `To` applies from any state, and `GeneratedEasingFunction` sets its curve. `VisualStateManager.GoToState(control, "Pressed", useTransitions: true)` plays the matching transition, and `false` jumps straight to the state.

---

## Connected Animations

A connected animation makes one element appear to travel from one page to the next during navigation, such as a thumbnail growing into the detail page's hero image. `ConnectedAnimationService` holds the animation between the two pages under a key:

```csharp
// Source page, just before navigating
ConnectedAnimationService.GetForCurrentView().PrepareToAnimate("productImage", ThumbnailImage);
Frame.Navigate(typeof(ProductDetailPage), product.Id, new SuppressNavigationTransitionInfo());
```

```csharp
// Destination page
protected override void OnNavigatedTo(NavigationEventArgs e)
{
    base.OnNavigatedTo(e);
    ConnectedAnimationService.GetForCurrentView()
        .GetAnimation("productImage")
        ?.TryStart(HeroImage);
}
```

`GetAnimation` returns `null` when nothing was prepared under that key, such as when the page was reached another way, hence the `?.`. The page transition is suppressed so the traveling element isn't competing with a whole-page slide.

Timing is what makes connected animations fail. Microsoft advises starting the animation within about 250 milliseconds of preparing it, and one not started within three seconds is discarded, so `TryStart` fails. The destination page can't wait for a network call before starting it, and the hero image should start its animation with whatever placeholder it has.

When one end is an item in a `ListView` or `GridView`, the list has its own methods. `PrepareConnectedAnimation` takes the item and the name of the element in its template, and `TryStartConnectedAnimationAsync` starts an animation that lands on that item, waiting until its container exists. The list doesn't scroll by itself, so the page going back calls `ScrollIntoView` for the item first.

An animation's `Configuration` chooses the style of motion. `GravityConnectedAnimationConfiguration`, the default, suits a forward navigation, and `DirectConnectedAnimationConfiguration` suits going back.

---

## Composition Animations

XAML draws through the composition layer, `Microsoft.UI.Composition`, and animating it directly gives motion that runs entirely on the composition thread, with physics such as springs and values computed every frame from other values.

The cost is that composition animations are code only, name their target properties as strings, and can't be declared in XAML, so they're worth it for motion the other mechanisms can't produce smoothly.

The simplest route uses the composition-backed properties on `UIElement`: `Translation`, `Scale`, `Rotation`, `RotationAxis`, `CenterPoint`, `TransformMatrix`, and `Opacity`. They move an element without changing layout, and `UIElement.StartAnimation` runs a composition animation on them:

```csharp
Compositor compositor = CompositionTarget.GetCompositorForCurrentThread();

var spring = compositor.CreateSpringVector3Animation();
spring.Target = "Scale";
spring.FinalValue = new Vector3(1.1f, 1.1f, 1f);
spring.DampingRatio = 0.4f;
spring.Period = TimeSpan.FromMilliseconds(50);

CardBorder.CenterPoint = new Vector3((float)CardBorder.ActualWidth / 2, (float)CardBorder.ActualHeight / 2, 0);
CardBorder.StartAnimation(spring);
```

A spring animation has no duration. It moves toward `FinalValue` like a spring, and a lower `DampingRatio` makes it overshoot and bounce more before it settles. `CenterPoint` makes the scale grow from the middle rather than the top-left corner.

Apart from `Opacity`, these properties can't be mixed with the older `RenderTransform`, `RenderTransformOrigin`, `Projection`, and `Transform3D` on the same element, and setting one kind after the other fails with an error. Each XAML element is drawn by a composition `Visual`, and an app can also take that object over through `ElementCompositionPreview.GetElementVisual` to animate it directly. An element handled that way can't use these properties either.

An expression animation recomputes a value every frame from other values, such as a scroll position. For the common case of a background that scrolls more slowly than the content in front of it, WinUI's `ParallaxView` control does it without any code. A hand-built version reads the scroll position on the composition thread and drives the background's `Translation`, here at 30% of the content's speed:

```csharp
var scrollProperties = ElementCompositionPreview.GetScrollViewerManipulationPropertySet(ContentScroller);
Compositor compositor = CompositionTarget.GetCompositorForCurrentThread();

var parallax = compositor.CreateExpressionAnimation("Vector3(0, scroll.Translation.Y * 0.3, 0)");
parallax.SetReferenceParameter("scroll", scrollProperties);
parallax.Target = "Translation";
BackgroundImage.StartAnimation(parallax);
```

The UI thread never sees a scroll event, so the effect stays locked to the finger or wheel even while the app is busy.

---

## The Community Toolkit's Animations

Composition animations take several objects and string property names for a simple effect. The `CommunityToolkit.WinUI.Animations` package wraps them in a fluent `AnimationBuilder`:

```csharp
using CommunityToolkit.WinUI.Animations;

await AnimationBuilder.Create()
    .Opacity(to: 1, from: 0, duration: TimeSpan.FromMilliseconds(250))
    .Translation(Axis.Y, to: 0, from: 24, duration: TimeSpan.FromMilliseconds(250))
    .StartAsync(DetailsPanel);
```

`Opacity` and `Translation` animate on the composition layer by default, and a `layer: FrameworkLayer.Xaml` argument switches them to a XAML storyboard. The helpers are a package dependency, which is the main cost. `StartAsync` finishes when the animation does, so code that should run afterward can await it, and `Start` doesn't wait.

The toolkit's implicit animations are declared in XAML through attached properties. `Implicit.ShowAnimations` plays when an element becomes visible, `Implicit.HideAnimations` when it's hidden, and `Implicit.Animations` when composition properties such as its offset change, which animates an element moving to a new place in the layout:

```xml
<Border xmlns:animations="using:CommunityToolkit.WinUI.Animations"
        Visibility="{x:Bind ViewModel.IsDetailsVisible, Mode=OneWay}">
    <animations:Implicit.ShowAnimations>
        <animations:OpacityAnimation From="0" To="1" Duration="0:0:0.25" />
        <animations:TranslationAnimation From="0,24,0" To="0,0,0" Duration="0:0:0.25" />
    </animations:Implicit.ShowAnimations>
    <animations:Implicit.HideAnimations>
        <animations:OpacityAnimation To="0" Duration="0:0:0.15" />
    </animations:Implicit.HideAnimations>
</Border>
```

Setting `Visibility` to `Collapsed` removes an element at once, so an exit animation in plain XAML means a storyboard that fades the element and sets `Visibility` with a discrete key frame at the end, started from code. With the toolkit's hide animation, the view model only flips a Boolean and the element still animates out.

---

## Lottie and AnimatedIcon

Designed animations such as an illustrated empty state or a loading character come from After Effects, exported as Lottie JSON. `AnimatedVisualPlayer` is the WinUI control that plays them, and the `CommunityToolkit.WinUI.Lottie` package supplies `LottieVisualSource`, which reads the JSON:

```xml
<AnimatedVisualPlayer xmlns:lottie="using:CommunityToolkit.WinUI.Lottie" AutoPlay="True">
    <lottie:LottieVisualSource UriSource="ms-appx:///Assets/Animations/empty-inbox.json" />
</AnimatedVisualPlayer>
```

The animation renders as composition vectors, so it scales without blurring. Reading JSON at run time costs startup time. LottieGen, a command-line tool run ahead of time with `-WinUIVersion 3.0` for WinUI 3, converts the file into a C# class instead, and the player takes an instance of that class directly as its `Source`.

`AnimatedIcon` is an icon that animates between states, like the settings gear turning in `NavigationView`. The animation file marks each segment with a named marker, such as `NormalToPointerOver`, and the icon plays the segment that matches its current state. Some controls, including `NavigationViewItem` and `AutoSuggestBox`, set that state for it. Elsewhere, such as in a `Button`, the app calls `AnimatedIcon.SetState` from its own pointer handlers. WinUI includes ready-made sources in the `Microsoft.UI.Xaml.Controls.AnimatedVisuals` namespace, and custom ones come from LottieGen output with the markers in place. `FallbackIconSource` supplies a static icon for when animation can't play.

The choice between the two follows how the animation is driven. `AnimatedIcon` is for an icon that reacts to state changes, and `AnimatedVisualPlayer` is for an animation that loops, plays once, or is paused and resumed by the app.

---

## Timing and Easing

Fluent motion is fast. WinUI's own controls use three standard durations, available as theme resources for custom animations: `ControlFasterAnimationDuration` (83 ms), `ControlFastAnimationDuration` (167 ms), and `ControlNormalAnimationDuration` (250 ms).

Easing controls speed over the course of an animation, and Fluent uses two curves. Elements entering the scene use "fast out, slow in", `cubic-bezier(0, 0, 0, 1)`, so they arrive quickly and decelerate hard into place. Elements leaving use "slow out, fast in", `cubic-bezier(1, 0, 1, 1)`, so they start slowly and accelerate out of the way.

{% include figure.html id="winui-fluent-easing" %}

XAML has no class that takes a cubic-bezier directly. A storyboard gets one through a spline key frame, whose `KeySpline` holds the curve's two control points:

```xml
<DoubleAnimationUsingKeyFrames Storyboard.TargetName="Panel" Storyboard.TargetProperty="Opacity">
    <SplineDoubleKeyFrame KeyTime="0:0:0.25" Value="1" KeySpline="0,0 0,1" />
</DoubleAnimationUsingKeyFrames>
```

Composition animations take a curve from `Compositor.CreateCubicBezierEasingFunction`. XAML also has named easing functions, `CubicEase`, `QuadraticEase`, `ExponentialEase`, `SineEase`, `CircleEase`, `BackEase`, `BounceEase`, and `ElasticEase` among them, each with an `EasingMode` of `EaseIn`, `EaseOut`, or `EaseInOut`. `EaseOut` is the one closest to the Fluent entrance curve. Bounces and elastic overshoot rarely fit a work app, where they read as playful. Custom easing classes aren't supported.

Some users turn off animation effects in Windows settings, and `UISettings.AnimationsEnabled` reports that choice. `AnimatedIcon` handles it by showing the final frame of each state change. For the app's own storyboards, composition animations, and toolkit animations, the app checks the setting itself and applies the final value directly when animations are off, at least for motion that is decoration rather than information.
