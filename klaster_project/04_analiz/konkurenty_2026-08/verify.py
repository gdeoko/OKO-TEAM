"""Точная проверка выбранных роликов + аватарки каналов.

Медленный проход по одному ролику с паузой - как требует эталон, иначе YouTube
придерживает цифры и вместо точных просмотров приходят нули.
"""
import json, re, sys, time
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, "/home/user/oko-agents")
from core import competitor_research as cr

БАЗА = "/tmp/claude-0/-home-user-oko-agents/33fe8496-acfc-5a27-9b2b-b2000b0ee729/scratchpad"

ВЫБОР = [
 # (хендл, [id роликов])
 ("@CommercialPropertyAdvisors", ["FDRu4k0fJ_U", "I5G112h_e2E", "lf9_SOZdOjs"]),
 ("@KenMcElroy",                 ["TY7b8qRIfFk", "SrdS4DfYX_E"]),
 ("@Mashkov_D",                  ["VyQGyYfRRXs", "aV4FN1IGh1w", "djEe7TbCbMM"]),
 ("@smirnov_real_estate",        ["FHeyl38QPxY", "uobgm0oSxTM", "bL-HvCAVJrc"]),
 ("@smarent",                    ["oiZd0yHridM", "hGqu3HzUf4o", "5dBLuoEuhtk"]),
 ("@InvestFutureRu",             ["lTRcnAjNg3Y", "iuKI7JPQjsY", "tjc5FSdtmsQ"]),

 ("@BusinessInsider",            ["n5x7GLl-mMo", "S9F-u4T7leQ", "K0OtGIPRcAs"]),
 ("@FD_Engineering",             ["6I6D3TT5Vmk", "fxm9NCe4anc", "0bbvJixWtuQ"]),
 ("@howitsmadefactories",        ["yxz8OfPpdWI", "oVmryr6LxIM", "zMma0kSo3Pk"]),
 ("@Huggbees",                   ["-3v4OsPmsUg", "8xQ5wdilf4Y", "Z-zR1SgrM-w"]),
 ("@kaketosdelano",              ["YIjrYSP2i8o", "dX_Dfwjchs8", "MMtweSzpqIw"]),
 ("@tvzrru",                     ["N8F33ijkfF4", "C4wvpgESWzY", "hG67UlZrpLs"]),
 ("@KonstantinPro",              ["g4NmVIqddH4", "LWSbEvUhSrg", "TAe9AJ1M42o"]),
 ("@techzone1843",               ["8qjTwSY4Pa4", "IDYYJmv8LJs", "Uaaof0DHs8k"]),
 ("@mashnewstv",                 ["ia7UrN0BEDM", "V8LBTTmEalY", "s7LRUohM6QA"]),
 ("@Razborshik",                 ["HE71Mz0H37U", "YLFyc00Kg9c", "NQrdXKU4vVI"]),

 ("@TITANSofCNC",                ["9ymAs53DzbI", "8oUGddr6UYg", "2lJIfmBB7L4"]),
 ("@CuttingEdgeEngineering",     ["zwBPb-WjwWc", "zvKG5dgUHNw", "-S6IMTOuLYQ"]),
 ("@Abom79",                     ["xXIvoGRHEoU", "FLYdhfgF6Pg", "4i0g8vWeliI"]),
 ("@InheritanceMachining",       ["j27RKTHMLkA", "awkhVmcxgR0", "7am-ysvGD3s"]),
 ("@FireballTool",               ["s3O2hwLcVUE", "VcbTopj5u7A", "CKgwcuAvM6E"]),
 ("@nyccnc",                     ["wHstzxuryMk", "gJ7pAxUwu2o", "sJm6P6qJetk"]),
 ("@G0RDEEN",                    ["W6DTQ2orCUc", "Tu8H55_fUtk", "siQnUlzfh_Y"]),

 ("@UpFlip",                     ["-8TnsjDRXUE", "O995lrTYb40", "-s_Y-O1nosw"]),
 ("@ToBizru",                    ["azF5TuIoo5I", "-2gyFohnnS8", "wNLpKAb_ILI"]),
 ("@Igor_Rybakov",               ["Tz2BuTnKqPk", "neYFIKup3MU", "Zs6lTMnLsX0"]),
 ("@amo_blog",                   ["JkErRT5_9N8", "DboSQEH1N2s", "ORhFkbMDw9Y"]),
 ("@BigMoneylive",               ["Ru6e36X5lLg", "ejvSL90eV8U", "BW2JC9FRpFM"]),
 ("@BiZSekrety",                 ["dnmgnDqKL9c", "IdQrGkO6GM8", "ll2KFqlCTO4"]),

 ("@varlamov",                   ["54eIyebf0lg", "ICh_JfOGBDA", "3S3e0-WbEh4"]),
 ("@PROMETRO",                   ["9HIoLRHNVVo", "6NAzEqLe2og", "VByt-gxkD5A"]),
 ("@MoscowWalks",                ["KU2aVk9u3QI", "AJHFJ2zk3eA", "usuOur3NwpY"]),
 ("@podzemnayamoskva",           ["F0V6vTOVo4U", "gJC0eL3-4QQ", "p6n6ie8EtVw"]),
 ("@Promturist",                 ["yOAZ1FcHxag", "yRRM-BaTO2g"]),

 ("@ForumHouseTV",               ["6xZ0XXa-bvE", "d73il_QUG3U", "7znXEZg4fyg"]),
 ("@stroyizhivi",                ["mjbEkuo0MEA", "J6cPgP7Q-mY", "fRYO9QsGHcU"]),
 ("@LOFTDIY",                    ["rwXX_NrNXow", "Ojd7v4o-0Dw", "upuaUhzDKIc"]),

 ("@BostonDynamics",             ["fUyU3lKzoio", "kgaO45SyaO4", "fn3KWM1kuAw"]),
 ("@dhl",                        ["tu3z_16UFGM", "Nkx2rwlDpFc", "gtbBb91xIUM"]),
]


def аватар(handle):
    html = cr._get(f"https://www.youtube.com/{handle}")
    m = re.search(r'"avatar":\{"thumbnails":\[\{"url":"(https://yt3\.[^"]+?)"', html)
    if not m:
        m = re.search(r'(https://yt3\.googleusercontent\.com/[^"\\]+?=s(?:160|176|900)[^"\\]*)', html)
    return m.group(1).replace("\\u0026", "&") if m else ""


if __name__ == "__main__":
    скан = json.load(open(f"{БАЗА}/scan.json"))
    итог = []
    ids = [(h, v) for h, vs in ВЫБОР for v in vs]
    print("роликов к проверке:", len(ids), flush=True)

    точные = {}
    with ThreadPoolExecutor(max_workers=3) as ex:
        def работа(п):
            h, vid = п
            d = cr.verify_video(vid)
            time.sleep(0.8)
            return vid, d
        for vid, d in ex.map(работа, ids):
            точные[vid] = d
            print(("OK " if d.get("ok") else "НЕТ "), vid, f'{d.get("views",0):,}', flush=True)

    with ThreadPoolExecutor(max_workers=5) as ex:
        авы = dict(zip([h for h, _ in ВЫБОР], ex.map(аватар, [h for h, _ in ВЫБОР])))

    for h, vs in ВЫБОР:
        c = скан.get(h, {})
        листинг = {v["id"]: v for v in c.get("videos", [])}
        ролики = []
        for vid in vs:
            т = точные.get(vid, {})
            л = листинг.get(vid, {})
            if т.get("ok"):
                ролики.append({"id": vid, "url": т["url"], "title": т["title"] or л.get("title", ""),
                               "views": т["views"], "likes": т["likes"], "date": т["date"],
                               "cover": т["cover"], "approx": False})
            else:
                ролики.append({"id": vid, "url": f"https://www.youtube.com/watch?v={vid}",
                               "title": л.get("title", ""), "views": л.get("views", 0),
                               "cover": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg", "approx": True})
        итог.append({"handle": h, "name": c.get("name", h.lstrip("@")), "yt": c.get("url"),
                     "subs": c.get("subs", 0), "avatar": авы.get(h, ""), "videos": ролики})

    json.dump(итог, open(f"{БАЗА}/verified.json", "w"), ensure_ascii=False, indent=1)
    точн = sum(1 for c in итог for v in c["videos"] if not v.get("approx"))
    всего = sum(len(c["videos"]) for c in итог)
    print(f"\nконкурентов: {len(итог)}, роликов: {всего}, точных цифр: {точн}", flush=True)
    print("от 1 млн подписчиков:", len([c for c in итог if c["subs"] >= 1_000_000]), flush=True)
