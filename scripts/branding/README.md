# Telora Logo Sting Renderer

This folder renders `logo-sting.html` into shareable video files without recording the screen by hand.

## One-time setup

From the repo root, run:

```sh
cd scripts/branding
pnpm install --ignore-workspace --no-lockfile
```

This installs only the renderer tools in this folder.

## Render the logo sting

From `scripts/branding`, run:

```sh
pnpm render
```

The renderer creates:

- `scripts/branding/out/telora-logo-sting.mp4`
- `scripts/branding/out/telora-logo-sting.gif`

The MP4 is the best file for WhatsApp, YouTube, and normal sharing. The GIF is limited to 256 colours, so it will always look worse than the MP4; use it only for surfaces that cannot accept video.

## Change the words or colours

Open `scripts/branding/logo-sting.html`.

To change the tagline, edit this line:

```html
<p class="tagline">Talent, tracked with clarity.</p>
```

To change the colours, edit these values near the top of the file:

```css
--bg: #f5f3ed;
--text: #18322b;
--text-muted: #6d756f;
```

## Build artifacts

The `out/` folder is gitignored. The rendered MP4 and GIF are build artifacts, not source files.
