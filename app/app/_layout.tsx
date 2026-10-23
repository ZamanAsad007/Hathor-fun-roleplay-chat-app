import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#180E13' },
          headerTintColor: '#EAD196',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0D070A' },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'HATHOR',
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
