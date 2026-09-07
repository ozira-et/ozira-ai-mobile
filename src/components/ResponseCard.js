import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../context/ThemeContext';
import { responseCardsForMessage } from '../responseCards';

function openSafe(href) {
  try { const url = new URL(href); if (url.protocol === 'https:') Linking.openURL(url.toString()); } catch (_) {}
}

export function ResponseCard({ card }) {
  const colors = useColors();
  const payload = card.payload || {};
  const isWeather = card.type === 'current_weather' || card.type === 'forecast';
  const isPlace = card.type === 'place' || card.type === 'nearby' || card.type === 'map';
  const summary = card.fallbackText || payload.summary || '';
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityLabel={card.title}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>{card.provider || (isWeather ? 'Live weather' : isPlace ? 'Location' : 'OZIRA')}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{card.title}</Text>
      {isWeather ? <Text style={[styles.value, { color: colors.text }]}>{payload.temperatureC != null ? `${payload.temperatureC}°C` : ''}{payload.condition ? ` · ${payload.condition}` : ''}</Text> : null}
      {isPlace ? <Text style={[styles.detail, { color: colors.muted }]}>{payload.address || ''}</Text> : null}
      {summary ? <Text style={[styles.detail, { color: colors.muted }]}>{summary}</Text> : null}
      {card.lifecycle === 'partial' ? <Text style={[styles.status, { color: colors.gold }]}>Some details may be unavailable.</Text> : null}
      {card.lifecycle === 'error' || card.lifecycle === 'empty' ? <Text style={[styles.status, { color: colors.danger }]}>{summary || 'This result is unavailable.'}</Text> : null}
      {card.sources?.map(source => source.href ? <Pressable key={source.href} onPress={() => openSafe(source.href)} accessibilityRole="link"><Text style={[styles.link, { color: colors.primary }]}>{source.label}</Text></Pressable> : null)}
      {card.actions?.map(action => action.href ? <Pressable key={action.id} onPress={() => openSafe(action.href)} accessibilityRole="button"><Text style={[styles.link, { color: colors.primary }]}>{action.label}</Text></Pressable> : null)}
    </View>
  );
}

export function MessageResponseCards({ message }) {
  return responseCardsForMessage(message).map(card => <ResponseCard card={card} key={card.cardId} />);
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 10, gap: 5 },
  eyebrow: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  title: { fontSize: 16, fontWeight: '700' },
  value: { fontSize: 22, fontWeight: '700' },
  detail: { fontSize: 13, lineHeight: 19 },
  status: { fontSize: 12, fontWeight: '600' },
  link: { fontSize: 13, fontWeight: '600', marginTop: 4 },
});
