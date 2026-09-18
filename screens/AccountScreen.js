// Account management: username, password, and deleting the account.
//
// Split out of ProfileScreen, which implemented all of this inline while
// Legal and subscription management already had screens of their own. The
// convention existed; these rows just predated it.
//
// Deleting an account is the most destructive thing the app can do —
// irreversible, calls a security-definer RPC, and re-proves identity first.
// It was sharing a 26-variable state scope with quick-chip presets and a
// haptics toggle. Everything this screen holds is now something this screen
// uses.
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { screenStyles } from '../constants/screenStyles';
import { moderateScale, SPACING, TOUCH_TARGET } from '../constants/layout';
import { useAuth } from '../context/AuthContext';
import { useSessionHistory } from '../context/SessionContext';
import ConfirmModal from '../components/ConfirmModal';
import { PLUS_NAME } from '../constants/brand';
import { styles } from './profileScreenStyles';

export default function AccountScreen({ navigation }) {
  const {
    user,
    profile,
    hasPasswordLogin,
    updateUsername,
    updatePasswordWithCurrent,
    updatePasswordWithCode,
    sendPasswordChangeCode,
    deleteAccount,
  } = useAuth();
  const { releaseAccountSessions } = useSessionHistory();

  const [accountModal, setAccountModal] = useState(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [tempUsername, setTempUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState(null);
  const [accountNotice, setAccountNotice] = useState(null);
  // Result dialog after a delete. Named for what it is rather than inherited
  // from Profile's shared `dataModal`, which now lives on Data & Privacy.
  const [resultModal, setResultModal] = useState(null);

  const openUsernameModal = () => {
    setTempUsername(profile?.username || '');
    setAccountError(null);
    setAccountModal('username');
  };

  const openPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setVerifyCode('');
    setCodeSent(false);
    setAccountError(null);
    setAccountModal('password');
  };

  const openDeleteAccountModal = () => {
    setCurrentPassword('');
    setDeleteConfirmEmail('');
    setAccountError(null);
    setAccountModal('delete');
  };

  // Case/whitespace-insensitive: this is a confirmation of intent, not a
  // password, and failing someone over a capital letter in their own email
  // address would just teach them to paste it.
  const deleteEmailMatches =
    !!user?.email && deleteConfirmEmail.trim().toLowerCase() === user.email.trim().toLowerCase();

  const handleDeleteAccount = async () => {
    if (!deleteEmailMatches) {
      setAccountError('Type your email address exactly to confirm.');
      return;
    }
    if (hasPasswordLogin && !currentPassword) {
      setAccountError('Enter your current password.');
      return;
    }
    // Captured before the delete: `user` is null by the time it resolves,
    // and the local cleanup below needs the id that's about to stop existing.
    const deletedUserId = user?.id;

    setAccountBusy(true);
    setAccountError(null);
    try {
      await deleteAccount(currentPassword);
      // Only after the server confirms. Runs post-sign-out, so the sync
      // engine is already idle and won't try to push these back up.
      releaseAccountSessions(deletedUserId);
      setAccountModal(null);
      setResultModal({
        variant: 'primary',
        icon: 'checkmark-circle-outline',
        title: 'Account deleted',
        message:
          'Your account and everything synced to it are gone. The sessions recorded on this device are still here — erase them from Data & Privacy if you want them gone too.',
        confirmText: 'Got It',
        showCancel: false,
        // Signed out now, so there is no account screen left to stand on.
        onConfirm: () => {
          setResultModal(null);
          navigation.goBack();
        },
      });
    } catch (err) {
      setAccountError(err?.message || "That account couldn't be deleted. Try again.");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleSendCode = async () => {
    setAccountBusy(true);
    setAccountError(null);
    try {
      await sendPasswordChangeCode();
      setCodeSent(true);
    } catch (err) {
      setAccountError(err?.message || "That code couldn't be sent. Try again.");
    } finally {
      setAccountBusy(false);
    }
  };

  const closeAccountModal = () => {
    if (accountBusy) return; // don't drop a request that's mid-flight
    setAccountModal(null);
    setAccountError(null);
  };

  const flashNotice = (text) => {
    setAccountNotice(text);
    setTimeout(() => setAccountNotice(null), 2600);
  };

  const handleSaveUsername = async () => {
    const name = tempUsername.trim();
    if (name.length < 2) {
      setAccountError('Pick a username of at least 2 characters.');
      return;
    }
    setAccountBusy(true);
    setAccountError(null);
    try {
      await updateUsername(name);
      setAccountModal(null);
      flashNotice('Username updated.');
    } catch (err) {
      setAccountError(err?.message || "That username couldn't be saved. Try again.");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleSavePassword = async () => {
    if (hasPasswordLogin && !currentPassword) {
      setAccountError('Enter your current password.');
      return;
    }
    if (!hasPasswordLogin && !verifyCode.trim()) {
      setAccountError('Enter the code we emailed you.');
      return;
    }
    if (newPassword.length < 8) {
      setAccountError('Use at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setAccountError("Those two passwords don't match.");
      return;
    }
    setAccountBusy(true);
    setAccountError(null);
    try {
      if (hasPasswordLogin) {
        await updatePasswordWithCurrent(currentPassword, newPassword);
      } else {
        await updatePasswordWithCode(verifyCode, newPassword);
      }
      setAccountModal(null);
      flashNotice('Password updated.');
    } catch (err) {
      setAccountError(err?.message || "That password couldn't be saved. Try again.");
    } finally {
      setAccountBusy(false);
    }
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
        <Text style={screenStyles.navTitle}>Account</Text>
        <View style={styles.backBtnSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.menuCard, SHADOWS.card]}>
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={openUsernameModal}
              >
                <View style={styles.menuIconCircle}>
                  <Ionicons name="person-outline" size={moderateScale(18)} color={COLORS.accentCyan} />
                </View>
                <View style={styles.menuTextGroup}>
                  <Text style={styles.menuTitle}>Username</Text>
                  <Text style={styles.menuSubtitle} numberOfLines={1}>
                    {profile?.username || 'Not set yet'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={openPasswordModal}
              >
                <View style={styles.menuIconCircle}>
                  <Ionicons name="key-outline" size={moderateScale(18)} color={COLORS.warning} />
                </View>
                <View style={styles.menuTextGroup}>
                  <Text style={styles.menuTitle}>Password</Text>
                  <Text style={styles.menuSubtitle}>Set a new password for this account</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={openDeleteAccountModal}
              >
                <View style={[styles.menuIconCircle, styles.menuIconCircleDanger]}>
                  <Ionicons
                    name="person-remove-outline"
                    size={moderateScale(18)}
                    color={COLORS.danger}
                  />
                </View>
                <View style={styles.menuTextGroup}>
                  <Text style={[styles.menuTitle, { color: COLORS.danger }]}>Delete Account</Text>
                  <Text style={styles.menuSubtitle}>
                    Permanently close this account and erase what's synced to it
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

        {!!accountNotice && (
          <View style={styles.noticeRow}>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
            <Text style={styles.noticeText}>{accountNotice}</Text>
          </View>
        )}
      </ScrollView>

      <ConfirmModal visible={!!resultModal} {...resultModal} />

      {/* CHANGE USERNAME MODAL */}
      <Modal
        visible={accountModal === 'username'}
        transparent
        animationType="fade"
        onRequestClose={closeAccountModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={closeAccountModal}>
            <View style={styles.modalOverlay}>
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={[styles.modalSheet, SHADOWS.card]}
              >
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Change Username</Text>
                  <TouchableOpacity onPress={closeAccountModal} hitSlop={TOUCH_TARGET.hitSlop}>
                    <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.limitSub}>This is the name shown on your profile.</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.textInput}
                    value={tempUsername}
                    onChangeText={setTempUsername}
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="words"
                    autoCorrect={false}
                    maxLength={24}
                  />
                </View>

                {!!accountError && <Text style={styles.accountError}>{accountError}</Text>}

                <TouchableOpacity
                  style={[styles.saveModalBtn, accountBusy && styles.saveModalBtnBusy]}
                  activeOpacity={0.85}
                  onPress={handleSaveUsername}
                  disabled={accountBusy}
                >
                  {accountBusy ? (
                    <ActivityIndicator size="small" color={COLORS.textDark} />
                  ) : (
                    <Text style={styles.saveModalBtnText}>Save Username</Text>
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* CHANGE PASSWORD MODAL */}
      <Modal
        visible={accountModal === 'password'}
        transparent
        animationType="fade"
        onRequestClose={closeAccountModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={closeAccountModal}>
            <View style={styles.modalOverlay}>
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={[styles.modalSheet, SHADOWS.card]}
              >
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Change Password</Text>
                  <TouchableOpacity onPress={closeAccountModal} hitSlop={TOUCH_TARGET.hitSlop}>
                    <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                {hasPasswordLogin ? (
                  <>
                    <Text style={styles.limitSub}>
                      Confirm your current password, then choose a new one.
                    </Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.textInput}
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        placeholder="Current password"
                        placeholderTextColor={COLORS.textMuted}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.limitSub}>
                      You signed in with Google, so there's no current password to confirm.
                      We'll email a code to {user?.email} instead.
                    </Text>
                    {codeSent ? (
                      <View style={styles.inputContainer}>
                        <TextInput
                          style={styles.textInput}
                          value={verifyCode}
                          onChangeText={setVerifyCode}
                          placeholder="6-digit code"
                          placeholderTextColor={COLORS.textMuted}
                          keyboardType="number-pad"
                          autoCapitalize="none"
                          autoCorrect={false}
                          maxLength={8}
                        />
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.secondaryModalBtn}
                        activeOpacity={0.85}
                        onPress={handleSendCode}
                        disabled={accountBusy}
                      >
                        {accountBusy ? (
                          <ActivityIndicator size="small" color={COLORS.textPrimary} />
                        ) : (
                          <Text style={styles.secondaryModalBtnText}>Email me a code</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </>
                )}

                {(hasPasswordLogin || codeSent) && (
                  <View style={[styles.inputContainer, { marginTop: SPACING.xs }]}>
                    <TextInput
                      style={styles.textInput}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="New password (8+ characters)"
                      placeholderTextColor={COLORS.textMuted}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                )}
                {(hasPasswordLogin || codeSent) && (
                  <View style={[styles.inputContainer, { marginTop: SPACING.xs }]}>
                    <TextInput
                      style={styles.textInput}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor={COLORS.textMuted}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                )}

                {!!accountError && <Text style={styles.accountError}>{accountError}</Text>}

                {(hasPasswordLogin || codeSent) && (
                  <TouchableOpacity
                    style={[styles.saveModalBtn, accountBusy && styles.saveModalBtnBusy]}
                    activeOpacity={0.85}
                    onPress={handleSavePassword}
                    disabled={accountBusy}
                  >
                    {accountBusy ? (
                      <ActivityIndicator size="small" color={COLORS.textDark} />
                    ) : (
                      <Text style={styles.saveModalBtnText}>Save Password</Text>
                    )}
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* DELETE ACCOUNT MODAL */}
      <Modal
        visible={accountModal === 'delete'}
        transparent
        animationType="fade"
        onRequestClose={closeAccountModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={closeAccountModal}>
            <View style={styles.modalOverlay}>
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={[styles.modalSheet, SHADOWS.card]}
              >
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Delete Account</Text>
                  <TouchableOpacity onPress={closeAccountModal} hitSlop={TOUCH_TARGET.hitSlop}>
                    <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.limitSub}>
                  This permanently deletes your account and every session synced to it. It cannot
                  be undone.
                </Text>
                <Text style={styles.deleteNote}>
                  Sessions recorded on this device stay on this device — erase them from Data &
                  Privacy if you want those gone too. An {PLUS_NAME} subscription is billed by the
                  store, so cancel it from your {Platform.OS === 'ios' ? 'App Store' : 'Google Play'}{' '}
                  account settings.
                </Text>

                {hasPasswordLogin && (
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.textInput}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="Current password"
                      placeholderTextColor={COLORS.textMuted}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                )}

                {/* The address goes here rather than in the placeholder: a
                    single-line TextInput truncates anything longer than the
                    field, and most real emails are longer than the field. */}
                <Text style={styles.deleteConfirmPrompt}>
                  Type <Text style={styles.deleteConfirmEmail}>{user?.email}</Text> to confirm:
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.textInput}
                    value={deleteConfirmEmail}
                    onChangeText={setDeleteConfirmEmail}
                    placeholder="Email address"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {!!accountError && <Text style={styles.accountError}>{accountError}</Text>}

                <TouchableOpacity
                  style={[
                    styles.deleteModalBtn,
                    (!deleteEmailMatches || accountBusy) && styles.deleteModalBtnDisabled,
                  ]}
                  activeOpacity={0.85}
                  onPress={handleDeleteAccount}
                  disabled={!deleteEmailMatches || accountBusy}
                >
                  {accountBusy ? (
                    <ActivityIndicator size="small" color={COLORS.textPrimary} />
                  ) : (
                    <Text style={styles.deleteModalBtnText}>Delete My Account</Text>
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
