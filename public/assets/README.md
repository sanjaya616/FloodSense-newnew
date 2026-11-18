# FloodSense Local Visual Assets

Add or replace the hero video and editorial photographs directly in VS Code under `public/assets/`. These files are served locally at `/assets/...` and are **not** uploaded to Firebase or Firestore.

## Required File Paths

| Usage | File Path | Served URL |
| :--- | :--- | :--- |
| Homepage Full-Screen Hero Video | `public/assets/videos/floodsense-hero.mp4` | `/assets/videos/floodsense-hero.mp4` |
| Homepage Hero Video Poster / Fallback | `public/assets/images/floodsense-hero-poster.jpg` | `/assets/images/floodsense-hero-poster.jpg` |
| Login & Registration Split Backdrop | `public/assets/images/login-background.jpg` | `/assets/images/login-background.jpg` |
| Editorial Section (Citizen Reporting) | `public/assets/images/section-citizen-reporting.jpg` | `/assets/images/section-citizen-reporting.jpg` |

## Technical Recommendations

- **Hero Video (`floodsense-hero.mp4`)**: MP4 (H.264), `1920x1080` (16:9), muted atmospheric urban/river/rainwater footage, 8–20 seconds seamless loop, compressed under ~8 MB (`-movflags +faststart`) for instant web playback.
- **Photography (`*.jpg`)**: Minimum `1600px` wide (16:9 or 3:2 landscape for sections; 4:5 or 16:9 for auth panel), calm documentary urban water infrastructure / monsoon sky / emergency engineering tone with natural lighting.
- **Fallback Behavior**: Until these files are added locally, FloodSense automatically renders the architectural `#181818` surface, subtle contour hairlines, and bundled fallback scenes in `public/images/` without broken-image frames.
