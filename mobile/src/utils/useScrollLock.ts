import { useState } from 'react';

// The signature pad is a WebView inside a ScrollView; without this, the
// ScrollView's pan responder wins the touch and the screen scrolls instead
// of drawing. Wrap the signature pad's container with `lockHandlers` and
// pass `scrollEnabled` to the parent ScrollView.
export function useScrollLock() {
  const [scrollEnabled, setScrollEnabled] = useState(true);

  return {
    scrollEnabled,
    lockHandlers: {
      onTouchStart: () => setScrollEnabled(false),
      onTouchEnd: () => setScrollEnabled(true),
      onTouchCancel: () => setScrollEnabled(true),
    },
  };
}
