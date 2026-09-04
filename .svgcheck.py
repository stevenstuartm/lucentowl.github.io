"""Geometry checker for hand-authored inline SVG in _resources/*.md.
Reads font metrics from each SVG's own <style> block, so it needs no class map."""
import re, sys, xml.etree.ElementTree as ET

def parse_style(svg):
    m = re.search(r'<style>(.*?)</style>', svg, re.S)
    out = {}
    if not m: return out
    for cls, body in re.findall(r'\.([A-Za-z0-9_-]+)\s*\{([^}]*)\}', m.group(1)):
        fs = re.search(r'font-size:\s*([\d.]+)px', body)
        fw = re.search(r'font-weight:\s*(\d+)', body)
        ls = re.search(r'letter-spacing:\s*([\d.]+)em', body)
        out[cls] = (float(fs.group(1)) if fs else 11.5,
                    int(fw.group(1)) >= 600 if fw else False,
                    float(ls.group(1)) if ls else 0.0)
    return out

def tg(e): return e.tag.split('}')[-1]
def wid(t, fs, b, ls): return len(t) * (fs * (0.575 if b else 0.535) + fs * ls)

total = 0
for path in sys.argv[1:]:
    src = open(path, encoding='utf-8').read()
    svgs = re.findall(r'<svg.*?</svg>', src, re.S)
    print(f"\n##### {path} : {len(svgs)} svg #####")
    style = {}
    for s in svgs: style.update(parse_style(s))
    for idx, s in enumerate(svgs, 1):
        try: r = ET.fromstring(s)
        except ET.ParseError as e:
            print(f"  SVG {idx}: XML PARSE ERROR {e}"); total += 1; continue
        vb = [float(x) for x in r.get('viewBox').split()]; VW, VH = vb[2], vb[3]
        rects, texts, ids, refs, unknown = [], [], set(), set(), set()
        def walk(el, dx=0.0, dy=0.0):
            for c in el:
                if c.get('id'): ids.add(c.get('id'))
                for v in c.attrib.values():
                    mm = re.search(r'url\(#([^)]+)\)', v or '')
                    if mm: refs.add(mm.group(1))
                t = c.get('transform') or ''
                m = re.match(r'translate\(\s*([-\d.]+)[ ,]+([-\d.]+)', t)
                ndx, ndy = (dx + float(m.group(1)), dy + float(m.group(2))) if m else (dx, dy)
                if tg(c) == 'rect':
                    rects.append((float(c.get('x')) + ndx, float(c.get('y')) + ndy,
                                  float(c.get('width')), float(c.get('height')), c.get('class', '')))
                elif tg(c) == 'text':
                    cl = c.get('class', '')
                    if cl not in style: unknown.add(cl)
                    fs, b, ls = style.get(cl, (11.5, False, 0.0))
                    txt = ''.join(c.itertext()); tw = wid(txt, fs, b, ls)
                    x = float(c.get('x')) + ndx; y = float(c.get('y')) + ndy
                    a = c.get('text-anchor', 'start')
                    x0 = x if a == 'start' else (x - tw / 2 if a == 'middle' else x - tw)
                    texts.append([x0, y - fs * 0.8, tw, fs * 1.05, txt, cl])
                walk(c, ndx, ndy)
        walk(r)
        prob = 0
        def ov(a, b): return not (a[0]+a[2] <= b[0] or b[0]+b[2] <= a[0] or a[1]+a[3] <= b[1] or b[1]+b[3] <= a[1])
        for x, y, w, h, c in rects:
            if x < 0 or y < 0 or x + w > VW or y + h > VH:
                print(f"  RECT OOB [{c}] {x},{y} {w}x{h}"); prob += 1
        for t in texts:
            if t[0] < -1 or t[0]+t[2] > VW+1 or t[1] < 0 or t[1]+t[3] > VH:
                print(f"  TEXT OOB x[{t[0]:.0f}..{t[0]+t[2]:.0f}] y[{t[1]:.0f}]: {t[4][:48]!r}"); prob += 1
        for i in range(len(texts)):
            for j in range(i+1, len(texts)):
                if ov(texts[i], texts[j]):
                    print(f"  TEXT/TEXT: {texts[i][4][:30]!r} <> {texts[j][4][:30]!r}"); prob += 1
        for t in texts:
            for bx, by, bw, bh, bc in rects:
                inside = bx <= t[0]+2 and t[0]+t[2] <= bx+bw+2 and by <= t[1] and t[1]+t[3] <= by+bh
                if ov(t, (bx, by, bw, bh)) and not inside:
                    print(f"  TEXT crosses rect [{bc}]: {t[4][:44]!r}"); prob += 1
        if refs - ids:
            print(f"  DANGLING url() refs {sorted(refs-ids)}"); prob += 1
        if unknown:
            print(f"  NOTE unstyled text classes (default metrics used): {sorted(unknown)}")
        print(f"  SVG {idx} ({VW:.0f}x{VH:.0f}) {len(rects)}r/{len(texts)}t -> {prob}")
        total += prob
print("\nTOTAL PROBLEMS:", total)
