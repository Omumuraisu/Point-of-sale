export interface SupabaseClientConfig {
    url: string;
    publishableKey: string;
}

export interface SupabaseClientConfigInput {
    url?: string | null;
    publishableKey?: string | null;
}

export interface SupabaseClientConfigResolution {
    config: SupabaseClientConfig | null;
    error: string | null;
}

// These are public client credentials. Authorization must continue to be enforced
// by Supabase Row Level Security. Never add a service-role or secret key here.
export const bundledSupabaseConfig: SupabaseClientConfig = {
    url: "https://ewmqavepknleeytzgwjz.supabase.co",
    publishableKey: "sb_publishable_4NOakmySL62TpMYR29l-yQ_Q-2Tkm4S",
};

const normalizedValue = (value: string | null | undefined) => value?.trim() || '';

const isValidSupabaseUrl = (value: string) => {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && Boolean(url.hostname);
    } catch {
        return false;
    }
};

export const resolveSupabaseClientConfig = (
    environment: SupabaseClientConfigInput,
    fallback: SupabaseClientConfigInput = bundledSupabaseConfig,
): SupabaseClientConfigResolution => {
    const url = normalizedValue(environment.url) || normalizedValue(fallback.url);
    const publishableKey = normalizedValue(environment.publishableKey) || normalizedValue(fallback.publishableKey);
    const errors: string[] = [];

    if (!url) {
        errors.push('EXPO_PUBLIC_SUPABASE_URL is missing');
    } else if (!isValidSupabaseUrl(url)) {
        errors.push('EXPO_PUBLIC_SUPABASE_URL must be a valid HTTPS URL');
    }

    if (!publishableKey) {
        errors.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing');
    } else if (publishableKey.startsWith('sb_secret_')) {
        errors.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must not contain a Supabase secret key');
    }

    if (errors.length > 0) {
        return {
            config: null,
            error: `Supabase configuration error: ${errors.join('; ')}.`,
        };
    }

    return {
        config: { url, publishableKey },
        error: null,
    };
};
