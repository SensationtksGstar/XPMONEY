import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // XP Money Design System — Apple-calm pass (July 2026)
        // Neutral surface ladder: 90% of chrome lives on these. Elevation =
        // next surface up + hairline border, never colored glow.
        surface: {
          0: '#0b0d10', // app base
          1: '#13161b', // card
          2: '#1b1f26', // raised / hover
          3: '#242a33', // top layer / active fill
        },
        // Hairline + divider — the only default border colors.
        hairline: 'rgba(255,255,255,0.08)',
        divider:  'rgba(255,255,255,0.06)',
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#82e3ab',
          400: '#4fd48b',
          500: '#27c26b', // primary green (calmer than the old #22c55e)
          600: '#1ea55a',
          700: '#19874b',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        // Override Tailwind's default green so every existing `green-*`
        // class shifts to the calmer accent without touching call sites.
        green: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#82e3ab',
          400: '#4fd48b',
          500: '#27c26b',
          600: '#1ea55a',
          700: '#19874b',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        // ONE green: emerald aliases the same ramp, so the 120+ existing
        // `emerald-*` call sites can't introduce a second green tone.
        emerald: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#82e3ab',
          400: '#4fd48b',
          500: '#27c26b',
          600: '#1ea55a',
          700: '#19874b',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        xp: {
          gold:   '#f59e0b',
          silver: '#94a3b8',
          bronze: '#cd7c2c',
          purple: '#8b5cf6',
          blue:   '#3b82f6',
        },
        score: {
          critical: '#ef4444', // 0-39
          low:      '#f97316', // 40-59
          medium:   '#eab308', // 60-74
          good:     '#27c26b', // 75-89
          elite:    '#8b5cf6', // 90-100
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input:  'hsl(var(--input))',
        ring:   'hsl(var(--ring))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        'xp-burst': {
          '0%':   { transform: 'scale(1)', opacity: '1' },
          '50%':  { transform: 'scale(1.4)', opacity: '0.8' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'level-up': {
          '0%':   { transform: 'translateY(0)', opacity: '0' },
          '20%':  { transform: 'translateY(-20px)', opacity: '1' },
          '80%':  { transform: 'translateY(-20px)', opacity: '1' },
          '100%': { transform: 'translateY(-40px)', opacity: '0' },
        },
        'voltix-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        'score-fill': {
          '0%':   { strokeDashoffset: '283' },
          '100%': { strokeDashoffset: 'var(--score-offset)' },
        },
        'fade-in-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
      },
      animation: {
        'xp-burst':      'xp-burst 0.4s ease-out',
        'level-up':      'level-up 1.5s ease-out forwards',
        'voltix-bounce': 'voltix-bounce 2s ease-in-out infinite',
        'score-fill':    'score-fill 1s ease-out forwards',
        'fade-in-up':    'fade-in-up 0.5s ease-out',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    // @tailwindcss/typography drives the `prose` classes used by /blog/[slug]
    // for clean MDX article styling. Adds ~6 KB to the production CSS but
    // only on routes that use `prose` (Tailwind tree-shakes correctly).
    require('@tailwindcss/typography'),
  ],
}

export default config
