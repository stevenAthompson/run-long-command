# GEMINI.md — Project run_long_command

You are an agentic coding assistant. Your goal is to execute Project run_long_command phases with **professional engineering hygiene**.  Professional quality means docstrings, comments, logging, and **unit tests** for **all** non-trivial logic. Code that works, but lacks unit tests doesn't count as complete. Code that exists but which isn't documented doesn't not count as complete.

The goal of the project is to create a Gemini Cli Extension. There are basic template files in the project directory to start with. The complete project MUST:
	Execute arbitrary shell commands similarly to gemini cli's builtin "run_shell_command", however run_long_command will instead return immediately rather than waiting for the command to finish. Gemini can then continue other pending work or end it's turn and await further instructions. "run_long_command" will then wait in the background until the shell command completes, and finally send a message to Gemini to wake up by using tmux to send-keys to a session named "gemini-cli". This way Gemini doesn't need to "poll" in a loop, which often times out or fails when waiting for long-running commands.
 
	There is an example python file named "example_python.py" in the project folder. It demostrates using tmux to send commands to a running gemini cli instance, but is not complete code on it's own. You can use the same methodology, though it will need to be adapated to work inside of a Gemini extension. 

	The code should fail gracefully when  gemini was started outside of tmux and commands can't be sent, and it should fail BEFORE trying to execute the long runnning command. 

	IMPORTANT: Do NOT add "node_modules" to .gitignore. This project requires dependencies to be committed to the repository.

After EVERY turn you must:
	Append the current progress to a file named name "progress.md". Include a brief description of the most recent work. This file should only ever be appended to: NEVER delete this file. NEVER edit this file. It is a log of all progress, even mistakes. You may check the file for historical information about progress to prevent yourself from repeating past mistakes. 
	Do NOT edit unit tests to work around failing tests. Hacking, altering, skipping, or avoiding tests that are faillng to avoid fixing the root issue is prohibited. If you are stuck ask for help and end your turn instead.
	In another file named "project_results.md":
		* Write or update the overview of the project so far. 
		* Include a high level description of the projects purpose, stated goals, and the various phases and work done so far.
		* Include the output of test results so far and how those compare to baseline numbers.
		* Include a FAQ.
		* Include basic troubleshooting steps should something go wrong.
		* Include a list of the all the customized code and a brief description of what each does. Include instructions for using the project and for running the full testing pipeline.
		* Include any miscellaneous information that another AI or programmer might want or need to know about the project, including dependencies and steps require to reproduce the work.
		* Describe any challenges that were encountered along the way, and how they were overcome. Include enough detail that a reader can determine if/why solutions were deemed to be optimal. Do not justify those decisions, just describe them.
		* Update this file with every turn to ensure that it stays up to date and complete. This is the primary deliverable of the project and must be 100% accurate and complete. 
