import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../context/ThemeContext';
import { responseCardsForMessage, safeCardUrl } from '../responseCards';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';

function openSafe(href) {
  const url = safeCardUrl(href);
  if (url) Linking.openURL(url).catch(() => {});
}

export function ResponseCard({ card }) {
  const colors = useColors();
  useFonts({ Inter_400Regular, Inter_700Bold });
  const payload = card.payload || {};
  const ready = card.lifecycle === 'success' || card.lifecycle === 'partial';
  const isWeather = ready && card.type === 'current_weather';
  const isPlace = ready && card.type === 'place';
  const summary = card.fallbackText || payload.summary || '';
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityLabel={card.title}>
      <Text style={[styles.eyebrow, { color: '#CE1C40' }]}>{card.provider || 'OZIRA'}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{card.title}</Text>
      {card.lifecycle === 'loading' ? <Text accessibilityRole="text" style={{ color: colors.text }}>Loading…</Text> : null}
      {isWeather && payload.dateLabel ? <Text style={{ color: colors.muted }}>{payload.dateLabel}</Text> : null}
      {isWeather ? <Text style={[styles.value, { color: colors.text }]}>{payload.temperatureC != null ? `${payload.temperatureC}°C` : ''}{payload.condition ? ` · ${payload.condition}` : ''}</Text> : null}
      {isPlace ? <Text style={[styles.detail, { color: colors.muted }]}>{payload.address || ''}</Text> : null}
      {isPlace && payload.type ? <Text style={{ color: colors.muted }}>{payload.type}</Text> : null}
      {isWeather ? [['feelsLikeC', 'Feels like', '°C'], ['humidityPercent', 'Humidity', '%'], ['windKph', 'Wind', ' km/h']].map(([key, label, unit]) => typeof payload[key] === 'number' ? <Text key={key} style={{ color: colors.text }}>{label}: {payload[key]}{unit}</Text> : null) : null}
      {isPlace ? ['mapsUrl', 'websiteUrl'].map(key => safeCardUrl(payload[key]) ? <Pressable key={key} onPress={() => openSafe(payload[key])} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary }}>{key === 'mapsUrl' ? 'Directions' : 'Website'}</Text></Pressable> : null) : null}
      {summary && !['error', 'empty'].includes(card.lifecycle) ? <Text style={[styles.detail, { color: colors.muted }]}>{summary}</Text> : null}
      {card.lifecycle === 'partial' ? <Text style={[styles.status, { color: colors.gold }]}>Some details may be unavailable.</Text> : null}
      {card.lifecycle === 'error' || card.lifecycle === 'empty' ? <Text style={[styles.status, { color: colors.danger }]}>{summary || 'This result is unavailable.'}</Text> : null}
      {card.sources?.map(source => source.href ? <Pressable key={source.href} onPress={() => openSafe(source.href)} accessibilityRole="link"><Text style={[styles.link, { color: colors.primary }]}>{source.label}</Text></Pressable> : null)}
      {card.actions?.map(action => ['open_url', 'open_map'].includes(action.type) && safeCardUrl(action.href) ? <Pressable key={action.id} onPress={() => openSafe(action.href)} accessibilityRole="link"><Text style={[styles.link, { color: colors.primary }]}>{action.label}</Text></Pressable> : null)}
    </View>
  );
}

export function MessageResponseCards({ message }) {
  return responseCardsForMessage(message).map(card => <ResponseCard card={card} key={card.cardId} />);
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 10, gap: 5 },
  eyebrow: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  value: { fontSize: 22, fontWeight: '700' },
  detail: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular' },
  status: { fontSize: 12, fontWeight: '600' },
  link: { fontSize: 13, fontWeight: '600', marginTop: 4 },
});
