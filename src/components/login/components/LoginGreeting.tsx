import { View, Text } from 'react-native';
import { styles } from './styles';

const LoginGreeting = () => (
    <View style={styles.greetContainer}>
        <Text style={styles.greetTitle}>Maayong Adlaw!</Text>
        <Text style={styles.greetSub}>Login to manage your sales</Text>
    </View>
);

export default LoginGreeting;
