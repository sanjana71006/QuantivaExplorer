import { useState, useEffect, useCallback } from 'react';

export interface ApplicationSettings {
  general: {
    autoRunSimulation: boolean;
    showAdvancedDescriptors: boolean;
    enableAnimations: boolean;
    defaultAlgorithm: 'quantum' | 'classical' | 'hybrid';
    exportFormat: 'csv' | 'json' | 'xlsx' | 'pdf';
  };
  education: {
    enableEducationByDefault: boolean;
    defaultGuidanceLevel: 'detailed' | 'moderate' | 'minimal';
    defaultAnimationSpeed: 'slow' | 'normal' | 'fast';
    showTutorialOnStartup: boolean;
  };
  visualization: {
    visualization3DQuality: number;
    enableOutbreakModeDefault: boolean;
    defaultVisualMode: 'galaxy' | 'cluster' | 'network' | 'split';
    heatmapSize: number;
  };
  api: {
    apiEndpoint: string;
    pubchemTimeout: number;
    preferOfflineMode: boolean;
  };
  theme: {
    colorTheme: 'auto' | 'light' | 'dark';
    fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  };
  dataset: {
    defaultDatasetSource: 'local' | 'pubchem' | 'hybrid';
    lipinskiFilterDefault: boolean;
    toxicityThreshold: number;
  };
  notifications: {
    enableNotifications: boolean;
    showWarnings: boolean;
    soundAlerts: boolean;
  };
  performance: {
    cacheResults: boolean;
    analyticsTracking: boolean;
    dataRetention: number;
  };
  advanced: {
    developerMode: boolean;
    verboseLogging: boolean;
  };
}

const DEFAULT_SETTINGS: ApplicationSettings = {
  general: {
    autoRunSimulation: false,
    showAdvancedDescriptors: true,
    enableAnimations: true,
    defaultAlgorithm: 'quantum',
    exportFormat: 'csv',
  },
  education: {
    enableEducationByDefault: false,
    defaultGuidanceLevel: 'moderate',
    defaultAnimationSpeed: 'normal',
    showTutorialOnStartup: false,
  },
  visualization: {
    visualization3DQuality: 75,
    enableOutbreakModeDefault: false,
    defaultVisualMode: 'galaxy',
    heatmapSize: 50,
  },
  api: {
    apiEndpoint: 'http://localhost:8080',
    pubchemTimeout: 15,
    preferOfflineMode: false,
  },
  theme: {
    colorTheme: 'auto',
    fontSize: 'medium',
  },
  dataset: {
    defaultDatasetSource: 'hybrid',
    lipinskiFilterDefault: false,
    toxicityThreshold: 0.5,
  },
  notifications: {
    enableNotifications: true,
    showWarnings: true,
    soundAlerts: false,
  },
  performance: {
    cacheResults: true,
    analyticsTracking: false,
    dataRetention: 30,
  },
  advanced: {
    developerMode: false,
    verboseLogging: false,
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
      
      // Log in dev mode
      if (newSettings.advanced.verboseLogging) {
        console.log('Settings saved:', newSettings);
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
  html.classList.remove('text-sm', 'text-base', 'text-lg', 'text-xl');

  const sizeMap = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
    xlarge: 'text-xl',
  };

  html.classList.add(sizeMap[size]);
  html.style.fontSize = sizeMap[size];
}
