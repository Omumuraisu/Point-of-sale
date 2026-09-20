import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { logVerificationDebug, maskPhone, normalizePhilippinePhone, readFunctionError, VerificationPurpose } from '../../lib/authFlow';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useVerificationFlow } from '../../lib/verificationFlow';
import { useTheme, useThemedStyles } from '../../lib/theme';

export default function PhoneVerificationStart({ purpose }: { purpose: VerificationPurpose }) {
    const styles = useThemedStyles(baseStyles);
    const { colors } = useTheme();
    const router = useRouter();
    const { startFlow } = useVerificationFlow();
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isActivation = purpose === 'activation';

    const handleSubmit = async () => {
        const normalized = normalizePhilippinePhone(phone);
        if (!normalized) {
            logVerificationDebug('request_validation_failed', { purpose, reason: 'invalid_phone' }, 'warn');
            setMessage('Enter a valid Philippine mobile number.');
            return;
        }
        if (!isSupabaseConfigured || !supabase) {
            logVerificationDebug('request_configuration_failed', { purpose, reason: 'supabase_unavailable' }, 'warn');
            setMessage('Verification is unavailable. Check the app configuration.');
            return;
        }

        setIsSubmitting(true);
        setMessage('');
        logVerificationDebug('request_started', { purpose, phone: maskPhone(normalized) });
        const { data, error } = await supabase.functions.invoke('start-pos-account-verification', {
            body: { phone: normalized, purpose },
        });
        setIsSubmitting(false);
        if (error) {
            const parsed = await readFunctionError(error, 'Unable to request a verification code.');
            const status = (error as { context?: Response } | null)?.context?.status ?? null;
            logVerificationDebug('request_failed', {
                purpose,
                phone: maskPhone(normalized),
                status,
                message: parsed.message,
                reason: parsed.reason,
                retryAfterSeconds: parsed.retryAfterSeconds,
                debugId: parsed.debugId,
            }, 'warn');
            setMessage(parsed.message);
            return;
        }

        const resendAfterSeconds = typeof data?.resendAfterSeconds === 'number'
            ? data.resendAfterSeconds
            : 60;
        logVerificationDebug('request_accepted', {
            purpose,
            phone: maskPhone(normalized),
            resendAfterSeconds,
            debugId: typeof data?.debugId === 'string' ? data.debugId : null,
        });
        startFlow(normalized, purpose, isActivation ? 'activation' : 'forgot-password');
        router.push({ pathname: '/activate-otp', params: { resendAfterSeconds } });
    };

    return (
        <SafeAreaView style={styles.screen}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.contentWrap}>
                <Text style={styles.title}>{isActivation ? 'Account Verification' : 'Forgot Password'}</Text>
                <Text style={styles.subtitle}>
                    {isActivation ? 'Enter your registered phone number to activate your account.' : 'Enter your registered phone number to reset your password.'}
                </Text>
                <View style={styles.iconCircle}>
                <MaterialCommunityIcons name={isActivation ? 'cellphone-check' : 'lock-reset'} size={70} color={colors.icon} />
                </View>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                    style={styles.input}
                    placeholder="09XX XXX XXXX"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    value={phone}
                    editable={!isSubmitting}
                    onChangeText={(value) => {
                        setPhone(value);
                        setMessage('');
                    }}
                    onSubmitEditing={handleSubmit}
                />
                {message ? <Text style={styles.error}>{message}</Text> : null}
                <Text style={styles.helperText}>If the number is eligible, a verification code will be sent by SMS.</Text>
                <TouchableOpacity style={[styles.primaryButton, isSubmitting && styles.disabled]} onPress={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Continue</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const baseStyles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#dfe2ec', paddingHorizontal: 20 },
    backButton: { marginTop: 8, width: 34, height: 34, borderRadius: 8, backgroundColor: '#2849a9', alignItems: 'center', justifyContent: 'center' },
    contentWrap: { flex: 1, alignItems: 'center', paddingTop: 24 },
    title: { fontSize: 22, fontWeight: '800', color: '#12151a', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#2e343c', lineHeight: 20, textAlign: 'center', paddingHorizontal: 20 },
    iconCircle: { width: 146, height: 146, borderRadius: 73, backgroundColor: '#a9bdee', marginTop: 20, marginBottom: 28, alignItems: 'center', justifyContent: 'center' },
    label: { width: '100%', fontSize: 16, color: '#11151b', fontWeight: '800', marginBottom: 8 },
    input: { width: '100%', height: 50, borderRadius: 25, borderWidth: 1, borderColor: '#b8b8be', backgroundColor: '#f7f7f8', paddingHorizontal: 18, fontSize: 15 },
    helperText: { fontSize: 12, color: '#747984', lineHeight: 18, textAlign: 'center', marginTop: 22, paddingHorizontal: 22 },
    error: { color: '#b3261e', fontSize: 13, fontWeight: '600', marginTop: 10, alignSelf: 'flex-start' },
    primaryButton: { width: '100%', height: 52, borderRadius: 26, backgroundColor: '#2849a9', marginTop: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 },
    primaryButtonText: { fontSize: 17, fontWeight: '800', color: '#f3f5ff' },
    disabled: { opacity: 0.65 },
});
