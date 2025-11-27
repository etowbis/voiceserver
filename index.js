const express = require('express');
const bodyParser = require('body-parser');
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');
const { exec } = require('child_process');

const app = express();
app.use(bodyParser.json());

const client = new textToSpeech.TextToSpeechClient(keyFilename: './maps-asset-20228803-f4dfa354b964.json');

app.post('/say', async (req, res) => {
  try {
    const text = req.body.text; // <- old style

    const request = {
      input: { text },          // <- old style
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Journey-D', // or whatever you’re using
      },
      audioConfig: {
        audioEncoding: 'LINEAR16',
      },
    };

    const [response] = await client.synthesizeSpeech(request);

    const filename = '/tmp/output.wav';
    await util.promisify(fs.writeFile)(filename, response.audioContent, 'binary');

    exec(`aplay ${filename}`, (error, stdout, stderr) => {
      if (error) {
        console.error('aplay error:', error, stderr);
      } else {
        console.log('aplay OK:', stdout);
      }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: 'TTS failed' });
  }
});

app.listen(3000, () => {
  console.log('Voice server listening on port 3000');
});
