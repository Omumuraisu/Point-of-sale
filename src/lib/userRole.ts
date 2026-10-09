import type { ProfileTable } from './authSession';

const ROLE_LABELS: Record<ProfileTable, string> = {
    business_owner: 'STALL OWNER',
    vendor: 'STALL VENDOR',
    developer: 'DEVELOPER',
};

export const getUserRoleLabel = (profileTable: ProfileTable): string => ROLE_LABELS[profileTable];
