"use client";
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Pause, Download, Trash2, Database } from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  source: string;
  message: string;
  data?: any;
}

export default function DataLoggerPage() {
  const [isLogging, setIsLogging] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    errors: 0,
    warnings: 0,
    info: 0
  });

  // Simulate log generation
  useEffect(() => {
    if (!isLogging) return;

    const interval = setInterval(() => {
      const sources = ['API', 'Database', 'Authentication', 'File System', 'Network'];
      const levels: ('info' | 'warning' | 'error')[] = ['info', 'warning', 'error'];
      const messages = [
        'Request processed successfully',
        'Database connection established',
        'User authentication failed',
        'File uploaded successfully',
        'Network timeout detected',
        'Cache cleared',
        'Configuration updated'
      ];

      const newLog: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        level: levels[Math.floor(Math.random() * levels.length)],
        source: sources[Math.floor(Math.random() * sources.length)],
        message: messages[Math.floor(Math.random() * messages.length)],
        data: Math.random() > 0.7 ? { value: Math.floor(Math.random() * 100) } : undefined
      };

      setLogs(prev => [newLog, ...prev.slice(0, 99)]); // Keep last 100 logs
    }, 2000);

    return () => clearInterval(interval);
  }, [isLogging]);

  // Update stats when logs change
  useEffect(() => {
    const newStats = logs.reduce((acc, log) => {
      acc.total++;
      acc[log.level]++;
      return acc;
    }, { total: 0, errors: 0, warnings: 0, info: 0 });

    setStats(newStats);
  }, [logs]);

  const toggleLogging = () => {
    setIsLogging(!isLogging);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const exportLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      case 'info': return 'default';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Logger</h1>
          <p className="text-muted-foreground">Monitor and track system events in real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={toggleLogging}
            variant={isLogging ? "destructive" : "default"}
            className="gap-2"
          >
            {isLogging ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isLogging ? 'Stop' : 'Start'} Logging
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <div className="h-3 w-3 rounded-full bg-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.warnings}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Info</CardTitle>
            <div className="h-3 w-3 rounded-full bg-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.info}</div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Display */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Live Logs</CardTitle>
              <CardDescription>
                {isLogging ? 'Capturing logs in real-time' : 'Logging stopped'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportLogs} variant="outline" size="sm" disabled={logs.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={clearLogs} variant="outline" size="sm" disabled={logs.length === 0}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] w-full">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No logs to display. Start logging to see events.
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border">
                    <Badge variant={getLevelColor(log.level) as any} className="mt-0.5">
                      {log.level}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{log.source}</span>
                        <span className="text-muted-foreground">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{log.message}</p>
                      {log.data && (
                        <pre className="text-xs mt-2 p-2 bg-muted rounded">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}