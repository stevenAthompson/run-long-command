# Project Results: run_long_command

## Overview
The goal of this project is to create a Gemini CLI extension called `run_long_command`. This tool allows Gemini to execute long-running shell commands in the background and receive a notification once they are complete. This prevents Gemini from timing out or being blocked while waiting for a command to finish.

**Status: Ready for Release** (Validated 2026-01-02, Post-Fix)

## Stated Goals
- Execute arbitrary shell commands in the background.
- Return immediately to Gemini, allowing it to continue other tasks.
- Use `tmux` to send a "wake up" message to the `gemini-cli` session when the command completes.
- Fail gracefully if not running inside a `tmux` session named `gemini-cli`.
- Provide professional engineering quality with documentation, logging, and unit tests.
- Maintain a fully portable codebase including tracked `node_modules` for seamless installation.

## Phases and Work Done
### Phase 4: Real-time Validation
- Successfully validated the extension with a 20-second sleep command; confirmed tmux notification wakes up the agent upon completion.
- Updated git configuration to track the `dist` directory, ensuring build artifacts are available for immediate use.
### Phase 1: Initialization
- Setup project documentation (`progress.md`, `project_results.md`).
- Analyzed existing templates and examples.

### Phase 2: Implementation
- Developed `run_long_command.ts` using the Model Context Protocol (MCP) SDK.
- Implemented `isInsideTmuxSession` to check for the required `gemini-cli` tmux session before execution.
- Implemented `notifyGemini` using the character-by-character "slow-typing" technique via `tmux send-keys` to ensure the agent is properly woken up.
- Used `child_process.spawn` with `detached: true` to allow commands to run independently in the background.

### Phase 3: Testing & Verification
- Added `vitest` for unit testing.
- Created `run_long_command.test.ts` to mock `tmux` and `child_process` interactions.
- Verified that:
    - Tool registers correctly.
    - Graceful failure when not in a `tmux` session.
    - Commands start in the background and return immediately.
    - Notifications are sent to `tmux` upon completion or failure.
- Fixed a naming inconsistency in `gemini_tmux.sh`.
- Performed a live integration test with a real `tmux` session to verify the end-to-end notification flow.

## Test Results
- Unit Tests: 5/5 passed.
- Integration Test: Success (verified via `tmux capture-pane`).

## FAQ
### What is the purpose of `run_long_command`?
It's designed to handle shell commands that take a long time to finish, allowing the Gemini agent to remain responsive.

### Why use tmux for notification?
`tmux` allows sending input to a terminal session from an external process. By sending keys to the `gemini-cli` session, we can "wake up" the agent and provide it with the command results without polling.

## Troubleshooting
- **Error: Not running inside tmux session 'gemini-cli'**: Make sure you started the Gemini CLI inside a tmux session and that the session is named `gemini-cli`. You can use the provided `gemini_tmux.sh` script or run `tmux new -s gemini-cli`.
- **Command fails to start**: Ensure the command is valid and you have the necessary permissions.

## Customized Code
- `run_long_command.ts`: Main implementation of the MCP server tool.
- `run_long_command.test.ts`: Unit tests for the tool.
- `gemini_tmux.sh`: Helper script to start a correctly named tmux session.
- `package.json`: Updated with MCP and testing dependencies.

## Usage Instructions
1. Build the project: `npm run build`
2. Start a tmux session: `./gemini_tmux.sh`
3. Run the Gemini CLI inside that session.
4. Call the tool from Gemini: `run_long_command(command: "your long command here")`

## Testing Pipeline
- Run `npm test` to execute all unit tests.
- Run `npm run build` to ensure TypeScript compilation succeeds.

## Challenges
- **Session Naming**: Initially, there was a discrepancy between the session name expected by the code (`gemini-cli`) and the name used in the helper script. This was resolved by standardizing on `gemini-cli`.
- **Waking up the Agent**: To ensure the Gemini CLI reliably receives the notification, a "slow-typing" technique was used, sending an Escape and Ctrl-u to clear the current prompt line before typing the completion message and pressing Enter.
- **ESM Integration**: Running integration tests with `ts-node` required careful handling of ESM modules in a project configured with `"type": "module"`. This was overcome by compiling tests with `tsc` before execution.
- **Distribution**: Users installing via git might not run `npm install`. To support "plug-and-play" installation, `node_modules` are now checked into the repository.
