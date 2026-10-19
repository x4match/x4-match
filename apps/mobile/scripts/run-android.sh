#!/usr/bin/env bash
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
export PATH="$JAVA_HOME/bin:$PATH"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
ADB="$SDK/platform-tools/adb"
EMU="$SDK/emulator/emulator"
AVD="${ANDROID_AVD:-Small_Phone}"
LOG="${TMPDIR:-/tmp}/x4-emulator.log"

boot_completed() {
  "$ADB" devices | grep -qE '^emulator-[0-9]+[[:space:]]+device' \
    && [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]
}

if ! boot_completed; then
  echo "› Starting emulator $AVD with host GPU (Iris Xe). First boot can take a couple of minutes..."
  # Wayland Qt plugin is missing in the Android emulator; xcb is stable on GNOME.
  # swiftshader_indirect renders on CPU and freezes the UI even if the machine is not at 100%.
  QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-xcb}" \
    "$EMU" -avd "$AVD" -gpu host -accel on -no-boot-anim -no-audio -memory 1536 -cores 2 >"$LOG" 2>&1 &
  for _ in $(seq 1 80); do
    if boot_completed; then
      break
    fi
    sleep 3
  done
  if ! boot_completed; then
    echo "El emulador no terminó de arrancar. Revisá $LOG"
    exit 1
  fi
fi

# Menos trabajo de GPU/CPU en la UI del guest.
"$ADB" shell settings put global window_animation_scale 0 >/dev/null 2>&1 || true
"$ADB" shell settings put global transition_animation_scale 0 >/dev/null 2>&1 || true
"$ADB" shell settings put global animator_duration_scale 0 >/dev/null 2>&1 || true

exec expo run:android --device "$AVD" -- -PreactNativeArchitectures=x86_64 "$@"
