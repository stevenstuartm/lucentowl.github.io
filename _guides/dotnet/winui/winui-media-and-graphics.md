---
title: "Media, Graphics, and the Visual Layer"
layout: guide
category: "WinUI 3"
subcategory: "Advanced Features"
description: "Working with media playback, digital inking, vector shapes, the composition visual layer, and printing in WinUI 3 for rich visual experiences."
tags: [winui, winui-3, xaml, media, graphics, composition, inking, desktop]
---

## Table of Contents

- [MediaPlayerElement](#mediaplayerelement)
- [InkCanvas and Digital Inking](#inkcanvas-and-digital-inking)
- [XAML Shapes](#xaml-shapes)
- [Images and Bitmaps](#images-and-bitmaps)
- [The Composition Visual Layer](#the-composition-visual-layer)
- [Printing](#printing)
- [Choosing the Right Drawing Approach](#choosing-the-right-drawing-approach)

---

## MediaPlayerElement

`MediaPlayerElement` is the primary control for audio and video playback in WinUI 3. It wraps the underlying `Windows.Media.Playback.MediaPlayer` and surfaces a XAML-friendly interface with built-in transport controls, poster image support, and closed caption rendering. For most playback scenarios you assign a source and optionally configure the control; the runtime handles buffering, format negotiation, and hardware decoding.

Setting up basic video playback requires a source and, typically, transport controls:

```xml
<MediaPlayerElement x:Name="Player"
                    AreTransportControlsEnabled="True"
                    AutoPlay="False"
                    PosterSource="Assets/poster.png" />
```

```csharp
Player.Source = MediaSource.CreateFromUri(new Uri("ms-appx:///Assets/clip.mp4"));
```

`MediaSource.CreateFromUri` accepts local package URIs, file paths via `StorageFile`, and remote HTTPS addresses. For content that requires adaptive streaming or DRM, the `MediaPlaybackItem` and `AdaptiveMediaSource` types build on top of `MediaSource` and are accessible through the same `Source` property chain.

`AreTransportControlsEnabled` toggles the default overlay that includes play/pause, seek, volume, and full-screen buttons. When set to `True`, the control renders a `MediaTransportControls` instance that you can replace or extend through the `TransportControls` property. If you need a custom playback UI, set `AreTransportControlsEnabled` to `False` and drive the underlying `MediaPlayer` directly through `Player.MediaPlayer`.

Subtitles and closed captions attach through `TimedMetadataTracks` on a `MediaPlaybackItem`. When the track type is `TimedMetadataKind.Subtitle` or `TimedMetadataKind.Caption`, the `MediaPlayerElement` renders them automatically in the standard position. For external SRT files you load the file as a `TimedTextSource` and add it to the item before assigning the source to the element.

---

## InkCanvas and Digital Inking

`InkCanvas` is a transparent overlay control that captures pen, touch, and mouse input as vector stroke data. It does not replace the controls beneath it; instead, it sits in the XAML tree like any other element, receiving pointer events and converting them to `InkStroke` objects managed by its `InkPresenter`. The strokes render in real time on the canvas surface and can be saved, loaded, analyzed, or manipulated programmatically.

A minimal inking setup pairs `InkCanvas` with `InkToolbar`:

```xml
<Grid>
    <Image Source="Assets/background.png" />
    <InkCanvas x:Name="MyInkCanvas" />
    <InkToolbar TargetInkCanvas="{x:Bind MyInkCanvas}"
                VerticalAlignment="Top" />
</Grid>
```

`InkToolbar` provides a pre-built palette with ballpoint pen, pencil, and highlighter tools, color pickers, size sliders, and an eraser, all wired to the target canvas without additional code. The `TargetInkCanvas` binding connects the toolbar to the canvas so tool selections immediately influence how new strokes are drawn.

For programmatic control, `InkCanvas.InkPresenter` is the gateway. You configure accepted input types through `InputDeviceTypes`:

```csharp
MyInkCanvas.InkPresenter.InputDeviceTypes =
    CoreInputDeviceTypes.Pen |
    CoreInputDeviceTypes.Mouse |
    CoreInputDeviceTypes.Touch;
```

By default only pen input is captured, so enabling mouse and touch input requires this explicit assignment. The `InkPresenter` also exposes `CopyDefaultDrawingAttributes` and `UpdateDefaultDrawingAttributes` for setting stroke color, size, and rendering hints outside the toolbar.

Saving and loading ink uses the `InkSerializer` API from `Windows.UI.Input.Inking.InkManager` or, more directly, the `GetStrokes` method on `InkPresenter.StrokeContainer` combined with `SaveAsync` and `LoadAsync`:

```csharp
// Save to a stream
using var stream = await file.OpenAsync(FileAccessMode.ReadWrite);
await MyInkCanvas.InkPresenter.StrokeContainer.SaveAsync(stream);

// Load from a stream
using var readStream = await file.OpenReadAsync();
await MyInkCanvas.InkPresenter.StrokeContainer.LoadAsync(readStream);
```

The serialized format is Ink Serialized Format (ISF), a compact binary representation. For scenarios that need strokes in another format, such as SVG or a custom data model, you iterate `StrokeContainer.GetStrokes()` and process the `InkStroke` and `InkPoint` collections directly.

---

## XAML Shapes

XAML includes a set of vector shape primitives in the `Microsoft.UI.Xaml.Shapes` namespace: `Rectangle`, `Ellipse`, `Line`, `Polyline`, `Polygon`, and `Path`. These are full `UIElement` subclasses, meaning they participate in layout, hit testing, and the visual tree just like any other control. Unlike images or bitmaps, shapes scale without quality loss because they are defined mathematically.

`Fill` sets the interior brush and `Stroke` sets the outline brush, with `StrokeThickness` controlling the outline width:

```xml
<Rectangle Width="120" Height="60"
           Fill="{ThemeResource AccentFillColorDefaultBrush}"
           Stroke="{ThemeResource SystemFillColorAttentionBrush}"
           StrokeThickness="2"
           RadiusX="8" RadiusY="8" />

<Ellipse Width="80" Height="80"
         Fill="SteelBlue" />

<Line X1="0" Y1="0" X2="200" Y2="100"
      Stroke="DarkGray" StrokeThickness="1" />
```

`Polyline` and `Polygon` accept a `Points` collection and are suitable for irregular multi-segment shapes. `Polygon` automatically closes the last point back to the first, making it appropriate for filled regions, while `Polyline` leaves the shape open.

`Path` is the most expressive shape. Its `Data` property accepts a `Geometry` object or a path markup syntax string that describes curves, arcs, and compound figures. Path markup syntax compresses what would be several lines of C# into a compact string:

```xml
<!-- A simple arrow shape using path markup syntax -->
<Path Fill="Gray"
      Data="M 0,10 L 30,0 L 30,7 L 60,7 L 60,13 L 30,13 L 30,20 Z" />
```

The letters in the string are commands: `M` moves to a point, `L` draws a line to a point, and `Z` closes the path. Curves use `C` for cubic Bezier, `Q` for quadratic Bezier, and `A` for arcs. For complex paths generated by design tools, the markup string is typically copy-pasted directly from the SVG or Illustrator export.

Shapes are appropriate when you need scalable, interactive vector content that participates in layout. For decorative backgrounds or textures, images are often more practical. For animated or composited visual effects, the composition layer offers more flexibility than shapes alone can provide.

---

## Images and Bitmaps

The `Image` control displays raster and vector image content. Its `Source` property accepts a `BitmapImage`, `WriteableBitmap`, or `SvgImageSource`, each suited to different scenarios.

`BitmapImage` is the standard choice for static raster images:

```xml
<Image Width="300" Height="200" Stretch="UniformToFill">
    <Image.Source>
        <BitmapImage UriSource="ms-appx:///Assets/photo.jpg"
                     DecodePixelWidth="300"
                     DecodePixelHeight="200" />
    </Image.Source>
</Image>
```

`DecodePixelWidth` and `DecodePixelHeight` are among the most impactful performance properties available on `BitmapImage`. Without them, the runtime decodes the full image at its native resolution and then scales it down during rendering. A 4000-pixel-wide photo displayed at 300 pixels wide will consume memory proportional to the original size unless these properties are set. By specifying decode dimensions that match the display size, the decoder discards the excess data upfront, reducing working set significantly in image-heavy applications.

`WriteableBitmap` provides a pixel buffer you can write to directly from C#. This suits scenarios like procedurally generated content, real-time image processing, or game-style rendering where frames change frequently:

```csharp
var bitmap = new WriteableBitmap(width, height);
using (var buffer = bitmap.PixelBuffer.AsStream())
{
    // Write BGRA8 pixel data
    buffer.Write(pixelData, 0, pixelData.Length);
}
bitmap.Invalidate();
MyImage.Source = bitmap;
```

`SvgImageSource` renders SVG files through the platform's SVG parser, giving you crisp vector images at any size without managing path geometry manually in XAML. Assign it like a standard image source; the runtime handles rasterization at the appropriate resolution for the display.

---

## The Composition Visual Layer

The composition visual layer, exposed through the `Microsoft.UI.Composition` namespace, is the rendering infrastructure beneath the XAML UI. Every XAML element maps to a composition `Visual` in the tree, but you can access and extend this layer directly to achieve effects that XAML properties cannot express, such as pixel-shader effects, spring-based animations, and layered brush compositing.

The entry point is `ElementCompositionPreview`, which bridges XAML and composition:

```csharp
var compositor = ElementCompositionPreview.GetElementVisual(MyBorder).Compositor;
var visual = ElementCompositionPreview.GetElementVisual(MyBorder);
```

`GetElementVisual` returns the `ContainerVisual` backing the XAML element. From there you can add child visuals, apply effects, or offset and rotate the visual independently of XAML layout. The compositor is the factory for all composition objects, and each compositor is tied to a thread; you should always retrieve it from an existing visual rather than instantiating one independently.

Blur and shadow effects illustrate the composition layer's strengths:

```csharp
var compositor = ElementCompositionPreview.GetElementVisual(MyPanel).Compositor;

// Gaussian blur on a sprite visual
var graphicsEffect = new GaussianBlurEffect
{
    Name = "Blur",
    BlurAmount = 10f,
    Source = new CompositionEffectSourceParameter("source")
};

var effectFactory = compositor.CreateEffectFactory(graphicsEffect);
var effectBrush = effectFactory.CreateBrush();

var spriteVisual = compositor.CreateSpriteVisual();
spriteVisual.Size = new Vector2(400, 300);
spriteVisual.Brush = effectBrush;

ElementCompositionPreview.SetElementChildVisual(MyPanel, spriteVisual);
```

`DropShadow` is a first-class composition type that attaches to a visual and renders a shadow behind it, with controllable color, blur radius, and offset:

```csharp
var shadow = compositor.CreateDropShadow();
shadow.Color = Colors.Black;
shadow.BlurRadius = 16f;
shadow.Offset = new Vector3(4, 4, 0);
shadow.Opacity = 0.5f;

spriteVisual.Shadow = shadow;
```

Composition animations run on the render thread, independent of the UI thread. `ScalarKeyFrameAnimation` and `Vector3KeyFrameAnimation` drive property changes over time without blocking the application. Connecting an animation to a visual property that would normally require UI-thread marshaling, such as `Opacity` or `Offset`, moves the work entirely to the compositor, resulting in smoother motion even when the UI thread is busy.

---

## Printing

Printing in WinUI 3 is more constrained than in WPF or UWP. The `PrintManager` and `PrintDocument` APIs from the Windows Runtime are available, but the integration path requires P/Invoke to associate the print contract with the correct HWND. The `PrintManagerInterop` COM interface provides `GetForWindow` and `ShowPrintUIForWindowAsync` methods that accept a window handle:

```csharp
var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(this);
var printManager = PrintManagerInterop.GetForWindow(hwnd);
printManager.PrintTaskRequested += OnPrintTaskRequested;
await PrintManagerInterop.ShowPrintUIForWindowAsync(hwnd);
```

Building print pages involves creating XAML elements, measuring and arranging them to fit page dimensions, and handing them to a `PrintDocument` through its `Paginate` and `GetPreviewPage` event handlers. This is similar to the UWP printing model but requires the window-handle interop step first.

For many scenarios, generating a PDF and then opening it in the system PDF viewer or Shell is a more practical alternative. Libraries like [QuestPDF](https://www.questpdf.com/){:target="_blank" rel="noopener noreferrer"} and [PdfSharpCore](https://github.com/ststeiger/PdfSharpCore){:target="_blank" rel="noopener noreferrer"} build PDF documents from C# without requiring any HWND plumbing, and the result is shareable and archivable. This approach sidesteps the per-HWND registration complexity while giving users a print-ready file they can send to any printer or save permanently.

When printing is a core product requirement rather than an incidental feature, the direct `PrintManager` approach gives you full control over page layout and print preview. When printing is occasional, PDF generation typically delivers a better result with substantially less effort.

---

## Choosing the Right Drawing Approach

WinUI 3 offers several distinct drawing models, and choosing between them affects performance, maintenance complexity, and what effects are achievable.

XAML shapes work well for relatively small numbers of scalable vector figures that participate in layout. Icons, charts with modest data points, and decorative geometry fit this category. Shapes are easy to bind, style, and animate through XAML, and they hit-test correctly without additional configuration. When shape counts reach the hundreds or when shapes need frequent updates, the overhead of the visual tree becomes noticeable.

The composition visual layer is appropriate when you need effects that XAML properties cannot express, such as blur, glow, or multi-layer blending, and when you want animations that run independently of the UI thread. It requires more boilerplate than XAML shapes but offers considerably more expressive power without leaving the Windows Runtime surface.

[Win2D](https://microsoft.github.io/Win2D/WinUI3/html/Introduction.htm){:target="_blank" rel="noopener noreferrer"} is a higher-level 2D graphics API built on Direct2D that integrates with WinUI 3 through a `CanvasControl` or `CanvasAnimatedControl`. It suits scenarios involving large numbers of drawn primitives, custom rendering loops, image effects pipelines, or geometry operations like boolean unions and stroke widening. Win2D is a good fit for graph renderers, custom map overlays, and game-style 2D content.

[SkiaSharp](https://github.com/mono/SkiaSharp){:target="_blank" rel="noopener noreferrer"} is a cross-platform 2D graphics library that wraps Google's Skia rendering engine. If your drawing code must run on multiple platforms like WinUI 3, MAUI, and Blazor, SkiaSharp provides a unified API across all of them. It requires a `SKXamlCanvas` or an `SKSwapChainPanel` host on WinUI 3, but the drawing code itself is platform-agnostic.

The practical decision often flows in a predictable direction. Start with XAML shapes and the `Image` control for static or lightly animated content. Move to the composition layer for per-element effects and independent animations. Consider Win2D when you need a 2D rendering loop or complex geometry operations. Consider SkiaSharp when cross-platform consistency matters more than platform-native integration.
