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
  // stop() also finalises the file that callers read from recorder.uri, so it
  // must run whenever there is a session, not only while actively recording.
  try {
    if (recorder && (recorder.isRecording || recorderReady(recorder))) await recorder.stop();
  } catch (_) {}
}
