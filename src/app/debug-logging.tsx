import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthSession } from '../lib/authSession';
import { DEBUG_CHANNELS, useDebugLogging } from '../lib/debugLogging';
import { useTheme, useThemedStyles } from '../lib/theme';

export default function DebugLoggingScreen() {
    const styles = useThemedStyles(baseStyles);
    const { colors } = useTheme();
    const router = useRouter();
    const { currentUser, isHydrating: isAuthHydrating } = useAuthSession();
    const { settings, isHydrating, setChannelEnabled, disableAll } = useDebugLogging();
    const isDeveloper = currentUser?.profileTable === 'developer';

    useEffect(() => {
        if (!isAuthHydrating && !isDeveloper) router.replace('/(tabs)/settings');
    }, [isAuthHydrating, isDeveloper, router]);

    if (isAuthHydrating || !isDeveloper) return null;

    const anyEnabled = Object.values(settings).some(Boolean);
    return (
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color="#ffffff" />
                </Pressable>
                <Text style={styles.headerTitle}>Debug Logging</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.intro}>
                    Enabled channels print sanitized diagnostics to the Metro or device console. Settings apply to this device only.
                </Text>
                {isHydrating ? <ActivityIndicator color={colors.primary} /> : DEBUG_CHANNELS.map((channel) => (
                    <View key={channel.id} style={styles.card}>
                        <View style={styles.textWrap}>
                            <Text style={styles.title}>{channel.label}</Text>
                            <Text style={styles.description}>{channel.description}</Text>
                        </View>
                        <Switch
                            value={settings[channel.id]}
                            onValueChange={(enabled) => { void setChannelEnabled(channel.id, enabled); }}
                            trackColor={{ false: colors.borderStrong, true: colors.primarySoft }}
                            thumbColor={settings[channel.id] ? colors.primary : '#f3f4f7'}
                        />
                    </View>
                ))}
                <Pressable
                    style={[styles.disableButton, !anyEnabled && styles.disabledButton]}
                    disabled={!anyEnabled || isHydrating}
                    onPress={() => { void disableAll(); }}
                >
                    <Text style={styles.disableText}>Disable All</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

const baseStyles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#dfe2ec' },
    header: { height: 70, paddingHorizontal: 16, backgroundColor: '#2846a5', flexDirection: 'row', alignItems: 'center' },
    backButton: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { marginLeft: 8, color: '#ffffff', fontSize: 21, fontWeight: '800' },
    content: { padding: 18, paddingBottom: 34, gap: 12 },
    intro: { color: '#535b6b', fontSize: 14, lineHeight: 20, marginBottom: 4 },
    card: { minHeight: 88, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', gap: 12 },
    textWrap: { flex: 1 },
    title: { color: '#20252c', fontSize: 17, fontWeight: '800' },
    description: { marginTop: 3, color: '#707786', fontSize: 13, lineHeight: 18 },
    disableButton: { height: 52, marginTop: 8, borderRadius: 11, backgroundColor: '#cf5a53', alignItems: 'center', justifyContent: 'center' },
    disabledButton: { opacity: 0.45 },
    disableText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
});
