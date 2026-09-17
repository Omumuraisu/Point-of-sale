import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { maskPhone, normalizePhilippinePhone, readFunctionError } from '../lib/authFlow';
import { useAuthSession } from '../lib/authSession';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useVerificationFlow } from '../lib/verificationFlow';
import { debugLog as writeDebugLog, debugWarn as writeDebugWarn } from '../lib/debugLogging';

type ActivationTestResponse = {
    accepted?: boolean;
    resendAfterSeconds?: number;
    phone?: string;
    debugId?: string;
};

const debugLog = (message: string, details?: Record<string, unknown>) => {
    writeDebugLog('authentication-sms', message, details);
};

const debugWarn = (message: string, details?: Record<string, unknown>) => {
    writeDebugWarn('authentication-sms', message, details);
};

const formatRetryDuration = (totalSeconds: number): string => {
    const seconds = Math.max(1, Math.ceil(totalSeconds));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (parts.length === 0) parts.push(`${remainingSeconds}s`);
    return parts.join(' ');
};

const formatRetryMessage = (message: string, retryAfterSeconds: number, debugId: string | null): string => {
    const reference = debugId ? ` Reference: ${debugId}.` : '';
    if (retryAfterSeconds <= 0) return `${message}${reference}`;
    const retryAt = new Date(Date.now() + retryAfterSeconds * 1000).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
    });
    return `${message} Try again in ${formatRetryDuration(retryAfterSeconds)}, at ${retryAt}.${reference}`;
};

export default function TestSmsScreen() {
    const router = useRouter();
    const { currentUser, isHydrating, logout } = useAuthSession();
    const { startFlow } = useVerificationFlow();
    const [isStarting, setIsStarting] = useState(false);
    const [message, setMessage] = useState('');

    if (isHydrating) return null;
    if (!currentUser) return <Redirect href="/" />;
    if (currentUser.profileTable !== 'developer') return <Redirect href="/(tabs)/settings" />;

    const beginActivationTest = async () => {
        if (!isSupabaseConfigured || !supabase) {
            setMessage('Verification is unavailable. Check the app configuration.');
            return;
        }

        setIsStarting(true);
        setMessage('');
        debugLog('Request started.', {
            accountId: currentUser.accountId,
            phone: maskPhone(currentUser.phoneNumber),
        });
        let data: ActivationTestResponse | null = null;
        let invokeError: unknown = null;
        try {
            const result = await supabase.functions.invoke<ActivationTestResponse>(
                'start-developer-activation-test',
                { body: {} },
            );
            data = result.data;
            invokeError = result.error;
            debugLog('Edge Function response received.', {
                accepted: result.data?.accepted === true,
                debugId: result.data?.debugId ?? null,
                hasError: Boolean(result.error),
            });
        } catch (error) {
            invokeError = error;
            debugWarn('Edge Function invocation threw before a response was available.');
        }

        if (invokeError) {
            const parsed = await readFunctionError(invokeError, 'Unable to start the activation test.');
            debugWarn('Request rejected.', {
                debugId: parsed.debugId,
                reason: parsed.reason,
                retryAfterSeconds: parsed.retryAfterSeconds,
            });
            setIsStarting(false);
            setMessage(formatRetryMessage(parsed.message, parsed.retryAfterSeconds, parsed.debugId));
            return;
        }

        const phone = normalizePhilippinePhone(data?.phone ?? '');
        if (!data?.accepted || !phone) {
            debugWarn('Invalid success response.', { debugId: data?.debugId ?? null });
            setIsStarting(false);
            setMessage('The activation test returned an invalid response. Use Activate Account to continue.');
            return;
        }

        const resendAfterSeconds = typeof data.resendAfterSeconds === 'number'
            ? data.resendAfterSeconds
            : 60;
        startFlow(phone, 'activation', 'developer-test');
        debugLog('Activation flow initialized.', {
            debugId: data.debugId ?? null,
            phone: maskPhone(phone),
            resendAfterSeconds,
        });
        await logout();
        debugLog('Developer signed out; navigating to OTP entry.', { debugId: data.debugId ?? null });
        router.replace({ pathname: '/activate-otp', params: { resendAfterSeconds } });
    };

    const confirmActivationTest = () => {
        Alert.alert(
            'Start activation test?',
            'This will set your developer account to pending, sign you out, and send an OTP. You must create a new password to reactivate the account.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Start Test', style: 'destructive', onPress: () => void beginActivationTest() },
            ],
        );
    };

    return (
        <SafeAreaView style={styles.screen}>
            <Pressable style={styles.backButton} onPress={() => router.back()} disabled={isStarting}>
                <Ionicons name="chevron-back" size={20} color="#fff" />
            </Pressable>

            <View style={styles.content}>
                <View style={styles.iconCircle}>
                    <MaterialCommunityIcons name="message-lock-outline" size={64} color="#2f5ada" />
                </View>
                <Text style={styles.title}>Test SMS Activation</Text>
                <Text style={styles.subtitle}>
                    Run the real developer activation flow using your registered phone number.
                </Text>

                <View style={styles.phoneCard}>
                    <Text style={styles.phoneLabel}>OTP will be sent to</Text>
                    <Text style={styles.phoneValue}>{maskPhone(currentUser.phoneNumber)}</Text>
                </View>

                <View style={styles.warningCard}>
                    <Ionicons name="warning-outline" size={24} color="#8a4b08" />
                    <Text style={styles.warningText}>
                        Starting this test changes your account to pending and signs you out. After verifying the OTP, you must create a new password before signing in again.
                    </Text>
                </View>

                {message ? <Text style={styles.error}>{message}</Text> : null}

                <Pressable
                    style={[styles.primaryButton, isStarting && styles.disabled]}
                    onPress={confirmActivationTest}
                    disabled={isStarting}
                >
                    {isStarting
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.primaryButtonText}>Start Activation Test</Text>}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#dfe2ec', paddingHorizontal: 20 },
    backButton: { marginTop: 8, width: 34, height: 34, borderRadius: 8, backgroundColor: '#2849a9', alignItems: 'center', justifyContent: 'center' },
    content: { flex: 1, alignItems: 'center', paddingTop: 30 },
    iconCircle: { width: 132, height: 132, borderRadius: 66, backgroundColor: '#a9bdee', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
    title: { fontSize: 24, fontWeight: '800', color: '#171b22' },
    subtitle: { marginTop: 8, maxWidth: 330, textAlign: 'center', fontSize: 14, lineHeight: 20, color: '#4e5560' },
    phoneCard: { width: '100%', marginTop: 28, borderRadius: 18, backgroundColor: '#f4f4f5', paddingVertical: 18, paddingHorizontal: 20, alignItems: 'center' },
    phoneLabel: { fontSize: 13, fontWeight: '600', color: '#747984' },
    phoneValue: { marginTop: 5, fontSize: 21, fontWeight: '800', letterSpacing: 2, color: '#20252c' },
    warningCard: { width: '100%', marginTop: 18, borderRadius: 16, borderWidth: 1, borderColor: '#e2b36d', backgroundColor: '#fff4df', padding: 16, flexDirection: 'row', alignItems: 'flex-start' },
    warningText: { flex: 1, marginLeft: 10, fontSize: 13, lineHeight: 19, color: '#6b410f' },
    error: { width: '100%', marginTop: 14, color: '#b3261e', fontSize: 13, fontWeight: '600', textAlign: 'center' },
    primaryButton: { width: '100%', height: 54, borderRadius: 27, backgroundColor: '#b94a43', marginTop: 26, alignItems: 'center', justifyContent: 'center', elevation: 4 },
    primaryButtonText: { fontSize: 17, fontWeight: '800', color: '#fff' },
    disabled: { opacity: 0.65 },
});
