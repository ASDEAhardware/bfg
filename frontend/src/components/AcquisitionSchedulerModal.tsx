"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  Calendar,
  Infinity,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface AcquisitionSchedulerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (schedule: AcquisitionSchedule) => void;
}

export interface AcquisitionSchedule {
  name: string;
  description?: string;
  startTime: string;
  duration: number | null; // in minutes, null = continuous
  recurrence: 'once' | 'daily' | 'custom';
  customDays?: number[]; // 0-6 (Sunday-Saturday)
  dateRange?: {
    start: string;
    end?: string; // undefined = forever
  };
  repeatPattern?: 'weekly' | 'monthly';
}

const DAYS_OF_WEEK = [
  { label: 'M', value: 1, fullName: 'Monday' },
  { label: 'T', value: 2, fullName: 'Tuesday' },
  { label: 'W', value: 3, fullName: 'Wednesday' },
  { label: 'T', value: 4, fullName: 'Thursday' },
  { label: 'F', value: 5, fullName: 'Friday' },
  { label: 'S', value: 6, fullName: 'Saturday' },
  { label: 'S', value: 0, fullName: 'Sunday' },
];

const DURATION_PRESETS = [
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
  { label: '4h', minutes: 240 },
  { label: '8h', minutes: 480 },
];

export function AcquisitionSchedulerModal({
  open,
  onOpenChange,
  onSave,
}: AcquisitionSchedulerModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState<number | null>(120); // Default 2h
  const [isContinuous, setIsContinuous] = useState(false);
  const [customHours, setCustomHours] = useState(2);
  const [customMinutes, setCustomMinutes] = useState(0);
  const [recurrence, setRecurrence] = useState<'once' | 'daily' | 'custom'>('custom');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]); // Mon, Wed, Fri
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [isForever, setIsForever] = useState(true);
  const [repeatPattern, setRepeatPattern] = useState<'weekly' | 'monthly'>('weekly');

  // Toggle day selection
  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  // Handle duration preset click
  const handlePresetClick = (minutes: number) => {
    setIsContinuous(false);
    setDuration(minutes);
    setCustomHours(Math.floor(minutes / 60));
    setCustomMinutes(minutes % 60);
  };

  // Handle continuous toggle
  const handleContinuousToggle = () => {
    setIsContinuous(!isContinuous);
    if (!isContinuous) {
      setDuration(null);
      setRecurrence('once'); // Continuous can't have custom days
    } else {
      setDuration(120);
      setCustomHours(2);
      setCustomMinutes(0);
    }
  };

  // Update duration from custom inputs
  React.useEffect(() => {
    if (!isContinuous) {
      const totalMinutes = customHours * 60 + customMinutes;
      setDuration(totalMinutes);
    }
  }, [customHours, customMinutes, isContinuous]);

  // Generate preview of next occurrences
  const nextOccurrences = useMemo(() => {
    if (!name || !startTime) return [];

    const previews: string[] = [];
    const today = new Date();
    const [hours, minutes] = startTime.split(':').map(Number);

    if (recurrence === 'once') {
      const date = new Date(today);
      date.setHours(hours, minutes, 0, 0);
      if (date < today) {
        date.setDate(date.getDate() + 1);
      }

      const endDate = duration ? new Date(date.getTime() + duration * 60000) : null;
      const preview = `${date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })} ${startTime}${endDate ? ` → ${endDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ' (continuous)'}`;
      previews.push(preview);
    } else if (recurrence === 'daily') {
      for (let i = 0; i < 3; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        date.setHours(hours, minutes, 0, 0);

        const endDate = duration ? new Date(date.getTime() + duration * 60000) : null;
        const preview = `${date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })} ${startTime}${endDate ? ` → ${endDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ' (continuous)'}`;
        previews.push(preview);
      }
    } else if (recurrence === 'custom' && selectedDays.length > 0) {
      let count = 0;
      let currentDate = new Date(today);

      while (count < 3) {
        if (selectedDays.includes(currentDate.getDay())) {
          currentDate.setHours(hours, minutes, 0, 0);
          const endDate = duration ? new Date(currentDate.getTime() + duration * 60000) : null;
          const durationStr = duration ? `${Math.floor(duration / 60)}h${duration % 60 > 0 ? `${duration % 60}m` : ''}` : 'continuous';
          const preview = `${currentDate.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })} ${startTime} → ${endDate ? endDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '∞'} (${durationStr})`;
          previews.push(preview);
          count++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return previews;
  }, [name, startTime, duration, recurrence, selectedDays]);

  // Validation
  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    if (!startTime) return false;
    if (!isContinuous && (!duration || duration <= 0)) return false;
    if (recurrence === 'custom' && selectedDays.length === 0) return false;
    return true;
  }, [name, startTime, duration, isContinuous, recurrence, selectedDays]);

  const handleSave = () => {
    if (!isValid) {
      toast.error("Please fill in all required fields");
      return;
    }

    const schedule: AcquisitionSchedule = {
      name: name.trim(),
      description: description.trim() || undefined,
      startTime,
      duration: isContinuous ? null : duration,
      recurrence,
      customDays: recurrence === 'custom' ? selectedDays : undefined,
      dateRange: showAdvanced && dateStart ? {
        start: dateStart,
        end: isForever ? undefined : dateEnd || undefined,
      } : undefined,
      repeatPattern: showAdvanced && repeatPattern ? repeatPattern : undefined,
    };

    console.log("Saving schedule:", schedule);
    toast.success(`Schedule "${name}" created successfully!`);
    onSave?.(schedule);
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setStartTime("09:00");
    setDuration(120);
    setIsContinuous(false);
    setCustomHours(2);
    setCustomMinutes(0);
    setRecurrence('custom');
    setSelectedDays([1, 3, 5]);
    setShowAdvanced(false);
    setDateStart("");
    setDateEnd("");
    setIsForever(true);
    setRepeatPattern('weekly');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Acquisition
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="h-1 w-1 rounded-full bg-primary" />
                Basic Info
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Morning Data Collection"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  placeholder="Additional details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                />
              </div>
            </div>

            <Separator />

            {/* Timing */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-primary" />
                Timing
              </div>

              {/* Start Time */}
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-40"
                />
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Duration *</Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="continuous" className="text-xs text-muted-foreground font-normal">
                      Continuous
                    </Label>
                    <Switch
                      id="continuous"
                      checked={isContinuous}
                      onCheckedChange={handleContinuousToggle}
                    />
                  </div>
                </div>

                {isContinuous ? (
                  <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
                    <Infinity className="h-4 w-4 text-primary" />
                    <span className="text-sm">Runs continuously until manually stopped</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Presets */}
                    <div className="flex flex-wrap gap-2">
                      {DURATION_PRESETS.map((preset) => (
                        <Button
                          key={preset.minutes}
                          variant={duration === preset.minutes ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handlePresetClick(preset.minutes)}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>

                    {/* Custom Duration */}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Custom:</Label>
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        value={customHours}
                        onChange={(e) => setCustomHours(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-16"
                      />
                      <span className="text-sm">h</span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={customMinutes}
                        onChange={(e) => setCustomMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-16"
                      />
                      <span className="text-sm">m</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Recurrence */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="h-1 w-1 rounded-full bg-primary" />
                Recurrence
              </div>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    variant={recurrence === 'once' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRecurrence('once')}
                  >
                    Once
                  </Button>
                  <Button
                    variant={recurrence === 'daily' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRecurrence('daily')}
                    disabled={isContinuous}
                  >
                    Daily
                  </Button>
                  <Button
                    variant={recurrence === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRecurrence('custom')}
                    disabled={isContinuous}
                  >
                    Custom Days
                  </Button>
                </div>

                {recurrence === 'custom' && !isContinuous && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Select days:</Label>
                    <div className="flex gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <Button
                          key={day.value}
                          variant={selectedDays.includes(day.value) ? 'default' : 'outline'}
                          size="sm"
                          className="w-10 h-10 p-0"
                          onClick={() => toggleDay(day.value)}
                          title={day.fullName}
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                    {selectedDays.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Selected: {selectedDays.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.fullName).join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Advanced Options */}
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="text-xs">Advanced Options</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="space-y-3 p-4 border rounded-md bg-muted/10">
                    <Label className="text-sm">Date Range</Label>

                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="dateStart" className="text-xs text-muted-foreground">From</Label>
                          <Input
                            id="dateStart"
                            type="date"
                            value={dateStart}
                            onChange={(e) => setDateStart(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="dateEnd" className="text-xs text-muted-foreground">
                            To {isForever && <span className="text-primary">(Forever)</span>}
                          </Label>
                          <Input
                            id="dateEnd"
                            type="date"
                            value={dateEnd}
                            onChange={(e) => setDateEnd(e.target.value)}
                            disabled={isForever}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          id="forever"
                          checked={isForever}
                          onCheckedChange={setIsForever}
                        />
                        <Label htmlFor="forever" className="text-xs font-normal">Run forever</Label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="repeatPattern" className="text-xs text-muted-foreground">Repeat Pattern</Label>
                      <Select value={repeatPattern} onValueChange={(v: 'weekly' | 'monthly') => setRepeatPattern(v)}>
                        <SelectTrigger id="repeatPattern">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <Separator />

            {/* Preview */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="h-1 w-1 rounded-full bg-primary" />
                Preview
              </div>

              <div className="space-y-2 p-4 border rounded-md bg-muted/10">
                {nextOccurrences.length > 0 ? (
                  <>
                    <div className="text-xs font-medium text-muted-foreground">Next occurrences:</div>
                    {nextOccurrences.map((occurrence, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {occurrence}
                      </div>
                    ))}
                    {recurrence !== 'once' && (
                      <div className="text-xs text-muted-foreground mt-2">
                        ... and {recurrence === 'daily' ? 'every day' : recurrence === 'custom' ? `every ${selectedDays.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.label).join(', ')}` : ''} {isForever ? 'forever' : `until ${dateEnd || 'specified date'}`}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">Configure schedule to see preview</div>
                )}
              </div>
            </div>

            {/* Conflicts */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="h-1 w-1 rounded-full bg-primary" />
                Conflicts
              </div>

              <div className="flex items-center gap-2 p-3 border rounded-md bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-700 dark:text-green-300">No overlapping schedules</span>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            Save Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
