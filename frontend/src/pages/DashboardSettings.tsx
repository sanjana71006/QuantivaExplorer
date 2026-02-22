import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DashboardSettings = () => {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground mb-1">Settings</h2>
        <p className="text-muted-foreground text-sm">Configure application preferences.</p>
      </div>

      <div className="glass-card p-6 space-y-6">
        <h3 className="font-display font-semibold text-foreground">General</h3>

        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">Auto-run simulation on dataset change</Label>
          <Switch className="data-[state=checked]:bg-primary" />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">Show advanced descriptors</Label>
          <Switch defaultChecked className="data-[state=checked]:bg-primary" />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">Enable animations</Label>
          <Switch defaultChecked className="data-[state=checked]:bg-primary" />
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Default scoring algorithm</Label>
          <Select defaultValue="quantum">
            <SelectTrigger className="bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="quantum">Quantum-Inspired Search</SelectItem>
              <SelectItem value="classical">Classical Ranking</SelectItem>
              <SelectItem value="hybrid">Hybrid Approach</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Export format</Label>
          <Select defaultValue="csv">
            <SelectTrigger className="bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default DashboardSettings;
