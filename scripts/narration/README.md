# Narration Voice Bake-Off

This folder is a self-contained text-to-speech test for the Telora product film narrator voice. It does not change the web app, the Vite build, or the Node tooling.

## One Command

Run this from the repository root:

```sh
scripts/narration/.venv/bin/python scripts/narration/bakeoff.py
```

If the virtual environment does not exist yet, this also works and will create it with Homebrew Python 3.12:

```sh
/opt/homebrew/bin/python3.12 scripts/narration/bakeoff.py
```

## Where The WAV Files Appear

The files are written to:

```text
scripts/narration/out/
```

For each voice, there are three line-by-line WAV files and one combined listening file:

```text
<engine>__<voice_id>__line1.wav
<engine>__<voice_id>__line2.wav
<engine>__<voice_id>__line3.wav
<engine>__<voice_id>__all.wav
```

The `<engine>__<voice_id>__all.wav` files are the best files to listen to first.

## How To Change The Test Lines

Edit:

```text
scripts/narration/script.txt
```

Keep one spoken test line per line. The script will generate one WAV per line and one combined WAV per voice.

## If The Model Download Is Blocked

If the corporate proxy blocks Hugging Face, the script prints one clear skip message for Kokoro or Chatterbox and continues with the built-in macOS voices. This means the model is not broken; it means this network is not allowed to download it.

The script checks the local Hugging Face cache first. If the model is already there, it uses the cached copy without network access.

The Kokoro model is hosted under:

```text
https://huggingface.co/hexgrad/Kokoro-82M
```

For the offline copy path, see:

```text
scripts/narration/OFFLINE_MODEL_SETUP.md
```

## If The macOS Voices Are Enough

The `macos` engine uses Apple's built-in `say` command and `afconvert`. It does not need a model download, a paid API, or any extra Python audio package. It writes the same line-by-line and combined WAV files as the model-backed engines.

## Ignored Local Files

The local virtual environments and generated audio are intentionally ignored by Git:

```text
scripts/narration/.venv/
scripts/narration/.venv-chatterbox/
scripts/narration/out/
```
