export const GREETING_TEMPLATE_STYLES = ['Default', 'Friendly', 'Professional', 'Motivational', 'Minimal', 'Custom'];

export const getGreetingTemplateForStyle = (style, eventType, customTemplate = '') => {
  const type = String(eventType || 'Celebration').trim();
  switch (style) {
    case 'Friendly':
      return `Happy {ordinal} ${type}, {name}! 🎉\nHope your day is full of joy, laughter, and wonderful memories.`;
    case 'Professional':
      return `Best wishes on your ${type}, {name}.\nWishing you continued happiness and success.`;
    case 'Motivational':
      return `Happy {ordinal} ${type}, {name}!\nCelebrate how far you have come and all the great things still ahead.`;
    case 'Minimal':
      return `Happy ${type}, {name}!`;
    case 'Custom':
      return String(customTemplate || '').trim();
    case 'Default':
    default:
      if (type.toLowerCase().includes('anniversary')) return 'Happy {ordinal} Anniversary {name} ❤️\nWishing you many more years of happiness, love and beautiful memories together.';
      if (type.toLowerCase().includes('birthday')) return 'Happy {ordinal} Birthday {name} 🎂\nWishing you a wonderful year filled with happiness, health and success.';
      return `Happy {ordinal} ${type} {name} 🎉\nWishing you a joyful celebration and beautiful memories to treasure.`;
  }
};
