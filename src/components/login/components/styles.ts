import { StyleSheet } from 'react-native';

const BLUE = '#1f61e8';
const NAVY = '#0b43a0';
const BACKGROUND = '#f0f2ff';

export const styles = StyleSheet.create({
    welcomeScreen: { flex: 1, backgroundColor: BACKGROUND, paddingHorizontal: 36 },
    brandArea: { height: '62%', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 45 },
    mainLogo: { width: '86%', height: 215 },
    welcomeActions: { gap: 20 },
    primaryButton: {
        height: 49, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: BLUE,
        shadowColor: '#000', shadowOpacity: 0.22, shadowOffset: { width: 0, height: 3 }, shadowRadius: 3, elevation: 4,
    },
    primaryButtonText: { color: '#fff', fontSize: 20, fontWeight: '800' },
    secondaryButton: {
        height: 49, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
        shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 3 }, shadowRadius: 3, elevation: 4,
    },
    secondaryButtonText: { color: NAVY, fontSize: 20, fontWeight: '800' },
    welcomeFooter: { color: '#898989', fontSize: 12, textAlign: 'center', marginTop: 'auto', marginBottom: 12 },
    formScreen: { flex: 1, backgroundColor: BACKGROUND },
    formIntro: { paddingHorizontal: 20, paddingTop: 105, paddingBottom: 32 },
    horizontalLogo: { width: '100%', height: 76, marginBottom: 28 },
    greetTitle: { fontSize: 25, lineHeight: 31, fontWeight: '800', color: '#090909' },
    greetSub: { fontSize: 14, color: '#202020', marginTop: 3 },
    formCard: {
        flex: 1, minHeight: 445, backgroundColor: BLUE, borderTopLeftRadius: 50, borderTopRightRadius: 50,
        paddingHorizontal: 32, paddingTop: 36, paddingBottom: 38,
    },
    label: { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 12 },
    inputWrapper: {
        backgroundColor: '#fbfbfb', borderRadius: 28, flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, marginBottom: 32, height: 49, gap: 10,
    },
    input: { flex: 1, fontSize: 13, color: '#333' },
    forgotRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: -19, marginBottom: 28 },
    forgotLink: { color: '#edf2ff', fontSize: 13, textDecorationLine: 'underline' },
    loginBtn: { backgroundColor: '#f8f4f4', borderRadius: 28, height: 49, justifyContent: 'center', alignItems: 'center' },
    loginBtnText: { fontSize: 20, fontWeight: '800', color: NAVY },
    errorText: { marginTop: 12, color: '#ffe5e5', fontSize: 13, fontWeight: '700', textAlign: 'center' },
    formFooter: { color: '#fff', fontSize: 12, textAlign: 'center', marginTop: 'auto' },
});
