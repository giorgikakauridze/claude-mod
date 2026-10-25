# promt-mod

Claude Code mod that turns messy prompts (long voice brain dumps especially) into clear ones before Claude ever sees them.

When you send a prompt longer than 300 characters, the mod holds it back and has the session's own model (whatever `/model` is set to) review it in the background, over the conversation so far, so it knows the code and context you have already discussed:

- **Good:** the prompt goes to Claude unchanged.
- **Messy but clear in intent:** the model rewrites it under Task / Why / Guardrails / Done when. The original is not sent; the rewrite lands in your prompt box (and in the transcript) for you to send with Enter or edit first.
- **Missing details:** the model asks you up to 3 questions in a dialog, then writes the rewrite with your answers. Again the original is not sent and Claude does nothing until you send the rewrite.

On the first prompt of a session (or after `/clear`) there is no conversation yet, so the same model reviews the prompt on its own.

Sending the suggested prompt back unchanged skips the review. Dismissing a question puts your original prompt back in the box. If the review fails (API error, unreadable answer), the original goes through as is.

Only your own prompts are reviewed: slash commands, background task notifications, scheduled runs and messages from other agents are left alone. `/promt-mod` checks the mod is loaded.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install promt-mod --marketplace giorgikakauridze/claude-mod
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install promt-mod --marketplace giorgikakauridze/claude-mod
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `giorgikakauridze/claude-mod`, then Add plugin.

This repository is private: the install works only for people who can read it on GitHub and whose machine already holds a git credential for github.com (an SSH key, or `gh auth login` then `gh auth setup-git`).

## Develop

```
claude --plugin-dir ~/Desktop/claude-mod
claude plugin validate ~/Desktop/claude-mod
claude plugin test ~/Desktop/claude-mod
```
