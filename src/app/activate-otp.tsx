import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { logVerificationDebug, maskPhone, readFunctionError } from '../lib/authFlow';
import { supabase } from '../lib/supabase';
import { useVerificationFlow } from '../lib/verificationFlow';

export default function ActivateOtpScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ resendAfterSeconds?: string }>();
    const { flow, markOtpVerified, clearFlow } = useVerificationFlow();
    const initialCountdown = Math.max(0, Number(params.resendAfterSeconds) || 60);
    const [otp, setOtp] = useState('');
    const [message, setMessage] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [countdown, setCountdown] = useState(initialCountdown);
    const isCancellingRef = useRef(false);

    useEffect(() => {
        if (!flow) {
            if (!isCancellingRef.current) router.replace('/');
            return;
        }

        if (flow.stage === 'password') router.replace('/create-password');
    }, [flow, router]);

    useEffect(() => {
        if (countdown <= 0) return undefined;
        const timer = setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    if (!flow || flow.stage !== 'otp') return null;

    const handleCancel = () => {
        const origin = flow.origin;
        isCancellingRef.current = true;
        clearFlow();

        if (origin === 'security') {
            router.replace('/security');
        } else if (origin === 'activation') {
            router.replace('/activate-account');
        } else if (origin === 'developer-test') {
            router.replace('/activate-account');
        } else {
            router.replace('/forgot-password');
        }
    };

    const handleVerify = async () => {
        if (!/^\d{6}$/.test(otp)) {
            logVerificationDebug('otp_verification_validation_failed', {
                purpose: flow.purpose,
                phone: maskPhone(flow.phone),
                reason: 'invalid_otp_format',
            }, 'warn');
            setMessage('Enter the six-digit verification code.');
            return;
        }
        if (!supabase) {
            logVerificationDebug('otp_verification_configuration_failed', {
                purpose: flow.purpose,
                reason: 'supabase_unavailable',
            }, 'warn');
            setMessage('Verification is unavailable.');
            return;
        }
        setIsVerifying(true);
        setMessage('');
        logVerificationDebug('otp_verification_started', {
            purpose: flow.purpose,
            phone: maskPhone(flow.phone),
        });
        const { error } = await supabase.auth.verifyOtp({ phone: flow.phone, token: otp, type: 'sms' });
        setIsVerifying(false);
        if (error) {
            logVerificationDebug('otp_verification_failed', {
                purpose: flow.purpose,
                phone: maskPhone(flow.phone),
                status: error.status ?? null,
                code: error.code ?? null,
                message: error.message,
            }, 'warn');
            setMessage('The verification code is invalid or has expired.');
            return;
        }
        logVerificationDebug('otp_verification_succeeded', {
            purpose: flow.purpose,
            phone: maskPhone(flow.phone),
        });
        markOtpVerified();
    };

    const handleResend = async () => {
        if (!supabase || countdown > 0 || isResending) {
            logVerificationDebug('resend_skipped', {
                purpose: flow.purpose,
                reason: !supabase ? 'supabase_unavailable' : countdown > 0 ? 'cooldown_active' : 'already_resending',
                countdown,
            });
            return;
        }
        setIsResending(true);
        setMessage('');
        logVerificationDebug('resend_started', {
            purpose: flow.purpose,
            phone: maskPhone(flow.phone),
        });
        const { data, error } = await supabase.functions.invoke('start-pos-account-verification', {
            body: { phone: flow.phone, purpose: flow.purpose },
        });
        setIsResending(false);
        if (error) {
            const parsed = await readFunctionError(error, 'Unable to resend the code.');
            const status = (error as { context?: Response } | null)?.context?.status ?? null;
            logVerificationDebug('resend_failed', {
                purpose: flow.purpose,
                phone: maskPhone(flow.phone),
                status,
                message: parsed.message,
                reason: parsed.reason,
                retryAfterSeconds: parsed.retryAfterSeconds,
                debugId: parsed.debugId,
            }, 'warn');
            setMessage(parsed.message);
            if (parsed.retryAfterSeconds > 0) setCountdown(parsed.retryAfterSeconds);
            return;
        }
        const resendAfterSeconds = typeof data?.resendAfterSeconds === 'number' ? data.resendAfterSeconds : 60;
        logVerificationDebug('resend_accepted', {
            purpose: flow.purpose,
            phone: maskPhone(flow.phone),
            resendAfterSeconds,
            debugId: typeof data?.debugId === 'string' ? data.debugId : null,
        });
        setCountdown(resendAfterSeconds);
        setMessage('A new verification code was requested.');
    };

    return (
        <SafeAreaView style={styles.screen}>
            <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
                <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.contentWrap}>
                <Text style={styles.title}>
                    {flow.origin === 'security' ? 'Verify Password Change' : 'Verify your Number'}
                </Text>
                <Text style={styles.subtitle}>Enter the 6-digit OTP sent to</Text>
                <Text style={styles.subtitle}>{maskPhone(flow.phone)}</Text>
                <View style={styles.iconCircle}>
                    <MaterialCommunityIcons name="shield-lock" size={86} color="#2f5ada" />
                </View>
                <TextInput
                    style={styles.otpInput}
                    value={otp}
                    onChangeText={(value) => {
                        setOtp(value.replace(/\D/g, '').slice(0, 6));
                        setMessage('');
                    }}
                    placeholder="000000"
                    placeholderTextColor="#a2a6af"
                    keyboardType="number-pad"
                    autoComplete="sms-otp"
                    textContentType="oneTimeCode"
                    maxLength={6}
                    editable={!isVerifying}
                />
                {message ? <Text style={message.includes('requested') ? styles.info : styles.error}>{message}</Text> : null}
                <TouchableOpacity style={[styles.primaryButton, (isVerifying || otp.length !== 6) && styles.disabled]} onPress={handleVerify} disabled={isVerifying || otp.length !== 6}>
                    {isVerifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verify</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.resendButton} onPress={handleResend} disabled={countdown > 0 || isResending}>
                    <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                        {isResending ? 'Requesting...' : countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#dfe2ec', paddingHorizontal: 20 },
    backButton: { marginTop: 8, width: 34, height: 34, borderRadius: 8, backgroundColor: '#2849a9', alignItems: 'center', justifyContent: 'center' },
    contentWrap: { flex: 1, alignItems: 'center', paddingTop: 24 },
    title: { fontSize: 22, fontWeight: '800', color: '#12151a', marginBottom: 6 },
    subtitle: { fontSize: 14, color: '#2e343c', lineHeight: 20 },
    iconCircle: { width: 146, height: 146, borderRadius: 73, backgroundColor: '#a9bdee', marginTop: 18, marginBottom: 28, alignItems: 'center', justifyContent: 'center' },
    otpInput: { width: '100%', height: 62, borderRadius: 31, borderWidth: 1, borderColor: '#2b53be', backgroundColor: '#f4f5f9', fontSize: 25, fontWeight: '800', color: '#11151b', textAlign: 'center', letterSpacing: 12, paddingLeft: 24 },
    primaryButton: { width: '100%', height: 52, borderRadius: 26, backgroundColor: '#2849a9', marginTop: 32, alignItems: 'center', justifyContent: 'center', elevation: 4 },
    primaryButtonText: { fontSize: 17, fontWeight: '800', color: '#f3f5ff' },
    resendButton: { padding: 14, marginTop: 6 },
    resendText: { color: '#2849a9', fontSize: 13, fontWeight: '700' },
    resendDisabled: { color: '#858a94' },
    disabled: { opacity: 0.6 },
    error: { color: '#b3261e', fontSize: 13, fontWeight: '600', marginTop: 12 },
    info: { color: '#2e7d32', fontSize: 13, fontWeight: '600', marginTop: 12 },
});
