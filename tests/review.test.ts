import type { PromptOrigin, PromptSubmitArgs } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const LONG = 'so basically I want the checkout thing fixed, the one that breaks. '.repeat(6)
const BETTER = 'Task: fix the checkout bug.\nWhy: it breaks payments.\nGuardrails: none.\nDone when: checkout succeeds.'.padEnd(320, '.')

// The kit's $.prompt.submit leaves the origin to the engine; a test that
// stands in for the engine stamps the one it wants.
const from = (origin: PromptOrigin, text: string) =>
  ({ text, origin, wait: false }) as PromptSubmitArgs
const typed = (text: string) => from({ kind: 'composer' }, text)

const answered = (text: string) => ({
  value: {
    isAnswered: true as const,
    text,
    usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  },
})

test('a short prompt goes through without a review', async ($, on) => {
  let reviews = 0
  on('model.fork', () => (reviews++, answered('{"verdict":"good"}')))
  on('prompt.submit', (_, e) => ({ text: e.text }))

  const sent = await $.prompt.submit(typed('Fix the checkout bug.'))

  expect(sent.text).toBe('Fix the checkout bug.')
  expect(reviews).toBe(0)
})

test('a long prompt judged good goes through unchanged', async ($, on) => {
  on('model.fork', () => answered('{"verdict":"good"}'))
  on('prompt.submit', (_, e) => ({ text: e.text }))

  const sent = await $.prompt.submit(typed(LONG))

  expect(LONG.trim().length).toBeGreaterThan(300)
  expect(sent.text).toBe(LONG)
})

test('a messy long prompt is held back and its rewrite put in the box', async ($, on) => {
  const filled: string[] = []
  on('model.fork', () => answered(JSON.stringify({ verdict: 'rewrite', prompt: BETTER })))
  on('prompt.fill', (_, e) => (filled.push(e.text), { isFilled: true }))
  on('prompt.submit', (_, e) => ({ text: e.text }))

  const sent = await $.prompt.submit(typed(LONG))

  expect(sent.drop).toContain('promt-mod held this prompt back')
  expect(sent.drop).toContain(BETTER)
  expect(filled).toEqual([BETTER])
})

test('the suggested prompt, sent back, goes through without a review', async ($, on) => {
  let reviews = 0
  on('model.fork', () => (reviews++, answered(JSON.stringify({ verdict: 'rewrite', prompt: BETTER }))))
  on('prompt.fill', () => ({ isFilled: true }))
  on('prompt.submit', (_, e) => ({ text: e.text }))

  await $.prompt.submit(typed(LONG))
  const sent = await $.prompt.submit(typed(BETTER))

  expect(sent.text).toBe(BETTER)
  expect(reviews).toBe(1)
})

test('a prompt with gaps asks, then is held back with the rewrite', async ($, on) => {
  const asks = JSON.stringify({
    verdict: 'ask',
    questions: [{ question: 'Which environment?', header: 'Env', options: ['Staging', 'Production'] }],
  })
  const prompts: string[] = []
  on('model.fork', (_, e) => {
    prompts.push(e.prompt)
    return answered(prompts.length === 1 ? asks : JSON.stringify({ prompt: BETTER }))
  })
  // This hook stands for the person answering the dialog.
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => ({
    result: { questions: e.questions, answers: { [e.questions[0]!.question]: 'Staging' } },
  }))
  on('prompt.fill', () => ({ isFilled: true }))
  on('prompt.submit', (_, e) => ({ text: e.text }))

  const sent = await $.prompt.submit(typed(LONG))

  expect(prompts[1]).toContain('A: Staging')
  expect(sent.drop).toContain(BETTER)
})

test('with no conversation yet, the session model reviews alone', async ($, on) => {
  const models: string[] = []
  on('model.fork', () => ({ value: { isAnswered: false as const, reason: 'nothing-to-fork' as const } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('model.complete', (_, e) => (models.push(e.model), answered('{"verdict":"good"}')))
  on('prompt.submit', (_, e) => ({ text: e.text }))

  const sent = await $.prompt.submit(typed(LONG))

  expect(sent.text).toBe(LONG)
  expect(models).toEqual(['claude-opus-5-5'])
})

test('an unreadable review lets the prompt through', async ($, on) => {
  on('model.fork', () => answered('not json at all'))
  on('prompt.submit', (_, e) => ({ text: e.text }))

  const sent = await $.prompt.submit(typed(LONG))

  expect(sent.text).toBe(LONG)
})

test('a long task notification is not reviewed', async ($, on) => {
  let reviews = 0
  on('model.fork', () => (reviews++, answered('{"verdict":"good"}')))
  on('prompt.submit', (_, e) => ({ text: e.text }))

  const sent = await $.prompt.submit(from({ kind: 'task-notification' }, LONG))

  expect(sent.text).toBe(LONG)
  expect(reviews).toBe(0)
})
