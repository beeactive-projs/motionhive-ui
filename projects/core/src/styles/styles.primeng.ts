import { definePreset } from '@primeuix/themes';
import Lara from '@primeuix/themes/lara';
import { danger, info, navy, primary, success, warning } from './theme-colors';

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
    navy,
    colorScheme: {
      light: {
        primary: {
          color: '{primary.500}',
          contrastColor: '{surface.900}',
          hoverColor: '{primary.400}',
          activeColor: '{primary.600}',
        },
      },
      dark: {
        primary: {
          color: '{primary.500}',
          contrastColor: '{surface.900}',
          hoverColor: '{primary.400}',
          activeColor: '{primary.600}',
        },
      },
    },
  },
  components: {
    breadcrumb: {
      root: {
        background: 'transparent',
        padding: '0',
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
    card: {
      colorScheme: {
        light: {
          root: {
            background: '{surface.50}',
            shadow: '0 .125rem .25rem rgba(0,0,0,.85)',
          },
        },
      },
    },
    dialog: {
      footer: {
        padding: '{overlay.modal.padding}',
      },
    },
    paginator: {
      root: {
        gap: '0.5rem',
        background: 'transparent',
      },
    },
    tabs: {
      navButton: {
        background: 'transparent',
      },
      tablist: {
        background: 'transparent',
        borderWidth: '0 0 1px 0',
        // borderColor: '{surface.300}',
      },
      tab: {
        padding: '0.75rem 1rem',
        borderWidth: '0 0 3px 0',
      },
      colorScheme: {
        light: {
          tab: {
            background: 'transparent',
            activeBackground: 'transparent',
          },
        },
        dark: {
          tab: {
            background: 'transparent',
            activeBackground: 'transparent',
          },
        },
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
