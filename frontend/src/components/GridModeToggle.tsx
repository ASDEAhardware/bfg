import { Grid3X3, PanelsTopLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGridStore } from '@/store/gridStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useRouter, usePathname } from 'next/navigation'

const localIgnoredPaths = ['/version', '/settings']; // Define locally for now

export function GridModeToggle() {
  const { isGridModeEnabled, toggleGridMode } = useGridStore()
  const router = useRouter()
  const pathname = usePathname()

  const handleClick = () => {
    // If we are on an ignored path AND grid mode is currently enabled,
    // the user wants to return to the grid. So, just navigate to dashboard.
    // Grid mode will remain enabled, and dashboard will display the grid.
    if (localIgnoredPaths.includes(pathname) && isGridModeEnabled) {
      router.push('/dashboard');
      return;
    }

    // Otherwise, perform the normal toggle behavior.
    toggleGridMode();
    router.push('/dashboard');
  }

  // Adjust tooltip and title based on context
  let currentTooltipMessage = "";
  if (localIgnoredPaths.includes(pathname) && isGridModeEnabled) {
    currentTooltipMessage = "Return to Grid View";
  } else {
    currentTooltipMessage = (isGridModeEnabled ? "Disable Grid Mode" : "Enable Grid Mode");
  }

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