import { SafeAreaView } from 'react-native-safe-area-context';
import LoginHeader from './components/LoginHeader';
import LoginGreeting from './components/LoginGreeting';
import LoginForm from './components/LoginForm';
import { styles } from './components/styles';

// ── Main Component ────────────────────────────────────────────────

const Login = () => (
  <SafeAreaView style={styles.screen}>
    <LoginHeader />
    <LoginGreeting />
    <LoginForm />
  </SafeAreaView>
);

export default Login;
