#!/usr/bin/env python3
"""
Tappio · Lead Magnet PDF Generator
Generates 4 branded PDFs: spy, brain, tape, bundle.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, Color
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.pdfgen import canvas
import os

OUT_DIR = '/home/claude/backend/lead-magnets'
os.makedirs(OUT_DIR, exist_ok=True)

# ═══════════ COLORS ═══════════
DARK_BG    = HexColor('#06060a')
CARD_BG    = HexColor('#10131c')
TEXT_MAIN  = HexColor('#ffffff')
TEXT_MUTED = HexColor('#9c9ca6')
ACCENT_CYAN   = HexColor('#00D9FF')
ACCENT_PURPLE = HexColor('#C77DFF')
ACCENT_GOLD   = HexColor('#F4C430')

# ═══════════ STYLE BUILDER ═══════════
def make_styles(accent_hex):
    accent = HexColor(accent_hex)
    base = getSampleStyleSheet()
    styles = {
        'brand': ParagraphStyle('brand', parent=base['Normal'],
            fontName='Helvetica-Bold', fontSize=24, textColor=TEXT_MAIN,
            alignment=TA_CENTER, spaceAfter=4, leading=28, letterSpacing=3),
        'brand_sub': ParagraphStyle('brand_sub', parent=base['Normal'],
            fontName='Helvetica', fontSize=8, textColor=accent,
            alignment=TA_CENTER, spaceAfter=24, leading=10, letterSpacing=2),
        'h1': ParagraphStyle('h1', parent=base['Heading1'],
            fontName='Helvetica-Bold', fontSize=26, textColor=TEXT_MAIN,
            alignment=TA_LEFT, spaceBefore=12, spaceAfter=10, leading=32),
        'h2': ParagraphStyle('h2', parent=base['Heading2'],
            fontName='Helvetica-Bold', fontSize=15, textColor=accent,
            alignment=TA_LEFT, spaceBefore=18, spaceAfter=8, leading=20),
        'badge': ParagraphStyle('badge', parent=base['Normal'],
            fontName='Helvetica-Bold', fontSize=9, textColor=accent,
            alignment=TA_LEFT, spaceAfter=4, leading=12, letterSpacing=2),
        'body': ParagraphStyle('body', parent=base['Normal'],
            fontName='Helvetica', fontSize=11, textColor=TEXT_MAIN,
            alignment=TA_LEFT, spaceAfter=10, leading=17),
        'muted': ParagraphStyle('muted', parent=base['Normal'],
            fontName='Helvetica', fontSize=10, textColor=TEXT_MUTED,
            alignment=TA_LEFT, spaceAfter=8, leading=15),
        'callout': ParagraphStyle('callout', parent=base['Normal'],
            fontName='Helvetica-Oblique', fontSize=11, textColor=TEXT_MAIN,
            alignment=TA_LEFT, spaceAfter=12, leading=17,
            leftIndent=14, borderPadding=12, backColor=HexColor('#10131c'),
            borderColor=accent, borderWidth=0),
        'footer': ParagraphStyle('footer', parent=base['Normal'],
            fontName='Helvetica', fontSize=8, textColor=TEXT_MUTED,
            alignment=TA_CENTER, leading=11),
        'cta': ParagraphStyle('cta', parent=base['Normal'],
            fontName='Helvetica-Bold', fontSize=12, textColor=accent,
            alignment=TA_CENTER, spaceBefore=14, leading=18),
    }
    return styles, accent

# ═══════════ PAGE DECORATIONS ═══════════
def make_page_bg(accent_hex):
    """Returns a function that draws the dark bg + accent stripe on each page."""
    accent = HexColor(accent_hex)
    def draw(canv, doc):
        w, h = A4
        # full dark background
        canv.setFillColor(DARK_BG)
        canv.rect(0, 0, w, h, fill=1, stroke=0)
        # accent stripe top
        canv.setFillColor(accent)
        canv.rect(0, h - 4, w, 4, fill=1, stroke=0)
        # small accent corner
        canv.setFillColor(accent)
        canv.rect(20*mm, h - 18*mm, 6, 6, fill=1, stroke=0)
        # footer page number
        canv.setFillColor(TEXT_MUTED)
        canv.setFont('Helvetica', 8)
        canv.drawCentredString(w/2, 12*mm, f'Tappio  ·  tappio.app  ·  Page {doc.page}')
    return draw

# ═══════════ COMMON HEADER ═══════════
def header_block(brand_color):
    return [
        Paragraph(f'<font color="white">TAPP</font><font color="{brand_color}">IO</font>', _get_brand_style()),
        Paragraph('3 APPS  ·  BUILT FOR IPHONE', _get_brand_sub_style(brand_color)),
        Spacer(1, 4*mm),
    ]

def _get_brand_style():
    return ParagraphStyle('brand', fontName='Helvetica-Bold', fontSize=22, textColor=TEXT_MAIN,
        alignment=TA_CENTER, leading=26)

def _get_brand_sub_style(color):
    return ParagraphStyle('brand_sub', fontName='Helvetica-Bold', fontSize=8,
        textColor=HexColor(color), alignment=TA_CENTER, leading=14)


# ═══════════ PDF #1 · SPY ═══════════
def build_spy():
    fn = os.path.join(OUT_DIR, 'spy-airbnb-hidden-cameras.pdf')
    doc = SimpleDocTemplate(fn, pagesize=A4,
        leftMargin=22*mm, rightMargin=22*mm,
        topMargin=24*mm, bottomMargin=22*mm,
        title='Tappio — 5 Places Hidden Cameras Hide in Airbnbs')
    styles, accent = make_styles('#00D9FF')
    s = []

    s += header_block('#00D9FF')
    s.append(Paragraph('PRIVACY GUIDE', styles['badge']))
    s.append(Paragraph('5 Places Hidden Cameras Hide in Airbnbs', styles['h1']))
    s.append(Paragraph('A practical 12-second checklist for every traveler. Read once, use everywhere you stay.', styles['muted']))
    s.append(Spacer(1, 8*mm))

    s.append(Paragraph('Why this matters', styles['h2']))
    s.append(Paragraph(
        'Hidden cameras in short-term rentals aren\'t rare. They get found regularly in Airbnbs, '
        'hotel rooms, and vacation properties. Hosts hide them in everyday objects so they blend in. '
        'Spending 12 seconds checking on arrival is the cheapest privacy insurance available.',
        styles['body']))

    s.append(Paragraph('The 5 most common hiding spots', styles['h2']))

    spots = [
        ('01  ·  Smoke detectors and CO alarms',
         'The most common spot. A real smoke detector has one lens (the test light). '
         'If you see two, or a tiny extra circle pointing into the room — that\'s a camera. '
         'Detectors normally point straight down, not at the bed.'),
        ('02  ·  Alarm clocks and USB chargers',
         'Cheap "spy clocks" sold on Amazon look exactly like normal radios. '
         'The lens is usually a black pinhole on the face. USB-charger cameras hide the lens '
         'on the side near the prongs. Unplug it — if power runs through it when nothing\'s charging, suspicious.'),
        ('03  ·  Mirrors (two-way)',
         'The flashlight test: hold a flashlight against the mirror. A real mirror reflects the beam '
         'and shows a thick gap between glass and image. A two-way mirror lets the beam pass through '
         'and reveals what\'s behind. Better: use the magnetic detector — electronics behind the mirror produce a field.'),
        ('04  ·  Air vents, fans, and AC',
         'Cameras get embedded in vent grilles and fan housings. The lens points downward through the slats. '
         'Look for a tiny dot, slightly darker than the rest of the slat. Move the air filter aside if you can.'),
        ('05  ·  Books, plants, and decor',
         'Hollowed-out books on a shelf, fake plants, picture frames. If something is positioned with a '
         'perfect line of sight to the bed or shower — that\'s the cue. Books that don\'t belong on a vacation-rental shelf.'),
    ]
    for title, body in spots:
        s.append(Paragraph(title, styles['h2']))
        s.append(Paragraph(body, styles['body']))

    s.append(PageBreak())
    s += header_block('#00D9FF')
    s.append(Paragraph('THE 12-SECOND CHECK', styles['badge']))
    s.append(Paragraph('Use this every time you arrive', styles['h1']))
    s.append(Spacer(1, 4*mm))

    steps = [
        '1.  Open Spy Camera Finder. Tap Start Full Scan.',
        '2.  Wi-Fi sweep flags unknown devices on the local network.',
        '3.  Bluetooth radar picks up nearby BLE trackers and beacons.',
        '4.  Magnetic field detector finds electronics behind walls/mirrors.',
        '5.  Infrared filter reveals night-vision lenses invisible to the eye.',
        '6.  Walk the room slowly while the app scans. Watch for spikes near vents, mirrors, alarm clocks.',
        '7.  If something flags — photograph it, contact the platform (Airbnb/host), request a full refund.',
    ]
    for st in steps:
        s.append(Paragraph(st, styles['body']))

    s.append(Spacer(1, 10*mm))
    s.append(Paragraph('What to do if you find something', styles['h2']))
    s.append(Paragraph(
        'Don\'t touch it or move it. Photograph the device and its location. '
        'Contact the platform support immediately (Airbnb has a 24/7 Trust line). '
        'Most platforms refund the entire booking and may issue travel credit. '
        'Local police can also be involved if the device was actively recording.',
        styles['body']))

    s.append(Paragraph('Get Spy Camera Finder', styles['cta']))
    s.append(Paragraph('apps.apple.com/us/app/spy-camera-finder-scanner/id6760315795', styles['footer']))

    doc.build(s, onFirstPage=make_page_bg('#00D9FF'), onLaterPages=make_page_bg('#00D9FF'))
    print(f'✓ {fn} ({os.path.getsize(fn)} bytes)')


# ═══════════ PDF #2 · BRAIN ═══════════
def build_brain():
    fn = os.path.join(OUT_DIR, 'brain-7day-starter-plan.pdf')
    doc = SimpleDocTemplate(fn, pagesize=A4,
        leftMargin=22*mm, rightMargin=22*mm,
        topMargin=24*mm, bottomMargin=22*mm,
        title='Tappio — 7-Day Brain Workout Starter Plan')
    styles, accent = make_styles('#C77DFF')
    s = []
    s += header_block('#C77DFF')
    s.append(Paragraph('BRAIN TRAINING', styles['badge']))
    s.append(Paragraph('7-Day Brain Workout Starter Plan', styles['h1']))
    s.append(Paragraph('Ten minutes a day. Real improvement in two weeks. Here\'s how to start the right way.', styles['muted']))
    s.append(Spacer(1, 6*mm))

    s.append(Paragraph('How this works', styles['h2']))
    s.append(Paragraph(
        'The brain responds to focused, varied training the same way muscles respond to varied workouts. '
        'You don\'t do bicep curls every day; you cycle through different exercises. '
        'Same logic for cognition: 7 days, 4 categories, building difficulty.', styles['body']))

    s.append(Paragraph('The 7-day schedule', styles['h2']))

    days = [
        ('Day 1  ·  Memory baseline',
         'Open Brainova. Take the Brain Score test. Don\'t train, just measure. Write down your number.'),
        ('Day 2  ·  Memory focus',
         '10 minutes in the Memory category. Start with shorter patterns; build up. Aim to clear 5 rounds.'),
        ('Day 3  ·  Mental math',
         '10 minutes Speed Math. Quick equations, multiple choice. Don\'t worry about wrong answers — speed comes from familiarity.'),
        ('Day 4  ·  Mixed session',
         '5 min Memory + 5 min Math. The category-switch is part of the workout — context-switching is its own skill.'),
        ('Day 5  ·  Attention',
         '10 minutes Attention drills. The "tap green, ignore red" type. Don\'t multitask, this only works with full focus.'),
        ('Day 6  ·  Logic',
         '10 minutes Logic puzzles. Connect-the-dots, path-finding, sequence completion. This is where IQ-style training lives.'),
        ('Day 7  ·  Retest',
         'Take the Brain Score test again. Compare to Day 1. Most people gain 5-15 points in their first week.'),
    ]
    for title, body in days:
        s.append(Paragraph(title, styles['h2']))
        s.append(Paragraph(body, styles['body']))

    s.append(PageBreak())
    s += header_block('#C77DFF')
    s.append(Paragraph('THE 3 HABITS', styles['badge']))
    s.append(Paragraph('That double your improvement rate', styles['h1']))
    s.append(Spacer(1, 4*mm))

    habits = [
        ('Same time, every day',
         'The brain locks in routines. If you train at 8 AM with coffee, train at 8 AM every day. '
         'You stop thinking about whether to do it. The session just happens.'),
        ('Quality over quantity',
         '10 focused minutes beats 30 distracted minutes. Phone on Do Not Disturb. '
         'No music with lyrics. Don\'t mix in social-media checks.'),
        ('Track the Brain Score weekly, not daily',
         'Daily score has noise (sleep, stress, hydration). Compare your Week 1 score to Week 4. '
         'That trend is the real signal.'),
    ]
    for title, body in habits:
        s.append(Paragraph(title, styles['h2']))
        s.append(Paragraph(body, styles['body']))

    s.append(Paragraph('What to expect', styles['h2']))
    s.append(Paragraph(
        'Week 1: Mostly familiarisation. Score may dip slightly as you tackle real difficulty.<br/>'
        'Week 2: First real gains, especially in Memory and Math.<br/>'
        'Week 3: Attention starts catching up. You\'ll notice it at work too.<br/>'
        'Week 4+: Compound effect. Most users settle 15-25 points above their starting baseline.', styles['body']))

    s.append(Paragraph('Get Brainova', styles['cta']))
    s.append(Paragraph('apps.apple.com/us/app/brainova-daily-mind-workout/id6759396840', styles['footer']))

    doc.build(s, onFirstPage=make_page_bg('#C77DFF'), onLaterPages=make_page_bg('#C77DFF'))
    print(f'✓ {fn} ({os.path.getsize(fn)} bytes)')


# ═══════════ PDF #3 · TAPE ═══════════
def build_tape():
    fn = os.path.join(OUT_DIR, 'tape-furniture-checklist.pdf')
    doc = SimpleDocTemplate(fn, pagesize=A4,
        leftMargin=22*mm, rightMargin=22*mm,
        topMargin=24*mm, bottomMargin=22*mm,
        title='Tappio — Furniture Measurement Checklist')
    styles, accent = make_styles('#F4C430')
    s = []
    s += header_block('#F4C430')
    s.append(Paragraph('MEASUREMENT CHECKLIST', styles['badge']))
    s.append(Paragraph('Furniture Measurement Checklist', styles['h1']))
    s.append(Paragraph('Before any IKEA, Wayfair, Home Depot or Pottery Barn trip — measure these.', styles['muted']))
    s.append(Spacer(1, 6*mm))

    s.append(Paragraph('Why measure first', styles['h2']))
    s.append(Paragraph(
        'Wrong-size furniture returns cost an average of $80-150 per item. Renovation rework when '
        'measurements are off: $400-900. Five minutes with 3D Tape Measure prevents all of it.', styles['body']))

    s.append(Paragraph('The 9 measurements you must check', styles['h2']))
    rows = [
        ('01', 'Room width (longest wall)', 'Use Line mode. The wall that determines major furniture placement.'),
        ('02', 'Room depth', 'Perpendicular to width. Together they give you total floor area.'),
        ('03', 'Ceiling height', 'Crucial for tall items: bookshelves, wardrobes, headboards.'),
        ('04', 'Floor area (Polygon mode)', 'For L-shaped or irregular rooms. Gives total area instantly.'),
        ('05', 'Door width (clear opening)', 'Will the sofa fit through? Measure inside-edge to inside-edge of the frame.'),
        ('06', 'Hallway width', 'Narrowest point along the path from front door to room.'),
        ('07', 'Elevator dimensions', 'If you\'re above ground floor — width, depth, diagonal.'),
        ('08', 'Window width and height', 'For curtains, blinds, and to know where to NOT place furniture.'),
        ('09', 'Power outlet positions', 'Note distance from corners. Saves you from buying a TV stand that blocks the only socket.'),
    ]
    for num, label, body in rows:
        s.append(Paragraph(f'<b>{num}  ·  {label}</b>', styles['h2']))
        s.append(Paragraph(body, styles['body']))

    s.append(PageBreak())
    s += header_block('#F4C430')
    s.append(Paragraph('THE WORKFLOW', styles['badge']))
    s.append(Paragraph('5 minutes, project saved, no errors', styles['h1']))
    s.append(Spacer(1, 4*mm))

    flow = [
        ('1. Open 3D Tape Measure and create a new project', 'Name it after the room (e.g., "Living Room — Sept").'),
        ('2. Walk the room and measure all 9 items above', 'Use Line for distances, Rectangle for surfaces, Polygon for the floor.'),
        ('3. Export as PDF', 'You now have a one-page reference you can show to a salesperson or contractor.'),
        ('4. Take the PDF to the store', 'No more guessing. No more wrong-size returns.'),
        ('5. Keep the project file', 'Reuse it for the next purchase. Replace measurements if you renovate later.'),
    ]
    for title, body in flow:
        s.append(Paragraph(title, styles['h2']))
        s.append(Paragraph(body, styles['body']))

    s.append(Paragraph('The "Will it fit through?" math', styles['h2']))
    s.append(Paragraph(
        'A common trap: the item fits the room but won\'t fit through the door. For doorways, the rule is: '
        'sofa depth + an extra 5-10 cm clearance should be less than door width. For diagonal carry-in '
        '(when you have to angle furniture through), use the formula: '
        'diagonal length = √(length² + depth²). 3D Tape Measure does this automatically when you switch to Rectangle mode.', styles['body']))

    s.append(Paragraph('Get 3D Tape Measure', styles['cta']))
    s.append(Paragraph('apps.apple.com/us/app/3d-tape-measure/id6755061647', styles['footer']))

    doc.build(s, onFirstPage=make_page_bg('#F4C430'), onLaterPages=make_page_bg('#F4C430'))
    print(f'✓ {fn} ({os.path.getsize(fn)} bytes)')


# ═══════════ PDF #4 · BUNDLE ═══════════
def build_bundle():
    fn = os.path.join(OUT_DIR, 'tappio-starter-bundle.pdf')
    doc = SimpleDocTemplate(fn, pagesize=A4,
        leftMargin=22*mm, rightMargin=22*mm,
        topMargin=24*mm, bottomMargin=22*mm,
        title='Tappio — Starter Bundle')
    styles, accent = make_styles('#00D9FF')
    s = []
    s += header_block('#00D9FF')
    s.append(Paragraph('STARTER BUNDLE', styles['badge']))
    s.append(Paragraph('Tappio — All 3 in One Guide', styles['h1']))
    s.append(Paragraph('Three iPhone apps for three different problems. Here\'s how to use each one effectively.', styles['muted']))
    s.append(Spacer(1, 6*mm))

    s.append(Paragraph('Spy Camera Finder', ParagraphStyle('h2cyan', parent=styles['h2'], textColor=ACCENT_CYAN)))
    s.append(Paragraph(
        '<b>When to use:</b> Every time you check into a hotel or Airbnb. Once at home as a baseline scan.<br/>'
        '<b>How long:</b> 12 seconds per scan.<br/>'
        '<b>Key feature:</b> 4 detection methods at once (Wi-Fi + Bluetooth + Magnetic + Infrared).<br/>'
        '<b>Free tier:</b> Includes daily scans. Premium = unlimited.<br/>'
        '<b>App Store:</b> apps.apple.com/us/app/id6760315795', styles['body']))

    s.append(Paragraph('Brainova', ParagraphStyle('h2purple', parent=styles['h2'], textColor=ACCENT_PURPLE)))
    s.append(Paragraph(
        '<b>When to use:</b> 10 minutes a day, same time every day. Morning works best for most people.<br/>'
        '<b>How long:</b> 10 min per session.<br/>'
        '<b>Key feature:</b> Adaptive difficulty + Brain Score tracking across Memory, Math, Attention, Logic.<br/>'
        '<b>Free tier:</b> Daily sessions. Premium = unlimited + advanced challenges.<br/>'
        '<b>App Store:</b> apps.apple.com/us/app/id6759396840', styles['body']))

    s.append(Paragraph('3D Tape Measure', ParagraphStyle('h2gold', parent=styles['h2'], textColor=ACCENT_GOLD)))
    s.append(Paragraph(
        '<b>When to use:</b> Before any furniture purchase. Before any renovation quote. When you need a measurement and no tape.<br/>'
        '<b>How long:</b> Seconds per measurement.<br/>'
        '<b>Key feature:</b> 3 modes (Line, Rectangle, Polygon) + LiDAR support on Pro models + PDF export.<br/>'
        '<b>Free tier:</b> Core measurement. Premium = unlimited saves + PDF export.<br/>'
        '<b>App Store:</b> apps.apple.com/us/app/id6755061647', styles['body']))

    s.append(PageBreak())
    s += header_block('#00D9FF')
    s.append(Paragraph('WHICH APP FIRST?', styles['badge']))
    s.append(Paragraph('A quick decision tree', styles['h1']))
    s.append(Spacer(1, 4*mm))

    tree = [
        ('Do you travel? (Airbnb, hotels, business trips)',
         '→ Install <b>Spy Camera Finder</b> first. Use on arrival.'),
        ('Do you work from home or feel scattered?',
         '→ Install <b>Brainova</b>. 10 minutes a day fixes attention faster than any productivity hack.'),
        ('Are you renovating, moving, or buying furniture this year?',
         '→ Install <b>3D Tape Measure</b>. Pays back the first time you avoid a wrong-size return.'),
        ('All three apply?',
         '→ Install all three. They handle different parts of your life — no overlap.'),
    ]
    for q, a in tree:
        s.append(Paragraph(q, styles['h2']))
        s.append(Paragraph(a, styles['body']))

    s.append(Paragraph('Common patterns from real users', styles['h2']))
    s.append(Paragraph(
        '• <b>Travelers</b> tend to start with Spy → add Brainova for long flights → eventually use Tape for home setup.<br/>'
        '• <b>Remote workers</b> start with Brainova → use Tape to optimise desk and home office.<br/>'
        '• <b>Homeowners</b> usually start with Tape → add Brainova → use Spy for occasional travel.', styles['body']))

    s.append(Paragraph('Open all three apps on iPhone', styles['cta']))
    s.append(Paragraph('tappio.app', styles['footer']))

    doc.build(s, onFirstPage=make_page_bg('#00D9FF'), onLaterPages=make_page_bg('#00D9FF'))
    print(f'✓ {fn} ({os.path.getsize(fn)} bytes)')


# ═══════════ RUN ═══════════
if __name__ == '__main__':
    print('Generating Tappio lead-magnet PDFs...\n')
    build_spy()
    build_brain()
    build_tape()
    build_bundle()
    print('\nDone.')
