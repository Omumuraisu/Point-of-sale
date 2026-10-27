import fs from 'fs';
import path from 'path';

const readProjectFile = (relativePath: string): string => (
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
);

describe('POS email OTP delivery parity', () => {
    const verificationSource = readProjectFile('supabase/functions/start-pos-account-verification/index.ts');
    const developerTestSource = readProjectFile('supabase/functions/start-developer-activation-test/index.ts');
    const templateSubject = readProjectFile('supabase/email-templates/magic-link-or-otp-subject.txt');
    const templateBody = readProjectFile('supabase/email-templates/magic-link-or-otp.html');
    const signupTemplateSubject = readProjectFile('supabase/email-templates/confirm-sign-up-subject.txt');
    const signupTemplateBody = readProjectFile('supabase/email-templates/confirm-sign-up.html');

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

    test('the sign-in and activation email templates render an OTP for both MarketSync apps', () => {
        for (const template of [
            templateSubject,
            templateBody,
            signupTemplateSubject,
            signupTemplateBody,
        ]) {
            expect(template).toContain('https://marketsync.me/delivery/otp');
            expect(template).toContain('https://marketsync.me/pos/otp');
        }
        expect(templateBody).toContain('{{ .Token }}');
        expect(templateBody).toContain('{{ .ConfirmationURL }}');
        expect(signupTemplateBody).toContain('{{ .Token }}');
        expect(signupTemplateBody).toContain('{{ .ConfirmationURL }}');
    });
});

describe('channel-aware password completion', () => {
    const otpScreenSource = readProjectFile('src/app/activate-otp.tsx');
    const screenSource = readProjectFile('src/app/create-password.tsx');
    const flowSource = readProjectFile('src/lib/verificationFlow.tsx');
    const functionSource = readProjectFile('supabase/functions/complete-pos-account-password/index.ts');

    test('the app sends the verified channel to password completion', () => {
        expect(screenSource).toContain("body: { password, purpose: flow.purpose, channel: flow.channel }");
    });

    test('the verified OTP access token is preserved and sent explicitly to password completion', () => {
        expect(otpScreenSource).toContain('markOtpVerified(data.session.access_token)');
        expect(flowSource).toContain('verifiedAccessToken: accessToken');
        expect(screenSource).toContain('headers: { Authorization: `Bearer ${flow.verifiedAccessToken}` }');
    });

    test('the function validates the recent OTP and channel-specific account identifiers', () => {
        expect(functionSource).toContain('type VerificationChannel = "email" | "sms"');
        expect(functionSource).toContain('if (!hasRecentOtpAuthentication(token))');
        expect(functionSource).not.toContain('userData.user?.email_confirmed_at');
        expect(functionSource).not.toContain('userData.user?.phone_confirmed_at');
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
