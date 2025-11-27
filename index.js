// index.js
// Node.js server that accepts POSTed text and plays it on the server machine
// using Google Cloud Text-to-Speech + OS-level audio player (no native Node addons).

const express = require('express');
const bodyParser = require('body-parser');
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const port = process.env.PORT || 3000;

// Parse JSON request bodies
app.use(bodyParser.json());

// Google Cloud TTS client (uses GOOGLE_APPLICATION_CREDENTIALS env var)
const ttsClient = new textToSpeech.TextToSpeechClient();

/**
 * Play an audio file using the host OS.
 * - On Windows: use `start` (default media player)
 * - On macOS: `afplay`
 * - On Linux: `mpg123` (you'll need to install that on the Pi later)
 */
function playAudioFile(filePath) {
  const platform = process.platform;
  let cmd;

  if (platform === 'win32') {
    // This opens the file with the default associated app (e.g., Groove Music, etc.)
    cmd = `start "" "${filePath}"`;
  } else if (platform === 'darwin') {
    // macOS – built-in CLI audio player
    cmd = `afplay "${filePath}"`;
  } else {
    // Linux (including Raspberry Pi) – expecting mpg123 installed
    cmd = `mpg123 "${filePath}"`;
  }

  exec(cmd, (error) => {
    if (error) {
      console.error('Error playing audio:', error);
    } else {
      console.log('Playback command executed:', cmd);
    }
  });

  // Cleanup: delete the file after a little while
  setTimeout(() => {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.warn('Could not delete temp file:', filePath, err.message);
      } else {
        console.log('Deleted temp file:', filePath);
      }
    });
  }, 60_000); // 60 seconds
}

/**
 * POST /speak
 * Body JSON:
 * {
 *   "text": "Hello world",
 *   "voice": { "languageCode": "en-US", "ssmlGender": "FEMALE" }, // optional
 *   "speakingRate": 1.0                                           // optional
 * }
 */
app.post('/speak', async (req, res) => {
  try {
    const { text, voice, speakingRate } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Missing or invalid "text" field in JSON body.' });
    }

    console.log('Received text to speak:', text);

    const request = {
      input: { text },
      voice: voice || {
        languageCode: 'en-US',
        ssmlGender: 'NEUTRAL',
      },
      audioConfig: {
        audioEncoding: 'MP3',           // compressed, easy for OS players
        speakingRate: speakingRate || 1.0,
      },
    };

    // Call Google Text-to-Speech
    const [response] = await ttsClient.synthesizeSpeech(request);

    if (!response.audioContent) {
      console.error('No audioContent from Google TTS');
      return res.status(500).json({ error: 'No audioContent from Google TTS.' });
    }

    const audioBuffer = Buffer.isBuffer(response.audioContent)
      ? response.audioContent
      : Buffer.from(response.audioContent, 'base64');

    // Write to a temp MP3 file
    const tmpFile = path.join(os.tmpdir(), `tts-${Date.now()}.mp3`);
    fs.writeFile(tmpFile, audioBuffer, (err) => {
      if (err) {
        console.error('Error writing temp audio file:', err);
        return res.status(500).json({ error: 'Failed to write temp audio file.' });
      }

      console.log('Saved audio to:', tmpFile);
      playAudioFile(tmpFile);
    });

    // Respond right away; playback happens asynchronously
    res.json({
      status: 'ok',
      message: 'Text sent to Google TTS and audio is being played on the server.',
    });
  } catch (err) {
    console.error('Error in /speak:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Simple health-check
app.get('/', (req, res) => {
  res.send('TTS speaker server running. POST /speak with { "text": "..." }.');
});

app.listen(port, () => {
  console.log(`TTS server listening on http://localhost:${port}`);
});
