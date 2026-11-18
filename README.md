# SineImmitator

Record any sound with your microphone and the browser will try to play it back to you using only sine waves.

While a recording plays, the app runs an FFT on it, picks the strongest spectral peaks each frame and steers a bank of sine oscillators to those frequencies and amplitudes. You can play back the sine imitation or the original recording, and choose how many sine waves (1–128) to use.

Plain HTML, CSS and JavaScript (ES modules) on the Web Audio API and MediaRecorder. No build step.

## Run locally

```sh
npm install
npm start      # serves the folder on http://localhost:3000
```

Any static file server works. The page has to be served over `http://localhost` or HTTPS so the browser allows microphone access.

## Deploy

Every push to `master` deploys to GitHub Pages through `.github/workflows/pages.yml`. In the repository settings, go to **Pages → Build and deployment → Source** and choose **GitHub Actions** once.
