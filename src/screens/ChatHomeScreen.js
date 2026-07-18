import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { api } from '../api';

const QUICK = [
  { key: 'chat', title: 'AI Chat', sub: 'Ask me anything', icon: 'chatbubbles', color: colors.primary },
  { key: 'travel', title: 'Travel', sub: 'Plan your trip', icon: 'airplane', color: colors.accent },
  { key: 'tools', title: 'AI Tools', sub: 'Boost productivity', icon: 'grid', color: colors.secondary },
  { key: 'image', title: 'Image', sub: 'Create with AI', icon: 'image', color: colors.gold },
];

export default function ChatHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { openSidebar } = useUI();
  const [recent, setRecent] = useState([]);

  useEffect(() => { (async () => {
    try { const d = await api.conversations(token); setRecent((d.conversations || []).slice(0, 5)); } catch (_) {}
  })(); }, [token]);

  function startChat(imageMode = false) {
    navigation.navigate('ChatConversation', { imageMode });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={openSidebar} hitSlop={10}>
          <Ionicons name="menu" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.brand}>OZIRA <Text style={{ color: colors.primary }}>AI</Text></Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 24 }}>
        <Text style={styles.hello}>Hello, {user?.name?.split(' ')[0] || 'there'}</Text>
        <Text style={styles.helloSub}>How can I help you today?</Text>

        <View style={styles.grid}>
          {QUICK.map(q => (
            <Pressable key={q.key} style={styles.tile} onPress={() => startChat(q.key === 'image')}>
              <View style={[styles.tileIcon, { backgroundColor: q.color + '22' }]}>
                <Ionicons name={q.icon} size={20} color={q.color} />
              </View>
              <Text style={styles.tileTitle}>{q.title}</Text>
              <Text style={styles.tileSub}>{q.sub}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>Recent Chats</Text>
        {recent.length === 0 ? (
          <Text style={styles.empty}>No chats yet. Tap a card above to start.</Text>
        ) : recent.map(c => (
          <Pressable key={c.id} style={styles.recent} onPress={() => navigation.navigate('ChatConversation', { conversationId: c.id, title: c.title })}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.muted} />
            <Text style={styles.recentTxt} numberOfLines={1}>{c.title}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable style={[styles.fab, { bottom: insets.bottom + 18 }]} onPress={() => startChat(false)}>
        <Ionicons name="add" size={26} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  brand: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  hello: { color: colors.text, fontFamily: fonts.bold, fontSize: 24 },
  helloSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14.5, marginTop: 4, marginBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47%', flexGrow: 1, backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border,
  },
  tileIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  tileTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  tileSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5, marginTop: 2 },
  section: { color: colors.text, fontFamily: fonts.semibold, fontSize: 16, marginTop: 24, marginBottom: 10 },
  empty: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13.5 },
  recent: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
    borderRadius: radius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  recentTxt: { color: colors.text, fontFamily: fonts.regular, fontSize: 14, flex: 1 },
  fab: {
    position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 6,
  },
});
