# Receipt Lens demo video source

A 140-second silent technical walkthrough, rendered at 1920×1080/30fps. Actual app captures are distinguished from explanatory native-custody/expiration cards; a controlled RPC-failure capture is labelled. All usage statements are synthetic. No model-generated screenshots or music.

Node 22+ and FFmpeg are required by HyperFrames. Development used Node 24.11.1 and HyperFrames 0.8.169. Locally bundled GSAP/fonts avoid render-time CDN requests.

```sh
npm ci
npm run check
npx --yes hyperframes@0.8.169 preview --background
npx --yes hyperframes@0.8.169 render --quality delivery --fps 30 --output receipt-lens.mp4
```

The video does not make a real-usage, payment or permanent-retention claim. Data and creator addresses are documented in the application schema. `build-scenes.py` regenerates the authored HTML; run from this folder with Python 3.12+. Dependencies and font notices remain under their own licenses in assets/licenses/. Original authored compositions are MIT.
