import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';

import AuthScreen from '../screens/AuthScreen';
import ChatHomeScreen from '../screens/ChatHomeScreen';
import ChatConversationScreen from '../screens/ChatConversationScreen';
import PlaceholderScreen from '../screens/PlaceholderScreen';

const Stack = createNativeStackNavigator();

// All app screens in one stack, with the custom Sidebar overlaid on top.
function AppStack() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="ChatHome" component={ChatHomeScreen} />
        <Stack.Screen name="ChatConversation" component={ChatConversationScreen} />
        <Stack.Screen name="Travel">{() => <PlaceholderScreen title="Travel Planner" icon="airplane" />}</Stack.Screen>
        <Stack.Screen name="Tools">{() => <PlaceholderScreen title="AI Tools" icon="grid" />}</Stack.Screen>
        <Stack.Screen name="Plans">{() => <PlaceholderScreen title="Plans & Pricing" icon="pricetag" />}</Stack.Screen>
        <Stack.Screen name="Developer">{() => <PlaceholderScreen title="API & Developer" icon="code-slash" />}</Stack.Screen>
        <Stack.Screen name="Account">{() => <PlaceholderScreen title="Account" icon="person" />}</Stack.Screen>
        <Stack.Screen name="Settings">{() => <PlaceholderScreen title="Settings" icon="settings" />}</Stack.Screen>
      </Stack.Navigator>
      <Sidebar />
    </View>
  );
}

export default function RootNavigator() {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  return token ? <AppStack /> : <AuthScreen />;
}
