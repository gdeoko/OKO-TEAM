#!/bin/bash
source <(base64 -d /home/user/OKO-TEAM/secrets.env.b64 2>/dev/null) 2>/dev/null
M=/home/user/OKO-TEAM/oko-app/academy/motion; CA=/root/.ccr/ca-bundle.crt
i=4
for q in "lofi+chill" "future+bass" "minimal+techno" "energetic+pop+instrumental" "deep+focus+ambient" "hip+hop+beat+instrumental" "synthwave" "dramatic+cinematic" "chillhop" "tech+house" "uplifting+corporate" "downtempo" "motivational+trap" "electronic+groove"; do
  [ -s "$M/audio/music/bed_$i.mp3" ] && { i=$((i+1)); continue; }
  R=$(curl -s --max-time 22 --cacert $CA "https://freesound.org/apiv2/search/text/?query=$q&filter=duration:%5B60+TO+240%5D&fields=id,previews&sort=downloads_desc&page_size=1&token=$FREESOUND_API_KEY")
  URL=$(echo "$R" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(j.results&&j.results[0]?j.results[0].previews["preview-hq-mp3"]:"")}catch(e){console.log("")}})')
  if [ -n "$URL" ]; then curl -s --max-time 45 --cacert $CA "$URL" -o "$M/audio/music/bed_$i.mp3"; sz=$(stat -c%s "$M/audio/music/bed_$i.mp3" 2>/dev/null||echo 0); [ "$sz" -gt 50000 ] && { echo "bed_$i ok"; i=$((i+1)); } || rm -f "$M/audio/music/bed_$i.mp3"; fi
done
echo "DONE beds=$(ls $M/audio/music/*.mp3|wc -l)"
