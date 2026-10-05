import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../lib/theme';

const FEATURES = [
    'Point-of-Sale Transactions',
    'Product Management',
    'Sales History & Summary',
    'Billing Information',
    'Notifications',
    'Stall Status',
    'Personnel Management',
] as const;

export default function AppDetailsScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const styles = useThemedStyles(baseStyles);

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <Pressable
                    style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Back to Settings"
                >
                    <Ionicons name="chevron-back" size={30} color={colors.icon} />
                </Pressable>
                <Text style={styles.headerTitle}>App Details</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.hero}>
                    <Image
                        source={require('../../assets/marketsync-logo.png')}
                        style={styles.logo}
                        resizeMode="contain"
                        accessibilityLabel="MarketSync logo"
                    />
                    <Text style={styles.appName}>MarketSync</Text>
                    <Text style={styles.tagline}>Point-of-Sale Application</Text>
                    <Text style={styles.version}>Version 1.0.0</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <Text style={styles.bodyText}>
                        MarketSync Vendor POS assists registered Iloilo Terminal Market business owners and vendors in recording daily sales transactions and managing selected stall-related activities.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Features</Text>
                    <View style={styles.featureList}>
                        {FEATURES.map((feature) => (
                            <View key={feature} style={styles.featureRow}>
                                <View style={styles.bullet} />
                                <Text style={styles.featureText}>{feature}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>System</Text>
                    <Text style={styles.emphasizedText}>
                        Integrated Stall Management and Delivery System with Foot Traffic Density Estimator and Market Economic Activity Logging
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Developed By</Text>
                    <Text style={styles.emphasizedText}>
                        4th Year Bachelor of Science in Information Systems Students
                    </Text>
                    <Text style={styles.bodyText}>College of Information and Communications Technology</Text>
                    <Text style={styles.bodyText}>West Visayas State University</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Purpose</Text>
                    <Text style={styles.purposeText}>
                        Developed as part of an undergraduate thesis for the Iloilo Terminal Market.
                    </Text>
                </View>

                <View style={styles.divider} />
                <Text style={styles.copyright}>© 2026–2027 MarketSync. All rights reserved.</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const baseStyles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
    },
    header: {
        minHeight: 70,
        paddingHorizontal: 12,
        backgroundColor: '#f4f4f5',
        borderBottomWidth: 1,
        borderBottomColor: '#d0d5e0',
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pressed: {
        opacity: 0.6,
    },
    headerTitle: {
        marginLeft: 6,
        color: '#20252c',
        fontSize: 24,
        fontWeight: '800',
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 36,
    },
    hero: {
        alignItems: 'center',
        paddingBottom: 24,
    },
    logo: {
        width: 84,
        height: 84,
        marginBottom: 12,
    },
    appName: {
        color: '#151922',
        fontSize: 28,
        fontWeight: '900',
    },
    tagline: {
        marginTop: 6,
        color: '#5f6875',
        fontSize: 16,
        fontStyle: 'italic',
    },
    version: {
        marginTop: 8,
        color: '#151922',
        fontSize: 15,
        fontWeight: '700',
    },
    divider: {
        height: 1,
        backgroundColor: '#aeb5c7',
        marginBottom: 22,
    },
    section: {
        marginBottom: 22,
    },
    sectionTitle: {
        marginBottom: 8,
        color: '#151922',
        fontSize: 18,
        fontWeight: '800',
    },
    bodyText: {
        color: '#5f6875',
        fontSize: 15,
        lineHeight: 22,
    },
    emphasizedText: {
        color: '#151922',
        fontSize: 15,
        lineHeight: 22,
        fontWeight: '700',
    },
    featureList: {
        gap: 10,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingLeft: 4,
    },
    bullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginTop: 8,
        marginRight: 12,
        backgroundColor: '#2f5ada',
    },
    featureText: {
        flex: 1,
        color: '#5f6875',
        fontSize: 15,
        lineHeight: 22,
    },
    purposeText: {
        color: '#5f6875',
        fontSize: 15,
        lineHeight: 22,
        fontStyle: 'italic',
    },
    copyright: {
        color: '#7d818b',
        fontSize: 13,
        lineHeight: 19,
        fontStyle: 'italic',
        textAlign: 'center',
    },
});
