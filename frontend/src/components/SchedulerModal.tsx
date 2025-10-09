"use client"
import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Clock,
  Calendar as CalendarIcon,
  Repeat,
  Trash2,
  Plus
} from "lucide-react"

interface ScheduleItem {
  id: string
  type: 'daily' | 'weekly' | 'custom'
  time: string
  endTime: string
  duration?: string
  days?: string[]
  startDate?: string
  endDate?: string
  active: boolean
  description: string
}

interface SchedulerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (schedule: Omit<ScheduleItem, 'id'>) => void
}

const DAYS = [
  { key: 'mon', label: 'L', full: 'Lunedì' },
  { key: 'tue', label: 'M', full: 'Martedì' },
  { key: 'wed', label: 'M', full: 'Mercoledì' },
  { key: 'thu', label: 'G', full: 'Giovedì' },
  { key: 'fri', label: 'V', full: 'Venerdì' },
  { key: 'sat', label: 'S', full: 'Sabato' },
  { key: 'sun', label: 'D', full: 'Domenica' },
]

export function SchedulerModal({ open, onOpenChange, onSave }: SchedulerModalProps) {
  const [activeTab, setActiveTab] = useState("create")
  const [scheduleType, setScheduleType] = useState<'daily' | 'weekly' | 'custom'>('weekly')
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [time, setTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [duration, setDuration] = useState('1h')
  const [isRepeating, setIsRepeating] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [description, setDescription] = useState('')

  // Mock data per la tabella
  const [schedules] = useState<ScheduleItem[]>([
    {
      id: '1',
      type: 'weekly',
      time: '08:00',
      endTime: '10:00',
      days: ['mon', 'wed', 'fri'],
      active: true,
      description: 'Acquisizione mattutina'
    },
    {
      id: '2',
      type: 'daily',
      time: '18:00',
      endTime: '20:00',
      active: false,
      description: 'Backup serale'
    },
    {
      id: '3',
      type: 'custom',
      time: '12:00',
      endTime: '14:00',
      startDate: '2024-01-15',
      endDate: '2024-01-20',
      active: true,
      description: 'Test periodo specifico'
    }
  ])

  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    )
  }

  const calculateEndTime = (startTime: string, durationStr: string): string => {
    const [hours, minutes] = startTime.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes

    let durationMinutes = 0
    if (durationStr.includes('h')) {
      const hoursMatch = durationStr.match(/(\d+)h/)
      if (hoursMatch) durationMinutes += parseInt(hoursMatch[1]) * 60
    }
    if (durationStr.includes('m')) {
      const minutesMatch = durationStr.match(/(\d+)m/)
      if (minutesMatch) durationMinutes += parseInt(minutesMatch[1])
    }

    const endTotalMinutes = totalMinutes + durationMinutes
    const endHours = Math.floor(endTotalMinutes / 60) % 24
    const endMinutes = endTotalMinutes % 60

    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
  }

  const calculateDuration = (startTime: string, endTime: string): string => {
    const [startHours, startMinutes] = startTime.split(':').map(Number)
    const [endHours, endMinutes] = endTime.split(':').map(Number)

    const startTotalMinutes = startHours * 60 + startMinutes
    let endTotalMinutes = endHours * 60 + endMinutes

    // Se l'ora finale è minore di quella iniziale, assumiamo che sia il giorno dopo
    if (endTotalMinutes <= startTotalMinutes) {
      endTotalMinutes += 24 * 60
    }

    const diffMinutes = endTotalMinutes - startTotalMinutes
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60

    if (hours > 0 && minutes > 0) {
      return `${hours}h${minutes}m`
    } else if (hours > 0) {
      return `${hours}h`
    } else {
      return `${minutes}m`
    }
  }

  const handleTimeChange = (newTime: string) => {
    setTime(newTime)
    // Ricalcola l'ora fine mantenendo la durata
    if (duration) {
      const newEndTime = calculateEndTime(newTime, duration)
      setEndTime(newEndTime)
    }
  }

  const handleEndTimeChange = (newEndTime: string) => {
    setEndTime(newEndTime)
    // Ricalcola la durata
    const newDuration = calculateDuration(time, newEndTime)
    setDuration(newDuration)
  }

  const handleDurationChange = (newDuration: string) => {
    setDuration(newDuration)
    // Ricalcola l'ora fine
    if (newDuration) {
      const newEndTime = calculateEndTime(time, newDuration)
      setEndTime(newEndTime)
    }
  }

  const handleSave = () => {
    const schedule: Omit<ScheduleItem, 'id'> = {
      type: scheduleType,
      time,
      endTime,
      duration,
      days: scheduleType === 'weekly' ? selectedDays : undefined,
      startDate: scheduleType === 'custom' ? startDate : undefined,
      endDate: scheduleType === 'custom' ? endDate : undefined,
      active: true,
      description: description || 'Nuova pianificazione'
    }
    onSave(schedule)
    onOpenChange(false)
  }

  const formatDays = (days?: string[]) => {
    if (!days) return '-'
    return days.map(day => DAYS.find(d => d.key === day)?.label).join(', ')
  }

  const formatScheduleType = (type: string) => {
    switch (type) {
      case 'daily': return 'Giornaliera'
      case 'weekly': return 'Settimanale'
      case 'custom': return 'Personalizzata'
      default: return type
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Pianificatore Acquisizioni
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Crea Pianificazione</TabsTrigger>
            <TabsTrigger value="manage">Gestisci Pianificazioni</TabsTrigger>
          </TabsList>

          {/* Tab Creazione */}
          <TabsContent value="create" className="flex-1 flex flex-col">
            <div className="flex-1 overflow-auto p-1">
              <div className="space-y-4">

              {/* Tipo di pianificazione */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Tipo di pianificazione</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={scheduleType === 'daily' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setScheduleType('daily')}
                    className="cursor-pointer"
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Giornaliera
                  </Button>
                  <Button
                    variant={scheduleType === 'weekly' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setScheduleType('weekly')}
                    className="cursor-pointer"
                  >
                    <Repeat className="h-4 w-4 mr-1" />
                    Settimanale
                  </Button>
                  <Button
                    variant={scheduleType === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setScheduleType('custom')}
                    className="cursor-pointer"
                  >
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    Personalizzata
                  </Button>
                </div>
              </div>

                {/* Container per contenuto dinamico */}
                <div>
                {/* Selettore giorni (solo per settimanale) */}
                {scheduleType === 'weekly' && (
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Giorni della settimana</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map((day) => (
                        <Button
                          key={day.key}
                          variant={selectedDays.includes(day.key) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleDay(day.key)}
                          className="w-12 h-12 p-0 cursor-pointer"
                          title={day.full}
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                    {selectedDays.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Selezionati: {selectedDays.map(day => DAYS.find(d => d.key === day)?.full).join(', ')}
                      </p>
                    )}
                  </div>
                )}

                {/* Date personalizzate */}
                {scheduleType === 'custom' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Data inizio</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">Data fine</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Giornaliera - mostra messaggio */}
                {scheduleType === 'daily' && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      {isRepeating
                        ? "La pianificazione verrà eseguita ogni giorno all'orario indicato."
                        : "La pianificazione verrà eseguita solo oggi nell'orario indicato."}
                    </p>
                  </div>
                )}
                </div>

                {/* Orari e durata */}
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="time">Ora inizio</Label>
                      <Input
                        id="time"
                        type="time"
                        value={time}
                        onChange={(e) => handleTimeChange(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration">Durata (es: 2h, 30m, 1h30m)</Label>
                      <Input
                        id="duration"
                        placeholder="2h, 30m, 1h30m..."
                        value={duration}
                        onChange={(e) => handleDurationChange(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime">Ora fine</Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={endTime}
                        onChange={(e) => handleEndTimeChange(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Descrizione */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrizione</Label>
                    <Input
                      id="description"
                      placeholder="Descrizione acquisizione..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  {/* Toggle ripetizione */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="repeating"
                      checked={isRepeating}
                      onCheckedChange={setIsRepeating}
                    />
                    <Label htmlFor="repeating">Ripeti pianificazione</Label>
                  </div>
                </div>
              </div>
              </div>

              {/* Pulsanti fissi in fondo */}
              <div className="border-t pt-4 mt-4">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="cursor-pointer"
                  >
                    Annulla
                  </Button>
                  <Button
                    onClick={handleSave}
                    className="cursor-pointer"
                    disabled={scheduleType === 'weekly' && selectedDays.length === 0}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi Pianificazione
                  </Button>
                </div>
              </div>
          </TabsContent>
          {/* Tab Gestione */}
          <TabsContent value="manage" className="flex-1 overflow-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Pianificazioni Attive</h3>
                <Badge variant="outline">{schedules.length} pianificazioni</Badge>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Orario</TableHead>
                      <TableHead>Durata</TableHead>
                      <TableHead className="hidden md:table-cell">Giorni/Date</TableHead>
                      <TableHead>Descrizione</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="w-20">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((schedule) => (
                      <TableRow key={schedule.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {formatScheduleType(schedule.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{schedule.time} - {schedule.endTime}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {schedule.duration || '1h'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {schedule.type === 'weekly' ? formatDays(schedule.days) :
                           schedule.type === 'custom' ? `${schedule.startDate} - ${schedule.endDate}` : 'Ogni giorno'}
                        </TableCell>
                        <TableCell>{schedule.description}</TableCell>
                        <TableCell>
                          <Badge
                            variant={schedule.active ? 'default' : 'secondary'}
                            className={schedule.active ? 'text-white bg-green-600' : ''}
                          >
                            {schedule.active ? 'Attivo' : 'Inattivo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}