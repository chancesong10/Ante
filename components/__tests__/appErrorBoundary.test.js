// An error boundary that silently fails to catch is worse than no boundary at
// all — you only find out when a user is staring at a blank screen — so the
// catching, the recovery, and the "this keeps happening" escalation are all
// pinned down here.
//
// The React Native surface is mocked down to host primitives: these assertions
// are about React's error handling, not about how anything renders.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name) => (props) => React.createElement(name, props, props.children);
  return {
    View: host('View'),
    Text: host('Text'),
    ScrollView: host('ScrollView'),
    ActivityIndicator: host('ActivityIndicator'),
    Pressable: host('Pressable'),
    StyleSheet: { create: (s) => s, absoluteFill: {}, flatten: (s) => s },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    PixelRatio: { get: () => 2, getFontScale: () => 1, roundToNearestPixel: (n) => n },
    Platform: { OS: 'ios', select: (o) => o.ios },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return { SafeAreaView: (props) => React.createElement('SafeAreaView', props, props.children) };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return { Ionicons: (props) => React.createElement('Ionicons', props) };
});

jest.mock('../../services/storageService', () => ({
  loadSessionHistory: jest.fn(async () => []),
  clearAllAppData: jest.fn(async () => true),
}));

jest.mock('../../utils/exportSessions', () => ({
  exportSessionsCsv: jest.fn(async () => ({ ok: true, message: 'Copied to clipboard.' })),
}));

const AppErrorBoundary = require('../AppErrorBoundary').default;
const { loadSessionHistory, clearAllAppData } = require('../../services/storageService');
const { exportSessionsCsv } = require('../../utils/exportSessions');

// Throws on its first mount, then behaves — mirrors the real shape of the bug
// this guards against, where a bad record breaks a render and a retry after
// the data is dealt with should succeed.
function Boom({ shouldThrow }) {
  if (shouldThrow) throw new Error('bad session record');
  return React.createElement('Text', null, 'recovered');
}

const textOf = (tree) =>
  tree.root
    .findAllByType('Text')
    .map((n) => n.props.children)
    .filter((c) => typeof c === 'string')
    .join(' | ');

const pressLabelled = (tree, label) =>
  tree.root.findAll(
    (n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function'
  )[0];

// React logs caught boundary errors to console.error; that's expected noise.
let errorSpy;
beforeEach(() => {
  jest.clearAllMocks();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

test('renders its children when nothing throws', async () => {
  let tree;
  await act(async () => {
    tree = TestRenderer.create(
      <AppErrorBoundary>
        <Boom shouldThrow={false} />
      </AppErrorBoundary>
    );
  });

  expect(textOf(tree)).toContain('recovered');
});

test('catches a render throw and shows the crash screen instead of a blank tree', async () => {
  let tree;
  await act(async () => {
    tree = TestRenderer.create(
      <AppErrorBoundary>
        <Boom shouldThrow />
      </AppErrorBoundary>
    );
  });

  const text = textOf(tree);
  expect(text).toContain('Ante hit a problem');
  // The user is told their data is intact, and the underlying error is shown
  // rather than swallowed.
  expect(text).toContain('still saved on this device');
  expect(text).toContain('bad session record');
});

test('Try Again remounts the tree, so a recoverable crash actually recovers', async () => {
  let tree;
  let shouldThrow = true;

  function Wrapper() {
    return <Boom shouldThrow={shouldThrow} />;
  }

  await act(async () => {
    tree = TestRenderer.create(
      <AppErrorBoundary>
        <Wrapper />
      </AppErrorBoundary>
    );
  });
  expect(textOf(tree)).toContain('Ante hit a problem');

  shouldThrow = false;
  await act(async () => {
    pressLabelled(tree, 'Try again').props.onPress();
  });

  expect(textOf(tree)).toContain('recovered');
});

test('a crash that survives a retry escalates to the erase-first message', async () => {
  let tree;
  await act(async () => {
    tree = TestRenderer.create(
      <AppErrorBoundary>
        <Boom shouldThrow />
      </AppErrorBoundary>
    );
  });

  await act(async () => {
    pressLabelled(tree, 'Try again').props.onPress();
  });

  // Still throwing — the copy should stop suggesting Try Again is the answer.
  const text = textOf(tree);
  expect(text).toContain('went wrong again');
  expect(text).toContain('Export your data first');
});

test('export reads history from storage, since context is what just failed', async () => {
  const sessions = [{ id: 'a', gameType: 'Poker', startTime: 1, hands: [] }];
  loadSessionHistory.mockResolvedValueOnce(sessions);

  let tree;
  await act(async () => {
    tree = TestRenderer.create(
      <AppErrorBoundary>
        <Boom shouldThrow />
      </AppErrorBoundary>
    );
  });

  await act(async () => {
    await pressLabelled(tree, 'Export my sessions as a CSV file').props.onPress();
  });

  expect(loadSessionHistory).toHaveBeenCalled();
  expect(exportSessionsCsv).toHaveBeenCalledWith(sessions);
  expect(textOf(tree)).toContain('Copied to clipboard.');
});

test('erasing takes two deliberate taps', async () => {
  let tree;
  await act(async () => {
    tree = TestRenderer.create(
      <AppErrorBoundary>
        <Boom shouldThrow />
      </AppErrorBoundary>
    );
  });

  await act(async () => {
    pressLabelled(tree, 'Erase saved data to recover the app').props.onPress();
  });
  // First tap only arms it.
  expect(clearAllAppData).not.toHaveBeenCalled();
  expect(textOf(tree)).toContain('Tap again to erase everything');

  await act(async () => {
    await pressLabelled(tree, 'Confirm erasing all saved data').props.onPress();
  });
  expect(clearAllAppData).toHaveBeenCalledTimes(1);
});
