import React, { useRef, useState } from 'react';
import { StyleSheet, Animated, View, Text, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import ConfirmModal from './ConfirmModal';

export default function SwipeableRow({
  children,
  onDelete,
  confirmTitle = 'Delete this item?',
  confirmMessage = 'This action cannot be undone.',
}) {
  const swipeableRef = useRef(null);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const handleConfirm = () => {
    setConfirmVisible(true);
  };

  const handleCancelDelete = () => {
    setConfirmVisible(false);
    swipeableRef.current?.close();
  };

  const handleConfirmDelete = () => {
    setConfirmVisible(false);
    swipeableRef.current?.close();
    onDelete();
  };

  const ACTION_WIDTH = 76;

  // Render when swiped to the right (reveals delete on the left)
  const renderLeftActions = (progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [0, ACTION_WIDTH],
      outputRange: [0.7, 1],
      extrapolate: 'clamp',
    });
    const opacity = dragX.interpolate({
      inputRange: [0, ACTION_WIDTH * 0.6],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
    const iconShift = dragX.interpolate({
      inputRange: [0, ACTION_WIDTH],
      outputRange: [-14, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.leftActionContainer}>
        <Animated.View style={[styles.deleteButtonWrap, { opacity, transform: [{ scale }] }]}>
          <TouchableOpacity
            style={styles.deleteButton}
            activeOpacity={0.8}
            onPress={handleConfirm}
            accessibilityRole="button"
            accessibilityLabel="Delete item"
          >
            <Animated.View style={{ transform: [{ translateX: iconShift }] }}>
              <View style={styles.iconCircle}>
                <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
              </View>
            </Animated.View>
            <Text style={styles.actionText}>Delete</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  // Also support swiping to the left (reveals delete on the right) for natural ergonomics
  const renderRightActions = (progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [-ACTION_WIDTH, 0],
      outputRange: [1, 0.7],
      extrapolate: 'clamp',
    });
    const opacity = dragX.interpolate({
      inputRange: [-ACTION_WIDTH * 0.6, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    const iconShift = dragX.interpolate({
      inputRange: [-ACTION_WIDTH, 0],
      outputRange: [0, 14],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.rightActionContainer}>
        <Animated.View style={[styles.deleteButtonWrap, { opacity, transform: [{ scale }] }]}>
          <TouchableOpacity
            style={styles.deleteButton}
            activeOpacity={0.8}
            onPress={handleConfirm}
            accessibilityRole="button"
            accessibilityLabel="Delete item"
          >
            <Animated.View style={{ transform: [{ translateX: iconShift }] }}>
              <View style={styles.iconCircle}>
                <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
              </View>
            </Animated.View>
            <Text style={styles.actionText}>Delete</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  return (
    <>
      <Swipeable
        ref={swipeableRef}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        leftThreshold={ACTION_WIDTH * 0.6}
        rightThreshold={ACTION_WIDTH * 0.6}
        friction={1.8}
        overshootLeft
        overshootRight
        overshootFriction={8}
      >
        {children}
      </Swipeable>

      <ConfirmModal
        visible={confirmVisible}
        variant="danger"
        icon="trash-outline"
        title={confirmTitle}
        message={confirmMessage}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
}

const styles = StyleSheet.create({
  leftActionContainer: {
    width: 76,
    marginRight: 8,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  rightActionContainer: {
    width: 76,
    marginLeft: 8,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  deleteButtonWrap: {
    flex: 1,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: COLORS.danger,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});