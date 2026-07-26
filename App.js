import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { theme, navThemeFor } from './src/theme';
import { AuthProvider } from './src/context/AuthContext';
import { UIProvider } from './src/context/UIContext';
import { ThemeProvider, useThemeMode } from './src/context/ThemeContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { NotifyProvider } from './src/context/NotifyContext';
import { navigationRef } from './src/navigation/navigationRef';
import RootNavigator from './src/navigation/RootNavigator';
import Splash from './src/components/Splash';

function Themed() {
  const { resolved } = useThemeMode();
  return (
    <NavigationContainer ref={navigationRef} theme={navThemeFor(resolved)}>
      <RootNavigator />
      <StatusBar style={resolved === 'light' ? 'dark' : 'light'} />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold });
  const [splashDone, setSplashDone] = useState(false);
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <LanguageProvider>
              <UIProvider>
                <NotifyProvider>
                  <Themed />
                </NotifyProvider>
              </UIProvider>
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
        {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
