# Offline Kokoro Model Setup

Use this only if the built-in macOS voices are not good enough and the office network still blocks Hugging Face.

## What To Download

Download these exact files from the Kokoro model repository:

```text
hexgrad/Kokoro-82M
  config.json
  kokoro-v1_0.pth
  voices/af_heart.pt
  voices/af_bella.pt
  voices/am_michael.pt
  voices/am_puck.pt
  voices/bf_emma.pt
  voices/bm_george.pt
```

Those six voice files match the six Kokoro voices used by `bakeoff.py`.

## Download On A Machine With Open Internet

On a personal laptop or any machine that can reach Hugging Face, install the Hugging Face command-line tool and download the files into a cache folder:

```sh
python3 -m pip install -U huggingface_hub
mkdir -p kokoro-hf-cache
huggingface-cli download hexgrad/Kokoro-82M \
  config.json \
  kokoro-v1_0.pth \
  voices/af_heart.pt \
  voices/af_bella.pt \
  voices/am_michael.pt \
  voices/am_puck.pt \
  voices/bf_emma.pt \
  voices/bm_george.pt \
  --cache-dir kokoro-hf-cache
```

## Where To Copy It On This Mac

Copy the downloaded cache folder contents into:

```text
/Users/karan.munjal/.cache/huggingface/hub
```

After copying, this folder should exist on this Mac:

```text
/Users/karan.munjal/.cache/huggingface/hub/models--hexgrad--Kokoro-82M
```

## How To Confirm It Worked

From the repository root, run:

```sh
scripts/narration/.venv/bin/python scripts/narration/bakeoff.py
```

The output should say:

```text
Kokoro local cache found:
```

Once the model is in the local cache, `bakeoff.py` uses it without network access.
