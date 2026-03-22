import { useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function CreatePasswordScreen() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = () => {
        router.replace('/');
    };

    return (
        <SafeAreaView style={styles.screen}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.contentWrap}>
                <Text style={styles.title}>Create Password</Text>
                <Text style={styles.subtitle}>Kindly create a strong password</Text>

                <View style={styles.iconCircle}>
                    <Ionicons name="key" size={52} color="#212831" />
                </View>

                <Text style={styles.label}>New Password</Text>
                <View style={styles.inputWrap}>
                    <TextInput
                        style={styles.input}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        placeholder="Enter new password"
                        placeholderTextColor="#8f8f93"
                        autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
                        <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#272c33" />
                    </TouchableOpacity>
                </View>

                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputWrap}>
                    <TextInput
                        style={styles.input}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirmPassword}
                        placeholder="Confirm new password"
                        placeholderTextColor="#8f8f93"
                        autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword((prev) => !prev)}>
                        <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#272c33" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
                    <Text style={styles.primaryButtonText}>Submit</Text>
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
        marginBottom: 14,
    },
    iconCircle: {
        width: 146,
        height: 146,
        borderRadius: 73,
        backgroundColor: '#a9bdee',
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        width: '100%',
        fontSize: 32 / 2,
        color: '#11151b',
        fontWeight: '800',
        marginBottom: 8,
    },
    inputWrap: {
        width: '100%',
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#b8b8be',
        backgroundColor: '#efefef',
        paddingHorizontal: 14,
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: 14,
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: '#333',
    },
    primaryButton: {
        width: '100%',
        height: 52,
        borderRadius: 26,
        backgroundColor: '#2849a9',
        marginTop: 20,
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
