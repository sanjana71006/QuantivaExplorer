import { useState, useEffect, useCallback } from 'react';

export interface ApplicationSettings {
  general: {
    showAdvancedDescriptors: boolean;
    enableAnimations: boolean;
  };
  education: {
    enableEducationByDefault: boolean;
    defaultGuidanceLevel: 'detailed' | 'moderate' | 'minimal';
    defaultAnimationSpeed: 'slow' | 'normal' | 'fast';
  };
  visualization: {
    visualization3DQuality: number;
    defaultVisualMode: 'galaxy' | 'cluster' | 'network' | 'split';
  };
  theme: {
    colorTheme: 'auto' | 'light' | 'dark';
    fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  };
}

const DEFAULT_SETTINGS: ApplicationSettings = {
  general: {
    showAdvancedDescriptors: true,
    enableAnimations: true,
  },
  education: {
    enableEducationByDefault: false,
    defaultGuidanceLevel: 'moderate',
    defaultAnimationSpeed: 'normal',
  },
  visualization: {
    visualization3DQuality: 75,
    defaultVisualMode: 'galaxy',
  },
  theme: {
    colorTheme: 'auto',
    fontSize: 'medium',
  },
};

export const useSettings = () => {
  const [settings, setSettingsState] = useState<ApplicationSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const loadSettings = () => {
      try {
        const stored = localStorage.getItem('quantiva-settings');
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettingsState({ ...DEFAULT_SETTINGS, ...parsed });
        } else {
          setSettingsState(DEFAULT_SETTINGS);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        setSettingsState(DEFAULT_SETTINGS);
      }
      setIsLoaded(true);
    };

    loadSettings();
  }, []);

  // Save settings to localStorage
  const saveSettings = useCallback((newSettings: ApplicationSettings) => {
    try {
      setSettingsState(newSettings);
      localStorage.setItem('quantiva-settings', JSON.stringify(newSettings));
      
      // Apply theme immediately if changed
      applyTheme(newSettings.theme.colorTheme);
      
      // Apply font size immediately
      applyFontSize(newSettings.theme.fontSize);
      
      // Apply animation preference
      if (!newSettings.general.enableAnimations) {
        document.documentElement.style.setProperty('--disable-animations', '1');
      } else {
        document.documentElement.style.removeProperty('--disable-animations');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, []);

  // Reset to defaults
  const resetSettings = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
  }, [saveSettings]);

  // Update a specific section
  const updateSection = useCallback(
    <K extends keyof ApplicationSettings>(
      section: K,
      updates: Partial<ApplicationSettings[K]>
    ) => {
      const newSettings = {
        ...settings,
        [section]: { ...settings[section], ...updates },
      };
      saveSettings(newSettings);
    },
    [settings, saveSettings]
  );

  return {
    settings,
    isLoaded,
    saveSettings,
    resetSettings,
    updateSection,
  };
};

// Apply theme to document
function applyTheme(theme: 'auto' | 'light' | 'dark') {
  const html = document.documentElement;

  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.classList.toggle('dark', prefersDark);
  } else {
    html.classList.toggle('dark', theme === 'dark');
  }
}

// Apply font size to document
function applyFontSize(size: 'small' | 'medium' | 'large' | 'xlarge') {
  const html = document.documentElement;
  
  const fontSizeValues = {
    small: '14px',
    medium: '16px',
    large: '18px',
    xlarge: '20px',
  };

  html.style.fontSize = fontSizeValues[size];
}
