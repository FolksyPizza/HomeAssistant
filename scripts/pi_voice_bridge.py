#!/usr/bin/env python3
"""
Pi-local voice bridge adapted from the MIT-licensed `be-more-agent` project:
https://github.com/brenpoly/be-more-agent

This helper intentionally keeps only the wake-word, recording, whisper.cpp
transcription, and Piper TTS pieces needed by the smart-display UI.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import traceback
import wave
from pathlib import Path
from typing import Any

IMPORT_ERRORS: dict[str, str] = {}

try:
    import numpy as np
except Exception as exc:  # pragma: no cover - runtime dependency probe
    np = None
    IMPORT_ERRORS["numpy"] = str(exc)

try:
    import sounddevice as sd
except Exception as exc:  # pragma: no cover - runtime dependency probe
    sd = None
    IMPORT_ERRORS["sounddevice"] = str(exc)

try:
    from openwakeword.model import Model
except Exception as exc:  # pragma: no cover - runtime dependency probe
    Model = None
    IMPORT_ERRORS["openwakeword"] = str(exc)


def emit(payload: dict[str, Any], exit_code: int = 0) -> int:
    print(json.dumps(payload), flush=True)
    return exit_code


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Pi voice bridge")
    parser.add_argument("command", choices=["health", "listen", "speak"])
    parser.add_argument("--config", required=True, help="JSON encoded configuration")
    parser.add_argument("--entry-mode", choices=["push-to-talk", "wake-word"])
    parser.add_argument("--silence-timeout", type=float, default=2.0)
    parser.add_argument("--max-listen-seconds", type=float, default=30.0)
    parser.add_argument("--text")
    parser.add_argument("--wake-word-threshold", type=float, default=0.5)
    parser.add_argument("--wake-word-timeout", type=float, default=90.0)
    return parser.parse_args()


def require_module(name: str, module: Any) -> None:
    if module is None:
        raise RuntimeError(f"Missing Python dependency `{name}`: {IMPORT_ERRORS.get(name, 'unknown error')}")


def resolve_input_device(requested: Any) -> Any:
    require_module("sounddevice", sd)
    try:
        devices = sd.query_devices()
    except Exception as exc:  # pragma: no cover - hardware dependent
        raise RuntimeError(f"Unable to query audio devices: {exc}") from exc

    if requested in (None, "", "default"):
        default_input = None
        try:
            default_input = sd.default.device[0]
        except Exception:
            default_input = None

        if isinstance(default_input, int) and default_input >= 0:
            device = devices[default_input]
            if device.get("max_input_channels", 0) > 0:
                return default_input

        for index, device in enumerate(devices):
            if device.get("max_input_channels", 0) > 0:
                return index

        raise RuntimeError("No input audio device detected. Connect or configure a microphone for Pi-local capture.")

    if isinstance(requested, int) or (isinstance(requested, str) and requested.isdigit()):
        index = int(requested)
        if 0 <= index < len(devices):
            return index
        raise RuntimeError(f"Input device index not found: {requested}")

    requested_lower = str(requested).lower()
    for index, device in enumerate(devices):
        if device.get("max_input_channels", 0) > 0 and requested_lower in device.get("name", "").lower():
            return index

    raise RuntimeError(f"Input device not found: {requested}")


def resolve_output_device() -> Any:
    require_module("sounddevice", sd)
    try:
        devices = sd.query_devices()
    except Exception as exc:  # pragma: no cover - hardware dependent
        raise RuntimeError(f"Unable to query audio devices: {exc}") from exc

    try:
        default_output = sd.default.device[1]
    except Exception:
        default_output = None

    if isinstance(default_output, int) and default_output >= 0:
        device = devices[default_output]
        if device.get("max_output_channels", 0) > 0:
            return default_output

    for index, device in enumerate(devices):
        if device.get("max_output_channels", 0) > 0:
            return index

    raise RuntimeError("No output audio device detected. Connect or configure speakers for Pi-local speech.")


def choose_input_samplerate(device: Any, preferred: int | None = None) -> int:
    require_module("sounddevice", sd)
    candidates: list[int] = []
    if preferred:
        candidates.append(int(preferred))

    try:
        device_info = sd.query_devices(device)
        default_rate = int(device_info.get("default_samplerate") or 0)
        if default_rate:
            candidates.append(default_rate)
    except Exception:
        pass

    candidates.extend([48000, 44100, 32000, 16000])
    seen: set[int] = set()

    for rate in candidates:
        if not rate or rate in seen:
            continue
        seen.add(rate)
        try:
            sd.check_input_settings(device=device, samplerate=rate, channels=1, dtype="int16")
            return rate
        except Exception:
            continue

    return candidates[0] if candidates else 44100


def read_piper_sample_rate(model_path: str) -> int:
    config_path = Path(f"{model_path}.json")
    if not config_path.exists():
        return 22050

    try:
        payload = json.loads(config_path.read_text())
    except Exception:
        return 22050

    candidates = [
        payload.get("sample_rate"),
        payload.get("audio", {}).get("sample_rate"),
    ]
    for candidate in candidates:
        if isinstance(candidate, int) and candidate > 0:
            return candidate

    return 22050


def linear_resample_int16(data: Any, out_length: int) -> Any:
    require_module("numpy", np)
    if out_length <= 0 or len(data) == 0:
        return np.array([], dtype=np.int16)
    if len(data) == out_length:
        return data.astype(np.int16, copy=False)

    xp = np.linspace(0, len(data) - 1, num=len(data), dtype=np.float64)
    fp = data.astype(np.float64, copy=False)
    x = np.linspace(0, len(data) - 1, num=out_length, dtype=np.float64)
    return np.interp(x, xp, fp).astype(np.int16)


def alsa_output_available() -> bool:
    device = resolve_aplay_device()
    if not device:
        return False

    try:
        result = subprocess.run(
            [
                "sh",
                "-lc",
                f"head -c 0 /dev/zero | aplay -q -D {device} -f S16_LE -r 22050 -c 1",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
    except Exception:
        return False

    return result.returncode == 0


def resolve_aplay_device() -> str | None:
    try:
        result = subprocess.run(
            ["aplay", "-l"],
            capture_output=True,
            text=True,
            check=False,
        )
    except Exception:
        return None

    for line in (result.stdout or "").splitlines():
        match = re.search(r"card\s+(\d+):.*device\s+(\d+):", line, re.IGNORECASE)
        if match:
            return f"plughw:{match.group(1)},{match.group(2)}"

    return None


def ensure_file(path_value: str | None, label: str) -> str:
    if not path_value:
        raise RuntimeError(f"Missing configuration for `{label}`")

    path = Path(path_value)
    if not path.exists():
        raise RuntimeError(f"{label} not found: {path}")

    return str(path)


def save_audio_buffer(buffer: list[Any], samplerate: int) -> tuple[str, float]:
    require_module("numpy", np)
    if not buffer:
        raise RuntimeError("No audio captured from the microphone.")

    audio_data = np.concatenate(buffer, axis=0).flatten()
    audio_data = np.nan_to_num(audio_data, nan=0.0, posinf=0.0, neginf=0.0)
    pcm = (audio_data * 32767).astype(np.int16)

    temp = tempfile.NamedTemporaryFile(prefix="smart-display-voice-", suffix=".wav", delete=False)
    temp_path = temp.name
    temp.close()

    with wave.open(temp_path, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(samplerate)
        wav_file.writeframes(pcm.tobytes())

    duration_seconds = len(pcm) / float(samplerate)
    return temp_path, duration_seconds


def detect_wake_word(config: dict[str, Any], threshold: float, timeout_seconds: float) -> float:
    require_module("numpy", np)
    require_module("sounddevice", sd)
    require_module("openwakeword", Model)

    model_path = ensure_file(config.get("wake_word_model"), "wake-word model")
    input_device = resolve_input_device(config.get("input_device"))
    samplerate = choose_input_samplerate(input_device, config.get("input_sample_rate"))

    try:
        wake_model = Model(wakeword_model_paths=[model_path])
    except TypeError:
        wake_model = Model(wakeword_models=[model_path])

    started_at = time.monotonic()
    input_chunk_size = max(512, int(samplerate * 0.08))
    target_chunk_size = 1280

    stream_args = {
        "samplerate": samplerate,
        "channels": 1,
        "dtype": "int16",
        "device": input_device,
        "blocksize": 0,
    }

    with sd.InputStream(**stream_args) as stream:
        while True:
            if time.monotonic() - started_at > timeout_seconds:
                raise TimeoutError("Timed out waiting for the wake word.")

            read_size = 1024
            data, overflow = stream.read(read_size)
            if overflow:
                continue

            audio_data = np.asarray(data, dtype=np.int16).flatten()

            if len(audio_data) == 0:
                continue

            if len(audio_data) != target_chunk_size:
                step = len(audio_data) / target_chunk_size
                indices = np.arange(0, len(audio_data), step)[:target_chunk_size].astype(int)
                audio_data = audio_data[indices]

            current_max = int(np.max(np.abs(audio_data)))
            if current_max <= 200:
                continue

            wake_model.predict(audio_data)
            for model_name in wake_model.prediction_buffer.keys():
                score = float(list(wake_model.prediction_buffer[model_name])[-1])
                if score > threshold:
                    wake_model.reset()
                    return score


def record_voice_adaptive(config: dict[str, Any], silence_timeout: float, max_listen_seconds: float) -> tuple[str, float]:
    require_module("numpy", np)
    require_module("sounddevice", sd)

    input_device = resolve_input_device(config.get("input_device"))
    samplerate = choose_input_samplerate(input_device, config.get("input_sample_rate"))
    silence_threshold = 0.006
    chunk_duration = 0.05
    chunk_size = max(512, int(samplerate * chunk_duration))
    num_silent_chunks = max(1, int(max(0.5, silence_timeout) / chunk_duration))
    max_chunks = max(10, int(max_listen_seconds / chunk_duration))

    buffer: list[Any] = []
    silent_chunks = 0
    recorded_chunks = 0
    silence_started = False

    def callback(indata: Any, _frames: int, _time_info: Any, _status: Any) -> None:
        nonlocal silent_chunks, recorded_chunks, silence_started

        volume_norm = float(np.linalg.norm(indata) / np.sqrt(len(indata)))
        buffer.append(indata.copy())
        recorded_chunks += 1

        if recorded_chunks < 5:
            return

        if volume_norm < silence_threshold:
            silent_chunks += 1
            if silent_chunks >= num_silent_chunks:
                silence_started = True
        else:
            silent_chunks = 0

    sd.stop()
    time.sleep(0.15)

    with sd.InputStream(
        samplerate=samplerate,
        channels=1,
        callback=callback,
        device=input_device,
        blocksize=chunk_size,
    ):
        while not silence_started and recorded_chunks < max_chunks:
            sd.sleep(int(chunk_duration * 1000))

    return save_audio_buffer(buffer, samplerate)


def parse_transcription(raw_text: str) -> str:
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    if not lines:
        return ""

    last_line = lines[-1]
    if "]" in last_line:
        return last_line.split("]", 1)[1].strip()

    return last_line.strip()


def transcribe_audio(config: dict[str, Any], audio_path: str) -> str:
    whisper_cli = ensure_file(config.get("whisper_cli"), "whisper CLI")
    whisper_model = ensure_file(config.get("whisper_model"), "whisper model")

    result = subprocess.run(
        [whisper_cli, "-m", whisper_model, "-l", "en", "-t", "4", "-f", audio_path],
        capture_output=True,
        text=True,
        check=False,
    )

    transcript = parse_transcription(result.stdout)
    if result.returncode != 0 and not transcript:
        stderr = result.stderr.strip() or result.stdout.strip() or "unknown whisper.cpp error"
        raise RuntimeError(f"whisper.cpp failed: {stderr}")

    return transcript


def sanitize_speech_text(text: str) -> str:
    return re.sub(r"[^\w\s,.!?:-]", "", text).strip()


def speak_text(config: dict[str, Any], text: str) -> dict[str, Any]:
    require_module("numpy", np)
    require_module("sounddevice", sd)

    clean_text = sanitize_speech_text(text)
    if not clean_text:
        return {"spoken": False, "provider": "piper", "note": "Nothing to speak."}

    piper_binary = ensure_file(config.get("piper_binary"), "Piper binary")
    piper_model = ensure_file(config.get("piper_model"), "Piper model")
    piper_rate = read_piper_sample_rate(piper_model)

    process = subprocess.Popen(
        [piper_binary, "--model", piper_model, "--output-raw"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )

    try:
        if process.stdin is None or process.stdout is None:
            raise RuntimeError("Piper process did not expose stdin/stdout.")

        process.stdin.write(clean_text.encode("utf-8") + b"\n")
        process.stdin.close()

        try:
            output_device = resolve_output_device()
            try:
                device_info = sd.query_devices(output_device)
                native_rate = int(device_info["default_samplerate"])
            except Exception:
                native_rate = piper_rate

            output_rate = piper_rate
            use_native_rate = False
            try:
                sd.check_output_settings(device=output_device, samplerate=piper_rate)
            except Exception:
                output_rate = native_rate
                use_native_rate = True

            with sd.RawOutputStream(
                samplerate=output_rate,
                channels=1,
                dtype="int16",
                device=output_device,
                latency="low",
                blocksize=2048,
            ) as stream:
                while True:
                    data = process.stdout.read(4096)
                    if not data:
                        break

                    chunk = np.frombuffer(data, dtype=np.int16)
                    if len(chunk) == 0:
                        continue

                    if use_native_rate and native_rate != piper_rate:
                        out_length = int(len(chunk) * (native_rate / piper_rate))
                        chunk = linear_resample_int16(chunk, out_length)

                    stream.write(chunk.tobytes())
        except RuntimeError:
            aplay_device = resolve_aplay_device()
            if not aplay_device:
                raise RuntimeError("No ALSA playback device is available for Piper speech.")

            player = subprocess.Popen(
                ["aplay", "-q", "-D", aplay_device, "-f", "S16_LE", "-r", str(piper_rate), "-c", "1"],
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
            if process.stdout is None or player.stdin is None:
                raise RuntimeError("Unable to open Piper or aplay audio streams.")

            while True:
                data = process.stdout.read(4096)
                if not data:
                    break
                try:
                    player.stdin.write(data)
                except BrokenPipeError:
                    stderr = b""
                    if player.stderr is not None:
                        stderr = player.stderr.read()
                    raise RuntimeError(
                        stderr.decode("utf-8", errors="ignore").strip()
                        or f"aplay could not open {aplay_device}."
                    )

            player.stdin.close()
            stderr = player.communicate(timeout=20)[1]
            if player.returncode != 0:
                raise RuntimeError(
                    stderr.decode("utf-8", errors="ignore").strip()
                    or "aplay could not play Piper output."
                )

        process.wait(timeout=10)
        return {"spoken": True, "provider": "piper"}
    finally:
        if process.stdout is not None:
            process.stdout.close()
        if process.poll() is None:
            process.terminate()


def command_health(config: dict[str, Any]) -> int:
    input_available = False
    output_available = False
    if sd is not None:
        try:
            devices = sd.query_devices()
            input_available = any(device.get("max_input_channels", 0) > 0 for device in devices)
            output_available = any(device.get("max_output_channels", 0) > 0 for device in devices)
        except Exception:
            pass
    output_available = output_available or alsa_output_available()

    status = {
        "python_dependencies": {
            "numpy": np is not None,
            "sounddevice": sd is not None,
            "openwakeword": Model is not None,
        },
        "files": {
            "wake_word_model": bool(config.get("wake_word_model") and Path(config["wake_word_model"]).exists()),
            "whisper_cli": bool(config.get("whisper_cli") and Path(config["whisper_cli"]).exists()),
            "whisper_model": bool(config.get("whisper_model") and Path(config["whisper_model"]).exists()),
            "piper_binary": bool(config.get("piper_binary") and Path(config["piper_binary"]).exists()),
            "piper_model": bool(config.get("piper_model") and Path(config["piper_model"]).exists()),
        },
        "audio": {
            "input": input_available,
            "output": output_available,
        },
        "errors": IMPORT_ERRORS,
    }

    available = all(status["python_dependencies"].values())
    return emit({"available": available, "status": status})


def command_listen(
    config: dict[str, Any],
    entry_mode: str,
    silence_timeout: float,
    max_listen_seconds: float,
    wake_word_threshold: float,
    wake_word_timeout: float,
) -> int:
    audio_path = None
    activation_score = None

    try:
        if entry_mode == "wake-word":
            activation_score = detect_wake_word(config, wake_word_threshold, wake_word_timeout)

        audio_path, duration_seconds = record_voice_adaptive(config, silence_timeout, max_listen_seconds)
        transcript = transcribe_audio(config, audio_path)

        return emit(
            {
                "provider": "pi-local-whisper",
                "transcript": transcript.strip(),
                "audioSeconds": duration_seconds,
                "activationSource": entry_mode,
                "wakeWordScore": activation_score,
                "note": (
                    "Wake word detected on the Pi microphone."
                    if entry_mode == "wake-word"
                    else "Captured speech from the Pi microphone."
                ),
            }
        )
    finally:
        if audio_path and os.path.exists(audio_path):
            try:
                os.unlink(audio_path)
            except OSError:
                pass


def command_speak(config: dict[str, Any], text: str) -> int:
    return emit(speak_text(config, text))


def main() -> int:
    args = parse_args()
    try:
        config = json.loads(args.config)
    except json.JSONDecodeError as exc:
        return emit({"error": f"Invalid config JSON: {exc}"}, 2)

    try:
        if args.command == "health":
            return command_health(config)

        if args.command == "listen":
            if not args.entry_mode:
                raise RuntimeError("`--entry-mode` is required for listen.")
            return command_listen(
                config,
                args.entry_mode,
                args.silence_timeout,
                args.max_listen_seconds,
                args.wake_word_threshold,
                args.wake_word_timeout,
            )

        if args.command == "speak":
            if args.text is None:
                raise RuntimeError("`--text` is required for speak.")
            return command_speak(config, args.text)

        raise RuntimeError(f"Unsupported command: {args.command}")
    except Exception as exc:  # pragma: no cover - hardware and dependency dependent
        return emit(
            {
                "error": str(exc),
                "traceback": traceback.format_exc(limit=8),
            },
            1,
        )


if __name__ == "__main__":
    raise SystemExit(main())
