// The two screens that run before a poker session exists: how many seats,
// then what the blinds and chips are. Split out of PokerScreen, where they sat
// as early returns inside a 1,600-line component and made the live-hand logic
// harder to find than it needed to be.
//
// They take explicit props rather than closing over the screen's state, so
// what each one actually depends on is visible in its signature.
import React from 'react';
import { Text, View, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { screenStyles } from '../constants/screenStyles';
import { moderateScale } from '../constants/layout';
import ConfirmModal from '../components/ConfirmModal';
import TrackerGuide from '../components/TrackerGuide';
import { styles } from './pokerScreenStyles';

export function PokerSetupPlayers({
  insets,
  navigation,
  playerCount,
  setPlayerCount,
  handleConfirmPlayerCount,
  // The screen owns the confirm dialog, since the same state backs prompts
  // raised from the live-hand views too.
  alertModal,
}) {
  const count = parseInt(playerCount, 10);
  const isValidCount = !isNaN(count) && count >= 2 && count <= 10;

  return (
    <View style={[screenStyles.container, { paddingTop: insets.top }]}>
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
          accessibilityRole="button"
          accessibilityLabel="Close setup and go home"
        >
          <Ionicons name="close" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <TrackerGuide gameType="Poker" navigation={navigation} />
        <View style={screenStyles.navTitleContainer}>
          <MaterialCommunityIcons name="cards-playing-outline" size={20} color={COLORS.primary} />
          <Text style={screenStyles.navTitle}>Poker Setup</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + moderateScale(40) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.sectionHeaderTitle}>How Many Players?</Text>
          <Text style={styles.cardSubtitle}>
            Enter the total number of players at the table, including yourself.
          </Text>

          <Text style={styles.label}>Players at the Table</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="e.g. 6"
            placeholderTextColor={COLORS.textMuted}
            value={playerCount}
            onChangeText={setPlayerCount}
            autoFocus
            maxLength={2}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            SHADOWS.card,
            !isValidCount && styles.submitButtonDisabled,
          ]}
          activeOpacity={0.85}
          disabled={!isValidCount}
          onPress={handleConfirmPlayerCount}
        >
          <Ionicons name="arrow-forward-circle" size={20} color={COLORS.textDark} style={{ marginRight: 8 }} />
          <Text style={styles.submitText}>Continue to Blinds</Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmModal visible={!!alertModal} {...alertModal} />
    </View>
  );
}

export function PokerSetupBlinds({
  insets,
  BLIND_MODES,
  blindMode,
  handleBlindModeSelect,
  smallBlind,
  setSmallBlind,
  bigBlind,
  setBigBlind,
  chipDenominations,
  setChipDenominations,
  currencySymbol,
  setSetupStep,
  handleFinishSetup,
}) {
  return (
    <View style={[screenStyles.container, { paddingTop: insets.top }]}>
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setSetupStep('players')}
          accessibilityRole="button"
          accessibilityLabel="Back to player count"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={screenStyles.navTitleContainer}>
          <MaterialCommunityIcons name="cards-playing-outline" size={20} color={COLORS.primary} />
          <Text style={screenStyles.navTitle}>Poker Setup</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + moderateScale(40) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.sectionHeaderTitle}>Table Blinds</Text>
          <Text style={styles.cardSubtitle}>
            Choose which blinds are in play, then type in your own stakes.
          </Text>

          {/* Blind Mode Selector */}
          <View style={styles.presetRow}>
            {BLIND_MODES.map((mode) => {
              const isSelected = blindMode === mode.key;
              return (
                <TouchableOpacity
                  key={mode.key}
                  style={[styles.presetButton, isSelected && styles.presetButtonActive]}
                  onPress={() => handleBlindModeSelect(mode.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {blindMode !== 'none' && (
            <View style={styles.customBlindRow}>
              {blindMode === 'both' && (
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Small Blind ({currencySymbol})</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor={COLORS.textMuted}
                    value={smallBlind}
                    onChangeText={setSmallBlind}
                  />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: blindMode === 'both' ? 8 : 0 }}>
                <Text style={styles.label}>Big Blind ({currencySymbol})</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="2"
                  placeholderTextColor={COLORS.textMuted}
                  value={bigBlind}
                  onChangeText={setBigBlind}
                />
              </View>
            </View>
          )}
        </View>

        {/* Quick-Chip Denominations */}
        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.sectionHeaderTitle}>Quick-Chip Denominations</Text>
          <Text style={styles.cardSubtitle}>
            These 6 chip increments will appear during your hand rounds. Tapping them will incrementally add to your bet.
          </Text>

          <View style={styles.chipConfigGrid}>
            {chipDenominations.map((chip, idx) => (
              <View key={idx} style={styles.chipConfigBox}>
                <Text style={styles.chipConfigLabel}>Chip {idx + 1}</Text>
                <View style={styles.chipInputWrapper}>
                  <Text style={styles.chipCurrencyPrefix}>{currencySymbol}</Text>
                  <TextInput
                    style={styles.chipConfigInput}
                    keyboardType="numeric"
                    value={chip}
                    onChangeText={(val) => {
                      const updated = [...chipDenominations];
                      updated[idx] = val;
                      setChipDenominations(updated);
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, SHADOWS.card]}
          activeOpacity={0.85}
          onPress={handleFinishSetup}
        >
          <Ionicons name="checkmark-circle" size={20} color={COLORS.textDark} style={{ marginRight: 8 }} />
          <Text style={styles.submitText}>Start Poker Session</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
