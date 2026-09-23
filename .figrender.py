"""Render _figures/<id>.html to PNG with headless Chrome or Edge, so a figure can be looked at.

Usage: python .figrender.py <figure id or path> [...] [--width 1000] [--out DIR]

Strips the front matter, wraps the SVG in a page that loads the site font, and screenshots it
at the SVG's aspect ratio. CSS variables are unset, so the hex fallbacks are what you see.
Prints the path of each PNG. Default output is the system temp directory, never the repo."""
import argparse, os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
BROWSERS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome", "chromium", "chromium-browser", "microsoft-edge",
]


def find_browser():
    for b in BROWSERS:
        if os.path.isfile(b) or shutil.which(b):
            return b if os.path.isfile(b) else shutil.which(b)
    sys.exit("No Chrome, Chromium, or Edge found. Add its path to BROWSERS in .figrender.py.")


def render(arg, width, out, browser):
    path = arg if arg.endswith(".html") else os.path.join(ROOT, "_figures", arg + ".html")
    fid = os.path.splitext(os.path.basename(path))[0]
    src = open(path, encoding="utf-8").read()
    svg = re.search(r"<svg.*</svg>", src, re.S).group(0)
    _, _, vw, vh = (float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split())
    height = int(width * vh / vw) + 40
    page = os.path.join(out, fid + ".page.html")
    png = os.path.join(out, fid + ".png")
    with open(page, "w", encoding="utf-8") as f:
        f.write('<!doctype html><html><head><meta charset="utf-8">'
                '<link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700&display=swap" rel="stylesheet">'
                f'<style>body{{margin:20px;background:#fff}}</style></head><body><div style="width:{width - 40}px">{svg}</div></body></html>')
    subprocess.run([browser, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    f"--screenshot={png}", f"--window-size={width},{height}",
                    "file:///" + page.replace("\\", "/")],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
    print(png if os.path.exists(png) else f"FAILED: {fid}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("figures", nargs="+")
    ap.add_argument("--width", type=int, default=1000)
    ap.add_argument("--out", default=os.path.join(tempfile.gettempdir(), "figrender"))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    browser = find_browser()
    for fig in a.figures:
        render(fig, a.width, a.out, browser)
