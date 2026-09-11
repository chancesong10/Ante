import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import SegmentedPicker from './SegmentedPicker';
import { MIN_DECKS, MAX_DECKS, isDeckCount } from '../utils/blackjackStrategy';

const CARD_ENTRY_OPTIONS = [
  { value: false, label: 'Off', sub: 'Quick log' },
  { value: true, label: 'On', sub: 'Strategy checks' },
];

const PAYOUT_OPTIONS = [
  { value: '3:2', label: '3:2', sub: 'Standard' },
  { value: '6:5', label: '6:5', sub: '+1.4% edge' },
];

const SOFT17_OPTIONS = [
  { value: false, label: 'Stands', sub: 'S17' },
  { value: true, label: 'Hits', sub: 'H17' },
];

const SURRENDER_OPTIONS = [
  { value: false, label: 'Not offered' },
  { value: true, label: 'Allowed' },
];

// Options for the Blackjack tracker: whether to enter cards, and the table's
// rules. The rules decide what basic strategy says and what a blackjack pays;
// every logged hand keeps a copy of the rules it was played under, so changing
// them never rewrites history.
export default function BlackjackOptionsSheet({ visible, rules, cardEntry, onChangeRules, onChangeCardEntry, onClose }) {
  const insets = useSafeAreaInsets();

  // The deck field keeps its own draft so it can sit empty or hold a bad digit
  // while typing; only a valid count is saved.
  const [deckDraft, setDeckDraft] = useState(String(rules.decks));
  useEffect(() => {
    setDeckDraft(String(rules.decks));
  }, [rules.decks, visible]);

  const deckDraftValid = isDeckCount(deckDraft);

  const handleDeckText = (text) => {
    const digits = text.replace(/[^0-9]/g, '');
    setDeckDraft(digits);
    if (isDeckCount(digits)) onChangeRules({ decks: Number(digits) });
  };

  const stepDecks = (delta) => {
    const next = Math.min(MAX_DECKS, Math.max(MIN_DECKS, rules.decks + delta));
    if (next !== rules.decks) onChangeRules({ decks: next });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheet,
                { paddingBottom: insets.bottom > 0 ? insets.bottom + moderateScale(12) : moderateScale(20) },
              ]}
            >
              <View style={styles.handle} />

              <View style={styles.header}>
                <Text style={styles.title}>Options</Text>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  hitSlop={TOUCH_TARGET.hitSlop}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={20} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Enter cards</Text>
              <Text style={styles.fieldHint}>
                Show "Dealer shows" and "Your cards" so each hand can be checked against basic strategy.
              </Text>
              <SegmentedPicker options={CARD_ENTRY_OPTIONS} value={cardEntry} onChange={onChangeCardEntry} />

              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Table rules</Text>

              <Text style={styles.fieldLabel}>Decks</Text>
              <View style={styles.deckRow}>
                <TouchableOpacity
                  style={[styles.stepBtn, rules.decks <= MIN_DECKS && styles.stepBtnDisabled]}
                  onPress={() => stepDecks(-1)}
                  disabled={rules.decks <= MIN_DECKS}
                  accessibilityRole="button"
                  accessibilityLabel="One fewer deck"
                >
                  <Ionicons name="remove" size={18} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.deckInput, !deckDraftValid && styles.deckInputInvalid]}
                  value={deckDraft}
                  onChangeText={handleDeckText}
                  onBlur={() => {
                    if (!deckDraftValid) setDeckDraft(String(rules.decks));
                  }}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  accessibilityLabel="Number of decks"
                />
                <TouchableOpacity
                  style={[styles.stepBtn, rules.decks >= MAX_DECKS && styles.stepBtnDisabled]}
                  onPress={() => stepDecks(1)}
                  disabled={rules.decks >= MAX_DECKS}
                  accessibilityRole="button"
                  accessibilityLabel="One more deck"
                >
                  <Ionicons name="add" size={18} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.deckHint, !deckDraftValid && { color: COLORS.warning }]}>
                  {deckDraftValid ? `deck${Number(deckDraft) === 1 ? '' : 's'}` : `Enter ${MIN_DECKS} to ${MAX_DECKS}`}
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Blackjack pays</Text>
              <SegmentedPicker options={PAYOUT_OPTIONS} value={rules.payout} onChange={(payout) => onChangeRules({ payout })} />

              <Text style={styles.fieldLabel}>Dealer on soft 17</Text>
              <SegmentedPicker
                options={SOFT17_OPTIONS}
                value={rules.dealerHitsSoft17}
                onChange={(dealerHitsSoft17) => onChangeRules({ dealerHitsSoft17 })}
              />

              <Text style={styles.fieldLabel}>Late surrender</Text>
              <SegmentedPicker
                options={SURRENDER_OPTIONS}
                value={rules.surrender}
                onChange={(surrender) => onChangeRules({ surrender })}
              />

              <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85} accessibilityRole="button">
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.backgroundSecondary,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.cardBorder,
    paddingTop: moderateScale(12),
    paddingHorizontal: SPACING.pageHorizontal,
  },
  handle: {
    width: moderateScale(40),
    height: moderateScale(4),
    borderRadius: moderateScale(2),
    backgroundColor: COLORS.cardBorder,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  title: { fontSize: fluidFont(20), fontWeight: '700', color: COLORS.textPrimary },
  closeBtn: {
    width: moderateScale(34),
    height: moderateScale(34),
    borderRadius: moderateScale(17),
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: fluidFont(15), fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  fieldLabel: {
    fontSize: fluidFont(11),
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldHint: { fontSize: fluidFont(12), color: COLORS.textSecondary, lineHeight: fluidFont(17), marginBottom: 8 },
  divider: { height: 1, backgroundColor: COLORS.cardBorder, marginBottom: SPACING.md },
  deckRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  stepBtn: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.35 },
  deckInput: {
    width: moderateScale(56),
    height: moderateScale(40),
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorderHighlight,
    color: COLORS.textPrimary,
    fontSize: fluidFont(18),
    fontWeight: '700',
    textAlign: 'center',
    padding: 0,
  },
  deckInputInvalid: { borderColor: COLORS.warningBorder },
  deckHint: { fontSize: fluidFont(13), color: COLORS.textSecondary, fontWeight: '600' },
  doneBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(13),
    alignItems: 'center',
    marginTop: 4,
  },
  doneText: { color: COLORS.textDark, fontWeight: '700', fontSize: fluidFont(15) },
});
