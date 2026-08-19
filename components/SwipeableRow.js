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

  const renderLeftActions = (progress, dragX) => {
    const trans = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [-80, 0],
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
      renderLeftActions={renderLeftActions}
      leftThreshold={40}
      overshootLeft={false}
      onSwipeableOpen={(direction) => {
        if (direction === 'left') {
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