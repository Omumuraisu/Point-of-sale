import { useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ActivateAccountScreen() {
    const router = useRouter();
    const [phoneNumber, setPhoneNumber] = useState('');

    const handleContinue = () => {
        const trimmed = phoneNumber.trim();
        const maskedPhone = trimmed.length >= 4
            ? `${trimmed.slice(0, 4)}****${trimmed.slice(-2)}`
            : '0915****72';

        router.push({
            pathname: '/activate-otp',
            params: { phone: maskedPhone },
        });
    };

    return (
        <SafeAreaView style={styles.screen}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.contentWrap}>
                <Text style={styles.title}>Account Verification</Text>
                <Text style={styles.subtitle}>Please Enter your Phone Number to</Text>
                <Text style={styles.subtitle}>Receive OTP Code</Text>

                <View style={styles.iconCircle}>
                    <View style={styles.iconArtwork}>
                        <MaterialCommunityIcons name="cellphone" size={78} color="#34383d" />
                        <MaterialCommunityIcons
                            name="message-processing"
                            size={47}
                            color="#2db9e8"
                            style={styles.messageIcon}
                        />
                    </View>
                </View>

                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter Phone Number"
                    placeholderTextColor="#8f8f93"
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                />

                <Text style={styles.helperText}>This will allow you to activate your</Text>
                <Text style={styles.helperText}>account if you haven't</Text>

                <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
                    <Text style={styles.primaryButtonText}>Continue</Text>
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
    iconArtwork: {
        width: 104,
        height: 92,
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageIcon: {
        position: 'absolute',
        right: 0,
        top: 16,
    },
    label: {
        width: '100%',
        fontSize: 32 / 2,
        color: '#11151b',
        fontWeight: '800',
        marginBottom: 8,
    },
    input: {
        width: '100%',
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#b8b8be',
        backgroundColor: '#efefef',
        paddingHorizontal: 16,
        marginBottom: 58,
    },
    helperText: {
        fontSize: 14,
        color: '#8b8f96',
        lineHeight: 18,
    },
    primaryButton: {
        width: '100%',
        height: 52,
        borderRadius: 26,
        backgroundColor: '#2849a9',
        marginTop: 34,
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
