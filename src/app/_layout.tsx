import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from "expo-router";
import { syncAllSupabaseData } from '../lib/supabaseSync';
import { AuthSessionProvider, useAuthSession } from '../lib/authSession';
import { VerificationFlowProvider } from '../lib/verificationFlow';
import NetInfo from '@react-native-community/netinfo';
import { BusinessOperatingStatusProvider } from '../lib/businessOperatingStatus';
import { DebugLoggingProvider } from '../lib/debugLogging';

const PUBLIC_ROUTES = new Set([
  '',
  'index',
  'activate-account',
  'activate-otp',
  'create-password',
  'forgot-password',
]);

function AuthGate({ children }: React.PropsWithChildren) {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isHydrating, currentUser } = useAuthSession();
  const firstSegment = String(segments[0] ?? '');
  const isProtected = !PUBLIC_ROUTES.has(firstSegment);

  useEffect(() => {
    if (!isHydrating && isProtected && !isAuthenticated) router.replace('/');
  }, [isAuthenticated, isHydrating, isProtected, router]);

  useEffect(() => {
    if (isAuthenticated && currentUser?.stallNumber) {
      void syncAllSupabaseData({ accountId: currentUser.accountId, stallNumber: currentUser.stallNumber });
    }
  }, [isAuthenticated, currentUser?.accountId, currentUser?.stallNumber]);

  useEffect(() => NetInfo.addEventListener((state) => {
    if (state.isConnected && isAuthenticated && currentUser?.stallNumber) {
      void syncAllSupabaseData({ accountId: currentUser.accountId, stallNumber: currentUser.stallNumber });
    }
  }), [isAuthenticated, currentUser?.accountId, currentUser?.stallNumber]);

  if (isHydrating || (isProtected && !isAuthenticated)) return null;
  return <>{children}</>;
}

export default function Layout() {
  return (
    <DebugLoggingProvider>
    <AuthSessionProvider>
      <BusinessOperatingStatusProvider>
      <VerificationFlowProvider>
      <AuthGate>
      <Stack initialRouteName="index">
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(tabs)"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="add-product"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="add-personnel"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="add-item"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="receipt"
        options={{
          headerShown: false,
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="payment"
        options={{
          headerShown: false,
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="payment-success"
        options={{
          headerShown: false,
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="transaction-detail"
        options={{
          headerShown: false,
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="personnel-detail"
        options={{
          headerShown: false,
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="activate-account"
        options={{
          headerShown: false,
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="select-business"
        options={{
          headerShown: false,
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="activate-otp"
        options={{
          headerShown: false,
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="create-password"
        options={{
          headerShown: false,
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          headerShown: false,
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="test-sms"
        options={{
          headerShown: false,
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="debug-logging"
        options={{
          headerShown: false,
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
      </Stack>
      </AuthGate>
      </VerificationFlowProvider>
      </BusinessOperatingStatusProvider>
    </AuthSessionProvider>
    </DebugLoggingProvider>
  );
}
