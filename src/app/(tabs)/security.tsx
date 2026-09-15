import { useState } from 'react';
import { ActivityIndicator, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { logVerificationDebug, maskPhone, normalizePhilippinePhone, readFunctionError } from '../../lib/authFlow';
import { useAuthSession } from '../../lib/authSession';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useVerificationFlow } from '../../lib/verificationFlow';

const Security = () => {
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const { startFlow, clearFlow } = useVerificationFlow();
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const normalizedPhone = normalizePhilippinePhone(currentUser?.phoneNumber ?? '');
    const phoneLabel = normalizedPhone ? maskPhone(normalizedPhone) : 'No verified phone number';

    const handleBack = () => {
        clearFlow();
        router.back();
    };

    const handleSendOtp = async () => {
        if (isSubmitting) return;

        if (!currentUser || !normalizedPhone) {
            setMessage('Your account does not have a valid verified phone number.');
            return;
        }

        if (!isSupabaseConfigured || !supabase) {
            setMessage('Verification is unavailable. Check the app configuration.');
            return;
        }

        setIsSubmitting(true);
        setMessage('');
        clearFlow();
        logVerificationDebug('password_change_otp_request_started', {
            purpose: 'recovery',
            phone: maskPhone(normalizedPhone),
        });

        const { data, error } = await supabase.functions.invoke('start-pos-account-verification', {
            body: { phone: normalizedPhone, purpose: 'recovery' },
        });

        setIsSubmitting(false);

        if (error) {
            const parsed = await readFunctionError(error, 'Unable to request a verification code.');
            logVerificationDebug('password_change_otp_request_failed', {
                purpose: 'recovery',
                phone: maskPhone(normalizedPhone),
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

        startFlow(normalizedPhone, 'recovery', 'security');
        router.push({ pathname: '/activate-otp', params: { resendAfterSeconds } });
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable style={styles.backBtn} onPress={handleBack} disabled={isSubmitting}>
                    <Ionicons name="chevron-back" size={34} color="#272c33" />
                </Pressable>
                <Text style={styles.headerTitle}>Security</Text>
            </View>

            <View style={styles.contentWrap}>
                <View style={styles.formCard}>
                    <Text style={styles.sectionTitle}>Change Password</Text>
                    <Text style={styles.description}>
                        We will send a one-time verification code to your registered phone before you can set a new password.
                    </Text>

                    <View style={styles.phoneCard}>
                        <View style={styles.phoneIcon}>
                            <Ionicons name="phone-portrait-outline" size={24} color="#2f5ada" />
                        </View>
                        <View style={styles.phoneTextWrap}>
                            <Text style={styles.phoneLabel}>Verified phone number</Text>
                            <Text style={styles.phoneValue}>{phoneLabel}</Text>
                        </View>
                    </View>

                    {message ? <Text style={styles.errorText}>{message}</Text> : null}

                    <Pressable
                        style={[styles.sendButton, (isSubmitting || !normalizedPhone) && styles.disabledButton]}
                        onPress={handleSendOtp}
                        disabled={isSubmitting || !normalizedPhone}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <>
                                <Ionicons name="chatbubble-ellipses-outline" size={21} color="#ffffff" />
                                <Text style={styles.sendButtonText}>Send OTP</Text>
                            </>
                        )}
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
};

export default Security;

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
    },
    header: {
        minHeight: 74,
        backgroundColor: '#f4f4f5',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#d7dae5',
    },
    backBtn: {
        marginRight: 10,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#20252c',
    },
    contentWrap: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 36,
        paddingHorizontal: 14,
    },
    formCard: {
        width: '100%',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#d0d4df',
        backgroundColor: '#f4f4f5',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 16,
        shadowColor: '#000000',
        shadowOpacity: 0.13,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 4,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 40 / 2,
        fontWeight: '800',
        color: '#252a32',
        marginTop: 8,
        marginBottom: 8,
    },
    description: {
        fontSize: 15,
        lineHeight: 21,
        color: '#626976',
        marginBottom: 18,
    },
    phoneCard: {
        minHeight: 66,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#c8cedb',
        backgroundColor: '#ffffff',
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    phoneIcon: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#e4ebff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    phoneTextWrap: {
        flex: 1,
    },
    phoneLabel: {
        fontSize: 13,
        color: '#747b88',
        fontWeight: '600',
    },
    phoneValue: {
        marginTop: 3,
        fontSize: 17,
        color: '#242a32',
        fontWeight: '800',
    },
    errorText: {
        marginTop: 12,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
        color: '#b3261e',
    },
    sendButton: {
        height: 50,
        borderRadius: 12,
        backgroundColor: '#2f5ada',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 20,
    },
    sendButtonText: {
        fontSize: 17,
        fontWeight: '800',
        color: '#ffffff',
    },
    disabledButton: {
        opacity: 0.6,
    },
});
