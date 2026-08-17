import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ante</Text>

      <TouchableOpacity
        style={styles.bubble}
        onPress={() => navigation.navigate('Blackjack')}
      >
        <Text style={styles.bubbleText}>Blackjack</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.bubble, styles.historyBubble]}
        onPress={() => navigation.navigate('History')}
      >
        <Text style={styles.bubbleText}>History</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', gap: 20 },
  title: { fontSize: 48, fontWeight: 'bold', color: '#fff', marginBottom: 40 },
  bubble: { backgroundColor: '#7c3aed', width: 200, paddingVertical: 20, borderRadius: 100, alignItems: 'center' },
  historyBubble: { backgroundColor: '#334155' },
  bubbleText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});