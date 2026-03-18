import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { styles } from './styles';

const LoginHeader = () => (
    <View style={styles.headerRow}>
        <View style={styles.logoCircle}>
            <MaterialCommunityIcons name="storefront" size={36} color="#ffffff" />
        </View>
        <View>
            <Text style={styles.headerTitle}>Point-of-Sale System</Text>
            <Text style={styles.headerSub}>Iloilo Terminal Market Vendors</Text>
        </View>
    </View>
);

export default LoginHeader;
