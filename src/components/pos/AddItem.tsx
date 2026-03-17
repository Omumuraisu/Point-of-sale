import { useMemo, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddCartItemPayload } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'];

interface AddItemScreenProps {
    productName?: string;
    categoryLabel?: string;
    pricePerKg?: number;
    onBack: () => void;
    onAdd: (payload: AddCartItemPayload) => void;
}

const AddItemScreen = ({
    productName = 'Product',
    categoryLabel = 'Category',
    pricePerKg = 0,
    onBack,
    onAdd,
}: AddItemScreenProps) => {
    const insets = useSafeAreaInsets();
    const [quantityInput, setQuantityInput] = useState('');

    const quantityValue = useMemo(() => {
        const parsed = Number.parseFloat(quantityInput);
        return Number.isFinite(parsed) ? parsed : 0;
    }, [quantityInput]);

    const totalAmount = useMemo(
        () => quantityValue * Number(pricePerKg || 0),
        [pricePerKg, quantityValue],
    );

    const canAdd = quantityValue > 0;

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
            unit: 'kg',
            pricePerKg: Number(pricePerKg || 0),
            total: totalAmount,
        });
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
                    <Text style={styles.productText}>{productName}</Text>

                    <Text style={styles.sectionLabel}>Price per kg</Text>
                    <View style={styles.priceBox}>
                        <Text style={styles.priceText}>{formatCurrency(Number(pricePerKg || 0))}</Text>
                    </View>

                    <View style={styles.totalBox}>
                        <Text style={styles.totalLabel}>Total Amount</Text>
                        <Text style={styles.totalText}>{formatCurrency(totalAmount)}</Text>
                    </View>
                </View>

                <View style={styles.keyboardWrap}>
                    <Text style={styles.qtyHint}>Quantity (kg): {quantityInput || '0'}</Text>

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
        marginTop: 8,
        fontSize: 52 / 2,
        fontWeight: '800',
        color: '#11131a',
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
});
