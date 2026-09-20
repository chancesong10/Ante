import { useEffect } from 'react';
import { BackHandler } from 'react-native';

// Makes the Android hardware back button pop this screen.
//
// Without it, back on a pushed screen falls through to whatever BackHandler
// listener is still registered on a screen mounted underneath it in the stack
// — an in-progress game session, typically, which then pops its own "cancel
// this hand?" modal from two screens away. All five insights screens had this
// same effect written out, with the same explanation above it.
//
// Registered with useEffect rather than useFocusEffect deliberately: these
// screens are only ever the top of the stack while mounted. A screen that can
// sit mounted but blurred (a tracker, say) needs useFocusEffect instead, so
// its listener is torn down while it is off view — see PokerScreen.
export default function useHardwareBack(navigation) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [navigation]);
}
