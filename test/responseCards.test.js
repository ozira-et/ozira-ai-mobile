import { responseCardsForMessage, validateResponseCard } from '../src/responseCards';

describe('mobile response-card adapter', () => {
  const card = {
    schemaVersion: 1,
    cardId: 'card_current_weather_123456',
    type: 'current_weather',
    lifecycle: 'success',
    title: 'Weather for Dubai',
    payload: { location: 'Dubai', temperatureC: 36, summary: 'Clear.' },
    fallbackText: 'Clear in Dubai.',
    sources: [{ label: 'Weather', href: 'https://example.com/today' }],
  };

  it('accepts the shared card envelope and keeps safe sources', () => {
    expect(validateResponseCard(card)).toMatchObject({ cardId: card.cardId, type: 'current_weather' });
    expect(validateResponseCard({ ...card, sources: [{ label: 'unsafe', href: 'javascript:alert(1)' }] })).toBeNull();
  });

  it('rejects malformed or secret-bearing cards without throwing', () => {
    expect(validateResponseCard({ ...card, payload: { apiKey: 'secret' } })).toBeNull();
    expect(validateResponseCard({ ...card, type: 'unsupported' })).toBeNull();
  });

  it('renders legacy saved weather metadata through the same adapter', () => {
    const cards = responseCardsForMessage({ metadata: { weather: { location: 'Dubai', summary: 'Clear.' } } });
    expect(cards[0]).toMatchObject({ type: 'current_weather', title: 'Dubai' });
  });

  it('rejects future schemas and deduplicates replacements without mutating message identity', () => {
    expect(validateResponseCard({ ...card, schemaVersion: 2 })).toBeNull();
    const message = { role: 'assistant', id: 'msg_123', runId: 'run_123', metadata: { responseCards: [card, { ...card, lifecycle: 'partial' }] } };
    const restored = JSON.parse(JSON.stringify(message));
    expect(responseCardsForMessage(restored)).toHaveLength(1);
    expect(responseCardsForMessage(restored)[0].lifecycle).toBe('partial');
    expect(restored).toEqual(message);
    expect(responseCardsForMessage({ ...message, role: 'user' })).toEqual([]);
  });

  it('preserves valid new cards over legacy metadata, including error and loading states', () => {
    for (const lifecycle of ['loading', 'partial', 'empty', 'error']) {
      const result = responseCardsForMessage({ metadata: { responseCards: [{ ...card, lifecycle }], weather: { location: 'Old location' } } });
      expect(result).toHaveLength(1);
      expect(result[0].lifecycle).toBe(lifecycle);
    }
  });
});
