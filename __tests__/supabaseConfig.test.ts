import { resolveSupabaseClientConfig } from '../src/lib/supabaseConfig';

const bundledConfig = {
    url: 'https://bundled-project.supabase.co',
    publishableKey: 'bundled-publishable-key',
};

describe('Supabase client configuration', () => {
    test('uses trimmed environment overrides when both are present', () => {
        expect(resolveSupabaseClientConfig({
            url: '  https://override-project.supabase.co  ',
            publishableKey: '  override-publishable-key  ',
        }, bundledConfig)).toEqual({
            config: {
                url: 'https://override-project.supabase.co',
                publishableKey: 'override-publishable-key',
            },
            error: null,
        });
    });

    test('falls back per value when environment overrides are blank', () => {
        expect(resolveSupabaseClientConfig({
            url: '   ',
            publishableKey: undefined,
        }, bundledConfig)).toEqual({
            config: bundledConfig,
            error: null,
        });
    });

    test('reports missing settings when no configuration is available', () => {
        const result = resolveSupabaseClientConfig({}, {});

        expect(result.config).toBeNull();
        expect(result.error).toContain('EXPO_PUBLIC_SUPABASE_URL is missing');
        expect(result.error).toContain('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing');
    });

    test('rejects malformed URLs and secret server keys', () => {
        const result = resolveSupabaseClientConfig({
            url: 'not-a-url',
            publishableKey: 'sb_secret_do-not-embed',
        }, {});

        expect(result.config).toBeNull();
        expect(result.error).toContain('EXPO_PUBLIC_SUPABASE_URL must be a valid HTTPS URL');
        expect(result.error).toContain('must not contain a Supabase secret key');
    });
});
