import { useTheme, type ColorPalette, type ThemeMode } from '@/context/ThemeContext';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const colorOptions: { name: ColorPalette; label: string; bg: string }[] = [
  { name: 'pink', label: 'Pink', bg: 'bg-pink-500' },
  { name: 'purple', label: 'Purple', bg: 'bg-purple-500' },
  { name: 'blue', label: 'Blue', bg: 'bg-blue-500' },
  { name: 'cyan', label: 'Cyan', bg: 'bg-cyan-500' },
  { name: 'green', label: 'Green', bg: 'bg-green-500' },
  { name: 'orange', label: 'Orange', bg: 'bg-orange-500' },
  { name: 'red', label: 'Red', bg: 'bg-red-500' },
  { name: 'indigo', label: 'Indigo', bg: 'bg-indigo-500' },
];

const ThemeSelector = () => {
  const { mode, palette, setMode, setPalette } = useTheme();

  const toggleMode = () => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="flex items-center gap-2">
      {/* Light/Dark Mode Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMode}
        className="rounded-full hover:bg-primary/10"
        title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
      >
        {mode === 'dark' ? (
          <Sun className="h-5 w-5 text-yellow-400" />
        ) : (
          <Moon className="h-5 w-5 text-blue-600" />
        )}
      </Button>

      {/* Color Palette Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-primary/10"
            title="Select color palette"
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute w-4 h-4 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500" />
              <div className="w-3 h-3 rounded-full bg-background relative" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs uppercase tracking-wider">
            Color Palette
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="grid grid-cols-4 gap-2 p-2">
            {colorOptions.map((option) => (
              <button
                key={option.name}
                onClick={() => setPalette(option.name)}
                className={`w-8 h-8 rounded-lg transition-all ${option.bg} ${
                  palette === option.name ? 'ring-2 ring-offset-2 ring-offset-background' : 'hover:opacity-80'
                }`}
                title={option.label}
              />
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default ThemeSelector;
