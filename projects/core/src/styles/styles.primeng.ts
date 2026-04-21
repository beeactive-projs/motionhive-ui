import Lara from '@primeuix/themes/lara';
import { definePreset } from '@primeuix/themes';
import { primary, success, info, warning, danger, surfaceDark, surfaceLight } from './theme-colors';

export const MotionHiveLara = definePreset(Lara, {
  primitive: {},

  semantic: {
    formField: {
      paddingX: '0.625rem',
      paddingY: '0.5rem',
      sm: {
        paddingX: '0.5rem',
        paddingY: '0.375rem',
      },
      lg: {
        paddingX: '0.75rem',
        paddingY: '0.625rem',
      },
    },
    list: {
      header: {
        padding: '0.625rem 1rem',
      },
    },

    primary,
    success,
    info,
    warning,
    danger,
    colorScheme: {
      light: {
        primary: {
          color: '{primary.500}',
          contrastColor: '{surface.900}',
          hoverColor: '{primary.600}',
          activeColor: '{primary.700}',
        },
        highlight: {},
        surface: surfaceLight,
      },
      dark: {
        primary: {
          color: '{primary.500}',
          contrastColor: '{surface.900}',
          hoverColor: '{primary.600}',
          activeColor: '{primary.700}',
        },
        highlight: {},
        surface: surfaceDark,
      },
    },
  },
  components: {
    dialog: {
      footer: {
        padding: '{overlay.modal.padding}',
      },
    },
    button: {
      root: {
        label: {
          fontWeight: '500',
        },
      },
      colorScheme: {
        light: {
          outlined: {
            primary: {
              borderColor: '{primary.500}',
              color: '{primary.500}',
              hoverBackground: 'color-mix(in srgb, {primary.600} 30%, transparent)',
              activeBackground: 'color-mix(in srgb, {primary.700} 40%, transparent)',
            },
          },
          text: {
            primary: {
              color: '{primary.500}',
              hoverBackground: 'color-mix(in srgb, {primary.600} 30%, transparent)',
              activeBackground: 'color-mix(in srgb, {primary.700} 40%, transparent)',
            },
          },
        },
        dark: {
          outlined: {
            primary: {
              borderColor: '{primary.400}',
              color: '{primary.400}',
              hoverBackground: 'color-mix(in srgb, {primary.500} 20%, transparent)',
              activeBackground: 'color-mix(in srgb, {primary.600} 30%, transparent)',
            },
          },
          text: {
            primary: {
              color: '{primary.400}',
              hoverBackground: 'color-mix(in srgb, {primary.500} 20%, transparent)',
              activeBackground: 'color-mix(in srgb, {primary.600} 30%, transparent)',
            },
          },
        },
      },
    },
    paginator: {
      root: {
        gap: '0.5rem',
        background: 'transparent',
      },
    },
    tag: {
      root: {
        fontWeight: 'normal',
        roundedBorderRadius: '50rem',
      },
    },
  },
});
