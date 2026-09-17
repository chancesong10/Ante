import React, { useCallback, useState } from 'react';
import TrackerGuideButton from './TrackerGuideButton';
import TrackerGuideSheet from './TrackerGuideSheet';
import { usePreferences } from '../context/PreferencesContext';
import { guideForGame } from '../constants/trackerGuides';
import { COLORS } from '../constants/theme';
import { hapticLight } from '../utils/haptics';

// One line per tracker: the ⓘ button, the sheet it opens, and the seen-state
// that decides whether the button pulses.
//
// The sheet lives in here rather than beside the screen's other modals
// because RN's Modal renders into its own native layer — where it sits in the
// JSX tree has no bearing on how it displays. Keeping the pair together means
// adding a guide to a tracker is a single element next to its back button,
// with no second insertion to forget.
//
// Renders nothing at all for a gameType with no guide defined, so a new
// tracker can be wired up before its copy is written.
export default function TrackerGuide({ gameType, navigation }) {
  const { trackerGuidesSeen = {}, markTrackerGuideSeen } = usePreferences();
  const [visible, setVisible] = useState(false);

  const guide = guideForGame(gameType);
  const tint = COLORS[guide?.accent] || COLORS.accentCyan;

  // Marked seen on open, not on close: someone who opens the guide and
  // immediately dismisses it has still found it, and pulsing at them again
  // afterwards is nagging.
  const open = useCallback(() => {
    hapticLight();
    setVisible(true);
    markTrackerGuideSeen?.(gameType);
  }, [gameType, markTrackerGuideSeen]);

  const close = useCallback(() => setVisible(false), []);

  if (!guide) return null;

  return (
    <>
      <TrackerGuideButton onPress={open} unseen={!trackerGuidesSeen?.[gameType]} tint={tint} />
      <TrackerGuideSheet
        visible={visible}
        gameType={gameType}
        onClose={close}
        navigation={navigation}
      />
    </>
  );
}
