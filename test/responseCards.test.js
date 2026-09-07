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
    sources: [{ label: 'Weather', href: 'https://weather.example.test/today' }],
  };

  it('accepts the shared card envelope and keeps safe sources', () => {
    expect(validateResponseCard(card)).toMatchObject({ cardId: card.cardId, type: 'current_weather' });
    expect(validateResponseCard({ ...card, sources: [{ label: 'unsafe', href: 'javascript:alert(1)' }] }).sources).toEqual([{ label: 'unsafe' }]);
  });

  it('rejects malformed or secret-bearing cards without throwing', () => {
    expect(validateResponseCard({ ...card, payload: { apiKey: 'secret' } })).toBeNull();
    expect(validateResponseCard({ ...card, type: 'unsupported' })).toBeNull();
  });

  it('renders legacy saved weather metadata through the same adapter', () => {
    const cards = responseCardsForMessage({ metadata: { weather: { location: 'Dubai', summary: 'Clear.' } } });
    expect(cards[0]).toMatchObject({ type: 'current_weather', title: 'Weather for Dubai' });
  });
});
