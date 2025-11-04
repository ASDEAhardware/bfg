# Tab Site Isolation Implementation

## Problem Solved

**Original Issue**: When multiple datalogger tabs/sections were open, they all shared the same global site selection. Changing the site dropdown affected ALL tabs simultaneously, making the tab/grid system useless for comparing different sites.

**Solution**: Implemented a hierarchical site context system where each tab and grid section can have its own independent site selection.

## Architecture Overview

### Context Hierarchy
```
Global SiteContext (fallback for normal mode)
    ↓ inherits from
TabSiteContext (isolated context per tab)
    ↓ inherits from
SectionSiteContext (isolated context per grid section)
    ↓ consumed by
useUnifiedSiteContext() (automatically selects most specific)
```

### File Structure
```
src/contexts/
├── SiteContext.tsx              # Original global context (unchanged)
├── TabSiteContext.tsx           # Tab-level isolation
└── SectionSiteContext.tsx      # Section-level isolation

src/hooks/
└── useUnifiedSiteContext.ts     # Unified hook that replaces useSiteContext()

src/components/
├── TabSiteSelector.tsx          # Site selector for tabs
├── SectionSiteSelector.tsx     # Site selector for grid sections
├── TabContentWithProvider.tsx  # Tab wrapper with TabSiteProvider
├── GridSectionWithProvider.tsx # Section wrapper with SectionSiteProvider
├── GlobalSiteIndicator.tsx     # Replacement for global selector
└── TabContextHeader.tsx        # Header for tab contexts
```

## Key Components

### 1. TabSiteContext (`src/contexts/TabSiteContext.tsx`)
- **Purpose**: Provides isolated site context for each tab
- **Storage**: Zustand store with persistence (`tab-site-storage`)
- **Key Features**:
  - Each tab has unique ID and can store its own `selectedSiteId`
  - Inherits from global context when no tab-specific selection
  - Auto-cleanup of old contexts (24h)
  - Fully backward compatible

### 2. SectionSiteContext (`src/contexts/SectionSiteContext.tsx`)
- **Purpose**: Provides isolated site context for each grid section
- **Storage**: Zustand store with persistence (`section-site-storage`)
- **Key Features**:
  - Each section has unique ID and can store its own `selectedSiteId`
  - Three-level inheritance: Section → Tab → Global
  - Auto-cleanup of old contexts (24h)

### 3. useUnifiedSiteContext (`src/hooks/useUnifiedSiteContext.ts`)
- **Purpose**: Single hook that replaces `useSiteContext()` throughout the app
- **Behavior**: Automatically uses the most specific context available:
  - If in SectionSiteProvider → uses section context
  - Else if in TabSiteProvider → uses tab context
  - Else → uses global context
- **Migration**: Replace `useSiteContext()` with `useUnifiedSiteContext()`

## Implementation Details

### DataLogger Integration
The main target component `DataLoggerPage.tsx` was updated:
```typescript
// OLD
import { useSiteContext } from '@/contexts/SiteContext';
const { selectedSiteId } = useSiteContext();

// NEW
import { useUnifiedSiteContext } from '@/hooks/useUnifiedSiteContext';
const { selectedSiteId } = useUnifiedSiteContext();
```

### Tab Integration
Every tab content is now wrapped with `TabSiteProvider`:
```typescript
<TabSiteProvider tabId={tab.id}>
  <TabContentRenderer tab={tab} />
</TabSiteProvider>
```

### Grid Integration
Every grid section is now wrapped with `SectionSiteProvider`:
```typescript
<SectionSiteProvider sectionId={section.id}>
  <GridSection {...props} />
</SectionSiteProvider>
```

### UI Changes
- **Global Header**: SiteSelector hidden when tab/grid modes active
- **Global Indicator**: Shows current mode and provides emergency exit
- **Tab Headers**: Include TabSiteSelector for independent site selection
- **Grid Sections**: Include SectionSiteSelector in section controls

## Storage & Persistence

### Tab Contexts (`localStorage: tab-site-storage`)
```typescript
{
  "tab-url-timestamp": {
    selectedSiteId: 123,
    timestamp: 1672531200000
  }
}
```

### Section Contexts (`localStorage: section-site-storage`)
```typescript
{
  "grid-section-id": {
    selectedSiteId: 456,
    timestamp: 1672531200000
  }
}
```

## Cleanup Strategy

### Automatic Cleanup
- **Tab close**: Context removed when tab closed
- **Section close**: Context removed when section closed
- **Time-based**: Contexts older than 24h removed automatically
- **Mode exit**: All contexts cleared when exiting tab/grid modes

### Manual Cleanup
```typescript
// Clear specific tab context
useTabSiteStore.getState().clearTabSiteId(tabId);

// Clear specific section context
useSectionSiteStore.getState().clearSectionSiteId(sectionId);
```

## Testing

### Test Page: `/test-tab-isolation`
Provides real-time diagnostics showing:
- Current site selection
- Context type (global/tab/section)
- Inheritance information
- All available sites
- Step-by-step testing instructions

### Test Scenarios
1. **Basic Tab Isolation**: Multiple datalogger tabs with different sites
2. **Grid Section Isolation**: Multiple sections with different sites
3. **Mixed Mode**: Tab + Grid with independent contexts
4. **Inheritance Testing**: Fallback behavior verification
5. **Cleanup Testing**: Context removal on close

## Migration Guide

### For Components Using Site Context
```typescript
// Replace this:
import { useSiteContext } from '@/contexts/SiteContext';
const { selectedSiteId, selectedSite } = useSiteContext();

// With this:
import { useUnifiedSiteContext } from '@/hooks/useUnifiedSiteContext';
const { selectedSiteId, selectedSite } = useUnifiedSiteContext();
```

### For New Components
- Use `useUnifiedSiteContext()` by default
- No need to worry about context providers - they're handled automatically
- Components work the same in all modes (normal/tab/grid)

## Performance Considerations

### Memory Usage
- Each tab context: ~100 bytes
- Each section context: ~100 bytes
- Automatic cleanup prevents memory leaks
- Persistent storage for crash recovery

### Rendering
- No additional re-renders introduced
- Context changes only affect specific tab/section
- Zustand provides efficient subscriptions

## Backward Compatibility

### 100% Backward Compatible
- Existing components work unchanged
- Old `useSiteContext()` calls still work
- No breaking changes to APIs
- Gradual migration possible

### Future-Proof
- New components automatically get isolation benefits
- Easy to extend to other contexts (user, theme, etc.)
- Scales to unlimited tabs/sections

## Best Practices

### Do's
- Use `useUnifiedSiteContext()` for new components
- Let providers handle context automatically
- Trust the inheritance hierarchy
- Use diagnostic tools for debugging

### Don'ts
- Don't create providers manually
- Don't mix `useSiteContext()` with `useUnifiedSiteContext()`
- Don't store context IDs in component state
- Don't disable auto-cleanup unless necessary

## Troubleshooting

### Common Issues
1. **Context not isolated**: Check if component is inside proper provider
2. **Memory leaks**: Verify cleanup functions are called
3. **Inheritance not working**: Check provider hierarchy
4. **Persistence issues**: Clear localStorage if corrupted

### Debug Tools
- Use `/test-tab-isolation` for diagnostics
- Console logs show cleanup operations
- React DevTools show provider nesting
- Browser Storage shows persisted contexts

## Future Extensions

### Possible Enhancements
- **User Context Isolation**: Per-tab user sessions
- **Theme Context Isolation**: Per-tab themes
- **Filter Context Isolation**: Per-tab search/filter states
- **View Context Isolation**: Per-tab view preferences

### Implementation Pattern
The same pattern can be applied to any context:
1. Create isolated store with persistence
2. Create provider with inheritance
3. Update unified hook to use new context
4. Integrate providers into wrapper components

## Success Metrics

### Problem Resolution
✅ **Multiple datalogger tabs**: Can now have different sites
✅ **Grid sections**: Each section has independent site selection
✅ **No shared state**: Changing one tab/section doesn't affect others
✅ **Intuitive UX**: Users can naturally work with multiple sites
✅ **Zero breaking changes**: Existing functionality preserved

### Performance
✅ **Fast context switching**: Instant site changes per tab/section
✅ **Efficient memory usage**: Auto-cleanup prevents bloat
✅ **Persistent state**: Survives page reloads and crashes
✅ **Scalable**: Works with unlimited tabs/sections

This implementation successfully solves the original problem while maintaining full backward compatibility and providing a foundation for future context isolation features.