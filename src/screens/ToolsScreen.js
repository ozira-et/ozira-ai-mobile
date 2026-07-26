import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { useColors } from '../context/ThemeContext';
import FlagMenu from '../components/FlagMenu';
import { useUI } from '../context/UIContext';

// Each tool opens the chat with a matching backend skill preselected.
const TOOLS = [
  { skill: 'general',    title: 'AI Writer',        sub: 'Write anything with AI',            icon: 'create',        color: colors.primary },
  { skill: 'general',    title: 'Summarizer',       sub: 'Summarize long content',            icon: 'list',          color: colors.accent },
  { skill: 'translator', title: 'Translator',       sub: 'Amharic - English translation',     icon: 'language',      color: colors.secondary },
  { skill: 'image',      title: 'Image Generator',  sub: 'Create images with AI',             icon: 'image',         color: colors.gold },
  { skill: 'general',    title: 'Code Helper',      sub: 'Get help with code',                icon: 'code-slash',    color: colors.success },
  { skill: 'contract',   title: 'Document Reviewer',sub: 'Review contracts and documents',    icon: 'document-text', color: colors.primary },
  { skill: 'business',   title: 'Business Planner', sub: 'Plans for the Ethiopian market',    icon: 'trending-up',   color: colors.accent },
  { skill: 'tutor',      title: 'Study Tutor',      sub: 'Learn step by step',                icon: 'school',        color: colors.secondary },
  { skill: 'marketing',  title: 'Marketing Copy',   sub: 'Ads for Telegram, TikTok and more', icon: 'megaphone',     color: colors.gold },
];

export default function ToolsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = makeStyles(colors);
  const { openSidebar } = useUI();

  function openTool(t) {
    navigation.navigate('ChatConversation', {
      skill: t.skill === 'image' ? undefined : t.skill,
      imageMode: t.skill === 'image',
      title: t.title,
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <FlagMenu onPress={openSidebar} size={24} />
        <Text style={styles.title}>AI Tools</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
        <Text style={styles.section}>Popular Tools</Text>
        {TOOLS.map((t, i) => (
          <Pressable key={i} style={styles.row} onPress={() => openTool(t)}>
            <View style={[styles.icon, { backgroundColor: t.color + '22' }]}>
              <Ionicons name={t.icon} size={19} color={t.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t.title}</Text>
              <Text style={styles.rowSub}>{t.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  section: { color: colors.text, fontFamily: fonts.semibold, fontSize: 16, marginBottom: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 13, marginBottom: 10,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14.5 },
  rowSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
});
