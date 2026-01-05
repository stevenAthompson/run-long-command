# Solution for Non-Blocking Self-Execution and Output Monitoring in CLI Agents

## The Problem
When a CLI-based AI agent (like Gemini CLI) attempts to run a long-running command "on itself" or on the shell it resides in, two major blocking issues arise:
1.  **Self-Blocking:** If the agent waits for the command to finish *within* the tool call, it cannot process new tokens or user interrupts.
2.  **Blindness:** If the agent fires the command and immediately returns to free up the thread, it loses context of when that command finishes. It might try to issue the next command while the previous one is still running (e.g., a `sleep 30` or a long build process).

## The Solution: Detached Visual Stability Monitoring
Instead of relying on process PIDs or complex IPC, we use a **detached background worker** that acts as a pair of "human eyes." It watches the terminal screen via `tmux` and waits for the text on the screen to stop moving.

### Architecture
1.  **Main Tool (The Agent's Interface):**
    *   Receives the user's command.
    *   Spawns a **detached** Node.js subprocess (the worker).
    *   **Immediately returns** to the agent with "Command queued...", freeing the agent to receive future inputs.

2.  **The Worker (Background Process):**
    *   Waits a few seconds for the agent's UI to settle.
    *   **Injects** the requested command into the tmux session using `tmux send-keys`.
    *   **Enters a Polling Loop:**
        *   Captures the full text content of the tmux pane (`tmux capture-pane -p`).
        *   Compares it to the content from the previous second.
        *   If `current_content === previous_content` for $N$ consecutive checks, the terminal is considered **stable** (idle).
    *   **Notifies:** Once stable, it injects a specific string (e.g., `[SYSTEM COMMAND] Command complete. Resume.`) back into the agent's input stream. This wakes the agent up.

### The "Visual Stability" Algorithm
This approach is robust because it mimics how a human knows a command is done: the text stops scrolling.

1.  **Snapshot:** `content = tmux capture-pane -p -t target`
2.  **Compare:** `content == last_content`?
3.  **Counter:**
    *   If Match: Increment `stable_checks`.
    *   If Differs: Reset `stable_checks = 0`.
4.  **Threshold:** If `stable_checks >= 3` (3 seconds of stillness), break loop.

### Implementation Reference (TypeScript)

Save this as `delayed_submit.ts` or similar.

```typescript
import { execSync } from 'child_process';

const SESSION_NAME = process.env.GEMINI_TMUX_SESSION_NAME || 'gemini-cli';

async function main() {
  // 1. Get the command to run (passed as base64 to avoid shell parsing issues)
  const args = process.argv.slice(2);
  if (args.length < 1) process.exit(1);

  const encodedCommand = args[0];
  const command = Buffer.from(encodedCommand, 'base64').toString('utf-8');
  const target = `${SESSION_NAME}:0.0`;

  // Helper delay function
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Initial pause to let the Agent's previous UI interactions finish
  await delay(3000);

  try {
    // --- STEP 1: INJECTION ---
    // Clear the prompt line to ensure clean input
    execSync(`tmux send-keys -t ${target} Escape`);
    await delay(100);
    execSync(`tmux send-keys -t ${target} C-u`);
    await delay(200);

    // Type the command character-by-character (more reliable than pasting chunks)
    for (const char of command) {
      const escapedChar = char === "'" ? "'\\''" : char;
      execSync(`tmux send-keys -t ${target} '${escapedChar}'`);
      await delay(20);
    }

    // Press Enter
    await delay(500);
    execSync(`tmux send-keys -t ${target} Enter`);

    // --- STEP 2: STABILITY MONITORING ---
    let lastContent = '';
    let stableChecks = 0;
    const POLLING_INTERVAL = 1000; // Check every 1 second
    const REQUIRED_STABLE_CHECKS = 3; // Require 3 consecutive seconds of no change
    const MAX_WAIT_TIME = 300000; // 5 minute timeout safety
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_WAIT_TIME) {
      await delay(POLLING_INTERVAL);
      
      let currentContent = '';
      try {
        // Capture the visible text of the tmux pane
        currentContent = execSync(`tmux capture-pane -p -t ${target}`, { encoding: 'utf-8' });
      } catch (e) {
        continue; // Retry on transient tmux errors
      }

      if (currentContent === lastContent) {
        stableChecks++;
      } else {
        // Content changed (scrolling, typing, loading bars) -> Reset counter
        stableChecks = 0;
        lastContent = currentContent;
      }

      if (stableChecks >= REQUIRED_STABLE_CHECKS) {
        break; // Output has stabilized
      }
    }

    // --- STEP 3: NOTIFICATION ---
    // Inject a message that the AI agent will "see" as user input
    const notification = "[SYSTEM COMMAND] Command complete. Resume.";
    
    // Clear line again
    execSync(`tmux send-keys -t ${target} Escape`);
    await delay(100);
    execSync(`tmux send-keys -t ${target} C-u`);
    await delay(200);

    // Type the notification
    for (const char of notification) {
        const escapedChar = char === "'" ? "'\\''" : char;
        execSync(`tmux send-keys -t ${target} '${escapedChar}'`);
        await delay(20);
    }
    await delay(500);
    execSync(`tmux send-keys -t ${target} Enter`);
    
  } catch (error) {
    // Fail silently in background
    process.exit(1);
  }
}

main();
```

### Key Advantages
*   **Agnostic:** Works with *any* command (builds, sleeps, interactive prompts).
*   **Visual:** Detects when "loading bars" stop moving, unlike simple process exit codes which might not apply to shells.
*   **Non-Blocking:** The Agent is technically "idle" while this runs, meaning it won't timeout.
