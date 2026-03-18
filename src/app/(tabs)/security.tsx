import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const Security = () => {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={34} color="#272c33" />
                </Pressable>
                <Text style={styles.headerTitle}>Security</Text>
            </View>

            <View style={styles.contentWrap}>
                <View style={styles.formCard}>
                    <Text style={styles.sectionTitle}>Change Password</Text>
                    <TextInput
                        style={styles.input}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="Enter new password"
                        placeholderTextColor="#8f939c"
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <Text style={styles.sectionTitle}>Confirm Password</Text>
                    <TextInput
                        style={styles.input}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirm password"
                        placeholderTextColor="#8f939c"
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
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

export default Security;

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
        paddingTop: 36,
        paddingHorizontal: 14,
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
