import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { useAuth } from '../context/AuthContext';
import { api, absUrl } from '../api';

export default function ChatConversationScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const scrollRef = useRef(null);
  const [messages, setMessages] = useState([]); // {role, content, image?}
  const [input, setInput] = useState('');
  const [imageMode, setImageMode] = useState(!!route.params?.imageMode);
  const [busy, setBusy] = useState(false);

  useEffect(() => { (async () => {
    const id = route.params?.conversationId;
    if (!id) return;
    try {
      const d = await api.getConversation(id, token);
      setMessages((d.conversation.messages || []).map(m => ({ role: m.role, content: m.content })));
    } catch (_) {}
  })(); }, [route.params?.conversationId]);

  function scrollDown() { requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true })); }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const next = [...messages, { role: 'user', content: text }];
    setMessages([...next, { role: 'assistant', content: '…', pending: true }]);
    scrollDown();
    setBusy(true);
    try {
      if (imageMode) {
        const d = await api.image({ prompt: text }, token);
        const img = d.images && d.images[0];
        setMessages([...next, img ? { role: 'assistant', image: absUrl(img.url) } : { role: 'assistant', content: d.notice || 'No image returned.' }]);
      } else {
        const payload = { model: 'auto', effort: 'balanced', skill: 'general', messages: next.map(m => ({ role: m.role, content: m.content })) };
        const d = await api.chat(payload, token);
        setMessages([...next, { role: 'assistant', content: d.reply, model: d.modelLabel }]);
      }
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: '⚠️ ' + e.message }]);
    }
    setBusy(false);
    scrollDown();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }} keyboardVerticalOffset={0}>
      {/* header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={26} color={colors.text} /></Pressable>
        <Text style={styles.title} numberOfLines={1}>{route.params?.title || (imageMode ? 'Image Generator' : 'New Chat')}</Text>
        <Pressable onPress={() => setImageMode(m => !m)} hitSlop={10}>
          <Ionicons name="image" size={22} color={imageMode ? colors.primary : colors.muted} />
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 16 }} onContentSizeChange={scrollDown}>
        {messages.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name={imageMode ? 'image' : 'sparkles'} size={40} color={colors.primary} />
            <Text style={styles.emptyTxt}>{imageMode ? 'Describe an image to generate.' : 'Ask me anything in Amharic or English.'}</Text>
          </View>
        )}
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubble, m.role === 'user' ? styles.user : styles.ai]}>
            {m.role === 'assistant' && <Text style={styles.who}>{m.image ? '🎨 Image' : (m.model || 'OZIRA')}</Text>}
            {m.image ? (
              <Image source={{ uri: m.image }} style={styles.image} resizeMode="cover" />
            ) : m.pending ? (
              <ActivityIndicator color={colors.muted} />
            ) : (
              <Text style={[styles.msgTxt, m.role === 'user' && { color: colors.text }]}>{m.content}</Text>
            )}
          </View>
        ))}
      </ScrollView>

      {/* composer */}
      <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
        {imageMode && <Text style={styles.imgHint}>🎨 Image mode on</Text>}
        <View style={styles.inputRow}>
          <Pressable onPress={() => setImageMode(m => !m)} style={[styles.round, imageMode && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
            <Ionicons name="image" size={18} color={imageMode ? colors.white : colors.muted} />
          </Pressable>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={imageMode ? 'Describe the image…' : 'Ask me anything…'}
            placeholderTextColor={colors.muted}
            multiline
          />
          <Pressable onPress={send} disabled={busy} style={[styles.send, busy && { opacity: 0.5 }]}>
            <Ionicons name="arrow-up" size={20} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 16, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  empty: { alignItems: 'center', marginTop: 80, gap: 12, paddingHorizontal: 30 },
  emptyTxt: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14.5, textAlign: 'center' },
  bubble: { maxWidth: '86%', padding: 12, borderRadius: 16, marginBottom: 12 },
  user: { alignSelf: 'flex-end', backgroundColor: colors.card, borderBottomRightRadius: 4 },
  ai: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  who: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 11.5, marginBottom: 5 },
  msgTxt: { color: colors.text, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  image: { width: 240, height: 240, borderRadius: 12 },
  composer: { paddingHorizontal: 12, paddingTop: 8, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
  imgHint: { color: colors.primary, fontFamily: fonts.medium, fontSize: 12, marginBottom: 6, marginLeft: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, color: colors.text, fontFamily: fonts.regular, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
