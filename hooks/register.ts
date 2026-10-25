import type { PromptOrigin, Register } from 'claude-code'

const COMMAND = 'promt-mod'
const MIN_LENGTH = 200

const REVIEW = `promt-mod: the user's prompt above is longer than ${MIN_LENGTH} characters. Before doing any work, review it.

1. Structure: is the goal stated up front, and are the context, the constraints and what "done" looks like clear and separate? If not, start your reply with a short "Prompt review" section that shows this same prompt rewritten in a better structure (Goal / Context / Constraints / Done when), filled in from what the user wrote, and one line on what was wrong with the original.
2. Gaps: judge missing details against everything you already know from this conversation, the codebase and your memory; flag only what you cannot find or safely infer. If key details or context are missing, ask about them with AskUserQuestion (one question per gap, at most 4) and do no other work until the user answers.

If the prompt is well structured and complete, skip the review silently and just do the task.`

// The person's own words: typed at the terminal or an editor, sent from
// Remote Control, or submitted by a plugin as the person's.
const isPersons = (origin: PromptOrigin) =>
  origin.kind === 'composer' ||
  origin.kind === 'bridge' ||
  origin.kind === 'sdk' ||
  (origin.kind === 'plugin' && origin.asUser === true)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'Check that promt-mod is loaded',
    })
    $.ui.status('promt-mod: loaded')

    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    $.ui.toast('promt-mod is alive')

    return { text: `${$.plugin.name} is loaded.` }
  }).catch(($, e, next) => next(e))

  on('prompt.submit', ($, e, next) => {
    if (e.command || e.isMeta || !isPersons(e.origin)) return next(e)
    if (e.text.trim().length <= MIN_LENGTH) return next(e)

    $.ui.toast('promt-mod: reviewing this prompt')

    return next({ ...e, context: [...(e.context ?? []), REVIEW] })
  })
}
