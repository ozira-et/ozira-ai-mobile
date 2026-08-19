// OZIRA Mobile -- shared-foundation intelligence client.
//
// This is the mobile app's first real use of packages/ozira-app-core (see
// docs/app-platform/adr/0001 in ozira-ai): the SAME generic, typed API
// client used by apps/web, configured with mobile's own token source. It
// does not replace src/api.js -- that remains the app's primary REST
// client for everything else. This proves the shared foundation actually
// works from a second, independently-shipping codebase, not just Web.
import { createApiClient } from 'ozira-app-core';
import { config } from './config';

let currentToken = null;
export function setIntelligenceToken(token) { currentToken = token; }

export const intelligenceClient = createApiClient({
  baseUrl: config.API_BASE,
  getToken: () => currentToken,
  defaultHeaders: { 'x-ozira-platform': 'mobile' },
});
