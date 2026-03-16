import { useState } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const Profile = () => {
    const router = useRouter();
    const [name, setName] = useState('Mika Bini');
    const [phone, setPhone] = useState('0967 558 1256');

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
                        <Ionicons name="person" size={86} color="#1f2730" />
                    </View>
                </View>

                <View style={styles.formCard}>
                    <Text style={styles.sectionTitle}>Change Profile Picture</Text>
                    <Pressable style={styles.uploadBtn}>
                        <Text style={styles.uploadText}>Upload Photo</Text>
                    </Pressable>

                    <Text style={styles.sectionTitle}>Change Name</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Mika Bini"
                        placeholderTextColor="#8f939c"
                    />

                    <Text style={styles.sectionTitle}>Change Phone Number</Text>
                    <TextInput
                        style={styles.input}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="0967 558 1256"
                        placeholderTextColor="#8f939c"
                        keyboardType="phone-pad"
                    />

                    <View style={styles.saveRow}>
                        <Pressable style={styles.saveBtn}>
                            <Text style={styles.saveText}>Save</Text>
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
