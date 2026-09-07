// OZIRA Mobile -- Conversation Workspace V2 (Gate A). Proves the new
// api.js methods build the right request shape, the new localStore wrappers
// pass through to them correctly, and that the screens/components touched
// this pass still parse and import cleanly (a bare `require` executes every
// top-level statement -- imports, function/component definitions, the JSX
// Babel transform -- without needing a full React render).

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('api.js -- new Conversation Workspace endpoints', () => {
  let seenUrl;
  let seenInit;
  let api;

  beforeEach(() => {
    jest.resetModules();
    seenUrl = '';
    seenInit = {};
    global.fetch = jest.fn(async (url, init) => {
      seenUrl = url;
      seenInit = init;
      return jsonResponse(200, { ok: true, conversations: [], messageIndexes: [] });
    });
    api = require('../src/api').api;
  });

  it('searchConversations sends the query as ?q= on GET /api/conversations', async () => {
    await api.searchConversations('budget trip', 'tok');
    expect(seenUrl).toMatch(/\/api\/conversations\?q=budget(%20|\+)trip$/);
    expect(seenInit.method).toBe('GET');
  });

  it('createShare posts resourceType/resourceId/messageIndex to /api/shares/create', async () => {
    await api.createShare({ resourceType: 'response', resourceId: 'cnv_1', messageIndex: 2 }, 'tok');
    expect(seenUrl).toMatch(/\/api\/shares\/create$/);
    const body = JSON.parse(seenInit.body);
    expect(body).toEqual({ resourceType: 'response', resourceId: 'cnv_1', messageIndex: 2 });
  });

  it('revokeShare posts shareGrantId to /api/shares/revoke', async () => {
    await api.revokeShare('shr_1', 'tok');
    expect(seenUrl).toMatch(/\/api\/shares\/revoke$/);
    expect(JSON.parse(seenInit.body)).toEqual({ shareGrantId: 'shr_1' });
  });

  it('saveBookmark posts conversationId/messageIndex to /api/bookmarks/save', async () => {
    await api.saveBookmark('cnv_1', 3, 'tok');
    expect(seenUrl).toMatch(/\/api\/bookmarks\/save$/);
    expect(JSON.parse(seenInit.body)).toEqual({ conversationId: 'cnv_1', messageIndex: 3 });
  });

  it('unsaveBookmark posts conversationId/messageIndex to /api/bookmarks/unsave', async () => {
    await api.unsaveBookmark('cnv_1', 3, 'tok');
    expect(seenUrl).toMatch(/\/api\/bookmarks\/unsave$/);
    expect(JSON.parse(seenInit.body)).toEqual({ conversationId: 'cnv_1', messageIndex: 3 });
  });

  it('listBookmarks sends conversationId as a query param on GET /api/bookmarks/list', async () => {
    await api.listBookmarks('cnv_1', 'tok');
    expect(seenUrl).toMatch(/\/api\/bookmarks\/list\?conversationId=cnv_1$/);
    expect(seenInit.method).toBe('GET');
  });
});

describe('localStore.js -- search + bookmark wrappers', () => {
  beforeEach(() => {
    jest.resetModules();
    require('../src/accountSession').setAccountSession('synthetic-a', 'user-a');
    jest.doMock('expo-file-system', () => ({ Paths: { document: 'test-document' }, File: class { get exists() { return false; } create() {} write() {} } }));
    jest.doMock('../src/api', () => ({
      api: {
        searchConversations: jest.fn(async () => ({ conversations: [{ id: 'cnv_9', title: 'Trip planning', count: 4 }] })),
        saveBookmark: jest.fn(async (id, idx) => ({ bookmarked: true, id, idx })),
        unsaveBookmark: jest.fn(async (id, idx) => ({ bookmarked: false, id, idx })),
        listBookmarks: jest.fn(async () => ({ messageIndexes: [0, 2] })),
      },
    }));
  });

  it('searchConversations returns [] for an empty/blank query without calling the network', async () => {
    const { searchConversations } = require('../src/localStore');
    const { api } = require('../src/api');
    expect(await searchConversations('   ')).toEqual([]);
    expect(api.searchConversations).not.toHaveBeenCalled();
  });

  it('searchConversations maps server rows to the same shape listConversations uses', async () => {
    const { searchConversations } = require('../src/localStore');
    const result = await searchConversations('trip');
    expect(result).toEqual([{ id: 'cnv_9', title: 'Trip planning', folderId: null, pinned: false, archived: false, count: 4 }]);
  });

  it('saveBookmark / unsaveBookmark pass the conversation id and message index straight through', async () => {
    const { saveBookmark, unsaveBookmark } = require('../src/localStore');
    const { api } = require('../src/api');
    await saveBookmark('cnv_1', 5);
    expect(api.saveBookmark).toHaveBeenCalledWith('cnv_1', 5, 'synthetic-a');
    await unsaveBookmark('cnv_1', 5);
    expect(api.unsaveBookmark).toHaveBeenCalledWith('cnv_1', 5, 'synthetic-a');
  });

  it('listBookmarkedIndexes returns the server\'s messageIndexes array', async () => {
    const { listBookmarkedIndexes } = require('../src/localStore');
    expect(await listBookmarkedIndexes('cnv_1')).toEqual([0, 2]);
  });

  it('listBookmarkedIndexes fails safe to [] rather than throwing (e.g. offline)', async () => {
    jest.resetModules();
    require('../src/accountSession').setAccountSession('synthetic-a', 'user-a');
    jest.doMock('../src/api', () => ({
      api: { listBookmarks: jest.fn(async () => { throw new Error('network down'); }) },
    }));
    const { listBookmarkedIndexes } = require('../src/localStore');
    expect(await listBookmarkedIndexes('cnv_1')).toEqual([]);
  });
});

describe('i18n.js -- new Conversation Workspace keys resolve in every supported language', () => {
  const { LANGUAGES, t } = require('../src/i18n');
  const KEYS = ['search', 'searchPlaceholder', 'searchNoResults', 'pinned', 'recent', 'archived', 'rename', 'renameChat', 'renamePlaceholder', 'save', 'unsave', 'saved', 'shareFailed', 'linkCopied'];

  it.each(LANGUAGES.map(l => l.code))('%s has a real translation (not just falling back to the key itself) for every new key', (code) => {
    for (const key of KEYS) {
      expect(t(code, key)).not.toBe(key);
    }
  });
});

describe('screens/components touched by Conversation Workspace V2 still parse and import cleanly', () => {
  // A bare require executes every top-level statement (imports, the JSX
  // Babel transform, function/component definitions) without rendering --
  // enough to catch a syntax error or a broken import path. src/supabase.js
  // constructs a real Supabase client (incl. its realtime/WebSocket client)
  // at module scope, which needs a WebSocket polyfill Jest's Node
  // environment doesn't have -- unrelated to anything this pass touches, so
  // it's stubbed rather than pulled in for what is only an import-shape check.
  jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: {} }) }));
  // expo-audio's native binding isn't available under jest-expo for this SDK
  // version either (same "import-shape only" situation as supabase-js above).
  jest.mock('expo-audio', () => ({
    useAudioRecorder: () => ({}),
    RecordingPresets: { HIGH_QUALITY: {} },
    requestRecordingPermissionsAsync: async () => ({ granted: false }),
    setAudioModeAsync: async () => {},
  }));

  it('AssistantActionIcon (new "save" bookmark glyph)', () => {
    expect(() => require('../src/components/AssistantActionIcon')).not.toThrow();
  });
  it('Sidebar (search, archived chip, pinned/recent, rename)', () => {
    expect(() => require('../src/components/Sidebar')).not.toThrow();
  });
  it('ChatConversationScreen (Save action, ShareGrant, rename)', () => {
    expect(() => require('../src/screens/ChatConversationScreen')).not.toThrow();
  });
});
