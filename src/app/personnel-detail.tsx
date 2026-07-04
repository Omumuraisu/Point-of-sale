import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import {
    deleteVendorApplication,
    loadVendorComplianceRequests,
    loadVendorApplications,
    PersonnelDocument,
    PersonnelRecord,
    submitVendorComplianceDocuments,
    VendorComplianceRequest,
} from '../components/rent/personnelStore';
import { useAuthSession } from '../lib/authSession';

const formatFullName = (personnel: PersonnelRecord): string => {
    const middleInitial = personnel.middleInitial && personnel.middleInitial !== 'NA'
        ? personnel.middleInitial
        : '';

    return [personnel.firstName, middleInitial, personnel.lastName]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' ')
        || 'Unnamed Personnel';
};

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

const PendingDocumentRow = ({
    document,
    disabled,
    onRemove,
}: {
    document: PersonnelDocument;
    disabled?: boolean;
    onRemove: () => void;
}) => {
    const isPdf = document.mimeType === 'application/pdf' || document.name.toLowerCase().endsWith('.pdf');
    const sizeLabel = formatFileSize(document.size);

    return (
        <View style={styles.documentRow}>
            <View style={styles.documentIcon}>
                <Ionicons name={isPdf ? 'document-text-outline' : 'image-outline'} size={20} color="#4d5666" />
            </View>
            <View style={styles.documentTextWrap}>
                <Text style={styles.documentName} numberOfLines={1}>{document.name}</Text>
                <Text style={styles.documentMeta}>{sizeLabel || document.mimeType || 'Selected document'}</Text>
            </View>
            <Pressable
                style={[styles.removePendingButton, disabled ? styles.removePendingButtonDisabled : null]}
                onPress={onRemove}
                disabled={disabled}
                hitSlop={8}
            >
                <Ionicons name="close" size={18} color="#d85647" />
            </Pressable>
        </View>
    );
};

const formatRequestDate = (createdAt: string): string => {
    const date = new Date(createdAt);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const ComplianceRequestCard = ({ request }: { request: VendorComplianceRequest }) => (
    <View style={styles.complianceCard}>
        <View style={styles.complianceHeader}>
            <View style={styles.complianceIcon}>
                <Ionicons name="alert-circle-outline" size={20} color="#c0661b" />
            </View>
            <View style={styles.complianceHeaderText}>
                <Text style={styles.complianceTitle}>Files Needed</Text>
                <Text style={styles.complianceMeta}>
                    {request.status.toUpperCase()}
                    {formatRequestDate(request.createdAt) ? ` • ${formatRequestDate(request.createdAt)}` : ''}
                </Text>
            </View>
        </View>

        {request.requestedRequirements.length > 0 ? (
            <View style={styles.requirementList}>
                {request.requestedRequirements.map((requirement) => (
                    <View style={styles.requirementRow} key={requirement}>
                        <Ionicons name="document-attach-outline" size={17} color="#2448a4" />
                        <Text style={styles.requirementText}>{requirement}</Text>
                    </View>
                ))}
            </View>
        ) : (
            <Text style={styles.emptyText}>No specific file names were listed.</Text>
        )}

        {request.note ? (
            <View style={styles.noteBox}>
                <Text style={styles.noteLabel}>Notes</Text>
                <Text style={styles.noteText}>{request.note}</Text>
            </View>
        ) : null}
    </View>
);

const PersonnelDetailRoute = () => {
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const { id } = useLocalSearchParams<{ id?: string | string[] }>();
    const personnelId = useMemo(
        () => (typeof id === 'string' ? id : Array.isArray(id) ? id[0] : ''),
        [id],
    );
    const [personnel, setPersonnel] = useState<PersonnelRecord | null>(null);
    const [complianceRequests, setComplianceRequests] = useState<VendorComplianceRequest[]>([]);
    const [pendingDocuments, setPendingDocuments] = useState<PersonnelDocument[]>([]);
    const [documentError, setDocumentError] = useState('');
    const [isUploadingDocuments, setUploadingDocuments] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    useEffect(() => {
        let isMounted = true;

        const hydratePersonnel = async () => {
            const savedPersonnel = await loadVendorApplications(currentUser?.businessOwnerId);
            const matched = savedPersonnel.find((entry) => entry.id === personnelId) ?? null;
            const requests = matched
                ? await loadVendorComplianceRequests(matched.vendorId)
                : [];

            if (isMounted) {
                setPersonnel(matched);
                setComplianceRequests(requests);
            }
        };

        hydratePersonnel();

        return () => {
            isMounted = false;
        };
    }, [currentUser?.businessOwnerId, personnelId]);

    const isPending = personnel?.status === 'pending approval';
    const isDefaultPersonnel = personnel?.createdAt === 0;
    const documents = personnel?.documents ?? [];
    const pendingComplianceRequests = complianceRequests.filter((request) => request.status === 'pending');

    const handleChooseDocuments = async () => {
        if (!personnel || isUploadingDocuments) {
            return;
        }

        const result = await DocumentPicker.getDocumentAsync({
            type: ['image/*', 'application/pdf'],
            multiple: true,
            copyToCacheDirectory: false,
        });

        if (result.canceled) {
            return;
        }

        const pickedDocuments = result.assets.map((asset) => ({
            name: asset.name,
            uri: asset.uri,
            mimeType: asset.mimeType,
            size: asset.size,
        }));

        setDocumentError('');
        setPendingDocuments((currentDocuments) => {
            const existingUris = new Set(currentDocuments.map((document) => document.uri));
            const nextDocuments = pickedDocuments.filter((document) => !existingUris.has(document.uri));

            return [...currentDocuments, ...nextDocuments];
        });
    };

    const handleRemovePendingDocument = (documentUri: string) => {
        if (isUploadingDocuments) {
            return;
        }

        setPendingDocuments((currentDocuments) => (
            currentDocuments.filter((document) => document.uri !== documentUri)
        ));
    };

    const handleSubmitDocuments = async () => {
        if (!personnel || pendingDocuments.length === 0 || isUploadingDocuments) {
            return;
        }

        setUploadingDocuments(true);
        setDocumentError('');

        const uploadResult = await submitVendorComplianceDocuments(
            personnel.vendorId,
            pendingDocuments,
            pendingComplianceRequests.map((request) => request.complianceRequestId),
        );

        setUploadingDocuments(false);

        if (uploadResult.error) {
            setDocumentError(uploadResult.error);
            return;
        }

        setPersonnel({
            ...personnel,
            documents: [...documents, ...uploadResult.documents],
        });
        setPendingDocuments([]);
        setComplianceRequests((currentRequests) => currentRequests.map((request) => (
            request.status === 'pending'
                ? {
                    ...request,
                    status: 'submitted',
                }
                : request
        )));
    };

    const deletePersonnel = async () => {
        if (!personnel || isDeleting || isDefaultPersonnel) {
            return;
        }

        setIsDeleting(true);
        setDeleteError('');

        const databaseResult = await deleteVendorApplication(personnel);

        if (!databaseResult.deleted) {
            setIsDeleting(false);
            setDeleteError(databaseResult.error ?? 'Unable to delete vendor application from the database.');
            return;
        }

        setIsDeleting(false);
        router.back();
    };

    const handleRemovePersonnel = () => {
        if (!personnel || isDefaultPersonnel) {
            return;
        }

        Alert.alert(
            'Remove Personnel',
            `Remove ${formatFullName(personnel)}? This will delete the pending vendor application and linked account from the database.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => {
                        void deletePersonnel();
                    },
                },
            ],
        );
    };

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
                            <Text style={styles.sectionTitle}>Vendor Application</Text>
                            <DetailRow icon="person-outline" label="Middle Initial" value={personnel.middleInitial} />
                            <DetailRow icon="call-outline" label="Phone Number" value={personnel.phoneNumber} />
                            <DetailRow icon="mail-outline" label="Email" value={personnel.email} />
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Compliance Request</Text>
                            {pendingComplianceRequests.length > 0 ? (
                                <View style={styles.complianceList}>
                                    {pendingComplianceRequests.map((request) => (
                                        <ComplianceRequestCard
                                            key={request.complianceRequestId}
                                            request={request}
                                        />
                                    ))}
                                </View>
                            ) : (
                                <Text style={styles.emptyText}>No missing files requested.</Text>
                            )}
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Submitted Documents</Text>
                            {pendingComplianceRequests.length > 0 ? (
                                <>
                                    <Pressable
                                        style={[styles.uploadButton, isUploadingDocuments ? styles.uploadButtonDisabled : null]}
                                        onPress={handleChooseDocuments}
                                        disabled={isUploadingDocuments}
                                    >
                                        <Ionicons name="attach-outline" size={18} color="#ffffff" />
                                        <Text style={styles.uploadButtonText}>
                                            {pendingDocuments.length > 0 ? 'Add More Files' : 'Choose Files'}
                                        </Text>
                                    </Pressable>
                                    {pendingDocuments.length > 0 ? (
                                        <View style={styles.pendingDocumentsWrap}>
                                            <Text style={styles.pendingDocumentsTitle}>Ready to submit</Text>
                                            {pendingDocuments.map((document) => (
                                                <PendingDocumentRow
                                                    key={document.uri}
                                                    document={document}
                                                    disabled={isUploadingDocuments}
                                                    onRemove={() => handleRemovePendingDocument(document.uri)}
                                                />
                                            ))}
                                            <Pressable
                                                style={[styles.submitFilesButton, isUploadingDocuments ? styles.uploadButtonDisabled : null]}
                                                onPress={handleSubmitDocuments}
                                                disabled={isUploadingDocuments}
                                            >
                                                <Ionicons name="cloud-upload-outline" size={18} color="#ffffff" />
                                                <Text style={styles.uploadButtonText}>
                                                    {isUploadingDocuments ? 'Submitting...' : 'Submit Files'}
                                                </Text>
                                            </Pressable>
                                        </View>
                                    ) : null}
                                </>
                            ) : null}
                            {documentError ? (
                                <Text style={styles.deleteError}>{documentError}</Text>
                            ) : null}
                            {documents.length > 0 ? (
                                <View style={styles.documentList}>
                                    {documents.map((document) => (
                                        <DocumentRow key={document.publicUrl ?? document.uri} document={document} />
                                    ))}
                                </View>
                            ) : (
                                <Text style={styles.emptyText}>No documents uploaded.</Text>
                            )}
                        </View>

                        {!isDefaultPersonnel ? (
                            <View style={styles.card}>
                                <Text style={styles.sectionTitle}>Personnel Access</Text>
                                <Text style={styles.warningText}>
                                    Removing this personnel deletes the pending vendor application and linked account from Supabase.
                                </Text>
                                {deleteError ? (
                                    <Text style={styles.deleteError}>{deleteError}</Text>
                                ) : null}
                                <Pressable
                                    style={[styles.removeButton, isDeleting ? styles.removeButtonDisabled : null]}
                                    onPress={handleRemovePersonnel}
                                    disabled={isDeleting}
                                >
                                    <Ionicons name="trash-outline" size={18} color="#ffffff" />
                                    <Text style={styles.removeButtonText}>
                                        {isDeleting ? 'Removing...' : 'Remove Personnel'}
                                    </Text>
                                </Pressable>
                            </View>
                        ) : null}
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
        marginTop: 10,
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
    removePendingButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#f8dedb',
        alignItems: 'center',
        justifyContent: 'center',
    },
    removePendingButtonDisabled: {
        opacity: 0.45,
    },
    uploadButton: {
        minHeight: 44,
        borderRadius: 12,
        backgroundColor: '#1f63e6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    uploadButtonDisabled: {
        backgroundColor: '#9bb4f1',
    },
    uploadButtonText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#ffffff',
    },
    pendingDocumentsWrap: {
        borderRadius: 14,
        backgroundColor: '#eef4ff',
        borderWidth: 1,
        borderColor: '#c7d7fb',
        padding: 10,
        marginBottom: 10,
        gap: 8,
    },
    pendingDocumentsTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#2448a4',
        textTransform: 'uppercase',
    },
    submitFilesButton: {
        minHeight: 44,
        borderRadius: 12,
        backgroundColor: '#2448a4',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 16,
        marginTop: 2,
    },
    complianceList: {
        gap: 10,
    },
    complianceCard: {
        borderRadius: 14,
        backgroundColor: '#fff7e8',
        borderWidth: 1,
        borderColor: '#f0d7aa',
        padding: 12,
    },
    complianceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    complianceIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#ffe8d4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    complianceHeaderText: {
        flex: 1,
        minWidth: 0,
    },
    complianceTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1f2630',
    },
    complianceMeta: {
        marginTop: 2,
        fontSize: 12,
        fontWeight: '800',
        color: '#c0661b',
    },
    requirementList: {
        marginTop: 10,
        gap: 8,
    },
    requirementRow: {
        minHeight: 34,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        paddingHorizontal: 10,
        paddingVertical: 7,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    requirementText: {
        flex: 1,
        minWidth: 0,
        fontSize: 15,
        fontWeight: '700',
        color: '#252a33',
    },
    noteBox: {
        marginTop: 10,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        padding: 10,
    },
    noteLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#7a808e',
        textTransform: 'uppercase',
    },
    noteText: {
        marginTop: 4,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '600',
        color: '#343944',
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
    warningText: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '600',
        color: '#6d7280',
    },
    deleteError: {
        marginTop: 10,
        fontSize: 13,
        fontWeight: '700',
        color: '#d85647',
    },
    removeButton: {
        marginTop: 14,
        minHeight: 44,
        borderRadius: 12,
        backgroundColor: '#d85647',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 16,
    },
    removeButtonDisabled: {
        backgroundColor: '#d99b94',
    },
    removeButtonText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#ffffff',
    },
});
