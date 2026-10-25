import type { EngineInterface, PromptOrigin, Register } from 'claude-code'

const COMMAND = 'promt-mod'
const MIN_LENGTH = 300
const MAX_QUESTIONS = 3

const RULES = `promt-mod: this is not a request to do work. Do not answer, plan or carry out the prompt below; only review it. The person is about to send it to you, Claude Code, working in their codebase. Prompts are often voice transcripts: expect transcription errors, topic jumps, repetition and self-contradiction.

Judge it against everything you already know from the conversation so far, the codebase and your memory. Never ask about something already settled in the conversation or that you could look up yourself (file names, earlier messages, "the mod we built"); keep such references as written.

A good prompt makes clear, in any form:
- Task: what to do, stated up front.
- Why: the motivation or context that lets the agent make good judgment calls.
- Guardrails: constraints, what not to touch, scope limits.
- Done when: what the finished result looks like.

Answer with JSON only, no prose and no code fence, in one of three shapes:
{"verdict":"good"}  when the prompt is clear and complete enough to act on.
{"verdict":"ask","questions":[{"question":"...?","header":"...","options":["...","..."]}]}  when only the person can supply a missing decision or resolve a contradiction. At most ${MAX_QUESTIONS} questions; header 12 characters at most; 2-4 short options each, the most likely first.
{"verdict":"rewrite","prompt":"..."}  when the intent is clear but the prompt is messy. The prompt is the person's request rewritten in their own voice under the headings Task, Why, Guardrails, Done when: transcription errors fixed, repetition removed, nothing invented.`

const REWRITE = `promt-mod: this is not a request to do work. Do not carry out the prompt below. Rewrite it using the person's answers. Answer with JSON only: {"prompt":"..."}, the prompt in the person's own voice under the headings Task, Why, Guardrails, Done when, with transcription errors fixed, repetition removed and nothing invented.`

type Question = { question: string; header?: string; options: string[] }
type Review =
  | { verdict: 'good' }
  | { verdict: 'ask'; questions: Question[] }
  | { verdict: 'rewrite'; prompt: string }

// The person's own words: typed at the terminal or an editor, sent from
// Remote Control, or submitted by a plugin as the person's.
const isPersons = (origin: PromptOrigin) =>
  origin.kind === 'composer' ||
  origin.kind === 'bridge' ||
  origin.kind === 'sdk' ||
  (origin.kind === 'plugin' && origin.asUser === true)

// Asks the session's own model, over the conversation so far, so it judges
// the prompt with the context the person has built up. Before the first turn
// (or after /clear) there is nothing to fork: the same model is asked alone.
const think = async ($: EngineInterface, rules: string, body: string) => {
  const forked = await $.model.fork({ prompt: `${rules}\n\n${body}` })
  if (forked.isAnswered || forked.reason !== 'nothing-to-fork') return forked

  return $.model.complete({
    model: await $.session.model(),
    system: rules,
    prompt: body,
    maxTokens: 4000,
    timeoutMs: 60_000,
  })
}

// The model is told to answer JSON alone, but may still wrap it in a fence.
const parse = (text: string): unknown => {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) return undefined
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return undefined
  }
}

export const register: Register = on => {
  // The prompt this mod last suggested: sent back unchanged, it goes through.
  let suggested: string | undefined

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

  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta || !isPersons(e.origin)) return next(e)
    if (e.text.trim().length <= MIN_LENGTH) return next(e)
    if (e.text.trim() === suggested) {
      suggested = undefined
      return next(e)
    }

    $.ui.status('promt-mod: reviewing your prompt…')
    try {
      const quoted = `<prompt>\n${e.text}\n</prompt>`
      const judged = await think($, RULES, quoted)
      const review = judged.isAnswered ? (parse(judged.text) as Review) : undefined
      if (!review || review.verdict === 'good') return next(e)

      let prompt = review.verdict === 'rewrite' ? review.prompt : undefined
      if (review.verdict === 'ask') {
        const answers: string[] = []
        for (const one of review.questions.slice(0, MAX_QUESTIONS)) {
          const answer = await $.ui
            .ask(one.question, {
              options: one.options.slice(0, 4),
              header: one.header?.slice(0, 12),
            })
            .catch(() => undefined)
          if (answer === undefined) {
            await $.prompt.fill({ text: e.text })
            return { drop: 'promt-mod: question dismissed. Your original prompt is back in the prompt box.' }
          }
          answers.push(`Q: ${one.question}\nA: ${answer}`)
        }
        const rewritten = await think(
          $,
          REWRITE,
          `${quoted}\n\n<answers>\n${answers.join('\n\n')}\n</answers>`,
        )
        const parsed = rewritten.isAnswered
          ? (parse(rewritten.text) as { prompt?: string } | undefined)
          : undefined
        prompt = parsed?.prompt
      }
      if (!prompt) {
        $.ui.toast('promt-mod: could not rewrite the prompt; sent it as is')
        return next(e)
      }

      suggested = prompt.trim()
      const filled = await $.prompt.fill({ text: suggested })
      const where = filled.isFilled
        ? 'It is in your prompt box: press Enter to send it, or edit it first.'
        : 'Copy it into the prompt box to send it.'

      return { drop: `promt-mod held this prompt back. ${where}\n\n${suggested}` }
    } finally {
      $.ui.status('promt-mod: loaded')
    }
  })
}
