# Run Long Command Extension

This extension provides the `run_long_command` tool, which allows the Gemini CLI agent to execute long-running shell commands in the background without blocking further interaction.

## Usage

When you encounter a task that involves a command expected to take a significant amount of time (e.g., complex builds, long-running tests, data processing), use `run_long_command`.

### Tool Signature

```typescript
run_long_command({
  command: string; // The shell command to execute.
});
```

### Example

```json
{
  "command": "npm run build-heavy-project"
}
```

## How It Works

1.  **Environment Check**: The tool first verifies that it is running within a `tmux` session named `gemini-cli`. This is required for the tool to "wake up" the agent upon completion.
2.  **Immediate Return**: If the environment is valid, the tool spawns the command as a detached background process and returns immediately to the agent.
3.  **Agent Continuation**: The agent receives a confirmation message and can continue with other tasks or end its turn.
4.  **Completion Notification**: Once the background process finishes, the tool uses `tmux send-keys` to inject a completion message into the `gemini-cli` session. This message effectively "nudges" the agent to resume and process the results.

## Response to the Agent

### Initial Response (Immediate)

When the tool is called, it returns a text content block similar to:

```text
Command "npm run build-heavy-project" started in the background (PID: 12345, CWD: /path/to/project). I will notify you when it finishes.
```

### Completion Message (via tmux)

When the command completes, a message will appear in your input buffer as if typed by the user:

```text
Background command completed: "npm run build-heavy-project" (Exit code: 0) Output: [Project built successfully in 120s...]
```

If the command fails to start or encounters an error, the notification will reflect the failure:

```text
Background command failed: "npm run build-heavy-project" (Error: spawn npm ENOENT)
```

## Constraints and Requirements

-   **Tmux**: The Gemini CLI MUST be running inside a `tmux` session named `gemini-cli`.
-   **Output Truncation**: For the completion notification, only the first 200 characters of the command's combined stdout and stderr are captured and included in the message to avoid overwhelming the input buffer.
-   **No Partial Output**: This tool does not provide real-time streaming of output. It only notifies you upon completion. For streaming output, use the standard `run_shell_command`.