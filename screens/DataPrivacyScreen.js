// Data & privacy: what the app keeps, how to get it out, and how to destroy
// it. Split out of ProfileScreen, which was implementing this inline while
// Legal and subscription management already had screens of their own — so the
// convention existed, these rows just predated it.
//
// The split matters more here than as tidiness. "Erase All Data" is
// irreversible, and it was sharing a 26-variable state scope with quick-chip
// presets and a haptics toggle. Now the only state on this screen is the
// state this screen's actions use.
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { COLORS, SHADOWS } from '../constants/theme';
import { screenStyles } from '../constants/screenStyles';
import { moderateScale } from '../constants/layout';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import { useVisibleSessionHistory } from '../context/SyncContext';
import { getOrCreateDeviceId } from '../services/storageService';
import { exportSessionsCsv } from '../utils/exportSessions';
import ConfirmModal from '../components/ConfirmModal';
import Toggle from '../components/Toggle';
import { PLUS_NAME } from '../constants/brand';
import { styles } from './profileScreenStyles';
import useFlash from '../components/useFlash';

export default function DataPrivacyScreen({ navigation }) {
  const { privacyMode = false, updatePreferences } = usePreferences();
  const { user } = useAuth();
  const { sessionHistory, clearAllSessions } = useVisibleSessionHistory();

  const [deviceId, setDeviceId] = useState('ante_vault_seed');
  const [copiedSeed, flashCopiedSeed] = useFlash(false, 2500);
  const [exporting, setExporting] = useState(false);
  const [dataModal, setDataModal] = useState(null);
  const [notice, flashNotice] = useFlash(null, 2600);

  useEffect(() => {
    (async () => {
      const id = await getOrCreateDeviceId();
      if (id) setDeviceId(id);
    })();
  }, []);

  const handleCopySeed = async () => {
    await Clipboard.setStringAsync(deviceId);
    flashCopiedSeed(true);
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { message } = await exportSessionsCsv(sessionHistory);
      if (message) flashNotice(message);
    } finally {
      setExporting(false);
    }
  };

  const handleClearData = () => {
    setDataModal({
      variant: 'danger',
      icon: 'trash-outline',
      title: 'Erase all session data?',
      message: `This permanently deletes all ${sessionHistory.length} recorded sessions from this device${user ? ' and from your account' : ''}. Your preferences and ${PLUS_NAME} membership are not affected. This cannot be undone.`,
      confirmText: 'Erase Everything',
      cancelText: 'Cancel',
      onConfirm: () => {
        clearAllSessions();
        setDataModal(null);
        flashNotice('All session data erased.');
      },
      onCancel: () => setDataModal(null),
    });
  };

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to profile"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={screenStyles.navTitle}>Data & Privacy</Text>
        <View style={styles.backBtnSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.menuCard, SHADOWS.card]}>
          {/* Hide Amounts. Lives here rather than only above the vault grid,
              which made an app-wide preference look scoped to that grid. */}
          <View style={styles.menuRow}>
            <View style={styles.menuIconCircle}>
              <Ionicons
                name={privacyMode ? 'eye-off-outline' : 'eye-outline'}
                size={moderateScale(18)}
                color={COLORS.accentCyan}
              />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Hide Amounts</Text>
              <Text style={styles.menuSubtitle}>
                Masks every figure app-wide. Live bets and pots stay visible so trackers
                remain usable.
              </Text>
            </View>
            <Toggle
              value={privacyMode}
              onValueChange={(val) => updatePreferences?.({ privacyMode: val })}
              accessibilityLabel="Hide amounts"
            />
          </View>

          <View style={styles.menuDivider} />

          {/* Device Anonymous ID */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={handleCopySeed}
            accessibilityRole="button"
            accessibilityLabel="Copy device seed"
          >
            <View style={styles.menuIconCircle}>
              <Ionicons name="finger-print-outline" size={moderateScale(18)} color={COLORS.accentViolet} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Vault Device Seed</Text>
              <Text style={styles.menuSubtitle} numberOfLines={1}>
                {deviceId.slice(0, 18)}...
              </Text>
            </View>
            <View style={styles.copyBadge}>
              <Ionicons
                name={copiedSeed ? 'checkmark' : 'copy-outline'}
                size={14}
                color={copiedSeed ? COLORS.success : COLORS.primary}
              />
              <Text style={[styles.copyBadgeText, copiedSeed && { color: COLORS.success }]}>
                {copiedSeed ? 'Copied' : 'Copy'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* CSV, because the point of exporting is to open it in a spreadsheet. */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={handleExport}
            disabled={exporting}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons
                name="download-outline"
                size={moderateScale(18)}
                color={COLORS.accentCyan}
              />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Export Session History</Text>
              <Text style={styles.menuSubtitle}>
                {sessionHistory.length > 0
                  ? `${sessionHistory.length} session${sessionHistory.length === 1 ? '' : 's'} as a CSV file`
                  : 'Nothing recorded yet'}
              </Text>
            </View>
            {exporting ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
            )}
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={handleClearData}>
            <View style={[styles.menuIconCircle, styles.menuIconCircleDanger]}>
              <Ionicons name="trash-outline" size={moderateScale(18)} color={COLORS.danger} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={[styles.menuTitle, { color: COLORS.danger }]}>Erase All Data</Text>
              <Text style={styles.menuSubtitle}>Permanently delete every recorded session</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {!!notice && (
          <View style={styles.noticeRow}>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}
      </ScrollView>

      <ConfirmModal visible={!!dataModal} {...dataModal} />
    </SafeAreaView>
  );
}
