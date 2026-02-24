import { useState } from 'react';
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

const DashboardSettings = () => {
  // General Settings
  const [autoRunSimulation, setAutoRunSimulation] = useState(false);
  const [showAdvancedDescriptors, setShowAdvancedDescriptors] = useState(true);
  const [enableAnimations, setEnableAnimations] = useState(true);
  const [defaultAlgorithm, setDefaultAlgorithm] = useState('quantum');
  const [exportFormat, setExportFormat] = useState('csv');

  // Education Mode Settings
  const [enableEducationByDefault, setEnableEducationByDefault] = useState(false);
  const [defaultGuidanceLevel, setDefaultGuidanceLevel] = useState('moderate');
  const [defaultAnimationSpeed, setDefaultAnimationSpeed] = useState('normal');
  const [showTutorialOnStartup, setShowTutorialOnStartup] = useState(false);

  // Visualization Settings
  const [visualization3DQuality, setVisualization3DQuality] = useState(75);
  const [enableOutbreakModeDefault, setEnableOutbreakModeDefault] = useState(false);
  const [defaultVisualMode, setDefaultVisualMode] = useState('galaxy');
  const [heatmapSize, setHeatmapSize] = useState(50);

  // API & Backend Settings
  const [apiEndpoint, setApiEndpoint] = useState('http://localhost:8080');
  const [pubchemTimeout, setPubchemTimeout] = useState(15);
  const [preferOfflineMode, setPreferOfflineMode] = useState(false);

  // Theme & Appearance
  const [colorTheme, setColorTheme] = useState('auto');
  const [fontSize, setFontSize] = useState('medium');

  // Dataset Preferences
  const [defaultDatasetSource, setDefaultDatasetSource] = useState('hybrid');
  const [lipinskiFilterDefault, setLipinskiFilterDefault] = useState(false);
  const [toxicityThreshold, setToxicityThreshold] = useState(0.5);

  // Notifications
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [showWarnings, setShowWarnings] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(false);

  // Performance & Privacy
  const [cacheResults, setCacheResults] = useState(true);
  const [analyticsTracking, setAnalyticsTracking] = useState(false);
  const [dataRetention, setDataRetention] = useState(30);

  // Advanced
  const [developerMode, setDeveloperMode] = useState(false);
  const [verboseLogging, setVerboseLogging] = useState(false);

  const handleSaveSettings = () => {
    const settings = {
      general: { autoRunSimulation, showAdvancedDescriptors, enableAnimations, defaultAlgorithm, exportFormat },
      education: { enableEducationByDefault, defaultGuidanceLevel, defaultAnimationSpeed, showTutorialOnStartup },
      visualization: { visualization3DQuality, enableOutbreakModeDefault, defaultVisualMode, heatmapSize },
      api: { apiEndpoint, pubchemTimeout, preferOfflineMode },
      theme: { colorTheme, fontSize },
      dataset: { defaultDatasetSource, lipinskiFilterDefault, toxicityThreshold },
      notifications: { enableNotifications, showWarnings, soundAlerts },
      performance: { cacheResults, analyticsTracking, dataRetention },
      advanced: { developerMode, verboseLogging },
    };
    localStorage.setItem('quantiva-settings', JSON.stringify(settings));
    alert('✅ Settings saved successfully!');
  };

  const handleResetSettings = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      localStorage.removeItem('quantiva-settings');
      window.location.reload();
    }
  };

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
                checked={autoRunSimulation}
                onChange={setAutoRunSimulation}
              />
              <SettingToggle
                label="Show advanced descriptors"
                description="Display detailed molecular properties"
                checked={showAdvancedDescriptors}
                onChange={setShowAdvancedDescriptors}
              />
              <SettingToggle
                label="Enable animations"
                description="Smooth transitions and visual effects"
                checked={enableAnimations}
                onChange={setEnableAnimations}
              />
              <SettingSelect
                label="Default scoring algorithm"
                description="Algorithm used for molecule ranking"
                value={defaultAlgorithm}
                onChange={setDefaultAlgorithm}
                options={[
                  { value: 'quantum', label: 'Quantum-Inspired Search' },
                  { value: 'classical', label: 'Classical Ranking' },
                  { value: 'hybrid', label: 'Hybrid Approach' },
                ]}
              />
              <SettingSelect
                label="Export format"
                description="Default file format for exporting results"
                value={exportFormat}
                onChange={setExportFormat}
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
                checked={enableEducationByDefault}
                onChange={setEnableEducationByDefault}
              />
              <SettingToggle
                label="Show tutorial on startup"
                description="Display guided walkthrough on first visit"
                checked={showTutorialOnStartup}
                onChange={setShowTutorialOnStartup}
              />
              <SettingSelect
                label="Default guidance level"
                description="How detailed educational explanations should be"
                value={defaultGuidanceLevel}
                onChange={setDefaultGuidanceLevel}
                options={[
                  { value: 'detailed', label: '📚 Detailed - All tooltips' },
                  { value: 'moderate', label: '⚡ Moderate - Key insights only' },
                  { value: 'minimal', label: '✨ Minimal - Subtle cues' },
                ]}
              />
              <SettingSelect
                label="Default animation speed"
                description="Speed of educational animations and transitions"
                value={defaultAnimationSpeed}
                onChange={setDefaultAnimationSpeed}
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
                value={visualization3DQuality}
                onChange={setVisualization3DQuality}
                min={25}
                max={100}
                step={5}
              />
              <SettingToggle
                label="Enable outbreak mode by default"
                description="Show probability attractors and clustering"
                checked={enableOutbreakModeDefault}
                onChange={setEnableOutbreakModeDefault}
              />
              <SettingSelect
                label="Default visual mode"
                description="Starting visualization when visualization page loads"
                value={defaultVisualMode}
                onChange={setDefaultVisualMode}
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
                value={heatmapSize}
                onChange={setHeatmapSize}
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
                value={apiEndpoint}
                onChange={setApiEndpoint}
                placeholder="http://localhost:8080"
              />
              <SettingSlider
                label="PubChem API Timeout"
                description="Maximum wait time for molecule data (seconds)"
                value={pubchemTimeout}
                onChange={setPubchemTimeout}
                min={5}
                max={60}
                step={5}
              />
              <SettingToggle
                label="Prefer offline mode"
                description="Use cached data when available instead of fetching from API"
                checked={preferOfflineMode}
                onChange={setPreferOfflineMode}
              />
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-2">
                <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <p className="text-sm text-blue-600">
                  <strong>Current Status:</strong> Backend running at {apiEndpoint}
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
                value={colorTheme}
                onChange={setColorTheme}
                options={[
                  { value: 'auto', label: '🔄 Auto (system preference)' },
                  { value: 'light', label: '☀️ Light mode' },
                  { value: 'dark', label: '🌙 Dark mode' },
                ]}
              />
              <SettingSelect
                label="Font Size"
                description="Base text size throughout the app"
                value={fontSize}
                onChange={setFontSize}
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
                value={defaultDatasetSource}
                onChange={setDefaultDatasetSource}
                options={[
                  { value: 'local', label: '📁 Local Dataset' },
                  { value: 'pubchem', label: '🔬 PubChem Database' },
                  { value: 'hybrid', label: '🔄 Hybrid (both sources)' },
                ]}
              />
              <SettingToggle
                label="Apply Lipinski filter by default"
                description="Only show drug-like molecules by default"
                checked={lipinskiFilterDefault}
                onChange={setLipinskiFilterDefault}
              />
              <SettingSlider
                label="Default toxicity threshold"
                description="Maximum acceptable toxicity risk (0-1)"
                value={toxicityThreshold}
                onChange={setToxicityThreshold}
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
                checked={enableNotifications}
                onChange={setEnableNotifications}
              />
              <SettingToggle
                label="Show warnings"
                description="Display alerts for potential issues (e.g., low diversity)"
                checked={showWarnings}
                onChange={setShowWarnings}
              />
              <SettingToggle
                label="Sound alerts"
                description="Play sound when important events occur"
                checked={soundAlerts}
                onChange={setSoundAlerts}
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
                checked={cacheResults}
                onChange={setCacheResults}
              />
              <SettingToggle
                label="Analytics tracking"
                description="Help us improve by sharing usage analytics (no personal data)"
                checked={analyticsTracking}
                onChange={setAnalyticsTracking}
              />
              <SettingSlider
                label="Data retention period"
                description="How many days to keep cached data (0 = never)"
                value={dataRetention}
                onChange={setDataRetention}
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
                checked={developerMode}
                onChange={setDeveloperMode}
              />
              <SettingToggle
                label="Verbose logging"
                description="Log detailed information for debugging"
                checked={verboseLogging}
                onChange={setVerboseLogging}
              />
              <div className="pt-4 border-t space-y-3">
                <h4 className="font-semibold text-sm">Maintenance</h4>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    localStorage.removeItem('quantiva-session');
                    alert('✅ Cache cleared!');
                  }}
                >
                  Clear Local Cache
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const settings = JSON.parse(localStorage.getItem('quantiva-settings') || '{}');
                    console.log('Current Settings:', settings);
                    alert('Settings logged to console');
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
