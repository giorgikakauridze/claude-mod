import type { PromptOrigin, Register } from 'claude-code'

const COMMAND = 'promt-mod'
const MIN_LENGTH = 300
const MODEL = 'sonnet'
const MAX_QUESTIONS = 3

const RULES = `You review prompts a person is about to send to Claude Code, a coding agent working in their codebase. Prompts are often voice transcripts: expect transcription errors, topic jumps, repetition and self-contradiction.

You do not see the conversation or the codebase. Never ask about something the agent can find there itself (file names, earlier messages, "the mod we built"); keep such references as written.

A good prompt makes clear, in any form:
- Task: what to do, stated up front.
- Why: the motivation or context that lets the agent make good judgment calls.
- Guardrails: constraints, what not to touch, scope limits.
- Done when: what the finished result looks like.

Answer with JSON only, no prose and no code fence, in one of three shapes:
{"verdict":"good"}  when the prompt is clear and complete enough to act on.
{"verdict":"ask","questions":[{"question":"...?","header":"...","options":["...","..."]}]}  when only the person can supply a missing decision or resolve a contradiction. At most ${MAX_QUESTIONS} questions; header 12 characters at most; 2-4 short options each, the most likely first.
{"verdict":"rewrite","prompt":"..."}  when the intent is clear but the prompt is messy. The prompt is the person's request rewritten in their own voice under the headings Task, Why, Guardrails, Done when: transcription errors fixed, repetition removed, nothing invented.`

const REWRITE = `Rewrite the person's prompt using their answers. Answer with JSON only: {"prompt":"..."}, the prompt in the person's own voice under the headings Task, Why, Guardrails, Done when, with transcription errors fixed, repetition removed and nothing invented.`

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
      const judged = await $.model.complete({
        model: MODEL,
        system: RULES,
        prompt: e.text,
        maxTokens: 4000,
        timeoutMs: 60_000,
      })
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
        const rewritten = await $.model.complete({
          model: MODEL,
          system: REWRITE,
          prompt: `Prompt:\n${e.text}\n\nAnswers:\n${answers.join('\n\n')}`,
          maxTokens: 4000,
          timeoutMs: 60_000,
        })
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
