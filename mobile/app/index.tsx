import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../services/auth';

export default function IndexRedirect() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (user) router.replace('/(tabs)');
    else router.replace('/(auth)');
  }, [user, isLoading]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa' }}>
      <ActivityIndicator size="large" color="#3b82f6" />
    </View>
  );
}
