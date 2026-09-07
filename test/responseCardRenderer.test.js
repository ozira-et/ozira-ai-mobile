// Synthetic presentation fixtures, not live provider or native-device proof.
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Linking } from 'react-native';
import { MessageResponseCards } from '../src/components/ResponseCard';

jest.mock('../src/context/ThemeContext', () => ({ useColors: () => ({ card: '#fff', border: '#ddd', text: '#111', muted: '#555', primary: '#CE1C40' }) }));
jest.mock('@expo-google-fonts/inter', () => ({ useFonts: () => [true], Inter_400Regular: 1, Inter_700Bold: 2 }));

const base = { schemaVersion: 1, cardId: 'card_synthetic_123', type: 'current_weather', title: 'Synthetic Dubai', lifecycle: 'success', payload: { location: 'Dubai', temperatureC: 36 }, fallbackText: 'Synthetic weather', provider: 'Synthetic provider' };
let tree;
beforeEach(() => jest.clearAllMocks());
async function render(cards, extra = {}) {
  await act(async () => { tree = renderer.create(<MessageResponseCards message={{ role: 'assistant', metadata: { responseCards: cards, ...extra } }} />); });
  return JSON.stringify(tree.toJSON());
}
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; jest.restoreAllMocks(); });

test('weather renders returned values and accessible title without inventing measurements', async () => {
  const output = await render([base]);
  expect(output).toContain('36°C');
  expect(output).toContain('accessibilityLabel');
  expect(output).toContain('Synthetic provider');
  expect(output).not.toContain('Humidity:');
});

test('place renders safe directions and no fabricated rating', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const output = await render([{ ...base, type: 'place', payload: { name: 'Synthetic place', address: 'Synthetic address', mapsUrl: 'https://maps.google.com/?q=Dubai' } }]);
  expect(output).toContain('Synthetic address');
  expect(output).not.toContain('Rating');
  const links = tree.root.findAll(node => node.props.accessibilityRole === 'link' && typeof node.props.onPress === 'function');
  await act(async () => links[0].props.onPress());
  expect(open).toHaveBeenCalledWith('https://maps.google.com/?q=Dubai');
});

test.each(['loading', 'partial', 'empty', 'error'])('%s state renders without triggering requests', async lifecycle => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const output = await render([{ ...base, lifecycle, actions: [{ id: 'retry_1', type: 'retry', label: 'Retry' }] }]);
  expect(output).toContain(lifecycle === 'loading' ? 'Loading' : 'Synthetic weather');
  expect(open).not.toHaveBeenCalled();
});

test('malformed cards render nothing, leaving parent text fallback intact', async () => {
  await render([{ ...base, schemaVersion: 999 }]);
  expect(tree.toJSON()).toBeNull();
});
