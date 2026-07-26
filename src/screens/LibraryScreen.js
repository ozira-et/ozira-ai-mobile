import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, ActivityIndicator, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { useColors } from '../context/ThemeContext';
import FlagMenu from '../components/FlagMenu';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { api, absUrl } from '../api';

const GAP = 10;
const COL_W = (Dimensions.get('window').width - 32 - GAP) / 2;

export default function LibraryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token } = useAuth();
  const { openSidebar } = useUI();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all'); // 'all' | 'images' | 'files'

  async function load() {
    try { const d = await api.images(token); setImages(d.images || []); } catch (_) {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <FlagMenu onPress={openSidebar} size={24} />
        <Text style={styles.title}>Library</Text>
        <Pressable onPress={() => navigation.navigate('ChatConversation', { imageMode: true, title: 'Image Generator' })} hitSlop={10}>
          <Ionicons name="add" size={26} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {['all', 'images', 'files'].map(t => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
            <Text style={[styles.tabTxt, tab === t && { color: colors.primary }]}>{t.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'files' ? (
        <View style={styles.empty}>
          <Ionicons name="document-outline" size={44} color={colors.muted} />
          <Text style={styles.emptyTxt}>File storage is coming soon. Documents you attach in chat aren't saved to your library yet.</Text>
        </View>
      ) : loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        images.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="images-outline" size={44} color={colors.muted} />
            <Text style={styles.emptyTxt}>No images yet. Generate one and it will be saved here.</Text>
            <Pressable style={styles.genBtn} onPress={() => navigation.navigate('ChatConversation', { imageMode: true, title: 'Image Generator' })}>
              <Ionicons name="color-palette" size={17} color={colors.white} />
              <Text style={styles.genTxt}>Create an image</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
            <View style={styles.grid}>
              {images.map(img => (
                <View key={img.id} style={styles.cell}>
                  <Image source={{ uri: absUrl(img.url) }} style={styles.img} resizeMode="cover" />
                  {img.prompt ? <Text style={styles.caption} numberOfLines={2}>{img.prompt}</Text> : null}
                </View>
              ))}
            </View>
          </ScrollView>
        )
      )}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabOn: { borderColor: colors.primary },
  tabTxt: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 12 },
  empty: { alignItems: 'center', marginTop: 90, gap: 14, paddingHorizontal: 40 },
  emptyTxt: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  genBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 18, paddingVertical: 11 },
  genTxt: { color: colors.white, fontFamily: fonts.semibold, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: { width: COL_W, marginBottom: GAP },
  img: { width: COL_W, height: COL_W, borderRadius: radius.md, backgroundColor: colors.surface },
  caption: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11.5, marginTop: 5, lineHeight: 15 },
});
