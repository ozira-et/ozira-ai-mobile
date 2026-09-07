describe('account-bound audio playback', () => {
  let session, tts, setAudioMode, createAudioPlayer;

  beforeEach(() => {
    jest.resetModules();
    session = require('../src/accountSession');
    setAudioMode = jest.fn(() => new Promise(resolve => { setAudioMode.release = resolve; }));
    createAudioPlayer = jest.fn(() => ({ play: jest.fn(), addListener: jest.fn(), remove: jest.fn(), pause: jest.fn() }));
    jest.doMock('expo-audio', () => ({ setAudioModeAsync: setAudioMode, createAudioPlayer }));
    jest.doMock('expo-file-system/legacy', () => ({ writeAsStringAsync: jest.fn(), cacheDirectory: 'cache/', EncodingType: { Base64: 'base64' } }));
    jest.doMock('../src/localStore', () => ({ getSettings: jest.fn(async () => ({ lang: 'en', voice: 'Kore' })) }));
    jest.doMock('../src/api', () => ({ api: { aiSpeak: jest.fn(async () => ({ audio: 'AAAA' })) } }));
    tts = require('../src/tts');
    session.setAccountSession('token-a', 'user-a');
  });

  it('does not start A audio after the session switches to B while playback is preparing', async () => {
    const pending = tts.speakText('A message', 'token-a');
    for (let i = 0; i < 10 && !setAudioMode.mock.calls.length; i += 1) await Promise.resolve();
    session.setAccountSession('token-b', 'user-b');
    tts.stopSpeaking();
    setAudioMode.release();
    await expect(pending).resolves.toMatchObject({ ok: false });
    expect(createAudioPlayer).not.toHaveBeenCalled();
  });

  it('keeps normal same-account playback working', async () => {
    const pending = tts.speakText('A message', 'token-a');
    for (let i = 0; i < 10 && !setAudioMode.mock.calls.length; i += 1) await Promise.resolve();
    setAudioMode.release();
    await expect(pending).resolves.toEqual({ ok: true });
    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
  });
});
