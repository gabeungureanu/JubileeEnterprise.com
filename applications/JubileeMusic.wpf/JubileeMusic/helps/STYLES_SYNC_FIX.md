# Styles/Lyrics Sync Bug Fix Documentation

## Issue Summary
Text entered in the JubileeMusic WPF application's Create panel (Styles and Lyrics TextBox fields) was not properly syncing to Suno.com's corresponding textareas via WebView2 JavaScript injection.

## Root Cause
The Suno.com website uses React with controlled components, which means:
1. Simple DOM value assignment (`textarea.value = 'text'`) doesn't trigger React's state updates
2. Multiple textareas exist on the page (including hidden ones in inactive tabs)
3. The Styles textarea was in a different "mode" tab (Custom mode) with different event handling than the Lyrics textarea

## Approaches That Did NOT Work

### 1. Position-based Selection Only
- **Problem**: Textareas in hidden modals had negative `top` values that sorted first
- **Result**: Wrong textarea selected

### 2. Native Setter + Simple Event Dispatch for Styles
```javascript
const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
).set;
nativeSetter.call(textarea, valueToSet);
textarea.dispatchEvent(new Event('input', { bubbles: true }));
```
- **Result**: DOM value was set but React didn't pick it up (worked for Lyrics but not Styles)

### 3. `document.execCommand('insertText')`
```javascript
textarea.focus();
document.execCommand('insertText', false, valueToSet);
```
- **Result**: Command returned `true` but actual value remained 0 chars - browser accepted command but value was blocked/cleared

### 4. InputEvent Alone
```javascript
textarea.dispatchEvent(new InputEvent('input', {
    data: valueToSet,
    inputType: 'insertText',
    bubbles: true
}));
```
- **Result**: Did not trigger React state update

## Solution That Worked

### Key Components

#### 1. Visibility Filtering (`isReallyVisible()` helper)
```javascript
function isReallyVisible(el) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
    }
    // Check if any parent is hidden
    let parent = el.parentElement;
    while (parent) {
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
            return false;
        }
        // Check for tab panels - if parent has role=tabpanel and is hidden
        if (parent.getAttribute('role') === 'tabpanel' && parent.getAttribute('aria-hidden') === 'true') {
            return false;
        }
        parent = parent.parentElement;
    }
    return true;
}
```

#### 2. Placeholder-based Identification
- **Styles field**: Look for placeholder containing "describe" AND "sound"
- **Lyrics field**: Look for placeholder containing "write" AND ("lyrics" OR "prompt")

#### 3. Position Filtering
Filter out textareas with `rect.top <= 10` to exclude hidden utility elements.

#### 4. ClipboardEvent Paste Simulation
```javascript
const dataTransfer = new DataTransfer();
dataTransfer.setData('text/plain', valueToSet);
const pasteEvent = new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: dataTransfer
});
stylesTextarea.dispatchEvent(pasteEvent);
```

#### 5. Character-by-Character Typing Fallback
If paste doesn't work, simulate individual keystrokes with full event sequence:
```javascript
for (let i = 0; i < valueToSet.length; i++) {
    const char = valueToSet[i];

    // keydown
    stylesTextarea.dispatchEvent(new KeyboardEvent('keydown', {
        key: char, bubbles: true
    }));

    // beforeinput
    stylesTextarea.dispatchEvent(new InputEvent('beforeinput', {
        data: char, inputType: 'insertText', bubbles: true, cancelable: true
    }));

    // Actually insert the character
    stylesTextarea.value += char;

    // input
    stylesTextarea.dispatchEvent(new InputEvent('input', {
        data: char, inputType: 'insertText', bubbles: true
    }));

    // keyup
    stylesTextarea.dispatchEvent(new KeyboardEvent('keyup', {
        key: char, bubbles: true
    }));
}
```

## Why Lyrics Worked with Simpler Approach
The Lyrics textarea responded to the simpler native setter + Event dispatch approach because:
1. It's positioned differently in the DOM hierarchy
2. React's event handling for that specific textarea accepts standard input events
3. The Styles textarea appears to have additional event filtering or controlled input handling

## Files Modified
- `SunoAutomationService.cs` - Main automation service with `EnterStylePromptAsync()` and `EnterLyricsAsync()` methods

## Testing Notes
1. Enter text in the WPF Create panel's "Styles" field
2. Click "Insert" button
3. Verify text appears in Suno.com's Custom mode Styles textarea
4. Repeat for Lyrics field

## Date
January 2026

## Author
Jubilee (Claude Code assistant)
