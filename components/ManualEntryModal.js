import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function ManualEntryModal({ visible, onClose, onSave }) {
  const [gameType, setGameType] = useState('Blackjack');
  const [venue, setVenue] = useState('');
  const [buyIn, setBuyIn] = useState('');
  const [cashOut, setCashOut] = useState('');
  const [notes, setNotes] = useState('');

  const buyInNum = parseFloat(buyIn) || 0;
  const cashOutNum = parseFloat(cashOut) || 0;
  const net = cashOutNum - buyInNum;
  const isPositive = net >= 0;

  const games = ['Blackjack', 'Poker', 'Baccarat', 'Craps', 'Roulette'];

  const handleSave = () => {
    if (!buyIn || !cashOut) return;
    if (onSave) {
      onSave({
        gameType,
        venue: venue || 'Local Casino',
        buyIn: `$${buyInNum}`,
        cashOut: `$${cashOutNum}`,
        net: `${isPositive ? '+' : ''}$${net.toFixed(2)}`,
        positive: isPositive,
        date: 'Just now',
        notes,
      });
    }
    setBuyIn('');
    setCashOut('');
    setVenue('');
    setNotes('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.sheetContainer}>
          <View style={styles.handleBar} />
          
          <View style={styles.headerRow}>
            <Text style={styles.title}>Manual Session Entry</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.formScroll}>
            {/* Game Selector */}
            <Text style={styles.label}>Game Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gameChips}>
              {games.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.gameChip, gameType === g && styles.gameChipActive]}
                  onPress={() => setGameType(g)}
                >
                  <Text
                    style={[
                      styles.gameChipText,
                      gameType === g && styles.gameChipTextActive,
                    ]}
                  >
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Venue / Location */}
            <Text style={styles.label}>Casino / Venue</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Bellagio, Caesars, Home Game"
              placeholderTextColor={COLORS.textMuted}
              value={venue}
              onChangeText={setVenue}
            />

            {/* Amounts Row */}
            <View style={styles.amountRow}>
              <View style={styles.amountCol}>
                <Text style={styles.label}>Buy-In ($)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="500"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  value={buyIn}
                  onChangeText={setBuyIn}
                />
              </View>

              <View style={styles.amountCol}>
                <Text style={styles.label}>Cash-Out ($)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="850"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  value={cashOut}
                  onChangeText={setCashOut}
                />
              </View>
            </View>

            {/* Calculated Net Preview */}
            {(buyIn || cashOut) && (
              <View style={styles.netPreviewCard}>
                <Text style={styles.netPreviewLabel}>CALCULATED NET PROFIT</Text>
                <Text
                  style={[
                    styles.netPreviewAmount,
                    { color: isPositive ? COLORS.primary : COLORS.danger },
                  ]}
                >
                  {isPositive ? '+' : ''}${net.toFixed(2)}
                </Text>
              </View>
            )}

            {/* Notes */}
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Shoe penetration, table min, dealer comments..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={2}
              value={notes}
              onChangeText={setNotes}
            />

            {/* Submit */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                (!buyIn || !cashOut) && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!buyIn || !cashOut}
            >
              <Text style={styles.saveButtonText}>Save Session Record</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  sheetContainer: {
    backgroundColor: COLORS.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderBottomWidth: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '88%',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.cardBorder,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formScroll: {
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 10,
  },
  gameChips: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  gameChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  gameChipActive: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  gameChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  gameChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  amountRow: {
    flexDirection: 'row',
    gap: 12,
  },
  amountCol: {
    flex: 1,
  },
  netPreviewCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  netPreviewLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  netPreviewAmount: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  notesInput: {
    height: 60,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.cardBorder,
    opacity: 0.5,
  },
  saveButtonText: {
    color: COLORS.textDark,
    fontSize: 15,
    fontWeight: '800',
  },
});
