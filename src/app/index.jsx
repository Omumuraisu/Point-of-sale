import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import Lyrics from '../components/Lyrics';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>tE SaN O siYA mArEPLy</Text>
      <StatusBar style="auto" />
      <Lyrics />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
  },
});
