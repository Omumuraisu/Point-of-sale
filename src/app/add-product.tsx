import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AddProductScreen, { AddProductPayload } from '../components/pos/addProduct';
import { CatalogCategory, loadProductCatalog } from '../components/pos/catalogStore';
import { ProductScope, retryProductSync, saveProductRecord } from '../components/pos/productsStore';
import { useAuthSession } from '../lib/authSession';
import { useBusinessOperatingStatus } from '../lib/businessOperatingStatus';

export default function AddProductRoute() {
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const { isOpen } = useBusinessOperatingStatus();
    const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [failedProductId, setFailedProductId] = useState<string | null>(null);
    useEffect(() => {
        let mounted = true;
        void loadProductCatalog().then((data) => { if (mounted) { setCatalog(data); setLoading(false); } });
        return () => { mounted = false; };
    }, []);
    const save = async (payload: AddProductPayload) => {
        if (isOpen !== true) {
            Alert.alert('Stall closed', 'Open the stall before starting a sale.');
            return;
        }
        if (!currentUser?.stallNumber) {
            Alert.alert('No authorized stall', 'Select an authorized stall before adding products.');
            return;
        }
        setSaving(true);
        setSyncError(null);
        const scope: ProductScope = { accountId: currentUser.accountId, stallNumber: currentUser.stallNumber };
        try {
            const result = await saveProductRecord(scope, payload);
            if (!result.localSaved || !result.product) {
                setSyncError(result.error ?? 'Unable to save this product.');
                return;
            }
            if (!result.synced) {
                setFailedProductId(result.product.id);
                setSyncError(result.error ?? 'The product was saved on this device but did not sync to the server.');
                return;
            }
            router.back();
        } finally { setSaving(false); }
    };
    const retry = async () => {
        if (!currentUser?.stallNumber || !failedProductId) return;
        setSaving(true);
        setSyncError(null);
        try {
            const result = await retryProductSync(
                { accountId: currentUser.accountId, stallNumber: currentUser.stallNumber },
                failedProductId,
            );
            if (result.synced) router.back();
            else setSyncError(result.error ?? 'The product still could not be synced. Check your connection and retry.');
        } finally { setSaving(false); }
    };
    return <AddProductScreen catalog={catalog} loading={loading} saving={saving} disabled={isOpen !== true}
        syncError={syncError} onRetry={failedProductId ? retry : undefined}
        onCancel={() => router.back()} onSave={save} />;
}
