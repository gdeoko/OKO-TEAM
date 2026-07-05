// Бренд OKO: чёрный фон + лаймовый, кинематографичный минимализм.
export const theme = {
  colors: {
    bg: '#000000',
    surface: '#0D0D0D',
    surfaceRaised: '#161616',
    lime: '#9AFF00',
    text: '#FFFFFF',
    textDim: '#9B9B9B',
    danger: '#FF4D4D',
    border: '#222222',
  },
  fonts: {
    display: 'BebasNeue',   // заголовки
    body: 'Montserrat',     // текст
  },
  radius: { sm: 8, md: 14, lg: 22 },
} as const;
