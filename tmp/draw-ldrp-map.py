import json, math, html
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
D=json.loads(Path('output/maps/ldrp-layout-data.json').read_text(encoding='utf-8'))
W,H=2240,1490
im=Image.new('RGB',(W,H),'#f5f4ec');dr=ImageDraw.Draw(im)
svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><rect width="100%" height="100%" fill="#f5f4ec"/>']
fonts={}
def font(size,bold=False):
 k=(size,bold)
 if k not in fonts:fonts[k]=ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf' if bold else 'C:/Windows/Fonts/segoeui.ttf',size)
 return fonts[k]
def text(x,y,t,size=18,fill='#233c35',bold=False,anchor='la'):
 dr.text((x,y),t,font=font(size,bold),fill=fill,anchor=anchor)
 align='middle' if anchor.startswith('m') else 'start'
 svg.append(f'<text x="{x}" y="{y+size*.78}" font-family="Segoe UI,Arial,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{fill}" text-anchor="{align}">{html.escape(str(t))}</text>')
def line(points,fill,width=2):
 dr.line(points,fill=fill,width=width,joint='curve');svg.append(f'<polyline points="{" ".join(f"{x:.1f},{y:.1f}" for x,y in points)}" fill="none" stroke="{fill}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"/>')
def poly(points,fill,outline=None,width=2):
 dr.polygon(points,fill=fill)
 svg.append(f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x,y in points)}" fill="{fill}"/>')
 if outline:line(points+[points[0]],outline,width)
def rect(box,fill,outline=None,width=2):
 x0,y0,x1,y1=box;poly([(x0,y0),(x1,y0),(x1,y1),(x0,y1)],fill,outline,width)
def ellipse(box,fill,outline=None,width=2):
 dr.ellipse(box,fill=fill,outline=outline,width=width)
 x0,y0,x1,y1=box;svg.append(f'<ellipse cx="{(x0+x1)/2}" cy="{(y0+y1)/2}" rx="{(x1-x0)/2}" ry="{(y1-y0)/2}" fill="{fill}" stroke="{outline or fill}" stroke-width="{width}"/>')
S=2.08; X=80;Y=265
P=lambda x,y:(X+(x+330)*S,Y+(y+68)*S)
photo=lambda p:(p[0]/.55+215,p[1]/.55+28)
mp=lambda p:P(*photo(p))
def shape(p,fill,stroke=None,w=2):
 if len(p)>=3:poly([mp(q) for q in p],fill,stroke,w)
def route(points,width,color):line([mp(q) for q in points],color,max(1,round(width/.55*S)))
def marker(n,x,y,color='#23554a'):
 px,py=P(x,y);ellipse((px-15,py-15,px+15,py+15),'#fff',color,2);text(px,py-11,str(n),17,color,True,'ma')
def note(x,y,t,size=15,bold=False):text(*P(x,y),t,size,'#3b5147',bold)
def photo_rect(r,fill,outline='#81928b'):
 a,b,c,d=r;poly([P(a,b),P(c,b),P(c,d),P(a,d)],fill,outline,2)
text(70,38,'LDRP CAMPUS',44,bold=True)
text(72,99,'2D LOCATION GUIDE  /  ANNOTATION REVISION / CURRENT GAME LAYOUT',18,fill='#688275',bold=True)
text(72,138,'College, hostels, gardens, parking, gate and KH-5 stalls — traced from the game geometry.',19)
text(72,170,'Approximate reference layout, not a surveyed real-world map. Road No. 5 is at the top; this view is not north-up.',16,fill='#7b8177')
rect((65,222,2175,1006),'#e8eddf','#d1d9c8',2)
# Public corridor and KH-5 circle: a schematic street strip on the actual stall anchors.
line([P(-330,-7),P(650,-7)],'#676e6b',48)
line([P(-330,-7),P(650,-7)],'#adb69f',7)
line([P(-330,-7),P(650,-7)],'#f8f7e7',2)
cx,cy=P(*D['circle']);ellipse((cx-42,cy-42,cx+42,cy+42),'#676e6b','#f3f3e4',3);ellipse((cx-23,cy-23,cx+23,cy+23),'#7ca878','#e4edd6',2)
text(cx,cy-70,'KH-5 CIRCLE',15,bold=True,anchor='ma')
note(365,-22,'ROAD NO. 5',16,True)
# Campus, paved areas, internal black-line drives.
shape(D['CAMPUS_BOUNDARY'],'#dce4d1','#3574c5',5)
for key in ['GATE_FORECOURT','BUS_DEPOT','WEST_BUS_PARK','WEST_JUNCTION']:
 shape(D[key],'#c7c8ba','#aeb5a4')
shape(D['HOSTEL_YARD'],'#c7c8ba','#b3b7aa',1)
for path in D['CAMPUS_DRIVES']:
 route(path['points'],path['width']+1.1,'#faf7e9');route(path['points'],path['width'],'#777b73')
for path in D['GARDEN_PATHS']:route(path['points'],path['width'],'#e0ccb0')
route(D['GARDEN_PROMENADE']['points'],4.4,'#e0ccb0')
for p in D['FOUR_GARDENS']:shape(p,'#86b66c','#5f985d')
# Main crescent and four courtyard wings, matching the model builder.
def arc(rx,ry,n=100):return [(211+rx*math.cos(i*math.pi/n),50+ry*math.sin(i*math.pi/n)) for i in range(n+1)]
poly([P(*q) for q in arc(112,101)+list(reversed(arc(88,78)))],'#d3d5d2','#7d9494',2)
for a in [math.pi/8,3*math.pi/8,5*math.pi/8,7*math.pi/8]:
 base=(211+109*math.cos(a),50+98*math.sin(a));side=(-math.sin(a),math.cos(a));direction=(math.cos(a),math.sin(a))
 def wing(x0,x1,z0,z1):return [P(base[0]+side[0]*x+direction[0]*z,base[1]+side[1]*x+direction[1]*z) for x,z in [(x0,z0),(x1,z0),(x1,z1),(x0,z1)]]
 for r in [(-24,24,0,11),(-24,-12,11,46),(12,24,11,46),(-12,12,35,46)]:poly(wing(*r),'#d3d5d2','#7d9494',2)
 poly(wing(-12,12,11,35),'#b0c4a0','#889d88',1)
for link in D.get('ACADEMIC_LINKS',[]):shape(link,'#d3d5d2','#7d9494',2)
for b in D['CAMPUS_BLOCKS']:
 if b['id']=='social-work':continue
 r=b['rect'];fill='#decdb1' if 'hostel' in b['id'] else '#c8d5d3';photo_rect(r,fill)
 if b.get('court'):
  a,z,c,d=r;photo_rect([a+11,z+11,c-11,d-11],'#c9c8bd' if 'hostel' in b['id'] else '#a8bc96','#8fa48e')
for letter,x,y in [('A',532,162),('B',420,162),('C',510,49),('D',266,252),('E',589,56)]:text(*P(x,y),letter,21,'#34544d',True)
# Parking strips.
shape(D['INSIDE_PARKING'],'#e6c778','#a78c46')
shape(D['OUTSIDE_PARKING'],'#e6c778','#a78c46')
shape([[ (x-215)*.55,(y-28)*.55] for x,y in [[243,-2],[610,-5],[610,12],[243,15]]],'#e6c778','#a78c46')
for x in range(255,600,16):line([P(x,1),P(x,12)],'#f9edbc',2)
for x in range(418,484,7):line([P(x,130),P(x,138)],'#fff0c3',2)
# Gate/cabin and the two inside shops, exact local-metre anchors converted to reference pixels.
photo_rect([193,25,236,31],'#3b535b','#234249');photo_rect([212,29,218,35],'#52696b')
for key in ['stationery','garage']:
 shop=D['CAMPUS_SHOPS'][key];u,v=shop['c'];w,d=shop['w'],shop['d'];shape([[u-w/2,v-d/2],[u+w/2,v-d/2],[u+w/2,v+d/2],[u-w/2,v+d/2]],'#be9680','#875e4f')
# Flag and ATM.
fx,fy=mp(D['FLAG_POINT']);line([(fx,fy+12),(fx,fy-17)],'#345c45',3);rect((fx,fy-17,fx+15,fy-10),'#e5a756');rect((fx,fy-10,fx+15,fy-4),'#f5f3e8');rect((fx,fy-4,fx+15,fy+2),'#639d65')
# Campus labels use number keys so small buildings stay unobscured.
markers=[(1,215,20),(2,215,37),(3,244,22),(4,158,30),(5,133,31),(6,183,83),(7,237,85),(8,211,139),(9,132,109),('1*',33,208),('M',55,208),('P',450,134),(12,176,192),(13,204,262),(14,450,185),(15,561,187),(16,450,86),(17,537,84),('3*',599,70),('4*',599,114),('2*',523,134),('S',87,262),(19,72,41),(20,360,7)]
for n,x,y in markers:marker(n,x,y)
# A-H store locations come directly from marketPoint -> campus frame conversion.
for i,shop in enumerate(D['shops']):
 x,y=shop['photo'];px,py=P(x,y);rect((px-16,py-12,px+16,py+12),'#c88652','#81532d');text(px,py-10,chr(65+i),16,'#fff9e9',True,'ma')
# Boundary label and local-road legend on the image.
line([P(350,281),P(610,281)],'#3574c5',4);note(350,287,'BLUE LINE = CAMPUS BOUNDARY',12,True)
# Numbered guide in 4 balanced columns.
text(73,1032,'CAMPUS KEY',22,bold=True)
entries=[('1','Single main gate'),('2','Security cabin / gate garden'),('3',"Paaji's register desk"),('4','Stationery / Xerox shop'),('5','Bike repair garage'),('6','Four student gardens'),('7','Tall Indian flag'),('8','Curved main college building'),('9','Kalupur Bank ATM'),('1*','Canteen · ground floor / black strip'),('P','Inside two-wheeler parking'),('12','MIPLVP Social Work wing'),('13','Hostel D Wing (right-hand block)'),('14','Boys Hostel Wing B'),('15','Hostel A Wing'),('16','LDRP academic block'),('17','Hostel C Wing'),('4*','Faculty residences (not a hostel)'),('19','West bus parking / metro side'),('20','Outside parking along Road 5'),('2*','Premium guest house · 3 floors'),('3*','Hostel E Wing'),('S','Three small houses beside D Wing'),('M','Mechanical building · ground + 3')]
for idx,(n,label) in enumerate(entries):
 col=idx//6;row=idx%6;x=76+col*537;y=1078+row*34
 ellipse((x,y,x+25,y+25),'#fff','#426b59',2);text(x+12.5,y+1,n,14,'#365b48',True,'ma');text(x+36,y+1,label,17)
line([(74,1291),(2165,1291)],'#d3dcca',2)
text(74,1310,'STREET STALLS  /  A–H',20,bold=True)
stalls=[('A','Babu Chhole Kulche'),('B','Anjali Pav-Bhaji'),('C','Lalbhai ni Bethak'),('D','Natu Desi Adda'),('E','Masi ni Cha'),('F','Sarpanch ni Cha'),('G','Patel ni Cha (tempo)'),('H','Ajit no Gallo')]
for i,(letter,name) in enumerate(stalls):
 x=76+(i%4)*537;y=1356+(i//4)*39
 rect((x,y,x+25,y+25),'#c88652');text(x+12.5,y+1,letter,14,'#fff9e9',True,'ma');text(x+36,y+1,name,17)
text(74,1454,'Source: current LDRP reference geometry. The external Road 5 corridor is schematic; building/stall anchors follow the game code.',14,fill='#7b8177')
svg.append('</svg>')
Path('output/maps/ldrp-campus-map.svg').write_text('\n'.join(svg),encoding='utf-8')
im.save('output/maps/ldrp-campus-map.png')
print('Created output/maps/ldrp-campus-map.png and .svg')
