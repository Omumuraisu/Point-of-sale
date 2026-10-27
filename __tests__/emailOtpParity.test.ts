import fs from 'fs';
import path from 'path';

const readProjectFile = (relativePath: string): string => (
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
);

describe('POS email OTP delivery parity', () => {
    const verificationSource = readProjectFile('supabase/functions/start-pos-account-verification/index.ts');
    const developerTestSource = readProjectFile('supabase/functions/start-developer-activation-test/index.ts');

    test.each([
        ['account verification', verificationSource],
        ['developer activation test', developerTestSource],
    ])('%s uses the POS-specific email template marker', (_name, source) => {
        expect(source).toContain('const POS_EMAIL_REDIRECT_TO = "https://marketsync.me/pos/otp"');
        expect(source).toContain('emailRedirectTo: POS_EMAIL_REDIRECT_TO');
    });

    test('SMS OTP dispatch remains on the SMS channel', () => {
        expect(verificationSource).toContain('options: { channel: "sms", shouldCreateUser: false }');
        expect(developerTestSource).toContain('options: { channel: "sms", shouldCreateUser: false }');
    });
});

describe('channel-aware password completion', () => {
    const screenSource = readProjectFile('src/app/create-password.tsx');
    const functionSource = readProjectFile('supabase/functions/complete-pos-account-password/index.ts');

    test('the app sends the verified channel to password completion', () => {
        expect(screenSource).toContain("body: { password, purpose: flow.purpose, channel: flow.channel }");
    });

    test('the function validates channel-specific confirmation and account identifiers', () => {
        expect(functionSource).toContain('type VerificationChannel = "email" | "sms"');
        expect(functionSource).toContain('Boolean(userData.user?.email_confirmed_at)');
        expect(functionSource).toContain('Boolean(userData.user?.phone_confirmed_at)');
        expect(functionSource).toContain('const identifierMatches = channel === null || accountIdentifier === verifiedIdentifier');
    });

    test('omitted channels remain compatible while explicit invalid values are rejected', () => {
        expect(functionSource).toContain('const channelProvided = input.channel !== undefined');
        expect(functionSource).toContain('(channelProvided && !channel)');
        expect(functionSource).toContain('Invalid verification channel');
    });
});

describe('Settings password-change verification choices', () => {
    const securitySource = readProjectFile('src/app/(tabs)/security.tsx');
    const settingsSource = readProjectFile('src/app/(tabs)/settings.tsx');

    test('offers email and SMS OTP as explicit choices', () => {
        expect(securitySource).toContain('<Text style={styles.phoneLabel}>Email OTP</Text>');
        expect(securitySource).toContain('<Text style={styles.phoneLabel}>SMS OTP</Text>');
        expect(settingsSource).toContain("subtitle: 'Change password with email or SMS OTP'");
    });

    test('uses the authenticated email when an older cached POS profile has none', () => {
        expect(securitySource).toContain("currentUser?.email || session?.user.email || ''");
    });

    test('keeps unavailable verification methods visible but disabled', () => {
        expect(securitySource).toContain('disabled={isSubmitting || !normalizedEmail}');
        expect(securitySource).toContain('disabled={isSubmitting || !normalizedPhone}');
        expect(securitySource).toContain('!normalizedEmail && styles.contactCardUnavailable');
        expect(securitySource).toContain('!normalizedPhone && styles.contactCardUnavailable');
    });
});
