import React, { useRef } from 'react';
import { StyleSheet, Animated, Alert, View, Text, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';

export default function SwipeableRow({
  children,
  onDelete,
  confirmTitle = 'Delete this item?',
  confirmMessage = 'This action cannot be undone.',
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

  // Render when swiped to the right (reveals delete on the left)
  const renderLeftActions = (progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [0, 40, 80],
      outputRange: [0.5, 0.85, 1],
      extrapolate: 'clamp',
    });
    const opacity = dragX.interpolate({
      inputRange: [0, 25, 60],
      outputRange: [0, 0.7, 1],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.leftActionContainer}>
        <TouchableOpacity
          style={[styles.deleteButton, SHADOWS.card]}
          activeOpacity={0.85}
          onPress={handleConfirm}
          accessibilityRole="button"
          accessibilityLabel="Delete item"
        >
          <Animated.View style={[styles.actionContent, { opacity, transform: [{ scale }] }]}>
            <View style={styles.iconCircle}>
              <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Delete</Text>
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  };

  // Also support swiping to the left (reveals delete on the right) for natural ergonomics
  const renderRightActions = (progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [-80, -40, 0],
      outputRange: [1, 0.85, 0.5],
      extrapolate: 'clamp',
    });
    const opacity = dragX.interpolate({
      inputRange: [-60, -25, 0],
      outputRange: [1, 0.7, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.rightActionContainer}>
        <TouchableOpacity
          style={[styles.deleteButton, SHADOWS.card]}
          activeOpacity={0.85}
          onPress={handleConfirm}
          accessibilityRole="button"
          accessibilityLabel="Delete item"
        >
          <Animated.View style={[styles.actionContent, { opacity, transform: [{ scale }] }]}>
            <View style={styles.iconCircle}>
              <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Delete</Text>
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      leftThreshold={50}
      rightThreshold={50}
      friction={1.6}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableOpen={handleConfirm}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  leftActionContainer: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'stretch',
    width: 84,
  },
  rightActionContainer: {
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'stretch',
    width: 84,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: COLORS.danger,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});