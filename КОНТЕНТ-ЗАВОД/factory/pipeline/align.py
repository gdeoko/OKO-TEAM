from faster_whisper import WhisperModel
import json
WD="/tmp/claude-0/-home-user-OKO-TEAM/f6f2aa4f-e22a-54d1-83e7-29eece9e291a/scratchpad/reel02"
m=WhisperModel("small", device="cpu", compute_type="int8")
segs,_=m.transcribe(f"{WD}/work/vo.mp3", language="ru", word_timestamps=True)
words=[]
for s in segs:
    for w in s.words:
        words.append({"w":w.word.strip(),"a":round(w.start,2),"b":round(w.end,2)})
json.dump(words, open(f"{WD}/work/words.json","w"), ensure_ascii=False)
print("слов:",len(words))
print(" ".join(x["w"] for x in words[:20]))
