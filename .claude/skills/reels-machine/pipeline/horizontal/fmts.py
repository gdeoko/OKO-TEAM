# media formats. spec: (shape, x,y,w,h, him, zoom)
#   shape 'full'=fills frame; 'feather'=big center dissolving edges; else a masked shape.
#   him: blurall|sideL|sideR|none ;  zoom: 0 none,1 in,2 out,3 pan-right,4 pan-left (full only)
SHAPES={
 'circleC':   ('circle',       460, 20,1000,1000,'blurall',1),
 'hexC':      ('hexagon',      450, 20,1020,1020,'blurall',0),
 'ovalC':     ('oval',         280, 90,1360, 900,'blurall',1),
 'diamondC':  ('diamond',      460, 10,1060,1060,'blurall',0),
 'archC':     ('arch',         520, 30, 880,1000,'blurall',0),
 'pentagonC': ('pentagon',     460, 20,1000,1000,'blurall',0),
 'roundsqC':  ('roundsquare',  440, 20,1040,1040,'blurall',0),
 'rrectR':    ('rrect',        950,240, 900, 600,'sideL',  0),
 'rrectL':    ('rrect',         70,240, 900, 600,'sideR',  0),
 'stripL':    ('strip',         70, 45, 540, 990,'sideR',  0),
 'stripR':    ('strip',       1310, 45, 540, 990,'sideL',  0),
 'bandTop':   ('band',          80, 70,1760, 380,'none',   0),
 'bandBot':   ('band',          80,630,1760, 380,'none',   0),
 'phoneR':    ('phone',       1240, 70, 440, 900,'sideL',  0),
 'phoneC':    ('phone',        720, 50, 480, 980,'blurall',0),
 'tiltL':     ('tilt',          80,190,1000, 680,'sideR',  0),
 'tiltR':     ('tilt',         840,190,1000, 680,'sideL',  0),
 'tvC':       ('tv',           300,120,1320, 850,'blurall',1),
 'parallelR': ('parallelogram',900,230, 960, 620,'sideL',  0),
 'hexR':      ('hexagon',     1080,150, 780, 780,'sideL',  0),
 'circleL':   ('circle',        80,170, 740, 740,'sideR',  0),
 'featherC':  ('feather',      260,146,1400, 788,'blurall',1),
 'smallBR':   ('smallcircle', 1440,610, 420, 420,'none',   0),
 # fullscreen stock variants (impactful full-frame footage, subtly different motion)
 'FSa':       ('full', 0,0,1920,1080,'none',1),   # slow zoom-in
 'FSb':       ('full', 0,0,1920,1080,'none',2),   # slow zoom-out
 'FSc':       ('full', 0,0,1920,1080,'none',3),   # slow pan
 'FSd':       ('full', 0,0,1920,1080,'none',4),   # slow pan other way
}
# 7 photos -> premium distinct shapes
PHOTO_ORDER=['circleC','hexC','ovalC','diamondC','archC','pentagonC','roundsqC']
# 17 stocks -> MIX of fullscreen (~7) and distinct shapes, interleaved, no adjacent repeat of shape-type
STOCK_ORDER=['FSa','rrectR','FSb','stripL','phoneR','FSc','bandTop','tiltL','FSd',
             'tvC','parallelR','FSa','stripR','bandBot','FSb','phoneC','tiltR']
