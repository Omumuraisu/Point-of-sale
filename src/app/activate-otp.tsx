import { useRef, useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function ActivateOtpScreen() {
    const router = useRouter();
    const { phone } = useLocalSearchParams<{ phone?: string }>();

    const [otp, setOtp] = useState(['', '', '', '']);
    const otpRefs = useRef<Array<TextInput | null>>([]);

    const updateOtp = (index: number, value: string) => {
        const nextValue = value.replace(/[^0-9]/g, '').slice(-1);
        const next = [...otp];
        next[index] = nextValue;
        setOtp(next);

        if (nextValue && index < otpRefs.current.length - 1) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    return (
        <SafeAreaView style={styles.screen}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.contentWrap}>
                <Text style={styles.title}>Verify your Number</Text>
                <Text style={styles.subtitle}>Enter the 4-digit OTP sent to</Text>
                <Text style={styles.subtitle}>{phone ?? '0915****72'}</Text>

                <View style={styles.iconCircle}>
                    <Ionicons name="mail-open" size={56} color="#212831" />
                </View>

                <View style={styles.otpRow}>
                    {otp.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={(ref) => {
                                otpRefs.current[index] = ref;
                            }}
                            style={styles.otpInput}
                            keyboardType="number-pad"
                            maxLength={1}
                            value={digit}
                            onChangeText={(value) => updateOtp(index, value)}
                            textAlign="center"
                        />
                    ))}
                </View>

                <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => router.push('/create-password')}
                >
                    <Text style={styles.primaryButtonText}>Verify</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
        paddingHorizontal: 20,
    },
    backButton: {
        marginTop: 8,
        width: 34,
        height: 34,
        borderRadius: 8,
        backgroundColor: '#2849a9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentWrap: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 24,
    },
    title: {
        fontSize: 34 / 2,
        fontWeight: '800',
        color: '#12151a',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        color: '#2e343c',
        lineHeight: 18,
    },
    iconCircle: {
        width: 146,
        height: 146,
        borderRadius: 73,
        backgroundColor: '#a9bdee',
        marginTop: 16,
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    otpRow: {
        flexDirection: 'row',
        gap: 14,
        marginTop: 12,
    },
    otpInput: {
        width: 52,
        height: 52,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: '#2b53be',
        backgroundColor: '#f4f5f9',
        fontSize: 34 / 2,
        color: '#11151b',
    },
    primaryButton: {
        width: '100%',
        height: 52,
        borderRadius: 26,
        backgroundColor: '#2849a9',
        marginTop: 118,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#1a2f6f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
    },
    primaryButtonText: {
        fontSize: 33 / 2,
        fontWeight: '800',
        color: '#f3f5ff',
    },
});
