import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── Sub-components ────────────────────────────────────────────────

const LoginHeader = () => (
  <View style={styles.headerRow}>
    <View style={styles.logoCircle}>
      {/* TODO: Add your store icon here later, e.g. with react-native-vector-icons */}
    </View>
    <View>
      <Text style={styles.headerTitle}>Point-of-Sale System</Text>
      <Text style={styles.headerSub}>Iloilo Terminal Market Vendors</Text>
    </View>
  </View>
);

const LoginGreet = () => (
  <View style={styles.greetContainer}>
    <Text style={styles.greetTitle}>Maayong Adlaw!</Text>
    <Text style={styles.greetSub}>Login to manage your sales</Text>
  </View>
);

const LoginForm = () => {
  const [phoneNum, setphoneNum] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    if (!phoneNum || !password) {
      // TODO: Replace with a proper toast/alert component
      alert('Please fill in all fields.');
      return;
    }
    // TODO: Wire up to your authentication API here
    alert(`Logging in as: ${phoneNum}`);
  };

  return (
    <View style={styles.formCard}>
      {/* Username */}
      <Text style={styles.label}>Phone Number</Text>
      <View style={styles.inputWrapper}>
        {/* Icon placeholder — add icon here later */}
        <TextInput
          style={styles.input}
          placeholder="Enter your phone number"
          placeholderTextColor="#aaa"
          value={phoneNum}
          onChangeText={setphoneNum}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Password */}
      <Text style={styles.label}>Password</Text>
      <View style={styles.inputWrapper}>
        {/* Icon placeholder — add icon here later */}
        <TextInput
          style={styles.input}
          placeholder="Enter your password"
          placeholderTextColor="#aaa"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          onPress={() => setShowPassword((v) => !v)}
          accessibilityLabel="Toggle password visibility"
        >
          {/* Icon placeholder — add eye icon here later */}
          <Text style={styles.showHideText}>{showPassword ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
      </View>

      {/* Forgot password */}
      <View style={styles.forgotRow}>
        <TouchableOpacity>
          <Text style={styles.forgotLink}>Forgot password?</Text>
        </TouchableOpacity>
      </View>

      {/* Login button */}
      <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
        <Text style={styles.loginBtnText}>Login</Text>
      </TouchableOpacity>
    </View>
  );
};

// ── Main Component ────────────────────────────────────────────────

const Login = () => (
  <SafeAreaView style={styles.screen}>
    <LoginHeader />
    <LoginGreet />
    <LoginForm />
  </SafeAreaView>
);

export default Login;

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#eef0f8',
    paddingHorizontal: 24,
    paddingTop: 40,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 28,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2952E3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '700',
    fontSize: 17,
    color: '#111',
  },
  headerSub: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
  },

  // Greet
  greetContainer: {
    marginBottom: 24,
  },
  greetTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111',
  },
  greetSub: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },

  // Form card
  formCard: {
    backgroundColor: '#2952E3',
    borderRadius: 24,
    padding: 24,
  },
  label: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 8,
  },
  inputWrapper: {
    backgroundColor: '#f5f5f5',
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
    height: 48,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  showHideText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: 24,
    marginTop: -10,
  },
  forgotLink: {
    color: '#cdd9ff',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  loginBtn: {
    backgroundColor: '#e8e4d8',
    borderRadius: 50,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2952E3',
    letterSpacing: 0.5,
  },
});