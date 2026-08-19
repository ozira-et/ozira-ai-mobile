// Jest has no real native AsyncStorage module to link against, so anything
// that imports it (src/api.js, src/supabase.js, and everything that pulls
// those in) throws "[@RNC/AsyncStorage]: NativeModule: AsyncStorage is null"
// the moment it's required — not just when it's actually called. Swap in the
// package's own official in-memory mock, per its documented Jest setup.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
