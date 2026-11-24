# Apollo 11 vertical documentary

The isolated `video/apollo-11-tiktok` branch builds a 40-second, 24 fps vertical documentary cut. It uses authentic Apollo 11 archival photographs from NASA/JSC, with a restrained Ken Burns camera move, photo-only cross-dissolves, editorial typography, compact readable Russian subtitles with corrected SRT scale, Russian narration and original music.

## Render pipeline

1. `prepare_audio.py` creates the original music bed and subtitle track.
2. `fetch_archive.py` downloads the NASA photographs into `output/assets`.
3. `archival_edit.py` renders 960 vertical photo-motion frames.
4. GitHub Actions creates the H.264/AAC MP4 and uploads the `apollo11-tiktok` artifact.

NASA photo IDs are embedded in the visual captions; the end card credits NASA/JSC. The original Blender experiment remains in `apollo11.py` but is no longer used by the publishing workflow. Nothing is merged into `main`.
