import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CatalogCategory } from './catalogStore';
import { PRODUCT_UNITS, ProductUnit } from './productsStore';

export interface AddProductPayload {
  name: string; categoryId: string; categoryLabel: string; mainCategory: string;
  section: string; variant: string; catalogProductId?: string; pricePerUnit: number; unit: ProductUnit;
}

interface Props {
  catalog: CatalogCategory[];
  loading?: boolean;
  saving?: boolean;
  disabled?: boolean;
  syncError?: string | null;
  onCancel: () => void;
  onSave: (payload: AddProductPayload) => void;
  onRetry?: () => void;
}
const labels: Record<ProductUnit, string> = { pieces: 'Pieces', kg: 'Kg', g: 'G', mg: 'Mg', L: 'L', mL: 'mL' };

const AddProductScreen = ({ catalog, loading = false, saving = false, disabled = false, syncError, onCancel, onSave, onRetry }: Props) => {
  const insets = useSafeAreaInsets();
  const [custom, setCustom] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [productId, setProductId] = useState('');
  const [customName, setCustomName] = useState('');
  const [variant, setVariant] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState<ProductUnit | null>(null);
  const category = catalog.find((item) => item.id === categoryId);
  const section = category?.sections.find((item) => item.id === sectionId);
  const product = section?.products.find((item) => item.id === productId);
  const parsedPrice = Number(price.trim());
  const name = custom ? customName.trim() : product?.name ?? '';
  const effectiveVariant = custom ? variant.trim() : product?.variant ?? '';
  const valid = Boolean(category && section && name && unit && Number.isFinite(parsedPrice) && parsedPrice > 0 && !saving && !disabled);
  const chooseCategory = (id: string) => { setCategoryId(id); setSectionId(''); setProductId(''); };
  const chooseSection = (id: string) => { setSectionId(id); setProductId(''); };
  const submit = () => {
    if (!valid || !category || !section || !unit) return;
    onSave({ name, categoryId: category.id, categoryLabel: category.name, mainCategory: category.name,
      section: section.name, variant: effectiveVariant, catalogProductId: custom ? undefined : product?.id,
      pricePerUnit: parsedPrice, unit });
  };
  const pills = (items: Array<{ id: string; label: string }>, selected: string, choose: (id: string) => void) => (
    <View style={styles.grid}>{items.map((item) => <Pressable key={item.id} style={[styles.pill, selected === item.id && styles.active]} onPress={() => choose(item.id)}><Text style={styles.pillText}>{item.label}</Text></Pressable>)}</View>
  );
  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <View style={styles.header}><Text style={styles.title}>Add Product</Text></View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {disabled ? <Text style={styles.error}>Open the stall before adding products.</Text> : null}
      {syncError ? <View style={styles.syncErrorBox}>
        <Text style={styles.syncErrorTitle}>Product not synced</Text>
        <Text style={styles.syncErrorText}>{syncError}</Text>
        {onRetry ? <Pressable style={styles.retryButton} onPress={onRetry} disabled={saving}>
          <Text style={styles.retryText}>{saving ? 'Retrying...' : 'Retry Sync'}</Text>
        </Pressable> : null}
      </View> : null}
      <View style={styles.modeRow}>
        <Pressable style={[styles.mode, !custom && styles.modeActive]} onPress={() => setCustom(false)}><Text style={styles.modeText}>Catalog Product</Text></Pressable>
        <Pressable style={[styles.mode, custom && styles.modeActive]} onPress={() => setCustom(true)}><Text style={styles.modeText}>Add Custom Product</Text></Pressable>
      </View>
      {loading ? <Text style={styles.helper}>Loading product catalog…</Text> : catalog.length === 0 ? <Text style={styles.error}>Catalog unavailable. Connect once to cache the product catalog.</Text> : <>
        <Text style={styles.label}>Category</Text>{pills(catalog.map((item) => ({ id: item.id, label: item.name })), categoryId, chooseCategory)}
        {category ? <><Text style={styles.label}>Section</Text>{pills(category.sections.map((item) => ({ id: item.id, label: item.name })), sectionId, chooseSection)}</> : null}
        {!custom && section ? <><Text style={styles.label}>Product</Text>{pills(section.products.map((item) => ({ id: item.id, label: item.variant ? `${item.name} — ${item.variant}` : item.name })), productId, setProductId)}</> : null}
        {custom && section ? <><Text style={styles.label}>Product Name</Text><TextInput style={styles.input} value={customName} onChangeText={setCustomName} placeholder="Product name" />
          <Text style={styles.label}>Variant (optional)</Text><TextInput style={styles.input} value={variant} onChangeText={setVariant} placeholder="Size, cut, preparation, etc." /></> : null}
      </>}
      <Text style={styles.label}>Selling Price</Text><View style={styles.inputRow}><TextInput style={styles.inputFlex} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Enter price" /><Ionicons name="cash-outline" size={21} color="#777" /></View>
      <Text style={styles.label}>Unit</Text><Text style={styles.helper}>Choose the unit you actually sell this product in.</Text>
      <View style={styles.grid}>{PRODUCT_UNITS.map((item) => <Pressable key={item} style={[styles.pill, unit === item && styles.active]} onPress={() => setUnit(item)}><Text style={styles.pillText}>{labels[item]}</Text></Pressable>)}</View>
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}><Pressable style={[styles.button, styles.cancel]} onPress={onCancel}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={!valid} style={[styles.button, styles.save, !valid && styles.disabled]} onPress={submit}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text></Pressable></View>
  </SafeAreaView>;
};

export default AddProductScreen;

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#d8dbe7'},header:{height:76,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},title:{fontSize:21,fontWeight:'800'},scroll:{flex:1},content:{padding:20,paddingBottom:30},modeRow:{flexDirection:'row',gap:10,marginBottom:18},mode:{flex:1,padding:13,borderRadius:10,borderWidth:1,borderColor:'#aeb5c7',alignItems:'center'},modeActive:{backgroundColor:'#cbd6fa',borderColor:'#2f5ada'},modeText:{fontWeight:'800',fontSize:13},label:{fontSize:17,fontWeight:'800',marginTop:18,marginBottom:9,color:'#151923'},helper:{color:'#626b7b',fontSize:13,marginBottom:8},error:{color:'#a33',fontWeight:'700',paddingVertical:20},syncErrorBox:{borderRadius:12,borderWidth:1,borderColor:'#e2a39e',backgroundColor:'#fde8e6',padding:14,marginBottom:16},syncErrorTitle:{color:'#8f302a',fontSize:16,fontWeight:'800'},syncErrorText:{color:'#7c443f',fontSize:13,fontWeight:'600',lineHeight:18,marginTop:4},retryButton:{alignSelf:'flex-start',marginTop:10,borderRadius:8,backgroundColor:'#a33d36',paddingHorizontal:14,paddingVertical:9},retryText:{color:'#fff',fontWeight:'800'},grid:{flexDirection:'row',flexWrap:'wrap',gap:9},pill:{paddingHorizontal:14,paddingVertical:11,borderRadius:22,borderWidth:1,borderColor:'#aeb3bf',backgroundColor:'#eee'},active:{borderColor:'#2f5ada',backgroundColor:'#cbd6fa'},pillText:{fontWeight:'700',color:'#20242d'},input:{height:52,borderRadius:12,backgroundColor:'#eee',borderWidth:1,borderColor:'#b7bbc5',paddingHorizontal:15,fontSize:16},inputRow:{height:52,borderRadius:12,backgroundColor:'#eee',borderWidth:1,borderColor:'#b7bbc5',paddingHorizontal:15,flexDirection:'row',alignItems:'center'},inputFlex:{flex:1,fontSize:16},footer:{padding:12,flexDirection:'row',gap:12,borderTopWidth:1,borderTopColor:'#b9bdc8'},button:{flex:1,height:52,borderRadius:10,alignItems:'center',justifyContent:'center'},cancel:{backgroundColor:'#ccc'},save:{backgroundColor:'#2f5ada'},disabled:{opacity:.45},cancelText:{fontWeight:'800',color:'#666'},saveText:{fontWeight:'800',color:'#fff'}
});
