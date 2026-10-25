# promt-mod

Claude Code mod that reviews long prompts before Claude acts on them.

When you send a prompt longer than 200 characters, the mod attaches a hidden instruction asking Claude to review it first:

- **Structure:** if the goal, context, constraints and "done when" are not clear and separate, Claude starts its reply with a short "Prompt review" showing the same prompt in a better structure.
- **Gaps:** if key details or context are missing (judged against the conversation, codebase and memory Claude already has), Claude asks about them with AskUserQuestion and does no other work until you answer.
- A well-structured, complete prompt is answered normally, with no review shown.

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
