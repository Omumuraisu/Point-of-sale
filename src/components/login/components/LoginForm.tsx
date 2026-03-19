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

const LoginForm = () => {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = () => {
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
            </View>

            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
                <Text style={styles.loginBtnText}>Login</Text>
            </TouchableOpacity>
        </View>
    );
};

export default LoginForm;
