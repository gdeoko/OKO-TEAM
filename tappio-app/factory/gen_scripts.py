#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генератор сценариев для автопилота Tappio.
Пополняет scripts/queue/ детерминированно, БЕЗ LLM — чтобы контент-завод
работал 24/7 сам. Соблюдает DIVERSITY LAWS на уровне сценария:
 - каждый ролик берёт следующий неиспользованный "угол" (нарратив) из пула;
 - кадры/вставки/движения/типы инфографики ротируются без повторов внутри ролика;
 - запросы стоков ротируются между роликами (а сам билдер ещё и дедуп клипов делает);
 - музыка индивидуальна (варьируем queries).
Реальный дедуп футажа/музыки/SFX между роликами обеспечивает билдер (кэш+реестры).

Использование:
  python3 gen_scripts.py <N>      -> дописать в очередь N сценариев (по кругу app spy/brain/tape)
  python3 gen_scripts.py topup <MIN>  -> дозалить очередь до MIN файлов (по умолчанию 12)
Файлы: scripts/queue/g<app>_<seq>.json  ; состояние: gen_state.json (в git — кросс-сессионно).
"""
import json, os, sys, random, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
QUEUE = os.path.join(HERE, "scripts", "queue")
STATE = os.path.join(HERE, "gen_state.json")
os.makedirs(QUEUE, exist_ok=True)

INSERTS = ["circle", "hexagon", "phone", "tv", "tilt", "diamond", "rrect", "arch"]
MOTIONS = ["zin", "zout", "panr", "panl", "pandown", "panup"]
POS = ["center", "upper", "lower"]
# грейды, совместимые с брендом каждого app — варьируем, чтобы ролики не выглядели одинаково
GRADES = {
    "spy":   ["cold_cyan", "teal_orange", "clean_ad"],
    "brain": ["purple_dream", "teal_orange", "clean_ad"],
    "tape":  ["warm_gold", "clean_ad", "teal_orange"],
}
# все типы инфографики, которые умеет движок и под которые есть контент-пулы
ALL_OV_TYPES = ["kicker", "kinetic", "lowerthird", "chips", "bars", "gauge",
                "callout", "stat_count", "checklist", "ticker"]


def rng_for(rid):
    """Детерминированный, но «случайный» ГПСЧ на каждый ролик — стабилен между сессиями."""
    seed = int(hashlib.md5(rid.encode()).hexdigest()[:12], 16)
    return random.Random(seed)

# ------------------------------------------------------------------ БРЕНДЫ
BRAND = {
    "spy": dict(voice="en-US-AndrewNeural", rate="+6%", grade="cold_cyan",
                brand={"accent": "#00D9FF", "accent2": "#7CFCFF", "code": "PRIVACY",
                       "logo": "spy.png", "name": "SPY CAMERA FINDER"},
                music=["dark tension electronic", "cyber suspense pulse",
                       "cinematic underscore tech", "minimal techno tension",
                       "investigative documentary underscore", "neon night synth"],
                hashtags="#privacy #airbnb #travelsafety #hiddencamera #traveltips #hotelroom #safetytips"),
    "brain": dict(voice="en-US-BrianNeural", rate="+5%", grade="purple_dream",
                  brand={"accent": "#9B5DE5", "accent2": "#C9A7FF", "code": "FOCUS",
                         "logo": "brain.png", "name": "BRAINOVA"},
                  music=["uplifting focus ambient", "warm inspiring piano electronic",
                         "calm motivational underscore", "dreamy synth focus",
                         "gentle cinematic hope", "bright optimistic electronic"],
                  hashtags="#brainhealth #memory #focus #productivity #selfimprovement #mentalhealth #learning"),
    "tape": dict(voice="en-US-ChristopherNeural", rate="+6%", grade="warm_gold",
                 brand={"accent": "#F4C430", "accent2": "#FFE08A", "code": "MEASURE",
                        "logo": "tape.png", "name": "3D TAPE MEASURE"},
                 music=["upbeat indie acoustic diy", "positive corporate light groove",
                        "warm optimistic guitar", "happy ukulele diy", "bright pop home",
                        "cheerful folk clap"],
                 hashtags="#diy #homedecor #interiordesign #measure #movingtips #renter #apartmenttherapy"),
}

# ------------------------------------------------------------------ ПУЛЫ КАДРОВ (запросы Pexels)
SHOTQ = {
 "spy": ["hotel room modern interior","airbnb apartment cozy night","hand holding smartphone dark",
   "wifi router network dark tech","smoke detector ceiling closeup","tv on wall hotel room",
   "power outlet wall socket closeup","alarm clock nightstand bedroom","person entering hotel room luggage",
   "traveler suitcase hotel hallway","dark bedroom lamp light","phone flashlight scanning wall",
   "usb charger plug closeup","mirror bathroom hotel","air vent grille ceiling","picture frame on wall room",
   "woman looking around hotel room worried","laptop screen code green","security camera lens macro",
   "curtains window hotel evening","desk lamp table hotel","bookshelf decor living room",
   "door lock hotel keycard","surveillance concept eye lens","network cables server blue light",
   "person relaxing bed phone night","closet wardrobe hotel room","reflection glass light dot"],
 "brain": ["person thinking trying to remember","student studying desk lamp night","brain scan mri blue",
   "coffee cup morning desk","woman meditating calm light","man reading book focused","neurons synapse animation blue",
   "person forgetting keys frustrated","chess board close up thinking","puzzle pieces hands table",
   "elderly person smiling sharp mind","runner morning sunrise energy","notebook writing pen hand",
   "person doing crossword puzzle","glass of water healthy morning","yoga breathing calm room",
   "smartphone brain game screen","clock ticking time closeup","light bulb idea dark","group people names introduction",
   "sticky notes wall reminders","person sleeping rest night","walking park green trees","fish oil supplement pills",
   "focused eyes close up concentration","memory old photos hands","teacher classroom explaining"],
 "tape": ["person measuring living room with phone ar","empty living room wooden floor sunlight",
   "hand pointing phone at wall measuring","rolled up rug floor room","measuring tape metal bending closeup",
   "modern tv mounted on wall living room","hands arranging shelf wall decor","blueprint floor plan on tablet desk",
   "person relaxing on couch bright apartment","cozy furnished living room warm light","moving boxes new apartment",
   "furniture store showroom sofa","kitchen cabinets measuring renovation","curtains window measuring home",
   "carpenter measuring wood workshop","picture frame hanging wall level","bedroom bed frame assembly",
   "office desk setup measuring space","doorway measuring frame home","paint wall renovation room",
   "hands holding phone ar app screen","apartment tour empty rooms","bookshelf assembly instructions floor",
   "dining table room measure","garden patio outdoor measuring","closet organizer measuring wardrobe",
   "couple planning home layout tablet"],
}

# ------------------------------------------------------------------ УГЛЫ (нарративы). Каждый = уникальный ролик.
# Поля: kicker, top, big(\n), 6 сегментов текста, caption-idea, yt_title
ANGLES = {
 "spy": [
  dict(k="WI-FI SCAN", top="EVERY HIDDEN CAM", big="IS ON THE\nNETWORK",
     seg=["Checked into a rental? A hidden lens could be watching.",
          "Most spy cams need Wi-Fi. That is their weak spot.",
          "Open the app, scan the network in seconds.",
          "It flags every unknown device on that router.",
          "Then sweep the room: your camera catches the IR glint.",
          "One scan before you unpack. Peace of mind, instantly."],
     yt="Find hidden cameras with a Wi-Fi scan #shorts",
     cap="Checked into a rental? Hidden cams live on the Wi-Fi. Scan the network, flag every unknown device, then sweep for the IR glint."),
  dict(k="IR GLINT", top="THE LENS", big="ALWAYS\nGLOWS",
     seg=["Turn off the lights. Raise your phone camera.",
          "A hidden lens reflects infrared as a tiny bright dot.",
          "Slowly pan across mirrors, vents and smoke detectors.",
          "The app highlights suspicious reflections for you.",
          "Found one? Cover it and report the listing.",
          "Sixty seconds of scanning saves your privacy."],
     yt="Spot a hidden camera lens in the dark #shorts",
     cap="Lights off, camera up. A hidden lens glows in infrared. Pan across vents, mirrors and smoke detectors to catch the glint."),
  dict(k="TOP 5 SPOTS", top="WHERE CAMS", big="ALWAYS\nHIDE",
     seg=["Smoke detectors: the number one hiding spot.",
          "Alarm clocks pointed straight at the bed.",
          "Air vents with a suspicious little hole.",
          "TV frames and power outlets facing the room.",
          "Check each one: line of sight to the bed is the clue.",
          "Scan first, relax second. Every trip."],
     yt="Top 5 places hidden cameras hide #shorts",
     cap="Smoke detectors, alarm clocks, vents, TV frames, outlets — the five spots cams love. Check anything with a clear line of sight to the bed."),
  dict(k="CHECKOUT LIST", top="30-SECOND", big="ROOM\nSWEEP",
     seg=["New room? Run this thirty-second sweep first.",
          "One: scan the Wi-Fi for unknown devices.",
          "Two: kill the lights and pan for lens glints.",
          "Three: check anything aimed at the bed.",
          "Four: unplug what you can't explain.",
          "Do it once, then actually relax."],
     yt="30-second hidden camera room sweep #shorts",
     cap="Every new room deserves a 30-second sweep: scan the Wi-Fi, kill the lights, pan for glints, check the bed sight-lines, unplug the unknowns."),
  dict(k="TRUE STORY", top="THEY FOUND", big="A CAM IN\nTHE VENT",
     seg=["A traveler felt watched in a quiet rental.",
          "She scanned the Wi-Fi and saw a strange device.",
          "The app traced it to the air vent by the bed.",
          "Behind the grille: a pinhole camera, recording.",
          "One scan turned a creepy feeling into proof.",
          "Trust the tech, not just the vibe."],
     yt="She found a hidden camera in the vent #shorts",
     cap="A traveler felt watched. One Wi-Fi scan traced a strange device to the vent — a pinhole cam behind the grille. Trust the scan, not just the vibe."),
  dict(k="WHY IT WORKS", top="THE SCIENCE OF", big="CATCHING\nA LENS",
     seg=["Every camera has a lens, and lenses reflect.",
          "Infrared bounces back as a sharp bright point.",
          "Wireless cams also shout on the local network.",
          "Two signals, two ways to catch them.",
          "The app checks both at the same time.",
          "Physics is on your side. Use it."],
     yt="The science of finding hidden cameras #shorts",
     cap="Every lens reflects infrared as a bright point, and wireless cams shout on the network. Two signals, one scan — physics is on your side."),
 ],
 "brain": [
  dict(k="60-SECOND TEST", top="WHY YOU FORGET", big="EVERY\nNAME",
     seg=["You just met them and the name is already gone.",
          "It is not age. It is attention and encoding.",
          "A quick daily test shows your memory score.",
          "Simple games train recall in five minutes.",
          "Watch the number climb week after week.",
          "See your brain age in sixty seconds."],
     yt="Why you forget every name #shorts",
     cap="Forgetting names isn't age — it's encoding. A 60-second test shows your memory score, and five-minute games train recall. Watch the number climb."),
  dict(k="BRAIN AGE", top="IS YOUR MIND", big="OLDER THAN\nYOU?",
     seg=["Your brain has an age, just like your body.",
          "Speed, memory and focus reveal the real number.",
          "One short test estimates it in a minute.",
          "Most people score older than they expect.",
          "The good news: it drops with daily training.",
          "Find your brain age today."],
     yt="Is your brain older than you are? #shorts",
     cap="Your brain has an age — speed, memory and focus set the number. One quick test estimates it, and daily training drops it. Most people score older than they think."),
  dict(k="5-MIN HABIT", top="TRAIN FOCUS", big="LIKE A\nMUSCLE",
     seg=["Focus is not a gift, it is a muscle.",
          "Five minutes a day is enough to grow it.",
          "Short, hard puzzles push your limit gently.",
          "The app adapts as you get faster.",
          "In two weeks distractions lose their grip.",
          "Start with five minutes tomorrow."],
     yt="Train your focus like a muscle #shorts",
     cap="Focus is a muscle, not a gift. Five minutes of adaptive puzzles a day, and in two weeks distractions lose their grip. Start tomorrow."),
  dict(k="MEMORY HACK", top="REMEMBER", big="ANY NAME\nFOR GOOD",
     seg=["Hear the name, then say it back out loud.",
          "Link it to a picture: Rose, a red rose.",
          "Repeat it once after ten seconds.",
          "That triple hit locks it into memory.",
          "Train the habit with quick daily reps.",
          "Never blank on a name again."],
     yt="Remember any name for good #shorts",
     cap="Say it back, link it to an image, repeat after ten seconds — that triple hit locks a name in. Train the habit with quick daily reps."),
  dict(k="DOPAMINE RESET", top="WHY YOU CAN'T", big="SIT AND\nTHINK",
     seg=["Endless scrolling floods your brain with noise.",
          "Deep focus starts to feel almost painful.",
          "The fix is short bursts of real challenge.",
          "Puzzles reset your attention span, gently.",
          "Each session rebuilds patience and calm.",
          "Trade the scroll for five sharp minutes."],
     yt="Why you can't sit and think anymore #shorts",
     cap="Endless scrolling makes deep focus feel painful. Short bursts of real challenge reset your attention span — trade the scroll for five sharp minutes."),
  dict(k="DAILY STREAK", top="SMARTER IN", big="14\nDAYS",
     seg=["Big change starts with one tiny daily rep.",
          "Day one feels slow and a little clumsy.",
          "By day five your reaction time drops.",
          "By day ten recall feels sharper, easier.",
          "Two weeks in, the streak keeps you going.",
          "Fourteen days to a quicker mind."],
     yt="Get measurably smarter in 14 days #shorts",
     cap="One tiny daily rep compounds: faster reactions by day five, sharper recall by day ten, a streak that keeps you going. Fourteen days to a quicker mind."),
 ],
 "tape": [
  dict(k="WILL IT FIT?", top="MEASURE ANY ROOM", big="WITHOUT\nA TAPE",
     seg=["A rug, a TV, a shelf. Will it fit? Stop guessing.",
          "Point your phone, tap two points.",
          "The length appears right on the floor.",
          "Width, height, area, no helper needed.",
          "Save every wall as a project, export a PDF.",
          "Measure any space from your couch in ten seconds."],
     yt="Measure any room without a tape #shorts",
     cap="A rug, a TV, a shelf — will it fit? Point your phone, tap two points, and the length appears on the floor. Width, height, area — no tape, no helper."),
  dict(k="MOVING DAY", top="WILL THE SOFA", big="FIT THROUGH\nTHE DOOR?",
     seg=["Big furniture, narrow doorway, moving day panic.",
          "Measure the door frame with your phone first.",
          "Then measure the sofa the same way.",
          "The app compares both in real time.",
          "Green means go, red means turn it sideways.",
          "Never get stuck on the stairs again."],
     yt="Will the sofa fit through the door? #shorts",
     cap="Moving day panic? Measure the doorway, measure the sofa, let the app compare. Green means go, red means turn it sideways."),
  dict(k="RENTER HACK", top="DECORATE", big="WITHOUT\nHOLES",
     seg=["Renting means no guessing and no wall damage.",
          "Measure the empty wall with your phone.",
          "Drop a virtual frame to test the spot.",
          "Line up shelves before a single nail.",
          "Save the layout, shop with real sizes.",
          "Decorate smart, get your deposit back."],
     yt="Decorate a rental without holes #shorts",
     cap="Renting? Measure the wall, drop a virtual frame, line up shelves before a single nail. Shop with real sizes and keep your deposit."),
  dict(k="ONLINE SHOPPING", top="BUY FURNITURE", big="THAT ACTUALLY\nFITS",
     seg=["That online sofa looks perfect on screen.",
          "But will it swallow your whole living room?",
          "Measure the real space with your phone first.",
          "Compare it to the product dimensions.",
          "Order only what genuinely fits.",
          "Fewer returns, zero regret."],
     yt="Buy furniture that actually fits #shorts",
     cap="That online sofa looks perfect — until it swallows the room. Measure the real space, compare to the listing, order only what fits. Fewer returns, zero regret."),
  dict(k="DIY PROJECT", top="CUT ONCE", big="MEASURE\nWITH AR",
     seg=["Every DIY starts with an honest measurement.",
          "Skip the bent metal tape and the helper.",
          "Point, tap, and read length off the floor.",
          "Get width, height and area in one shot.",
          "Export the numbers straight to a PDF.",
          "Measure right, build once."],
     yt="Measure your DIY project with AR #shorts",
     cap="Every DIY starts with an honest measurement. Skip the bent tape — point, tap, read length off the floor, export to PDF. Measure right, build once."),
  dict(k="10 SECONDS", top="A TAPE MEASURE", big="IN YOUR\nPOCKET",
     seg=["You always have your phone. Now it measures too.",
          "No tape, no marks, no second person.",
          "Tap two points and read the distance.",
          "Rooms, walls, furniture, all in seconds.",
          "Save projects and share the sizes.",
          "The tape measure you never forget at home."],
     yt="A tape measure that lives in your pocket #shorts",
     cap="You always have your phone — now it measures too. No tape, no marks, no helper. Tap two points, read the distance, save the project."),
 ],
}

# ------------------------------------------------------------------ ПУЛЫ ИНФОГРАФИКИ (контент под app)
OVERLAY_POOLS = {
 "spy": {
   "kicker": ["WI-FI SCAN","LENS CHECK","STAY SAFE","SCAN FIRST","PRIVACY 101"],
   "kinetic": [("STOP","GUESSING"),("LIGHTS","OFF"),("SCAN","NOW"),("STAY","PRIVATE"),("LOOK","CLOSER")],
   "lowerthird": [("SCAN THE WI-FI","unknown devices appear"),("KILL THE LIGHTS","lenses glow in IR"),
                  ("CHECK THE VENTS","line of sight to the bed"),("UNPLUG UNKNOWNS","30 seconds, total")],
   "chips": [["VENTS","CLOCKS","OUTLETS","TVs"],["WI-FI","IR","BLUETOOTH","RF"],["SCAN","SWEEP","CHECK","RELAX"]],
   "bars": [("DETECTION RATE","%",[["Naked eye",18],["With app",94]]),
            ("TIME TO SCAN","s",[["Manual",300],["App",30]]),
            ("HIDDEN CAM REPORTS","%",[["2019",6],["2024",34]])],
   "gauge": [(30,60,"s","FULL ROOM SWEEP"),(94,100,"%","DETECTION RATE"),(5,10,"","SPOTS TO CHECK")],
   "checklist": [["Scan Wi-Fi","Lights off","Check vents","Unplug unknowns"],
                 ["Smoke detector","Alarm clock","TV frame","Power outlet"]],
   "callout": ["MOST CAMS NEED WI-FI","IR GLINT GIVES IT AWAY","LINE OF SIGHT = RED FLAG"],
   "ticker": [(60,"s","FULL SWEEP"),(2,"","SIGNALS CHECKED"),(100,"%","PRIVACY BACK")],
   "stat_count": [(94,"%","DETECTION"),(30,"s","PER ROOM"),(5,"","HIDING SPOTS")],
 },
 "brain": {
   "kicker": ["60-SEC TEST","BRAIN AGE","FOCUS FIX","MEMORY 101","DAILY REP"],
   "kinetic": [("TRAIN","DAILY"),("STAY","SHARP"),("FOCUS","UP"),("RECALL","FASTER"),("BEAT","THE FOG")],
   "lowerthird": [("SAY IT BACK","names stick instantly"),("FIVE MINUTES A DAY","focus grows like a muscle"),
                  ("SHORT HARD PUZZLES","reset your attention"),("DAILY STREAK","compounds fast")],
   "chips": [["SPEED","MEMORY","FOCUS","LOGIC"],["RECALL","REACT","SOLVE","REPEAT"],["DAY 1","DAY 5","DAY 10","DAY 14"]],
   "bars": [("FOCUS AFTER 14 DAYS","%",[["Before",41],["After",78]]),
            ("RECALL SPEED","%",[["Week 1",100],["Week 3",147]]),
            ("DISTRACTION","%",[["Before",80],["After",29]])],
   "gauge": [(14,30,"d","TO SHARPER RECALL"),(5,10,"min","PER DAY"),(78,100,"%","FOCUS SCORE")],
   "checklist": [["Take the test","Play 5 min","Beat your score","Keep the streak"],
                 ["Hear it","Picture it","Repeat it","Recall it"]],
   "callout": ["IT'S ENCODING, NOT AGE","FOCUS IS A MUSCLE","STREAKS BEAT WILLPOWER"],
   "ticker": [(147,"%","RECALL SPEED"),(14,"d","STREAK"),(5,"min","A DAY")],
   "stat_count": [(60,"s","TO A SCORE"),(14,"d","TO SHARPER"),(5,"min","A DAY")],
 },
 "tape": {
   "kicker": ["WILL IT FIT?","AR MEASURE","NO TAPE","POCKET TAPE","MEASURE 101"],
   "kinetic": [("STOP","GUESSING"),("JUST","TAP"),("NO","TAPE"),("MEASURE","ANY ROOM"),("FIT","CHECK")],
   "lowerthird": [("TAP TWO POINTS","length appears on the floor"),("MEASURE THE DOOR","then measure the sofa"),
                  ("DROP A FRAME","test it before the nail"),("EXPORT A PDF","sizes in one tap")],
   "chips": [["LENGTH","WIDTH","HEIGHT","AREA"],["ROOMS","WALLS","DOORS","FURNITURE"],["POINT","TAP","READ","SAVE"]],
   "bars": [("TAPE VS PHONE ERROR","%",[["Metal tape",12],["Phone AR",3]]),
            ("TIME TO MEASURE","s",[["Tape + helper",90],["Phone",10]]),
            ("FURNITURE RETURNS","%",[["Guessing",22],["Measured",4]])],
   "gauge": [(10,60,"s","PER MEASUREMENT"),(1,10,"","PEOPLE NEEDED"),(4,100,"%","RETURN RATE")],
   "checklist": [["Point the phone","Tap two points","Read the length","Save the project"],
                 ["Measure the door","Measure the sofa","Compare sizes","Move it in"]],
   "callout": ["NO TAPE, NO HELPER","MEASURE FROM THE COUCH","BUY WHAT ACTUALLY FITS"],
   "ticker": [(10,"s","PER MEASURE"),(4,"","WALLS SAVED"),(1,"","TAP TO START")],
   "stat_count": [(10,"s","PER ROOM"),(3,"%","ERROR"),(1,"","PERSON NEEDED")],
 },
}

OV_TYPE_ORDER = ["kicker","kinetic","lowerthird","chips","bars","gauge","callout","stat_count","checklist","ticker"]


def load_state():
    try:
        return json.load(open(STATE))
    except Exception:
        return {"seq": 0, "angle_idx": {"spy": 0, "brain": 0, "tape": 0}, "app_rr": 0,
                "shot_off": {"spy": 0, "brain": 0, "tape": 0}, "ov_off": {}}


def save_state(s):
    json.dump(s, open(STATE, "w"), ensure_ascii=False, indent=1)


def build_shots(app, off, rng):
    """Случайная структура: разное число кадров (10-16), случайное чередование
    движение/форма-вставка/демо, без повтора формы или движения подряд."""
    pool = SHOTQ[app][:]
    rng.shuffle(pool)
    n = len(pool)
    ncount = rng.randint(10, 16)
    inserts = INSERTS[:]; rng.shuffle(inserts)
    motions = MOTIONS[:]; rng.shuffle(motions)
    shots = []
    last_kind = None
    ii = mi = 0
    for i in range(ncount):
        q = pool[(off + i) % n]
        shot = {"q": [q]}
        # решаем тип кадра случайно, но без двух форм/движений подряд
        r = rng.random()
        if last_kind != "insert" and (r < 0.42 or last_kind == "motion"):
            shot["insert"] = inserts[ii % len(inserts)]; ii += 1
            shot["pos"] = rng.choice(POS)
            last_kind = "insert"
        else:
            shot["motion"] = motions[mi % len(motions)]; mi += 1
            last_kind = "motion"
        shots.append(shot)
    return shots


def build_overlays(app, ovoff, rng):
    """Случайный СОСТАВ (подмножество типов), ПОРЯДОК, КОЛИЧЕСТВО (6-11) и тайминги —
    структура наложений разная у каждого ролика, ноль общего шаблона."""
    pools = OVERLAY_POOLS[app]
    avail = [t for t in ALL_OV_TYPES if pools.get(t)]
    kcount = rng.randint(6, min(11, len(avail)))
    # kicker почти всегда первым (хук), остальное — случайная выборка и порядок
    chosen = []
    if "kicker" in avail and rng.random() < 0.85:
        chosen.append("kicker")
    rest = [t for t in avail if t not in chosen]
    rng.shuffle(rest)
    chosen += rest[: max(0, kcount - len(chosen))]
    if "kicker" in chosen:
        chosen = ["kicker"] + [t for t in chosen if t != "kicker"]
    k = len(chosen)
    # случайные, но неубывающие тайминги в окне 0.03..0.92
    span = 0.89
    pts = sorted(0.03 + span * rng.random() for _ in range(k))
    ovs = []
    ovcnt = {}
    for i, typ in enumerate(chosen):
        at = round(pts[i], 3)
        pick = pools.get(typ, [])
        idx = (ovoff + ovcnt.get(typ, 0) + rng.randrange(len(pick))) % len(pick)
        ovcnt[typ] = ovcnt.get(typ, 0) + 1
        item = pick[idx]
        o = {"at": at, "dur": round(rng.uniform(1.6, 2.4), 2), "type": typ}
        if typ == "kicker":
            o["text"] = item
        elif typ == "kinetic":
            o["top"], o["big"] = item
        elif typ == "lowerthird":
            o["title"], o["sub"] = item
        elif typ == "chips":
            o["items"] = item; o["pos"] = "upper" if i % 2 else "lower"
        elif typ == "bars":
            title, unit, items = item
            o["title"] = title; o["unit"] = unit; o["items"] = items; o["pos"] = "center"
        elif typ == "gauge":
            to, mx, suf, lab = item
            o["to"] = to; o["max"] = mx; o["suffix"] = suf; o["label"] = lab; o["pos"] = "center"
        elif typ == "callout":
            o["text"] = item; o["pos"] = "center"
        elif typ == "stat_count":
            to, suf, lab = item
            o["to"] = to; o["suffix"] = suf; o["label"] = lab; o["pos"] = "center"
        elif typ == "checklist":
            o["items"] = item; o["pos"] = "center"; o["dur"] = 2.6
        elif typ == "ticker":
            to, suf, lab = item
            o["to"] = to; o["suffix"] = suf; o["label"] = lab; o["pos"] = "lower"
        ovs.append(o)
    return ovs


def make_one(app, state):
    meta = BRAND[app]
    ai = ANGLES[app]
    aidx = state["angle_idx"][app] % len(ai)
    ang = ai[aidx]
    state["angle_idx"][app] = aidx + 1

    state["seq"] += 1
    seq = state["seq"]
    rid = "g%s_%03d" % (app, seq)
    rng = rng_for(rid)

    shot_off = state["shot_off"].get(app, 0)
    ov_off = state.get("ov_off", {}).get(app, 0)

    # музыка: случайный сдвиг + случайное число запросов (2-3) — индивидуально на ролик
    mp = meta["music"][:]; rng.shuffle(mp)
    music_q = mp[: rng.randint(2, 3)]

    grade = rng.choice(GRADES.get(app, [meta["grade"]]))
    # скорость озвучки чуть варьируем — динамика разная
    rate = rng.choice(["+4%", "+5%", "+6%", "+7%"])

    d = {
        "id": rid,
        "app": app,
        "voice": meta["voice"],
        "rate": rate,
        "grade": grade,
        "brand": dict(meta["brand"]),
        "music": {"queries": music_q},
        "cover": {"kicker": ang["k"], "top": ang["top"], "big": ang["big"],
                  "q": [rng.choice(SHOTQ[app])]},
        "segments": [{"id": "b%d" % (j + 1), "text": t} for j, t in enumerate(ang["seg"])],
        "shots": build_shots(app, shot_off, rng),
        "overlays": build_overlays(app, ov_off, rng),
        "cta": {"text": "Comment %s for the app." % meta["brand"]["code"], "code": meta["brand"]["code"]},
        "caption": "%s Comment %s for the app. %s" % (ang["cap"], meta["brand"]["code"], meta["hashtags"]),
        "yt_title": ang["yt"],
    }
    # журнал механик — след «отпечаток» набора наложений, чтобы контролировать неповторяемость
    fp = "|".join(sorted(o["type"] for o in d["overlays"]))
    state.setdefault("ov_fp", {}).setdefault(app, [])
    state["ov_fp"][app] = (state["ov_fp"][app] + [fp])[-20:]
    # сдвигаем оффсеты (взаимно простые с длинами пулов) — на всякий, поверх rng
    state["shot_off"][app] = (shot_off + 7) % len(SHOTQ[app])
    state.setdefault("ov_off", {})[app] = (ov_off + 3)
    return rid, d


def main():
    args = sys.argv[1:]
    state = load_state()
    apps = ["spy", "brain", "tape"]

    if args and args[0] == "topup":
        target = int(args[1]) if len(args) > 1 else 12
        have = len([f for f in os.listdir(QUEUE) if f.endswith(".json")])
        need = max(0, target - have)
    else:
        need = int(args[0]) if args else 6

    made = []
    for _ in range(need):
        app = apps[state["app_rr"] % 3]
        state["app_rr"] += 1
        rid, d = make_one(app, state)
        path = os.path.join(QUEUE, rid + ".json")
        json.dump(d, open(path, "w"), ensure_ascii=False, indent=1)
        made.append(rid)
    save_state(state)
    print("GEN_OK made=%d -> %s | queue=%d" % (
        len(made), ",".join(made),
        len([f for f in os.listdir(QUEUE) if f.endswith('.json')])))


if __name__ == "__main__":
    main()
