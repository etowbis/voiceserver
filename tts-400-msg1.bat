@echo off
echo { > tts.json
echo   "ssml": "<speak>Hey Dudette<break time='2s'/>It is definitely working and that is fun<break time='1s'/><prosody rate='fast' pitch='+3st'><emphasis level='strong'>Hurry up!!</emphasis></prosody></speak>" >> tts.json
echo } >> tts.json

curl -X POST -H "Content-Type: application/json" --data @tts.json http://192.168.0.231:3000/say

del tts.json
pause
