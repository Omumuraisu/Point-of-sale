import { useEffect, useState } from 'react';
import { BackHandler, Image, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import LoginForm from './components/LoginForm';
import { styles } from './components/styles';

const loginLogo = require('../../../assets/marketsync-login-logo.png');
const mainLogo = require('../../../assets/marketsync-logo.png');

const Login = () => {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        if (!showForm) return;

        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            setShowForm(false);
            return true;
        });

        return () => subscription.remove();
    }, [showForm]);

    if (showForm) {
        return (
            <SafeAreaView style={styles.formScreen} edges={['top', 'left', 'right']}>
                <View style={styles.formIntro}>
                    <Image source={loginLogo} style={styles.horizontalLogo} resizeMode="contain" />
                    <Text style={styles.greetTitle}>Welcome!</Text>
                    <Text style={styles.greetSub}>Login to your account</Text>
                </View>
                <LoginForm />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.welcomeScreen}>
            <View style={styles.brandArea}>
                <Image source={mainLogo} style={styles.mainLogo} resizeMode="contain" />
            </View>
            <View style={styles.welcomeActions}>
                <TouchableOpacity style={styles.primaryButton} onPress={() => setShowForm(true)}>
                    <Text style={styles.primaryButtonText}>Login</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/activate-account')}>
                    <Text style={styles.secondaryButtonText}>Activate Account</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.welcomeFooter}>© 2026 MarketSync. All rights reserved.</Text>
        </SafeAreaView>
    );
};

export default Login;
