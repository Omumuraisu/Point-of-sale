import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

import { isSupabaseConfigured, supabase } from './supabase';

const CURRENT_USER_KEY = '@auth/current-user';

export type ProfileTable = 'business_owner' | 'vendor' | 'developer';
type DatabaseProfileTable = Exclude<ProfileTable, 'developer'>;

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

interface AccountRow {
    account_id: number;
    phone_number: string | null;
    email?: string | null;
    username?: string | null;
    user_type: string;
    status: string;
}

interface ProfileRow {
    business_owner_id?: number;
    vendor_id?: number;
    account_id?: number;
    first_name: string | null;
    middle_initial: string | null;
    last_name: string | null;
    phone_number: string | null;
    profile_picture_url: string | null;
}

interface VendorProfileRow extends ProfileRow {
    business_owner_id: number;
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

interface AuthSessionContextValue {
    currentUser: CurrentUser | null;
    isHydrating: boolean;
    loginWithPhone: (phoneNumber: string) => Promise<{ user: CurrentUser | null; error?: string }>;
    selectDeveloperBusiness: (businessId: number) => Promise<{ user: CurrentUser | null; error?: string }>;
    logout: () => Promise<void>;
    updateCurrentUser: (updates: Partial<CurrentUser>) => Promise<void>;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export const normalizePhoneNumber = (phoneNumber: string): string => (
    phoneNumber.replace(/[\s-]/g, '').trim()
);

const normalizeUserType = (userType: string): string => userType.toLowerCase().trim();

const isDeveloperUserType = (userType: string): boolean => normalizeUserType(userType) === 'developer';

const getProfileTableForUserType = (userType: string): DatabaseProfileTable | null => {
    const normalized = normalizeUserType(userType);

    if (
        normalized === 'business_owner'
        || normalized === 'business owner'
        || normalized === 'owner'
    ) {
        return 'business_owner';
    }

    if (normalized === 'vendor') {
        return 'vendor';
    }

    return null;
};

const buildDisplayName = (profile: ProfileRow): string => {
    const middleInitial = profile.middle_initial?.trim();
    const meaningfulMiddle = middleInitial && middleInitial.toUpperCase() !== 'NA'
        ? middleInitial
        : '';

    return [profile.first_name, meaningfulMiddle, profile.last_name]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(' ')
        || 'Unnamed Account';
};

const getProfileId = (profileTable: DatabaseProfileTable, profile: ProfileRow): number => {
    if (profileTable === 'business_owner') {
        return profile.business_owner_id ?? 0;
    }

    return profile.vendor_id ?? 0;
};

const createCurrentUser = (
    account: AccountRow,
    profileTable: DatabaseProfileTable,
    profile: ProfileRow,
    business: BusinessRow | null,
    resolvedStallId?: string | null,
): CurrentUser => ({
    accountId: account.account_id,
    phoneNumber: profile.phone_number ?? account.phone_number ?? '',
    userType: account.user_type,
    displayName: buildDisplayName(profile),
    profileTable,
    profileId: getProfileId(profileTable, profile),
    businessOwnerId: profileTable === 'business_owner'
        ? getProfileId(profileTable, profile)
        : (profile as VendorProfileRow).business_owner_id,
    businessId: business?.business_id ?? null,
    businessName: business?.business_name ?? null,
    stallId: resolvedStallId ?? business?.stall_id ?? business?.stall_number ?? business?.stall_no ?? null,
    stallNumber: business?.stall_number ?? business?.stall_no ?? null,
    profilePictureUrl: profile.profile_picture_url ?? null,
});

const createDeveloperUser = (account: AccountRow): CurrentUser => ({
    accountId: account.account_id,
    phoneNumber: account.phone_number ?? '',
    userType: account.user_type,
    displayName: account.username?.trim() || account.email?.split('@')[0] || 'Developer',
    profileTable: 'developer',
    profileId: null,
    businessOwnerId: null,
    businessId: null,
    businessName: null,
    stallId: null,
    stallNumber: null,
    profilePictureUrl: null,
});

const persistCurrentUser = async (user: CurrentUser | null) => {
    if (!user) {
        await AsyncStorage.removeItem(CURRENT_USER_KEY);
        return;
    }

    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
};

const resolveBusinessContext = async (businessOwnerId: number) => {
    if (!isSupabaseConfigured || !supabase) {
        return { business: null, resolvedStallId: null };
    }

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
        const { data: stall } = await supabase
            .from('stalls')
            .select('stall_id, stall_number')
            .eq('stall_number', stallNumber)
            .maybeSingle<StallRow>();

        resolvedStallId = stall?.stall_id ?? stallNumber;
    }

    return { business: business ?? null, resolvedStallId };
};

const resolveBusinessById = async (businessId: number) => {
    if (!isSupabaseConfigured || !supabase) {
        return { business: null, resolvedStallId: null, error: 'Supabase is not configured.' };
    }

    const { data: business, error } = await supabase
        .from('business')
        .select('business_id, business_owner_id, business_name, stall_id, stall_number, stall_no')
        .eq('business_id', businessId)
        .maybeSingle<BusinessRow>();

    if (error || !business) {
        return {
            business: null,
            resolvedStallId: null,
            error: error?.message ?? 'The selected business is no longer available.',
        };
    }

    let resolvedStallId = business.stall_id ?? null;
    const stallNumber = business.stall_number ?? business.stall_no ?? null;

    if (!resolvedStallId && stallNumber) {
        const { data: stall } = await supabase
            .from('stalls')
            .select('stall_id, stall_number')
            .eq('stall_number', stallNumber)
            .maybeSingle<StallRow>();

        resolvedStallId = stall?.stall_id ?? stallNumber;
    }

    if (!resolvedStallId) {
        return { business: null, resolvedStallId: null, error: 'The selected business has no assigned stall.' };
    }

    return { business, resolvedStallId, error: undefined };
};

const refreshStoredUserBusinessContext = async (user: CurrentUser): Promise<CurrentUser> => {
    if (user.businessId && user.stallId) {
        return user;
    }

    if (user.profileTable === 'developer') {
        if (!user.businessId) {
            return user;
        }

        const { business, resolvedStallId } = await resolveBusinessById(user.businessId);

        if (!business || !resolvedStallId) {
            return {
                ...user,
                businessOwnerId: null,
                businessId: null,
                businessName: null,
                stallId: null,
                stallNumber: null,
            };
        }

        return {
            ...user,
            businessOwnerId: business.business_owner_id,
            businessId: business.business_id,
            businessName: business.business_name,
            stallId: resolvedStallId,
            stallNumber: business.stall_number ?? business.stall_no ?? null,
        };
    }

    if (!user.businessOwnerId) {
        return user;
    }

    const { business, resolvedStallId } = await resolveBusinessContext(user.businessOwnerId);

    if (!business && !resolvedStallId) {
        return user;
    }

    const refreshed: CurrentUser = {
        ...user,
        businessId: business?.business_id ?? user.businessId,
        businessName: business?.business_name ?? user.businessName,
        stallId: resolvedStallId ?? business?.stall_id ?? user.stallId,
        stallNumber: business?.stall_number ?? business?.stall_no ?? user.stallNumber,
    };

    await persistCurrentUser(refreshed);
    return refreshed;
};

const parseStoredUser = (value: string | null): CurrentUser | null => {
    if (!value) {
        return null;
    }

    try {
        const parsed = JSON.parse(value) as Partial<CurrentUser>;

        if (
            typeof parsed.accountId === 'number'
            && typeof parsed.phoneNumber === 'string'
            && typeof parsed.userType === 'string'
            && typeof parsed.displayName === 'string'
            && (
                parsed.profileTable === 'business_owner'
                || parsed.profileTable === 'vendor'
                || parsed.profileTable === 'developer'
            )
            && (
                typeof parsed.profileId === 'number'
                || (parsed.profileTable === 'developer' && parsed.profileId == null)
            )
            && (
                typeof parsed.businessOwnerId === 'number'
                || (parsed.profileTable === 'developer' && parsed.businessOwnerId == null)
            )
        ) {
            return {
                accountId: parsed.accountId,
                phoneNumber: parsed.phoneNumber,
                userType: parsed.userType,
                displayName: parsed.displayName,
                profileTable: parsed.profileTable,
                profileId: typeof parsed.profileId === 'number' ? parsed.profileId : null,
                businessOwnerId: typeof parsed.businessOwnerId === 'number' ? parsed.businessOwnerId : null,
                businessId: typeof parsed.businessId === 'number' ? parsed.businessId : null,
                businessName: typeof parsed.businessName === 'string' ? parsed.businessName : null,
                stallId: typeof parsed.stallId === 'string' ? parsed.stallId : null,
                stallNumber: typeof parsed.stallNumber === 'string' ? parsed.stallNumber : null,
                profilePictureUrl: typeof parsed.profilePictureUrl === 'string'
                    ? parsed.profilePictureUrl
                    : null,
            };
        }
    } catch {
        return null;
    }

    return null;
};

export const AuthSessionProvider = ({ children }: { children: ReactNode }) => {
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [isHydrating, setIsHydrating] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const hydrate = async () => {
            const stored = await AsyncStorage.getItem(CURRENT_USER_KEY);
            const parsed = parseStoredUser(stored);
            const refreshed = parsed ? await refreshStoredUserBusinessContext(parsed) : null;

            if (isMounted) {
                setCurrentUser(refreshed);
                setIsHydrating(false);
            }
        };

        void hydrate();

        return () => {
            isMounted = false;
        };
    }, []);

    const loginWithPhone = useCallback(async (phoneNumber: string) => {
        const normalizedPhone = normalizePhoneNumber(phoneNumber);

        if (!normalizedPhone) {
            return { user: null, error: 'Enter your phone number to continue.' };
        }

        if (!isSupabaseConfigured || !supabase) {
            return { user: null, error: 'Supabase is not configured.' };
        }

        const { data: account, error: accountError } = await supabase
            .from('accounts')
            .select('account_id, phone_number, email, username, user_type, status')
            .eq('phone_number', normalizedPhone)
            .eq('status', 'active')
            .maybeSingle<AccountRow>();

        if (accountError) {
            return { user: null, error: accountError.message };
        }

        if (!account) {
            return { user: null, error: 'No active account found for this phone number.' };
        }

        if (isDeveloperUserType(account.user_type)) {
            const user = createDeveloperUser(account);
            setCurrentUser(user);
            await persistCurrentUser(user);
            return { user };
        }

        const profileTable = getProfileTableForUserType(account.user_type);

        if (!profileTable) {
            return { user: null, error: 'This account is not allowed to use the POS app.' };
        }

        const profileIdColumn = profileTable === 'business_owner'
            ? 'business_owner_id'
            : 'vendor_id';
        const profileSelect = profileTable === 'business_owner'
            ? `${profileIdColumn}, account_id, first_name, middle_initial, last_name, phone_number, profile_picture_url`
            : `${profileIdColumn}, account_id, business_owner_id, first_name, middle_initial, last_name, phone_number, profile_picture_url`;

        const { data: profile, error: profileError } = await supabase
            .from(profileTable)
            .select(profileSelect)
            .eq('account_id', account.account_id)
            .maybeSingle<ProfileRow>();

        if (profileError) {
            return { user: null, error: profileError.message };
        }

        if (!profile) {
            return { user: null, error: 'The active account has no matching profile.' };
        }

        const businessOwnerId = profileTable === 'business_owner'
            ? getProfileId(profileTable, profile)
            : (profile as VendorProfileRow).business_owner_id;

        const { business, resolvedStallId } = await resolveBusinessContext(businessOwnerId);

        const user = createCurrentUser(account, profileTable, profile, business ?? null, resolvedStallId);
        setCurrentUser(user);
        await persistCurrentUser(user);

        return { user };
    }, []);

    const selectDeveloperBusiness = useCallback(async (businessId: number) => {
        if (!currentUser || currentUser.profileTable !== 'developer') {
            return { user: null, error: 'Only developer accounts can select a business.' };
        }

        if (!Number.isFinite(businessId) || businessId <= 0) {
            return { user: null, error: 'Select a valid business.' };
        }

        const { business, resolvedStallId, error } = await resolveBusinessById(businessId);

        if (error || !business || !resolvedStallId) {
            return { user: null, error: error ?? 'Unable to load the selected business.' };
        }

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
        setCurrentUser(null);
        await persistCurrentUser(null);
    }, []);

    const updateCurrentUser = useCallback(async (updates: Partial<CurrentUser>) => {
        setCurrentUser((previous) => {
            if (!previous) {
                return previous;
            }

            const next = { ...previous, ...updates };
            void persistCurrentUser(next);
            return next;
        });
    }, []);

    const value = useMemo<AuthSessionContextValue>(() => ({
        currentUser,
        isHydrating,
        loginWithPhone,
        selectDeveloperBusiness,
        logout,
        updateCurrentUser,
    }), [currentUser, isHydrating, loginWithPhone, selectDeveloperBusiness, logout, updateCurrentUser]);

    return (
        <AuthSessionContext.Provider value={value}>
            {children}
        </AuthSessionContext.Provider>
    );
};

export const useAuthSession = () => {
    const context = useContext(AuthSessionContext);

    if (!context) {
        throw new Error('useAuthSession must be used within AuthSessionProvider');
    }

    return context;
};
