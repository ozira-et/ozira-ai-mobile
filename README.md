# OZIRA AI — Mobile App (Expo / React Native)

Phase-1 foundation: design system, drawer navigation, and working Auth + Chat
(text and image generation) wired to your existing Railway backend.

## Run it

You need Node 18+ and the Expo Go app on your phone (App Store / Play Store).

```bash
cd ozira-mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). The app hot-reloads as you edit.

## What works now

- **Auth** — email/password against your backend (`/api/register`, `/api/login`), token stored securely with `expo-secure-store`.
- **Chat Home** — greeting, quick-action tiles, recent chats.
- **Chat** — real AI replies via `/api/chat`; tap the 🎨 icon (header or composer) for **image mode**, which calls `/api/image` and shows the picture.
- **Drawer** — the sidebar from the design (profile, menu, upgrade card, log out).
- **Design system** — `src/theme.js` + `src/components` (Button, Input, Chip), Poppins font.

> The backend must have the image routes deployed for image mode to work (the `server.js` with `/img/` and `serveImage`).

## Configure

Edit `src/config.js` → set `API_BASE` to your backend URL (defaults to your Railway URL).

## Structure

```
ozira-mobile/
  App.js                     entry (fonts, providers, navigation)
  src/
    theme.js                 colors, Poppins, spacing, radius
    config.js                API base + Phase-2 keys (Clerk/Supabase/Sentry)
    api.js                   backend client
    context/AuthContext.js   auth state (swap for Clerk in Phase 2)
    components/              Button, Input, Chip
    navigation/             RootNavigator (auth gate) + DrawerContent (sidebar)
    screens/                AuthScreen, ChatHomeScreen, ChatConversationScreen, PlaceholderScreen
```

## Next (see ARCHITECTURE.md)

Clerk auth (Apple/Google + Apple-required account deletion), Supabase (Postgres +
image storage), Inngest (background jobs + Clerk webhooks), Sentry (monitoring),
and the remaining screens (Travel, Tools, Plans, API, Account, Settings).
