import { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLoginStyles } from './styles';
import { useAuthSession } from '../../../lib/authSession';
import { useTheme } from '../../../lib/theme';

const LoginForm = () => {
    const styles = useLoginStyles();
    const { colors } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams<{ message?: string }>();
    const { loginWithPassword } = useAuthSession();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleLogin = async () => {
        if (isLoggingIn) {
            return;
        }

        setErrorMessage('');
        setIsLoggingIn(true);

        const result = await loginWithPassword(username, password);

        setIsLoggingIn(false);

        if (result.error || !result.user) {
            setErrorMessage(result.error ?? 'Unable to login with this phone number.');
            return;
        }

        router.replace(
            result.user.profileTable === 'developer' && !result.user.businessId
                ? '/select-business'
                : '/(tabs)/home',
        );
    };

    return (
        <View style={styles.formCard}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={20} color={colors.icon} />
                <TextInput
                    style={styles.input}
                    placeholder="0923 123 2134"
                    placeholderTextColor={colors.textMuted}
                    value={username}
                    onChangeText={(value) => {
                        setUsername(value);
                        setErrorMessage('');
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    editable={!isLoggingIn}
                />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.icon} />
                <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={(value) => {
                        setPassword(value);
                        setErrorMessage('');
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoggingIn}
                    onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    accessibilityLabel="Toggle password visibility"
                >
                    <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.icon} />
                </TouchableOpacity>
            </View>

            <View style={styles.forgotRow}>
                <TouchableOpacity onPress={() => router.push('/forgot-password')} disabled={isLoggingIn}>
                    <Text style={styles.forgotLink}>Forgot password?</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={isLoggingIn}>
                <Text style={styles.loginBtnText}>{isLoggingIn ? 'Checking...' : 'Login'}</Text>
            </TouchableOpacity>
            {params.message ? <Text style={styles.successText}>{params.message}</Text> : null}
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            <Text style={styles.formFooter}>© 2026 MarketSync. All rights reserved.</Text>
        </View>
    );
};

export default LoginForm;
