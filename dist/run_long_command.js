/**
 * @license
 * Copyright 2026 Steven A. Thompson (steve@stevenathompson.com)
 * SPDX-License-Identifier: MIT
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn, execSync } from 'child_process';
const SESSION_NAME = 'gemini-cli';
/**
 * Checks if the current environment is running inside the 'gemini-cli' tmux session.
 * @returns {boolean} True if the session exists, false otherwise.
 */
function isInsideTmuxSession() {
    try {
        execSync(`tmux has-session -t ${SESSION_NAME}`, { stdio: 'ignore' });
        return true;
    }
    catch (error) {
        return false;
    }
}
/**
 * Sends a message back to the gemini-cli tmux session.
 * @param message The message to send.
 */
async function notifyGemini(message) {
    const target = `${SESSION_NAME}:0.0`;
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    /**
     * Waits for the tmux pane to be idle (text not changing) before sending the notification.
     */
    async function waitForTmuxIdle(target) {
        let lastContent = '';
        let stableChecks = 0;
        const POLLING_INTERVAL = 1000; // Check every 1 second
        const REQUIRED_STABLE_CHECKS = 10; // Require 10 consecutive seconds of no change
        const MAX_WAIT_TIME = 600000; // 10 minutes max wait
        const startTime = Date.now();
        while (Date.now() - startTime < MAX_WAIT_TIME) {
            await delay(POLLING_INTERVAL);
            let currentContent = '';
            try {
                // Capture the visible text of the tmux pane
                currentContent = execSync(`tmux capture-pane -p -t ${target}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
            }
            catch (e) {
                continue; // Retry on transient tmux errors
            }
            if (currentContent === lastContent) {
                stableChecks++;
            }
            else {
                // Content changed (scrolling, typing, loading bars) -> Reset counter
                stableChecks = 0;
                lastContent = currentContent;
            }
            if (stableChecks >= REQUIRED_STABLE_CHECKS) {
                return; // Output has stabilized
            }
        }
        // If timed out, proceed anyway to ensure message delivery
    }
    try {
        // Wait for the session to be idle
        await waitForTmuxIdle(target);
        // 1. Reset state: Send Escape and Ctrl-u
        execSync(`tmux send-keys -t ${target} Escape`);
        await delay(100);
        execSync(`tmux send-keys -t ${target} C-u`);
        await delay(200);
        // 2. Type the message character by character (slow-typing technique)
        for (const char of message) {
            // Escape special characters for shell/tmux
            const escapedChar = char === "'" ? "'\\''" : char;
            execSync(`tmux send-keys -t ${target} '${escapedChar}'`);
            await delay(20);
        }
        // 3. Submit with Enter
        await delay(500);
        execSync(`tmux send-keys -t ${target} Enter`);
        await delay(500);
        execSync(`tmux send-keys -t ${target} Enter`);
    }
    catch (error) {
        console.error(`Failed to notify Gemini via tmux: ${error}`);
    }
}
const server = new McpServer({
    name: 'run-long-command-server',
    version: '1.0.0',
});
server.registerTool('run_long_command', {
    description: 'Executes a long-running shell command in the background and notifies Gemini when finished.',
    inputSchema: z.object({
        command: z.string().describe('The shell command to execute.'),
    }),
}, async ({ command }) => {
    // Check if we are in the correct tmux session BEFORE starting the command
    if (!isInsideTmuxSession()) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: Not running inside tmux session '${SESSION_NAME}'. This tool requires being in a tmux session named '${SESSION_NAME}' to wake up the agent upon completion.`,
                },
            ],
            isError: true,
        };
    }
    const startTime = Date.now();
    // Spawn the background process
    const child = spawn(command, {
        shell: true,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const MAX_OUTPUT_LENGTH = 200;
    if (child.stdout) {
        child.stdout.on('data', (data) => {
            if (output.length < MAX_OUTPUT_LENGTH) {
                output += data.toString();
            }
        });
    }
    if (child.stderr) {
        child.stderr.on('data', (data) => {
            if (output.length < MAX_OUTPUT_LENGTH) {
                output += data.toString();
            }
        });
    }
    // child.unref(); // Removed to ensure process tracking
    // Set up completion handler
    child.on('close', async (code) => {
        const duration = Date.now() - startTime;
        const MAX_MSG_LEN = 64;
        const codeStr = `(${code})`;
        // Truncate command
        let cmdStr = command;
        const maxCmdLen = 15;
        if (cmdStr.length > maxCmdLen) {
            cmdStr = cmdStr.substring(0, maxCmdLen - 3) + '...';
        }
        // Calculate available space for output
        const overhead = 17 + cmdStr.length + codeStr.length;
        const availableForOut = MAX_MSG_LEN - overhead;
        let outStr = output ? output.replace(/[\r\n]+/g, ' ').trim() : '';
        if (outStr.length > availableForOut) {
            const truncateLen = Math.max(0, availableForOut - 3);
            outStr = outStr.substring(0, truncateLen) + '...';
        }
        let completionMessage = `Cmd: "${cmdStr}" ${codeStr} Out: [${outStr}]`;
        if (duration < 1000) {
            completionMessage += " (Warn: Instant Exit)";
        }
        await notifyGemini(completionMessage);
    });
    child.on('error', async (err) => {
        const MAX_MSG_LEN = 64;
        let cmdStr = command;
        const maxCmdLen = 15;
        if (cmdStr.length > maxCmdLen) {
            cmdStr = cmdStr.substring(0, maxCmdLen - 3) + '...';
        }
        const overhead = 10 + cmdStr.length;
        const availableForErr = MAX_MSG_LEN - overhead;
        let errStr = err.message;
        if (errStr.length > availableForErr) {
            const truncateLen = Math.max(0, availableForErr - 3);
            errStr = errStr.substring(0, truncateLen) + '...';
        }
        const errorMessage = `Err: "${cmdStr}" (${errStr})`;
        await notifyGemini(errorMessage);
    });
    return {
        content: [
            {
                type: 'text',
                text: `Command "${command}" started in the background (PID: ${child.pid}, CWD: ${process.cwd()}). I will notify you when it finishes.`,
            },
        ],
    };
});
const transport = new StdioServerTransport();
await server.connect(transport);
