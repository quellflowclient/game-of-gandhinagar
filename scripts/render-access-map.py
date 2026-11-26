"""Rasterize the exporter subset of SVG for shareable map previews (Pillow)."""
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

for name in ['ldrp-access-map', 'mahatma-access-map']:
    root = ET.parse(Path('output/maps') / (name + '.svg')).getroot()
    im = Image.new('RGB', (int(root.get('width')), int(root.get('height'))), 'white')
    d = ImageDraw.Draw(im)
    def color(s):
        return None if s in [None, 'none'] else s
    for e in root:
        tag = e.tag.split('}')[-1]
        a = e.attrib
        fill, stroke = color(a.get('fill')), color(a.get('stroke'))
        sw = max(1, round(float(a.get('stroke-width', 1))))
        if tag == 'rect':
            x, y, w, h = [float(a.get(k, 0)) for k in ['x', 'y', 'width', 'height']]
            d.rectangle((x, y, x+w, y+h), fill=fill, outline=stroke, width=sw)
        elif tag in ['polygon', 'polyline']:
            pts = [tuple(map(float, p.split(','))) for p in a['points'].split()]
            if tag == 'polygon':
                d.polygon(pts, fill=fill)
                pts = pts + [pts[0]]
            if stroke:
                if a.get('stroke-dasharray'):
                    pattern = list(map(float, a['stroke-dasharray'].split()))
                    index, remaining = 0, pattern[0]
                    for p, q in zip(pts, pts[1:]):
                        dx, dy = q[0]-p[0], q[1]-p[1]
                        length = (dx*dx+dy*dy)**.5
                        if not length:
                            continue
                        t = 0
                        while t < length:
                            end = min(length, t+remaining)
                            if index % 2 == 0:
                                d.line([(p[0]+dx*t/length,p[1]+dy*t/length),(p[0]+dx*end/length,p[1]+dy*end/length)],fill=stroke,width=sw)
                            remaining -= end-t
                            t = end
                            if remaining < .001:
                                index = (index+1) % len(pattern)
                                remaining = pattern[index]
                else:
                    d.line(pts, fill=stroke, width=sw, joint='curve')
        elif tag == 'circle':
            x, y, r = [float(a[k]) for k in ['cx', 'cy', 'r']]
            d.ellipse((x-r, y-r, x+r, y+r), fill=fill, outline=stroke, width=sw)
        elif tag == 'text':
            size = round(float(a.get('font-size', 14)))
            font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', size)
            d.text((float(a['x']), float(a['y'])), e.text or '', font=font, fill=fill or 'black', anchor='ms' if a.get('text-anchor')=='middle' else 'ls')
    im.save(Path('output/maps') / (name+'.png'))
    print(name, im.size)
