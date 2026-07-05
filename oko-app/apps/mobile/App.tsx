import { StatusBar } from 'expo-status-bar';
import { Text, View, StyleSheet } from 'react-native';
import { theme } from './src/theme/index';

// Каркас ядра. Экраны (Чаты / Лента / Мини-аппы / Профиль) подключаются
// через @react-navigation в дни 1-5 плана.
export default function App() {
  return (
    <View style={styles.root}>
      <Text style={styles.logo}>OKO</Text>
      <Text style={styles.tagline}>одно приложение — медийность, контент, маркетинг и бизнес</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { color: theme.colors.lime, fontSize: 64, fontWeight: '700', letterSpacing: 8 },
  tagline: { color: theme.colors.textDim, marginTop: 12, textAlign: 'center', paddingHorizontal: 40 },
});
