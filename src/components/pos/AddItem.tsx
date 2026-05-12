import { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ScrollView,
    Modal,
    TextInput,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddCartItemPayload } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';
import { ProductUnit } from './productsStore';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'];
const PRODUCT_UNITS: ProductUnit[] = ['pieces', 'kg', 'g', 'mg', 'L', 'mL'];

const UNIT_LABELS: Record<ProductUnit, string> = {
    pieces: 'Pieces',
    kg: 'Kg',
    g: 'G',
    mg: 'Mg',
    L: 'L',
    mL: 'mL',
};

interface CategoryOption {
    id: string;
    label: string;
}

interface UpdateProductPayload {
    name: string;
    categoryId: string;
    categoryLabel: string;
    pricePerUnit: number;
    unit: ProductUnit;
}

interface AddItemScreenProps {
    productName?: string;
    categoryId?: string;
    categoryLabel?: string;
    productId?: string;
    defaultKey?: string;
    originalProductName?: string;
    pricePerUnit?: number;
    unit?: ProductUnit;
    categoryOptions?: CategoryOption[];
    onBack: () => void;
    onAdd: (payload: AddCartItemPayload) => void;
    onDeleteProduct: () => Promise<void> | void;
    onUpdateProduct: (payload: UpdateProductPayload) => Promise<void> | void;
}

const AddItemScreen = ({
    productName = 'Product',
    categoryId = '',
    categoryLabel = 'Category',
    pricePerUnit = 0,
    unit = 'kg',
    categoryOptions = [],
    onBack,
    onAdd,
    onDeleteProduct,
    onUpdateProduct,
}: AddItemScreenProps) => {
    const insets = useSafeAreaInsets();
    const [quantityInput, setQuantityInput] = useState('');
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isSavingProduct, setIsSavingProduct] = useState(false);
    const [editName, setEditName] = useState(productName);
    const [editPrice, setEditPrice] = useState(String(pricePerUnit || ''));
    const [editUnit, setEditUnit] = useState<ProductUnit>(unit);
    const [editCategoryId, setEditCategoryId] = useState(categoryId);

    useEffect(() => {
        setEditName(productName);
        setEditPrice(String(pricePerUnit || ''));
        setEditUnit(unit);
        setEditCategoryId(categoryId);
    }, [categoryId, pricePerUnit, productName, unit]);

    const quantityValue = useMemo(() => {
        const parsed = Number.parseFloat(quantityInput);
        return Number.isFinite(parsed) ? parsed : 0;
    }, [quantityInput]);

    const totalAmount = useMemo(
        () => quantityValue * Number(pricePerUnit || 0),
        [pricePerUnit, quantityValue],
    );

    const canAdd = quantityValue > 0;
    const selectedEditCategory = categoryOptions.find((option) => option.id === editCategoryId)
        ?? categoryOptions.find((option) => option.label === categoryLabel);
    const parsedEditPrice = Number(editPrice.trim());
    const canSaveEdit = editName.trim().length > 0
        && Boolean(selectedEditCategory)
        && Number.isFinite(parsedEditPrice)
        && parsedEditPrice > 0
        && !isSavingProduct;

    const handleKeyPress = (key: string) => {
        if (key === 'backspace') {
            setQuantityInput((prev) => prev.slice(0, -1));
            return;
        }

        if (key === '.') {
            setQuantityInput((prev) => {
                if (prev.includes('.')) {
                    return prev;
                }
                return prev.length ? `${prev}.` : '0.';
            });
            return;
        }

        setQuantityInput((prev) => {
            const [whole = '', decimals = ''] = prev.split('.');

            if (prev.includes('.') && decimals.length >= 2) {
                return prev;
            }

            if (!prev.includes('.') && whole.length >= 4) {
                return prev;
            }

            return `${prev}${key}`;
        });
    };

    const handleAdd = () => {
        if (!canAdd) {
            return;
        }

        onAdd?.({
            name: productName,
            category: categoryLabel,
            quantity: quantityValue,
            unit,
            pricePerKg: Number(pricePerUnit || 0),
            total: totalAmount,
        });
    };

    const handleConfirmDelete = async () => {
        setIsSavingProduct(true);

        try {
            await onDeleteProduct();
            setIsDeleteModalVisible(false);
        } finally {
            setIsSavingProduct(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!canSaveEdit || !selectedEditCategory) {
            return;
        }

        setIsSavingProduct(true);

        try {
            await onUpdateProduct({
                name: editName.trim(),
                categoryId: selectedEditCategory.id,
                categoryLabel: selectedEditCategory.label,
                pricePerUnit: parsedEditPrice,
                unit: editUnit,
            });
            setIsEditModalVisible(false);
        } finally {
            setIsSavingProduct(false);
        }
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <Pressable style={styles.backBtn} onPress={onBack}>
                    <Ionicons name="chevron-back" size={22} color="#ffffff" />
                </Pressable>
                <Text style={styles.headerTitle}>Add Product</Text>
            </View>

            <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: Math.max(insets.bottom, 16) + 12 },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.contentArea}>
                    <Text style={styles.categoryText}>{categoryLabel.toUpperCase()}</Text>
                    <View style={styles.productHeaderRow}>
                        <Text style={styles.productText} numberOfLines={2}>{productName}</Text>
                        <View style={styles.productActionRow}>
                            <Pressable
                                style={[styles.productActionButton, styles.editProductButton]}
                                onPress={() => setIsEditModalVisible(true)}
                            >
                                <Ionicons name="create-outline" size={20} color="#ffffff" />
                            </Pressable>
                            <Pressable
                                style={[styles.productActionButton, styles.deleteProductButton]}
                                onPress={() => setIsDeleteModalVisible(true)}
                            >
                                <Ionicons name="trash-outline" size={20} color="#ffffff" />
                            </Pressable>
                        </View>
                    </View>

                    <Text style={styles.sectionLabel}>Quantity ({unit})</Text>
                    <View style={styles.priceBox}>
                        <Text style={styles.priceText}>{quantityInput || '0'}</Text>
                    </View>

                    <View style={styles.totalBox}>
                        <Text style={styles.totalLabel}>Total Amount</Text>
                        <Text style={styles.totalText}>{formatCurrency(totalAmount)}</Text>
                    </View>
                </View>

                <View style={styles.keyboardWrap}>
                    <Text style={styles.qtyHint}>Price per {unit}: {formatCurrency(Number(pricePerUnit || 0))}</Text>

                    <View style={styles.keyGrid}>
                        {KEYS.map((key) => {
                            const isDelete = key === 'backspace';

                            return (
                                <Pressable
                                    key={key}
                                    style={[styles.keyButton, isDelete && styles.deleteKeyButton]}
                                    onPress={() => handleKeyPress(key)}
                                >
                                    {isDelete ? (
                                        <MaterialIcons name="backspace" size={24} color="#c05f5f" />
                                    ) : (
                                        <Text style={styles.keyText}>{key}</Text>
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>

                    <Pressable
                        style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
                        onPress={handleAdd}
                        disabled={!canAdd}
                    >
                        <Text style={styles.addButtonText}>Add</Text>
                    </Pressable>
                </View>
            </ScrollView>

            <Modal
                animationType="fade"
                transparent
                visible={isDeleteModalVisible}
                onRequestClose={() => setIsDeleteModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.confirmModal}>
                        <View style={styles.modalIconWrap}>
                            <Ionicons name="trash-outline" size={28} color="#d4463e" />
                        </View>
                        <Text style={styles.modalTitle}>Delete item?</Text>
                        <Text style={styles.modalText}>
                            This product will be removed from the product list.
                        </Text>
                        <View style={styles.modalButtonRow}>
                            <Pressable
                                style={[styles.modalButton, styles.modalCancelButton]}
                                onPress={() => setIsDeleteModalVisible(false)}
                                disabled={isSavingProduct}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.modalButton, styles.modalDeleteButton]}
                                onPress={handleConfirmDelete}
                                disabled={isSavingProduct}
                            >
                                <Text style={styles.modalDeleteText}>
                                    {isSavingProduct ? 'Deleting...' : 'Yes, Delete'}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                animationType="slide"
                transparent
                visible={isEditModalVisible}
                onRequestClose={() => setIsEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.editModal}>
                        <View style={styles.editModalHeader}>
                            <Text style={styles.modalTitle}>Edit Product</Text>
                            <Pressable
                                style={styles.closeModalButton}
                                onPress={() => setIsEditModalVisible(false)}
                                disabled={isSavingProduct}
                            >
                                <Ionicons name="close" size={22} color="#333844" />
                            </Pressable>
                        </View>

                        <ScrollView
                            style={styles.editFormScroll}
                            contentContainerStyle={styles.editFormContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Text style={styles.editLabel}>Product Name</Text>
                            <View style={styles.editInputWrap}>
                                <TextInput
                                    value={editName}
                                    onChangeText={setEditName}
                                    placeholder="Product name"
                                    placeholderTextColor="#858b98"
                                    style={styles.editInput}
                                />
                            </View>

                            <Text style={styles.editLabel}>Price per Unit</Text>
                            <View style={styles.editInputWrap}>
                                <TextInput
                                    value={editPrice}
                                    onChangeText={setEditPrice}
                                    placeholder="0.00"
                                    placeholderTextColor="#858b98"
                                    style={styles.editInput}
                                    keyboardType="decimal-pad"
                                />
                            </View>

                            <Text style={styles.editLabel}>Unit</Text>
                            <View style={styles.editPillGrid}>
                                {PRODUCT_UNITS.map((item) => {
                                    const isSelected = editUnit === item;

                                    return (
                                        <Pressable
                                            key={item}
                                            style={[styles.editPill, isSelected && styles.editPillActive]}
                                            onPress={() => setEditUnit(item)}
                                        >
                                            <Text style={[styles.editPillText, isSelected && styles.editPillTextActive]}>
                                                {UNIT_LABELS[item]}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            <Text style={styles.editLabel}>Category</Text>
                            <View style={styles.editPillGrid}>
                                {categoryOptions.map((option) => {
                                    const isSelected = editCategoryId === option.id;

                                    return (
                                        <Pressable
                                            key={option.id}
                                            style={[styles.categoryEditPill, isSelected && styles.editPillActive]}
                                            onPress={() => setEditCategoryId(option.id)}
                                        >
                                            <Text style={[styles.editPillText, isSelected && styles.editPillTextActive]}>
                                                {option.label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </ScrollView>

                        <View style={styles.editFooter}>
                            <Pressable
                                style={[styles.editFooterButton, styles.modalCancelButton]}
                                onPress={() => setIsEditModalVisible(false)}
                                disabled={isSavingProduct}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={[
                                    styles.editFooterButton,
                                    styles.saveEditButton,
                                    !canSaveEdit && styles.saveEditButtonDisabled,
                                ]}
                                onPress={handleSaveEdit}
                                disabled={!canSaveEdit}
                            >
                                <Ionicons name="save-outline" size={18} color="#ffffff" />
                                <Text style={styles.saveEditText}>
                                    {isSavingProduct ? 'Saving...' : 'Save'}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default AddItemScreen;

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
    },
    scrollArea: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    header: {
        height: 70,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#c7ccd9',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    backBtn: {
        position: 'absolute',
        left: 18,
        width: 38,
        height: 38,
        borderRadius: 9,
        backgroundColor: '#2f58cc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 34 / 2,
        fontWeight: '800',
        color: '#0f1118',
    },
    contentArea: {
        paddingHorizontal: 24,
        paddingTop: 14,
        paddingBottom: 22,
    },
    categoryText: {
        fontSize: 36 / 2,
        fontWeight: '800',
        color: '#2448a4',
    },
    productText: {
        flex: 1,
        fontSize: 52 / 2,
        fontWeight: '800',
        color: '#11131a',
    },
    productHeaderRow: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    productActionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    productActionButton: {
        width: 42,
        height: 42,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    editProductButton: {
        backgroundColor: '#315bd7',
    },
    deleteProductButton: {
        backgroundColor: '#d4463e',
    },
    sectionLabel: {
        marginTop: 20,
        fontSize: 40 / 2,
        fontWeight: '700',
        color: '#2448a4',
    },
    priceBox: {
        marginTop: 12,
        height: 74,
        borderRadius: 37,
        borderWidth: 1,
        borderColor: '#b5b8c3',
        backgroundColor: '#ececec',
        alignItems: 'center',
        justifyContent: 'center',
    },
    priceText: {
        fontSize: 64 / 2,
        fontWeight: '800',
        color: '#8f9196',
    },
    totalBox: {
        marginTop: 18,
        borderWidth: 2,
        borderColor: '#2f60eb',
        borderStyle: 'dashed',
        borderRadius: 22,
        minHeight: 130,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#dedfe5',
    },
    totalLabel: {
        fontSize: 46 / 2,
        fontWeight: '700',
        color: '#737579',
    },
    totalText: {
        marginTop: 8,
        fontSize: 68 / 2,
        fontWeight: '800',
        color: '#2448a4',
    },
    keyboardWrap: {
        backgroundColor: '#f5f5f8',
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderTopWidth: 1,
        borderTopColor: '#c2c7d3',
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 12,
    },
    qtyHint: {
        textAlign: 'center',
        fontSize: 32 / 2,
        fontWeight: '700',
        color: '#6c707a',
        marginBottom: 14,
    },
    keyGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 12,
    },
    keyButton: {
        width: '30%',
        height: 62,
        borderRadius: 20,
        backgroundColor: '#d5dbe8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    keyText: {
        fontSize: 50 / 2,
        fontWeight: '700',
        color: '#12141a',
    },
    deleteKeyButton: {
        backgroundColor: '#f0dcdd',
    },
    addButton: {
        marginTop: 18,
        height: 62,
        borderRadius: 22,
        backgroundColor: '#2f5ada',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButtonDisabled: {
        opacity: 0.55,
    },
    addButtonText: {
        fontSize: 44 / 2,
        fontWeight: '800',
        color: '#ffffff',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 18, 28, 0.44)',
        paddingHorizontal: 22,
        justifyContent: 'center',
    },
    confirmModal: {
        borderRadius: 18,
        backgroundColor: '#ffffff',
        paddingHorizontal: 20,
        paddingVertical: 22,
        alignItems: 'center',
    },
    modalIconWrap: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#f7dddd',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#11131a',
    },
    modalText: {
        marginTop: 8,
        fontSize: 14,
        fontWeight: '600',
        color: '#666d7c',
        textAlign: 'center',
        lineHeight: 20,
    },
    modalButtonRow: {
        marginTop: 20,
        flexDirection: 'row',
        gap: 10,
    },
    modalButton: {
        flex: 1,
        height: 48,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCancelButton: {
        backgroundColor: '#e3e5ec',
        borderWidth: 1,
        borderColor: '#c4c9d5',
    },
    modalDeleteButton: {
        backgroundColor: '#d4463e',
    },
    modalCancelText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#575e6d',
    },
    modalDeleteText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#ffffff',
    },
    editModal: {
        maxHeight: '86%',
        borderRadius: 18,
        backgroundColor: '#ffffff',
        overflow: 'hidden',
    },
    editModalHeader: {
        minHeight: 58,
        paddingLeft: 20,
        paddingRight: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#d7dbe5',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    closeModalButton: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#edf0f6',
    },
    editFormScroll: {
        maxHeight: 470,
    },
    editFormContent: {
        padding: 20,
        paddingBottom: 10,
    },
    editLabel: {
        marginTop: 14,
        marginBottom: 9,
        fontSize: 16,
        fontWeight: '800',
        color: '#151922',
    },
    editInputWrap: {
        height: 54,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#c1c6d3',
        backgroundColor: '#f0f2f7',
        paddingHorizontal: 14,
        justifyContent: 'center',
    },
    editInput: {
        fontSize: 16,
        fontWeight: '700',
        color: '#11131a',
    },
    editPillGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    editPill: {
        minWidth: '30%',
        height: 44,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#c1c6d3',
        backgroundColor: '#f0f2f7',
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryEditPill: {
        minWidth: '46%',
        minHeight: 44,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#c1c6d3',
        backgroundColor: '#f0f2f7',
        paddingHorizontal: 12,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    editPillActive: {
        borderColor: '#315bd7',
        backgroundColor: '#dbe4ff',
    },
    editPillText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#4f5768',
        textAlign: 'center',
    },
    editPillTextActive: {
        color: '#1f3f9d',
    },
    editFooter: {
        borderTopWidth: 1,
        borderTopColor: '#d7dbe5',
        padding: 14,
        flexDirection: 'row',
        gap: 10,
    },
    editFooterButton: {
        flex: 1,
        height: 50,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    saveEditButton: {
        backgroundColor: '#315bd7',
    },
    saveEditButtonDisabled: {
        opacity: 0.55,
    },
    saveEditText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#ffffff',
    },
});
