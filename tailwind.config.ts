import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    transparent: 'transparent',
    current: 'currentColor',
    extend: {
      colors: {
        // fry.farm dark theme
        tremor: {
          brand: {
            faint: '#1a1a1a', // dark subtle bg
            muted: '#333333', // dark muted
            subtle: '#999999', // muted text
            DEFAULT: '#e0e0e0', // neutral accent
            emphasis: '#ffffff', // white emphasis
            inverted: '#0f0f0f' // dark background
          },
          background: {
            muted: '#1a1a1a', // secondary dark bg
            subtle: '#1e1e1e', // card bg
            DEFAULT: '#0f0f0f', // primary dark bg
            emphasis: '#333333' // emphasis dark
          },
          border: {
            DEFAULT: '#333333' // dark border
          },
          ring: {
            DEFAULT: '#333333' // dark ring
          },
          content: {
            subtle: '#777777', // very muted text
            DEFAULT: '#999999', // secondary text
            emphasis: '#cccccc', // brighter text
            strong: '#e0e0e0', // primary text
            inverted: '#0f0f0f' // dark text on light
          }
        },
        // Custom card background
        card: '#1e1e1e'
      },
      boxShadow: {
        'tremor-input': '0 1px 2px 0 rgb(0 0 0 / 0.3)',
        'tremor-card': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'tremor-dropdown': '0 4px 12px rgba(0, 0, 0, 0.5)'
      },
      borderRadius: {
        'tremor-small': '0.375rem',
        'tremor-default': '0.5rem',
        'tremor-full': '9999px'
      },
      fontSize: {
        'tremor-label': '0.75rem',
        'tremor-default': ['0.875rem', { lineHeight: '1.25rem' }],
        'tremor-title': ['1.125rem', { lineHeight: '1.75rem' }],
        'tremor-metric': ['1.875rem', { lineHeight: '2.25rem' }]
      },
      spacing: {
        '15': '3.75rem',
      }
    }
  },
  safelist: [
    {
      pattern:
        /^(bg-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ['hover', 'ui-selected']
    },
    {
      pattern:
        /^(text-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ['hover', 'ui-selected']
    },
    {
      pattern:
        /^(border-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ['hover', 'ui-selected']
    },
    {
      pattern:
        /^(ring-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/
    },
    {
      pattern:
        /^(stroke-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/
    },
    {
      pattern:
        /^(fill-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/
    }
  ],
  plugins: [require('@headlessui/tailwindcss')]
} satisfies Config;
