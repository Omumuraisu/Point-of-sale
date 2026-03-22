import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type ProductUnit = 'pieces' | 'kg' | 'g' | 'mg' | 'L' | 'mL';

const PRODUCT_UNITS: ProductUnit[] = ['pieces', 'kg', 'g', 'mg', 'L', 'mL'];

const UNIT_LABELS: Record<ProductUnit, string> = {
  pieces: 'Pieces',
  kg: 'Kg',
  g: 'G',
  mg: 'Mg',
  L: 'L',
  mL: 'mL',
};

interface AddProductPayload {
  name: string;
  category: string;
  pricePerUnit: number;
  unit: ProductUnit;
}

interface AddProductScreenProps {
  categoryOptions?: string[];
  onCancel: () => void;
  onSave: (payload: AddProductPayload) => void;
}

const AddProductScreen = ({ categoryOptions = [], onCancel, onSave }: AddProductScreenProps) => {
  const insets = useSafeAreaInsets();
  const [productName, setProductName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categoryOptions[0] || '');
  const [productPrice, setProductPrice] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit>('pieces');

  const normalizeCategory = (value: string) => value.trim().toLowerCase();

  useEffect(() => {
    if (selectedCategory.trim().length === 0 && categoryOptions.length > 0) {
      setSelectedCategory(categoryOptions[0]);
    }
  }, [categoryOptions, selectedCategory]);

  const parsedPricePerUnit = Number(productPrice.trim());
  const hasValidPricePerUnit = Number.isFinite(parsedPricePerUnit) && parsedPricePerUnit > 0;

  const canSave = useMemo(
    () => productName.trim().length > 0
      && selectedCategory.trim().length > 0
      && hasValidPricePerUnit
      && categoryOptions.length > 0,
    [productName, selectedCategory, hasValidPricePerUnit, categoryOptions.length],
  );

  const handleSave = () => {
    if (!canSave) {
      return;
    }

    onSave?.({
      name: productName.trim(),
      category: selectedCategory.trim(),
      pricePerUnit: parsedPricePerUnit,
      unit: selectedUnit,
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.topHeader}>
        <Text style={styles.topTitle}>Add New Product</Text>
      </View>

      <ScrollView
        style={styles.contentArea}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Product Name</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={productName}
            onChangeText={setProductName}
            placeholder="e.g, Poyo"
            placeholderTextColor="#8b8b8b"
            style={styles.input}
          />
          <Ionicons name="create-outline" size={22} color="#8a8a8a" />
        </View>

        <Text style={[styles.label, styles.priceLabel]}>Price per Unit</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={productPrice}
            onChangeText={setProductPrice}
            placeholder="e.g, 120"
            placeholderTextColor="#8b8b8b"
            style={styles.input}
            keyboardType="decimal-pad"
          />
          <Ionicons name="cash-outline" size={22} color="#8a8a8a" />
        </View>

        <Text style={[styles.label, styles.unitLabel]}>Unit</Text>
        <View style={styles.unitRow}>
          {PRODUCT_UNITS.map((unit) => {
            const isSelected = selectedUnit === unit;

            return (
              <Pressable
                key={unit}
                style={[styles.unitPill, isSelected && styles.unitPillActive]}
                onPress={() => setSelectedUnit(unit)}
              >
                <Text style={[styles.unitText, isSelected && styles.unitTextActive]}>
                  {UNIT_LABELS[unit]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, styles.categoryLabel]}>Category</Text>
        <Text style={styles.helperText}>Select one category.</Text>

        {categoryOptions.length > 0 ? (
          <View style={styles.categoryGrid}>
            {categoryOptions.map((category) => {
              const isActive = normalizeCategory(selectedCategory) === normalizeCategory(category);

              return (
                <Pressable
                  key={category}
                  style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCategoryWrap}>
            <Text style={styles.emptyCategoryText}>No categories available yet.</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable style={[styles.actionButton, styles.cancelButton]} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>

        <Pressable
          style={[styles.actionButton, styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Ionicons name="save-outline" size={18} color="#ffffff" />
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default AddProductScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#d8dbe7',
  },
  topHeader: {
    backgroundColor: '#ffffff',
    height: 92,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#cfd3dd',
  },
  topTitle: {
    fontSize: 40 / 2,
    fontWeight: '800',
    color: '#0f1118',
  },
  contentArea: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  label: {
    fontSize: 42 / 2,
    fontWeight: '700',
    color: '#10121a',
  },
  inputWrap: {
    marginTop: 12,
    height: 66,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#b3b6c1',
    backgroundColor: '#ececec',
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    flex: 1,
    fontSize: 34 / 2,
    color: '#121217',
    marginRight: 8,
  },
  categoryLabel: {
    marginTop: 24,
    marginBottom: 10,
  },
  priceLabel: {
    marginTop: 20,
    marginBottom: 10,
  },
  unitLabel: {
    marginTop: 16,
    marginBottom: 10,
  },
  unitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    rowGap: 12,
  },
  unitPill: {
    width: '31%',
    height: 54,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#9ea2ad',
    backgroundColor: '#efefef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitPillActive: {
    borderColor: '#3b66f0',
    backgroundColor: '#d8dbe7',
  },
  unitText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#14151a',
  },
  unitTextActive: {
    color: '#11151f',
  },
  helperText: {
    marginTop: 8,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#5d6677',
  },
  emptyCategoryWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c3c8d7',
    backgroundColor: '#eceff6',
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCategoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5d6677',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  categoryPill: {
    width: '48%',
    height: 54,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#9ea2ad',
    backgroundColor: '#efefef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryPillActive: {
    borderColor: '#3b66f0',
    backgroundColor: '#d8dbe7',
  },
  categoryText: {
    fontSize: 34 / 2,
    fontWeight: '700',
    color: '#14151a',
  },
  categoryTextActive: {
    color: '#11151f',
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: '#b9bdc8',
    paddingTop: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#d8dbe7',
  },
  actionButton: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#d0d0d0',
    borderWidth: 1,
    borderColor: '#9fa1a7',
  },
  saveButton: {
    backgroundColor: '#2f5ada',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  cancelText: {
    fontSize: 34 / 2,
    fontWeight: '700',
    color: '#7d7d7d',
  },
  saveText: {
    fontSize: 34 / 2,
    fontWeight: '700',
    color: '#ffffff',
  },
});
