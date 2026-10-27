import { useEffect, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    Image,
    Alert,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useAuthSession } from '../../lib/authSession';
import {
    PROFILE_PHOTO_BUCKET,
    PROFILE_PHOTO_MAX_BYTES,
    addProfilePhotoCacheBuster,
    getProfilePhotoPath,
    validateProfilePhoto,
} from '../../lib/profilePhoto';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { getUserRoleLabel } from '../../lib/userRole';

const Profile = () => {
    const styles = useThemedStyles(baseStyles);
    const { colors } = useTheme();
    const router = useRouter();
    const { session, currentUser, updateCurrentUser } = useAuthSession();
    const [selectedPhoto, setSelectedPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [removePhoto, setRemovePhoto] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setSelectedPhoto(null);
        setRemovePhoto(false);
    }, [currentUser]);

    const photoUri = selectedPhoto?.uri ?? (removePhoto ? null : currentUser?.profilePictureUrl) ?? null;

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
            const asset = result.assets[0];
            const validationError = validateProfilePhoto(asset);
            if (validationError) {
                Alert.alert('Unsupported photo', validationError);
                return;
            }
            setSelectedPhoto(asset);
            setRemovePhoto(false);
        }
    };

    const handleRemovePhoto = () => {
        setSelectedPhoto(null);
        setRemovePhoto(true);
    };

    const uploadSelectedPhoto = async () => {
        if (!selectedPhoto) {
            return currentUser?.profilePictureUrl ?? null;
        }
        if (!currentUser || !supabase || !session?.user.id) {
            throw new Error('Your session has expired. Please sign in again.');
        }

        const validationError = validateProfilePhoto(selectedPhoto);
        if (validationError) throw new Error(validationError);

        const contentType = selectedPhoto.mimeType!;
        const path = getProfilePhotoPath(session.user.id);
        const response = await fetch(selectedPhoto.uri);
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > PROFILE_PHOTO_MAX_BYTES) {
            throw new Error('Profile picture must be 3 MB or smaller.');
        }
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

        return addProfilePhotoCacheBuster(data.publicUrl);
    };

    const handleSave = async () => {
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

        if (!isSupabaseConfigured || !supabase) {
            Alert.alert('Supabase unavailable', 'Supabase is not configured.');
            return;
        }

        setIsSaving(true);

        try {
            const profilePictureUrl = removePhoto ? '' : await uploadSelectedPhoto();
            const { error: profileError } = await supabase.rpc('update_my_pos_profile_photo', {
                p_profile_picture_url: removePhoto ? null : profilePictureUrl,
            });

            if (profileError) {
                throw new Error(profileError.message);
            }

            if (removePhoto && session?.user.id) {
                const { error: removeError } = await supabase.storage
                    .from(PROFILE_PHOTO_BUCKET)
                    .remove([getProfilePhotoPath(session.user.id)]);
                if (removeError) throw new Error(removeError.message);
            }

            await updateCurrentUser({
                profilePictureUrl: removePhoto ? null : profilePictureUrl,
            });
            setSelectedPhoto(null);
            setRemovePhoto(false);
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

    const isDeveloper = currentUser?.profileTable === 'developer';
    const email = currentUser?.email?.trim() ?? '';

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={34} color={colors.icon} />
                </Pressable>
                <Text style={styles.headerTitle}>Profile</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.contentWrap}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.avatarOuter}>
                    <View style={styles.avatarInner}>
                        {photoUri ? (
                            <Image source={{ uri: photoUri }} style={styles.avatarImage} />
                        ) : (
                            <Ionicons name="person" size={86} color={colors.icon} />
                        )}
                    </View>
                </View>

                <View style={styles.formCard}>
                    <Text style={styles.sectionTitle}>{isDeveloper ? 'Profile Picture' : 'Change Profile Picture'}</Text>
                    {!isDeveloper ? (
                        <>
                            <Pressable style={styles.uploadBtn} onPress={handleUploadPhoto}>
                                <Text style={styles.uploadText}>{photoUri ? 'Replace Photo' : 'Upload Photo'}</Text>
                            </Pressable>
                            {photoUri ? (
                                <Pressable style={styles.removeBtn} onPress={handleRemovePhoto}>
                                    <Text style={styles.removeText}>Remove Photo</Text>
                                </Pressable>
                            ) : null}
                        </>
                    ) : null}

                    <Text style={styles.sectionTitle}>Account Details</Text>
                    <View style={styles.detailRow}>
                        <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
                        <View style={styles.detailTextWrap}>
                            <Text style={styles.detailLabel}>Name</Text>
                            <Text style={styles.detailValue}>{currentUser?.displayName ?? 'Unavailable'}</Text>
                        </View>
                    </View>
                    <View style={styles.detailRow}>
                        <Ionicons name="id-card-outline" size={20} color={colors.textSecondary} />
                        <View style={styles.detailTextWrap}>
                            <Text style={styles.detailLabel}>Role</Text>
                            <Text style={styles.detailValue}>
                                {currentUser ? getUserRoleLabel(currentUser.profileTable) : 'Unavailable'}
                            </Text>
                        </View>
                    </View>
                    {email ? (
                        <View style={styles.detailRow}>
                            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
                            <View style={styles.detailTextWrap}>
                                <Text style={styles.detailLabel}>Email</Text>
                                <Text style={styles.detailValue}>{email}</Text>
                            </View>
                        </View>
                    ) : null}
                    <View style={styles.detailRow}>
                        <Ionicons name="storefront-outline" size={20} color={colors.textSecondary} />
                        <View style={styles.detailTextWrap}>
                            <Text style={styles.detailLabel}>Business</Text>
                            <Text style={styles.detailValue}>
                                {currentUser?.businessName?.trim() || 'No business assigned'}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.detailRow}>
                        <Ionicons name="call-outline" size={20} color={colors.textSecondary} />
                        <View style={styles.detailTextWrap}>
                            <Text style={styles.detailLabel}>Verified Phone Number</Text>
                            <Text style={styles.detailValue}>
                                {currentUser?.phoneNumber ?? 'No verified phone number'}
                            </Text>
                        </View>
                    </View>

                    {!isDeveloper ? (
                        <View style={styles.saveRow}>
                            <Pressable style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
                                {isSaving ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <Text style={styles.saveText}>Save Picture</Text>
                                )}
                            </Pressable>
                        </View>
                    ) : null}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default Profile;

const baseStyles = StyleSheet.create({
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
        flexGrow: 1,
        alignItems: 'center',
        paddingTop: 26,
        paddingHorizontal: 14,
        paddingBottom: 28,
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
    removeBtn: {
        alignSelf: 'flex-start',
        marginTop: 8,
        paddingVertical: 7,
        paddingHorizontal: 4,
    },
    removeText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#c23934',
    },
    detailRow: {
        minHeight: 58,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#c5c9d3',
        backgroundColor: '#e5e7ed',
        paddingHorizontal: 14,
        paddingVertical: 9,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    detailTextWrap: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#7d818b',
    },
    detailValue: {
        marginTop: 2,
        fontSize: 16,
        fontWeight: '700',
        color: '#565d69',
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
