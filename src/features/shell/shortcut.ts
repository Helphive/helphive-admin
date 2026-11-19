export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** How the command palette shortcut is written on this platform. */
export const shortcutLabel = isMac ? '⌘K' : 'Ctrl K';
