import AsyncStorage from '@react-native-async-storage/async-storage';

const RENT_PERSONNEL_KEY = '@rent/personnel';
const RENT_PERSONNEL_FALLBACK_KEY = 'rent-personnel';
const MAX_SAVED_PERSONNEL = 200;

export type PersonnelStatus = 'pending approval' | 'approved';

export interface PersonnelDocument {
    name: string;
    uri: string;
    mimeType?: string;
    size?: number;
}

export interface PersonnelRecord {
    id: string;
    firstName: string;
    lastName: string;
    birthday: string;
    address: string;
    phoneNumber: string;
    email: string;
    documents?: PersonnelDocument[];
    status: PersonnelStatus;
    createdAt: number;
}

export const DEFAULT_PERSONNEL: PersonnelRecord[] = [
    {
        id: 'personnel-juan',
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        birthday: '',
        address: '',
        phoneNumber: '',
        email: '',
        status: 'approved',
        createdAt: 0,
    },
];

interface SavePersonnelInput {
    firstName: string;
    lastName: string;
    birthday: string;
    address: string;
    phoneNumber: string;
    email?: string;
    documents?: PersonnelDocument[];
    status?: PersonnelStatus;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const isPersonnelStatus = (value: unknown): value is PersonnelStatus =>
    value === 'pending approval' || value === 'approved';

const isPersonnelDocument = (value: unknown): value is PersonnelDocument => {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.name === 'string'
        && typeof value.uri === 'string'
        && (value.mimeType === undefined || typeof value.mimeType === 'string')
        && (value.size === undefined || (typeof value.size === 'number' && Number.isFinite(value.size)));
};

const isPersonnelRecord = (value: unknown): value is PersonnelRecord => {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.id === 'string'
        && typeof value.firstName === 'string'
        && typeof value.lastName === 'string'
        && typeof value.birthday === 'string'
        && typeof value.address === 'string'
        && typeof value.phoneNumber === 'string'
        && typeof value.email === 'string'
        && (value.documents === undefined || (Array.isArray(value.documents) && value.documents.every(isPersonnelDocument)))
        && isPersonnelStatus(value.status)
        && typeof value.createdAt === 'number'
        && Number.isFinite(value.createdAt);
};

export const loadPersonnelRecords = async (): Promise<PersonnelRecord[]> => {
    try {
        const raw = await AsyncStorage.getItem(RENT_PERSONNEL_KEY)
            ?? await AsyncStorage.getItem(RENT_PERSONNEL_FALLBACK_KEY);

        if (!raw) {
            return [];
        }

        const parsed: unknown = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(isPersonnelRecord);
    } catch (error) {
        if (__DEV__) {
            console.error('[RENT_DEBUG] Failed to load personnel records:', error);
        }

        return [];
    }
};

const persistPersonnelRecords = async (records: PersonnelRecord[]): Promise<void> => {
    const trimmed = records.slice(0, MAX_SAVED_PERSONNEL);

    try {
        await AsyncStorage.setItem(RENT_PERSONNEL_KEY, JSON.stringify(trimmed));
    } catch (primaryError) {
        if (__DEV__) {
            console.error('[RENT_DEBUG] Primary save failed, trying fallback key:', primaryError);
        }

        await AsyncStorage.setItem(RENT_PERSONNEL_FALLBACK_KEY, JSON.stringify(trimmed));
    }
};

export const savePersonnelRecord = async (input: SavePersonnelInput): Promise<PersonnelRecord | null> => {
    const normalizedFirstName = input.firstName.trim();
    const normalizedLastName = input.lastName.trim();
    const normalizedBirthday = input.birthday.trim();
    const normalizedAddress = input.address.trim();
    const normalizedPhone = input.phoneNumber.trim();
    const normalizedEmail = input.email?.trim() ?? '';
    const documents = input.documents?.filter(isPersonnelDocument) ?? [];

    if (!normalizedFirstName || !normalizedLastName || !normalizedBirthday || !normalizedAddress || !normalizedPhone) {
        return null;
    }

    const existing = await loadPersonnelRecords();

    const nextRecord: PersonnelRecord = {
        id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        birthday: normalizedBirthday,
        address: normalizedAddress,
        phoneNumber: normalizedPhone,
        email: normalizedEmail,
        documents,
        status: input.status ?? 'pending approval',
        createdAt: Date.now(),
    };

    const nextList = [nextRecord, ...existing];

    await persistPersonnelRecords(nextList);

    return nextRecord;
};
