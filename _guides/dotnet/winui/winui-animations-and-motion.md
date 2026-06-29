---
title: "Animations and Motion"
layout: guide
category: "WinUI 3"
subcategory: "Styling & Resources"
description: "Implementing animations in WinUI 3 using storyboards, visual state transitions, connected animations, implicit animations, and the composition visual layer for high-performance motion."
tags: [winui, winui-3, xaml, animations, fluent-design, composition, desktop, practical]
---

## Table of Contents

- [Why Motion Matters](#why-motion-matters)
- [Storyboarded Animations](#storyboarded-animations)
- [Visual States and Transitions](#visual-states-and-transitions)
- [Connected Animations](#connected-animations)
- [Implicit Animations via the Community Toolkit](#implicit-animations-via-the-community-toolkit)
- [Composition Animations and the Visual Layer](#composition-animations-and-the-visual-layer)
- [Easing Functions](#easing-functions)
- [Performance Considerations](#performance-considerations)

---

## Why Motion Matters

Motion in a UI is not decoration. When used with purpose, it guides a user's attention toward what changed, provides feedback that an action was received, and creates a sense of continuity that ties separate views together into a coherent experience. Fluent Design treats motion as one of its five building blocks alongside material, light, depth, and scale, and WinUI 3 reflects that philosophy throughout its control library.

The guiding principle behind Fluent motion is that animations should feel physically grounded. Objects entering the screen should accelerate from rest; objects leaving should decelerate before disappearing. This mirrors how things behave in the physical world and reduces the cognitive overhead of processing sudden visual changes. When a panel slides in from the side with a gentle ease-out curve, the brain interprets it as arriving from somewhere rather than materializing from nothing. That interpretation, however brief, keeps the interface readable.

Well-designed motion also signals system state. A button that briefly scales down on press confirms the tap was registered even before any data returns from a server. A progress ring spinning in a defined area tells the user where to look for results. These signals reduce uncertainty and make the interface feel responsive even during inherently slow operations.

---

## Storyboarded Animations

The most explicit way to animate in WinUI 3 is through a `Storyboard`, which is a timeline-based container that applies one or more animations to dependency properties over a defined duration. Each animation targets a specific property on a specific named element, and the storyboard coordinates them all.

A `DoubleAnimation` transitions a numeric property from one value to another. Because most layout and visual properties, such as `Opacity`, `Width`, and `RenderTransform` sub-properties, are represented as doubles, this is by far the most common animation type.

```xml
<Storyboard x:Name="FadeInStoryboard">
    <DoubleAnimation
        Storyboard.TargetName="MyPanel"
        Storyboard.TargetProperty="Opacity"
        From="0" To="1"
        Duration="0:0:0.3" />
</Storyboard>
```

For color transitions, `ColorAnimation` works the same way but interpolates between two `Color` values. This is useful for hover effects on custom-drawn elements or for animating brush colors defined in a control template.

```xml
<Storyboard x:Name="HighlightStoryboard">
    <ColorAnimation
        Storyboard.TargetName="BackgroundBrush"
        Storyboard.TargetProperty="Color"
        To="#FF0078D4"
        Duration="0:0:0.2" />
</Storyboard>
```

When you need fine-grained control over the path of an animation rather than simple interpolation from one value to another, keyframe animations let you define intermediate values at specific time offsets. `DoubleAnimationUsingKeyFrames` holds a collection of `LinearDoubleKeyFrame`, `SplineDoubleKeyFrame`, or `EasingDoubleKeyFrame` entries, each specifying a value and a `KeyTime`.

```xml
<DoubleAnimationUsingKeyFrames
    Storyboard.TargetName="MyElement"
    Storyboard.TargetProperty="(UIElement.RenderTransform).(TranslateTransform.Y)">
    <EasingDoubleKeyFrame KeyTime="0:0:0" Value="0" />
    <EasingDoubleKeyFrame KeyTime="0:0:0.15" Value="-12">
        <EasingDoubleKeyFrame.EasingFunction>
            <CubicEase EasingMode="EaseOut" />
        </EasingDoubleKeyFrame.EasingFunction>
    </EasingDoubleKeyFrame>
    <EasingDoubleKeyFrame KeyTime="0:0:0.3" Value="0">
        <EasingDoubleKeyFrame.EasingFunction>
            <CubicEase EasingMode="EaseIn" />
        </EasingDoubleKeyFrame.EasingFunction>
    </EasingDoubleKeyFrame>
</DoubleAnimationUsingKeyFrames>
```

To start a storyboard from code, call `Begin()` on it. For storyboards defined in a `Page.Resources` or `Control.Resources`, retrieve them by key and call `Begin` with the owning object as the argument. For storyboards defined directly inside a trigger or event handler in XAML, the name is sufficient.

```csharp
FadeInStoryboard.Begin();
```

The `Storyboard.TargetProperty` syntax supports property paths for nested properties. To animate the X component of a `TranslateTransform` that is set as the `RenderTransform` of an element, the path is `(UIElement.RenderTransform).(TranslateTransform.X)`. The parentheses indicate type qualification, which the parser needs when walking a property chain through a non-concrete type like `Transform`.

---

## Visual States and Transitions

Most controls in WinUI 3 manage their appearance through `VisualStateManager`, which defines a set of named states and the property values or animations that apply in each state. Rather than writing imperative code to update the UI in response to every user interaction, you declare the desired appearance for each state and let the framework handle transitions.

States are grouped into `VisualStateGroup` elements, where only one state in a group is active at a time. A `Button`, for example, has a group containing states like `Normal`, `PointerOver`, `Pressed`, and `Disabled`. When the user moves the pointer over the button, the framework transitions from `Normal` to `PointerOver`, applying any setters or storyboards defined for that state.

```xml
<VisualStateManager.VisualStateGroups>
    <VisualStateGroup x:Name="CommonStates">
        <VisualState x:Name="Normal" />
        <VisualState x:Name="PointerOver">
            <VisualState.Setters>
                <Setter Target="RootBorder.Background"
                        Value="{ThemeResource ButtonBackgroundPointerOver}" />
            </VisualState.Setters>
        </VisualState>
        <VisualState x:Name="Pressed">
            <VisualState.Storyboard>
                <Storyboard>
                    <DoubleAnimation
                        Storyboard.TargetName="RootBorder"
                        Storyboard.TargetProperty="Opacity"
                        To="0.8" Duration="0:0:0.05" />
                </Storyboard>
            </VisualState.Storyboard>
        </VisualState>
    </VisualStateGroup>
</VisualStateManager.VisualStateGroups>
```

`VisualTransition` elements let you specify how the framework animates between two states automatically without embedding a storyboard in each state definition. A transition from `PointerOver` to `Normal` with a duration of 200 milliseconds means any property change made by the `PointerOver` state will reverse smoothly over that duration when the user moves the pointer away.

```xml
<VisualStateGroup.Transitions>
    <VisualTransition From="PointerOver" To="Normal" GeneratedDuration="0:0:0.2" />
    <VisualTransition To="Pressed" GeneratedDuration="0:0:0.05" />
</VisualStateGroup.Transitions>
```

To trigger a state change from code, call `VisualStateManager.GoToState(control, "StateName", useTransitions: true)`. Passing `true` for `useTransitions` tells the framework to play any applicable `VisualTransition`; passing `false` snaps immediately to the new state.

---

## Connected Animations

Connected animations create the illusion that a single element travels from one page to another during a navigation. The element appears to lift off from its position on the source page, scale or transform as needed, and settle into its position on the destination page. This continuity makes navigation feel spatial rather than abrupt.

The mechanism is coordinated through [ConnectedAnimationService](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.media.animation.connectedanimationservice){:target="_blank" rel="noopener noreferrer"}, which acts as a shared store between pages. On the source page, before navigation occurs, you call `PrepareToAnimate` with a key and the element that should appear to travel.

```csharp
// On the source page, before navigating
var service = ConnectedAnimationService.GetForCurrentView();
service.PrepareToAnimate("thumbnailAnimation", ThumbnailImage);
Frame.Navigate(typeof(DetailPage), item);
```

On the destination page, in `OnNavigatedTo` or after the page has loaded, you retrieve the animation by key and call `TryStart` with the element where the animation should land.

```csharp
// On the destination page
protected override void OnNavigatedTo(NavigationEventArgs e)
{
    base.OnNavigatedTo(e);
    var service = ConnectedAnimationService.GetForCurrentView();
    var animation = service.GetAnimation("thumbnailAnimation");
    animation?.TryStart(HeroImage);
}
```

If the destination element is inside a `ListView` or `GridView`, use the overload of `TryStart` that accepts the list control and the data item, which lets the framework scroll the item into view before starting the animation.

Connected animations work best for elements that have a meaningful visual relationship across the two pages, such as a product thumbnail that expands into a full hero image on a detail page. When the element's size or shape changes significantly between source and destination, the `Configuration` property on the animation controls how the transition handles the geometry change, with options like `BasicConnectedAnimationConfiguration` for scaling and `DirectConnectedAnimationConfiguration` for straight-line travel.

---

## Implicit Animations via the Community Toolkit

The [Windows Community Toolkit](https://github.com/CommunityToolkit/WindowsCommunityToolkit){:target="_blank" rel="noopener noreferrer"} provides a higher-level animation system built on top of the composition layer. Implicit animations in this system fire automatically when a property changes, without requiring manual storyboard management. You configure the animation behavior once, attach it to an element, and then normal property updates trigger smooth transitions.

The `AnimationSet` class defines a collection of animations that play together, and attached properties like `Explicit.Animations` and `Implicit.ShowAnimations` control when they trigger.

```csharp
using CommunityToolkit.WinUI.Animations;

// Animate Opacity and Translation when the element appears
AnimationBuilder.Create()
    .Opacity(from: 0, to: 1, duration: TimeSpan.FromMilliseconds(300))
    .Translation(axis: Axis.Y, from: 20, to: 0, duration: TimeSpan.FromMilliseconds(300))
    .Start(MyElement);
```

For layout-driven animations, where moving an element from one grid position to another should animate rather than snap, the Community Toolkit's implicit animation infrastructure can intercept the `Offset` property change on the underlying visual and animate it. This makes reordering items in a dynamic layout feel fluid without any per-item animation code.

The advantage of this pattern is that it decouples animation logic from application logic. A view model raises a property changed notification, the layout updates, and the implicit animation system handles the motion. Animation behavior becomes a UI concern configured in the view rather than business logic embedded in a view model.

---

## Composition Animations and the Visual Layer

Below the XAML layer sits [Microsoft.UI.Composition](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.composition){:target="_blank" rel="noopener noreferrer"}, the visual layer that XAML itself is built on. Composition animations run on the compositor thread, which is separate from the UI thread. Because they bypass the XAML rendering pipeline, they can maintain smooth 60 fps motion even when the UI thread is processing data or handling events.

To access the visual layer for a XAML element, use `ElementCompositionPreview.GetElementVisual(element)`, which returns the `Visual` object backing that element. From there, you can attach composition animations directly.

```csharp
using Microsoft.UI.Composition;
using Microsoft.UI.Xaml.Hosting;

var compositor = this.Compositor;
var visual = ElementCompositionPreview.GetElementVisual(MyElement);

// Create a spring animation for the scale property
var springAnimation = compositor.CreateSpringVector3Animation();
springAnimation.Target = "Scale";
springAnimation.FinalValue = new Vector3(1.1f, 1.1f, 1.0f);
springAnimation.Period = TimeSpan.FromMilliseconds(50);
springAnimation.DampingRatio = 0.4f;

visual.StartAnimation("Scale", springAnimation);
```

`SpringVector3NaturalMotionAnimation` produces physically simulated motion that overshoots and oscillates before settling, which is the characteristic spring feel seen throughout Fluent Design. The `DampingRatio` controls how quickly oscillation dies out: a ratio below 1.0 produces underdamped spring behavior with visible bounce, while a ratio at or above 1.0 critically damps the spring so it settles without bouncing.

`ExpressionAnimation` is a different kind of composition animation. Rather than specifying a keyframe or a target value, you write a mathematical expression as a string that the compositor evaluates every frame. This enables animations that are driven by a scroll position, a pointer position, or any other changing value without round-tripping to the UI thread.

```csharp
var scrollViewer = MyScrollViewer;
var scrollProperties = ElementCompositionPreview.GetScrollViewerManipulationPropertySet(scrollViewer);

var parallaxAnimation = compositor.CreateExpressionAnimation(
    "ScrollProperties.Translation.Y * -0.3");
parallaxAnimation.SetReferenceParameter("ScrollProperties", scrollProperties);

var backgroundVisual = ElementCompositionPreview.GetElementVisual(BackgroundImage);
backgroundVisual.StartAnimation("Offset.Y", parallaxAnimation);
```

Composition animations are the right choice when frame-rate consistency matters more than XAML convenience, particularly for particle effects, parallax scrolling, gesture-driven interactions, or any animation that needs to respond to real-time input without latency.

---

## Easing Functions

Easing functions control the rate of change over an animation's duration. A linear easing advances the property value at a constant rate, which looks mechanical and unnatural for most motion. Almost all polished animations use a non-linear curve that starts slowly, accelerates through the middle, and decelerates toward the end, or some asymmetric variation of that shape.

WinUI 3 provides built-in easing types including `CubicEase`, `QuarticEase`, `QuinticEase`, `SineEase`, `CircleEase`, `BackEase`, `ElasticEase`, and `BounceEase`. Each has an `EasingMode` property that switches between `EaseIn` (slow start), `EaseOut` (slow end), and `EaseInOut` (slow start and end). For most enter and exit animations, `EaseOut` feels most natural because it decelerates into the final position, mimicking the way physical objects slow before stopping.

`CubicBezierEase` provides the most control, accepting two control points that define the curve shape. This matches the easing curve format used in CSS animations and design tools like Figma, making it easy to transfer timing curves directly from a designer's specification.

```xml
<DoubleAnimation Duration="0:0:0.35">
    <DoubleAnimation.EasingFunction>
        <CubicBezierEase ControlPoint1="0.17,0.17"
                         ControlPoint2="0.0,1.0" />
    </DoubleAnimation.EasingFunction>
</DoubleAnimation>
```

The choice of easing function has an outsized effect on perceived quality. Two animations with identical duration and distance will feel completely different depending on their curves. A `BounceEase` applied to a settings panel sliding in from the edge feels playful and out of place; the same panel with a `CubicEase EaseOut` feels grounded and professional. Fluent Design's motion guidelines recommend ease-in curves for elements exiting the screen, ease-out curves for elements entering, and ease-in-out for elements moving between two points within the same view.

---

## Performance Considerations

The most important distinction for animation performance is whether the animation runs on the UI thread or the compositor thread. Storyboard animations targeting XAML dependency properties run on the UI thread. If the UI thread is busy processing data, handling events, or running layout, those animations will stutter or drop frames. The compositor thread, by contrast, renders independently and is not affected by UI thread activity.

The safest properties to animate without UI thread involvement are those managed by the composition layer: `Opacity`, `Translation` (not `Canvas.Left` or `Margin`), `Scale`, and `Rotation`. WinUI 3 exposes `UIElement.Translation`, `UIElement.Scale`, and `UIElement.Rotation` as composition-backed properties, meaning storyboard animations targeting them can run on the compositor thread even though they are set from XAML.

Animating layout properties like `Width`, `Height`, `Margin`, or `Canvas.Left` forces a layout pass on every frame, which is expensive and UI-thread-bound. Use `TranslateTransform` or `UIElement.Translation` for positional motion and `ScaleTransform` or `UIElement.Scale` for size illusions. If you genuinely need to animate layout dimensions, limit the scope of the layout pass by containing the animated element inside a `Canvas`, which excludes its children from the normal measure-and-arrange cycle.

For list controls with large item counts, avoid triggering animations from within item templates where possible. Each item animation multiplies the cost, and composition-layer animations are far more appropriate in those scenarios. The Community Toolkit's implicit animations are implemented on the composition layer, which is part of why they remain performant even when animating many elements simultaneously.

Profiling animation performance is straightforward with the [WinUI 3 Gallery](https://github.com/microsoft/WinUI-Gallery){:target="_blank" rel="noopener noreferrer"} as a reference, and Visual Studio's GPU Usage and Frame Analysis tools can confirm whether animations are staying on the compositor thread. A frame rate that drops when the UI thread is busy is a reliable indicator that the animation is UI-thread-bound and should be migrated to a composition animation.
