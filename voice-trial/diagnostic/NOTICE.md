# Pangmao — controlled pronunciation diagnostic, 8 October 2026

These twenty experimental files are synthetic speech, not speaker recordings.
They retain [the UPMC Jessica/Pierre source attributions and model licence](../NOTICE.md)
and are distributed under CC BY-SA 4.0. Retain both notices with redistributed
audio. No other voice model is introduced or integrated into the dictionary.

`tools/generate_web_voice_diagnostic.py` uses the same pinned UPMC model and
Piper 1.4.1 as the trial. It regenerates all controls specifically for this
experiment; they are not byte-identical copies of the earlier trial. The
manifest retains the earlier clip hashes as references.

- A (mono MP3, 64 kbit/s) and B (mono 16-bit PCM WAV) derive from **exactly the
  same source PCM**. They have identical inputs and frame counts. Integrity
  and shared-source hashes are verified. Comparing these files isolates the
  codec/container and playback path; equal frame counts alone do not establish
  equal perceived pronunciation.
- C, available only for médecin and avocat, uses `medsˈɛ̃` and `avɔkˈa` as
  explicit phonemes. The unstressed IPA matches the existing FreeDict/WikDict
  fra-zho 2025.11.23 pack (CC BY-SA 3.0, WikDict/Wiktionary/DBnary contributors,
  [source](https://download.freedict.org/dictionaries/fra-zho/2025.11.23/)).
  Entry IDs and original IPA alternatives are recorded in the manifest.
  Stress placement is Piper notation. These are diagnostic hypotheses, not
  accepted word overrides; displayed wording and the stable app are unchanged.
- Each synthesis uses a fresh CPU session, seed 0, one thread, length scale
  1.0 and the model's default noise settings. A/B share one synthesis; C uses
  the same model, speaker and settings with a different phoneme input.
- The compatibility audit compares the current conversion with the historical
  [piper-phonemize 2023.11.14-4 release](https://github.com/rhasspy/piper-phonemize/releases/tag/2023.11.14-4).
  The archive hash, exact texts and outputs are recorded. This is a historical
  comparison, not proof of the exact phonemizer used during model training.

Generation is manual and offline after source acquisition. ONNX telemetry is
disabled before import and through its API. Models, binaries and generation
dependencies are not distributed. Only fixed original test texts are used;
no personal text or feedback is sent to a synthesis service. The page loads
only selected files and requires a network connection; it promises no offline
cache. Audio quality remains unaccepted until listening on the target device.
