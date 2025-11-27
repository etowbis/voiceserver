const express = require('express');
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');
const { exec } = require('child_process');

const app = express();

// Parse JSON bodies
app.use(express.json());

// Promisified writeFile
const writeFile = util.promisify(fs.writeFile);

// HARD-CODED Google credentials on the Pi
const client = new textToSpeech.TextToSpeechClient({
  keyFilename: '/home/et101/proj/voiceserver/gcloud-tts.json', // <-- change if your path is different
});

const PORT = 3000;
const OUTPUT_FILE = '/tmp/output.wav';

// Global crash guards so Node doesn't silently exit
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

async function handleSpeak(req, res) {
  console.log('-----------------------------');
  console.log('NEW REQUEST at', new Date().toISOString());
  console.log('Request body:', JSON.stringify(req.body));

  try {
    const { text, ssml } = req.body || {};

    if (!text && !ssml) {
      console.error('No "text" or "ssml" field in body');
      return res.status(400).json({ error: 'Provide either "text" or "ssml" in JSON body.' });
    }

    // Prefer SSML if present
    const input = ssml ? { ssml } : { text };

    const request = {
      input,
      voice: {
        languageCode: 'en-US',
		name: 'en-US-Neural2-C',
		
        // You can change this to another supported voice if you like
        // name: 'en-US-Neural2-C',
      },
      audioConfig: {
        audioEncoding: 'LINEAR16',
        sampleRateHertz: 24000,
      },
    };

    console.log('TTS request.input:', request.input);

    const [response] = await client.synthesizeSpeech(request);

    if (!response.audioContent) {
      console.error('TTS returned no audioContent');
      return res.status(500).json({ error: 'TTS returned empty audio' });
    }

    console.log('TTS audio bytes:', response.audioContent.length);

    await writeFile(OUTPUT_FILE, response.audioContent, 'binary');
    console.log('Wrote audio file:', OUTPUT_FILE);

    // Use plughw:0,0 (this is what you confirmed works)
    exec(`aplay -D plughw:0,0 ${OUTPUT_FILE}`, (error, stdout, stderr) => {
      if (error) {
        console.error('aplay error:', error, stderr);
      } else {
        console.log('aplay OK:', stdout);
      }
    });

    res.json({ ok: true, mode: ssml ? 'ssml' : 'text' });
  } catch (err) {
    console.error('TTS ERROR in handler:', err);
    res.status(500).json({
      error: 'TTS failed',
      detail: String(err.message || err),
    });
  }
}

// Support both /speak (old) and /say (new)
app.post('/speak', handleSpeak);
app.post('/say', handleSpeak);

// Express error middleware (last line of defence)
app.use((err, req, res, next) => {
  console.error('Express middleware error:', err);
  res.status(500).json({ error: 'Server error', detail: String(err.message || err) });
});

app.listen(PORT, () => {
  console.log(`Voice server listening on port ${PORT}`);
});
