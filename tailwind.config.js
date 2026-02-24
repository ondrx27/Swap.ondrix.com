/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                'sans': ['Space Grotesk', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
                'display': ['Space Grotesk', 'sans-serif'],
                'mono': ['Space Grotesk', 'monospace'],
            },
            colors: {
                // Aurora Breath Design System v3.0
                'primary': '#00FF88',
                'primary-dim': '#00CC6A',
                'primary-darker': '#00AA55',
                'accent': '#88FFD0',
                'accent-glow': '#00FF88',

                // Functional colors
                'success': '#10B981',
                'warning': '#FBBF24',
                'error': '#F87171',

                // Deep Space Surfaces
                'dark': '#030503',
                'surface-1': '#050805',
                'surface-2': '#0A0F0A',
                'surface-3': '#0F150F',
                'surface-4': '#141C14',
                'surface-glass': 'rgba(8, 16, 8, 0.85)',

                // Legacy aliases for compatibility
                'bg-dark': '#050805',
                'bg-card': '#0A0F0A',
                'bg-hover': '#0F150F',

                // Text colors  
                'text-primary': '#FFFFFF',
                'text-secondary': '#C8E6C9',
                'text-muted': '#8FAF8F',
                'text-dim': '#5A7A5A',

                // Border colors
                'border-subtle': 'rgba(255, 255, 255, 0.04)',
                'border-light': 'rgba(255, 255, 255, 0.08)',
                'border-medium': 'rgba(255, 255, 255, 0.12)',
                'border-accent': 'rgba(0, 255, 136, 0.15)',
                'border-accent-strong': 'rgba(0, 255, 136, 0.3)',
                'border-dark': 'rgba(255, 255, 255, 0.08)',
                'border-green': '#00ff88',

                // Legacy accent aliases
                'accent-green': '#00ff88',
                'accent-green-dark': '#00cc66',
                'accent-green-light': '#88FFD0',
            },
            fontSize: {
                'xs': '0.75rem',
                'sm': '0.875rem',
                'base': '1rem',
                'md': '1.125rem',
                'lg': '1.25rem',
                'xl': '1.5rem',
                '2xl': '2rem',
                '3xl': '2.75rem',
                '4xl': '4rem',
                '5xl': '5.5rem',
                'hero': '7.5rem',
            },
            spacing: {
                '18': '4.5rem',
                '22': '5.5rem',
                '26': '6.5rem',
                '30': '7.5rem',
                '34': '8.5rem',
                '38': '9.5rem',
            },
            borderRadius: {
                'sm': '8px',
                'md': '12px',
                'lg': '20px',
                'xl': '24px',
                '2xl': '32px',
                'full': '9999px',
            },
            backgroundImage: {
                'gradient-green': 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)',
                'gradient-glow': 'linear-gradient(120deg, #00f2a6, #00b36b)',
                'gradient-dark': 'linear-gradient(135deg, #0A0F0A 0%, #050805 100%)',
                'gradient-surface': 'linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, transparent 100%)',
                'gradient-text': 'linear-gradient(180deg, #FFFFFF 0%, #C8E6C9 100%)',
            },
            boxShadow: {
                'sm': '0 2px 8px rgba(0, 0, 0, 0.1)',
                'md': '0 8px 24px rgba(0, 0, 0, 0.15)',
                'lg': '0 16px 48px rgba(0, 0, 0, 0.2)',
                'xl': '0 24px 64px rgba(0, 0, 0, 0.25)',
                'glow': '0 0 60px rgba(0, 255, 136, 0.08)',
                'glow-strong': '0 0 100px rgba(0, 255, 136, 0.15)',
                'glow-btn': '0 10px 30px rgba(0, 242, 166, 0.25)',
                'glow-btn-hover': '0 15px 40px rgba(0, 242, 166, 0.4)',
            },
            animation: {
                'pulse-green': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'glow': 'glow 2s ease-in-out infinite alternate',
                'aurora': 'auroraBreath 8s ease-in-out infinite',
                'float': 'float 3s ease-in-out infinite',
                'fadeInUp': 'fadeInUp 1s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            },
            keyframes: {
                glow: {
                    '0%': { boxShadow: '0 0 5px #00ff88' },
                    '100%': { boxShadow: '0 0 20px #00ff88, 0 0 30px #00ff88' },
                },
                auroraBreath: {
                    '0%, 100%': { opacity: '0.8', transform: 'translateX(-50%) scale(1)' },
                    '50%': { opacity: '1', transform: 'translateX(-50%) scale(1.1)' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                fadeInUp: {
                    'from': { opacity: '0', transform: 'translateY(24px)' },
                    'to': { opacity: '1', transform: 'translateY(0)' },
                },
                pulse: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.4' },
                },
            },
            transitionTimingFunction: {
                'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
                'bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            },
        },
    },
    plugins: [],
}
