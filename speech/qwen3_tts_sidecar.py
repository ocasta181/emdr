import base64
import io
import json
import os
import sys
import wave

import numpy as np

MODEL_ID = os.environ.get("EMDR_TTS_MODEL_ID", "mlx-community/Qwen3-TTS-12Hz-0.6B-Base-bf16")
VOICE_NAMES = {
    "qwen3-chelsie": "Chelsie",
    "qwen3-ethan": "Ethan",
    "qwen3-aidan": "Aidan",
    "qwen3-serena": "Serena",
    "qwen3-ryan": "Ryan",
    "qwen3-vivian": "Vivian",
    "qwen3-claire": "Claire",
    "qwen3-lucas": "Lucas",
    "qwen3-eleanor": "Eleanor",
    "qwen3-benjamin": "Benjamin",
}

model = None


def main():
    for line in sys.stdin:
        handle_line(line)


def handle_line(line):
    try:
        request = json.loads(line)
        response = dispatch(request)
    except Exception as error:
        response = {"id": request_id_from(line), "ok": False, "error": str(error)}

    sys.stdout.write(f"{json.dumps(response)}\n")
    sys.stdout.flush()


def dispatch(request):
    request_id = request.get("id")
    request_type = request.get("type")

    if request_type != "speech:synthesize":
        return {"id": request_id, "ok": False, "error": f"Unsupported request type: {request_type}"}

    payload = request.get("payload") or {}
    text = str(payload.get("text") or "").strip()
    voice_id = str(payload.get("voiceId") or "")
    voice_name = VOICE_NAMES.get(voice_id)

    if not text:
        return {"id": request_id, "ok": False, "error": "Speech text is required."}

    if not voice_name:
        return {"id": request_id, "ok": False, "error": f"Unknown speech voice: {voice_id}."}

    audio, sample_rate = synthesize(text, voice_name)
    wav_bytes = wav_from_float_audio(audio, sample_rate)
    return {
        "id": request_id,
        "ok": True,
        "payload": {
            "mimeType": "audio/wav",
            "audioBase64": base64.b64encode(wav_bytes).decode("ascii"),
        },
    }


def synthesize(text, voice_name):
    global model
    if model is None:
        from mlx_audio.tts.utils import load_model

        model = load_model(MODEL_ID)

    results = list(generate(text, voice_name))
    if not results:
        raise RuntimeError("Qwen3 TTS returned no audio.")

    first = results[0]
    audio = getattr(first, "audio", None)
    if audio is None and isinstance(first, dict):
        audio = first.get("audio")
    if audio is None:
        raise RuntimeError("Qwen3 TTS response did not include audio.")

    sample_rate = (
        getattr(first, "sample_rate", None)
        or getattr(first, "sampling_rate", None)
        or (first.get("sample_rate") if isinstance(first, dict) else None)
        or 24000
    )
    return np.asarray(audio, dtype=np.float32), int(sample_rate)


def generate(text, voice_name):
    try:
        return model.generate(text=text, voice=voice_name, language="English")
    except TypeError:
        return model.generate(text=text, voice=voice_name, lang_code="English")


def wav_from_float_audio(audio, sample_rate):
    if audio.ndim == 1:
        channels = 1
    elif audio.ndim == 2:
        channels = audio.shape[1]
    else:
        raise RuntimeError(f"Unsupported audio shape: {audio.shape}")

    pcm = np.clip(audio, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype("<i2")

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm.tobytes())

    return buffer.getvalue()


def request_id_from(line):
    try:
        request = json.loads(line)
    except Exception:
        return None
    return request.get("id")


if __name__ == "__main__":
    main()
