import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
        paddingHorizontal: 18,
        paddingTop: 24,
    },

    // Header
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 16,
        marginBottom: 34,
    },
    logoCircle: {
        width: 78,
        height: 78,
        borderRadius: 39,
        backgroundColor: '#2f5ada',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontWeight: '800',
        fontSize: 36 / 2,
        color: '#151a22',
    },
    headerSub: {
        fontSize: 15,
        color: '#30343a',
        marginTop: 2,
    },

    // Greet
    greetContainer: {
        marginBottom: 20,
    },
    greetTitle: {
        fontSize: 50 / 2,
        fontWeight: '800',
        color: '#10151c',
    },
    greetSub: {
        fontSize: 27 / 2,
        color: '#4a4f57',
        marginTop: 6,
    },

    // Form card
    formCard: {
        backgroundColor: '#2f5ada',
        borderRadius: 24,
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 18,
        shadowColor: '#000000',
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 6,
        elevation: 4,
    },
    label: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 32 / 2,
        marginBottom: 8,
    },
    inputWrapper: {
        backgroundColor: '#f0f0f0',
        borderRadius: 50,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        marginBottom: 18,
        height: 48,
        gap: 10,
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: '#333',
    },
    forgotRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        marginTop: -6,
    },
    forgotLink: {
        color: '#d8e1ff',
        fontSize: 13,
        textDecorationLine: 'underline',
    },
    loginBtn: {
        backgroundColor: '#e7e3d8',
        borderRadius: 50,
        height: 52,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loginBtnText: {
        fontSize: 17,
        fontWeight: '800',
        color: '#244eb7',
    },
});
