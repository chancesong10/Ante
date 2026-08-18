import React, { useRef } from 'react';
import { StyleSheet, Animated, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function SwipeableRow({
  children,
  onDelete,
  confirmTitle = 'Delete this?',
  confirmMessage = 'This cannot be undone.',
}) {
  const swipeableRef = useRef(null);

  const handleConfirm = () => {
    Alert.alert(
      confirmTitle,
      confirmMessage,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => swipeableRef.current?.close(),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            swipeableRef.current?.close();
            onDelete();
          },
        },
      ],
      { cancelable: true, onDismiss: () => swipeableRef.current?.close() }
    );
  };

  const renderRightActions = (progress, dragX) => {
    const trans = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
      extrapolate: 'clamp',
    });
    return (
      <Animated.View
        style={[styles.deleteAction, { transform: [{ translateX: trans }] }]}
      >
        <Ionicons name="trash" size={22} color={COLORS.textDark} />
      </Animated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      onSwipeableOpen={(direction) => {
        if (direction === 'right') {
          handleConfirm();
        }
      }}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteAction: {
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 14,
    marginBottom: 8,
  },
});