import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { normalizePhilippinePhone } from './authFlow';
import { isSupabaseConfigured, supabase } from './supabase';

const CURRENT_USER_KEY = '@auth/current-user';

export type ProfileTable = 'business_owner' | 'vendor' | 'developer';

export interface CurrentUser {
    accountId: number;
    phoneNumber: string;
    userType: string;
    displayName: string;
    profileTable: ProfileTable;
    profileId: number | null;
    businessOwnerId: number | null;
    businessId: number | null;
    businessName: string | null;
    stallId: string | null;
    stallNumber: string | null;
    profilePictureUrl: string | null;
}

interface PosProfileRow {
    account_id: number;
    auth_user_id: string;
    user_type: string;
    username: string | null;
    email: string | null;
    profile_table: ProfileTable;
    profile_id: number | null;
    business_owner_id: number | null;
    first_name: string | null;
    middle_initial: string | null;
    last_name: string | null;
    phone_number: string;
    profile_picture_url: string | null;
}

interface BusinessRow {
    business_id: number;
    business_owner_id: number;
    business_name: string | null;
    stall_id: string | null;
    stall_number: string | null;
    stall_no: string | null;
}

interface StallRow {
    stall_id: string | null;
    stall_number: string;
}

interface AuthResult {
    user: CurrentUser | null;
    error?: string;
}

interface AuthSessionContextValue {
    session: Session | null;
    currentUser: CurrentUser | null;
    isHydrating: boolean;
    isAuthenticated: boolean;
    loginWithPassword: (phoneNumber: string, password: string) => Promise<AuthResult>;
    refreshProfile: () => Promise<CurrentUser | null>;
    selectDeveloperBusiness: (businessId: number) => Promise<AuthResult>;
    logout: () => Promise<void>;
    updateCurrentUser: (updates: Partial<CurrentUser>) => Promise<void>;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);
export const normalizePhoneNumber = normalizePhilippinePhone;

const buildDisplayName = (profile: PosProfileRow): string => {
    if (profile.profile_table === 'developer') {
        return profile.username?.trim() || profile.email?.split('@')[0] || 'Developer';
    }
    const middle = profile.middle_initial?.trim();
    const meaningfulMiddle = middle && middle.toUpperCase() !== 'NA' ? middle : '';
    return [profile.first_name, meaningfulMiddle, profile.last_name]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(' ') || 'Unnamed Account';
};

const persistCurrentUser = async (user: CurrentUser | null) => {
    if (!user) {
        await AsyncStorage.removeItem(CURRENT_USER_KEY);
        return;
    }
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
};

const parseStoredUser = (value: string | null): CurrentUser | null => {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value) as CurrentUser;
        if (
            typeof parsed.accountId === 'number'
            && typeof parsed.phoneNumber === 'string'
            && typeof parsed.userType === 'string'
            && typeof parsed.displayName === 'string'
            && ['business_owner', 'vendor', 'developer'].includes(parsed.profileTable)
        ) return parsed;
    } catch {
        return null;
    }
    return null;
};

const resolveBusinessContext = async (businessOwnerId: number) => {
    if (!supabase) return { business: null, resolvedStallId: null };
    const { data: business } = await supabase
        .from('business')
        .select('business_id, business_owner_id, business_name, stall_id, stall_number, stall_no')
        .eq('business_owner_id', businessOwnerId)
        .order('business_id', { ascending: true })
        .limit(1)
        .maybeSingle<BusinessRow>();
    let resolvedStallId = business?.stall_id ?? null;
    const stallNumber = business?.stall_number ?? business?.stall_no ?? null;
    if (!resolvedStallId && stallNumber) {
        const { data: stall } = await supabase.from('stalls')
            .select('stall_id, stall_number').eq('stall_number', stallNumber).maybeSingle<StallRow>();
        resolvedStallId = stall?.stall_id ?? stallNumber;
    }
    return { business: business ?? null, resolvedStallId };
};

const resolveBusinessById = async (businessId: number) => {
    if (!supabase) return { business: null, resolvedStallId: null, error: 'Supabase is not configured.' };
    const { data: business, error } = await supabase.from('business')
        .select('business_id, business_owner_id, business_name, stall_id, stall_number, stall_no')
        .eq('business_id', businessId).maybeSingle<BusinessRow>();
    if (error || !business) {
        return { business: null, resolvedStallId: null, error: error?.message ?? 'The selected business is no longer available.' };
    }
    let resolvedStallId = business.stall_id ?? null;
    const stallNumber = business.stall_number ?? business.stall_no ?? null;
    if (!resolvedStallId && stallNumber) {
        const { data: stall } = await supabase.from('stalls')
            .select('stall_id, stall_number').eq('stall_number', stallNumber).maybeSingle<StallRow>();
        resolvedStallId = stall?.stall_id ?? stallNumber;
    }
    if (!resolvedStallId) return { business: null, resolvedStallId: null, error: 'The selected business has no assigned stall.' };
    return { business, resolvedStallId, error: undefined };
};

const loadAuthenticatedUser = async (): Promise<CurrentUser | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('get_my_pos_profile');
    const profile = (Array.isArray(data) ? data[0] : data) as PosProfileRow | null;
    if (error || !profile) return null;
    const stored = parseStoredUser(await AsyncStorage.getItem(CURRENT_USER_KEY));

    if (profile.profile_table === 'developer') {
        const sameStoredUser = stored?.accountId === profile.account_id ? stored : null;
        const user: CurrentUser = {
            accountId: profile.account_id,
            phoneNumber: profile.phone_number,
            userType: profile.user_type,
            displayName: buildDisplayName(profile),
            profileTable: 'developer',
            profileId: null,
            businessOwnerId: sameStoredUser?.businessOwnerId ?? null,
            businessId: sameStoredUser?.businessId ?? null,
            businessName: sameStoredUser?.businessName ?? null,
            stallId: sameStoredUser?.stallId ?? null,
            stallNumber: sameStoredUser?.stallNumber ?? null,
            profilePictureUrl: profile.profile_picture_url,
        };
        await persistCurrentUser(user);
        return user;
    }

    if (!profile.business_owner_id) return null;
    const { business, resolvedStallId } = await resolveBusinessContext(profile.business_owner_id);
    const user: CurrentUser = {
        accountId: profile.account_id,
        phoneNumber: profile.phone_number,
        userType: profile.user_type,
        displayName: buildDisplayName(profile),
        profileTable: profile.profile_table,
        profileId: profile.profile_id,
        businessOwnerId: profile.business_owner_id,
        businessId: business?.business_id ?? null,
        businessName: business?.business_name ?? null,
        stallId: resolvedStallId ?? business?.stall_id ?? null,
        stallNumber: business?.stall_number ?? business?.stall_no ?? null,
        profilePictureUrl: profile.profile_picture_url,
    };
    await persistCurrentUser(user);
    return user;
};

export const AuthSessionProvider = ({ children }: { children: ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [isHydrating, setIsHydrating] = useState(true);

    const refreshProfile = useCallback(async () => {
        const user = await loadAuthenticatedUser();
        setCurrentUser(user);
        return user;
    }, []);

    useEffect(() => {
        let active = true;
        const hydrate = async () => {
            if (!supabase) {
                if (active) setIsHydrating(false);
                return;
            }
            const { data } = await supabase.auth.getSession();
            if (!active) return;
            setSession(data.session);
            if (data.session) {
                const user = await loadAuthenticatedUser();
                if (active) setCurrentUser(user);
            } else {
                await persistCurrentUser(null);
            }
            if (active) setIsHydrating(false);
        };
        void hydrate();

        const subscription = supabase?.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
            setTimeout(() => {
                if (nextSession) void refreshProfile();
                else {
                    setCurrentUser(null);
                    void persistCurrentUser(null);
                }
            }, 0);
        });
        return () => {
            active = false;
            subscription?.data.subscription.unsubscribe();
        };
    }, [refreshProfile]);

    const loginWithPassword = useCallback(async (phoneNumber: string, password: string): Promise<AuthResult> => {
        const phone = normalizePhilippinePhone(phoneNumber);
        if (!phone) return { user: null, error: 'Enter a valid Philippine mobile number.' };
        if (!password) return { user: null, error: 'Enter your password to continue.' };
        if (!isSupabaseConfigured || !supabase) return { user: null, error: 'Supabase is not configured.' };

        const { data, error } = await supabase.auth.signInWithPassword({ phone, password });
        if (error || !data.session) return { user: null, error: 'Invalid phone number or password.' };
        const user = await loadAuthenticatedUser();
        if (!user) {
            await supabase.auth.signOut();
            return { user: null, error: 'This account is not active for the POS app.' };
        }
        setSession(data.session);
        setCurrentUser(user);
        return { user };
    }, []);

    const selectDeveloperBusiness = useCallback(async (businessId: number): Promise<AuthResult> => {
        if (!currentUser || currentUser.profileTable !== 'developer') return { user: null, error: 'Only developer accounts can select a business.' };
        if (!Number.isFinite(businessId) || businessId <= 0) return { user: null, error: 'Select a valid business.' };
        const { business, resolvedStallId, error } = await resolveBusinessById(businessId);
        if (error || !business || !resolvedStallId) return { user: null, error: error ?? 'Unable to load the selected business.' };
        const user: CurrentUser = {
            ...currentUser,
            businessOwnerId: business.business_owner_id,
            businessId: business.business_id,
            businessName: business.business_name,
            stallId: resolvedStallId,
            stallNumber: business.stall_number ?? business.stall_no ?? null,
        };
        setCurrentUser(user);
        await persistCurrentUser(user);
        return { user };
    }, [currentUser]);

    const logout = useCallback(async () => {
        await supabase?.auth.signOut();
        setSession(null);
        setCurrentUser(null);
        await persistCurrentUser(null);
    }, []);

    const updateCurrentUser = useCallback(async (updates: Partial<CurrentUser>) => {
        setCurrentUser((previous) => {
            if (!previous) return previous;
            const next = { ...previous, ...updates };
            void persistCurrentUser(next);
            return next;
        });
    }, []);

    const value = useMemo<AuthSessionContextValue>(() => ({
        session,
        currentUser,
        isHydrating,
        isAuthenticated: Boolean(session && currentUser),
        loginWithPassword,
        refreshProfile,
        selectDeveloperBusiness,
        logout,
        updateCurrentUser,
    }), [session, currentUser, isHydrating, loginWithPassword, refreshProfile, selectDeveloperBusiness, logout, updateCurrentUser]);

    return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
};

export const useAuthSession = () => {
    const context = useContext(AuthSessionContext);
    if (!context) throw new Error('useAuthSession must be used within AuthSessionProvider');
    return context;
};
