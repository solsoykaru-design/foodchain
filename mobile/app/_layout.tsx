import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../services/auth';
import { ActivityIndicator, View } from 'react-native';

function AuthLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#e67e22" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="index" />
      ) : (
        <>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="create/index" />
          <Stack.Screen name="create/manual" />
          <Stack.Screen name="create/voice" />
          <Stack.Screen name="card/[id]" />
          <Stack.Screen name="subscription/index" />
          <Stack.Screen name="support" />
        </>
      )}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthLayout />
    </AuthProvider>
  );
}
