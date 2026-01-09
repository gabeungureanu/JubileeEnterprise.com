#!/usr/bin/env python3
"""
Hey Jubilee - Custom Wake Word Listener for VS Code Dictation

This script listens for "Hey Jubilee" (or similar phrases) and triggers
VS Code's speech-to-text dictation at the cursor position.

Setup:
1. Get a free Picovoice AccessKey from https://console.picovoice.ai/
2. Create a custom "Hey Jubilee" wake word model at Picovoice Console
3. Set the ACCESS_KEY and KEYWORD_PATH below
4. Run: python hey_jubilee.py

Alternative: Uses built-in "Jarvis" wake word if no custom model provided.
"""

import os
import sys
import time
import argparse

try:
    import pvporcupine
    from pvrecorder import PvRecorder
    import pyautogui
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: python -m pip install pvporcupine pvrecorder pyautogui")
    sys.exit(1)

# =============================================================================
# CONFIGURATION
# =============================================================================

# Get your free AccessKey from https://console.picovoice.ai/
# Set via environment variable or edit directly here
ACCESS_KEY = os.environ.get("PICOVOICE_ACCESS_KEY", "DoI6JQcDVhQWGRSMHI5I4curg7ymIKKJ5xHugzf7g3lGWeGUvIAnSA==")

# Path to custom "Hey Jubilee" wake word model (.ppn file)
# Create at https://console.picovoice.ai/ > Porcupine > Train Wake Word
# Leave as None to use built-in "Jarvis" keyword
CUSTOM_KEYWORD_PATH = os.environ.get("JUBILEE_KEYWORD_PATH", None)

# Sensitivity: 0.0 (fewer false positives) to 1.0 (more sensitive)
# Increased to 0.8 for better detection
SENSITIVITY = 0.8

# Debounce time in seconds (prevents multiple triggers)
DEBOUNCE_SECONDS = 2.0

# =============================================================================
# WAKE WORD HANDLER
# =============================================================================

def on_wake_word_detected():
    """Called when the wake word is detected."""
    print("\n" + "=" * 50)
    print("  WAKE WORD DETECTED!")
    print("  Triggering Windows Voice Typing (Win+H)...")
    print("=" * 50 + "\n")

    # Small delay to ensure the app has focus
    time.sleep(0.2)

    # Use Windows Voice Typing (Win+H) - more reliable, works everywhere
    pyautogui.hotkey('win', 'h')

    # Alternative: VS Code's editor dictation (may conflict with Copilot)
    # pyautogui.hotkey('ctrl', 'alt', 'v')

def list_audio_devices():
    """List available audio input devices."""
    print("\nAvailable audio devices:")
    print("-" * 40)
    devices = PvRecorder.get_available_devices()
    for i, device in enumerate(devices):
        print(f"  [{i}] {device}")
    print("-" * 40)
    return devices

def main():
    parser = argparse.ArgumentParser(description="Hey Jubilee Wake Word Listener")
    parser.add_argument("--list-devices", action="store_true", help="List audio devices")
    parser.add_argument("--device", type=int, default=-1, help="Audio device index (-1 for default)")
    parser.add_argument("--sensitivity", type=float, default=SENSITIVITY, help="Detection sensitivity (0.0-1.0)")
    parser.add_argument("--access-key", type=str, default=ACCESS_KEY, help="Picovoice AccessKey")
    parser.add_argument("--keyword-path", type=str, default=CUSTOM_KEYWORD_PATH, help="Path to custom .ppn keyword file")
    parser.add_argument("--use-jarvis", action="store_true", help="Use built-in 'Jarvis' keyword instead of custom")
    args = parser.parse_args()

    if args.list_devices:
        list_audio_devices()
        return

    access_key = args.access_key

    if access_key == "YOUR_ACCESS_KEY_HERE":
        print("\n" + "=" * 60)
        print("  SETUP REQUIRED")
        print("=" * 60)
        print("""
To use Hey Jubilee, you need a free Picovoice AccessKey:

1. Go to https://console.picovoice.ai/
2. Create a free account
3. Copy your AccessKey
4. Set it as an environment variable:

   Windows (PowerShell):
   $env:PICOVOICE_ACCESS_KEY = "your-key-here"

   Or run with --access-key flag:
   python hey_jubilee.py --access-key "your-key-here"

For a custom "Hey Jubilee" wake word:
1. In Picovoice Console, go to Porcupine
2. Click "Train Wake Word"
3. Enter "Hey Jubilee"
4. Select Windows platform
5. Download the .ppn file
6. Run: python hey_jubilee.py --keyword-path path/to/hey_jubilee.ppn

Or use the built-in "Jarvis" keyword:
   python hey_jubilee.py --use-jarvis --access-key "your-key"
""")
        print("=" * 60)
        return

    # Initialize Porcupine
    try:
        if args.keyword_path and os.path.exists(args.keyword_path):
            # Use custom "Hey Jubilee" keyword
            print(f"Loading custom keyword: {args.keyword_path}")
            porcupine = pvporcupine.create(
                access_key=access_key,
                keyword_paths=[args.keyword_path],
                sensitivities=[args.sensitivity]
            )
            wake_word_name = "Hey Jubilee"
        elif args.use_jarvis:
            # Use built-in "Jarvis" keyword as alternative
            print("Using built-in 'Jarvis' keyword")
            porcupine = pvporcupine.create(
                access_key=access_key,
                keywords=["jarvis"],
                sensitivities=[args.sensitivity]
            )
            wake_word_name = "Jarvis"
        else:
            # Try to use "Hey Jubilee" custom path from env
            if CUSTOM_KEYWORD_PATH and os.path.exists(CUSTOM_KEYWORD_PATH):
                print(f"Loading custom keyword from env: {CUSTOM_KEYWORD_PATH}")
                porcupine = pvporcupine.create(
                    access_key=access_key,
                    keyword_paths=[CUSTOM_KEYWORD_PATH],
                    sensitivities=[args.sensitivity]
                )
                wake_word_name = "Hey Jubilee"
            else:
                print("No custom keyword found. Using built-in 'Jarvis' keyword.")
                print("Say 'Jarvis' to trigger dictation, or create a custom 'Hey Jubilee' keyword.")
                porcupine = pvporcupine.create(
                    access_key=access_key,
                    keywords=["jarvis"],
                    sensitivities=[args.sensitivity]
                )
                wake_word_name = "Jarvis"

    except pvporcupine.PorcupineActivationError as e:
        print(f"\nActivation error: {e}")
        print("Please check your AccessKey at https://console.picovoice.ai/")
        return
    except pvporcupine.PorcupineInvalidArgumentError as e:
        print(f"\nInvalid argument: {e}")
        return
    except Exception as e:
        print(f"\nError initializing Porcupine: {e}")
        return

    # Initialize audio recorder
    try:
        recorder = PvRecorder(
            device_index=args.device,
            frame_length=porcupine.frame_length
        )
    except Exception as e:
        print(f"\nError initializing audio recorder: {e}")
        print("\nTry listing devices with: python hey_jubilee.py --list-devices")
        porcupine.delete()
        return

    # Start listening
    print("\n" + "=" * 60)
    print(f"  HEY JUBILEE - Wake Word Listener")
    print("=" * 60)
    print(f"  Wake word: {wake_word_name}")
    print(f"  Sensitivity: {args.sensitivity}")
    print(f"  Audio device: {recorder.selected_device}")
    print(f"  Action: Trigger VS Code dictation (Ctrl+Alt+V)")
    print("=" * 60)
    print(f"\n  Listening for '{wake_word_name}'... (Press Ctrl+C to stop)\n")

    recorder.start()
    last_trigger_time = 0

    try:
        while True:
            audio_frame = recorder.read()
            keyword_index = porcupine.process(audio_frame)

            if keyword_index >= 0:
                current_time = time.time()
                if current_time - last_trigger_time > DEBOUNCE_SECONDS:
                    last_trigger_time = current_time
                    on_wake_word_detected()

    except KeyboardInterrupt:
        print("\n\nStopping Hey Jubilee listener...")
    finally:
        recorder.stop()
        porcupine.delete()
        print("Goodbye!")

if __name__ == "__main__":
    main()
