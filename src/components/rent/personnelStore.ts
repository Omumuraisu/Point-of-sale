import { isSupabaseConfigured, supabase } from '../../lib/supabase';

const VENDOR_DOCUMENTS_BUCKET = 'vendor-documents';

export type PersonnelStatus = 'pending approval' | 'approved';

export interface PersonnelDocument {
    name: string;
    uri: string;
    mimeType?: string;
    size?: number;
    publicUrl?: string;
}

export interface PersonnelRecord {
    id: string;
    vendorId: number;
    accountId: number;
    firstName: string;
    middleInitial: string;
    lastName: string;
    birthday: string;
    address: string;
    phoneNumber: string;
    email: string;
    documents?: PersonnelDocument[];
    status: PersonnelStatus;
    createdAt: number;
}

export interface VendorComplianceRequest {
    complianceRequestId: number;
    vendorId: number;
    businessOwnerId: number;
    requestedRequirements: string[];
    note: string;
    status: 'pending' | 'submitted' | 'approved' | 'rejected';
    createdAt: string;
}

interface CreateVendorApplicationInput {
    businessOwnerId?: number | null;
    firstName: string;
    middleInitial?: string;
    lastName: string;
    phoneNumber: string;
    email?: string;
    documents?: PersonnelDocument[];
}

interface AccountRow {
    account_id: number;
}

interface VendorRow {
    vendor_id: number;
    account_id: number;
    business_owner_id: number;
    is_approved: boolean;
    first_name: string | null;
    middle_initial: string | null;
    last_name: string | null;
    phone_number: string | null;
    email: string | null;
    created_at: string | null;
}

interface VendorDocumentRow {
    document_id: number;
    vendor_id: number;
    file_name: string;
    file_url: string;
    mime_type: string | null;
    file_size: number | null;
}

interface VendorComplianceRequestRow {
    compliance_request_id: number;
    vendor_id: number;
    business_owner_id: number;
    requested_requirements: string[] | null;
    note: string | null;
    status: 'pending' | 'submitted' | 'approved' | 'rejected';
    created_at: string;
}

const normalizeOptionalText = (value?: string): string | null => {
    const normalized = value?.trim() ?? '';
    return normalized ? normalized : null;
};

const normalizeMiddleInitial = (value?: string): string => {
    const normalized = value?.trim() ?? '';
    return normalized ? normalized.slice(0, 1).toUpperCase() : 'NA';
};

const getStorageSafeFileName = (fileName: string): string => (
    fileName
        .trim()
        .replace(/[\\/]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9._-]/g, '')
        || 'uploaded-file'
);

const toCreatedAtMs = (createdAt: string | null): number => {
    if (!createdAt) {
        return Date.now();
    }

    const date = new Date(createdAt);
    return Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
};

const mapVendorRowToPersonnelRecord = (row: VendorRow): PersonnelRecord => ({
    id: String(row.vendor_id),
    vendorId: row.vendor_id,
    accountId: row.account_id,
    firstName: row.first_name ?? '',
    middleInitial: row.middle_initial ?? 'NA',
    lastName: row.last_name ?? '',
    birthday: '',
    address: '',
    phoneNumber: row.phone_number ?? '',
    email: row.email ?? '',
    documents: [],
    status: row.is_approved ? 'approved' : 'pending approval',
    createdAt: toCreatedAtMs(row.created_at),
});

const uploadVendorDocuments = async (
    vendorId: number,
    documents: PersonnelDocument[],
): Promise<{ documents: PersonnelDocument[]; error?: string }> => {
    if (!supabase || documents.length === 0) {
        return { documents: [] };
    }

    const uploadedDocuments: PersonnelDocument[] = [];

    for (const document of documents) {
        const contentType = document.mimeType ?? 'application/octet-stream';
        const path = `${vendorId}/${Date.now()}-${getStorageSafeFileName(document.name)}`;
        const response = await fetch(document.uri);
        const arrayBuffer = await response.arrayBuffer();
        const { error: uploadError } = await supabase.storage
            .from(VENDOR_DOCUMENTS_BUCKET)
            .upload(path, arrayBuffer, {
                contentType,
                upsert: true,
            });

        if (uploadError) {
            return { documents: uploadedDocuments, error: uploadError.message };
        }

        const { data } = supabase.storage
            .from(VENDOR_DOCUMENTS_BUCKET)
            .getPublicUrl(path);

        uploadedDocuments.push({
            ...document,
            publicUrl: data.publicUrl,
        });
    }

    const { error: metadataError } = await supabase
        .from('vendor_application_documents')
        .insert(
            uploadedDocuments.map((document) => ({
                vendor_id: vendorId,
                file_name: document.name,
                file_url: document.publicUrl,
                mime_type: document.mimeType ?? null,
                file_size: document.size ?? null,
            })),
        );

    if (metadataError) {
        return { documents: uploadedDocuments, error: metadataError.message };
    }

    return { documents: uploadedDocuments };
};

export const addVendorApplicationDocuments = async (
    vendorId: number,
    documents: PersonnelDocument[],
): Promise<{ documents: PersonnelDocument[]; error?: string }> => {
    if (!isSupabaseConfigured || !supabase) {
        return { documents: [], error: 'Supabase is not configured.' };
    }

    if (!vendorId) {
        return { documents: [], error: 'Missing vendor id.' };
    }

    return uploadVendorDocuments(vendorId, documents);
};

export const submitVendorComplianceDocuments = async (
    vendorId: number,
    documents: PersonnelDocument[],
    complianceRequestIds: number[],
): Promise<{ documents: PersonnelDocument[]; error?: string }> => {
    const uploadResult = await addVendorApplicationDocuments(vendorId, documents);

    if (uploadResult.error) {
        return uploadResult;
    }

    if (supabase && complianceRequestIds.length > 0) {
        const { error } = await supabase
            .from('vendor_compliance_requests')
            .update({
                status: 'submitted',
                submitted_at: new Date().toISOString(),
            })
            .in('compliance_request_id', complianceRequestIds);

        if (error) {
            return {
                documents: uploadResult.documents,
                error: error.message,
            };
        }
    }

    return uploadResult;
};

const loadVendorDocuments = async (vendorIds: number[]): Promise<Map<number, PersonnelDocument[]>> => {
    const documentMap = new Map<number, PersonnelDocument[]>();

    if (!supabase || vendorIds.length === 0) {
        return documentMap;
    }

    const { data, error } = await supabase
        .from('vendor_application_documents')
        .select('document_id, vendor_id, file_name, file_url, mime_type, file_size')
        .in('vendor_id', vendorIds);

    if (error || !data) {
        if (__DEV__ && error) {
            console.error('[VENDOR_DEBUG] Failed to load vendor documents:', error.message);
        }

        return documentMap;
    }

    (data as VendorDocumentRow[]).forEach((document) => {
        const documents = documentMap.get(document.vendor_id) ?? [];
        documents.push({
            name: document.file_name,
            uri: document.file_url,
            mimeType: document.mime_type ?? undefined,
            size: document.file_size ?? undefined,
            publicUrl: document.file_url,
        });
        documentMap.set(document.vendor_id, documents);
    });

    return documentMap;
};

export const loadVendorApplications = async (
    businessOwnerId?: number | null,
): Promise<PersonnelRecord[]> => {
    if (!businessOwnerId || !isSupabaseConfigured || !supabase) {
        return [];
    }

    const { data, error } = await supabase
        .from('vendor')
        .select('vendor_id, account_id, business_owner_id, is_approved, first_name, middle_initial, last_name, phone_number, email, created_at')
        .eq('business_owner_id', businessOwnerId)
        .order('created_at', { ascending: false });

    if (error || !data) {
        if (__DEV__ && error) {
            console.error('[VENDOR_DEBUG] Failed to load vendor applications:', error.message);
        }

        return [];
    }

    const vendorRows = data as VendorRow[];
    const documentMap = await loadVendorDocuments(vendorRows.map((row) => row.vendor_id));

    return vendorRows.map((row) => ({
        ...mapVendorRowToPersonnelRecord(row),
        documents: documentMap.get(row.vendor_id) ?? [],
    }));
};

export const loadVendorComplianceRequests = async (
    vendorId?: number | null,
): Promise<VendorComplianceRequest[]> => {
    if (!vendorId || !isSupabaseConfigured || !supabase) {
        return [];
    }

    const { data, error } = await supabase
        .from('vendor_compliance_requests')
        .select('compliance_request_id, vendor_id, business_owner_id, requested_requirements, note, status, created_at')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

    if (error || !data) {
        if (__DEV__ && error) {
            console.error('[VENDOR_DEBUG] Failed to load compliance requests:', error.message);
        }

        return [];
    }

    return (data as VendorComplianceRequestRow[]).map((row) => ({
        complianceRequestId: row.compliance_request_id,
        vendorId: row.vendor_id,
        businessOwnerId: row.business_owner_id,
        requestedRequirements: row.requested_requirements ?? [],
        note: row.note ?? '',
        status: row.status,
        createdAt: row.created_at,
    }));
};

export const createVendorApplication = async (
    input: CreateVendorApplicationInput,
): Promise<{ record: PersonnelRecord | null; error?: string }> => {
    if (!isSupabaseConfigured || !supabase) {
        return { record: null, error: 'Supabase is not configured.' };
    }

    if (!input.businessOwnerId) {
        return { record: null, error: 'Business owner account is missing.' };
    }

    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const phoneNumber = input.phoneNumber.trim();
    const email = normalizeOptionalText(input.email);
    const middleInitial = normalizeMiddleInitial(input.middleInitial);
    const documents = input.documents ?? [];

    if (!firstName || !lastName || !phoneNumber) {
        return { record: null, error: 'Please fill out all required fields.' };
    }

    const { data: account, error: accountError } = await supabase
        .from('accounts')
        .insert({
            email,
            phone_number: phoneNumber,
            user_type: 'vendor',
            status: 'pending',
            is_verified: false,
        })
        .select('account_id')
        .single<AccountRow>();

    if (accountError || !account) {
        return {
            record: null,
            error: accountError?.message ?? 'Unable to create vendor account.',
        };
    }

    const { data: vendor, error: vendorError } = await supabase
        .from('vendor')
        .insert({
            account_id: account.account_id,
            business_owner_id: input.businessOwnerId,
            is_approved: false,
            first_name: firstName,
            middle_initial: middleInitial,
            last_name: lastName,
            phone_number: phoneNumber,
            email,
        })
        .select('vendor_id, account_id, business_owner_id, is_approved, first_name, middle_initial, last_name, phone_number, email, created_at')
        .single<VendorRow>();

    if (vendorError || !vendor) {
        await supabase
            .from('accounts')
            .delete()
            .eq('account_id', account.account_id);

        return {
            record: null,
            error: vendorError?.message ?? 'Unable to create vendor application.',
        };
    }

    const documentResult = await uploadVendorDocuments(vendor.vendor_id, documents);

    if (documentResult.error) {
        await supabase
            .from('vendor')
            .delete()
            .eq('vendor_id', vendor.vendor_id);
        await supabase
            .from('accounts')
            .delete()
            .eq('account_id', account.account_id);

        return { record: null, error: documentResult.error };
    }

    return {
        record: {
            ...mapVendorRowToPersonnelRecord(vendor),
            documents: documentResult.documents,
        },
    };
};

export const deleteVendorApplication = async (
    personnel: Pick<PersonnelRecord, 'vendorId' | 'accountId'>,
): Promise<{ deleted: boolean; error?: string }> => {
    if (!isSupabaseConfigured || !supabase) {
        return { deleted: false, error: 'Supabase is not configured.' };
    }

    const { error: vendorError } = await supabase
        .from('vendor')
        .delete()
        .eq('vendor_id', personnel.vendorId);

    if (vendorError) {
        return { deleted: false, error: vendorError.message };
    }

    const { error: accountError } = await supabase
        .from('accounts')
        .delete()
        .eq('account_id', personnel.accountId);

    if (accountError) {
        return { deleted: false, error: accountError.message };
    }

    return { deleted: true };
};
