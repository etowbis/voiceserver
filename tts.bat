@echo off
REM --- Create a temporary JSON file with SSML content ---
echo { > tts.json
echo   "ssml": "<speak><google:style name='lively'>Hey Dude...<break time='3s'/>Time For DINNER<break time='1s'/><emphasis level='strong'> hurry up!!</emphasis></google:style></speak>" >> tts.json
echo } >> tts.json

REM --- Send it to the BeagleBone ---
curl -X POST -H "Content-Type: application/json" --data @tts.json http://192.168.1.184:8080/speak

REM --- Clean up ---
del tts.json

echo.
echo Done.
pause
