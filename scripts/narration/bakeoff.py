#!/usr/bin/env python3.12
from __future__ import annotations

import os
import json
import re
import shutil
import subprocess
import sys
import time
import venv
import wave
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parents[1]
VENV_DIR = BASE_DIR / ".venv"
VENV_PYTHON = VENV_DIR / "bin" / "python"
CHATTERBOX_VENV_DIR = BASE_DIR / ".venv-chatterbox"
CHATTERBOX_PYTHON = CHATTERBOX_VENV_DIR / "bin" / "python"
REQUIREMENTS = BASE_DIR / "requirements.txt"
SCRIPT_FILE = BASE_DIR / "script.txt"
OUT_DIR = BASE_DIR / "out"
BREW_PYTHON = Path("/opt/homebrew/bin/python3.12")
SAMPLE_RATE = 24_000
GAP_SECONDS = 0.4
KOKORO_REPO = "hexgrad/Kokoro-82M"
KOKORO_CONFIG_URL = "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/config.json"
CHATTERBOX_MODEL_URL = "https://huggingface.co/ResembleAI/chatterbox/resolve/main/ve.safetensors"

VOICE_CHOICES = [
    (
        "af_heart",
        "a",
        "American English female; warm baseline voice for a natural product-film read.",
    ),
    (
        "af_bella",
        "a",
        "American English female; clearer, brighter contrast against af_heart.",
    ),
    (
        "am_michael",
        "a",
        "American English male; grounded and mature enough for product narration.",
    ),
    (
        "am_puck",
        "a",
        "American English male; lighter delivery to test a less formal read.",
    ),
    (
        "bf_emma",
        "b",
        "British English female; checks whether a UK accent sounds polished for the film.",
    ),
    (
        "bm_george",
        "b",
        "British English male; adds a deeper UK-accented option.",
    ),
]

KOKORO_REQUIRED_FILES = [
    "config.json",
    "kokoro-v1_0.pth",
    "voices/af_heart.pt",
    "voices/af_bella.pt",
    "voices/am_michael.pt",
    "voices/am_puck.pt",
    "voices/bf_emma.pt",
    "voices/bm_george.pt",
]

MACOS_VOICE_CHOICES = [
    (
        "Aman",
        "Indian English male voice; checks a local Indian narrator option.",
    ),
    (
        "Tara",
        "Indian English female voice; likely the closest local fit for an Indian staffing product film.",
    ),
    (
        "Rishi",
        "Indian English male voice; gives a second Indian read with a different tone.",
    ),
    (
        "Daniel",
        "British English male voice; standard UK narrator benchmark.",
    ),
    (
        "Karen",
        "Australian English female voice; useful polished Commonwealth-accent contrast.",
    ),
    (
        "Moira",
        "Irish English female voice; additional natural English accent outside US/UK/India.",
    ),
]


@dataclass
class SummaryRow:
    engine: str
    voice_id: str
    output_path: Path
    file_size: int
    duration: float
    generation_time: float


def rel(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(REPO_ROOT.resolve()))
    except ValueError:
        return str(path)


def run(args: list[str], *, check: bool = True, timeout: float | None = None) -> subprocess.CompletedProcess[str]:
    print("$ " + " ".join(args), flush=True)
    return subprocess.run(args, cwd=REPO_ROOT, text=True, check=check, timeout=timeout)


def inside_expected_venv() -> bool:
    return Path(sys.executable).resolve() == VENV_PYTHON.resolve()


def find_python312() -> Path:
    if BREW_PYTHON.exists():
        return BREW_PYTHON
    found = shutil.which("python3.12")
    if found:
        return Path(found)
    raise SystemExit(
        "Python 3.12 is required. Install it with: brew install python@3.12"
    )


def ensure_venv_and_reexec() -> None:
    if inside_expected_venv():
        return

    python312 = find_python312()
    if not VENV_PYTHON.exists():
        print(f"Creating virtual environment with {python312}", flush=True)
        venv.EnvBuilder(with_pip=True).create(VENV_DIR)

    print(f"Re-running inside {VENV_PYTHON}", flush=True)
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), str(Path(__file__).resolve()), *sys.argv[1:]])


def assert_python_version() -> None:
    version = sys.version_info
    print(f"Venv Python: {sys.version.split()[0]}", flush=True)
    if version < (3, 10):
        raise SystemExit(
            "Kokoro requires Python 3.10 or newer. This script must run inside scripts/narration/.venv built from Homebrew Python 3.12."
        )


def check_espeak_ng() -> bool:
    if shutil.which("espeak-ng"):
        print(f"espeak-ng: {shutil.which('espeak-ng')}", flush=True)
        return True
    print(
        "espeak-ng is required by Kokoro and is not on PATH. Install it with: brew install espeak-ng",
        flush=True,
    )
    return False


def install_core_requirements() -> None:
    run([str(VENV_PYTHON), "-m", "pip", "install", "--quiet", "-r", str(REQUIREMENTS)])


def optional_requirements() -> list[str]:
    reqs: list[str] = []
    marker = "optional-after-kokoro:"
    for line in REQUIREMENTS.read_text(encoding="utf-8").splitlines():
        if marker in line:
            reqs.append(line.split(marker, 1)[1].strip())
    return reqs


def read_lines() -> list[str]:
    lines = [
        line.strip()
        for line in SCRIPT_FILE.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    if not lines:
        raise SystemExit(f"No narration lines found in {rel(SCRIPT_FILE)}")
    return lines


def audio_to_numpy(audio):
    import numpy as np

    if hasattr(audio, "detach"):
        audio = audio.detach().cpu().numpy()
    arr = np.asarray(audio, dtype=np.float32).squeeze()
    if arr.ndim == 0:
        arr = arr.reshape(1)
    if arr.ndim > 1:
        arr = arr.mean(axis=0)
    return arr


def write_wav(path: Path, audio, sample_rate: int = SAMPLE_RATE) -> float:
    import soundfile as sf

    arr = audio_to_numpy(audio)
    if sample_rate != SAMPLE_RATE:
        arr = resample_linear(arr, sample_rate, SAMPLE_RATE)
        sample_rate = SAMPLE_RATE
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(path, arr, sample_rate)
    return len(arr) / sample_rate


def resample_linear(audio, source_rate: int, target_rate: int):
    import numpy as np

    arr = audio_to_numpy(audio)
    if source_rate == target_rate or len(arr) == 0:
        return arr
    duration = len(arr) / float(source_rate)
    target_len = max(1, int(round(duration * target_rate)))
    source_x = np.linspace(0.0, duration, num=len(arr), endpoint=False)
    target_x = np.linspace(0.0, duration, num=target_len, endpoint=False)
    return np.interp(target_x, source_x, arr).astype(np.float32)


def concatenate_with_gaps(chunks: list, gap_seconds: float = GAP_SECONDS):
    import numpy as np

    gap = np.zeros(int(SAMPLE_RATE * gap_seconds), dtype=np.float32)
    parts = []
    for index, chunk in enumerate(chunks):
        if index:
            parts.append(gap)
        parts.append(audio_to_numpy(chunk))
    return np.concatenate(parts) if parts else np.array([], dtype=np.float32)


def kokoro_line_audio(pipeline, text: str, voice_id: str):
    chunks = []
    for _graphemes, _phonemes, audio in pipeline(
        text,
        voice=voice_id,
        speed=1.0,
        split_pattern=r"\n+",
    ):
        chunks.append(audio_to_numpy(audio))
    if not chunks:
        raise RuntimeError(f"Kokoro produced no audio for voice {voice_id}")
    return concatenate_without_gap(chunks)


def concatenate_without_gap(chunks: list):
    import numpy as np

    return np.concatenate([audio_to_numpy(chunk) for chunk in chunks])


def huggingface_cache_dir() -> Path:
    try:
        from huggingface_hub.constants import HF_HUB_CACHE

        return Path(HF_HUB_CACHE).expanduser()
    except Exception:
        return Path(os.environ.get("HF_HOME", "~/.cache/huggingface")).expanduser() / "hub"


def repo_cache_dir(repo_id: str) -> Path:
    return huggingface_cache_dir() / f"models--{repo_id.replace('/', '--')}"


def cached_snapshot(repo_id: str, required_files: list[str]) -> Path | None:
    snapshots_dir = repo_cache_dir(repo_id) / "snapshots"
    if not snapshots_dir.exists():
        return None
    for snapshot in sorted(snapshots_dir.iterdir(), reverse=True):
        if snapshot.is_dir() and all((snapshot / filename).exists() for filename in required_files):
            return snapshot
    return None


def kokoro_cache_available() -> bool:
    snapshot = cached_snapshot(KOKORO_REPO, KOKORO_REQUIRED_FILES)
    if snapshot:
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        print(f"Kokoro local cache found: {snapshot}", flush=True)
        return True
    return False


def huggingface_file_available(url: str) -> bool:
    try:
        import requests

        response = requests.get(url, timeout=8, stream=True)
        response.close()
        return response.status_code == 200
    except Exception:
        return False


def model_unavailable_line(engine: str, url: str) -> None:
    print(
        f"{engine} model unavailable on this network; pre-download it elsewhere and copy it into {huggingface_cache_dir()}. Skipping {engine}.",
        flush=True,
    )
    print(f"Checked: {url}", flush=True)


def extract_urls(text: str) -> list[str]:
    urls = re.findall(r"https://[^\s'\"<>)]*", text)
    return sorted(set(urls))


def looks_like_model_download_failure(exc: BaseException) -> bool:
    blob = f"{type(exc).__name__}: {exc}"
    needles = [
        "huggingface",
        "hf_hub",
        "hf_hub_download",
        "httpx",
        "403",
        "401",
        "timed out",
        "connection",
        "remoteprotocolerror",
        "server disconnected",
        "resolve/main",
        KOKORO_REPO.lower(),
    ]
    low = blob.lower()
    return any(needle in low for needle in needles)


def print_model_download_help(exc: BaseException) -> None:
    blob = f"{type(exc).__name__}: {exc}"
    urls = extract_urls(blob) or [KOKORO_CONFIG_URL]
    print()
    print("Kokoro model download failed.", flush=True)
    print("Failed URL(s):", flush=True)
    for url in urls:
        print(f"  {url}", flush=True)
    print(
        "The model can be downloaded on another machine and copied into the local Hugging Face cache directory on this Mac.",
        flush=True,
    )
    print(f"Local cache directory: {huggingface_cache_dir()}", flush=True)
    print(f"Original error: {blob}", flush=True)
    print()


def print_voice_choices() -> None:
    print("Kokoro voice choices:", flush=True)
    for voice_id, lang_code, reason in VOICE_CHOICES:
        print(f"  {voice_id} (lang_code={lang_code}) - {reason}", flush=True)
    print()


def parse_macos_voices(raw: str) -> dict[str, str]:
    voices: dict[str, str] = {}
    pattern = re.compile(r"^(?P<name>.+?)\s+(?P<locale>[a-z]{2}_[A-Z0-9]{2,3}|ar_001)\s+#")
    for line in raw.splitlines():
        match = pattern.match(line)
        if match:
            voices[match.group("name").strip()] = match.group("locale")
    return voices


def available_macos_voices() -> dict[str, str]:
    if not shutil.which("say"):
        print("macOS say command not found. Skipping macOS engine.", flush=True)
        return {}
    proc = subprocess.run(["say", "-v", "?"], text=True, capture_output=True, check=True)
    return parse_macos_voices(proc.stdout)


def filename_slug(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_").lower()


def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as wav:
        return wav.getnframes() / float(wav.getframerate())


def concatenate_wavs(paths: list[Path], output_path: Path) -> float:
    gap_frames = int(SAMPLE_RATE * GAP_SECONDS)
    with wave.open(str(paths[0]), "rb") as first:
        channels = first.getnchannels()
        sample_width = first.getsampwidth()
        frame_rate = first.getframerate()
        first_frames = first.readframes(first.getnframes())

    if channels != 1 or frame_rate != SAMPLE_RATE:
        raise RuntimeError("macOS WAV conversion did not produce 24kHz mono audio")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    total_frames = 0
    with wave.open(str(output_path), "wb") as out:
        out.setnchannels(channels)
        out.setsampwidth(sample_width)
        out.setframerate(frame_rate)
        out.writeframes(first_frames)
        total_frames += len(first_frames) // sample_width
        silence = b"\x00" * gap_frames * sample_width
        for path in paths[1:]:
            with wave.open(str(path), "rb") as wav:
                if wav.getnchannels() != channels or wav.getsampwidth() != sample_width or wav.getframerate() != frame_rate:
                    raise RuntimeError(f"Unexpected WAV format for {path}")
                out.writeframes(silence)
                total_frames += gap_frames
                frames = wav.readframes(wav.getnframes())
                out.writeframes(frames)
                total_frames += len(frames) // sample_width
    return total_frames / float(SAMPLE_RATE)


def print_macos_voice_choices(choices: list[tuple[str, str, str]]) -> None:
    print("macOS voice choices:", flush=True)
    for voice, locale, reason in choices:
        print(f"  {voice} ({locale}) - {reason}", flush=True)
    print()


def run_macos(lines: list[str]) -> tuple[list[SummaryRow], bool]:
    rows: list[SummaryRow] = []
    if not shutil.which("say") or not shutil.which("afconvert"):
        print("macOS engine unavailable because say or afconvert is missing.", flush=True)
        return rows, False

    available = available_macos_voices()
    selected = [
        (voice, available[voice], reason)
        for voice, reason in MACOS_VOICE_CHOICES
        if voice in available
    ]
    if len(selected) < 6:
        print("macOS engine skipped because fewer than six selected local voices are installed.", flush=True)
        return rows, False

    print_macos_voice_choices(selected[:6])
    tmp_dir = OUT_DIR / ".tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    for voice, _locale, _reason in selected[:6]:
        voice_start = time.perf_counter()
        slug = filename_slug(voice)
        line_paths: list[Path] = []
        for index, line in enumerate(lines, start=1):
            aiff_path = tmp_dir / f"macos__{slug}__line{index}.aiff"
            wav_path = OUT_DIR / f"macos__{slug}__line{index}.wav"
            subprocess.run(["say", "-v", voice, "-o", str(aiff_path), line], check=True)
            subprocess.run(
                ["afconvert", "-f", "WAVE", "-d", f"LEI16@{SAMPLE_RATE}", "-c", "1", str(aiff_path), str(wav_path)],
                check=True,
            )
            duration = wav_duration(wav_path)
            line_paths.append(wav_path)
            print(f"Wrote {rel(wav_path)} ({duration:.2f}s)", flush=True)

        all_path = OUT_DIR / f"macos__{slug}__all.wav"
        all_duration = concatenate_wavs(line_paths, all_path)
        elapsed = time.perf_counter() - voice_start
        rows.append(
            SummaryRow(
                engine="macos",
                voice_id=slug,
                output_path=all_path,
                file_size=all_path.stat().st_size,
                duration=all_duration,
                generation_time=elapsed,
            )
        )
        print(f"Wrote {rel(all_path)} ({all_duration:.2f}s)", flush=True)

    shutil.rmtree(tmp_dir, ignore_errors=True)
    return rows, True


def run_kokoro(lines: list[str]) -> tuple[list[SummaryRow], bool]:
    if not check_espeak_ng():
        return [], False
    cache_available = kokoro_cache_available()
    if not cache_available and not huggingface_file_available(KOKORO_CONFIG_URL):
        model_unavailable_line("Kokoro", KOKORO_CONFIG_URL)
        return [], False

    from kokoro import KPipeline

    rows: list[SummaryRow] = []
    pipelines = {}
    print_voice_choices()

    try:
        for voice_id, lang_code, _reason in VOICE_CHOICES:
            voice_start = time.perf_counter()
            if lang_code not in pipelines:
                pipelines[lang_code] = KPipeline(lang_code=lang_code)
            pipeline = pipelines[lang_code]

            line_audios = []
            for index, line in enumerate(lines, start=1):
                audio = kokoro_line_audio(pipeline, line, voice_id)
                line_audios.append(audio)
                path = OUT_DIR / f"kokoro__{voice_id}__line{index}.wav"
                duration = write_wav(path, audio)
                print(f"Wrote {rel(path)} ({duration:.2f}s)", flush=True)

            all_audio = concatenate_with_gaps(line_audios)
            all_path = OUT_DIR / f"kokoro__{voice_id}__all.wav"
            all_duration = write_wav(all_path, all_audio)
            elapsed = time.perf_counter() - voice_start
            rows.append(
                SummaryRow(
                    engine="kokoro",
                    voice_id=voice_id,
                    output_path=all_path,
                    file_size=all_path.stat().st_size,
                    duration=all_duration,
                    generation_time=elapsed,
                )
            )
            print(f"Wrote {rel(all_path)} ({all_duration:.2f}s)", flush=True)
    except Exception as exc:
        if looks_like_model_download_failure(exc):
            print_model_download_help(exc)
            return rows, False
        raise

    return rows, True


def install_chatterbox_optional() -> bool:
    reqs = optional_requirements()
    if not reqs:
        print("No optional Chatterbox requirement found in requirements.txt.", flush=True)
        return False

    try:
        if not CHATTERBOX_PYTHON.exists():
            python312 = find_python312()
            print(f"Creating Chatterbox virtual environment with {python312}", flush=True)
            venv.EnvBuilder(with_pip=True).create(CHATTERBOX_VENV_DIR)
        for req in reqs:
            run([str(CHATTERBOX_PYTHON), "-m", "pip", "install", "--quiet", req])
        return True
    except Exception as exc:
        print()
        print(
            "Chatterbox was skipped because its optional install failed. This does not affect Kokoro output; on this Mac it may fail because Chatterbox pulls a heavier PyTorch audio stack and model files that are slow or blocked behind the corporate proxy.",
            flush=True,
        )
        print(f"Chatterbox install error: {type(exc).__name__}: {exc}", flush=True)
        print()
        return False


def run_chatterbox(lines: list[str]) -> tuple[list[SummaryRow], bool]:
    rows: list[SummaryRow] = []
    print("Attempting Chatterbox as an optional second engine.", flush=True)
    if not huggingface_file_available(CHATTERBOX_MODEL_URL):
        model_unavailable_line("Chatterbox", CHATTERBOX_MODEL_URL)
        return rows, False
    if not install_chatterbox_optional():
        return rows, False

    try:
        proc = subprocess.run(
            [str(CHATTERBOX_PYTHON), str(Path(__file__).resolve()), "--chatterbox-worker"],
            cwd=REPO_ROOT,
            text=True,
            capture_output=True,
        )
        if proc.stdout:
            print(proc.stdout, end="", flush=True)
        if proc.stderr:
            print(proc.stderr, end="", flush=True)
        if proc.returncode != 0:
            raise RuntimeError(f"Chatterbox worker exited with code {proc.returncode}")
        for line in proc.stdout.splitlines():
            if line.startswith("CHATTERBOX_SUMMARY_JSON:"):
                payload = json.loads(line.split(":", 1)[1])
                rows.append(
                    SummaryRow(
                        engine=payload["engine"],
                        voice_id=payload["voice_id"],
                        output_path=Path(payload["output_path"]),
                        file_size=int(payload["file_size"]),
                        duration=float(payload["duration"]),
                        generation_time=float(payload["generation_time"]),
                    )
                )
        return rows, bool(rows)
    except Exception as exc:
        print()
        print(
            "Chatterbox failed after Kokoro was attempted. This does not affect Kokoro output; on a MacBook without an NVIDIA GPU it can be slow, CPU-only, or blocked while downloading model files.",
            flush=True,
        )
        print(f"Chatterbox error: {type(exc).__name__}: {exc}", flush=True)
        print()
        return rows, False


def chatterbox_worker_main() -> int:
    import numpy as np
    import soundfile as sf
    import torch
    from chatterbox.tts import ChatterboxTTS

    lines = read_lines()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Chatterbox device: {device}", flush=True)
    start = time.perf_counter()
    model = ChatterboxTTS.from_pretrained(device=device)
    sample_rate = int(getattr(model, "sr", SAMPLE_RATE))
    voice_id = f"default_{device}"

    line_audios = []
    for index, line in enumerate(lines, start=1):
        audio = model.generate(line)
        arr = audio_to_numpy(audio)
        if sample_rate != SAMPLE_RATE:
            arr = resample_linear(arr, sample_rate, SAMPLE_RATE)
        line_audios.append(arr)
        path = OUT_DIR / f"chatterbox__{voice_id}__line{index}.wav"
        sf.write(path, arr, SAMPLE_RATE)
        print(f"Wrote {rel(path)} ({len(arr) / SAMPLE_RATE:.2f}s)", flush=True)

    gap = np.zeros(int(SAMPLE_RATE * GAP_SECONDS), dtype=np.float32)
    parts = []
    for index, chunk in enumerate(line_audios):
        if index:
            parts.append(gap)
        parts.append(audio_to_numpy(chunk))
    all_audio = np.concatenate(parts) if parts else np.array([], dtype=np.float32)
    all_path = OUT_DIR / f"chatterbox__{voice_id}__all.wav"
    sf.write(all_path, all_audio, SAMPLE_RATE)
    elapsed = time.perf_counter() - start
    payload = {
        "engine": "chatterbox",
        "voice_id": voice_id,
        "output_path": str(all_path),
        "file_size": all_path.stat().st_size,
        "duration": len(all_audio) / SAMPLE_RATE,
        "generation_time": elapsed,
    }
    print(f"CHATTERBOX_SUMMARY_JSON:{json.dumps(payload, sort_keys=True)}", flush=True)
    return 0


def print_summary(rows: list[SummaryRow]) -> None:
    print()
    print("Summary table", flush=True)
    headers = ["engine", "voice id", "output path", "file size", "duration", "generation time"]
    table = []
    for row in rows:
        table.append(
            [
                row.engine,
                row.voice_id,
                rel(row.output_path),
                str(row.file_size),
                f"{row.duration:.2f}s",
                f"{row.generation_time:.2f}s",
            ]
        )
    widths = [
        max(len(headers[col]), *(len(row[col]) for row in table)) if table else len(headers[col])
        for col in range(len(headers))
    ]
    print(" | ".join(headers[col].ljust(widths[col]) for col in range(len(headers))), flush=True)
    print("-|-".join("-" * widths[col] for col in range(len(headers))), flush=True)
    for row in table:
        print(" | ".join(row[col].ljust(widths[col]) for col in range(len(row))), flush=True)
    if not table:
        print("(no audio files were produced)", flush=True)


def main() -> int:
    if "--chatterbox-worker" in sys.argv:
        return chatterbox_worker_main()

    ensure_venv_and_reexec()
    assert_python_version()
    install_core_requirements()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    lines = read_lines()
    all_rows: list[SummaryRow] = []

    macos_rows, macos_ok = run_macos(lines)
    all_rows.extend(macos_rows)

    kokoro_rows, kokoro_ok = run_kokoro(lines)
    all_rows.extend(kokoro_rows)

    chatterbox_rows, chatterbox_ok = run_chatterbox(lines)
    all_rows.extend(chatterbox_rows)

    print_summary(all_rows)
    print()
    print(f"macOS succeeded: {'yes' if macos_ok else 'no'}", flush=True)
    print(f"Kokoro succeeded: {'yes' if kokoro_ok else 'no'}", flush=True)
    print(f"Chatterbox succeeded: {'yes' if chatterbox_ok else 'no'}", flush=True)
    return 0 if (macos_ok or kokoro_ok or chatterbox_ok) else 1


if __name__ == "__main__":
    raise SystemExit(main())
