import { globSync } from 'fast-glob';
import fs from 'node:fs/promises';
import phosphor from '@iconify-json/ph/icons.json';
import { basename } from 'node:path';
import { defineConfig, presetIcons, presetUno, transformerDirectives } from 'unocss';

const iconPaths = globSync('./icons/*.svg');

const collectionName = 'bitcode';

const customIconCollection = iconPaths.reduce(
  (acc, iconPath) => {
    const [iconName] = basename(iconPath).split('.');

    acc[collectionName] ??= {};
    acc[collectionName][iconName] = async () => fs.readFile(iconPath, 'utf8');

    return acc;
  },
  {} as Record<string, Record<string, () => Promise<string>>>,
);

const BASE_COLORS = {
  white: '#FFFFFF',
  gray: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0A0A0A',
  },
  accent: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#B5B5B5',
    500: '#969696',
    600: '#787878',
    700: '#5C5C5C',
    800: '#404040',
    900: '#262626',
    950: '#171717',
  },
  green: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
    950: '#052E16',
  },
  orange: {
    50: '#FFFAEB',
    100: '#FEEFC7',
    200: '#FEDF89',
    300: '#FEC84B',
    400: '#FDB022',
    500: '#F79009',
    600: '#DC6803',
    700: '#B54708',
    800: '#93370D',
    900: '#792E0D',
  },
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
    950: '#450A0A',
  },
};

const COLOR_PRIMITIVES = {
  ...BASE_COLORS,
  alpha: {
    white: generateAlphaPalette(BASE_COLORS.white),
    gray: generateAlphaPalette(BASE_COLORS.gray[900]),
    red: generateAlphaPalette(BASE_COLORS.red[500]),
    accent: generateAlphaPalette(BASE_COLORS.accent[500]),
  },
};

export default defineConfig({
  shortcuts: {
    'bitcode-ease-cubic-bezier': 'ease-[cubic-bezier(0.4,0,0.2,1)]',
    'transition-theme': 'transition-[background-color,border-color,color] duration-150 bitcode-ease-cubic-bezier',
    kdb: 'bg-bitcode-elements-code-background text-bitcode-elements-code-text py-1 px-1.5 rounded-md',
    'max-w-chat': 'max-w-[var(--chat-max-width)]',
  },
  rules: [
    /**
     * This shorthand doesn't exist in Tailwind and we overwrite it to avoid
     * any conflicts with minified CSS classes.
     */
    ['b', {}],
  ],
  theme: {
    colors: {
      ...COLOR_PRIMITIVES,
      bitcode: {
        elements: {
          borderColor: 'var(--bitcode-elements-borderColor)',
          borderColorActive: 'var(--bitcode-elements-borderColorActive)',
          background: {
            depth: {
              1: 'var(--bitcode-elements-bg-depth-1)',
              2: 'var(--bitcode-elements-bg-depth-2)',
              3: 'var(--bitcode-elements-bg-depth-3)',
              4: 'var(--bitcode-elements-bg-depth-4)',
            },
          },
          textPrimary: 'var(--bitcode-elements-textPrimary)',
          textSecondary: 'var(--bitcode-elements-textSecondary)',
          textTertiary: 'var(--bitcode-elements-textTertiary)',
          code: {
            background: 'var(--bitcode-elements-code-background)',
            text: 'var(--bitcode-elements-code-text)',
          },
          button: {
            primary: {
              background: 'var(--bitcode-elements-button-primary-background)',
              backgroundHover: 'var(--bitcode-elements-button-primary-backgroundHover)',
              text: 'var(--bitcode-elements-button-primary-text)',
            },
            secondary: {
              background: 'var(--bitcode-elements-button-secondary-background)',
              backgroundHover: 'var(--bitcode-elements-button-secondary-backgroundHover)',
              text: 'var(--bitcode-elements-button-secondary-text)',
            },
            danger: {
              background: 'var(--bitcode-elements-button-danger-background)',
              backgroundHover: 'var(--bitcode-elements-button-danger-backgroundHover)',
              text: 'var(--bitcode-elements-button-danger-text)',
            },
          },
          item: {
            contentDefault: 'var(--bitcode-elements-item-contentDefault)',
            contentActive: 'var(--bitcode-elements-item-contentActive)',
            contentAccent: 'var(--bitcode-elements-item-contentAccent)',
            contentDanger: 'var(--bitcode-elements-item-contentDanger)',
            backgroundDefault: 'var(--bitcode-elements-item-backgroundDefault)',
            backgroundActive: 'var(--bitcode-elements-item-backgroundActive)',
            backgroundAccent: 'var(--bitcode-elements-item-backgroundAccent)',
            backgroundDanger: 'var(--bitcode-elements-item-backgroundDanger)',
          },
          actions: {
            background: 'var(--bitcode-elements-actions-background)',
            code: {
              background: 'var(--bitcode-elements-actions-code-background)',
            },
          },
          artifacts: {
            background: 'var(--bitcode-elements-artifacts-background)',
            backgroundHover: 'var(--bitcode-elements-artifacts-backgroundHover)',
            borderColor: 'var(--bitcode-elements-artifacts-borderColor)',
            inlineCode: {
              background: 'var(--bitcode-elements-artifacts-inlineCode-background)',
              text: 'var(--bitcode-elements-artifacts-inlineCode-text)',
            },
          },
          messages: {
            background: 'var(--bitcode-elements-messages-background)',
            linkColor: 'var(--bitcode-elements-messages-linkColor)',
            code: {
              background: 'var(--bitcode-elements-messages-code-background)',
            },
            inlineCode: {
              background: 'var(--bitcode-elements-messages-inlineCode-background)',
              text: 'var(--bitcode-elements-messages-inlineCode-text)',
            },
          },
          icon: {
            success: 'var(--bitcode-elements-icon-success)',
            error: 'var(--bitcode-elements-icon-error)',
            primary: 'var(--bitcode-elements-icon-primary)',
            secondary: 'var(--bitcode-elements-icon-secondary)',
            tertiary: 'var(--bitcode-elements-icon-tertiary)',
          },
          preview: {
            addressBar: {
              background: 'var(--bitcode-elements-preview-addressBar-background)',
              backgroundHover: 'var(--bitcode-elements-preview-addressBar-backgroundHover)',
              backgroundActive: 'var(--bitcode-elements-preview-addressBar-backgroundActive)',
              text: 'var(--bitcode-elements-preview-addressBar-text)',
              textActive: 'var(--bitcode-elements-preview-addressBar-textActive)',
            },
          },
          terminals: {
            background: 'var(--bitcode-elements-terminals-background)',
            buttonBackground: 'var(--bitcode-elements-terminals-buttonBackground)',
          },
          dividerColor: 'var(--bitcode-elements-dividerColor)',
          loader: {
            background: 'var(--bitcode-elements-loader-background)',
            progress: 'var(--bitcode-elements-loader-progress)',
          },
          prompt: {
            background: 'var(--bitcode-elements-prompt-background)',
          },
          sidebar: {
            dropdownShadow: 'var(--bitcode-elements-sidebar-dropdownShadow)',
            buttonBackgroundDefault: 'var(--bitcode-elements-sidebar-buttonBackgroundDefault)',
            buttonBackgroundHover: 'var(--bitcode-elements-sidebar-buttonBackgroundHover)',
            buttonText: 'var(--bitcode-elements-sidebar-buttonText)',
          },
          cta: {
            background: 'var(--bitcode-elements-cta-background)',
            text: 'var(--bitcode-elements-cta-text)',
          },
        },
      },
    },
  },
  transformers: [transformerDirectives()],
  presets: [
    presetUno({
      dark: {
        light: '[data-theme="light"]',
        dark: '[data-theme="dark"]',
      },
    }),
    presetIcons({
      warn: true,
      collections: {
        ph: () => phosphor,
        ...customIconCollection,
      },
    }),
  ],
});

/**
 * Generates an alpha palette for a given hex color.
 *
 * @param hex - The hex color code (without alpha) to generate the palette from.
 * @returns An object where keys are opacity percentages and values are hex colors with alpha.
 *
 * Example:
 *
 * ```
 * {
 *   '1': '#FFFFFF03',
 *   '2': '#FFFFFF05',
 *   '3': '#FFFFFF08',
 * }
 * ```
 */
function generateAlphaPalette(hex: string) {
  return [1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].reduce(
    (acc, opacity) => {
      const alpha = Math.round((opacity / 100) * 255)
        .toString(16)
        .padStart(2, '0');

      acc[opacity] = `${hex}${alpha}`;

      return acc;
    },
    {} as Record<number, string>,
  );
}
