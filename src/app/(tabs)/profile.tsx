import { useEffect, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    TextInput,
    Image,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useAuthSession, normalizePhoneNumber } from '../../lib/authSession';

const PROFILE_PHOTO_BUCKET = 'profile-pictures';

const splitDisplayName = (displayName: string) => {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? 'Unnamed';
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName;

    return {
        firstName,
        lastName,
    };
};

const getProfileIdColumn = (profileTable: 'business_owner' | 'vendor') => (
    profileTable === 'business_owner' ? 'business_owner_id' : 'vendor_id'
);

const getAssetExtension = (asset: ImagePicker.ImagePickerAsset) => {
    if (asset.fileName?.includes('.')) {
        return asset.fileName.split('.').pop()?.toLowerCase() ?? 'jpg';
    }

    if (asset.mimeType?.includes('/')) {
        return asset.mimeType.split('/').pop()?.toLowerCase() ?? 'jpg';
    }

    return 'jpg';
};

const Profile = () => {
    const router = useRouter();
    const { currentUser, updateCurrentUser } = useAuthSession();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [selectedPhoto, setSelectedPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setName(currentUser?.displayName ?? '');
        setPhone(currentUser?.phoneNumber ?? '');
        setSelectedPhoto(null);
    }, [currentUser]);

    const photoUri = selectedPhoto?.uri ?? currentUser?.profilePictureUrl ?? null;

    const handleUploadPhoto = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
            Alert.alert('Permission needed', 'Allow photo access to upload a profile picture.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setSelectedPhoto(result.assets[0]);
        }
    };

    const uploadSelectedPhoto = async () => {
        if (!selectedPhoto || !currentUser || !supabase) {
            return currentUser?.profilePictureUrl ?? null;
        }

        const extension = getAssetExtension(selectedPhoto);
        const contentType = selectedPhoto.mimeType ?? `image/${extension === 'jpg' ? 'jpeg' : extension}`;
        const path = `${currentUser.profileTable}/${currentUser.accountId}-${Date.now()}.${extension}`;
        const response = await fetch(selectedPhoto.uri);
        const arrayBuffer = await response.arrayBuffer();
        const { error } = await supabase.storage
            .from(PROFILE_PHOTO_BUCKET)
            .upload(path, arrayBuffer, {
                contentType,
                upsert: true,
            });

        if (error) {
            throw new Error(error.message);
        }

        const { data } = supabase.storage
            .from(PROFILE_PHOTO_BUCKET)
            .getPublicUrl(path);

        return data.publicUrl;
    };

    const handleSave = async () => {
        const trimmedName = name.trim();
        const normalizedPhone = normalizePhoneNumber(phone);

        if (!currentUser) {
            Alert.alert('No active session', 'Please log in again before editing your profile.');
            router.replace('/');
            return;
        }

        if (currentUser.profileTable === 'developer') {
            Alert.alert('Developer account', 'Developer accounts do not edit the selected business owner profile.');
            router.replace('/(tabs)/settings');
            return;
        }

        if (!trimmedName || !normalizedPhone) {
            Alert.alert('Missing details', 'Name and phone number are required.');
            return;
        }

        if (!isSupabaseConfigured || !supabase) {
            Alert.alert('Supabase unavailable', 'Supabase is not configured.');
            return;
        }

        setIsSaving(true);

        try {
            const profilePictureUrl = await uploadSelectedPhoto();
            const { firstName, lastName } = splitDisplayName(trimmedName);
            const profileIdColumn = getProfileIdColumn(currentUser.profileTable);

            const { error: accountError } = await supabase
                .from('accounts')
                .update({
                    phone_number: normalizedPhone,
                    updated_at: new Date().toISOString(),
                })
                .eq('account_id', currentUser.accountId);

            if (accountError) {
                throw new Error(accountError.message);
            }

            const { error: profileError } = await supabase
                .from(currentUser.profileTable)
                .update({
                    first_name: firstName,
                    middle_initial: 'NA',
                    last_name: lastName,
                    phone_number: normalizedPhone,
                    profile_picture_url: profilePictureUrl,
                })
                .eq(profileIdColumn, currentUser.profileId);

            if (profileError) {
                throw new Error(profileError.message);
            }

            await updateCurrentUser({
                displayName: trimmedName,
                phoneNumber: normalizedPhone,
                profilePictureUrl,
            });
            setSelectedPhoto(null);
            Alert.alert('Profile saved', 'Your profile has been updated.');
        } catch (error) {
            Alert.alert(
                'Unable to save profile',
                error instanceof Error ? error.message : 'Please try again.',
            );
        } finally {
            setIsSaving(false);
        }
    };

    if (currentUser?.profileTable === 'developer') {
        return <Redirect href="/(tabs)/settings" />;
    }

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={34} color="#272c33" />
                </Pressable>
                <Text style={styles.headerTitle}>Profile</Text>
            </View>

            <View style={styles.contentWrap}>
                <View style={styles.avatarOuter}>
                    <View style={styles.avatarInner}>
                        {photoUri ? (
                            <Image source={{ uri: photoUri }} style={styles.avatarImage} />
                        ) : (
                            <Ionicons name="person" size={86} color="#1f2730" />
                        )}
                    </View>
                </View>

                <View style={styles.formCard}>
                    <Text style={styles.sectionTitle}>Change Profile Picture</Text>
                    <Pressable style={styles.uploadBtn} onPress={handleUploadPhoto}>
                        <Text style={styles.uploadText}>Upload Photo</Text>
                    </Pressable>

                    <Text style={styles.sectionTitle}>Change Name</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Account name"
                        placeholderTextColor="#8f939c"
                    />

                    <Text style={styles.sectionTitle}>Change Phone Number</Text>
                    <TextInput
                        style={styles.input}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="Phone number"
                        placeholderTextColor="#8f939c"
                        keyboardType="phone-pad"
                    />

                    <View style={styles.saveRow}>
                        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
                            {isSaving ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <Text style={styles.saveText}>Save</Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
};

export default Profile;

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
    },
    header: {
        minHeight: 74,
        backgroundColor: '#f4f4f5',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#d7dae5',
    },
    backBtn: {
        marginRight: 10,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#20252c',
    },
    contentWrap: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 26,
        paddingHorizontal: 14,
    },
    avatarOuter: {
        width: 154,
        height: 154,
        borderRadius: 77,
        backgroundColor: '#a9beef',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    avatarInner: {
        width: 102,
        height: 102,
        borderRadius: 51,
        backgroundColor: '#212a33',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    formCard: {
        width: '100%',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#d0d4df',
        backgroundColor: '#f4f4f5',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 16,
        shadowColor: '#000000',
        shadowOpacity: 0.13,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 4,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 40 / 2,
        fontWeight: '800',
        color: '#252a32',
        marginTop: 8,
        marginBottom: 8,
    },
    uploadBtn: {
        alignSelf: 'flex-start',
        minWidth: 148,
        height: 42,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#6f737c',
        borderStyle: 'dashed',
        backgroundColor: '#d9d9d9',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 14,
    },
    uploadText: {
        fontSize: 30 / 2,
        fontWeight: '700',
        color: '#2a2f38',
    },
    input: {
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#b7bcc8',
        backgroundColor: '#f4f4f5',
        paddingHorizontal: 16,
        fontSize: 18,
        color: '#242a32',
        marginBottom: 8,
    },
    saveRow: {
        marginTop: 14,
        alignItems: 'flex-end',
    },
    saveBtn: {
        minWidth: 90,
        height: 42,
        borderRadius: 10,
        backgroundColor: '#2f5ada',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    saveText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#ffffff',
    },
});
