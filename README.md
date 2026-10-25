# promt-mod

Draft Claude Code mod. For now it only proves it loads: a `/promt-mod` slash command and a `promt-mod: loaded` status-line entry.

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
```
