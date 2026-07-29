import { File } from 'expo-file-system';

// Shared recorder lifecycle helpers.
//
// expo-audio has no release() — only stop() — and calling prepareToRecordAsync
// on an already-prepared recorder throws:
//
//   AudioRecorder has already been prepared. Stop or release the current
//   session before preparing again.
//
// That happens whenever a previous turn ended without a successful stop (an
// interrupted turn, a screen left mid-recording, a failed stop). Tracking
// "prepared" in a JS flag drifts from native state, so ask the recorder itself
// via getStatus().canRecord, and recover if native still disagrees.

/** Whether the recorder is prepared and able to record, per the native side. */
export function recorderReady(recorder) {
  try {
    const st = recorder && recorder.getStatus ? recorder.getStatus() : null;
    return !!(st && st.canRecord);
  } catch (_) { return false; }
}

/** Prepare only if needed, recovering from an already-prepared session. */
export async function ensurePrepared(recorder) {
  if (recorderReady(recorder)) return;
  try {
    await recorder.prepareToRecordAsync();
  } catch (e) {
    if (!/already been prepared/i.test(String((e && e.message) || e))) throw e;
    try { await recorder.stop(); } catch (_) {}
    await recorder.prepareToRecordAsync();
  }
}

/** Stop a recording/prepared session, ignoring "wasn't recording" errors. */
export async function releaseRecorder(recorder) {
  // ALWAYS attempt stop. stop() is what writes the MPEG-4 index (moov atom);
  // skip it and the file still contains audio but no decoder can read it —
  // which looked like "no speech detected" while the upload was hundreds of KB.
  // Guarding this on isRecording/canRecord was wrong: those can both read false
  // for a moment while a recording is genuinely in progress. A redundant stop
  // just throws, which is harmless here; a skipped stop corrupts the recording.
  try { if (recorder) await recorder.stop(); } catch (_) {}
}

/**
 * Stop and wait until the file on disk stops growing, then return its uri.
 * The native encoder finishes writing slightly after stop() resolves, so
 * reading immediately can capture a half-written container.
 */
export async function finalizeRecording(recorder, { tries = 12, intervalMs = 40 } = {}) {
  await releaseRecorder(recorder);
  const uri = recorder && recorder.uri;
  if (!uri) return { uri: null, size: 0 };
  let last = -1, size = 0;
  for (let i = 0; i < tries; i++) {
    try { const f = new File(uri); size = f.exists ? (f.size || 0) : 0; } catch (_) { size = 0; }
    if (size > 0 && size === last) break;   // two identical reads: writing has finished
    last = size;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { uri, size };
}
