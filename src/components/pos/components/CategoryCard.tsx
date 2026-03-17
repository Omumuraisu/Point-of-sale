import { Pressable, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CategoryType } from '../../../lib/types';

interface CategoryCardProps {
    item: CategoryType;
    onPress: (item: CategoryType) => void;
}

const CategoryCard = ({ item, onPress }: CategoryCardProps) => (
    <Pressable
        style={[
            styles.card,
            { backgroundColor: item.bgColor, borderColor: item.borderColor },
        ]}
        onPress={() => onPress(item)}
    >
        <MaterialCommunityIcons name={item.icon as any} size={58} color={item.textColor} />
        <Text style={[styles.cardText, { color: item.textColor }]}>{item.label}</Text>
    </Pressable>
);

export default CategoryCard;

const styles = StyleSheet.create({
    card: {
        width: '48%',
        aspectRatio: 1,
        borderRadius: 24,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#000000',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 4,
        elevation: 3,
    },
    cardText: {
        fontSize: 10.5,
        fontWeight: '700',
    },
});
