import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const SETTINGS_ITEMS = [
    {
        id: 'profile',
        title: 'Profile',
        subtitle: 'Change name, picture, number',
        iconSet: 'ionicons',
        iconName: 'person',
    },
    {
        id: 'security',
        title: 'Security',
        subtitle: 'Change password',
        iconSet: 'material',
        iconName: 'shield-check',
    },
    {
        id: 'app-details',
        title: 'App Details',
        subtitle: 'All about the application',
        iconSet: 'ionicons',
        iconName: 'information-circle',
    },
] as const;

type IconSet = 'ionicons' | 'material';
type SettingId = 'profile' | 'security' | 'app-details';

interface SettingItem {
    id: SettingId;
    title: string;
    subtitle: string;
    iconSet: IconSet;
    iconName: string;
}

interface SettingsIconProps {
    iconSet: IconSet;
    iconName: string;
}

const typedSettingsItems: readonly SettingItem[] = SETTINGS_ITEMS;

const SettingsIcon = ({ iconSet, iconName }: SettingsIconProps) => {
    if (iconSet === 'material') {
        return <MaterialCommunityIcons name={iconName as any} size={28} color="#1f2b3a" />;
    }

    return <Ionicons name={iconName as any} size={28} color="#1f2b3a" />;
};

const Settings = () => {
    const router = useRouter();

    const handleSettingPress = (id: SettingId) => {
        if (id === 'profile') {
            router.push('/profile');
        }
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.container}>
                <Text style={styles.pageTitle}>Settings</Text>

                <View style={styles.cardsWrap}>
                    {typedSettingsItems.map((item) => (
                        <Pressable key={item.id} style={styles.itemCard} onPress={() => handleSettingPress(item.id)}>
                            <View style={styles.itemRow}>
                                <View style={styles.iconCircle}>
                                    <SettingsIcon iconSet={item.iconSet} iconName={item.iconName} />
                                </View>

                                <View style={styles.itemTextWrap}>
                                    <Text style={styles.itemTitle}>{item.title}</Text>
                                    <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                                </View>

                                <Ionicons name="chevron-forward" size={28} color="#2a2d34" />
                            </View>
                        </Pressable>
                    ))}

                    <Pressable style={styles.logoutButton}>
                        <Text style={styles.logoutText}>Logout</Text>
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
};

export default Settings;

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
    },
    container: {
        flex: 1,
    },
    pageTitle: {
        marginTop: 10,
        marginBottom: 14,
        paddingHorizontal: 16,
        fontSize: 48 / 2,
        fontWeight: '800',
        color: '#20252c',
    },
    cardsWrap: {
        flex: 1,
        backgroundColor: '#d7dbe7',
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    itemCard: {
        minHeight: 110,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#d0d4df',
        backgroundColor: '#f4f4f5',
        paddingHorizontal: 14,
        marginBottom: 14,
        shadowColor: '#000000',
        shadowOpacity: 0.13,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 4,
        elevation: 3,
        justifyContent: 'center',
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconCircle: {
        width: 58,
        height: 58,
        borderRadius: 29,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#a9beef',
        marginRight: 16,
    },
    itemTextWrap: {
        flex: 1,
        paddingRight: 12,
    },
    itemTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#252a32',
    },
    itemSubtitle: {
        marginTop: 2,
        fontSize: 33 / 2,
        fontWeight: '600',
        color: '#7d818b',
    },
    logoutButton: {
        height: 54,
        borderRadius: 12,
        backgroundColor: '#cf5a53',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 18,
        shadowColor: '#000000',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 2,
    },
    logoutText: {
        fontSize: 22,
        fontWeight: '800',
        color: '#ffffff',
    },
});
