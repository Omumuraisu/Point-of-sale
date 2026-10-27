import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => (
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
));

const mockRpc = jest.fn();
jest.mock('../src/lib/supabase', () => ({
    isSupabaseConfigured: true,
    supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock('../src/lib/debugLogging', () => ({
    debugError: jest.fn(), debugLog: jest.fn(), debugWarn: jest.fn(),
}));

import {
    deleteProductRecord,
    loadCachedScopedProducts,
    loadScopedProducts,
    loadSavedProducts,
    saveProductRecord,
    updateProductRecord,
    type ProductScope,
    type SavedProductRecord,
} from '../src/components/pos/productsStore';

const scope = (businessId: number): ProductScope => ({ accountId: 7, businessId, stallNumber: '1' });
const input = { name: 'Rice', categoryId: 'rice', categoryLabel: 'Rice', mainCategory: 'Food', section: 'Grains', pricePerUnit: 60, unit: 'kg' as const };
const record = (id: string): SavedProductRecord => ({
    id, accountId: 7, businessId: 10, stallNumber: '1', name: `Rice ${id}`,
    categoryId: 'rice', categoryLabel: 'Rice', mainCategory: 'Food', section: 'Grains', variant: '',
    pricePerUnit: 60, unit: 'kg', createdAt: 1, updatedAt: 1,
    syncState: 'pending', pendingAction: 'create',
});

beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Network request failed' } });
});

test('offline create, edit, and delete coalesce into one local operation', async () => {
    const created = await saveProductRecord(scope(10), input);
    expect(created).toMatchObject({ localSaved: true, synced: false, pendingAction: 'create' });

    const updated = await updateProductRecord(scope(10), created.product!.id, 75, 'kg');
    expect(updated.product).toMatchObject({ pricePerUnit: 75, pendingAction: 'create' });

    const removed = await deleteProductRecord(scope(10), created.product!.id);
    expect(removed.synced).toBe(true);
    expect(await loadSavedProducts(scope(10))).toEqual([]);
});

test('product queues are isolated by business even for the same account and stall', async () => {
    await saveProductRecord(scope(10), input);
    await saveProductRecord(scope(20), { ...input, name: 'Corn' });

    expect((await loadSavedProducts(scope(10))).map((item) => item.name)).toEqual(['Rice']);
    expect((await loadSavedProducts(scope(20))).map((item) => item.name)).toEqual(['Corn']);
});

test('v2 scoped products migrate once into the active business-aware key', async () => {
    const legacy = { ...record('legacy'), businessId: undefined };
    await AsyncStorage.setItem('@pos/products:v2:7:1', JSON.stringify([legacy]));

    expect(await loadSavedProducts(scope(10))).toEqual([expect.objectContaining({ id: 'legacy', businessId: 10 })]);
    expect(await AsyncStorage.getItem('@pos/products:v2:7:1')).not.toBeNull();
});

test('cache limits never discard queued product mutations', async () => {
    const queued = Array.from({ length: 305 }, (_, index) => record(`queued-${index}`));
    await AsyncStorage.setItem('@pos/products:v3:7:10:1', JSON.stringify(queued));

    await updateProductRecord(scope(10), 'queued-0', 80, 'kg');

    expect(await loadSavedProducts(scope(10))).toHaveLength(305);
});

test('a primary storage write failure falls back without losing the queued product', async () => {
    await loadSavedProducts(scope(10));
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('primary storage unavailable'));

    const result = await saveProductRecord(scope(10), input);

    expect(result.localSaved).toBe(true);
    expect(await AsyncStorage.getItem('pos-products:v3:7:10:1')).toContain('Rice');
});

test('cached scoped products load without making a remote request', async () => {
    await AsyncStorage.setItem('@pos/products:v3:7:10:1', JSON.stringify([
        { ...record('cached'), syncState: 'synced', pendingAction: undefined },
    ]));

    expect((await loadCachedScopedProducts(scope(10))).map((item) => item.id)).toEqual(['cached']);
    expect(mockRpc).not.toHaveBeenCalled();
});

test('remote refresh caches every synchronized product without a 300 item limit', async () => {
    mockRpc.mockResolvedValue({
        error: null,
        data: Array.from({ length: 350 }, (_, index) => ({
            id: `remote-${index}`,
            stall_number: '1',
            name: `Product ${index}`,
            category_id: 'general',
            category_label: 'General',
            main_category: 'General',
            section_name: 'General',
            catalog_variant: '',
            price_per_unit: 10,
            unit: 'pieces',
            created_at_ms: index + 1,
            updated_at_ms: index + 1,
            catalog_product_id: null,
            archived_at: null,
        })),
    });

    expect(await loadScopedProducts(scope(10))).toHaveLength(350);
    expect(await loadSavedProducts(scope(10))).toHaveLength(350);
});
