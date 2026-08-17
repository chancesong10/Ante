import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';

const emptyHand = () => ({ betAmount: '', doubled: false, blackjack: false, outcome: null });

export default function BlackjackScreen({ navigation }) {
  const [betAmount, setBetAmount] = useState('');
  const [doubled, setDoubled] = useState(false);
  const [blackjack, setBlackjack] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [split, setSplit] = useState(false);

  const [splitHand1, setSplitHand1] = useState(emptyHand());
  const [splitHand2, setSplitHand2] = useState(emptyHand());

  const [history, setHistory] = useState([]);

  const resetForm = () => {
    setBetAmount('');
    setDoubled(false);
    setBlackjack(false);
    setOutcome(null);
    setSplit(false);
    setSplitHand1(emptyHand());
    setSplitHand2(emptyHand());
  };

  const toggleSplit = () => {
    if (!split) {
      // entering split mode: prefill both hands with the main bet amount
      setSplitHand1({ ...emptyHand(), betAmount });
      setSplitHand2({ ...emptyHand(), betAmount });
    }
    setSplit(!split);
  };

  const calcNet = (bet, doubledFlag, blackjackFlag, outcomeVal) => {
    let stake = doubledFlag ? bet * 2 : bet;
    if (outcomeVal === 'win') return blackjackFlag ? stake * 1.5 : stake;
    if (outcomeVal === 'loss') return -stake;
    return 0; // push
  };

  const submitHand = () => {
    if (split) {
      const bet1 = parseFloat(splitHand1.betAmount);
      const bet2 = parseFloat(splitHand2.betAmount);
      if (isNaN(bet1) || bet1 <= 0 || !splitHand1.outcome) return;
      if (isNaN(bet2) || bet2 <= 0 || !splitHand2.outcome) return;

      const hand1 = {
        bet: bet1,
        doubled: splitHand1.doubled,
        blackjack: splitHand1.blackjack,
        outcome: splitHand1.outcome,
        netChange: calcNet(bet1, splitHand1.doubled, splitHand1.blackjack, splitHand1.outcome),
      };
      const hand2 = {
        bet: bet2,
        doubled: splitHand2.doubled,
        blackjack: splitHand2.blackjack,
        outcome: splitHand2.outcome,
        netChange: calcNet(bet2, splitHand2.doubled, splitHand2.blackjack, splitHand2.outcome),
      };

      const record = {
        id: Date.now(),
        type: 'split',
        hands: [hand1, hand2],
      };

      setHistory([record, ...history]);
      resetForm();
      return;
    }

    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0 || !outcome) return;

    const record = {
      id: Date.now(),
      type: 'single',
      bet,
      doubled,
      blackjack,
      outcome,
      netChange: calcNet(bet, doubled, blackjack, outcome),
    };

    setHistory([record, ...history]);
    resetForm();
  };

  // Flatten all individual hands (single + both sides of splits) for stats
  const allHands = history.flatMap(r => (r.type === 'split' ? r.hands : [r]));
  const totalNet = allHands.reduce((sum, h) => sum + h.netChange, 0);
  const wins = allHands.filter(h => h.outcome === 'win').length;
  const losses = allHands.filter(h => h.outcome === 'loss').length;
  const pushes = allHands.filter(h => h.outcome === 'push').length;

  const updateSplitHand = (which, field, value) => {
    const setter = which === 1 ? setSplitHand1 : setSplitHand2;
    const current = which === 1 ? splitHand1 : splitHand2;
    setter({ ...current, [field]: value });
  };

  const renderOutcomeRow = (currentOutcome, onSelect) => (
    <View style={styles.outcomeRow}>
      <TouchableOpacity
        style={[styles.outcomeButton, currentOutcome === 'win' && styles.winActive]}
        onPress={() => onSelect('win')}
      >
        <Text style={styles.outcomeText}>Win</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.outcomeButton, currentOutcome === 'loss' && styles.lossActive]}
        onPress={() => onSelect('loss')}
      >
        <Text style={styles.outcomeText}>Loss</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.outcomeButton, currentOutcome === 'push' && styles.pushActive]}
        onPress={() => onSelect('push')}
      >
        <Text style={styles.outcomeText}>Push</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSplitHandForm = (which) => {
    const hand = which === 1 ? splitHand1 : splitHand2;
    return (
      <View style={styles.splitHandBox}>
        <Text style={styles.splitHandTitle}>Hand {which}</Text>

        <Text style={styles.label}>Bet Amount</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="e.g. 25"
          placeholderTextColor="#888"
          value={hand.betAmount}
          onChangeText={(v) => updateSplitHand(which, 'betAmount', v)}
        />

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, hand.doubled && styles.toggleActive]}
            onPress={() => updateSplitHand(which, 'doubled', !hand.doubled)}
          >
            <Text style={styles.toggleText}>Doubled Down</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleButton, hand.blackjack && styles.toggleActive]}
            onPress={() => updateSplitHand(which, 'blackjack', !hand.blackjack)}
          >
            <Text style={styles.toggleText}>Blackjack</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Outcome</Text>
        {renderOutcomeRow(hand.outcome, (val) => updateSplitHand(which, 'outcome', val))}
      </View>
    );
  };

  const canSubmitSplit =
    splitHand1.betAmount && splitHand1.outcome && splitHand2.betAmount && splitHand2.outcome;
  const canSubmitSingle = betAmount && outcome;

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
            <Text style={styles.statsRowText}>Hands: {allHands.length}</Text>
          </View>
        </View>

        {/* Split toggle — always visible */}
        <TouchableOpacity
          style={[styles.splitToggleButton, split && styles.splitToggleActive]}
          onPress={toggleSplit}
        >
          <Text style={styles.toggleText}>{split ? '✕ Cancel Split' : 'Split Hand'}</Text>
        </TouchableOpacity>

        {!split ? (
          <>
            {/* Normal single-hand form */}
            <Text style={styles.label}>Bet Amount</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="e.g. 25"
              placeholderTextColor="#888"
              value={betAmount}
              onChangeText={setBetAmount}
            />

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

            <Text style={styles.label}>Outcome</Text>
            {renderOutcomeRow(outcome, setOutcome)}
          </>
        ) : (
          <>
            {/* Split mode: two independent hand forms */}
            {renderSplitHandForm(1)}
            {renderSplitHandForm(2)}
          </>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            !(split ? canSubmitSplit : canSubmitSingle) && styles.submitDisabled,
          ]}
          onPress={submitHand}
          disabled={!(split ? canSubmitSplit : canSubmitSingle)}
        >
          <Text style={styles.submitText}>{split ? 'Log Split Hands' : 'Log Hand'}</Text>
        </TouchableOpacity>

        {/* History */}
        <Text style={styles.label}>History</Text>
        {history.map((r) => {
          if (r.type === 'split') {
            const groupNet = r.hands[0].netChange + r.hands[1].netChange;
            return (
              <View key={r.id} style={styles.splitGroupBox}>
                <Text style={styles.splitGroupLabel}>SPLIT</Text>
                {r.hands.map((h, i) => (
                  <View key={i} style={styles.historyRow}>
                    <Text style={styles.historyText}>
                      ${h.bet}{h.doubled ? ' (2x)' : ''}{h.blackjack ? ' BJ' : ''} — {h.outcome.toUpperCase()}
                    </Text>
                    <Text style={[styles.historyNet, { color: h.netChange >= 0 ? '#4ade80' : '#f87171' }]}>
                      {h.netChange >= 0 ? '+' : ''}{h.netChange.toFixed(2)}
                    </Text>
                  </View>
                ))}
                <View style={styles.splitGroupTotalRow}>
                  <Text style={styles.splitGroupTotalLabel}>Combined</Text>
                  <Text style={[styles.historyNet, { color: groupNet >= 0 ? '#4ade80' : '#f87171' }]}>
                    {groupNet >= 0 ? '+' : ''}{groupNet.toFixed(2)}
                  </Text>
                </View>
              </View>
            );
          }

          return (
            <View key={r.id} style={styles.historyRow}>
              <Text style={styles.historyText}>
                ${r.bet}{r.doubled ? ' (2x)' : ''}{r.blackjack ? ' BJ' : ''} — {r.outcome.toUpperCase()}
              </Text>
              <Text style={[styles.historyNet, { color: r.netChange >= 0 ? '#4ade80' : '#f87171' }]}>
                {r.netChange >= 0 ? '+' : ''}{r.netChange.toFixed(2)}
              </Text>
            </View>
          );
        })}
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
  toggleText: { color: '#fff', fontWeight: '600', fontSize: 13, textAlign: 'center' },
  splitToggleButton: { backgroundColor: '#334155', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8, marginBottom: 4 },
  splitToggleActive: { backgroundColor: '#b45309' },
  outcomeRow: { flexDirection: 'row', gap: 10 },
  outcomeButton: { flex: 1, backgroundColor: '#1e293b', borderRadius: 10, padding: 14, alignItems: 'center' },
  winActive: { backgroundColor: '#16a34a' },
  lossActive: { backgroundColor: '#dc2626' },
  pushActive: { backgroundColor: '#64748b' },
  outcomeText: { color: '#fff', fontWeight: 'bold' },
  submitButton: { backgroundColor: '#7c3aed', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  submitDisabled: { backgroundColor: '#475569', opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1e293b', borderRadius: 8, padding: 12, marginBottom: 8 },
  historyText: { color: '#e2e8f0' },
  historyNet: { fontWeight: 'bold' },
  splitHandBox: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#b45309' },
  splitHandTitle: { color: '#fbbf24', fontWeight: 'bold', fontSize: 15, marginBottom: 4 },
  splitGroupBox: { backgroundColor: '#2a1e0f', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#b45309' },
  splitGroupLabel: { color: '#fbbf24', fontWeight: 'bold', fontSize: 12, marginBottom: 6, letterSpacing: 1 },
  splitGroupTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: '#78350f' },
  splitGroupTotalLabel: { color: '#fbbf24', fontWeight: '600' },
});