import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isStrongPassword, readFunctionError } from '../lib/authFlow';
import { useAuthSession } from '../lib/authSession';
import { supabase } from '../lib/supabase';
import { useVerificationFlow } from '../lib/verificationFlow';

export default function CreatePasswordScreen() {
    const router = useRouter();
    const { flow, clearFlow } = useVerificationFlow();
    const { logout } = useAuthSession();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [message, setMessage] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const isCancellingRef = useRef(false);

    useEffect(() => {
        if ((!flow || flow.stage !== 'password') && !isCancellingRef.current) router.replace('/');
    }, [flow, router]);

    if (!flow || flow.stage !== 'password') return null;

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

    const handleSubmit = async () => {
        if (!isStrongPassword(password)) {
            setMessage('Use 8 or more characters with uppercase, lowercase, and a number.');
            return;
        }
        if (password !== confirmPassword) {
            setMessage('Passwords do not match.');
            return;
        }
        if (!supabase) {
            setMessage('Password setup is unavailable.');
            return;
        }

        setIsSaving(true);
        setMessage('');
        const { error } = await supabase.functions.invoke('complete-pos-account-password', {
            body: { password, purpose: flow.purpose },
        });
        if (error) {
            const parsed = await readFunctionError(error, 'Unable to save the password.');
            setIsSaving(false);
            setMessage(parsed.message);
            return;
        }

        const success = flow.purpose === 'activation'
            ? 'Account activated. Sign in with your new password.'
            : 'Password updated. Sign in with your new password.';
        await logout();
        clearFlow();
        setIsSaving(false);
        router.replace({ pathname: '/', params: { message: success } });
    };

    const field = (label: string, value: string, setter: (value: string) => void, visible: boolean, toggle: () => void) => (
        <>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.inputWrap}>
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={(next) => {
                        setter(next);
                        setMessage('');
                    }}
                    secureTextEntry={!visible}
                    placeholder={`Enter ${label.toLowerCase()}`}
                    placeholderTextColor="#8f8f93"
                    autoCapitalize="none"
                    editable={!isSaving}
                />
                <TouchableOpacity onPress={toggle} disabled={isSaving}>
                    <Ionicons name={visible ? 'eye-outline' : 'eye-off-outline'} size={20} color="#272c33" />
                </TouchableOpacity>
            </View>
        </>
    );

    return (
        <SafeAreaView style={styles.screen}>
            <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
                <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.contentWrap}>
                <Text style={styles.title}>
                    {flow.origin === 'security'
                        ? 'Change Password'
                        : flow.purpose === 'activation'
                            ? 'Create Password'
                            : 'New Password'}
                </Text>
                <Text style={styles.subtitle}>Use at least 8 characters with uppercase, lowercase, and a number.</Text>
                <View style={styles.iconCircle}><Ionicons name="key" size={52} color="#212831" /></View>
                {field('New Password', password, setPassword, showPassword, () => setShowPassword((value) => !value))}
                {field('Confirm Password', confirmPassword, setConfirmPassword, showConfirmPassword, () => setShowConfirmPassword((value) => !value))}
                {message ? <Text style={styles.error}>{message}</Text> : null}
                <TouchableOpacity style={[styles.primaryButton, isSaving && styles.disabled]} onPress={handleSubmit} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save Password</Text>}
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
    subtitle: { fontSize: 13, color: '#2e343c', lineHeight: 19, textAlign: 'center', paddingHorizontal: 20 },
    iconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#a9bdee', marginVertical: 20, alignItems: 'center', justifyContent: 'center' },
    label: { width: '100%', fontSize: 16, color: '#11151b', fontWeight: '800', marginBottom: 8 },
    inputWrap: { width: '100%', height: 50, borderRadius: 25, borderWidth: 1, borderColor: '#b8b8be', backgroundColor: '#f7f7f8', paddingHorizontal: 16, alignItems: 'center', flexDirection: 'row', marginBottom: 14 },
    input: { flex: 1, fontSize: 14, color: '#333' },
    primaryButton: { width: '100%', height: 52, borderRadius: 26, backgroundColor: '#2849a9', marginTop: 18, alignItems: 'center', justifyContent: 'center', elevation: 4 },
    primaryButtonText: { fontSize: 17, fontWeight: '800', color: '#f3f5ff' },
    error: { color: '#b3261e', fontSize: 13, fontWeight: '600', alignSelf: 'flex-start' },
    disabled: { opacity: 0.65 },
});
