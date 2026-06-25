import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../services/auth';
import { ActivityIndicator, View } from 'react-native';

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      ) : (
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      )}
      <Stack.Screen name="save" options={{ presentation: 'modal' }} />
      <Stack.Screen name="card/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="create/index" options={{ presentation: 'modal' }} />
      <Stack.Screen name="create/manual" options={{ presentation: 'modal' }} />
      <Stack.Screen name="create/voice" options={{ presentation: 'modal' }} />
      <Stack.Screen name="subscription/index" options={{ presentation: 'modal' }} />
      <Stack.Screen name="payment/index" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
