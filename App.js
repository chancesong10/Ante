import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';

export default function App() {
  const [betAmount, setBetAmount] = useState('');
  const [doubled, setDoubled] = useState(false);
  const [blackjack, setBlackjack] = useState(false);
  const [outcome, setOutcome] = useState(null); // 'win' | 'loss' | 'push'
  const [history, setHistory] = useState([]);

  const resetForm = () => {
    setBetAmount('');
    setDoubled(false);
    setBlackjack(false);
    setOutcome(null);
  };

  const submitHand = () => {
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0 || !outcome) return;

    let stake = doubled ? bet * 2 : bet;
    let netChange = 0;

    if (outcome === 'win') {
      netChange = blackjack ? stake * 1.5 : stake;
    } else if (outcome === 'loss') {
      netChange = -stake;
    } else {
      netChange = 0; // push
    }

    const hand = {
      id: Date.now(),
      bet,
      doubled,
      blackjack,
      outcome,
      netChange,
    };

    setHistory([hand, ...history]);
    resetForm();
  };

  const totalNet = history.reduce((sum, h) => sum + h.netChange, 0);
  const wins = history.filter(h => h.outcome === 'win').length;
  const losses = history.filter(h => h.outcome === 'loss').length;
  const pushes = history.filter(h => h.outcome === 'push').length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Blackjack Tracker</Text>

        {/* Stats summary */}
        <View style={styles.statsBox}>
          <Text style={[styles.netText, { color: totalNet >= 0 ? '#4ade80' : '#f87171' }]}>
            {totalNet >= 0 ? '+' : ''}{totalNet.toFixed(2)}
          </Text>
          <Text style={styles.statsSubtext}>Net (this session)</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statsRowText}>W: {wins}</Text>
            <Text style={styles.statsRowText}>L: {losses}</Text>
            <Text style={styles.statsRowText}>P: {pushes}</Text>
            <Text style={styles.statsRowText}>Hands: {history.length}</Text>
          </View>
        </View>

        {/* Bet input */}
        <Text style={styles.label}>Bet Amount</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="e.g. 25"
          placeholderTextColor="#888"
          value={betAmount}
          onChangeText={setBetAmount}
        />

        {/* Toggles */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, doubled && styles.toggleActive]}
            onPress={() => setDoubled(!doubled)}
          >
            <Text style={styles.toggleText}>Doubled Down</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleButton, blackjack && styles.toggleActive]}
            onPress={() => setBlackjack(!blackjack)}
          >
            <Text style={styles.toggleText}>Blackjack</Text>
          </TouchableOpacity>
        </View>

        {/* Outcome buttons */}
        <Text style={styles.label}>Outcome</Text>
        <View style={styles.outcomeRow}>
          <TouchableOpacity
            style={[styles.outcomeButton, outcome === 'win' && styles.winActive]}
            onPress={() => setOutcome('win')}
          >
            <Text style={styles.outcomeText}>Win</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.outcomeButton, outcome === 'loss' && styles.lossActive]}
            onPress={() => setOutcome('loss')}
          >
            <Text style={styles.outcomeText}>Loss</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.outcomeButton, outcome === 'push' && styles.pushActive]}
            onPress={() => setOutcome('push')}
          >
            <Text style={styles.outcomeText}>Push</Text>
          </TouchableOpacity>
        </View>

        {/* Submit */}
        <TouchableOpacity style={styles.submitButton} onPress={submitHand}>
          <Text style={styles.submitText}>Log Hand</Text>
        </TouchableOpacity>

        {/* History */}
        <Text style={styles.label}>History</Text>
        {history.map((h) => (
          <View key={h.id} style={styles.historyRow}>
            <Text style={styles.historyText}>
              ${h.bet}{h.doubled ? ' (2x)' : ''}{h.blackjack ? ' BJ' : ''} — {h.outcome.toUpperCase()}
            </Text>
            <Text style={[styles.historyNet, { color: h.netChange >= 0 ? '#4ade80' : '#f87171' }]}>
              {h.netChange >= 0 ? '+' : ''}{h.netChange.toFixed(2)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 16, textAlign: 'center' },
  statsBox: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 24 },
  netText: { fontSize: 40, fontWeight: 'bold' },
  statsSubtext: { color: '#94a3b8', marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 16 },
  statsRowText: { color: '#cbd5e1', fontSize: 14 },
  label: { color: '#cbd5e1', fontSize: 14, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#1e293b', color: '#fff', fontSize: 18, borderRadius: 10, padding: 12 },
  toggleRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  toggleButton: { flex: 1, backgroundColor: '#1e293b', borderRadius: 10, padding: 12, alignItems: 'center' },
  toggleActive: { backgroundColor: '#7c3aed' },
  toggleText: { color: '#fff', fontWeight: '600' },
  outcomeRow: { flexDirection: 'row', gap: 10 },
  outcomeButton: { flex: 1, backgroundColor: '#1e293b', borderRadius: 10, padding: 14, alignItems: 'center' },
  winActive: { backgroundColor: '#16a34a' },
  lossActive: { backgroundColor: '#dc2626' },
  pushActive: { backgroundColor: '#64748b' },
  outcomeText: { color: '#fff', fontWeight: 'bold' },
  submitButton: { backgroundColor: '#7c3aed', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1e293b', borderRadius: 8, padding: 12, marginBottom: 8 },
  historyText: { color: '#e2e8f0' },
  historyNet: { fontWeight: 'bold' },
});