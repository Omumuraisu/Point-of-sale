import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { resolveSupabaseClientConfig } from './supabaseConfig';

const configResolution = resolveSupabaseClientConfig({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

export const supabaseConfigurationError = configResolution.error;
export const isSupabaseConfigured = configResolution.config !== null;

export const supabase = configResolution.config
    ? createClient(configResolution.config.url, configResolution.config.publishableKey, {
        auth: {
            ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    })
    : null;

if (supabase && Platform.OS !== 'web') {
    AppState.addEventListener('change', (state) => {
        if (state === 'active') {
            supabase.auth.startAutoRefresh();
        } else {
            supabase.auth.stopAutoRefresh();
        }
    });
}
