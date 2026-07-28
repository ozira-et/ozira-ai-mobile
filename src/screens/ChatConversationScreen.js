import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image, Keyboard, Platform, ActivityIndicator, Modal, Alert, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, radius } from '../theme';
import { useColors } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useLang } from '../context/LanguageContext';
import { rtlText, rtlRow, rtlIcon } from '../i18n';
import { useNotify } from '../context/NotifyContext';
import { api, absUrl } from '../api';
import Markdown from '../components/Markdown';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { getConversation, saveConversation, deleteConversation, setConversationMeta, setConversationFolder, listFolders, newId, getProfile } from '../localStore';
import Logo from '../components/Logo';
import FlagMenu from '../components/FlagMenu';
import VoiceOverlay from '../components/VoiceOverlay';
import { speakText, stopSpeaking } from '../tts';

const FLAG = { green: '#078930', yellow: '#FCDD09', red: '#DA121A' };
const PRIMARY_RED = '#B3121B';
const RESPONSE_LEVEL_IDS = [
  { id: 'quick', icon: 'flash' },
  { id: 'balanced', icon: 'remove' },
  { id: 'deep', icon: 'sparkles' },
];

// Starter prompts shown on the empty chat screen (translated via i18n keys).
const SUGGESTIONS = [
  { key: 'sug1', icon: 'create-outline' },
  { key: 'sug2', icon: 'bulb-outline' },
  { key: 'sug3', icon: 'airplane-outline' },
  { key: 'sug4', icon: 'school-outline' },
];

const MENU = [
  { key: 'photo', label: 'Photo', sub: 'Send a picture to the AI', icon: 'image', color: colors.primary },
  { key: 'camera', label: 'Camera', sub: 'Take a photo now', icon: 'camera', color: colors.accent },
  { key: 'file', label: 'File', sub: 'PDF, text or document', icon: 'document-text', color: colors.secondary },
  { key: 'image', label: 'Create image', sub: 'Generate a picture with AI', icon: 'color-palette', color: colors.gold },
  { key: 'research', label: 'Research', sub: 'Search the web to answer', icon: 'globe', color: colors.success },
  { key: 'connector', label: 'Connectors', sub: 'Link Telegram, Drive, Gmail…', icon: 'git-network', color: colors.accent },
];

export default function ChatConversationScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token, user } = useAuth();
  const { openSidebar } = useUI();
  const { lang, t, rtl } = useLang();
  const { notify } = useNotify();
  const responseLevels = useMemo(() => RESPONSE_LEVEL_IDS.map(level => ({
    ...level, label: t(level.id === 'quick' ? 'instant' : level.id === 'balanced' ? 'medium' : 'high'),
    sub: t(level.id === 'quick' ? 'instantSub' : level.id === 'balanced' ? 'mediumSub' : 'highSub'),
  })), [t]);
  const firstName = ((user?.name || '').trim().split(' ')[0]) || 'there';
  const greetWord = (() => { const h = new Date().getHours(); return h < 12 ? t('morning') : h < 18 ? t('afternoon') : t('evening'); })();
  const scrollRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [imageMode, setImageMode] = useState(!!route.params?.imageMode);
  const [mode, setMode] = useState('fast'); // 'fast' | 'smart'
  const [effort, setEffort] = useState('quick'); // Instant | Medium | High
  const [menuOpen, setMenuOpen] = useState(false);
  const [attachment, setAttachment] = useState(null); // { kind:'photo'|'file', name, base64, mimeType, text }
  const [research, setResearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const abortRef = useRef(null);
  const [convId, setConvId] = useState(route.params?.conversationId || newId());
  const dirtyRef = useRef(false);
  const instrRef = useRef('');
  const [kb, setKb] = useState(0);
  const [modeOpen, setModeOpen] = useState(false);     // Model + reply-depth picker
  const [convMenu, setConvMenu] = useState(false);     // top-right ⋯ menu
  const [pinned, setPinned] = useState(false);
  const [folderPick, setFolderPick] = useState(null);  // list of folders when picking
  const [reactions, setReactions] = useState({});      // index -> 1 | -1
  const [speakBusy, setSpeakBusy] = useState(null);    // index currently loading audio
  const [speakingIdx, setSpeakingIdx] = useState(null);// index currently playing
  const [voiceOpen, setVoiceOpen] = useState(false);   // live voice overlay
  const [editIdx, setEditIdx] = useState(null);         // index of message being edited

  useEffect(() => { getProfile().then(p => { instrRef.current = p.customInstructions || ''; }).catch(() => {}); }, []);
  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, e => { setKb(e.endCoordinates.height); scrollDown(); });
    const h = Keyboard.addListener(hideEvt, () => setKb(0));
    return () => { s.remove(); h.remove(); };
  }, []);

  async function startRec() {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permission needed', 'Allow microphone access to record a voice message.');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (e) { Alert.alert('Error', e.message); }
  }

  async function stopRec() {
    setRecording(false);
    setTranscribing(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording captured.');
      const b64 = await new File(uri).base64();
      const d = await api.aiTranscribe(b64, 'audio/m4a', token);
      if (d.configured === false) Alert.alert('Voice not set up yet', d.notice || 'Add the Gemini key in Railway to enable voice-to-text.');
      else if (d.error) Alert.alert('Could not transcribe', d.error);
      else if (d.text) { setTranscribing(false); send(d.text, true); return; }
      else Alert.alert('Nothing heard', 'Try recording again, a bit louder.');
    } catch (e) { Alert.alert('Error', e.message); }
    setTranscribing(false);
  }

  function stopGen() {
    try { if (abortRef.current) abortRef.current.abort(); } catch (_) {}
  }

  function onMenu(key) {
    setMenuOpen(false);
    // Mode toggles are pure state — safe to run immediately.
    if (key === 'image') { setImageMode(true); setResearch(false); return; }
    if (key === 'research') { setResearch(r => !r); setImageMode(false); return; }
    // Let the sheet unmount first, then open the native picker/screen.
    setTimeout(() => {
      if (key === 'photo') pickPhoto();
      else if (key === 'camera') takePhoto();
      else if (key === 'file') pickFile();
      else if (key === 'connector') navigation.navigate('Connectors');
    }, 80);
  }

  async function pickPhoto() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access to attach a picture.');
      const r = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6 });
      if (r.canceled || !r.assets || !r.assets.length) return;
      const a = r.assets[0];
      setImageMode(false); setResearch(false);
      setAttachment({ kind: 'photo', name: 'photo.jpg', base64: a.base64, mimeType: a.mimeType || 'image/jpeg' });
    } catch (e) { Alert.alert('Photo', e.message || 'Could not open the photo library.'); }
  }

  async function takePhoto() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permission needed', 'Allow camera access to take a photo.');
      const r = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 });
      if (r.canceled || !r.assets || !r.assets.length) return;
      const a = r.assets[0];
      setImageMode(false); setResearch(false);
      setAttachment({ kind: 'photo', name: 'photo.jpg', base64: a.base64, mimeType: a.mimeType || 'image/jpeg' });
    } catch (e) { Alert.alert('Camera', e.message || 'Could not open the camera.'); }
  }

  async function pickFile() {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (r.canceled || !r.assets || !r.assets.length) return;
      const a = r.assets[0];
      let textContent = '';
      try { textContent = await new File(a.uri).text(); } catch (_) {}
      setImageMode(false); setResearch(false);
      setAttachment({ kind: 'file', name: a.name || 'file', text: textContent, mimeType: a.mimeType || 'text/plain' });
      if (!textContent) Alert.alert('Heads up', 'Text files work now. PDFs need the server reader (coming soon), so this one may not be understood yet.');
    } catch (e) { Alert.alert('Error', e.message); }
  }

  useEffect(() => {
    const id = route.params?.conversationId;
    if (!id) return;
    setConvId(id);
    (async () => {
      const c = await getConversation(id);
      setMessages(c && c.messages ? c.messages : []);
      setPinned(!!(c && c.pinned));
      setReactions({});
    })();
  }, [route.params?.conversationId]);

  // ---- conversation actions (top-right ⋯ menu) ----
  function resetChat() {
    const id = newId();
    setConvId(id); setMessages([]); setPinned(false); setReactions({});
    navigation.setParams({ conversationId: id, title: 'New Chat' });
  }
  function transcript() {
    return messages.map(m => (m.role === 'user' ? 'You: ' : 'OZIRA: ') + (typeof m.content === 'string' ? m.content : '[image]')).join('\n\n');
  }
  async function shareConversation() {
    setConvMenu(false);
    if (!messages.length) return Alert.alert('Nothing to share', 'Start a conversation first.');
    try { await Share.share({ message: 'OZIRA AI chat\n\n' + transcript() }); } catch (_) {}
  }
  async function togglePin() {
    setConvMenu(false);
    const next = !pinned;
    setPinned(next);
    await setConversationMeta(convId, { pinned: next });
  }
  async function addToProject() {
    setConvMenu(false);
    const fs = await listFolders();
    if (!fs.length) return Alert.alert('No projects yet', 'Create a folder first from the sidebar (Folders › +).');
    setFolderPick(fs);
  }
  async function pickFolder(fid) {
    setFolderPick(null);
    await setConversationFolder(convId, fid);
    Alert.alert('Done', fid ? 'Chat added to the project.' : 'Chat removed from projects.');
  }
  function archiveConversation() {
    setConvMenu(false);
    Alert.alert('Archive chat', 'Move this chat to Archived? You can find it in the sidebar.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', onPress: async () => { await setConversationMeta(convId, { archived: true }); resetChat(); } },
    ]);
  }
  function deleteThis() {
    setConvMenu(false);
    Alert.alert('Delete chat', 'Permanently delete this chat? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteConversation(convId); resetChat(); } },
    ]);
  }

  // ---- per-message actions ----
  async function copyMsg(m) {
    try { await Clipboard.setStringAsync(typeof m.content === 'string' ? m.content : ''); } catch (_) {}
  }
  async function shareMsg(m) {
    try { await Share.share({ message: typeof m.content === 'string' ? m.content : '' }); } catch (_) {}
  }
  // Like / dislike. A rating that vanishes is worthless, so we do three things:
  // store it on the message (survives reload), report it to the backend, and —
  // for a dislike — offer to actually fix the answer instead of just logging it.
  async function react(i, m, value) {
    const next = (m.reaction === value) ? 0 : value;
    dirtyRef.current = true;
    setMessages(prev => prev.map((x, idx) => (idx === i ? { ...x, reaction: next } : x)));
    if (next !== 0) {
      try { await api.feedback(next, m.model || 'auto', (typeof m.content === 'string' ? m.content : '').slice(0, 500), token); } catch (_) {}
      if (next === 1) notify(t('thanksFeedback'), '', 'success');
      else {
        Alert.alert(t('thanksFeedback'), t('dislikeAsk'), [
          { text: t('no'), style: 'cancel' },
          { text: t('regenerate'), onPress: () => regenerate(i) },
        ]);
      }
    }
  }

  // Re-ask the question that produced message i, replacing the old answer.
  function regenerate(i) {
    for (let k = i - 1; k >= 0; k--) {
      if (messages[k].role === 'user') {
        const q = typeof messages[k].content === 'string' ? messages[k].content : '';
        if (q) send(q, false, { replaceFrom: k });
        return;
      }
    }
  }

  // Edit a message you already sent: load it back into the composer, then the
  // next send replaces it AND everything after, so the answer is regenerated.
  function startEdit(i, m) {
    setInput(typeof m.content === 'string' ? m.content : '');
    setEditIdx(i);
    scrollDown();
  }
  function cancelEdit() { setEditIdx(null); setInput(''); }
  function webSearch(m) {
    const text = typeof m.content === 'string' ? m.content : '';
    if (!text) return;
    send(text, false, { forceResearch: true });
  }
  async function onSpeak(i, m) {
    // Tapping the speaker of the message that's playing/loading stops it.
    if (speakingIdx === i || speakBusy === i) { stopSpeaking(); setSpeakingIdx(null); setSpeakBusy(null); return; }
    stopSpeaking(); setSpeakingIdx(null);
    setSpeakBusy(i);
    const res = await speakText(typeof m.content === 'string' ? m.content : '', token, () => setSpeakingIdx(null));
    setSpeakBusy(null);
    if (res && res.ok) setSpeakingIdx(i);
    else Alert.alert('Voice', (res && res.message) || 'Could not play audio.');
  }
  // Live-voice overlay writes each spoken turn into the chat as text.
  function appendVoiceExchange(userText, aiText) {
    dirtyRef.current = true;
    setMessages(prev => [...prev, { role: 'user', content: userText }, { role: 'assistant', content: aiText, model: 'Voice' }]);
    scrollDown();
  }
  function voiceHistory() {
    return messages.filter(m => !m.pending && typeof m.content === 'string' && m.content).map(m => ({ role: m.role, content: m.content }));
  }

  // Persist the conversation on-device after each settled exchange.
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (messages.some(m => m.pending)) return;
    dirtyRef.current = false;
    const firstUser = messages.find(m => m.role === 'user');
    const title = ((firstUser && typeof firstUser.content === 'string' ? firstUser.content : '') || 'New chat').slice(0, 40);
    saveConversation({
      id: convId,
      title,
      messages: messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '', image: m.image || null, thumb: m.thumb || null, model: m.model || null, reaction: m.reaction || 0 })),
    });
  }, [messages]);

  function scrollDown() { requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true })); }

  async function send(overrideText, fromVoice, opts = {}) {
    const text = (typeof overrideText === 'string' ? overrideText : input).trim();
    const att = attachment;
    const useResearch = research || !!opts.forceResearch;
    if ((!text && !att) || busy) return;
    setInput('');
    setAttachment(null);
    dirtyRef.current = true;
    const shown = text || (att ? (att.kind === 'photo' ? 'Photo' : att.name) : '');
    const thumb = att && att.kind === 'photo' ? ('data:' + att.mimeType + ';base64,' + att.base64) : null;
    // Editing an earlier message (or regenerating) rewinds history to that point,
    // so the stale answer and everything after it are dropped.
    const cut = opts.replaceFrom != null ? opts.replaceFrom : editIdx;
    const base = cut != null ? messages.slice(0, cut) : messages;
    if (editIdx != null) setEditIdx(null);
    const next = [...base, { role: 'user', content: shown, thumb }];
    setMessages([...next, { role: 'assistant', content: '...', pending: true }]);
    scrollDown();
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;
    const skill = route.params?.skill || 'general';
    try {
      if (imageMode && !useResearch) {
        const d = await api.image({ prompt: text }, token, signal);
        const img = d.images && d.images[0];
        setMessages([...next, img ? { role: 'assistant', image: absUrl(img.url) } : { role: 'assistant', content: d.notice || 'No image returned.' }]);
        // Image generation is slow — tell the user it landed.
        if (img) notify(t('notifImageReady'), t('notifImageReadySub'), 'success');
        else notify(t('notifFailed'), d.notice || '', 'warn');
      } else if (useResearch) {
        const d = await api.aiResearch(text, token, signal);
        const body = d.configured ? (d.text || d.error || 'No result.') : (d.notice || 'Research is not set up yet.');
        const src = (d.sources && d.sources.length) ? '\n\nSources:\n' + d.sources.slice(0, 5).join('\n') : '';
        setMessages([...next, { role: 'assistant', content: body + src, model: 'Research' }]);
        // Read only the answer aloud. Source URLs are useful on screen but should
        // never be sent to TTS, especially for voice-originated requests.
        if (fromVoice && body) {
          const spoken = await speakText(body, token);
          if (!spoken?.ok) notify(t('notifFailed'), spoken?.error || 'Voice playback could not start.', 'warn');
        }
      } else if (att && att.kind === 'photo') {
        const history = next.map((m, i) => ({ role: m.role, content: i === next.length - 1 ? (text || 'What is in this image?') : (typeof m.content === 'string' ? m.content : '') }));
        const d = await api.aiChat({ tier: mode, skill, messages: history, images: [{ base64: att.base64, mimeType: att.mimeType }], lang }, token, signal);
        setMessages([...next, { role: 'assistant', content: d.reply || d.error || 'No reply.', model: d.modelLabel || 'Vision' }]);
      } else {
        let lastContent = text;
        if (att && att.kind === 'file' && att.text) {
          lastContent = 'Here is a file named "' + att.name + '":\n\n' + att.text.slice(0, 12000) + '\n\n' + (text || 'Please read this and help me.');
        }
        const msgs = next.map((m, i) => ({ role: m.role, content: i === next.length - 1 ? lastContent : (typeof m.content === 'string' ? m.content : '') }));
        if (instrRef.current) msgs.unshift({ role: 'system', content: instrRef.current });
        const payload = { model: 'auto', tier: mode, effort, skill, messages: msgs, lang };
        const d = await api.chat(payload, token, signal);
        setMessages([...next, { role: 'assistant', content: d.reply, model: d.modelLabel }]);
        if (fromVoice && d.reply) {
          const spoken = await speakText(d.reply, token);
          if (!spoken?.ok) notify(t('notifFailed'), spoken?.message || 'Could not play the spoken reply.', 'error');
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') setMessages(next);
      else { setMessages([...next, { role: 'assistant', content: 'Error: ' + e.message }]); notify(t('notifFailed'), e.message, 'error'); }
    }
    abortRef.current = null;
    setBusy(false);
    scrollDown();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: kb }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <FlagMenu onPress={openSidebar} size={22} />
        <Pressable onPress={() => setModeOpen(o => !o)} style={styles.modeSel}>
          <Ionicons name={mode === 'smart' ? 'sparkles' : 'flash'} size={13} color={colors.primary} />
          <Text style={styles.modeSelTxt}>{mode === 'smart' ? t('smart') : t('fast')} · {responseLevels.find(x => x.id === effort)?.label || t('instant')}</Text>
          <Ionicons name={modeOpen ? 'chevron-up' : 'chevron-down'} size={13} color={colors.muted} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{route.params?.title || (imageMode ? 'Image Generator' : '')}</Text>
        <Pressable onPress={() => setConvMenu(true)} hitSlop={10}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
        </Pressable>
      </View>

      {modeOpen && (
        <View style={styles.modeDrop}>
          <Text style={styles.dropLabel}>{t('chooseModel')}</Text>
          <Pressable onPress={() => setMode('fast')} style={[styles.modeDropRow, mode === 'fast' && styles.modeDropOn]}>
            <Ionicons name="flash" size={15} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.modeDropTitle}>{t('fast')}</Text>
              <Text style={styles.modeDropSub}>{t('fastSub')}</Text>
            </View>
            {mode === 'fast' && <Ionicons name="checkmark" size={16} color={colors.primary} />}
          </Pressable>
          <Pressable onPress={() => setMode('smart')} style={[styles.modeDropRow, mode === 'smart' && styles.modeDropOn]}>
            <Ionicons name="sparkles" size={15} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.modeDropTitle}>{t('smart')}</Text>
              <Text style={styles.modeDropSub}>{t('smartSub')}</Text>
            </View>
            {mode === 'smart' && <Ionicons name="checkmark" size={16} color={colors.primary} />}
          </Pressable>
          <View style={styles.dropDivider} />
          <Text style={styles.dropLabel}>{t('replyDepth')}</Text>
          {responseLevels.map(level => (
            <Pressable key={level.id} onPress={() => setEffort(level.id)} style={[styles.modeDropRow, effort === level.id && styles.modeDropOn]}>
              <Ionicons name={level.icon} size={15} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modeDropTitle}>{level.label}</Text>
                <Text style={styles.modeDropSub}>{level.sub}</Text>
              </View>
              {effort === level.id && <Ionicons name="checkmark" size={16} color={colors.primary} />}
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 16 }} onContentSizeChange={scrollDown}>
        {messages.length === 0 && (
          <View style={styles.empty}>
            {/* Red hero card — mirrors the sidebar's brand look. */}
            <View style={styles.hero}>
              <View style={styles.heroLogo}>
                {imageMode ? <Ionicons name="image" size={34} color={PRIMARY_RED} /> : <Logo size={44} />}
              </View>
              <View style={styles.triDots}>
                <View style={[styles.dot, { backgroundColor: FLAG.green }]} />
                <View style={[styles.dot, { backgroundColor: FLAG.yellow }]} />
                <View style={[styles.dot, { backgroundColor: FLAG.red }]} />
              </View>
              <Text style={styles.heroGreet}>
                {imageMode ? t('describeImage') : `${greetWord}, ${firstName} 👋`}
              </Text>
              <Text style={styles.heroSub}>
                {imageMode ? 'Describe an image to generate.' : t('emptyHint')}
              </Text>
            </View>

            {!imageMode && (
              <View style={styles.sugWrap}>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s.key} style={[styles.sug, rtlRow(rtl)]} onPress={() => setInput(t(s.key))}>
                    <View style={styles.sugIcon}>
                      <Ionicons name={s.icon} size={17} color={PRIMARY_RED} />
                    </View>
                    <Text style={[styles.sugTxt, rtlText(rtl)]} numberOfLines={2}>{t(s.key)}</Text>
                    <Ionicons name={rtlIcon('arrow-forward', rtl)} size={15} color={colors.muted} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubble, m.role === 'user' ? styles.user : styles.ai]}>
            {m.role === 'assistant' && <Text style={styles.who}>{m.image ? 'Image' : 'OZIRA'}</Text>}
            {m.thumb ? <Image source={{ uri: m.thumb }} style={styles.thumb} /> : null}
            {m.image ? (
              <Image source={{ uri: m.image }} style={styles.image} resizeMode="cover" />
            ) : m.pending ? (
              <ActivityIndicator color={colors.muted} />
            ) : m.role === 'assistant' ? (
              // AI answers are markdown — render them as a formatted result,
              // not raw ** and ## in a chat bubble.
              <Markdown text={m.content} colors={colors} style={[styles.msgTxt, rtlText(rtl)]} />
            ) : (
              <Text style={[styles.msgTxt, rtlText(rtl), { color: colors.text }]}>{m.content}</Text>
            )}
            {!m.image && !m.pending && m.content ? (
              <View style={styles.actionRow}>
                {m.role === 'assistant' && (
                  <Pressable onPress={() => onSpeak(i, m)} style={styles.actBtn}>
                    {speakBusy === i ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name={speakingIdx === i ? 'stop-circle' : 'volume-high-outline'} size={15} color={speakingIdx === i ? colors.primary : colors.muted} />
                    )}
                  </Pressable>
                )}
                <Pressable onPress={() => copyMsg(m)} style={styles.actBtn}>
                  <Ionicons name="copy-outline" size={14} color={colors.muted} />
                </Pressable>
                {/* Edit your own message and re-run the answer. */}
                {m.role === 'user' && !m.thumb && (
                  <Pressable onPress={() => startEdit(i, m)} style={styles.actBtn}>
                    <Ionicons name="pencil-outline" size={14} color={editIdx === i ? colors.primary : colors.muted} />
                  </Pressable>
                )}
                {m.role === 'assistant' && (
                  <Pressable onPress={() => regenerate(i)} style={styles.actBtn}>
                    <Ionicons name="refresh-outline" size={14} color={colors.muted} />
                  </Pressable>
                )}
                {m.role === 'assistant' && (
                  <>
                    <Pressable onPress={() => react(i, m, 1)} style={styles.actBtn}>
                      <Ionicons name={m.reaction === 1 ? 'thumbs-up' : 'thumbs-up-outline'} size={14} color={m.reaction === 1 ? colors.success : colors.muted} />
                    </Pressable>
                    <Pressable onPress={() => react(i, m, -1)} style={styles.actBtn}>
                      <Ionicons name={m.reaction === -1 ? 'thumbs-down' : 'thumbs-down-outline'} size={14} color={m.reaction === -1 ? colors.danger : colors.muted} />
                    </Pressable>
                  </>
                )}
                <Pressable onPress={() => shareMsg(m)} style={styles.actBtn}>
                  <Ionicons name="share-social-outline" size={14} color={colors.muted} />
                </Pressable>
                <Pressable onPress={() => webSearch(m)} style={styles.actBtn}>
                  <Ionicons name="globe-outline" size={14} color={colors.muted} />
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: kb > 0 ? 10 : insets.bottom + 8 }]}>
        {recording ? (
          <View style={styles.statusHint}>
            <Text style={[styles.statusHintTxt, { color: colors.danger }]}>● Recording… tap the red button to stop</Text>
          </View>
        ) : transcribing ? (
          <View style={styles.statusHint}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.statusHintTxt, { color: colors.primary }]}>Transcribing your voice…</Text>
          </View>
        ) : imageMode ? (
          <Pressable onPress={() => setImageMode(false)} style={styles.statusHint}>
            <Text style={[styles.statusHintTxt, { color: colors.gold }]}>Create-image mode on - tap to turn off</Text>
            <Ionicons name="close" size={14} color={colors.gold} />
          </Pressable>
        ) : research ? (
          <Pressable onPress={() => setResearch(false)} style={styles.statusHint}>
            <Text style={[styles.statusHintTxt, { color: colors.success }]}>Research mode on - I'll search the web</Text>
            <Ionicons name="close" size={14} color={colors.success} />
          </Pressable>
        ) : null}
        {editIdx != null ? (
          <View style={styles.attachChip}>
            <Ionicons name="pencil" size={14} color={colors.primary} />
            <Text style={styles.attachTxt} numberOfLines={1}>{t('editingMsg')}</Text>
            <Pressable onPress={cancelEdit} hitSlop={8}><Ionicons name="close" size={16} color={colors.muted} /></Pressable>
          </View>
        ) : null}
        {attachment ? (
          <View style={styles.attachChip}>
            <Ionicons name={attachment.kind === 'photo' ? 'image' : 'document-text'} size={15} color={colors.primary} />
            <Text style={styles.attachTxt} numberOfLines={1}>{attachment.name}</Text>
            <Pressable onPress={() => setAttachment(null)} hitSlop={8}><Ionicons name="close" size={16} color={colors.muted} /></Pressable>
          </View>
        ) : null}
        <View style={[styles.inputRow, rtlRow(rtl)]}>
          <Pressable onPress={() => setMenuOpen(true)} style={styles.round}>
            <Ionicons name="add" size={24} color={colors.muted} />
          </Pressable>
          <TextInput
            style={[styles.input, rtlText(rtl)]}
            value={input}
            onChangeText={setInput}
            placeholder={imageMode ? t('describeImage') : t('askPlaceholder')}
            placeholderTextColor={colors.muted}
            multiline
          />
          {busy ? (
            <Pressable onPress={stopGen} style={styles.stopBtn}>
              <Ionicons name="stop" size={18} color={colors.white} />
            </Pressable>
          ) : recording ? (
            <Pressable onPress={stopRec} style={styles.stopBtn}>
              <Ionicons name="stop" size={18} color={colors.white} />
            </Pressable>
          ) : transcribing ? (
            <View style={styles.send}><ActivityIndicator size="small" color={colors.white} /></View>
          ) : (input.trim() || attachment) ? (
            <Pressable onPress={send} style={styles.send}>
              <Ionicons name="arrow-up" size={20} color={colors.white} />
            </Pressable>
          ) : (
            <Pressable onPress={() => setVoiceOpen(true)} style={styles.voiceBtn}>
              <Ionicons name="mic" size={22} color={colors.white} />
            </Pressable>
          )}
        </View>
        <Text style={styles.disclaimer}>{t('disclaimer')}</Text>
      </View>

      <Modal visible={convMenu} transparent animationType="fade" onRequestClose={() => setConvMenu(false)}>
        <Pressable style={styles.convMenuBg} onPress={() => setConvMenu(false)}>
          <View style={[styles.convMenu, { marginTop: insets.top + 44 }]}>
            <Pressable style={styles.convItem} onPress={shareConversation}>
              <Ionicons name="share-social-outline" size={18} color={colors.text} />
              <Text style={styles.convItemTxt}>Share</Text>
            </Pressable>
            <Pressable style={styles.convItem} onPress={togglePin}>
              <Ionicons name={pinned ? 'pin' : 'pin-outline'} size={18} color={pinned ? colors.gold : colors.text} />
              <Text style={styles.convItemTxt}>{pinned ? 'Unpin' : 'Pin'}</Text>
            </Pressable>
            <Pressable style={styles.convItem} onPress={addToProject}>
              <Ionicons name="folder-outline" size={18} color={colors.text} />
              <Text style={styles.convItemTxt}>Add to project</Text>
            </Pressable>
            <Pressable style={styles.convItem} onPress={archiveConversation}>
              <Ionicons name="archive-outline" size={18} color={colors.text} />
              <Text style={styles.convItemTxt}>Archive</Text>
            </Pressable>
            <View style={styles.convDivider} />
            <Pressable style={styles.convItem} onPress={deleteThis}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={[styles.convItemTxt, { color: colors.danger }]}>Delete</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!folderPick} transparent animationType="fade" onRequestClose={() => setFolderPick(null)}>
        <Pressable style={styles.convMenuBg} onPress={() => setFolderPick(null)}>
          <View style={[styles.convMenu, { marginTop: insets.top + 44 }]}>
            <Text style={styles.convHeader}>Add to project</Text>
            {(folderPick || []).map(f => (
              <Pressable key={f.id} style={styles.convItem} onPress={() => pickFolder(f.id)}>
                <Ionicons name="folder" size={18} color={colors.gold} />
                <Text style={styles.convItemTxt}>{f.name}</Text>
              </Pressable>
            ))}
            <View style={styles.convDivider} />
            <Pressable style={styles.convItem} onPress={() => pickFolder(null)}>
              <Ionicons name="remove-circle-outline" size={18} color={colors.muted} />
              <Text style={[styles.convItemTxt, { color: colors.muted }]}>No project</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Attachment sheet — a plain in-tree overlay, NOT a <Modal>. This screen
          already stacks several Modals; on Android extra ones can fail to show
          or swallow taps, and a native picker can't launch while one dismisses. */}
      {menuOpen && (
        <View style={styles.menuBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setMenuOpen(false)} />
          <View style={[styles.menuSheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.menuHandle} />
            {MENU.map(item => (
              <Pressable key={item.key} style={styles.menuItem} onPress={() => onMenu(item.key)}>
                <View style={[styles.menuIcon, { backgroundColor: item.color + '22' }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuSub}>{item.sub}</Text>
                </View>
                {item.soon ? <Text style={styles.soon}>Soon</Text> : <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <VoiceOverlay
        visible={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        token={token}
        lang={lang}
        userName={firstName}
        getHistory={voiceHistory}
        onExchange={appendVoiceExchange}
      />
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  modeSel: {
    flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 8,
    backgroundColor: 'transparent', borderWidth: 1, borderColor: 'transparent',
    borderRadius: 999, paddingHorizontal: 5, paddingVertical: 2,
  },
  modeSelTxt: { color: colors.text, fontFamily: fonts.semibold, fontSize: 10.5 },
  modeDrop: {
    position: 'absolute', top: 0, left: 12, zIndex: 50, marginTop: 92,
    // Nearly transparent: it remains readable while letting the chat show through.
    backgroundColor: colors.bg + 'D9', borderWidth: 1, borderColor: colors.primary + '88',
    borderRadius: 10, padding: 3, width: 210, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  dropLabel: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 9, paddingHorizontal: 7, paddingTop: 4, paddingBottom: 1, textTransform: 'uppercase' },
  dropDivider: { height: 1, backgroundColor: colors.primary + '44', marginVertical: 2 },
  modeDropRow: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 6, borderRadius: 7 },
  modeDropOn: { backgroundColor: colors.primary + '22' },
  modeDropTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 12 },
  modeDropSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9.5, marginTop: 1 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  // These are deliberately separate 36px targets. Previously their hitSlop
  // regions overlapped, causing Copy taps to sometimes invoke Refresh.
  actBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  convMenuBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'flex-end', paddingRight: 10 },
  convMenu: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, paddingVertical: 6, width: 220,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  convHeader: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 14, paddingVertical: 8 },
  convItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  convItemTxt: { color: colors.text, fontFamily: fonts.medium, fontSize: 14.5 },
  convDivider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  empty: { marginTop: 18, gap: 18 },
  hero: {
    backgroundColor: PRIMARY_RED, borderRadius: 26, alignItems: 'center',
    paddingVertical: 26, paddingHorizontal: 22, gap: 11,
  },
  heroLogo: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  triDots: { flexDirection: 'row', gap: 7 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  heroGreet: { color: '#FFFFFF', fontFamily: fonts.bold, fontSize: 21, textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.82)', fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  sugWrap: { gap: 10 },
  sug: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, paddingVertical: 13, paddingHorizontal: 14,
  },
  sugIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  sugTxt: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 14.5 },
  greet: { color: colors.text, fontFamily: fonts.bold, fontSize: 20, textAlign: 'center' },
  emptyTxt: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14.5, textAlign: 'center' },
  bubble: { maxWidth: '86%', padding: 12, borderRadius: 16, marginBottom: 12 },
  user: { alignSelf: 'flex-end', backgroundColor: colors.card, borderBottomRightRadius: 4 },
  ai: {
    alignSelf: 'flex-start', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4,
  },
  who: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 11.5, marginBottom: 5 },
  msgTxt: { color: colors.text, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  speakBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, alignSelf: 'flex-start' },
  speakTxt: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12 },
  image: { width: 240, height: 240, borderRadius: 12 },
  composer: {
    paddingHorizontal: 12, paddingTop: 8, backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  imgHint: { color: colors.primary, fontFamily: fonts.medium, fontSize: 12, marginBottom: 6, marginLeft: 6 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginLeft: 2 },
  modePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  modePillOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  modePillOnSmart: { backgroundColor: colors.accent, borderColor: colors.accent },
  modeTxt: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 12 },
  modeHint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10.5, flex: 1, marginLeft: 4 },
  statusHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginLeft: 4 },
  statusHintTxt: { fontFamily: fonts.medium, fontSize: 12 },
  thumb: { width: 150, height: 150, borderRadius: 10, marginBottom: 6 },
  attachChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 999, paddingLeft: 12, paddingRight: 8, paddingVertical: 6, marginBottom: 8, maxWidth: '80%',
  },
  attachTxt: { color: colors.text, fontFamily: fonts.medium, fontSize: 12.5, flexShrink: 1 },
  menuBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 50,
    ...(Platform.OS === 'android' ? { elevation: 50 } : null),
  },
  menuSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 12, paddingTop: 10 },
  menuHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 6 },
  menuIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  menuSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  soon: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11, backgroundColor: colors.card, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  round: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    color: colors.text, fontFamily: fonts.regular, fontSize: 15,
  },
  send: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  voiceBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  stopBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  disclaimer: {
    color: colors.muted, fontFamily: fonts.regular, fontSize: 10.5,
    textAlign: 'center', marginTop: 8, paddingHorizontal: 20, lineHeight: 14,
  },
});
