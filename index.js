const express = require('express');
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');
const { exec } = require('child_process');

const app = express();

// Make sure JSON bodies are parsed
app.use(express.json());

// Hard-code your credentials file path on the Pi
const client = new textToSpeech.TextToSpeechClient({
  keyFilename: '/home/et101/proj/voiceserver/gcloud-tts.json', // ← adjust if different
});

const PORT = 3000;
const OUTPUT_FILE = '/tmp/output.wav';

async function handleSpeak(req, res) {
  try {
    console.log('Incoming /speak body:', req.body);

    const { text, ssml } = req.body || {};

    if (!text && !ssml) {
      console.error('No text or ssml in request body');
      return res.status(400).json({ error: 'Provide either "text" or "ssml" in JSON body.' });
    }

    // Use SSML if provided, otherwise plain text
    const input = ssml ? { ssml } : { text };

    const request = {
      input,
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Journey-D', // change if you prefer another voice
      },
      audioConfig: {
        audioEncoding: 'LINEAR16',
      },
    };

    console.log('Sending TTS request:', request.input);

    const [response] = await client.synthesizeSpeech(request);

    await util.promisify(fs.writeFile)(OUTPUT_FILE, response.audioContent, 'binary');
    console.log('Audio content written to', OUTPUT_FILE);

    exec(`aplay ${OUTPUT_FILE}`, (error, stdout, stderr) => {
      if (error) {
        console.error('aplay error:', error, stderr);
      } else {
        console.log('aplay OK:', stdout);
      }
    });

    res.json({ ok: true, mode: ssml ? 'ssml' : 'text' });
  } catch (err) {
    console.error('TTS ERROR:', err);
    res
      .status(500)
      .json({ error: 'TTS failed', detail: String(err.message || err) });
  }
}

// Keep the old BBB route name
app.post('/speak', handleSpeak);

// Optional: also allow /say
app.post('/say', handleSpeak);

app.listen(PORT, () => {
  console.log(`Voice server listening on port ${PORT}`);
});
