# Technical Documentation - Phone Repair Simulator

## Architecture Overview

```
phone-repair-simulator.html
├── Game Container
├── Workshop View (Canvas-based 2D rendering)
├── Computer Screen (Tab-based interface)
├── Repair Table View (Canvas + UI)
└── Modals (Diagnostics, Instructions)

phone-repair-simulator.css
└── Complete styling system
    ├── Dark theme (primary: #1a1a1a)
    ├── Cyan accents (#00d4ff)
    └── Responsive design

phone-repair-simulator.js
├── Game State Management
├── Diagnostic Database (1000+ scenarios)
├── UI Controllers
├── Game Logic
├── Save/Load System
└── Event Handlers

phone-repair-simulator-enhanced.js
├── Vector Workshop and Repair-Table Artwork
├── Display-Density and Resize Handling
└── On-Demand Rendering

phone-repair-interactions.js
├── Pointer Capture and Mouse/Touch Tool Dragging
├── Rotation, Edge-Coverage, and Drop-Target Validation
└── Live Gesture Guides and Tool Rendering

Sound System (integrated in JS)
└── Web Audio API synthesis
```

## File Structure

### HTML Structure (phone-repair-simulator.html)
- 129 lines, 5.19 KB
- 6 main view sections (workshop, computer, repair, etc.)
- 3 modal dialogs (diagnostics, instructions, notifications)
- Canvas elements for 2D rendering

### CSS Stylesheet (phone-repair-simulator.css)
- 930 lines, 18.09 KB
- CSS custom properties (color scheme)
- Component-based styling
- Responsive media queries
- Smooth animations and transitions

### JavaScript Core (phone-repair-simulator.js)
- 748 lines, 27.92 KB
- Game state object
- Diagnostic database generator
- UI update functions
- Event listeners
- Save/load implementation
- Canvas rendering

### Enhanced Graphics (phone-repair-simulator-enhanced.js)
- Detailed vector-drawn workshop, tools, and repair table
- Canvas backing resolution follows CSS size and device pixel ratio
- Proportional scene fitting with letterboxing, not stretched artwork
- Redraws on view changes, resizes, and display-density changes

## Data Structures

### Game State Object
```javascript
gameState = {
    money: number,              // Player's balance
    level: number,              // Current level (1-?)
    reputation: number,         // Reputation score
    phonesRepaired: number,     // Total phones fixed
    totalEarnings: number,      // Lifetime earnings
    currentJob: object | null,  // Active repair
    activeRepairs: array,       // In-progress jobs
    completedRepairs: array,    // Finished jobs
    inventory: {
        screens: number,        // Screen parts
        batteries: number,      // Battery parts
        ports: number,         // Charging ports
        screws: number,        // Fasteners
        tools: array           // Tool list
    },
    upgrades: {                // Purchased upgrades
        [upgradeId]: boolean
    }
}
```

### Job Object Structure
```javascript
job = {
    id: "diag_0",              // Unique identifier
    brand: "Apple iPhone",     // Phone brand
    model: "14",               // Phone model
    generation: "2023",        // Release year
    problem: "Cracked screen", // Main issue
    category: "screen",        // Issue category
    symptoms: [                // Visible symptoms
        "Display cracks visible"
    ],
    difficulty: "hard",        // easy|medium|hard
    requiredParts: ["screen"], // Parts needed
    payment: 150               // Reward amount
}
```

### Upgrade Object Structure
```javascript
upgrade = {
    id: "better_tools",              // Upgrade ID
    name: "Professional Tools",      // Display name
    price: 200,                      // Cost in dollars
    effect: "Faster repairs",        // Description
    icon: "🔧"                       // Visual icon
}
```

## Game Loop

```
INIT
  ├─ Load saved game (or create new)
  ├─ Generate diagnostic database
  ├─ Initialize sound system
  ├─ Draw workshop
  └─ Auto-save every 30 seconds

WORKSHOP VIEW
  ├─ Display stats (money, level, reputation)
  ├─ Render 2D workshop with canvas
  ├─ Listen for computer click
  └─ Repeat

COMPUTER OPENED
  ├─ Show OS interface
  ├─ Load job list
  ├─ Wait for user action
  └─ Handle tab switches

JOB ACCEPTED
  ├─ Switch to repair view
  ├─ Load job details
  ├─ Show repair steps
  ├─ Listen for repair actions
  └─ Process diagnostics/repairs

REPAIR COMPLETED
  ├─ Award money and reputation
  ├─ Increase level if threshold met
  ├─ Update statistics
  ├─ Save game
  └─ Return to workshop

UPGRADE PURCHASED
  ├─ Deduct money
  ├─ Mark upgrade as owned
  ├─ Save progress
  └─ Show notification
```

## Game Mechanics

### Job Generation
- Pulls from 1000+ pre-generated scenarios
- Combinations of: brands × models × generations × problems
- Each problem has: difficulty, symptoms, required parts, payment
- 49 problem types × 50 variants = 2,450 scenarios
- Each problem has a `proc` (stored on jobs as `procedureType`) that selects
  its repair procedure in `getRepairProcedure`: `standard`, `display`,
  `battery`, `clean`, `water`, `board`, `backglass`, or `adhesive`. Saved jobs
  without a `procedureType` keep their original step sequence.
- The jobs board excludes active jobs and completed or rejected offer IDs.
  Retired IDs are saved across reloads and reset when all non-active offers
  have been exhausted, allowing the catalog to cycle. Offers are interleaved
  by repair procedure so cleaning and other repair types appear early; every
  fault is offered before its next variant. IDs used by existing saves do not
  change.

### Diagnostic System
Multiple test types reveal different information:
1. **Visual Inspection** - Physical examination
2. **Power Test** - Device responsiveness
3. **Symptom Check** - Match reported issues
4. **Component Analysis** - Identify fault

Each test provides hints toward the actual problem.

### Repair Process
1. **Inspect** - Examine the phone
2. **Diagnose** - Complete all four checks
3. **Repair** - Drag tools directly on the mat. Screw rotation requires a full
   turn in the correct direction on both screws. Heating and opening require
   tracing all edge targets; heating also requires holding the nozzle near an
   edge for at least 650 ms. Heating updates while stationary and advances
   automatically when coverage and warmth are both complete. Swept segments
   are checked so sparse pointer events do not skip edge targets.
   Component actions must begin at their grab target and end
   within 32 logical pixels of their destination. There is no instant step button.
   `repairProgress` controls the checklist and phone artwork. `manualWork` retains
   screw turns, edge coverage, and heating time between strokes and saved
   pauses. Active jobs are stored as complete job snapshots, not rebuilt from
   the randomly generated database on reload. Pointer cancellation, focus loss,
   and resizing roll back the current
   stroke. Replacement components are supplied with each job.
   Additional gesture types: `scrub` (Cleaning brush) accumulates stroke length
   only when both ends of a stroke are inside the dirty area; `points`
   (Multimeter) requires touching the red pad, then the black pad, counting at
   most one pad per pointer sample. `pulltab` and `shield` are drag steps.
4. **Test** - Requires completing the repair sequence; sets the job's `tested`
   flag and updates the phone display.
5. **Complete** - Collect payment only after reassembly and a successful test.

### Economic System
```
Income Sources:
├─ Basic repair: problem.payment
├─ Difficulty bonus: +10% per level above 1
├─ Accuracy bonus: +5% for perfect diagnosis
└─ Reputation multiplier: 1.0x to 1.5x

Expenses:
├─ Upgrades: $200-$1000
├─ Parts: Replenish inventory
└─ Tool maintenance: None (simplified)

Level-up: Every 10 phones repaired
```

### Save System
```
Saved Data (localStorage key: 'phoneRepairSave'):
├─ money
├─ level
├─ reputation
├─ phonesRepaired
├─ totalEarnings
├─ upgrades (purchased items)
├─ inventory (parts and tools)
└─ completedRepairs (count)

Auto-save: Every 30 seconds
Manual save: Button click
Load: On page load
```

## User Interface

### View System
```
.view {
    display: none;  /* Hidden by default */
}

.view.active {
    display: flex;  /* Show when active */
}

switchView(viewName) {
    Remove .active from all views
    Add .active to target view
}
```

### Tab System
```
.tab-content {
    display: none;  /* All hidden initially */
}

.tab-content.active {
    display: block;  /* Show selected tab */
}

On tab button click:
├─ Remove .active from all tabs
├─ Remove .active from all content
├─ Add .active to clicked tab
└─ Add .active to corresponding content
```

### Canvas Rendering
```
Workshop logical scene (1200×700; backing pixels follow the display):
├─ Draw background gradient
├─ Render desk with computer
├─ Render repair stations
├─ Render storage shelves
├─ Render customer area
└─ Add instruction text

Click handler:
├─ Map mouse/touch position through the scene scale and letterbox offsets
├─ Check collision with computer
└─ Trigger openComputer() if hit
```

The repair scene uses 1000×600 logical coordinates and shares the same
pixel-density-aware rendering. ResizeObserver batches redraws with
requestAnimationFrame rather than running a continuous drawing loop.

## Event System

### Click Events
```javascript
// Buttons
document.addEventListener('click', handler)

// Canvas interactions
canvas.addEventListener('click', function(e) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / 1200, rect.height / 700);
    const x = (e.clientX - rect.left - (rect.width - 1200 * scale) / 2) / scale;
    const y = (e.clientY - rect.top - (rect.height - 700 * scale) / 2) / scale;
    // Check for interactions
})
```

### Tab Switching
```javascript
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        // Update active state
        // Show corresponding content
    })
})
```

### Job Actions
```javascript
acceptJob(jobIndex)
  ├─ Get job from database
  ├─ Add to active repairs
  ├─ Switch to repair view
  └─ Load repair interface

completeRepair()
  ├─ Calculate payment
  ├─ Update money/level/reputation
  ├─ Move to completed
  ├─ Save game
  └─ Return to workshop
```

## Sound System

### Web Audio API Integration
```javascript
soundSystem = {
    audioContext,      // Shared audio context
    
    playClick()        // UI interaction (800Hz)
    playSuccess()      // Positive action (600-800Hz sweep)
    playError()        // Negative action (400-200Hz sweep)
    playMoney()        // Reward (chord: 600/800/1000Hz)
    playScrewdriver()  // Tool use (white noise)
    playToolPickup()   // Item picked (400-600Hz)
}
```

Each sound is synthesized using oscillators and gain nodes.

## Performance Considerations

### Optimization Strategies
- **Canvas rendering**: Only when needed
- **Event delegation**: Minimal listeners
- **Efficient state updates**: Direct object mutations
- **Lazy diagnostics**: Only loaded when needed
- **localStorage**: Lightweight data format

### Potential Bottlenecks
- Large diagnostic database (1000+ items)
  → Solution: Lazy load or pagination
- High-density canvas buffers
  → Render only on scene/layout changes; reuse buffers when dimensions match
- Multiple event listeners
  → Solution: Event delegation

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari 14+, Edge 79+)
- Web Audio API support required
- Canvas 2D API support required
- localStorage support required

## Debugging

### Console Logging
```javascript
// Enable debug mode in browser console:
gameState  // View full game state
saveGame() // Manually save
loadGame() // Manually load
clearSave() // Reset progress
```

### Common Issues
1. Game won't save
   - Check: localStorage enabled
   - Try: Manual save button
   - Fix: Clear cache

2. Sounds not playing
   - Check: Muted browser/system
   - Check: Web Audio API supported
   - Fix: Enable permissions

3. Graphics glitchy
   - Check: GPU acceleration
   - Try: Disable hardware acceleration
   - Fix: Update browser

## Extension Points

### Adding New Diagnostic Tests
```javascript
// In updateJobsTab() or new section:
{
    name: "New Test",
    result: "Result text",
    pass: true/false
}
```

### Adding New Upgrades
```javascript
// Add to upgradeCatalog:
{
    id: 'new_feature',
    name: 'Feature Name',
    price: 500,
    effect: 'What it does',
    icon: '🎯'
}
```

### Adding New Job Categories
```javascript
// In diagnosticDatabase generation:
{
    cat: 'new_category',
    name: 'Problem Name',
    symptoms: ['symptom1', 'symptom2'],
    proc: 'standard', // repair procedure family (see getRepairProcedure)
    difficulty: 'medium',
    parts: ['part1'],
    pay: 120
}
```

## Future Optimization Ideas

1. **Database Optimization**
   - Compress diagnostics
   - Load on-demand
   - Implement search indexing

2. **Graphics Enhancement**
   - Use WebGL for 3D elements
   - Sprite-based rendering
   - Pre-rendered assets

3. **Audio Enhancement**
   - Actual audio files
   - Background music
   - Sound effects library

4. **Gameplay Enhancement**
   - Multiplayer features
   - Leaderboards
   - Achievement system
   - Customer NPC interactions

5. **Performance**
   - Service workers for offline
   - IndexedDB for large data
   - Web workers for computation
   - Lazy loading for assets

## Code Quality Standards

### Naming Conventions
- **Variables**: camelCase (gameState, currentJob)
- **Functions**: camelCase (openComputer, updateMoneyDisplay)
- **Classes**: PascalCase (if used)
- **Constants**: UPPER_CASE (not used, dynamic data)
- **Elements**: kebab-case IDs (job-card, repair-table)
- **CSS classes**: kebab-case (tab-btn, stat-item)

### Comments
- High-level section headers with decoration
- Explain "why", not "what" (code explains what)
- Group related functionality
- Minimal inline comments

### Error Handling
- Try-catch around localStorage
- Null checks for dynamic data
- Graceful fallbacks
- User-friendly error messages

## Testing Checklist

- [ ] All buttons clickable and functional
- [ ] Save/load preserves game state
- [ ] Job acceptance works correctly
- [ ] Repair completion awards money
- [ ] Upgrades purchase correctly
- [ ] Inventory updates properly
- [ ] Statistics display accurately
- [ ] Sound plays (or fails gracefully)
- [ ] Responsive on different screen sizes
- [ ] Works offline
- [ ] Multiple game sessions possible

---

**For developers extending this game: maintain these standards and document any changes.**
