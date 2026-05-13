import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    DEFAULT_PERSONNEL,
    loadPersonnelRecords,
    PersonnelDocument,
    PersonnelRecord,
} from '../components/rent/personnelStore';

const formatFullName = (personnel: PersonnelRecord): string => (
    `${personnel.firstName} ${personnel.lastName}`.trim() || 'Unnamed Personnel'
);

const formatCreatedDate = (createdAt: number): string => {
    if (!createdAt) {
        return 'Default record';
    }

    return new Date(createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const formatFileSize = (size?: number): string => {
    if (!size || size < 1) {
        return '';
    }

    if (size < 1024 * 1024) {
        return `${Math.ceil(size / 1024)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

interface DetailRowProps {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value?: string;
}

const DetailRow = ({ icon, label, value }: DetailRowProps) => (
    <View style={styles.detailRow}>
        <View style={styles.detailIcon}>
            <Ionicons name={icon} size={18} color="#2448a4" />
        </View>
        <View style={styles.detailTextWrap}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value?.trim() || 'Not provided'}</Text>
        </View>
    </View>
);

const DocumentRow = ({ document }: { document: PersonnelDocument }) => {
    const isPdf = document.mimeType === 'application/pdf' || document.name.toLowerCase().endsWith('.pdf');
    const sizeLabel = formatFileSize(document.size);

    return (
        <View style={styles.documentRow}>
            <View style={styles.documentIcon}>
                <Ionicons name={isPdf ? 'document-text-outline' : 'image-outline'} size={20} color="#4d5666" />
            </View>
            <View style={styles.documentTextWrap}>
                <Text style={styles.documentName} numberOfLines={1}>{document.name}</Text>
                <Text style={styles.documentMeta}>{sizeLabel || document.mimeType || 'Uploaded document'}</Text>
            </View>
        </View>
    );
};

const PersonnelDetailRoute = () => {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id?: string | string[] }>();
    const personnelId = useMemo(
        () => (typeof id === 'string' ? id : Array.isArray(id) ? id[0] : ''),
        [id],
    );
    const [personnel, setPersonnel] = useState<PersonnelRecord | null>(null);

    useEffect(() => {
        let isMounted = true;

        const hydratePersonnel = async () => {
            const savedPersonnel = await loadPersonnelRecords();
            const allPersonnel = [...DEFAULT_PERSONNEL, ...savedPersonnel];
            const matched = allPersonnel.find((entry) => entry.id === personnelId) ?? null;

            if (isMounted) {
                setPersonnel(matched);
            }
        };

        hydratePersonnel();

        return () => {
            isMounted = false;
        };
    }, [personnelId]);

    const isPending = personnel?.status === 'pending approval';
    const documents = personnel?.documents ?? [];

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color="#2b2f36" />
                </Pressable>
                <Text style={styles.headerTitle}>Personnel Profile</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
                {personnel ? (
                    <>
                        <View style={styles.profileCard}>
                            <View style={styles.avatar}>
                                <Ionicons name="person" size={46} color="#ffffff" />
                            </View>
                            <Text style={styles.name}>{formatFullName(personnel)}</Text>
                            <View
                                style={[
                                    styles.statusPill,
                                    isPending ? styles.statusPillPending : styles.statusPillApproved,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.statusText,
                                        isPending ? styles.statusTextPending : styles.statusTextApproved,
                                    ]}
                                >
                                    {personnel.status.toUpperCase()}
                                </Text>
                            </View>
                            <Text style={styles.createdText}>Added {formatCreatedDate(personnel.createdAt)}</Text>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Personal Details</Text>
                            <DetailRow icon="calendar-outline" label="Birthday" value={personnel.birthday} />
                            <DetailRow icon="location-outline" label="Address" value={personnel.address} />
                            <DetailRow icon="call-outline" label="Phone Number" value={personnel.phoneNumber} />
                            <DetailRow icon="mail-outline" label="Email" value={personnel.email} />
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Documents</Text>
                            {documents.length > 0 ? (
                                <View style={styles.documentList}>
                                    {documents.map((document) => (
                                        <DocumentRow key={document.uri} document={document} />
                                    ))}
                                </View>
                            ) : (
                                <Text style={styles.emptyText}>No documents uploaded.</Text>
                            )}
                        </View>
                    </>
                ) : (
                    <View style={styles.emptyCard}>
                        <Ionicons name="person-circle-outline" size={52} color="#8a93a5" />
                        <Text style={styles.emptyTitle}>Personnel not found</Text>
                        <Text style={styles.emptyText}>
                            This personnel record may have been removed from local storage.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default PersonnelDetailRoute;

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 6,
        paddingBottom: 10,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#eef0f6',
    },
    headerTitle: {
        marginLeft: 10,
        fontSize: 22,
        fontWeight: '700',
        color: '#1c2028',
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingBottom: 24,
    },
    profileCard: {
        borderRadius: 22,
        backgroundColor: '#f4f4f5',
        borderWidth: 1,
        borderColor: '#c8ccd8',
        padding: 18,
        alignItems: 'center',
        marginBottom: 12,
    },
    avatar: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: '#a2a4ac',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    name: {
        fontSize: 24,
        fontWeight: '800',
        color: '#11131a',
        textAlign: 'center',
    },
    statusPill: {
        marginTop: 10,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    statusPillPending: {
        backgroundColor: '#ffe8d4',
    },
    statusPillApproved: {
        backgroundColor: '#d9f1dc',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    statusTextPending: {
        color: '#c0661b',
    },
    statusTextApproved: {
        color: '#2f7a40',
    },
    createdText: {
        marginTop: 8,
        fontSize: 13,
        fontWeight: '600',
        color: '#7a808e',
    },
    card: {
        borderRadius: 20,
        backgroundColor: '#f4f4f5',
        borderWidth: 1,
        borderColor: '#c8ccd8',
        padding: 14,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#252932',
        marginBottom: 8,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#d9dde8',
    },
    detailIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#dbe3f4',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    detailTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    detailLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#7a808e',
    },
    detailValue: {
        marginTop: 2,
        fontSize: 16,
        fontWeight: '700',
        color: '#1d2128',
    },
    documentList: {
        gap: 8,
    },
    documentRow: {
        minHeight: 48,
        borderRadius: 14,
        backgroundColor: '#eceef4',
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    documentIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#f6f7fa',
        alignItems: 'center',
        justifyContent: 'center',
    },
    documentTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    documentName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#252a33',
    },
    documentMeta: {
        marginTop: 2,
        fontSize: 12,
        fontWeight: '600',
        color: '#7a808e',
    },
    emptyCard: {
        minHeight: 240,
        borderRadius: 20,
        backgroundColor: '#f4f4f5',
        borderWidth: 1,
        borderColor: '#c8ccd8',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    emptyTitle: {
        marginTop: 10,
        fontSize: 20,
        fontWeight: '800',
        color: '#1c2029',
        textAlign: 'center',
    },
    emptyText: {
        marginTop: 6,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '600',
        color: '#6d7280',
        textAlign: 'center',
    },
});
