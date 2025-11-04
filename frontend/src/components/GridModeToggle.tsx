import { Grid3X3, PanelsTopLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGridStore } from '@/store/gridStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useRouter, usePathname } from 'next/navigation'

const localIgnoredPaths = ['/version', '/settings']; // Define locally for now

export function GridModeToggle() {
  const { isGridModeEnabled, toggleGridMode } = useGridStore()
  const router = useRouter()

  const handleClick = () => {
    // Always perform the toggle behavior and navigate to the dashboard.
    toggleGridMode();
    router.push('/dashboard');
  }

  // The tooltip now simply reflects the current state.
  const currentTooltipMessage = isGridModeEnabled ? "Disable Grid Mode" : "Enable Grid Mode";

  const button = (
    <Button
      variant={isGridModeEnabled ? "default" : "outline"}
      size="icon"
      onClick={handleClick}
      className={isGridModeEnabled ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
    >
      {isGridModeEnabled ? (
        <Grid3X3 className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <PanelsTopLeft className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">Toggle grid mode</span>
    </Button>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {button}
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center">
        {currentTooltipMessage}
      </TooltipContent>
    </Tooltip>
  )
}