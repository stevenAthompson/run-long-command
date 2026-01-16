# Project Results: run_long_command

## Overview
The `run_long_command` project (v1.0.2) provides a Gemini CLI extension that enables the agent to execute long-running shell commands in the background without blocking the agent's interaction loop. It utilizes `tmux` to notify the agent upon command completion.

## Goals
- Execute arbitrary shell commands in the background.
- Return control to Gemini immediately.
- Notify Gemini via `tmux send-keys` when the command completes.
- robust error handling and reporting.

## Key Features
- **Background Execution:** Uses Node.js `spawn` with `detached: true` to run commands independent of the request cycle.
- **Tmux Integration:** Safely wakes up the Gemini agent by injecting commands into the `gemini-cli` tmux session.
- **Context Awareness:** Inherits the user's current working directory (CWD), allowing relative paths (e.g., `.venv/bin/python`) to work correctly.
- **Feedback:** Provides immediate PID and CWD feedback, and asynchronous completion/failure notifications.
- **Output Capture:** Captures and reports the first 200 characters of stdout/stderr in the completion notification to assist with debugging.
- **Agent Instructions:** Includes a `GEMINI.md` file to provide persistent context and instructions to the agent on how to use the tool and what to expect from its responses.

## Test Results
- **Integration Test (30s sleep):** Passed (Exit code 0)
- **CWD & Env Var Test:** Passed (Verified via verification.log)
- **GitHub Install Verification:** Passed (Exit code 0).
- **Manual Verification (10s sleep):** Passed (echo "hello" && sleep 10 && echo "world").
- **Manual Verification (60s sleep):** Passed (date && sleep 60 && date).
- **Self-Test Verification (5s sleep):** Passed (sleep 5 && echo "Test successful: background command completed").
Current test suite status:
- **Pass Rate:** 100% (7/7 tests passed)
- **Pass Rate:** 100% (6/6 tests passed)
- **Coverage:** Verified tool registration, tmux session checks, spawn logic, notification mechanism, and output capturing.

## FAQ
### How does the notification work?
The extension uses `tmux send-keys` to inject a message directly into the `gemini-cli` session's active pane. This triggers the Gemini CLI to resume and process the notification as a new user message.

### Can I run multiple long commands?
Yes, each call to `run_long_command` spawns a new independent process. You will receive notifications for each one as they complete.

### What happens if I close the tmux session?
The background processes will continue to run (since they are detached), but the notification will fail because it won't be able to find the `gemini-cli` session.

### Why do I see command output in the notification?
To help debug issues where commands exit unexpectedly (e.g., immediate exit due to quoting errors), the tool now captures a summary of the command's output and includes it in the completion message.

## Setup and Testing Pipeline
### Installation
1.  Ensure you have Node.js (v18+) and `tmux` installed.
2.  Clone the repository.
3.  Install dependencies: `npm install`.
4.  Build the extension: `npm run build`.
5.  Link to Gemini CLI: `gemini extensions link .`.

### Running Tests
Execute the test suite using:
```bash
npm test
```
This runs `jest` against `run_long_command.test.ts`.

### Reproduction
To reproduce the environment:
1.  Initialize a new Gemini CLI environment.
2.  Install this extension.
3.  Start a tmux session named `gemini-cli`.
4.  Run `gemini` inside that session.
5.  Use the `run_long_command` tool.

## Dependencies
- `@modelcontextprotocol/sdk`: For MCP server implementation.
- `zod`: For input validation.
- `jest` & `ts-jest`: For testing.
- `typescript`: For the codebase.

## Challenges & Solutions
- **Challenge:** Exit Code 127 in user projects.
    - **Detail:** When the MCP server was started with a fixed `cwd`, it couldn't find scripts or binaries relative to the user's project root.
    - **Optimal Solution:** Removing the `cwd` from `gemini-extension.json` ensures the server inherits the CLI's working directory, which is exactly what's needed for local project commands.
- **Challenge:** Asynchronous Notification.
    - **Detail:** Standard tool calls must return a response immediately. We needed a way to "call back" later.
    - **Optimal Solution:** `tmux` provides a reliable IPC mechanism to "wake up" the CLI by simulating user input. This avoids the need for a persistent polling connection or complex webhooks.
- **Challenge:** Debugging Immediate Exits.
    - **Detail:** Users were confused when commands returned immediately due to shell syntax errors (e.g. quoting).
    - **Optimal Solution:** Capturing `stdout` and `stderr` and including a truncated summary in the notification allows users to see *why* a command finished, rather than just that it finished.
- **Challenge:** Implementation Details
The core logic resides in `run_long_command.ts`. It uses `child_process.spawn` with `{ detached: true, stdio: ['ignore', 'pipe', 'pipe'] }`. The server maintains a reference to the child process's `close` event. When triggered, it executes a shell command: `tmux send-keys -t gemini-cli "The background command ... finished. Output: [...]" C-m`.