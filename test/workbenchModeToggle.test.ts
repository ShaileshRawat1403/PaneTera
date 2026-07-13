// test/workbenchModeToggle.test.ts
import assert from 'assert';
import React from 'react';
import { WorkbenchModeToggle, WorkbenchMode } from '../src/components/workbench/WorkbenchModeToggle';

console.log('Running WorkbenchModeToggle unit tests...');

// Helper to inspect the rendered element tree of WorkbenchModeToggle
function renderToggle(props: {
  mode: WorkbenchMode;
  onModeChange: (mode: WorkbenchMode) => void;
  hasActiveWorkspace: boolean;
  hasFeedItems: boolean;
  hasActiveComponent: boolean;
}) {
  // Call functional component directly as a function
  const element = (WorkbenchModeToggle as any)(props);
  
  // Outer element is a Box
  // Children is [Typography, Stack]
  const stack = element.props.children[1];
  const tooltips = stack.props.children; // Array of 3 Tooltips: [ChatTooltip, SplitTooltip, FocusTooltip]
  
  const chatTooltip = tooltips[0];
  const splitTooltip = tooltips[1];
  const focusTooltip = tooltips[2];
  
  const chatButton = chatTooltip.props.children.props.children;
  const splitButton = splitTooltip.props.children.props.children;
  const focusButton = focusTooltip.props.children.props.children;
  
  return {
    chatTooltip,
    splitTooltip,
    focusTooltip,
    chatButton,
    splitButton,
    focusButton
  };
}

// 1. Split button enabled with active workspace
{
  const { splitButton } = renderToggle({
    mode: 'conversation',
    onModeChange: () => {},
    hasActiveWorkspace: true,
    hasFeedItems: false,
    hasActiveComponent: false
  });
  assert.strictEqual(splitButton.props.disabled, false, 'Split button should be enabled when workspace context exists');
}

// 2. Split button enabled with feed item
{
  const { splitButton } = renderToggle({
    mode: 'conversation',
    onModeChange: () => {},
    hasActiveWorkspace: false,
    hasFeedItems: true,
    hasActiveComponent: false
  });
  assert.strictEqual(splitButton.props.disabled, false, 'Split button should be enabled when feed items exist');
}

// 3. Focus button disabled without selected item
{
  const { focusButton, focusTooltip } = renderToggle({
    mode: 'conversation',
    onModeChange: () => {},
    hasActiveWorkspace: true,
    hasFeedItems: true,
    hasActiveComponent: false
  });
  assert.strictEqual(focusButton.props.disabled, true, 'Focus button should be disabled when no active feed component exists');
  assert.strictEqual(
    focusTooltip.props.title, 
    'Select a file, dependency map, or intelligence card first.', 
    'Focus tooltip title should match expected disabled message'
  );
}

// 4. Focus button enabled after selecting a feed item
{
  const { focusButton } = renderToggle({
    mode: 'conversation',
    onModeChange: () => {},
    hasActiveWorkspace: true,
    hasFeedItems: true,
    hasActiveComponent: true
  });
  assert.strictEqual(focusButton.props.disabled, false, 'Focus button should be enabled when an active component is selected');
}

// 5. Click changes workbench mode
{
  let clickedMode: WorkbenchMode | null = null;
  const { chatButton, splitButton, focusButton } = renderToggle({
    mode: 'conversation',
    onModeChange: (mode) => { clickedMode = mode; },
    hasActiveWorkspace: true,
    hasFeedItems: true,
    hasActiveComponent: true
  });
  
  chatButton.props.onClick();
  assert.strictEqual(clickedMode, 'conversation', 'Clicking Chat button should change mode to conversation');
  
  splitButton.props.onClick();
  assert.strictEqual(clickedMode, 'split', 'Clicking Split button should change mode to split');
  
  focusButton.props.onClick();
  assert.strictEqual(clickedMode, 'native-focus', 'Clicking Focus button should change mode to native-focus');
}

console.log('✓ All WorkbenchModeToggle unit tests passed!');
