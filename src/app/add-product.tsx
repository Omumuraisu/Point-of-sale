import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AddProductScreen, { AddProductPayload } from '../components/pos/addProduct';
import { CatalogCategory, loadProductCatalog } from '../components/pos/catalogStore';
import { ProductScope, saveProductRecord } from '../components/pos/productsStore';
import { useAuthSession } from '../lib/authSession';
import { useBusinessOperatingStatus } from '../lib/businessOperatingStatus';

export default function AddProductRoute() {
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const { isOpen } = useBusinessOperatingStatus();
    const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
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
        const scope: ProductScope = { accountId: currentUser.accountId, stallNumber: currentUser.stallNumber };
        try {
            const result = await saveProductRecord(scope, payload);
            if (!result) {
                Alert.alert('Unable to save', 'Enter a valid product, positive selling price, and unit.');
                return;
            }
            router.back();
        } finally { setSaving(false); }
    };
    return <AddProductScreen catalog={catalog} loading={loading} saving={saving} disabled={isOpen !== true} onCancel={() => router.back()} onSave={save} />;
}
