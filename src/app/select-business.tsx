import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthSession } from '../lib/authSession';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface BusinessOption {
    business_id: number;
    business_owner_id: number;
    business_name: string;
    stall_id: string | null;
    stall_number: string | null;
    stall_no: string | null;
}

const getStallNumber = (business: BusinessOption) => (
    business.stall_number ?? business.stall_no ?? business.stall_id ?? 'Not assigned'
);

export default function SelectBusinessScreen() {
    const router = useRouter();
    const { currentUser, isHydrating, selectDeveloperBusiness, logout } = useAuthSession();
    const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState('');

    const loadBusinesses = useCallback(async () => {
        if (!isSupabaseConfigured || !supabase) {
            setErrorMessage('Supabase is not configured.');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setErrorMessage('');

        const { data, error } = await supabase
            .from('business')
            .select('business_id, business_owner_id, business_name, stall_id, stall_number, stall_no')
            .order('business_name', { ascending: true });

        if (error) {
            setBusinesses([]);
            setErrorMessage(error.message);
        } else {
            setBusinesses((data ?? []) as BusinessOption[]);
        }

        setIsLoading(false);
    }, []);

    useEffect(() => {
        void loadBusinesses();
    }, [loadBusinesses]);

    const filteredBusinesses = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) {
            return businesses;
        }

        return businesses.filter((business) => (
            business.business_name.toLowerCase().includes(query)
            || getStallNumber(business).toLowerCase().includes(query)
        ));
    }, [businesses, search]);

    if (isHydrating) {
        return null;
    }

    if (!currentUser) {
        return <Redirect href="/" />;
    }

    if (currentUser.profileTable !== 'developer') {
        return <Redirect href="/(tabs)/home" />;
    }

    const handleSelect = async (businessId: number) => {
        if (selectedBusinessId !== null) {
            return;
        }

        setSelectedBusinessId(businessId);
        setErrorMessage('');
        const result = await selectDeveloperBusiness(businessId);

        if (result.error || !result.user) {
            setSelectedBusinessId(null);
            setErrorMessage(result.error ?? 'Unable to select this business.');
            return;
        }

        router.replace('/(tabs)/home');
    };

    const handleLogout = async () => {
        await logout();
        router.replace('/');
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.eyebrow}>DEVELOPER ACCESS</Text>
                    <Text style={styles.title}>Select a business</Text>
                    <Text style={styles.subtitle}>Choose the business and stall you want to manage.</Text>
                </View>
                <Pressable style={styles.logoutButton} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={22} color="#b4433d" />
                </Pressable>
            </View>

            <View style={styles.searchWrap}>
                <Ionicons name="search" size={21} color="#737987" />
                <TextInput
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search business or stall"
                    placeholderTextColor="#8d929d"
                    autoCorrect={false}
                />
            </View>

            {errorMessage ? (
                <View style={styles.errorCard}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                    <Pressable onPress={() => void loadBusinesses()}>
                        <Text style={styles.retryText}>Retry</Text>
                    </Pressable>
                </View>
            ) : null}

            {isLoading ? (
                <View style={styles.centerState}>
                    <ActivityIndicator size="large" color="#2f5ada" />
                    <Text style={styles.stateText}>Loading businesses...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredBusinesses}
                    keyExtractor={(item) => String(item.business_id)}
                    contentContainerStyle={filteredBusinesses.length === 0 ? styles.emptyList : styles.list}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => {
                        const isSelecting = selectedBusinessId === item.business_id;

                        return (
                            <Pressable
                                style={({ pressed }) => [styles.businessCard, pressed && styles.businessCardPressed]}
                                disabled={selectedBusinessId !== null}
                                onPress={() => void handleSelect(item.business_id)}
                            >
                                <View style={styles.businessIcon}>
                                    <MaterialCommunityIcons name="storefront-outline" size={28} color="#2448a4" />
                                </View>
                                <View style={styles.businessText}>
                                    <Text style={styles.businessName}>{item.business_name}</Text>
                                    <Text style={styles.stallText}>Stall {getStallNumber(item)}</Text>
                                </View>
                                {isSelecting ? (
                                    <ActivityIndicator color="#2f5ada" />
                                ) : (
                                    <Ionicons name="chevron-forward" size={23} color="#747b89" />
                                )}
                            </Pressable>
                        );
                    }}
                    ListEmptyComponent={(
                        <View style={styles.centerState}>
                            <Text style={styles.stateTitle}>No businesses found</Text>
                            <Text style={styles.stateText}>Try a different business name or stall number.</Text>
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#eef0f6' },
    header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18, flexDirection: 'row', justifyContent: 'space-between' },
    eyebrow: { color: '#2f5ada', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
    title: { color: '#20252c', fontSize: 30, fontWeight: '800', marginTop: 4 },
    subtitle: { color: '#747985', fontSize: 15, marginTop: 5, maxWidth: 310 },
    logoutButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
    searchWrap: { marginHorizontal: 20, height: 52, borderRadius: 15, backgroundColor: '#ffffff', paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center' },
    searchInput: { flex: 1, height: '100%', marginLeft: 10, color: '#252a32', fontSize: 16 },
    list: { padding: 20, paddingBottom: 36 },
    emptyList: { flexGrow: 1 },
    businessCard: { minHeight: 82, borderRadius: 18, backgroundColor: '#ffffff', paddingHorizontal: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
    businessCardPressed: { opacity: 0.76 },
    businessIcon: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#dce6ff', alignItems: 'center', justifyContent: 'center' },
    businessText: { flex: 1, paddingHorizontal: 14 },
    businessName: { color: '#252a32', fontSize: 18, fontWeight: '800' },
    stallText: { color: '#747985', fontSize: 14, fontWeight: '600', marginTop: 4 },
    centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
    stateTitle: { color: '#252a32', fontSize: 19, fontWeight: '800', textAlign: 'center' },
    stateText: { color: '#767c88', fontSize: 15, marginTop: 8, textAlign: 'center' },
    errorCard: { marginHorizontal: 20, marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: '#fee8e6', flexDirection: 'row', alignItems: 'center' },
    errorText: { flex: 1, color: '#9f3e38', fontSize: 14 },
    retryText: { color: '#2f5ada', fontSize: 14, fontWeight: '800', marginLeft: 12 },
});
