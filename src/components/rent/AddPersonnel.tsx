import { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { createVendorApplication, PersonnelDocument } from './personnelStore';
import { useAuthSession } from '../../lib/authSession';

const formatFileSize = (size?: number) => {
    if (!size || size < 1) {
        return '';
    }

    if (size < 1024 * 1024) {
        return `${Math.ceil(size / 1024)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const AddPersonnel = () => {
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const [firstName, setFirstName] = useState('');
    const [middleInitial, setMiddleInitial] = useState('');
    const [lastName, setLastName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [documents, setDocuments] = useState<PersonnelDocument[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [showValidation, setShowValidation] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const isFormValid = useMemo(() => (
        firstName.trim().length > 0
        && lastName.trim().length > 0
        && phoneNumber.trim().length > 0
    ), [firstName, lastName, phoneNumber]);

    const handleBack = () => {
        router.back();
    };

    const handleUploadDocuments = async () => {
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

        setDocuments((currentDocuments) => {
            const existingUris = new Set(currentDocuments.map((document) => document.uri));
            const nextDocuments = pickedDocuments.filter((document) => !existingUris.has(document.uri));

            return [...currentDocuments, ...nextDocuments];
        });
    };

    const handleSubmit = async () => {
        if (!isFormValid || isSaving) {
            setShowValidation(true);
            setSubmitError('');
            return;
        }

        setIsSaving(true);
        setShowValidation(false);
        setSubmitError('');

        const result = await createVendorApplication({
            businessOwnerId: currentUser?.businessOwnerId,
            firstName,
            middleInitial,
            lastName,
            phoneNumber,
            email: email.trim() ? email.trim() : undefined,
            documents,
        });

        setIsSaving(false);

        if (result.record) {
            if (__DEV__) {
                console.log('[VENDOR_DEBUG] Vendor application created', {
                    vendorId: result.record.vendorId,
                    accountId: result.record.accountId,
                    fullName: `${result.record.firstName} ${result.record.lastName}`.trim(),
                    status: result.record.status,
                });
            }

            router.back();
            return;
        }

        setSubmitError(result.error ?? 'Unable to create vendor application.');
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <KeyboardAvoidingView
                style={styles.screen}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.header}>
                    <Pressable onPress={handleBack} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="#2b2f36" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Add Personnel</Text>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.contentContainer}
                >
                    <View style={styles.card}>
                        <View style={styles.fieldBlock}>
                            <Text style={styles.label}>First Name</Text>
                            <TextInput
                                value={firstName}
                                onChangeText={setFirstName}
                                placeholder="Juan"
                                style={styles.input}
                                autoCapitalize="words"
                            />
                        </View>

                        <View style={styles.fieldBlock}>
                            <Text style={styles.label}>Middle Initial (optional)</Text>
                            <TextInput
                                value={middleInitial}
                                onChangeText={setMiddleInitial}
                                placeholder="T"
                                style={styles.input}
                                autoCapitalize="characters"
                                maxLength={1}
                            />
                        </View>

                        <View style={styles.fieldBlock}>
                            <Text style={styles.label}>Last Name</Text>
                            <TextInput
                                value={lastName}
                                onChangeText={setLastName}
                                placeholder="Dela Cruz"
                                style={styles.input}
                                autoCapitalize="words"
                            />
                        </View>

                        <View style={styles.fieldBlock}>
                            <Text style={styles.label}>Phone number</Text>
                            <TextInput
                                value={phoneNumber}
                                onChangeText={setPhoneNumber}
                                placeholder="0967 558 1256"
                                style={styles.input}
                                keyboardType="phone-pad"
                                inputMode="tel"
                            />
                        </View>

                        <View style={styles.fieldBlock}>
                            <Text style={styles.label}>Email (optional)</Text>
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder=""
                                style={styles.input}
                                keyboardType="email-address"
                                inputMode="email"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.fieldBlock}>
                            <Text style={styles.label}>Documents (optional)</Text>
                            <Pressable
                                style={styles.uploadButton}
                                onPress={handleUploadDocuments}
                                disabled={isSaving}
                            >
                                <Ionicons name="cloud-upload-outline" size={20} color="#1f63e6" />
                                <Text style={styles.uploadButtonText}>Upload Documents</Text>
                            </Pressable>

                            {documents.length > 0 ? (
                                <View style={styles.documentList}>
                                    {documents.map((document) => {
                                        const isPdf = document.mimeType === 'application/pdf'
                                            || document.name.toLowerCase().endsWith('.pdf');
                                        const fileSize = formatFileSize(document.size);

                                        return (
                                            <View style={styles.documentItem} key={document.uri}>
                                                <Ionicons
                                                    name={isPdf ? 'document-text-outline' : 'image-outline'}
                                                    size={20}
                                                    color="#4d5666"
                                                />
                                                <View style={styles.documentTextWrap}>
                                                    <Text style={styles.documentName} numberOfLines={1}>
                                                        {document.name}
                                                    </Text>
                                                    {fileSize ? (
                                                        <Text style={styles.documentMeta}>{fileSize}</Text>
                                                    ) : null}
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : null}
                        </View>

                        {showValidation && !isFormValid ? (
                            <Text style={styles.validationText}>Please fill out all required fields.</Text>
                        ) : null}

                        {submitError ? (
                            <Text style={styles.validationText}>{submitError}</Text>
                        ) : null}

                        <Pressable
                            style={[
                                styles.submitButton,
                                (!isFormValid || isSaving) ? styles.submitButtonDisabled : null,
                            ]}
                            onPress={handleSubmit}
                            disabled={!isFormValid || isSaving}
                        >
                            <Text style={styles.submitText}>{isSaving ? 'Saving...' : 'Submit'}</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default AddPersonnel;

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
    card: {
        borderRadius: 22,
        backgroundColor: '#ffffff',
        padding: 18,
        shadowColor: '#000000',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 6,
        elevation: 3,
    },
    fieldBlock: {
        marginBottom: 14,
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: '#2a2f38',
        marginBottom: 6,
    },
    input: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#d6dae4',
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: '#ffffff',
        fontSize: 15,
        color: '#1d2128',
    },
    inputPressable: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#d6dae4',
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#ffffff',
    },
    inputValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1d2128',
    },
    inputPlaceholder: {
        fontSize: 15,
        fontWeight: '500',
        color: '#9aa0ac',
    },
    uploadButton: {
        minHeight: 46,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#b9c9f5',
        backgroundColor: '#eef4ff',
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    uploadButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1f63e6',
    },
    documentList: {
        marginTop: 10,
        gap: 8,
    },
    documentItem: {
        minHeight: 44,
        borderRadius: 14,
        backgroundColor: '#f3f5fa',
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
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
    validationText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#d85647',
        marginBottom: 8,
    },
    submitButton: {
        alignSelf: 'center',
        marginTop: 8,
        borderRadius: 12,
        backgroundColor: '#1f63e6',
        paddingHorizontal: 22,
        paddingVertical: 10,
    },
    submitButtonDisabled: {
        backgroundColor: '#9bb4f1',
    },
    submitText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
    datePickerBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        justifyContent: 'flex-end',
    },
    datePickerCard: {
        backgroundColor: '#ffffff',
        paddingTop: 16,
        paddingHorizontal: 16,
        paddingBottom: 24,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
    },
    datePickerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1c2028',
        marginBottom: 8,
    },
    datePickerActions: {
        marginTop: 12,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    dateActionButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#eef0f6',
    },
    dateActionPrimary: {
        backgroundColor: '#1f63e6',
    },
    dateActionText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#2a2f38',
    },
    dateActionPrimaryText: {
        color: '#ffffff',
    },
});
