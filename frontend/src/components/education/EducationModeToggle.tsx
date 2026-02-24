import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Lightbulb, Zap } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { useGlobalExploration } from '@/context/GlobalExplorationContext';

export default function EducationModeToggle() {
  const { educationMode, setEducationMode } = useGlobalExploration();

  const handleToggle = (checked: boolean) => {
    setEducationMode({ enabled: checked });
  };

  const handleStartExplainer = () => {
    setEducationMode({
      enabled: true,
      showStepExplainer: true,
      currentStep: 0,
    });
  };

  const handleGuidanceLevel = (level: 'detailed' | 'moderate' | 'minimal') => {
    setEducationMode({ guidanceLevel: level });
  };

  const handleAnimationSpeed = (speed: 'slow' | 'normal' | 'fast') => {
    setEducationMode({ animationSpeed: speed });
  };

  return (
    <div className="flex items-center gap-2">
      <motion.div
        className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg border border-border/50"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <BookOpen className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Education</span>
        <Switch
          checked={educationMode.enabled}
          onCheckedChange={handleToggle}
          className="h-5 w-9"
        />
      </motion.div>

      {educationMode.enabled && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="flex items-center gap-1"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartExplainer}
            className="gap-1.5 text-xs"
          >
            <Zap className="w-3.5 h-3.5" />
            Scoring Walkthrough
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <Lightbulb className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Guidance Level</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={educationMode.guidanceLevel === 'detailed'}
                onCheckedChange={() => handleGuidanceLevel('detailed')}
              >
                <div className="flex flex-col">
                  <span>Detailed</span>
                  <span className="text-xs text-muted-foreground">All tooltips & explanations</span>
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={educationMode.guidanceLevel === 'moderate'}
                onCheckedChange={() => handleGuidanceLevel('moderate')}
              >
                <div className="flex flex-col">
                  <span>Moderate</span>
                  <span className="text-xs text-muted-foreground">Key insights only</span>
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={educationMode.guidanceLevel === 'minimal'}
                onCheckedChange={() => handleGuidanceLevel('minimal')}
              >
                <div className="flex flex-col">
                  <span>Minimal</span>
                  <span className="text-xs text-muted-foreground">Subtle highlights</span>
                </div>
              </DropdownMenuCheckboxItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Animation Speed</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={educationMode.animationSpeed === 'slow'}
                onCheckedChange={() => handleAnimationSpeed('slow')}
              >
                Slow (for detailed learning)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={educationMode.animationSpeed === 'normal'}
                onCheckedChange={() => handleAnimationSpeed('normal')}
              >
                Normal (default)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={educationMode.animationSpeed === 'fast'}
                onCheckedChange={() => handleAnimationSpeed('fast')}
              >
                Fast (quick review)
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {educationMode.guidanceLevel !== 'moderate' && (
            <Badge variant="secondary" className="text-xs">
              {educationMode.guidanceLevel === 'detailed' ? '📚 Detailed' : '⚡ Minimal'}
            </Badge>
          )}
        </motion.div>
      )}
    </div>
  );
}
