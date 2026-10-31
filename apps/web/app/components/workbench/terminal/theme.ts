import type { ITheme } from '@xterm/xterm';

const style = getComputedStyle(document.documentElement);
const cssVar = (token: string) => style.getPropertyValue(token) || undefined;

export function getTerminalTheme(overrides?: ITheme): ITheme {
  return {
    cursor: cssVar('--bitcode-elements-terminal-cursorColor'),
    cursorAccent: cssVar('--bitcode-elements-terminal-cursorColorAccent'),
    foreground: cssVar('--bitcode-elements-terminal-textColor'),
    background: cssVar('--bitcode-elements-terminal-backgroundColor'),
    selectionBackground: cssVar('--bitcode-elements-terminal-selection-backgroundColor'),
    selectionForeground: cssVar('--bitcode-elements-terminal-selection-textColor'),
    selectionInactiveBackground: cssVar('--bitcode-elements-terminal-selection-backgroundColorInactive'),

    // ansi escape code colors
    black: cssVar('--bitcode-elements-terminal-color-black'),
    red: cssVar('--bitcode-elements-terminal-color-red'),
    green: cssVar('--bitcode-elements-terminal-color-green'),
    yellow: cssVar('--bitcode-elements-terminal-color-yellow'),
    blue: cssVar('--bitcode-elements-terminal-color-blue'),
    magenta: cssVar('--bitcode-elements-terminal-color-magenta'),
    cyan: cssVar('--bitcode-elements-terminal-color-cyan'),
    white: cssVar('--bitcode-elements-terminal-color-white'),
    brightBlack: cssVar('--bitcode-elements-terminal-color-brightBlack'),
    brightRed: cssVar('--bitcode-elements-terminal-color-brightRed'),
    brightGreen: cssVar('--bitcode-elements-terminal-color-brightGreen'),
    brightYellow: cssVar('--bitcode-elements-terminal-color-brightYellow'),
    brightBlue: cssVar('--bitcode-elements-terminal-color-brightBlue'),
    brightMagenta: cssVar('--bitcode-elements-terminal-color-brightMagenta'),
    brightCyan: cssVar('--bitcode-elements-terminal-color-brightCyan'),
    brightWhite: cssVar('--bitcode-elements-terminal-color-brightWhite'),

    ...overrides,
  };
}
