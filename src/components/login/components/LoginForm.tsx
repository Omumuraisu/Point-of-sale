import { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { styles } from './styles';
import { useAuthSession } from '../../../lib/authSession';

const LoginForm = () => {
    const router = useRouter();
    const { loginWithPhone } = useAuthSession();
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

        const result = await loginWithPhone(username);

        setIsLoggingIn(false);

        if (result.error || !result.user) {
            setErrorMessage(result.error ?? 'Unable to login with this phone number.');
            return;
        }

        router.replace('/(tabs)/home');
    };

    return (
        <View style={styles.formCard}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#272c33" />
                <TextInput
                    style={styles.input}
                    placeholder="e.g., 09171234567"
                    placeholderTextColor="#8e939e"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#272c33" />
                <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor="#8e939e"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    accessibilityLabel="Toggle password visibility"
                >
                    <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#272c33" />
                </TouchableOpacity>
            </View>

            <View style={styles.forgotRow}>
                <TouchableOpacity>
                    <Text style={styles.forgotLink}>Forgot password?</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/activate-account')}>
                    <Text style={styles.forgotLink}>Activate account</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
                <Text style={styles.loginBtnText}>{isLoggingIn ? 'Checking...' : 'Login'}</Text>
            </TouchableOpacity>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>
    );
};

export default LoginForm;
