import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { theme, navTheme } from './src/theme';
import { AuthProvider } from './src/context/AuthContext';
import { UIProvider } from './src/context/UIContext';
import { navigationRef } from './src/navigation/navigationRef';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold });
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UIProvider>
          <NavigationContainer ref={navigationRef} theme={navTheme}>
            <RootNavigator />
          </NavigationContainer>
        </UIProvider>
      </AuthProvider>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
