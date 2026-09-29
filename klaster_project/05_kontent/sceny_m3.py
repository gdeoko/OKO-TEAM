# -*- coding: utf-8 -*-
"""Сцены кадров месяца 3: временный файл до вливания в паспорт.

Зачем он есть. Сцены кадров живут в `sborka_promtov.py` (словари `СЦЕНЫ` и
`СЦЕНЫ_СЛАЙДОВ`), но паспорт правят сразу несколько пачек: месяц 1 сводил один
агент, месяц 2 лежит отдельным модулем `sceny_m2.py`, статьи месяца 3 вписывал
третий. Две правки в один файл затирают друг друга, поэтому месяц 3 собран
здесь и вливается в паспорт ОТДЕЛЬНЫМ ШАГОМ, когда файл освободится:
`СЦЕНЫ_M3` идёт в `СЦЕНЫ`, `СЦЕНЫ_SLAJDOV_M3` в `СЦЕНЫ_СЛАЙДОВ`, старые имена
из `СТАРЫЕ_КЛЮЧИ` из паспорта вычищаются, а `БЕЗ_ГЕНЕРАЦИИ_M3` добавляется в
множество `БЕЗ_ГЕНЕРАЦИИ`. Сам `sborka_promtov.py` этой пачкой не правился.

Правила записи те же, что в паспорте: одна английская фраза без точки в конце,
от 90 до 260 знаков, только предметы и их расположение в кадре. Цвет, свет,
оптику, бренд и типографику добавляет паспорт бренда, дублировать их в сцене
вредно: промпт распухает и правила спорят. Поэтому из русского описания в
строке «Визуал:» берётся предметный слой, а «графит основой», «амбер акцентом»
и крупные числа титрами отбрасываются: числа в сцене превращаются в предметы
(три стержня разной высоты, двенадцать плиток в ряд), иначе генератор печатает
цифру поверх кадра и спорит с движком титров.

Сцены выведены из ТЕКУЩЕГО состояния `MESYAC_3/NEDELYA_*.md`: месяц только что
прошёл второй круг правок, восемнадцати единицам сменили рубрику, тринадцати
переписали угол вместе с заголовком и строкой «Визуал:». Прежние сцены из
паспорта под эти единицы больше не годятся, они описывают снятый угол.

Сцена каждого слайда выведена из его собственного заголовка и подписи. Слайд
про ворота показывает ворота, слайд про счёт показывает счёт; внутри одной
карусели сцены разные, но из одного мира.

Проверить себя, не трогая паспорт:
    python3 sceny_m3.py
"""

# Кадр единицы: то, что видит камера в главном кадре поста, обложки статьи или
# первого слайда серии, если своей сцены у слайда нет.
СЦЕНЫ_M3 = {
# --- неделя 1: 02.11 - 08.11 ---
"P-52-indeksaciya-pyat-let": "a rising curve scribed across a drafting sheet pinned to a steel bench with five stepped tick marks along it and a pair of dividers standing where the curve turns steepest",
"P-96-itog-mesyaca": "a checklist form lying on a workbench with seven ruled rows down the sheet and an empty box milled into the bench beside each row, a pen resting across the lowest of them",
"P-64-vtoraya-ochered-punkty": "the scaffolded facade of a new production building seen from the yard with five working decks stacked up its height and a tower crane standing above the roofline",
"P-33-karusel-vtoraya-ochered": "a structural column standing on the bare slab of an unfinished production hall with the grid of the floor marking running away from its base and formwork stacked along the wall",
"P-S-den-priemki": "a sealed electricity meter in the switchboard of an empty block with a tape measure and a folded acceptance form lying on the concrete floor directly beneath the panel",
"P-51-karusel-sem-strok": "a printed invoice form lying flat on a steel bench with seven ruled rows down the sheet and a machinist rule laid across the middle of them, a pen at the margin",
"P-3301-rbk-porogi-gektara": "an aerial view of an industrial quarter split down the middle by a straight boundary, one long unbroken warehouse roof on one side and a dense grid of small workshop blocks with their own gates on the other",
"P-58-zavody-na-yuge": "a printed city plan lying flat on a bench with the southern quarters hatched far denser than the rest and a single route line drawn from that belt out across the sheet to its far edge",
"P-123-instrukcia-cenovaya-kategoria": "six identical breaker modules set in one row inside an open switchgear cabinet with the first of them pulled slightly forward and a folded tariff sheet lying on the bench below",
"P-S-sreda-dvenadcat-nedel": "a yard at first light with a box truck standing at an open block gate and its tail lift down, pallets being taken off onto the apron and the rest of the row of gates still shut",
"P-3202-vc-maly-format": "a cutaway of a two storey production building with a machine tool and a semi trailer at the gate on the lower floor and a smaller bay with a goods lift shaft directly above them",
"P-310-vk-voronka-usloviy": "five funnels of decreasing size set one below another on a steel stand with dry granulate running through the stack and a small heap of it collected in the tray at the bottom",
"P-3201-kategoriya-na-dveri": "the steel door of a production block seen straight on with a small stamped plate screwed to it at eye height and the bays of the workshop showing through the gap of the half open leaf",
"P-303-devyat-plyus-tri": "twelve steel tiles laid in one long row on a workbench with the last three lifted a finger's width proud of the surface and a machinist rule running the length of the row",
"P-404-chto-vzyat": "a car boot standing open on the apron of an industrial territory with six items set out on its floor, a tape measure, a folding rule, a clipboard, a phone, a folded drawing and a hard hat",
"P-59-karusel-logistika": "a turning circle in a yard seen from directly above with painted bay lines curving across the concrete, a semi trailer standing mid manoeuvre and gates along both flanks",
"P-S-cto-vzat-na-vstrecu": "a meeting room above a workshop with a block plan unrolled across the table, a tape measure and a folded equipment list weighing down its corners and a lamp hanging low over the sheet",
"P-3101-kategoriya-nadezhnosti": "a main switchboard standing open in a workshop with two separate incoming feeds and a transfer cabinet beside it and a printed single line diagram lying marked up on the bench in front",
# --- неделя 2: 09.11 - 15.11 ---
"P-62-dogovor-krt-punkty": "four sheets of a contract fanned apart on a meeting table so each of their upper margins shows, a pen lying across the topmost sheet and a closed folder at the far edge",
"P-32-sem-dokumentov": "a site manager desk with a floor plan unrolled over a stack of folders, the column grid drawn across it and the outline of a machine traced over two of those columns at once",
"P-95-smena-v-08-00": "a full parking field beside an industrial territory in the morning with marked rows running away into the frame and a dense stream of people crossing them toward the checkpoint",
"P-124-sravnenie-naym": "two identical work stations standing either side of a painted aisle line in a workshop, the near one empty with its tools racked and the far one set up mid job",
"P-S-puskovoy-tok": "the intake switchgear of a workshop standing open with lead seals on its terminal cover, a compressor against the far wall and a printed equipment list lying on the bench in front",
"P-3102-shum-i-sanzona": "a sound level meter on a tripod standing beside a working compressor with ear defenders hung on the machine frame and a residential block showing through the workshop window behind",
"P-140-konferenc-zal": "a conference hall seen from the back row with rows of chairs filled and turned toward a wide screen at the front carrying a view of a production line",
"P-93-karusel-kvartal": "a printed quarter plan pinned flat to a drawing board with five tracing overlays hinged along its top edge, the uppermost sheet lifted and a pencil resting under it",
"P-311-vk-stanochnik-vyshe": "two stacks of machined discs standing on a bench, one stack noticeably higher than the other, with a folded printout of a wage table lying beside the taller of them",
"P-3103-ventilyaciya-otoplenie": "an air handling unit standing on the roof of a production building with its duct running down into an opening and a local extraction hood over a work post in the bay below",
"P-125-mify-gospodderzhka": "five crumpled sheets swept into a heap at one end of a workbench with a squared stack of stamped forms and a set of keys standing at the other end of the same surface",
"P-S-granica-rabot": "a mesh site fence running across a yard with the gate of a working block standing directly beside it and a phone propped on a barrier post showing a route plan",
"P-3304-vc-shest-stadiy-vybora": "a floor plan of a workshop unrolled across a desk with a tape measure, a hard hat and a printed equipment list holding down its corners and pencil marks along the gate openings",
"P-306-karusel-shest-mer": "six document folders laid out in two rows of three on a steel bench with the fourth of them opened flat and a wall calendar propped against the panel behind them",
"P-3203-strahovanie-ceha": "an insurance policy lying open on a workshop bench beside a machine rating plate and a stapled valuation report with a fire extinguisher standing at the lathe bed behind them",
"P-63-karusel-protokol-raznoglasiy": "a protocol sheet lying on a meeting table under a laid straightedge with a stapled lease agreement pushed to one side of it and an open envelope at the far edge",
# --- неделя 3: 16.11 - 22.11 ---
"P-82-moshnost-delitsya": "a distribution board of a building with a row of outgoing breakers along it, one of them switched apart from the rest, and a taped up load schedule on the inside of the open door",
"P-312-vk-tri-usloviya-lgoty": "three padlocks hanging in a row on the hasps of a steel cabinet with the middle one sprung open and its shackle lifted clear while the other two stay closed",
"P-408-sosedstvo": "the inner street of an industrial territory running away between two rows of block gates with a pallet truck crossing it and numbered plates fixed beside each opening",
"P-126-istoria-kanban": "a workshop aisle with two work stations facing each other across it and a single rack of empty stacking bins standing between them, one bin pulled out onto the floor",
"P-S-samaa-bol-naa-proverka": "the closed gate of a production block with an address plate bolted to the wall beside it and a phone propped against the door jamb showing a parcel map on its screen",
"P-307-karusel-chelovek-u-stanka": "a workshop bay where one lathe stands loaded and running warm while the machine next to it is shrouded in a dust sheet with its stool pushed under the bed",
"P-3302-rbk-rynok-arendatora": "a long internal corridor of a new production building with a row of sectional gates down one flank, a single one of them rolled fully open onto the bay and the rest shut",
"P-405-kran-balka": "an overhead travelling crane spanning a workshop bay with its hook block lowered on slings over a machine standing on a rigging skate and the runway beams above",
"P-308-karusel-sem-strok-rashodov": "a till roll spilling off the end of a steel bench onto the floor of a workshop office with a calculator standing where the paper leaves the surface",
"P-S-subbota-casy-otgruzki": "the entrance barrier of an industrial territory at dusk with its arm lowered across the drive, a truck waiting in front of it and the guard window lit beside the lane",
"P-406-koefficient-odnovremennosti": "a dozen equipment rating plates laid out fanned across a workbench with a pocket calculator standing at the edge of the spread and a folded load calculation beneath them",
"P-3305-vc-cena-prostoya": "a lathe stopped mid job in an empty workshop with a part still clamped in the chuck, swarf gathered on the tray beneath it and a large clock mounted on the wall behind",
"P-310-konferenc-zal": "a conference hall of an industrial territory seen from the doorway with empty rows of chairs receding toward a wide screen and a speaker stand set at the front corner",
"P-309-karusel-formula-stavki": "a beam balance standing on a workbench with a stack of coins in one pan and a set of graded weights lined up beside the other, the beam tipped over to one side",
"P-3303-rbk-inzhenernyy-barer": "a distribution board standing open in a workshop with ranks of breakers and busbars behind its door, a meter mounted beside them and a machine under a dust sheet in the depth of the bay",
"P-66-karusel-peregovory": "a meeting table carrying a stapled lease agreement with six paper flags standing along its page edge, a pen resting on the top sheet and a closed folder beside it",
"P-S-subbota-strojka-za-zaborom": "the scaffolded facade of a building under construction seen from behind the site hoarding with a tower crane standing over its roofline and the boarding running across the near ground",
"P-3204-zimniy-schet-za-teplo": "a workshop gate standing half open in winter with warm air steaming out over the frozen apron and a thermometer fixed to the column beside the opening",
# --- неделя 4: 23.11 - 29.11 ---
"P-303-dvor-i-razvorot": "a yard in front of a block gate seen from cab height with a semi trailer part way through a three point turn on it and the painted bay lines curving under the vehicle",
"P-80-devyat-voprosov-sosedi": "nine steel plates set out in a three by three grid on a workbench with the three in the top row lifted onto small blocks and a machinist square laid along the lower edge",
"P-410-shattl": "a shuttle stop shelter on the drive of an industrial territory with a timetable board on its end wall, a minibus pulling in past it and a metro entrance at the far end of the street",
"P-120-kalendar-regulyatorika": "a wall calendar hanging in a workshop office with eight of its days crossed through and a ninth ringed further down the sheet, a pen hanging on a string beside it",
"P-86-karusel-kooperaciya": "a machined part standing alone on a pallet in the middle of the inner street of a territory with the gate of one block on one side and the entrance drive on the other",
"P-S-obsij-proezd-utrom": "the inner street of an industrial territory in the morning with a line of vehicles queued at the entrance and the first block gate along the row being rolled up",
"P-3104-voda-i-stoki": "an inspection manhole standing open on the apron of a production site with its cover laid aside and a sampling flask on the concrete beside it, the workshop gates behind",
"P-304-shtraf-za-kazhdogo": "ten sets of work overalls hanging in one row on a rail in a changing room with a numbered tag on each hanger and a larger empty hanger standing at the end of the rail",
"P-121-razbor-nds-usn": "a ledger opened flat on an office desk with a scribed threshold line running across the page and a stack of invoices standing on either side of that line",
"P-85-cena-rasstoyaniya": "eight machined blanks laid out in one row on a bench in order of finish from rough casting to plated part, with four of them grouped closer together at the near end",
"P-3105-othody-proizvodstva": "a waste storage yard under a canopy with separate marked containers standing in a row on hard paving and a drum on a spill pallet beside them, the workshop gates behind",
"P-302-peresmenka-17-00": "the checkpoint of an industrial territory at the end of the day with a stream of people passing through it toward a bus stop and long shadows falling across the drive",
"P-97-karusel-formulirovki": "a checklist form with seven ruled rows lying on a bench with a folded reply letter pinned under a machined block at the other end of the same surface",
"P-S-razmer-kabiny-lifta": "a machine on a pallet standing on a landing in front of the open doors of a goods lift, the crate visibly longer than the depth of the car behind the doors",
"P-122-cifry-robotizacia": "an empty fenced robot cell marked out on a workshop floor with its safety gate open, anchor bolts set in the slab inside it and manual work benches filling the rest of the bay",
"P-3205-vc-arenda-protiv-pokupki": "a large balance scale standing in a workshop with a ring of keys and a stack of contracts in one pan and a small machine tool and a wall calendar in the other",
"P-130-vk-chetyre-sem-sot": "an aerial view of a dense residential city where the long low roofs of working workshops sit in the gaps between the housing blocks, their yards and gates open to the streets",
"P-S-voskresen-e-spisok-goroda": "a bench seen from directly above with a disassembled appliance on it, its casing, board, fasteners and carton set out separately around the empty shell",
}


# Кадр слайда: у каждого слайда карусели и серии историй своя сцена, выведенная
# из его собственного заголовка и подписи. Ключ - ключ единицы плюс номер слайда
# двумя цифрами, ровно так его собирает `кадры_единицы`.
СЦЕНЫ_SLAJDOV_M3 = {
# P-33 карусель «Рендер не показывает колонны»: мир строящегося корпуса
"P-33-karusel-vtoraya-ochered-01": "a presentation render board propped against a column inside a half finished production hall, the real columns of the bay standing in a row beside it",
"P-33-karusel-vtoraya-ochered-02": "a floor plan with a column grid unrolled on a trestle table inside an unfinished hall with a straightedge laid along one of its axes and a pencil across the sheet",
"P-33-karusel-vtoraya-ochered-03": "a poured concrete slab in a new bay with a levelling straightedge lying on it and a screed rail left along the edge, the surface still bare of marking",
"P-33-karusel-vtoraya-ochered-04": "a roof beam spanning an unfinished bay with a telescopic measuring rod stood up from the floor to its underside and the ceiling deck showing higher above it",
"P-33-karusel-vtoraya-ochered-05": "an empty switchboard enclosure fixed to the wall of a new block with a bundle of unterminated cables coming up through the floor duct in front of it",
"P-33-karusel-vtoraya-ochered-06": "a sectional gate opening in a new block with the leaf not yet fitted and a folding rule stood across the clear width of the aperture, the apron unfinished outside",
"P-33-karusel-vtoraya-ochered-07": "a new bay handed over half finished with a bare wall on one side, a plastered office partition on the other and building material stacked in the middle",
"P-33-karusel-vtoraya-ochered-08": "a site information board mounted on a steel stand at the gate of a building site with a wall calendar hanging on the hoarding beside it and the crane above",
# P-S истории «День приёмки»: мир пустого блока в день передачи
"P-S-den-priemki-01": "an electricity meter with a lead seal on its terminal cover mounted in the open switchboard of an empty block, a phone held up close to its face in the near plane",
"P-S-den-priemki-02": "the bare concrete floor of a workshop bay with a crack running along a slab joint and a tape measure laid open across it, the rest of the floor swept clean",
"P-S-den-priemki-03": "a blank block wall of swept plaster in an empty bay with a clean floor running to its foot and nothing standing against the wall at all",
"P-S-den-priemki-04": "the roller gate of an empty block with steel bollards set in the concrete in front of it and a swept apron running away from the threshold",
# P-51 карусель «7 строк платежа»: мир счёта и его строк на верстаке
"P-51-karusel-sem-strok-01": "a printed invoice lying on a steel bench with a pen resting across it and a pocket calculator standing at the near edge of the surface",
"P-51-karusel-sem-strok-02": "a rate sheet lying on a bench with its top row underscored by a laid straightedge and the rest of the page left plain, a pen at the margin",
"P-51-karusel-sem-strok-03": "a bunch of keys, a broom and a snow shovel standing together against the wall of a yard beside a service log book left open on a crate",
"P-51-karusel-sem-strok-04": "an electricity meter mounted on a corridor wall beside a water meter with a reading notebook hanging on a string under both of them",
"P-51-karusel-sem-strok-05": "a marked waste container standing on hard paving beside a workshop gate with a stack of flattened cardboard leaning against its flank",
"P-51-karusel-sem-strok-06": "a numbered parking bay painted on an apron beside a block with a bollard at its head and the rest of the marked rows running away past it",
"P-51-karusel-sem-strok-07": "two versions of the same invoice lying side by side on a bench with the lower one carrying an extra ruled row at its foot and a pen between them",
"P-51-karusel-sem-strok-08": "a wall calendar hanging over a bench with a single day far down the sheet ringed by hand and a folded rate notice pinned to the board beside it",
"P-51-karusel-sem-strok-09": "three separate invoices squared up side by side on a bench with a single ruled sheet laid across their lower edges and a pen resting on it",
# P-123 карусель «Ценовая категория»: мир щитовой, учёта и договора
"P-123-instrukcia-cenovaya-kategoria-01": "an electricity bill lying on a workbench with one of its upper rows underscored by hand and a pen laid across the sheet, a switchboard door open behind",
"P-123-instrukcia-cenovaya-kategoria-02": "the first page of a supply contract lying on a bench with a paper flag standing at one of its lines and a phone face up beside the sheet",
"P-123-instrukcia-cenovaya-kategoria-03": "a strip chart recorder standing on a shelf in a switchgear room with its paper roll unwound down the front of the cabinet in a long ragged trace",
"P-123-instrukcia-cenovaya-kategoria-04": "six identical breaker modules set in a single row inside an open switchgear cabinet with a pair of them separated slightly from the other four",
"P-123-instrukcia-cenovaya-kategoria-05": "an interval meter mounted in a metering cubicle with a communication cable run from its port down into the gland plate below the enclosure",
"P-123-instrukcia-cenovaya-kategoria-06": "two tariff sheets pinned side by side on a board above a bench, one carrying a single ruled column and the other two, a pencil hanging beside them",
"P-123-instrukcia-cenovaya-kategoria-07": "twelve monthly statements laid out in one long row on a bench with a calculator standing at the end of the row and a rule across their lower edges",
"P-123-instrukcia-cenovaya-kategoria-08": "a date stamp and an inkpad standing on an office desk beside a sealed envelope addressed for posting and a desk diary opened flat next to them",
"P-123-instrukcia-cenovaya-kategoria-09": "a signed supply contract lying on a desk with its annexes fanned out beside it and a phone lying face up on top of the topmost annex sheet",
# P-S истории «Среда, 12 недель до пуска»: мир двора и ворот корпуса
"P-S-sreda-dvenadcat-nedel-01": "a yard at first light with a box truck at an open block gate, its tail lift down and pallets standing on the apron beside the vehicle",
"P-S-sreda-dvenadcat-nedel-02": "a shut roller gate at the end of a row of blocks with a hand trolley parked against the wall beside it and a drain grating set in the apron",
"P-S-sreda-dvenadcat-nedel-03": "the roller gate of a block standing fully open onto a swept bay with a wall calendar hanging on the pillar beside the opening",
# P-404 карусель «6 вещей в багажник»: мир верстака сверху и одного предмета
"P-404-chto-vzyat-01": "a workbench seen from directly above with six items set out in two rows on it and an empty canvas bag lying open at the near edge of the surface",
"P-404-chto-vzyat-02": "a tape measure lying alone on a bench seen from directly above with its blade run out in a shallow curve across the bare surface",
"P-404-chto-vzyat-03": "a machine data plate and a small steel weight standing together on a bench seen from above with a folded dimension sketch under them",
"P-404-chto-vzyat-04": "a printed equipment list lying on a bench seen from above with a pen across it and a rating plate resting at the corner of the sheet",
"P-404-chto-vzyat-05": "a shift roster sheet lying on a bench seen from above with a wristwatch and a locker key set out beside it on the bare surface",
"P-404-chto-vzyat-06": "a stack of delivery notes squared up on a bench seen from above with a pen laid across the top sheet and a paper clip at its corner",
"P-404-chto-vzyat-07": "a clipboard with a ruled question sheet on it lying on a bench seen from above with a pen clipped to the board beside the sheet",
"P-404-chto-vzyat-08": "six items packed into an open canvas bag standing on a bench with the handle of a tape measure and the brim of a hard hat showing above its rim",
# P-59 карусель «40 часов машины»: мир двора, ворот и шлагбаума
"P-59-karusel-logistika-01": "a yard seen from directly above with a semi trailer standing at a gate and the painted turning circle marked out on the concrete around it",
"P-59-karusel-logistika-02": "a semi trailer part way through a three point turn in a narrow yard with its wheels cut hard over and a kerb close behind the trailer end",
"P-59-karusel-logistika-03": "the corner of a yard where the painted turning circle runs up against a kerb and a bollard, with a second gate opening close along the wall",
"P-59-karusel-logistika-04": "a barrier arm lowered across the exit drive of a territory in the evening with a guard window lit beside it and a truck standing behind the arm",
"P-59-karusel-logistika-05": "a guard window at the entrance of a territory with a pass book and a pen lying on its ledge and a van waiting at the raised barrier beyond",
"P-59-karusel-logistika-06": "a yard under snow with drifted ridges across the painted bay lines and a shovel standing against the wall beside a closed block gate",
"P-59-karusel-logistika-07": "a row of semi trailers standing nose to tail along the wall of a block with their engines off and the gates in front of them shut",
"P-59-karusel-logistika-08": "a printed month tally of departures pinned to a board beside a loading gate with a pen hanging under it and the swept apron running out through the opening",
# P-S истории «Что взять на встречу»: мир переговорной и ворот корпуса
"P-S-cto-vzat-na-vstrecu-01": "a briefing sheet with five ruled lines lying on a meeting table beside a tape measure and a folded machine drawing, two chairs drawn up at one side",
"P-S-cto-vzat-na-vstrecu-02": "a blank workshop wall of bare block seen straight on with a swept floor at its foot and a single conduit run down its face",
"P-S-cto-vzat-na-vstrecu-03": "the roller gate of a block standing open onto the yard with a numbered plate on the wall beside it and the apron swept clean in front",
# P-124 карусель «Два подхода к найму»: мир сварочного участка и раздевалки
"P-124-sravnenie-naym-01": "a stack of printed applications lying on a desk beside a single job advertisement card, the stack far thinner than the folder standing next to it",
"P-124-sravnenie-naym-02": "a workshop changing room with a row of steel lockers along the wall and a third of their doors standing open and empty, a bench in front of them",
"P-124-sravnenie-naym-03": "an office desk with a job advertisement printed out on it, a phone lying face up beside it and an empty chair drawn back from the desk",
"P-124-sravnenie-naym-04": "a workshop gate standing wide open onto a walkway with a floor line painted from the threshold into the bay and a rack of visitor hard hats beside it",
"P-124-sravnenie-naym-05": "a row of visitor hard hats and safety glasses laid out on a table at the entrance of a workshop with a signing in book open beside them",
"P-124-sravnenie-naym-06": "a wage table printed out and pinned to a workshop notice board with a pen hanging on a string beneath it and a shift roster pinned alongside",
"P-124-sravnenie-naym-07": "two personnel folders lying open side by side on a desk, one holding a single sheet and the other a thick stapled set, a pen between them",
"P-124-sravnenie-naym-08": "a workshop wall planner for one month with four separate days marked on it and a marker pen resting in the tray beneath the board",
"P-124-sravnenie-naym-09": "a canteen servery counter with trays stacked at its end and a dining room out of focus beyond, a locker room doorway visible along the wall",
# P-93 карусель «5 слоёв квартала»: мир печатных планов на чертёжной доске
"P-93-karusel-kvartal-01": "a printed quarter plan pinned to a drawing board with a cadastral reference card lying on it and a pencil resting across the sheet",
"P-93-karusel-kvartal-02": "a quarter plan on a board with the outlines of the neighbouring parcels traced over in pencil and a pair of dividers stepping along one boundary",
"P-93-karusel-kvartal-03": "a planning drawing unrolled over a quarter plan on a board with its corners weighted by machined blocks and a straightedge laid across it",
"P-93-karusel-kvartal-04": "a quarter plan on a board with one parcel among the others hatched over by hand and an eraser and a pencil lying on the cleared paper beside it",
"P-93-karusel-kvartal-05": "a printed district plan on a board with a building permit notice clipped to its upper edge and a new block outlined in pencil two parcels away",
"P-93-karusel-kvartal-06": "three tracing overlays hinged along the top of a drawing board and fanned apart so all three show at once, a pencil resting under the lowest",
"P-93-karusel-kvartal-07": "a drawing board carrying a quarter plan with a phone propped against its lower rail and a folded cadastral extract lying on the desk beneath",
# P-125 карусель «5 мифов о господдержке»: мир верстака, делённого стальной полосой
"P-125-mify-gospodderzhka-01": "a workbench divided across its middle by a steel strip with a crumpled sheet on the upper half and a squared stack of stamped forms on the lower",
"P-125-mify-gospodderzhka-02": "a small machine tool standing alone in a bay with a stapled loan application lying on the bench beside it and a folder standing at the end",
"P-125-mify-gospodderzhka-03": "a repayment schedule lying on a desk with a set of small steel weights standing along its lower edge and a pen laid across the sheet",
"P-125-mify-gospodderzhka-04": "four separate document folders laid out in a row on a bench with a component tray, a label roll and a small pallet block standing on top of them",
"P-125-mify-gospodderzhka-05": "a stack of export cartons standing on a pallet beside a workshop gate with a bundle of shipping documents taped to the topmost carton",
"P-125-mify-gospodderzhka-06": "a city plan of an industrial district lying on a desk with a stamped funding notice clipped to its edge and a pen resting on the sheet",
"P-125-mify-gospodderzhka-07": "three ruled sheets fanned across a desk with a single question line on each and a pen lying on the middle one, a folder closed beside them",
"P-125-mify-gospodderzhka-08": "a stamped application form lying square on a desk with an envelope and a pen beside it and a phone face up at the far corner of the surface",
# P-306 карусель «6 мер и календарь»: мир папок мер и настенного календаря
"P-306-karusel-shest-mer-01": "six document folders standing upright in a rack on a bench with a wall calendar propped against the panel behind them and a pen on the bench",
"P-306-karusel-shest-mer-02": "a title deed folder lying open on a desk with a set of building keys resting on the page and a small model of a workshop block beside it",
"P-306-karusel-shest-mer-03": "a stapled loan agreement lying open on a bench with a machined block weighting its pages and a folder standing closed at the far edge",
"P-306-karusel-shest-mer-04": "a bank guarantee letter lying on a desk beside a machine rating plate, the two of them set on opposite sides of a scribed line on the surface",
"P-306-karusel-shest-mer-05": "a payroll ledger opened flat on an office desk with a ruled column marked down its page and a calculator standing beside the open book",
"P-306-karusel-shest-mer-06": "an invoice for equipment lying on a bench with a small stack of coins on its corner and a wall calendar hanging on the panel behind it",
"P-306-karusel-shest-mer-07": "a new machine tool standing on a pallet in a bay with its registry plate visible and a stapled purchase file lying on the bench beside it",
"P-306-karusel-shest-mer-08": "a wall calendar with one day near its end crossed through in heavy marker and an unopened application envelope lying on the shelf below it",
"P-306-karusel-shest-mer-09": "a month calendar sheet on a bench with four separate days ringed on it and a pen and a phone lying side by side beneath the sheet",
# P-63 карусель «Протокол разногласий»: мир протокола на переговорном столе
"P-63-karusel-protokol-raznoglasiy-01": "a disagreement protocol lying on a desk with its page ruled into two columns and three blank gaps left down the right hand side, a pen beside it",
"P-63-karusel-protokol-raznoglasiy-02": "a stapled lease agreement and a single loose protocol sheet lying side by side on a desk with an envelope beneath both of them",
"P-63-karusel-protokol-raznoglasiy-03": "a protocol sheet on a desk with the first of its blank gaps filled in by hand and a wall calendar propped against a folder behind it",
"P-63-karusel-protokol-raznoglasiy-04": "a workshop bay part dismantled with a machine on a rigging skate, its foundation bolts exposed in the slab and a cable drum standing beside it",
"P-63-karusel-protokol-raznoglasiy-05": "a protocol sheet on a desk with a printed public notice clipped to its upper corner and a straightedge laid across the middle of the page",
"P-63-karusel-protokol-raznoglasiy-06": "a machine strapped to a rigging skate on a loading apron with slings coiled on the concrete and a lorry backed up to the gate behind it",
"P-63-karusel-protokol-raznoglasiy-07": "two versions of the same protocol lying side by side on a desk, one with its gaps filled in by hand and the other with a whole clause struck out",
"P-63-karusel-protokol-raznoglasiy-08": "a single protocol page lying square on a meeting table with a pen across it and a briefcase standing open on the chair drawn up beside",
# P-126 карусель «История канбана»: мир участков цеха и тары между ними
"P-126-istoria-kanban-01": "a workshop aisle with stacked plastic bins filling the gap between two work stations and a pallet truck squeezed past them along the wall",
"P-126-istoria-kanban-02": "a work station with finished parts piling up in trays on its outfeed side and no room left on the bench, the next station idle beyond",
"P-126-istoria-kanban-03": "a shop shelf rack of the kind used in a store aisle standing in a workshop with its front row of bins emptied and the rest still full",
"P-126-istoria-kanban-04": "two work stations facing each other across an aisle with a single empty stacking bin carried between them and a rack of full bins to one side",
"P-126-istoria-kanban-05": "a small printed card in a clear sleeve clipped to the rim of a stacking bin on a workshop rack with the next bins along standing empty",
"P-126-istoria-kanban-06": "a long workshop aisle with identical bin racks set at every work station down its length and a floor line painted from one to the next",
"P-126-istoria-kanban-07": "a rack of exactly six stacking bins bolted between two work stations with two of the bins standing empty and the floor around them clear",
"P-126-istoria-kanban-08": "a stack of empty stacking bins standing in a marked square on a workshop floor with a tally sheet clipped to the rack beside them",
"P-126-istoria-kanban-09": "a workshop aisle cleared of stored parts with the painted floor lines running unobstructed between the work stations on both sides",
# P-307 карусель «Человек у станка»: мир рабочего места, раздевалки и доски
"P-307-karusel-chelovek-u-stanka-01": "two work stations standing side by side in a bay, a lathe set up and running warm and an office desk beyond the glazed partition behind it",
"P-307-karusel-chelovek-u-stanka-02": "a lathe standing ready with an empty stool at its controls and a work jacket left on a peg beside the machine, the bay quiet around it",
"P-307-karusel-chelovek-u-stanka-03": "a row of machines in a bay with one of them covered by a dust sheet while the others stand set up for work with their chucks loaded",
"P-307-karusel-chelovek-u-stanka-04": "a notice board at a workshop entrance with a single job card pinned to it and the rest of the board bare, a pen hanging on a string",
"P-307-karusel-chelovek-u-stanka-05": "a locker bay with a set of overalls, boots, gloves and a hard hat laid out on the bench in front of one open locker door",
"P-307-karusel-chelovek-u-stanka-06": "a rack of seven numbered lockers along a changing room wall with one door standing open and empty and the other six shut",
"P-307-karusel-chelovek-u-stanka-07": "two scribed lines climbing a marked steel plate on a wall, one of them rising visibly steeper than the other from a common base",
"P-307-karusel-chelovek-u-stanka-08": "a shift roster sheet clipped to a board beside a workshop entrance with a route map of the district pinned up next to it",
# P-308 карусель «7 строк расходов»: мир чековой ленты и счетов на верстаке
"P-308-karusel-sem-strok-rashodov-01": "a long till roll unrolled down a steel bench and weighted at both ends by machined blocks, its ruled length running the whole surface",
"P-308-karusel-sem-strok-rashodov-02": "a payroll ledger opened flat on a bench with its lowest column ruled off by a straightedge and a pen resting at the foot of the page",
"P-308-karusel-sem-strok-rashodov-03": "a wage slip and a contributions statement lying overlapped on a desk with a scribed line on the bench passing between the two sheets",
"P-308-karusel-sem-strok-rashodov-04": "an electricity meter in an open switchboard with a folded tariff notice tucked behind its glass and a bill lying on the bench beneath",
"P-308-karusel-sem-strok-rashodov-05": "a tax return form lying on a desk with a paper flag standing at one of its lines and a closed ledger set square beside it",
"P-308-karusel-sem-strok-rashodov-06": "a lease schedule for machinery lying on a desk with a small steel weight on its corner and a calculator standing at the near edge",
"P-308-karusel-sem-strok-rashodov-07": "five steel bars of increasing height standing in a row on a bench, evenly spaced, with a machinist rule laid along their bases",
"P-308-karusel-sem-strok-rashodov-08": "a marked waste container standing on hard paving beside a workshop gate with a weighing ticket clipped to a board on its flank",
"P-308-karusel-sem-strok-rashodov-09": "a wall planner for a year hanging in a workshop office with four of its months ringed and a marker resting in the tray below",
"P-308-karusel-sem-strok-rashodov-10": "a delivery register and a waste classification sheet lying side by side on a bench with a pen across both and an envelope beneath them",
# P-309 карусель «Формула ставки»: мир весов, гирь и мерных плиток
"P-309-karusel-formula-stavki-01": "two identical pressure gauges mounted side by side on a manifold with their needles standing at clearly different marks and pipework running off both ways",
"P-309-karusel-formula-stavki-02": "two small weights of different size standing side by side on a bench with a scribed base line under both of them and a rule alongside",
"P-309-karusel-formula-stavki-03": "a threshold mark scribed across a steel gauge plate with a single weight standing below the mark and a second one resting above it",
"P-309-karusel-formula-stavki-04": "a set of graded weights lined up in order on a bench with the fourth of them lifted onto a machined block and a pair of tweezers beside the row",
"P-309-karusel-formula-stavki-05": "two heaps of loose coins of clearly different size poured onto a bench with a scribed line drawn between them and a folded bank slip beside the larger heap",
"P-309-karusel-formula-stavki-06": "a floor plan of a block on a bench with half of its area hatched over by hand and a wall calendar propped up behind the sheet",
"P-309-karusel-formula-stavki-07": "a bank counter ledger opened flat on a desk with a pen lying across the page and a single question sheet clipped to a board beside it",
# P-66 карусель «6 вещей до подписания»: мир договора на переговорном столе
"P-66-karusel-peregovory-01": "a stapled contract lying open on a table with two chairs drawn up on the same side of it and a pen resting across the open page",
"P-66-karusel-peregovory-02": "a wall calendar propped against a machine on a rigging skate in an empty bay with the crate straps still fastened and slings on the floor",
"P-66-karusel-peregovory-03": "a rising curve scribed on a sheet clipped to a board with a horizontal line ruled across its upper part where the curve meets it",
"P-66-karusel-peregovory-04": "a deposit receipt and a bank guarantee letter lying overlapped on a desk with a small stack of coins on the corner of the upper sheet",
"P-66-karusel-peregovory-05": "a length of new ducting and a coil of cable standing on a freshly poured floor in an empty bay with a stapled works schedule on a crate beside them",
"P-66-karusel-peregovory-06": "a bay divided by a temporary mesh partition with one half stacked with pallets and the other half empty and swept, a gate set in the partition",
"P-66-karusel-peregovory-07": "a set of keys and a signed handover form lying on the bare floor of an empty bay with a wall calendar propped against the wall behind them",
"P-66-karusel-peregovory-08": "a single envelope lying on a desk with six stapled sheets fanned out beside it and a pen resting across the fan of paper",
"P-66-karusel-peregovory-09": "a stapled six page brief lying on a meeting table with a phone face up next to it and a folder standing open at the far edge of the table",
# P-120 карусель «Регуляторный календарь»: мир календаря, упаковки и маркировки
"P-120-kalendar-regulyatorika-01": "a wall calendar in a workshop office with eight days crossed through across its upper part and a ninth ringed further down the sheet",
"P-120-kalendar-regulyatorika-02": "sacks of flour and boxes of dry goods stacked on a pallet beside a labelling table with a label printer standing at the end of the table",
"P-120-kalendar-regulyatorika-03": "a labelling line in a workshop with a print applicator over a conveyor and cartons passing beneath it, a roll of printed labels beside it",
"P-120-kalendar-regulyatorika-04": "a stack of flattened cardboard, a bale of film and a crate of metal fittings standing together on a weighing platform in a yard",
"P-120-kalendar-regulyatorika-05": "a set of scales in a packing area with a carton on the platform and separate bins of card, film and aluminium standing behind it",
"P-120-kalendar-regulyatorika-06": "a haulier register printed out and lying on a desk beside a lorry key and a stamped carrier certificate, a pen across the sheet",
"P-120-kalendar-regulyatorika-07": "a tablet propped on the dashboard shelf of a lorry cab with a consignment form on its screen and a paper waybill folded beside it",
"P-120-kalendar-regulyatorika-08": "a workshop notice board with eight dated notices pinned across it and a ninth sheet lying unpinned on the shelf beneath the board",
"P-120-kalendar-regulyatorika-09": "a block floor plan on a bench with three areas hatched separately on it, a marked waste bin and a label roll standing on the sheet",
# P-86 карусель «Одна деталь, два маршрута»: мир детали, тележки и проходных
"P-86-karusel-kooperaciya-01": "a single machined part lying on a bench with a painted floor line splitting into two branches on the concrete directly beyond the bench",
"P-86-karusel-kooperaciya-02": "a machined part being set into a crate on the tail lift of a van standing at a gate in the morning with the yard still empty behind",
"P-86-karusel-kooperaciya-03": "a machined part in a tray on a hand trolley standing in the inner street of a territory halfway between two block gates",
"P-86-karusel-kooperaciya-04": "the entrance of another territory with a driver cab stopped at a closed barrier and a queue of two more vans behind it along the approach road",
"P-86-karusel-kooperaciya-05": "an open gate between two blocks of one territory with a hand trolley crossing the threshold and no barrier anywhere along the route",
"P-86-karusel-kooperaciya-06": "a queue of vans standing nose to tail at a loading gate with a waiting area marked on the concrete and the shutter still down",
"P-86-karusel-kooperaciya-07": "a hand trolley standing back at its own bench with the finished part on it and the workshop gate open onto the yard beyond",
"P-86-karusel-kooperaciya-08": "a wall clock, a wristwatch and a printed journey log lying together on a bench with a pen across the log and a calculator beside it",
"P-86-karusel-kooperaciya-09": "the inner street of a territory with numbered block gates along both sides and hand trolleys standing at three of the openings",
"P-86-karusel-kooperaciya-10": "a printed journey log lying on a bench with a pen across it and a phone face up beside it, an open workshop gate in the depth of the frame",
# P-121 карусель «НДС на упрощёнке»: мир бухгалтерского стола и склада закупки
"P-121-razbor-nds-usn-01": "two invoice stacks of clearly different height standing side by side on a desk with a calculator between them and a pen at the near edge",
"P-121-razbor-nds-usn-02": "a revenue ledger open on a desk with its running total column ruled off near the foot of the page and a straightedge lying along the line",
"P-121-razbor-nds-usn-03": "a profit statement and a revenue statement lying overlapped on a desk with the upper sheet pulled aside to show the one beneath it",
"P-121-razbor-nds-usn-04": "a wall planner covering four years pinned above a desk with the first of its columns ringed and the remaining three left plain",
"P-121-razbor-nds-usn-05": "two rate cards standing propped against a ledger on a desk with a purchase invoice lying face up in front of both of them",
"P-121-razbor-nds-usn-06": "three rate cards laid out in a row on a desk with a thick file of purchase invoices standing behind them and a pen across the row",
"P-121-razbor-nds-usn-07": "crates of raw stock, a cable drum and a drum of oil standing together at a workshop gate with a bundle of purchase invoices on the topmost crate",
"P-121-razbor-nds-usn-08": "a stack of signed annual contracts lying on a desk with a price list clipped to the top sheet and a wall calendar hanging behind them",
"P-121-razbor-nds-usn-09": "a ledger, a calculator and two rate cards set out square on a desk with a blank contract clause sheet lying in front of them",
# P-97 карусель «7 формулировок»: мир стола, делённого линией, и проверок на месте
"P-97-karusel-formulirovki-01": "a bench divided by a scribed line with a folded letter lying on one side of it and a blank ruled form squared up on the other",
"P-97-karusel-formulirovki-02": "a cadastral extract lying on one side of a scribed bench line with a printed quarter plan on the other and a pencil across both",
"P-97-karusel-formulirovki-03": "a floor slab load plate screwed to a column beside a stapled structural calculation lying on the bench in front of the column",
"P-97-karusel-formulirovki-04": "a roof beam crossing a bay with a hanging plumb line dropped from its underside to the floor and a stepladder standing to one side of the line",
"P-97-karusel-formulirovki-05": "a switchboard standing open in a block with a load schedule taped inside its door and a dated printout lying on the bench below",
"P-97-karusel-formulirovki-06": "a folding rule stood across the clear width of a gate opening with the door of a lift car standing open along the wall beyond it",
"P-97-karusel-formulirovki-07": "an invoice with six ruled rows lying on a bench beside a bunch of keys, a broom and a marked waste bin standing against the wall",
"P-97-karusel-formulirovki-08": "a corridor of block doors with numbered plates beside each and a shift roster sheet pinned to a board at the end of the row",
"P-97-karusel-formulirovki-09": "a checklist form with seven ruled rows lying on a bench with a phone face up beside it and a pen resting across the sheet",
# P-122 карусель «29 против 177»: мир роботизированной ячейки и цеха вокруг
"P-122-cifry-robotizacia-01": "a fenced robot cell standing on a workshop floor with a single arm inside it and a long row of manual benches running away beside it",
"P-122-cifry-robotizacia-02": "a workshop floor marked out with the painted outlines of several planned cells and only one of them fitted with a fenced enclosure",
"P-122-cifry-robotizacia-03": "two fenced cells standing side by side in a bay, one complete with an arm and the other still an empty enclosure with anchor bolts set",
"P-122-cifry-robotizacia-04": "a crate holding a new robot arm standing on the apron in front of a gate with a delivery note taped to its lid and slings coiled beside",
"P-122-cifry-robotizacia-05": "a bay of manual benches with a single fenced cell at the far end and a painted floor line running from the benches to its gate",
"P-122-cifry-robotizacia-06": "a welding fixture on a bench with a stack of identical parts beside it and a scrap bin of rejects standing at the end of the bench",
"P-122-cifry-robotizacia-07": "an empty fenced cell marked out on a bay floor with anchor bolts set in the slab, a gate opening beyond it and a crane runway above",
"P-122-cifry-robotizacia-08": "a repetitive assembly bench in a bay with a tray of identical parts at each end and a tally sheet clipped to the rack above it",
# P-S истории «Пусковой ток»: мир щитовой и компрессорной
"P-S-puskovoy-tok-01": "a rating plate on the flank of a compressor with a gloved finger held beside its stamped figures and the machine casing behind it",
"P-S-puskovoy-tok-02": "an intake switch unit standing open with lead seals on its terminal cover and rows of breakers behind the door, cable glands below",
"P-S-puskovoy-tok-03": "a blank switchgear room wall of bare block with a cable tray running along it and nothing standing against the face of the wall",
"P-S-puskovoy-tok-04": "a printed equipment list lying on a bench beside a pocket calculator and a mug with a switchboard door standing open behind them",
# P-S истории «Граница работ»: мир границы стройплощадки и соседнего блока
"P-S-granica-rabot-01": "a mesh site fence with warning tape along its rail running past the gate of a working block, the two of them only a step apart",
"P-S-granica-rabot-02": "a printed route plan of a territory held open in gloved hands over the bonnet of a car with the site hoarding standing across the drive beyond it",
"P-S-granica-rabot-03": "a blank hoarding panel of a building site seen straight on with a swept strip of asphalt at its foot and nothing standing against it",
"P-S-granica-rabot-04": "a tablet held in gloved hands showing a bar chart of works with a site fence and a block gate out of focus beyond the hands",
# P-S истории «Самая больная проверка»: мир ворот блока и кадастровой карты
"P-S-samaa-bol-naa-proverka-01": "the closed gate of a production block with an address plate bolted to the wall beside it and a bollard set in the apron in front",
"P-S-samaa-bol-naa-proverka-02": "an empty noticeboard of steel mesh mounted on a block wall in a bay with a swept floor running to the wall and a bench pushed aside",
"P-S-samaa-bol-naa-proverka-03": "a phone propped against a folder on a bench showing a parcel map with one outline traced on the screen and an extract lying beside it",
# P-S истории «Суббота, город и часы отгрузки»: мир шлагбаума и ночной отгрузки
"P-S-subbota-casy-otgruzki-01": "the entrance barrier of a territory at dusk with its arm lowered across the drive and a lorry standing waiting in front of it",
"P-S-subbota-casy-otgruzki-02": "the roller gate of a block standing fully open at night with the bay lit inside and a swept apron running out from the threshold",
"P-S-subbota-casy-otgruzki-03": "an empty loading apron in front of a closed gate at night with painted bay lines across it and a bollard at the near corner",
# P-S истории «Суббота, стройка за забором»: мир стройплощадки и плана с осями
"P-S-subbota-strojka-za-zaborom-01": "the scaffolded facade of a building under construction seen against the light with working decks stacked up its height and a crane above",
"P-S-subbota-strojka-za-zaborom-02": "a construction site in daylight with formwork, a concrete pump and stacked reinforcement laid out on the ground inside the hoarding",
"P-S-subbota-strojka-za-zaborom-03": "a printed plan with a column grid held down on a desk by two machined blocks with a pair of dividers stepping along one of its axes",
# P-S истории «Утро в промзоне»: мир ворот блока и общего проезда
"P-S-obsij-proezd-utrom-01": "the roller gate of a block in the morning with a folding rule stood across the clear width of the opening and the yard beyond",
"P-S-obsij-proezd-utrom-02": "a queue of cars and vans standing nose to tail on the entrance drive of a territory with the barrier lowered at the head of the line",
"P-S-obsij-proezd-utrom-03": "the inner street of a territory between two rows of blocks with a hand trolley crossing it and numbered plates beside each gate",
# P-S истории «Пятница, размер кабины»: мир грузового лифта
"P-S-razmer-kabiny-lifta-01": "the inside of a goods lift car with a tape measure run out along the length of its floor and a rating plate beside the control panel",
"P-S-razmer-kabiny-lifta-02": "a goods lift landing with the car doors standing open onto an empty bay and a pallet truck parked against the wall beside them",
"P-S-razmer-kabiny-lifta-03": "the closed doors of a goods lift on a landing with a call panel beside them and a load plate screwed to the wall directly above",
# P-S истории «Воскресенье, список города»: мир разобранной вещи и вывесок корпуса
"P-S-voskresen-e-spisok-goroda-01": "a casing, a circuit board, a tray of fasteners and a folded carton laid out in one row on a bench seen from directly above",
"P-S-voskresen-e-spisok-goroda-02": "a blank steel panel of a workshop door seen straight on with a swept threshold at its foot and nothing fixed to the face of it",
"P-S-voskresen-e-spisok-goroda-03": "a name plate bolted beside the entrance door of a workshop building with a step and a swept apron in front of the doorway",
"P-S-voskresen-e-spisok-goroda-04": "the inner street of a territory in the evening with numbered gates down both sides and lamps on brackets along the wall above them",
}


# Ключи, переименованные в файлах недель месяца 3: после второго круга правок имя
# перестало отвечать содержанию единицы, а по имени собирается кадр. При вливании
# эти записи из паспорта убрать, иначе в `СЦЕНЫ` останутся мёртвые ключи со
# снятым углом, а генератор соберёт под ними старую сцену.
СТАРЫЕ_КЛЮЧИ = [
    # было -> стало, почему
    ("P-58-hodka-fury-b", "P-58-zavody-na-yuge",
     "угол переписан на промышленный пояс юга Москвы, в кадре теперь схема города, "
     "а не фура у ворот; суффикс -b снят, потому что повтором ходки фуры из месяца 2 "
     "единица больше не является"),
    ("P-S-subbota-i-bumagi", "P-S-sreda-dvenadcat-nedel",
     "серия выходит в среду и называется «Среда, 12 недель до пуска»: ни субботы, "
     "ни бумаг в кадрах не осталось, там двор и ворота корпуса"),
    ("P-32-vtoraya-ochered", "P-32-sem-dokumentov",
     "заголовок переписан на «7 документов можно требовать файлом», рубрика сменилась "
     "со «Стройки будущего» на «Цену ошибки», в кадре стол прораба с планом, "
     "а не вторая очередь стройки"),
    ("P-95-parkovka-550", "P-95-smena-v-08-00",
     "числа 550 в единице больше нет, угол переписан на поток смены в 08:00, "
     "рубрика сменилась со «Ста производств» на «Кадры цеха»"),
    ("P-S-subbota-marsrut-masiny", "P-S-subbota-casy-otgruzki",
     "серия переписана на «Суббота, город и часы отгрузки»: маршрут машины ушёл, "
     "остались шлагбаум, часы въезда и ночная отгрузка"),
]


# Кадры месяца 3, которые физически не генерируются. При вливании добавить в
# множество `БЕЗ_ГЕНЕРАЦИИ` паспорта. `P-92-peresmenka-reels` и
# `P-93-karusel-kvartal` там уже лежат: первый это Reels, второй схема на карте
# из официального источника с подписью и датой среза. Третий ключ туда надо
# дописать: кружок это непрерывное видео с телефона, статичного кадра у него нет.
# Сцены слайдов для `P-93-karusel-kvartal` в словаре всё же лежат: они написаны
# под тот случай, когда владелец решит рисовать слои поверх карты, и мёртвым
# грузом не висят, потому что `кадры_единицы` до них не доходит.
БЕЗ_ГЕНЕРАЦИИ_M3 = {"P-K-subbota-prohod-po-territorii"}


if __name__ == "__main__":
    # Самопроверка: длина, одно предложение, точки в конце нет, повторов нет.
    беды = 0
    видели = {}
    for имя, словарь in (("СЦЕНЫ_M3", СЦЕНЫ_M3), ("СЦЕНЫ_SLAJDOV_M3", СЦЕНЫ_SLAJDOV_M3)):
        for к, с in словарь.items():
            if not 90 <= len(с) <= 260:
                print(f"{имя} {к}: длина {len(с)}"); беды += 1
            if с.endswith(".") or ". " in с:
                print(f"{имя} {к}: не одно предложение"); беды += 1
            if с in видели:
                print(f"{имя} {к}: повтор сцены {видели[с]}"); беды += 1
            видели[с] = к
    print(f"сцен единиц: {len(СЦЕНЫ_M3)}, сцен слайдов: {len(СЦЕНЫ_SLAJDOV_M3)}, бед: {беды}")
