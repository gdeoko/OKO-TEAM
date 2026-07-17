#!/usr/bin/env python3
# МЕТАНОЙА · ежедневная активность IG (КОНСЕРВАТИВНО — аккаунт новый, беречь от бана).
# Лайкает несколько постов из ниши + подписывается на 1-2. БЕЗ комментариев (риск для нового акка).
# Лимиты жёсткие, паузы, стоп при любой блокировке. Best-effort — не падает.
import os, json, time, random, datetime, traceback
CFG="/opt/oko-poster/cfg"
TAGS=["воспитаниедетей","детскаяпсихология","мамаисын","православнаясемья","верадетям",
      "многодетнаясемья","детиибог","семейныеценности","воспитаниеслюбовью","детскаявера"]
def log(m): open(f"{CFG}/metanoia_engage.log","a").write(f"{datetime.datetime.utcnow():%m-%d %H:%M} {m}\n")
def slp(a=18,b=42): time.sleep(random.uniform(a,b))
try:
    from instagrapi import Client
    from instagrapi.exceptions import ClientError, PleaseWaitFewMinutes, FeedbackRequired
    d=json.load(open(f"{CFG}/ig_ekat_state.json"))
    sid=[c["value"] for c in d["cookies"] if c["name"]=="sessionid"][0]
    c=Client(); c.delay_range=[3,7]; c.login_by_sessionid(sid)
    # ротация тега по дню
    tag=TAGS[datetime.date.today().toordinal() % len(TAGS)]
    liked=followed=0
    try:
        medias=c.hashtag_medias_recent(tag, amount=8)
    except Exception as e:
        log(f"tag {tag} fail: {e}"); medias=[]
    random.shuffle(medias)
    for m in medias:
        if liked>=5: break
        try:
            c.media_like(m.id); liked+=1; log(f"like {m.code} (#{tag})"); slp()
        except (PleaseWaitFewMinutes, FeedbackRequired) as e:
            log(f"STOP block on like: {e}"); break
        except Exception as e:
            log(f"like skip: {e}"); continue
        # подписка на автора 1-го залайканного (макс 2/день)
        if followed<2 and random.random()<0.5:
            try:
                c.user_follow(m.user.pk); followed+=1; log(f"follow {m.user.username}"); slp()
            except (PleaseWaitFewMinutes, FeedbackRequired) as e:
                log(f"STOP block on follow: {e}")
            except Exception as e:
                log(f"follow skip: {e}")
    # записать сводку активности для отчёта бота
    json.dump({"tag":tag,"liked":liked,"followed":followed,
               "date":datetime.date.today().isoformat()}, open(f"{CFG}/metanoia_engage_last.json","w"))
    log(f"DONE tag={tag} liked={liked} followed={followed}")
    print(json.dumps({"tag":tag,"liked":liked,"followed":followed}))
except Exception as e:
    log(f"FATAL {e}\n{traceback.format_exc()[:400]}"); print(json.dumps({"err":str(e)}))
