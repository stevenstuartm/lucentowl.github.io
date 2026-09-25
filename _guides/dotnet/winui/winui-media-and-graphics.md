---
title: "Media, Graphics, and the Visual Layer"
layout: guide
category: "WinUI 3"
subcategory: "Advanced Features"
description: "Playing audio and video with MediaPlayerElement, sizing image decodes, drawing with XAML shapes, adding effects and shadows through the composition visual layer, choosing between Win2D and SkiaSharp, the state of inking, and printing from a WinUI 3 app."
tags: [mediaplayerelement, image-decoding, composition, win2d, skiasharp, printing, practical]
---

## Table of Contents

- [Playing Audio and Video](#playing-audio-and-video)
- [Images and Bitmaps](#images-and-bitmaps)
- [XAML Shapes](#xaml-shapes)
- [The Composition Visual Layer](#the-composition-visual-layer)
- [Win2D and SkiaSharp](#win2d-and-skiasharp)
- [Inking](#inking)
- [Printing](#printing)
- [Choosing a Drawing Approach](#choosing-a-drawing-approach)

---

## Playing Audio and Video

`MediaPlayerElement`, in the Windows App SDK since 1.2, is the XAML front end for a `Windows.Media.Playback.MediaPlayer`. The player does the work: it opens the source, buffers it, decodes it (on the GPU for formats the hardware supports), and keeps the playback position. The element draws the video frame, a poster image before playback starts, the transport controls, and captions.

```xml
<MediaPlayerElement x:Name="Player"
                    AreTransportControlsEnabled="True"
                    AutoPlay="False"
                    PosterSource="Assets/poster.png" />
```

```csharp
Player.Source = MediaSource.CreateFromUri(new Uri("https://example.com/media/intro.mp4"));
```

A `MediaSource` describes where the media comes from, with one factory per origin: `CreateFromUri` for a web or package address, `CreateFromStorageFile` for a file the user picked, `CreateFromStream` for bytes the app already holds, and `CreateFromAdaptiveMediaSource` for HLS or DASH, the two common streaming formats that switch quality to match bandwidth. The element's `Source` takes any of three playback sources, each wrapping the one before:

- **`MediaSource`**: one piece of media, from any of the origins above.
- **`MediaPlaybackItem`**: wraps a `MediaSource` and exposes its audio, video, and caption tracks, so the user can switch between them.
- **`MediaPlaybackList`**: holds several items and plays them in sequence without gaps.

A `MediaSource` can belong to only one `MediaPlaybackItem`. Once it's wrapped, the app sets the item as the source rather than the `MediaSource`.

`AreTransportControlsEnabled` shows the built-in `MediaTransportControls` (play and pause, seek bar, volume, full window), and the `TransportControls` property holds that instance for customization. An app with its own playback UI turns the built-in controls off and drives `Player.MediaPlayer` directly: `Play()`, `Pause()`, and `PlaybackSession.Position` for seeking. `Position` isn't a bindable property, so a custom seek bar polls it on a timer, and polling faster than every 250 milliseconds gains nothing because `Position` updates at that rate during playback.

Captions in a separate file, such as an SRT file per language, load through a `TimedTextSource`. Each one is added to the `MediaSource`'s `ExternalTimedTextSources`, not to the playback item, and each becomes a track on the item. A caption track is disabled until the app sets its presentation mode. `PlatformPresented` has the element draw the text itself:

```csharp
var source = MediaSource.CreateFromUri(videoUri);
source.ExternalTimedTextSources.Add(TimedTextSource.CreateFromUri(captionsUri));

var item = new MediaPlaybackItem(source);
item.TimedMetadataTracksChanged += (sender, args) =>
{
    if (args.CollectionChange == CollectionChange.ItemInserted)
    {
        sender.TimedMetadataTracks.SetPresentationMode(
            args.Index, TimedMetadataTrackPresentationMode.PlatformPresented);
    }
};

Player.Source = item;
```

Playback events such as `TimedMetadataTracksChanged` and `MediaPlaybackList.CurrentItemChanged` arrive on a background thread, so a handler that updates the UI dispatches to the UI thread first.

Video is expensive, and Microsoft's performance guidance for it comes down to a few habits:

- **Set `Source` only when the user is ready to play.** The element loads the media engine when its source is set, so a page with an unplayed video pays nothing until then.
- **Set `PosterSource`.** Showing the poster lets XAML release GPU resources that an idle video surface would hold.
- **Keep XAML off the video.** Playback is most efficient when the video is the only thing drawn, so full-window playback goes through `IsFullWindow`, embedded video keeps its controls beside it rather than on top, and even a border around the element costs extra composition work.
- **Don't animate the element.** Moving or scaling a playing `MediaPlayerElement` costs performance and can tear the video.

---

## Images and Bitmaps

The `Image` control displays an `ImageSource`, and the source type depends on where the pixels come from:

| Source | Holds | Typical use |
| --- | --- | --- |
| `BitmapImage` | An encoded file (PNG, JPEG, GIF, and other formats) decoded by the platform | Photos, icons, anything loaded from a URI or stream |
| `SvgImageSource` | An SVG file, rasterized by Direct2D (Windows' GPU-accelerated 2D drawing API) at the size layout gives it | Vector art that has to stay sharp at any size |
| `SoftwareBitmapSource` | A `SoftwareBitmap`, the uncompressed image type in `Windows.Graphics.Imaging` | Camera frames, `BitmapDecoder` output |
| `WriteableBitmap` | A pixel buffer the app writes itself | Procedurally generated images |

### Decode Size

Decoding is where images cost memory. A decoded bitmap takes about four bytes per pixel, so a 4000 × 3000 photo occupies roughly 48 MB once decoded, whatever size it's drawn at. XAML avoids most of that on its own. When the app doesn't set a decode size, it decodes the image at the size the element takes in the page's first layout, which Microsoft calls right-sized decoding.

Right-sized decoding turns off in several common situations, and then the image decodes at full resolution:

- The `BitmapImage` got its `UriSource` or `SetSourceAsync` stream before it was attached to the live tree, the element tree a window is currently showing. An image declared in markup is always attached first, and in code the order is to set `Image.Source` to the new `BitmapImage`, then set its `UriSource`.
- The source was set with the synchronous `SetSource`.
- The image or an ancestor is hidden with `Opacity="0"` or `Visibility="Collapsed"`.
- The image uses `Stretch="None"`, a `NineGrid` (which stretches an image around fixed-size edges), or `CacheMode="BitmapCache"` (which caches rendered content as a bitmap) on itself or an ancestor.
- The image paints a non-rectangular area, such as an `ImageBrush` on an ellipse or on text.

In those cases, or whenever the display size is known ahead of time, the app sets the decode size itself. `DecodePixelWidth` and `DecodePixelHeight` are in physical pixels by default, the display's actual pixels, while layout sizes are in effective pixels that Windows scales to the display. On a display at 150% scaling, 300 physical pixels fill only 200 effective pixels. `DecodePixelType="Logical"` makes them the same units as layout, which is usually what the app means:

```xml
<Image Width="300" Height="200" Stretch="UniformToFill">
    <Image.Source>
        <BitmapImage UriSource="ms-appx:///Assets/photo.jpg"
                     DecodePixelType="Logical"
                     DecodePixelWidth="300" />
    </Image.Source>
</Image>
```

A decode size smaller than the drawn size makes the image look pixelated, and a larger one wastes memory and can blur it on the way down. XAML can reuse one decoded image for every element that loads the same URI, though it doesn't guarantee to, and it never shares one between separate streams holding identical bytes, so repeated images should load by URI. For thumbnails of the user's files, `StorageFile.GetThumbnailAsync` is cheaper still, because it returns a thumbnail the shell has already cached.

### Writing Pixels

A `WriteableBitmap` holds a BGRA8 pixel buffer, four bytes per pixel in blue, green, red, alpha order. C# code writes to it through the `AsStream` extension in `System.Runtime.InteropServices.WindowsRuntime`, then calls `Invalidate` to have it redrawn:

```csharp
var bitmap = new WriteableBitmap(width, height);
using (Stream stream = bitmap.PixelBuffer.AsStream())
{
    stream.Write(pixels, 0, pixels.Length);
}
bitmap.Invalidate();
MyImage.Source = bitmap;
```

When the pixels come from another WinRT API, such as a camera frame or a `BitmapDecoder`, Microsoft recommends `SoftwareBitmapSource` instead, because it takes the `SoftwareBitmap` directly and skips the copy into a `WriteableBitmap`. Going the other way, `RenderTargetBitmap` renders a XAML element into an image, for export or a thumbnail of the app's own UI.

### SVG

`SvgImageSource` renders SVG in the specification's secure static mode, with no animation, scripting, or interaction. Direct2D supplies the rendering and supports a documented subset of SVG elements and attributes, so a file exported from a design tool can render differently than it does in a browser. Without `RasterizePixelWidth` or `RasterizePixelHeight`, layout sets the rasterization size and the aspect ratio is kept.

---

## XAML Shapes

The `Microsoft.UI.Xaml.Shapes` namespace holds vector shapes: `Rectangle`, `Ellipse`, `Line`, `Polyline`, `Polygon`, and `Path`. Each is a full `UIElement`, so it takes part in layout, hit testing, styling, and data binding like any control, and it stays sharp at any scale because it's drawn from geometry rather than pixels. `Fill` paints the interior, `Stroke` the outline, and `StrokeThickness` sets the outline width:

```xml
<Rectangle Width="120" Height="60"
           Fill="{ThemeResource AccentFillColorDefaultBrush}"
           Stroke="{ThemeResource SystemFillColorAttentionBrush}"
           StrokeThickness="2"
           RadiusX="8" RadiusY="8" />

<Ellipse Width="80" Height="80" Fill="SteelBlue" />

<Line X1="0" Y1="0" X2="200" Y2="100" Stroke="DarkGray" StrokeThickness="1" />
```

`Polyline` and `Polygon` take a `Points` collection. `Polygon` draws a closing segment from the last point back to the first, and `Polyline` leaves the outline open.

`Path` draws any geometry. Its `Data` property takes a `Geometry` object or a compact string in path markup syntax:

```xml
<!-- An arrow pointing left -->
<Path Fill="Gray"
      Data="M 0,10 L 30,0 L 30,7 L 60,7 L 60,13 L 30,13 L 30,20 Z" />
```

Each letter is a command: `M` moves to a point, `L` draws a line to one, and `Z` closes the figure. `C` and `Q` draw cubic and quadratic Bézier curves and `A` draws an arc. SVG path data uses nearly the same command set, so a path exported from a design tool usually pastes into `Data` unchanged.

Every shape is an element in the visual tree, with the layout and memory cost of one. That's cheap for icons, a chart with dozens of points, or decorative geometry. Hundreds of shapes, or shapes rebuilt every frame, multiply that cost, and at that scale another drawing approach fits better (see [Choosing a Drawing Approach](#choosing-a-drawing-approach)).

---

## The Composition Visual Layer

XAML doesn't draw the screen itself. Each element is backed by a `Visual` in `Microsoft.UI.Composition`, and the compositor turns that tree of visuals into frames on its own thread. An app can work with that layer directly for effects XAML properties can't express: blur and frosted glass, color effects, shadows shaped like their content, and lighting. Composition animations also run on this layer, and they belong to the animation side of WinUI rather than to drawing.

`ElementCompositionPreview` connects the two trees in two directions. `GetElementVisual` returns the visual XAML created for an element, which Microsoft calls the handout visual. XAML keeps setting that visual's `Offset`, `Size`, and `Opacity` from layout and from the element's own properties, and a change the app makes to the visual isn't reflected back into the element's properties. An app reads the handout visual mostly for its `Compositor`, the factory for every other composition object, and for its `Size`.

`SetElementChildVisual` goes the other way. It attaches a visual the app built, called the hand-in visual, as the last child of an element's visual, so it draws on top of everything else in that element. The usual host is an empty `Canvas` placed where the effect should appear, over the content the effect works on. Content drawn this way gets none of XAML's accessibility or input handling, which is why Microsoft advises using it only for effects XAML can't produce.

The frosted-glass effect shows both directions. The hand-in `SpriteVisual` is painted by an effect brush, and the brush blurs whatever is behind it. The last three lines add an expression animation, which ties one property to another object's value and updates it on the compositor, so the sprite follows the host's size through every layout change:

```csharp
Visual hostVisual = ElementCompositionPreview.GetElementVisual(GlassHost);
Compositor compositor = hostVisual.Compositor;

// Win2D describes the effect: blur what's behind the visual
var blur = new GaussianBlurEffect
{
    BlurAmount = 15f,
    BorderMode = EffectBorderMode.Hard,
    Source = new CompositionEffectSourceParameter("backdrop")
};

CompositionEffectBrush brush = compositor.CreateEffectFactory(blur).CreateBrush();
brush.SetSourceParameter("backdrop", compositor.CreateBackdropBrush());

SpriteVisual glass = compositor.CreateSpriteVisual();
glass.Brush = brush;
ElementCompositionPreview.SetElementChildVisual(GlassHost, glass);

// Keep the sprite the same size as its host as layout changes
var sizeBinding = compositor.CreateExpressionAnimation("host.Size");
sizeBinding.SetReferenceParameter("host", hostVisual);
glass.StartAnimation("Size", sizeBinding);
```

{% include figure.html id="winui-composition-hand-in" %}

The effect classes such as `GaussianBlurEffect` come from Win2D's `Microsoft.Graphics.Canvas.Effects` namespace, so this code needs the `Microsoft.Graphics.Win2D` package even though Win2D never draws anything here. `CreateEffectFactory` compiles the description into a form composition can run, so an app compiles each effect once and makes a brush from the factory for each visual that uses it. An effect source parameter gets its pixels from whatever brush is plugged into it: a backdrop brush for the content behind the visual, or a surface brush holding an image loaded with `LoadedImageSurface`. Composition can't run every Win2D effect, and Win2D's documentation marks the ones it can't with `[NoComposition]`.

For ordinary frosted glass inside a window, the hand-built graph isn't needed. WinUI's `AcrylicBrush` is a ready-made XAML brush that blurs, tints, and adds noise to the content behind an element, with a solid `FallbackColor` when the effect can't render. The composition route is for effect graphs acrylic can't express. Mica and acrylic behind a whole window are system backdrops set on the window, not brushes.

A shadow follows the same pattern. `Compositor.CreateDropShadow` makes a `DropShadow` with a color, blur radius, and offset, and assigning it to a hand-in sprite's `Shadow` draws it. By default a shadow is rectangular, or takes the shape of its `Mask` when one is set. `Image`, `TextBlock`, and the shapes each have a `GetAlphaMask` method that returns their outline as a brush, which gives a shadow shaped like an ellipse or like text. Setting `SourcePolicy` to `InheritFromVisualContent` instead shapes the shadow from the alpha of the sprite's own brush. For the standard elevation shadow on a card or flyout, XAML's `ThemeShadow` needs no composition code.

When an effect should paint a XAML element directly, rather than a sprite on top of it, a class derived from `XamlCompositionBrushBase` wraps the effect brush as an ordinary XAML brush that any `Background` or `Fill` can use.

---

## Win2D and SkiaSharp

Some drawing is too much for shapes and too specialized for the composition layer: thousands of primitives, a redraw every frame, geometry operations like unions and outlines, image processing. That's immediate-mode drawing, where code issues draw calls against a surface every time it paints and nothing is kept in a tree between frames. Two libraries bring it to WinUI 3.

[Win2D](https://microsoft.github.io/Win2D/WinUI3/html/Introduction.htm){:target="_blank" rel="noopener noreferrer"} (the `Microsoft.Graphics.Win2D` package) is Microsoft's GPU-accelerated wrapper over Direct2D. A `CanvasControl` raises `Draw` whenever it needs repainting, and the handler draws through a `CanvasDrawingSession`. `CanvasVirtualControl` suits very large surfaces, asking the app to draw only the regions that need it. `CanvasAnimatedControl` runs a game-style loop on its own thread, and after being removed from the WinUI 3 version in 2021 it has been back and stable since Win2D 1.3.1, with a fix for excessive CPU use in 1.3.2. The WinUI 3 documentation is marked a work in progress, and some of its pages still describe the animated control as unsupported. Win2D also offers geometry operations (combining, widening, and outlining paths) and Direct2D's image effects.

[SkiaSharp](https://github.com/mono/SkiaSharp){:target="_blank" rel="noopener noreferrer"} wraps Google's Skia engine, the renderer behind Chrome, for .NET. Its advantage is portability, since the same drawing code runs on Windows, macOS, Linux, Android, iOS, and in the browser. WinUI 3 hosts it in one of two controls from the `SkiaSharp.Views.WinUI` package, whose namespace is `SkiaSharp.Views.Windows`. `SKXamlCanvas` renders on the CPU and slows as its area grows, which shows on 4K displays. `SKSwapChainPanel` renders on the GPU through ANGLE, a layer that runs OpenGL ES drawing on Direct3D.

The lowest-level option is WinUI's own `SwapChainPanel`, which hosts a DirectX swap chain, the set of buffers a Direct3D renderer draws into and presents. It's the host for a game engine or a custom GPU renderer that manages Direct3D itself, connected through native interop, and it takes the most code of any option here.

---

## Inking

WinUI 3 has no stable inking control. `InkCanvas`, `InkToolbar`, and `InkPresenter` arrived in the Windows App SDK 2.4 experimental release on 25 August 2026, in the `Microsoft.UI.Xaml.Controls` namespace, and they aren't in any stable release. Experimental releases aren't meant for production, and their APIs can change before they ship.

The experimental API follows UWP's shape. `InkCanvas` captures pen and touch strokes, `InkToolbar.TargetInkCanvas` connects the pre-built pen, highlighter, and eraser toolbar to it, and `InkCanvas.InkPresenter` configures input. `InkPresenter.StrokeContainer` stores the strokes, and its `SaveAsync` and `LoadAsync` write and read them in Ink Serialized Format. An overload of `SaveAsync` takes an `InkPersistenceFormat` to choose between plain ISF and ISF embedded in a GIF. An app that needs ink before these controls ship has to capture pointer input and render the strokes itself, for example with Win2D.

---

## Printing

WinUI 3 prints through the same model as UWP. It works only on Windows 11, because the print manager isn't yet available to Windows App SDK apps on Windows 10. The one change from UWP is where the print manager comes from. UWP asked the current view for its `PrintManager`, and a desktop app has no current view, so it gets the print manager for a specific window by handle. `PrintManagerInterop` (in `Windows.Graphics.Printing`) takes the handle:

```csharp
var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(App.MainWindow);
PrintManager printManager = PrintManagerInterop.GetForWindow(hwnd);
printManager.PrintTaskRequested += OnPrintTaskRequested;

// Later, from a Print button
if (PrintManager.IsSupported())
{
    await PrintManagerInterop.ShowPrintUIForWindowAsync(hwnd);
}
```

The pages come from a `PrintDocument` in `Microsoft.UI.Xaml.Printing`. When the user opens the print dialog, the `PrintTaskRequested` handler creates a print task and hands the dialog the document's `DocumentSource`. The document then raises three events:

1. **`Paginate`**: the app builds each page as a XAML element sized to the page description in the print options, then reports the page count. It fires again whenever the user changes settings such as paper size or orientation.
2. **`GetPreviewPage`**: the app supplies the page the preview is showing.
3. **`AddPages`**: after the user presses Print, the app adds the pages to print and calls `AddPagesComplete`.

A page registers in its `Loaded` handler, where the window handle is available, and unregisters when the user navigates away. A page that registers again without unregistering throws when the user comes back to it. `ShowPrintUIForWindowAsync` also throws when printing can't proceed, so the call belongs in a `try` block that tells the user what happened.

Laying out XAML for paper takes a lot of code, because the app measures its content, splits it across pages, and reflows it whenever the settings change. When printing is occasional, generating a PDF is often less work and gives the user a file they can print, send, or keep. [QuestPDF](https://www.questpdf.com/){:target="_blank" rel="noopener noreferrer"} builds documents with a fluent C# layout API, and its free Community license covers individuals and organizations under USD 1 million in annual revenue. [PDFsharp](https://docs.pdfsharp.net/){:target="_blank" rel="noopener noreferrer"} is open source and draws PDF pages directly. Print dialog integration pays for itself when printing is central to the product, such as for invoices, labels, or reports with an exact page layout.

---

## Choosing a Drawing Approach

| Approach | Fits | Costs |
| --- | --- | --- |
| XAML shapes and `Image` | Icons, simple charts, decorative geometry, anything that binds, styles, or needs hit testing | One visual-tree element per shape, so hundreds of shapes or per-frame changes get slow |
| Composition visual layer | Blur, color effects, content-shaped shadows, lighting on existing XAML | Code only, and hand-in visuals get no accessibility or input |
| Win2D | Many primitives, custom render loops, geometry operations, Direct2D effects, Windows only | A package dependency, immediate-mode code, no layout or hit testing |
| SkiaSharp | Drawing code shared with other platforms | A package dependency, and CPU rendering in `SKXamlCanvas` |
| `WriteableBitmap` or `SoftwareBitmapSource` | Pixels the app computes or receives, such as image processing or camera frames | Every pixel is the app's job, with no vector scaling |
| `SwapChainPanel` | Game engines and custom Direct3D renderers | Native DirectX code and the most setup |

The usual path starts with shapes and `Image`, adds composition for effects on existing elements, and moves drawing into Win2D once shape counts or redraw rates outgrow the visual tree. SkiaSharp is the choice when the same drawing code also has to run somewhere other than Windows.
