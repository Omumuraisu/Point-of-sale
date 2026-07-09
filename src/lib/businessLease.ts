import { isSupabaseConfigured, supabase } from './supabase';

interface BusinessLeaseRow {
    business_id: number;
    business_owner_id: number;
    business_name: string;
    business_type: string;
    lease_date: string;
    section: string;
    stall_no: string;
    stall_number: string | null;
}

export interface BusinessLeaseAgreement {
    businessId: number;
    businessOwnerId: number;
    businessName: string;
    businessType: string;
    leaseDate: string;
    section: string;
    stallNumber: string;
}

const BUSINESS_LEASE_COLUMNS = [
    'business_id',
    'business_owner_id',
    'business_name',
    'business_type',
    'lease_date',
    'section',
    'stall_no',
    'stall_number',
].join(', ');

const toBusinessLeaseAgreement = (row: BusinessLeaseRow): BusinessLeaseAgreement => ({
    businessId: row.business_id,
    businessOwnerId: row.business_owner_id,
    businessName: row.business_name,
    businessType: row.business_type,
    leaseDate: row.lease_date,
    section: row.section,
    stallNumber: row.stall_number ?? row.stall_no,
});

export const fetchBusinessLeaseAgreement = async (
    businessId?: number | null,
    businessOwnerId?: number | null,
): Promise<BusinessLeaseAgreement | null> => {
    if (!isSupabaseConfigured || !supabase) {
        return null;
    }

    let query = supabase
        .from('business')
        .select(BUSINESS_LEASE_COLUMNS)
        .order('business_id', { ascending: true })
        .limit(1);

    if (businessId) {
        query = query.eq('business_id', businessId);
    } else if (businessOwnerId) {
        query = query.eq('business_owner_id', businessOwnerId);
    } else {
        return null;
    }

    const { data, error } = await query.maybeSingle<BusinessLeaseRow>();

    if (error || !data) {
        if (__DEV__ && error) {
            console.error('[LEASE_DEBUG] Failed to fetch business lease agreement:', error.message);
        }

        return null;
    }

    return toBusinessLeaseAgreement(data);
};
