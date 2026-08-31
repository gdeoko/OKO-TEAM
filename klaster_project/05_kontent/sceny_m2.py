# -*- coding: utf-8 -*-
"""Сцены кадров месяца 2: временный файл до вливания в паспорт.

Зачем он есть. Сцены кадров живут в `sborka_promtov.py` (словари `СЦЕНЫ` и
`СЦЕНЫ_СЛАЙДОВ`), но этот файл сейчас правит другой агент: он вписывает туда
сцены новых статей месяца 3. Две пачки правок в один файл затирают друг друга,
поэтому месяц 2 собран здесь отдельно и вливается в паспорт одним шагом, когда
файл освободится: `СЦЕНЫ_M2` идёт в `СЦЕНЫ`, `СЦЕНЫ_SLAJDOV_M2` в
`СЦЕНЫ_СЛАЙДОВ`, а ключи из `СТАРЫЕ_КЛЮЧИ` из паспорта вычищаются.

Правила записи те же, что в паспорте: одна английская фраза без точки в конце,
от 90 до 260 знаков, только предметы и их расположение в кадре. Цвет, свет,
оптику, бренд и типографику добавляет паспорт бренда, дублировать их в сцене
вредно: промпт распухает и правила спорят.

Сцены выведены из строк «Визуал:» в `MESYAC_2/NEDELYA_*.md`, сцена каждого
слайда - из его собственного заголовка и подписи. Слайд про ворота показывает
ворота, слайд про лифт показывает лифт; внутри одной серии сцены разные, но из
одного мира.

Проверить себя, не трогая паспорт:
    python3 sceny_m2.py
"""

# Кадр единицы: то, что видит камера в главном кадре поста, обложки статьи или
# первого слайда серии, если своей сцены у слайда нет.
СЦЕНЫ_M2 = {
# --- неделя 1: 28.09 - 04.10 ---
"P-10-metro-2028": "an industrial street in the early morning with long workshop fences and closed roller gates along both sides, a bus stop sign at the near kerb and residential towers standing at the far end of the street",
"P-211-shest-kategoriy": "the open door of a workshop switchgear room with six identical breaker modules stacked in one vertical column behind the glazed panel, bus bars and cable glands below them",
"P-11-shattl": "a shuttle bus standing at a marked stop beside the checkpoint of an industrial territory with its door open and a line of workers boarding it seen from behind, the barrier arm raised beyond",
"P-08-den-proizvodstva": "the inner street of an industrial territory at first light with roller gates being raised along the near side, cars arriving through the entrance and a wall clock bolted to a gate pillar",
"P-26-vc-ploshchadki-mira": "a working production hall standing inside a dense city block, its full height glazing open onto the bays while housing towers rise directly behind it and along both sides",
"P-S-cas-prostoa-masiny": "a semi trailer standing still at a closed roller gate with its engine off, a folded dock seal above the shutter and an empty concrete apron running away behind the vehicle",
"P-409-dzen-transportny-byudzhet": "a semi trailer standing at a workshop gate seen from inside the dark bay, the yard marking running away from the threshold in strict perspective across wet asphalt",
"P-202-tokar-3-goda": "the hands of a machinist resting on the cross slide handwheel of a worn lathe, cropped at the wrists so no face is in frame, curled steel swarf gathered on the bed beside them",
"P-S-sreda-v-cehe": "the entrance checkpoint of an industrial territory before dawn with a queue of cars waiting at the lowered barrier, headlight beams across wet asphalt and the guard window beside the drive",
"P-55-akt-priyomki": "an electricity meter with a sealed terminal cover mounted on a switchboard panel with a phone held up close to it in the near plane, cable glands entering the panel below",
"P-206-london-sil": "an aerial view of a dense industrial district beside a river where long workshop roofs and rail yards stop against rows of housing along a straight boundary through the frame",
"P-57-dzen-polnaya-stoimost": "a cost table drawn as a technical document on a sheet pinned flat to a steel panel with a straightedge across its lower rows, the printed body an unreadable grey texture",
"P-410-dzen-shest-punktov": "a stapled contract lying open on a steel bench with a machinist rule across the page and six small steel tabs standing along its edge, the printed body an unreadable grey texture",
"P-S-subbota-itogi-nedeli": "a stapled contract lying open on a steel bench with a pen resting on the page, a closed folder and a phone face down beside it at the far edge of the surface",
"P-212-tri-cifry-kadry": "a workshop bay seen along its line of machines with a lathe, a drill press and a bench grinder standing one behind the other, tools left out on the benches beside them and no one at any of them",
# --- неделя 2: 05.10 - 11.10 ---
"P-400-tehzadanie": "a technical brief form lying on a workbench with a tape measure and a phone face up beside it, the printed body an unreadable grey texture with four ruled fields filled by hand",
"P-17-geografiya": "a survey plan of the southern part of a city lying flat on a bench with the site marked by a scribed point, two road corridors running off the sheet and a straightedge across it",
"P-411-vc-indeksacia": "three steel bars of increasing height standing in a row on a bare concrete floor, evenly spaced, each casting its own long shadow toward the near edge of the frame",
"P-S-dvor-s-tocki-zrenia-voditela": "the yard of a territory seen at truck cab height with a roller gate straight ahead, a turning circle painted on the concrete and a wing mirror in the near corner of the frame",
"P-31-ig-smena": "a stream of workers walking from a shuttle stop toward the checkpoint of an industrial territory seen from behind, the barrier arm raised ahead of them and a block facade along the drive",
"P-10-metro-2028-b": "a metro construction site seen over the boundary fence of an industrial territory with a tower crane standing above a shoring pit, the closed block gates in the near part of the frame",
"P-418-dzen-stroyka-za-zaborom": "a construction hoarding running across the frame with a site traffic board mounted on a steel stand beside its gate, an excavator behind the fence and a working block beyond",
"P-203-29-vs-177": "a six axis robot arm at rest inside a production cell with safety fencing in the near plane, machine tools standing along the wall of the hall receding behind it",
"P-14-desyat-dney": "ten steel plates of equal size laid in one row on a workbench like a strip of days, each with a countersunk screw at its corner and a machinist rule running along the row",
"P-S-svobodnye-pomesenia": "an empty production block with its gate rolled fully open, an overhead crane hook hanging under the roof structure and a switchboard cabinet standing open against the near wall",
"P-204-ota-tokio": "a narrow low rise workshop street with shutters half raised along both sides, a small lathe standing inside one doorway and utility cables strung overhead between the buildings",
"P-412-rbk-promipoteka": "six steel tokens laid out in two rows of three on a workbench, evenly spaced, two of them turned face up and standing slightly proud of the surface beside a machinist rule",
"P-50-struktura-platezha": "a printed invoice lying on a bench with one of its rows ringed by hand and a pocket calculator standing beside it, the printed body an unreadable grey texture",
"P-S-subbota-i-karta": "a printed cadastral sheet of a city block lying on a bench beside a phone face up and a straightedge, one parcel outline on the sheet traced over by hand",
"P-413-dzen-priyomka": "a ring of keys and an acceptance form lying on the bare concrete floor of an empty block with a phone propped against them, the printed body of the form an unreadable grey texture",
# --- неделя 3: 12.10 - 18.10 ---
"P-55-akt-priyomki-b": "an acceptance form lying alone on the bare concrete floor of an empty bay with a pen across it, the printed body an unreadable grey texture and one of its fields ringed by hand",
"P-61-tri-shemy-sosedstva": "three drafting blocks milled side by side into a steel plate lying flat with connecting channels cut between them and a machinist square laid across the lower edge",
"P-207-brooklyn-navy-yard": "a working shipyard basin seen from the water with gantry cranes and long brick production sheds along the quay and a dense city skyline standing directly behind them",
"P-67-rbk-oblozhka": "five documents fanned across a desk in an office above a workshop with a pen on the top sheet and a folder standing at the edge, their printed bodies an unreadable grey texture",
"P-65-peregovory-shest": "a disagreement protocol lying on a desk with six hand marks down its margin and a paper clip at the corner, the printed body an unreadable grey texture",
"P-S-cena-vakansii": "two steel columns of visibly different height standing on a bare concrete floor facing each other across the frame, the taller one nearer the near edge of the picture",
"P-205-promtur-ekskursiya": "a group of visitors in hard hats standing along a mezzanine railing seen from behind and slightly above, a working production line running in the hall below them",
"P-414-vc-zarplaty": "two steel columns of visibly different height standing apart on a bare concrete floor, the taller one on the left, both rising from the same scribed base line",
"P-208-vakantnost-6-15": "a long empty production hall with a row of closed gates down one flank and floor marking still painted for machines that are gone, pallets stacked against the far wall",
"P-30-smena-nayem": "a survey plan of a district milled into a steel plate lying flat with a shallow circular groove cut around the marked site and housing blocks rendered as low relief inside it",
"P-402-platezh-po-strokam": "seven steel strips bolted flat in a stack onto a panel like the lines of an invoice, the sixth strip standing slightly proud of the others and screw heads at their ends",
"P-415-dzen-ohrana-truda": "a row of steel lockers along a workshop changing room wall seen straight on, doors closed, worn repainted metal and numbered hasps, a bench standing in front of them",
"P-S-subbota-doroga": "a shuttle stop beside the checkpoint of a territory at first light with the bus standing at its marked bay, the door open and the gate of the territory beyond it",
"P-416-rbk-nds-usn": "a machined gauge block standing upright on a workbench with a dial indicator on its stand resting against the face of the block, the dial itself an unreadable grey texture",
"P-S-1-oktabra": "an electricity meter mounted in an open switchboard in a production block with a printed bill lying on the bench below it, the printed body an unreadable grey texture",
# --- неделя 4: 19.10 - 25.10 ---
"P-50-struktura-platezha-b": "a printed rental invoice lying alone on a steel bench with one of its lower rows ringed by hand, the printed body an unreadable grey texture and a pen resting at the margin",
"P-58-hodka-fury": "a semi trailer swinging round in the middle of a yard with painted bay lines marking the turning circle beneath it and the long wall of a block closing the far side",
"P-401-subbota": "a yard with one sectional gate standing fully open on an otherwise closed row of blocks, the swept concrete apron empty in front of it and long shadows lying across it",
"P-21-karusel-moshchnost": "a main switchboard cabinet standing open in a production block with busbars and breaker rows behind its door and an equipment rating plate screwed to the panel beside it",
"P-419-rbk-12-voprosov": "an empty production hall seen down its centre line with columns receding in strict perspective and a numbered plate fixed to the nearest column, floor marking running away between them",
"P-S-strojka-radom": "a metro construction site seen over the boundary fence of a territory with a tower crane above a shoring pit and the closed gates of the blocks in the near part of the frame",
"P-209-promyshlenniy-okrug": "a residential district seen from above with a walled industrial territory pressed against its edge, workshop roofs and service yards on one side of the boundary and housing on the other",
"P-87-vc-oblozhka-sosedstvo": "the inner drive of an industrial territory running between two long blocks with their gates along both sides and a steel trolley standing on the apron between them",
"P-403-vtoraya-ochered": "a production building under construction in scaffolding with a tower crane standing above it and the finished facade of the first phase beside it in the same row",
"P-S-pyatnica-razbor-mosnosti": "a machine rating plate held in a hand close to the near edge of the frame with the open switchboard of the bay standing behind it and a workbench beyond",
"P-420-dzen-sosedi-po-stene": "two workers walking and talking in a yard beside the open gate of a block seen from behind, a trolley standing at the threshold and the block facade running away behind them",
}


# Сцена каждого слайда карусели и серии историй месяца 2. Ключ слайда собирает
# `кадры_единицы`: ключ единицы плюс номер слайда через дефис с ведущим нулём.
СЦЕНЫ_SLAJDOV_M2 = {
# P-08 карусель «Сутки на территории»: мир территории по часам, слайд за слайдом
"P-08-den-proizvodstva-01": "the entrance drive of an industrial territory before dawn with the first cars waiting at the barrier and the long facades of the blocks running away on both sides",
"P-08-den-proizvodstva-02": "a queue of cars at the raised barrier of a checkpoint at first light, their headlights on the wet drive and a guard window beside the lane",
"P-08-den-proizvodstva-03": "a semi trailer backed up to the ramp of a block with its doors open and a pallet truck standing on the ramp beside the load",
"P-08-den-proizvodstva-04": "a piston compressor on its receiver standing in a bay with its cover open, air lines running from it along the wall to the machines",
"P-08-den-proizvodstva-05": "a switchboard cabinet standing open in a bay at the busiest hour with every breaker way occupied and cable glands filling the lower gland plate",
"P-08-den-proizvodstva-06": "an overhead crane hook carrying a steel billet on slings across a bay, two workers walking it in from either side under the crane rail",
"P-08-den-proizvodstva-07": "a full parking field beside a block at shift change with a shuttle bus standing at its marked bay and people crossing the rows of cars",
"P-08-den-proizvodstva-08": "a bay working after dark with the gate half down, a machine set up under a task lamp and the rest of the hall standing quiet behind it",
"P-08-den-proizvodstva-09": "a semi trailer standing at an open gate late at night with the last pallets going aboard and the apron in front of it otherwise empty",
"P-08-den-proizvodstva-10": "a phone lying face up on a bench beside a block gate with a notebook and a pen next to it, the gate standing open onto the yard",
# P-S истории «Час простоя машины»: мир двора и ворот
"P-S-cas-prostoa-masiny-01": "a semi trailer stopped in front of a closed roller gate before the shift with its cab dark, a folded dock seal above the shutter and the apron empty",
"P-S-cas-prostoa-masiny-02": "a turning circle in the middle of a yard with painted bay lines across it, two trailers waiting nose to tail along the wall and a pallet truck at the kerb",
"P-S-cas-prostoa-masiny-03": "a shipping log book lying open on a crate beside a loading gate with a pen across the page and the empty apron beyond the threshold",
# P-S истории «Среда, 06:00»: мир проходной и цеха на рассвете
"P-S-sreda-v-cehe-01": "a line of cars standing nose to tail at a lowered barrier before dawn with a guard window beside the lane and the closed gate of the territory ahead",
"P-S-sreda-v-cehe-02": "an industrial wall clock bolted to the pillar of an entrance gate with its hands and figures worn away, the closed gate leaf behind it",
"P-S-sreda-v-cehe-03": "a steel billet on slings hanging just clear of a workbench under an overhead crane, one worker at each end holding it steady and the crane rail running above them",
"P-S-sreda-v-cehe-04": "the closed roller gate of a block with a numbered plate beside it and a swept apron in front, a steel trolley parked against the wall",
# P-206 карусель «Лондон SIL»: мир города сверху и его печатных планов
"P-206-london-sil-01": "an aerial view of a dense industrial district beside a river where long workshop roofs and rail yards fill the near half of the frame and housing begins along a straight boundary",
"P-206-london-sil-02": "a printed city plan spread flat on a bench with one district outlined by a scribed border and a straightedge laid along its edge",
"P-206-london-sil-03": "a printed city plan on a bench with fifty odd small patches hatched across it in a scattered pattern and a pair of dividers standing on the sheet",
"P-206-london-sil-04": "a printed district plan on a bench showing a handful of small workshop yards outlined among housing blocks, a pencil resting where two of them meet",
"P-206-london-sil-05": "a printed city plan on a bench with a third of its hatched patches rubbed away to blank paper, an eraser and a pencil lying on the cleared area",
"P-206-london-sil-06": "an aerial view of a workshop yard with a residential block standing inside its boundary, scaffolding on the new building and truck bays still working around it",
"P-206-london-sil-07": "a narrow workshop street inside a city with a delivery van, a waste skip and stacks of printed board and timber standing at the open shutters along it",
"P-206-london-sil-08": "a printed cadastral sheet lying on a bench beside a phone face up, a straightedge across the sheet and a pencil resting on one parcel outline",
# P-S истории «Суббота, что забрать с недели»: мир стола с договором
"P-S-subbota-itogi-nedeli-01": "a stack of contract copies squared up on a steel bench with a pen lying across the top sheet and a folder standing closed at the far edge",
"P-S-subbota-itogi-nedeli-02": "a phone lying face up on a steel bench beside an open contract with six small steel tabs standing along the page edge and a pen resting between them",
"P-S-subbota-itogi-nedeli-03": "an empty steel bench with a single contract page lying face down on it and a pen resting across the blank back of the sheet",
# P-17 карусель «Час в дороге»: мир съёмочного плана юга города на верстаке
"P-17-geografiya-01": "a survey plan of a city district lying flat on a bench with one wide circle scribed around a marked point and a pair of dividers standing open on the sheet",
"P-17-geografiya-02": "a survey plan on a bench with a single parcel outlined near a ring road and a straightedge measuring the gap between the parcel and the ring",
"P-17-geografiya-03": "a survey plan on a bench with two road corridors running from a marked point out to a ring road and a pencil laid along one of them",
"P-17-geografiya-04": "a survey plan on a bench showing an inner ring road with a route drawn from the marked point into the centre and a pair of dividers stepping along it",
"P-17-geografiya-05": "a survey plan on a bench with two circles of different size scribed around the same point, the outer one running off the edge of the sheet",
"P-17-geografiya-06": "a survey plan on a bench covered with small scribed marks scattered across its housing blocks, a phone face up beside it and a pencil in the margin",
"P-17-geografiya-07": "a survey plan on a bench with a short route drawn between a metro symbol and a marked site, a timetable card and a parking plan lying beside the sheet",
# P-S истории «Двор с точки зрения водителя»: мир двора от кабины
"P-S-dvor-s-tocki-zrenia-voditela-01": "a turning circle in a yard seen from cab height through a windscreen, painted bay lines curving across the concrete and a block wall closing the far side",
"P-S-dvor-s-tocki-zrenia-voditela-02": "a yard seen from the threshold of a gate with one trailer already standing at the next gate along the wall and a second one entering the drive beside it",
"P-S-dvor-s-tocki-zrenia-voditela-03": "a yard corner where the painted bay lines run into a kerb and a bollard, a trolley parked against the wall and the block gate standing shut behind",
# P-14 карусель «10 дней до заезда»: мир пути арендатора от звонка до ворот
"P-14-desyat-dney-01": "a folded equipment data sheet left lying on the concrete floor of an empty bay with a tape measure beside it, the printed body an unreadable grey texture",
"P-14-desyat-dney-02": "a phone lying face up on a workbench beside a technical brief form and a pen, the printed body of the form an unreadable grey texture with four ruled fields",
"P-14-desyat-dney-03": "an empty bay with its roller gate rolled up, a tape measure hooked across the opening and a folding rule standing on the floor in the near plane",
"P-14-desyat-dney-04": "a stapled contract lying open on a meeting table with two chairs pulled to the same side of it, a pen across the page and a folder closed at the far edge",
"P-14-desyat-dney-05": "three document folders laid side by side on a bench with a straightedge across their lower edges, their printed bodies an unreadable grey texture",
"P-14-desyat-dney-06": "a machine strapped to a rigging skate on the apron in front of an open gate with an overhead crane hook lowered above it and slings coiled on the concrete",
"P-14-desyat-dney-07": "a tape measure, a folding rule and a folded drawing sheet laid out in a row on a workbench with a pen at the end of the row",
# P-S истории «Свободные помещения»: мир пустого блока
"P-S-svobodnye-pomesenia-01": "a switchboard cabinet standing open in an empty bay with breaker rows in a strict column behind its door and cable glands entering the panel from below",
"P-S-svobodnye-pomesenia-02": "an overhead crane hook and its trolley seen from the floor directly below, the crane rail and roof structure of a tall bay running away above them",
"P-S-svobodnye-pomesenia-03": "the open roller gate of an empty block seen from the yard with a swept concrete floor inside and a numbered plate fixed to the wall beside the opening",
# P-S истории «Суббота и карта»: мир проверки своего участка
"P-S-subbota-i-karta-01": "a printed block plan lying flat on a bench with two parcel outlines redrawn over each other and a pair of dividers standing on the sheet",
"P-S-subbota-i-karta-02": "a phone propped against a folder on a bench with a block plan open on its screen and a printed cadastral sheet lying beside it",
"P-S-subbota-i-karta-03": "the boundary fence of a territory with an address plate bolted to its post, the block gates and the yard visible through the gap beside it",
# P-207 карусель «Brooklyn Navy Yard»: мир верфи внутри города
"P-207-brooklyn-navy-yard-01": "an industrial waterfront with dry docks and gantry cranes filling the near half of the frame and a dense city skyline rising across the water behind them",
"P-207-brooklyn-navy-yard-02": "an empty dry dock of an old naval yard with stepped stone walls and a caisson gate at its end, brick workshop buildings standing along the rim",
"P-207-brooklyn-navy-yard-03": "a long brick production shed on a quay with a row of numbered roller doors along its flank, small vans and stacked crates standing in front of them",
"P-207-brooklyn-navy-yard-04": "the gate of a waterfront yard at shift change with a stream of workers walking through it seen from behind and bicycles racked along the fence beside them",
"P-207-brooklyn-navy-yard-05": "a loaded barge tied at a quay wall with a gantry crane lifting a crate over it, the sheds of the yard running away along the waterfront",
"P-207-brooklyn-navy-yard-06": "the inside of a converted shipyard shed divided into workshop bays by steel mesh partitions, timber, machinery and film lamps standing in the separate bays",
"P-207-brooklyn-navy-yard-07": "a tall brick machine hall with its original roof trusses left in place and workbenches carrying prototype rigs set out in rows on the floor beneath them",
"P-207-brooklyn-navy-yard-08": "an aerial view of a walled industrial yard on a waterfront with its sheds, dry docks and service roads inside the boundary and the city grid pressing against it",
# P-S истории «Цена вакансии»: мир пустых рабочих мест
"P-S-cena-vakansii-01": "two steel columns of different height standing side by side on a workshop floor, the taller one on the left and both squared to the same base line",
"P-S-cena-vakansii-02": "three empty workstations standing in a row in one bay, a lathe with its chuck idle, a drafting bench and a desk, none of them occupied",
"P-S-cena-vakansii-03": "an empty welding station in a bay with the mask hanging on its hook, the torch coiled on the bench and the workpiece untouched",
# P-208 карусель «Вакантность 6 против 15,5»: мир пустеющих цехов
"P-208-vakantnost-6-15-01": "three steel bars of rising height standing in a row on the concrete floor of an empty hall, the tallest of them nearest the near edge of the frame",
"P-208-vakantnost-6-15-02": "a bay packed to the walls with pallets and part bins with only a narrow aisle left through the middle of it",
"P-208-vakantnost-6-15-03": "a production hall half emptied of equipment, machines standing along one side and anchor holes left in the bare floor along the other",
"P-208-vakantnost-6-15-04": "a row of six block gates in one long facade with one of them standing open onto an empty bay and the rest of them shut",
"P-208-vakantnost-6-15-05": "the interior of a newly built bay still under construction with a grid of raw concrete columns receding, a clean poured floor and no equipment anywhere",
"P-208-vakantnost-6-15-06": "a printed rate sheet lying on a bench with a pocket calculator beside it, the printed body an unreadable grey texture and a straightedge across one row",
"P-208-vakantnost-6-15-07": "an empty bay with its gate rolled fully up, a heavy machine bed anchored into the floor in the near plane and a switchboard cabinet open on the wall",
# P-S истории «Суббота, дорога»: мир дороги смены
"P-S-subbota-doroga-01": "an empty shuttle stop by a territory checkpoint before dawn with a route sign on its post and a bench under the shelter, the drive running away past it",
"P-S-subbota-doroga-02": "a shuttle bus standing at its marked stop with the door open and a line of workers boarding it seen from behind, the checkpoint barrier raised beyond",
"P-S-subbota-doroga-03": "the inner drive between two blocks on a quiet morning with the gates shut along both sides and a single figure walking away down the middle of it",
# P-S истории «1 октября»: мир счётчика и счёта
"P-S-1-oktabra-01": "a wall calendar hanging beside a switchboard in a workshop with its sheets torn down to a single remaining page and a pencil hooked on its wire",
"P-S-1-oktabra-02": "a pocket calculator lying on a workbench beside an open ledger with a pen across the page, the printed body an unreadable grey texture",
"P-S-1-oktabra-03": "a printed electricity bill lying on a workbench beside a folded tariff sheet with a straightedge across one of its rows",
# P-21 карусель «Мощность»: мир щитовой и оборудования цеха
"P-21-karusel-moshchnost-01": "a building intake switchgear lineup standing along a wall and a small distribution board fixed beside it in the same frame, both with their doors open",
"P-21-karusel-moshchnost-02": "two rating plates screwed side by side to a steel panel, one large and one small, their stamped characters worn to unreadable relief",
"P-21-karusel-moshchnost-03": "a rating plate screwed to the flank of a compressor with a lathe, a welding set and a ventilation unit standing behind it along the bay wall",
"P-21-karusel-moshchnost-04": "a row of machines along one side of a bay with only one of them set up for work and the rest under covers, their cables coiled on the floor",
"P-21-karusel-moshchnost-05": "a piston compressor standing on its receiver beside a switchboard with one breaker in the open board tripped to the middle position",
"P-21-karusel-moshchnost-06": "a three phase industrial socket and a single phase outlet mounted on the same wall panel of a bay with a machine plug lying on the floor beneath them",
"P-21-karusel-moshchnost-07": "a distribution board with every breaker way occupied and one empty slot left at the end of the rail, a blanking plate lying on the bench below",
"P-21-karusel-moshchnost-08": "a switchboard cabinet standing open beside a bench where a technical conditions sheet lies with a pen across it, its printed body an unreadable grey texture",
# P-S истории «Стройка рядом»: мир границы со стройплощадкой метро
"P-S-strojka-radom-01": "a construction site seen through the mesh of a boundary fence with a tower crane standing over a shoring pit and a walking route running along the fence line",
"P-S-strojka-radom-02": "the checkpoint of a territory with a direction sign on a post beside the barrier pointing away down the road toward a distant tower crane",
"P-S-strojka-radom-03": "the drive from a territory gate running toward a construction hoarding at the end of the street with cones along its kerb and a block facade on one side",
# P-209 карусель «Промышленный округ»: мир округа сверху и его промзоны
"P-209-promyshlenniy-okrug-01": "an aerial view of a city district where housing blocks and walled workshop yards stand side by side, the boundary between them running straight through the frame",
"P-209-promyshlenniy-okrug-02": "the blank boundary fence of an industrial territory along a residential street with a closed checkpoint gate set into it and no signage on the wall",
"P-209-promyshlenniy-okrug-03": "an old locomotive depot with a fan of rail tracks running into its arched doorways and a brick chimney standing behind the roofline",
"P-209-promyshlenniy-okrug-04": "an aerial view of a workshop territory ringed by housing blocks built right up to its fence, the older sheds unchanged inside the boundary",
"P-209-promyshlenniy-okrug-05": "a footpath running from a residential courtyard to the checkpoint of an industrial territory with people walking it seen from behind",
"P-209-promyshlenniy-okrug-06": "stacks of flat pack furniture panels, cardboard packaging, metal fittings and printed sheets standing together on the apron of a loading gate",
"P-209-promyshlenniy-okrug-07": "a closed workshop gate in a long blank facade with only a numbered plate beside it and a camera on a bracket above, the street empty in front",
"P-209-promyshlenniy-okrug-08": "a line of vans, a waste truck and a delivery lorry queued at the exit gate of a territory, the yard behind them emptied and its gates shut",
"P-209-promyshlenniy-okrug-09": "a printed city plan lying on a bench with several walled industrial quarters outlined among the housing and a pencil resting on the nearest one",
# P-S истории «Пятница, разбор мощности»: мир шильдика, щитовой и расчёта
"P-S-pyatnica-razbor-mosnosti-01": "a rating plate on the flank of a compressor held close in a gloved hand, its stamped characters worn to relief and the machine body behind it",
"P-S-pyatnica-razbor-mosnosti-02": "a ventilation unit, a heater and a forklift charger standing together along the wall of a bay with their cables run to one distribution board",
"P-S-pyatnica-razbor-mosnosti-03": "the intake switchgear of a block standing open against the wall with a calculation sheet on the bench in front of it, its printed body an unreadable grey texture",
}


# Ключи, переименованные в файлах недель месяца 2: имя больше не отвечало
# содержанию единицы. При вливании эти записи из паспорта убрать, иначе в
# `СЦЕНЫ` останутся мёртвые ключи, а в `promts_new/gruppa_dobor.json` -
# промпты под старыми именами.
СТАРЫЕ_КЛЮЧИ = [
    # было -> стало, почему
    ("P-202-tokar-55", "P-202-tokar-3-goda",
     "цифры по возрасту 55+ ушли в пост ВКонтакте 04.10, в единице остался срок, "
     "за который станочник набирает точность"),
    ("P-S-ponedel-nik-v-cehe", "P-S-sreda-v-cehe",
     "серия историй выходит в среду 30.09 и называется «Среда, 06:00»"),
    ("P-S-voskresen-e-itogi-nedeli", "P-S-subbota-itogi-nedeli",
     "серия выходит в субботу 03.10 и называется «Суббота, что забрать с недели»"),
    ("P-S-voskresen-e-i-karta", "P-S-subbota-i-karta",
     "серия выходит в субботу 10.10 и называется «Суббота и карта»"),
    ("P-S-voskresen-e-doroga", "P-S-subbota-doroga",
     "серия выходит в субботу 17.10 и называется «Суббота, дорога»"),
    ("P-419-rbk-vakantnost", "P-419-rbk-12-voprosov",
     "материал РБК переписан под другой угол: 12 вопросов арендодателю, "
     "вакантность разбирает карусель 15.10"),
    ("P-S-vtornik-razbor-mosnosti", "P-S-pyatnica-razbor-mosnosti",
     "серия выходит в пятницу 23.10 и называется «Пятница, разбор мощности»"),
]


# БЕЗ_ГЕНЕРАЦИИ месяца 2 проверено, править нечего: из множества в паспорте на
# месяц 2 приходится один ключ, `P-94-kvartal-karta` - карта квартала из
# официального источника с подписью и датой среза, нейросетью она не рисуется.
# Остальные ключи множества живут в месяцах 1 и 3. Добавлять в месяце 2 нечего:
# кружок 12.10 и Reels 28.09 ссылки на промпт не имеют вовсе и до генератора не
# доходят, а фото квартала Ота-ку 09.10 идёт лицензионным снимком из открытых
# источников, но кадр под него в паспорте уже есть, и убирать его без решения
# владельца значит оставить единицу вообще без визуала.


if __name__ == "__main__":
    # Самопроверка: длина, одно предложение, точки в конце нет.
    беды = 0
    for имя, словарь in (("СЦЕНЫ_M2", СЦЕНЫ_M2), ("СЦЕНЫ_SLAJDOV_M2", СЦЕНЫ_SLAJDOV_M2)):
        for к, с in словарь.items():
            if not 90 <= len(с) <= 260:
                print(f"{имя} {к}: длина {len(с)}"); беды += 1
            if с.endswith(".") or ". " in с:
                print(f"{имя} {к}: не одно предложение"); беды += 1
    print(f"сцен единиц: {len(СЦЕНЫ_M2)}, сцен слайдов: {len(СЦЕНЫ_SLAJDOV_M2)}, бед: {беды}")
