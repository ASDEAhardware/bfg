"use client"

import { useState } from "react"
import { Trash2, Plus } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { type SensorType, SENSOR_ICONS } from "@/config/sensors"

interface SensorDropdownProps {
  portId: string
  sensors: SensorType[]
  selectedSensor: string | null
  onSelectSensor: (sensor: string) => void
  onRemoveSensor: () => void
  position: "left" | "right"
}

export function SensorDropdown({
  portId,
  sensors,
  selectedSensor,
  onSelectSensor,
  onRemoveSensor,
  position,
}: SensorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  const SelectedIcon = selectedSensor ? SENSOR_ICONS[selectedSensor] : null;

  return (
    <div className={`flex items-center gap-2 ${position === "left" ? "flex-row-reverse" : "flex-row"}`}>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          {selectedSensor && SelectedIcon ? (
            <button className="cursor-pointer flex items-center justify-center sm:justify-start gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 
                               bg-slate-900 text-white hover:bg-slate-700 focus:ring-slate-500 
                               dark:bg-slate-200 dark:text-black dark:hover:bg-slate-300 dark:focus:ring-slate-400 dark:focus:ring-offset-slate-900
                               w-10 h-10 sm:w-auto sm:h-auto">
              <SelectedIcon size={20} aria-hidden="true" />
              <span className="hidden sm:inline">{selectedSensor}</span>
            </button>
          ) : (
            <button className="cursor-pointer w-10 h-10 rounded-full border-2 border-dashed border-gray-400 hover:border-gray-600 flex items-center justify-center transition-colors bg-neutral-900 sm:bg-transparent">
              <Plus size={16} className="text-white sm:text-gray-600" />
            </button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          {sensors.length > 0 ? (
            sensors.map((sensor) => {
              const Icon = sensor.icon;
              return (
                <DropdownMenuItem
                  key={sensor.name}
                  onClick={() => {
                    onSelectSensor(sensor.name)
                    setIsOpen(false)
                  }}
                  className="cursor-pointer flex items-center gap-2"
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>{sensor.name}</span>
                </DropdownMenuItem>
              )
            })
          ) : (
            <DropdownMenuItem disabled>Nessun sensore disponibile</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedSensor && (
        <button
          onClick={onRemoveSensor}
          className="cursor-pointer p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 rounded transition-colors dark:hover:bg-red-950"
          aria-label="Rimuovi sensore"
        >
          <Trash2 size={18} />
        </button>
      )}
    </div>
  )
}
