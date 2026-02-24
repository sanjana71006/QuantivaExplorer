import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { Settings, Zap, Palette, Database, HardDrive, Code, BookOpen, AlertCircle, Save } from 'lucide-react';
import { useSettings, ApplicationSettings } from '@/hooks/useSettings';

const DashboardSettings = () => {
  const { settings, isLoaded, saveSettings, resetSettings, updateSection } = useSettings();
  const [saveMessage, setSaveMessage] = useState('');

  // Update local state from settings when loaded
  const [localSettings, setLocalSettings] = useState<ApplicationSettings | null>(null);

  useEffect(() => {
    if (isLoaded && settings) {
      setLocalSettings(settings);
    }
  }, [isLoaded, settings]);

  const handleSaveSettings = () => {
    if (localSettings) {
      saveSettings(localSettings);
      setSaveMessage('✅ Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleResetSettings = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      resetSettings();
      setSaveMessage('✅ Settings reset to defaults!');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleUpdateGeneral = <K extends keyof ApplicationSettings['general']>(
    key: K,
    value: ApplicationSettings['general'][K]
  ) => {
    if (localSettings) {
      const updated = { ...localSettings };
      (updated.general[key] as any) = value;
      setLocalSettings(updated);
    }
  };

  const handleUpdateEducation = <K extends keyof ApplicationSettings['education']>(
    key: K,
    value: ApplicationSettings['education'][K]
  ) => {
    if (localSettings) {
      const updated = { ...localSettings };
      (updated.education[key] as any) = value;
      setLocalSettings(updated);
    }
  };

  const handleUpdateVisualization = <K extends keyof ApplicationSettings['visualization']>(
    key: K,
    value: ApplicationSettings['visualization'][K]
  ) => {
    if (localSettings) {
      const updated = { ...localSettings };
      (updated.visualization[key] as any) = value;
      setLocalSettings(updated);
    }
  };

  const handleUpdateAPI = <K extends keyof ApplicationSettings['api']>(
    key: K,
    value: ApplicationSettings['api'][K]
  ) => {
    if (localSettings) {
      const updated = { ...localSettings };
      (updated.api[key] as any) = value;
      setLocalSettings(updated);
    }
  };

  const handleUpdateTheme = <K extends keyof ApplicationSettings['theme']>(
    key: K,
    value: ApplicationSettings['theme'][K]
  ) => {
    if (localSettings) {
      const updated = { ...localSettings };
      (updated.theme[key] as any) = value;
      setLocalSettings(updated);
    }
  };

  const handleUpdateDataset = <K extends keyof ApplicationSettings['dataset']>(
    key: K,
    value: ApplicationSettings['dataset'][K]
  ) => {
    if (localSettings) {
      const updated = { ...localSettings };
      (updated.dataset[key] as any) = value;
      setLocalSettings(updated);
    }
  };

  const handleUpdateNotifications = <K extends keyof ApplicationSettings['notifications']>(
    key: K,
    value: ApplicationSettings['notifications'][K]
  ) => {
    if (localSettings) {
      const updated = { ...localSettings };
      (updated.notifications[key] as any) = value;
      setLocalSettings(updated);
    }
  };

  const handleUpdatePerformance = <K extends keyof ApplicationSettings['performance']>(
    key: K,
    value: ApplicationSettings['performance'][K]
  ) => {
    if (localSettings) {
      const updated = { ...localSettings };
      (updated.performance[key] as any) = value;
      setLocalSettings(updated);
    }
  };

  const handleUpdateAdvanced = <K extends keyof ApplicationSettings['advanced']>(
    key: K,
    value: ApplicationSettings['advanced'][K]
  ) => {
    if (localSettings) {
      const updated = { ...localSettings };
      (updated.advanced[key] as any) = value;
      setLocalSettings(updated);
    }
  };

  if (!isLoaded || !localSettings) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Settings className="w-12 h-12 text-primary/50 mx-auto mb-2 animate-spin" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-4xl"
    >
      <div>
        <h2 className="font-display text-3xl font-bold text-foreground mb-1 flex items-center gap-2">
          <Settings className="w-8 h-8" />
          Settings
        </h2>
        <p className="text-muted-foreground text-sm">Configure application preferences and features.</p>
      </div>

      {saveMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-700 text-sm font-medium"
        >
          {saveMessage}
        </motion.div>
      )}

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-9">
          <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
          <TabsTrigger value="education" className="text-xs">Education</TabsTrigger>
          <TabsTrigger value="visualization" className="text-xs">Visual</TabsTrigger>
          <TabsTrigger value="api" className="text-xs">API</TabsTrigger>
          <TabsTrigger value="theme" className="text-xs">Theme</TabsTrigger>
          <TabsTrigger value="dataset" className="text-xs">Dataset</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs">Alerts</TabsTrigger>
          <TabsTrigger value="performance" className="text-xs">Performance</TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs">Advanced</TabsTrigger>
        </TabsList>

        {/* GENERAL SETTINGS */}
        <TabsContent value="general">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Core application behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SettingToggle
                label="Auto-run simulation on dataset change"
                description="Automatically run scoring when dataset is updated"
                checked={localSettings.general.autoRunSimulation}
                onChange={(v) => handleUpdateGeneral('autoRunSimulation', v)}
              />
              <SettingToggle
                label="Show advanced descriptors"
                description="Display detailed molecular properties"
                checked={localSettings.general.showAdvancedDescriptors}
                onChange={(v) => handleUpdateGeneral('showAdvancedDescriptors', v)}
              />
              <SettingToggle
                label="Enable animations"
                description="Smooth transitions and visual effects"
                checked={localSettings.general.enableAnimations}
                onChange={(v) => handleUpdateGeneral('enableAnimations', v)}
              />
              <SettingSelect
                label="Default scoring algorithm"
                description="Algorithm used for molecule ranking"
                value={localSettings.general.defaultAlgorithm}
                onChange={(v) => handleUpdateGeneral('defaultAlgorithm', v as any)}
                options={[
                  { value: 'quantum', label: 'Quantum-Inspired Search' },
                  { value: 'classical', label: 'Classical Ranking' },
                  { value: 'hybrid', label: 'Hybrid Approach' },
                ]}
              />
              <SettingSelect
                label="Export format"
                description="Default file format for exporting results"
                value={localSettings.general.exportFormat}
                onChange={(v) => handleUpdateGeneral('exportFormat', v as any)}
                options={[
                  { value: 'csv', label: 'CSV' },
                  { value: 'json', label: 'JSON' },
                  { value: 'xlsx', label: 'Excel (XLSX)' },
                  { value: 'pdf', label: 'PDF Report' },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* EDUCATION MODE SETTINGS */}
        <TabsContent value="education">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Education Mode
              </CardTitle>
              <CardDescription>Learning and tutorial preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SettingToggle
                label="Enable education mode by default"
                description="Start with education mode activated on Visualization page"
                checked={localSettings.education.enableEducationByDefault}
                onChange={(v) => handleUpdateEducation('enableEducationByDefault', v)}
              />
              <SettingToggle
                label="Show tutorial on startup"
                description="Display guided walkthrough on first visit"
                checked={localSettings.education.showTutorialOnStartup}
                onChange={(v) => handleUpdateEducation('showTutorialOnStartup', v)}
              />
              <SettingSelect
                label="Default guidance level"
                description="How detailed educational explanations should be"
                value={localSettings.education.defaultGuidanceLevel}
                onChange={(v) => handleUpdateEducation('defaultGuidanceLevel', v as any)}
                options={[
                  { value: 'detailed', label: '📚 Detailed - All tooltips' },
                  { value: 'moderate', label: '⚡ Moderate - Key insights only' },
                  { value: 'minimal', label: '✨ Minimal - Subtle cues' },
                ]}
              />
              <SettingSelect
                label="Default animation speed"
                description="Speed of educational animations and transitions"
                value={localSettings.education.defaultAnimationSpeed}
                onChange={(v) => handleUpdateEducation('defaultAnimationSpeed', v as any)}
                options={[
                  { value: 'slow', label: '🐢 Slow (detailed learning)' },
                  { value: 'normal', label: '⏱️ Normal (default)' },
                  { value: 'fast', label: '⚡ Fast (quick review)' },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* VISUALIZATION SETTINGS */}
        <TabsContent value="visualization">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Visualization
              </CardTitle>
              <CardDescription>3D and display preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SettingSlider
                label="3D Visualization Quality"
                description="Higher = better quality, lower = faster rendering"
                value={localSettings.visualization.visualization3DQuality}
                onChange={(v) => handleUpdateVisualization('visualization3DQuality', v)}
                min={25}
                max={100}
                step={5}
              />
              <SettingToggle
                label="Enable outbreak mode by default"
                description="Show probability attractors and clustering"
                checked={localSettings.visualization.enableOutbreakModeDefault}
                onChange={(v) => handleUpdateVisualization('enableOutbreakModeDefault', v)}
              />
              <SettingSelect
                label="Default visual mode"
                description="Starting visualization when visualization page loads"
                value={localSettings.visualization.defaultVisualMode}
                onChange={(v) => handleUpdateVisualization('defaultVisualMode', v as any)}
                options={[
                  { value: 'galaxy', label: '🌌 Galaxy View (3D)' },
                  { value: 'cluster', label: '🔥 Cluster Heatmap' },
                  { value: 'network', label: '🔗 Network Graph' },
                  { value: 'split', label: '⚗️ Classical vs Quantum' },
                ]}
              />
              <SettingSlider
                label="Heatmap grid size"
                description="Number of molecules in probability heatmap"
                value={localSettings.visualization.heatmapSize}
                onChange={(v) => handleUpdateVisualization('heatmapSize', v)}
                min={25}
                max={100}
                step={5}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* API & BACKEND SETTINGS */}
        <TabsContent value="api">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                API & Backend
              </CardTitle>
              <CardDescription>Server and network configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SettingTextInput
                label="API Endpoint"
                description="Backend server URL for API calls"
                value={localSettings.api.apiEndpoint}
                onChange={(v) => handleUpdateAPI('apiEndpoint', v)}
                placeholder="http://localhost:8080"
              />
              <SettingSlider
                label="PubChem API Timeout"
                description="Maximum wait time for molecule data (seconds)"
                value={localSettings.api.pubchemTimeout}
                onChange={(v) => handleUpdateAPI('pubchemTimeout', v)}
                min={5}
                max={60}
                step={5}
              />
              <SettingToggle
                label="Prefer offline mode"
                description="Use cached data when available instead of fetching from API"
                checked={localSettings.api.preferOfflineMode}
                onChange={(v) => handleUpdateAPI('preferOfflineMode', v)}
              />
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-2">
                <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <p className="text-sm text-blue-600">
                  <strong>Current Status:</strong> Backend running at {localSettings.api.apiEndpoint}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* THEME & APPEARANCE */}
        <TabsContent value="theme">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Theme & Appearance
              </CardTitle>
              <CardDescription>Visual customization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SettingSelect
                label="Color Theme"
                description="Visual appearance of the application"
                value={localSettings.theme.colorTheme}
                onChange={(v) => handleUpdateTheme('colorTheme', v as any)}
                options={[
                  { value: 'auto', label: '🔄 Auto (system preference)' },
                  { value: 'light', label: '☀️ Light mode' },
                  { value: 'dark', label: '🌙 Dark mode' },
                ]}
              />
              <SettingSelect
                label="Font Size"
                description="Base text size throughout the app"
                value={localSettings.theme.fontSize}
                onChange={(v) => handleUpdateTheme('fontSize', v as any)}
                options={[
                  { value: 'small', label: 'Small' },
                  { value: 'medium', label: 'Medium (default)' },
                  { value: 'large', label: 'Large' },
                  { value: 'xlarge', label: 'Extra Large (accessibility)' },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* DATASET PREFERENCES */}
        <TabsContent value="dataset">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Dataset Preferences
              </CardTitle>
              <CardDescription>Molecule data and filtering defaults</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SettingSelect
                label="Default dataset source"
                description="Which molecule database to use by default"
                value={localSettings.dataset.defaultDatasetSource}
                onChange={(v) => handleUpdateDataset('defaultDatasetSource', v as any)}
                options={[
                  { value: 'local', label: '📁 Local Dataset' },
                  { value: 'pubchem', label: '🔬 PubChem Database' },
                  { value: 'hybrid', label: '🔄 Hybrid (both sources)' },
                ]}
              />
              <SettingToggle
                label="Apply Lipinski filter by default"
                description="Only show drug-like molecules by default"
                checked={localSettings.dataset.lipinskiFilterDefault}
                onChange={(v) => handleUpdateDataset('lipinskiFilterDefault', v)}
              />
              <SettingSlider
                label="Default toxicity threshold"
                description="Maximum acceptable toxicity risk (0-1)"
                value={localSettings.dataset.toxicityThreshold}
                onChange={(v) => handleUpdateDataset('toxicityThreshold', v)}
                min={0}
                max={1}
                step={0.05}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTIFICATIONS & ALERTS */}
        <TabsContent value="notifications">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Notifications & Alerts
              </CardTitle>
              <CardDescription>How the app communicates with you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SettingToggle
                label="Enable notifications"
                description="Show browser notifications for important events"
                checked={localSettings.notifications.enableNotifications}
                onChange={(v) => handleUpdateNotifications('enableNotifications', v)}
              />
              <SettingToggle
                label="Show warnings"
                description="Display alerts for potential issues (e.g., low diversity)"
                checked={localSettings.notifications.showWarnings}
                onChange={(v) => handleUpdateNotifications('showWarnings', v)}
              />
              <SettingToggle
                label="Sound alerts"
                description="Play sound when important events occur"
                checked={localSettings.notifications.soundAlerts}
                onChange={(v) => handleUpdateNotifications('soundAlerts', v)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* PERFORMANCE & PRIVACY */}
        <TabsContent value="performance">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                Performance & Privacy
              </CardTitle>
              <CardDescription>Cache, tracking, and optimization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SettingToggle
                label="Cache results"
                description="Store simulation results locally for faster loading"
                checked={localSettings.performance.cacheResults}
                onChange={(v) => handleUpdatePerformance('cacheResults', v)}
              />
              <SettingToggle
                label="Analytics tracking"
                description="Help us improve by sharing usage analytics (no personal data)"
                checked={localSettings.performance.analyticsTracking}
                onChange={(v) => handleUpdatePerformance('analyticsTracking', v)}
              />
              <SettingSlider
                label="Data retention period"
                description="How many days to keep cached data (0 = never)"
                value={localSettings.performance.dataRetention}
                onChange={(v) => handleUpdatePerformance('dataRetention', v)}
                min={0}
                max={90}
                step={5}
              />
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-700">
                  ✅ Your privacy is important. No personal data is ever collected or transmitted.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADVANCED SETTINGS */}
        <TabsContent value="advanced">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5" />
                Advanced Settings
              </CardTitle>
              <CardDescription>For developers and power users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SettingToggle
                label="Developer mode"
                description="Enable debug tools and console logging"
                checked={localSettings.advanced.developerMode}
                onChange={(v) => handleUpdateAdvanced('developerMode', v)}
              />
              <SettingToggle
                label="Verbose logging"
                description="Log detailed information for debugging"
                checked={localSettings.advanced.verboseLogging}
                onChange={(v) => handleUpdateAdvanced('verboseLogging', v)}
              />
              <div className="pt-4 border-t space-y-3">
                <h4 className="font-semibold text-sm">Maintenance</h4>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    localStorage.removeItem('quantiva-session');
                    setSaveMessage('✅ Cache cleared!');
                    setTimeout(() => setSaveMessage(''), 3000);
                  }}
                >
                  Clear Local Cache
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const settingsData = localStorage.getItem('quantiva-settings');
                    console.log('Current Settings:', JSON.parse(settingsData || '{}'));
                    setSaveMessage('✅ Settings logged to console');
                    setTimeout(() => setSaveMessage(''), 3000);
                  }}
                >
                  Export Settings to Console
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* SAVE & RESET BUTTONS */}
      <div className="flex gap-3">
        <Button
          onClick={handleSaveSettings}
          className="flex-1 gap-2"
          size="lg"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </Button>
        <Button
          onClick={handleResetSettings}
          variant="outline"
          className="flex-1"
          size="lg"
        >
          Reset to Defaults
        </Button>
      </div>

      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-700">
          <strong>Settings are stored locally</strong> in your browser's storage and will persist across sessions.
        </div>
      </div>
    </motion.div>
  );
};

// Reusable Setting Components
interface SettingToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function SettingToggle({ label, description, checked, onChange }: SettingToggleProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <div>
        <label className="text-sm font-medium text-foreground">{label}</label>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="ml-2" />
    </div>
  );
}

interface SettingSelectProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

function SettingSelect({ label, description, value, onChange, options }: SettingSelectProps) {
  return (
    <div className="py-3 border-b border-border/50 last:border-0 space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-card border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-card border-border">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface SettingSliderProps {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}

function SettingSlider({ label, description, value, onChange, min, max, step }: SettingSliderProps) {
  return (
    <div className="py-3 border-b border-border/50 last:border-0 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-foreground">{label}</label>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <Badge variant="secondary" className="ml-2">{value}</Badge>
      </div>
      <Slider
        value={[value]}
        onValueChange={(newValue) => onChange(newValue[0])}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
    </div>
  );
}

interface SettingTextInputProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function SettingTextInput({ label, description, value, onChange, placeholder }: SettingTextInputProps) {
  return (
    <div className="py-3 border-b border-border/50 last:border-0 space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-card border border-border rounded-md text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}

export default DashboardSettings;
