import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

const CATALOG_CACHE_KEY = '@pos/product-catalog:v1';
let memoryCatalog: CatalogCategory[] | null = null;

export interface CatalogProduct { id: string; sectionId: string; name: string; variant: string }
export interface CatalogSection { id: string; categoryId: string; name: string; products: CatalogProduct[] }
export interface CatalogCategory { id: string; name: string; displayOrder: number; sections: CatalogSection[] }

interface CategoryRow { id: string; name: string; display_order: number | null }
interface SectionRow { id: string; category_id: string; name: string }
interface ProductRow { id: string; section_id: string; name: string; variant: string | null }
interface CatalogRpcRow {
    category_id: string; category_name: string; display_order: number | null;
    section_id: string; section_name: string; product_id: string; product_name: string; variant: string | null;
}

const buildFromRpc = (rows: CatalogRpcRow[]): CatalogCategory[] => {
    const categories = new Map<string, CatalogCategory>();
    rows.forEach((row) => {
        let category = categories.get(row.category_id);
        if (!category) {
            category = { id: row.category_id, name: row.category_name, displayOrder: row.display_order ?? 0, sections: [] };
            categories.set(row.category_id, category);
        }
        let section = category.sections.find((item) => item.id === row.section_id);
        if (!section) {
            section = { id: row.section_id, categoryId: row.category_id, name: row.section_name, products: [] };
            category.sections.push(section);
        }
        section.products.push({ id: row.product_id, sectionId: row.section_id, name: row.product_name, variant: row.variant?.trim() ?? '' });
    });
    return Array.from(categories.values());
};

const isCatalog = (value: unknown): value is CatalogCategory[] => Array.isArray(value)
    && value.every((category) => typeof category?.id === 'string'
        && typeof category?.name === 'string' && Array.isArray(category?.sections));

export const loadCachedCatalog = async (): Promise<CatalogCategory[]> => {
    try {
        const raw = await AsyncStorage.getItem(CATALOG_CACHE_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return isCatalog(parsed) ? parsed : [];
    } catch { return []; }
};

export const loadProductCatalog = async (): Promise<CatalogCategory[]> => {
    if (memoryCatalog) return memoryCatalog;
    if (!isSupabaseConfigured || !supabase) return loadCachedCatalog();
    const rpcResult = await supabase.rpc('get_pos_product_catalog');
    if (!rpcResult.error && rpcResult.data) {
        const rpcCatalog = buildFromRpc(rpcResult.data as CatalogRpcRow[]);
        if (rpcCatalog.length > 0) {
            memoryCatalog = rpcCatalog;
            await AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(rpcCatalog));
            return rpcCatalog;
        }
    }
    const [categoriesResult, sectionsResult, productsResult] = await Promise.all([
        supabase.from('product_categories').select('id, name, display_order').order('display_order').order('name'),
        supabase.from('product_sections').select('id, category_id, name').order('name'),
        supabase.from('product_catalog').select('id, section_id, name, variant').eq('is_public', true).order('name').order('variant'),
    ]);
    if (categoriesResult.error || sectionsResult.error || productsResult.error) return loadCachedCatalog();

    const products = (productsResult.data ?? []) as ProductRow[];
    const sections = ((sectionsResult.data ?? []) as SectionRow[]).map((section) => ({
        id: section.id, categoryId: section.category_id, name: section.name,
        products: products.filter((product) => product.section_id === section.id).map((product) => ({
            id: product.id, sectionId: product.section_id, name: product.name, variant: product.variant?.trim() ?? '',
        })),
    })).filter((section) => section.products.length > 0);
    const catalog = ((categoriesResult.data ?? []) as CategoryRow[]).map((category) => ({
        id: category.id, name: category.name, displayOrder: category.display_order ?? 0,
        sections: sections.filter((section) => section.categoryId === category.id),
    })).filter((category) => category.sections.length > 0);
    if (catalog.length > 0) {
        memoryCatalog = catalog;
        await AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalog));
        return catalog;
    }
    memoryCatalog = await loadCachedCatalog();
    return memoryCatalog;
};

export const flattenCatalog = (catalog: CatalogCategory[]) => catalog.flatMap((category) =>
    category.sections.flatMap((section) => section.products.map((product) => ({ category, section, product }))));
