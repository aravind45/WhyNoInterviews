// Feature Flags System
// Controls which UI features are enabled/disabled

export const flags = {
  // New UI flag - controls new Home + Header
  newUI: process.env.NEXT_PUBLIC_NEW_UI === "true" || 
         (typeof window !== 'undefined' && window.location.search.includes('newui=true'))
};

// Helper function to check if new UI should be shown
export function shouldShowNewUI() {
  return flags.newUI;
}

// Helper to get flag status for debugging
export function getFlagStatus() {
  return {
    newUI: flags.newUI,
    env: process.env.NEXT_PUBLIC_NEW_UI,
    url: typeof window !== 'undefined' ? window.location.search : 'server'
  };
}