import type { PromptOrigin, PromptSubmitArgs } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const LONG = 'Fix the checkout bug. '.repeat(12)

// The kit's $.prompt.submit leaves the origin to the engine; a test that
// stands in for the engine stamps the one it wants.
const from = (origin: PromptOrigin, text: string) =>
  ({ text, origin, wait: false }) as PromptSubmitArgs

test('a long prompt the person typed gets the review instruction', async ($, on) => {
  // This hook stands for the engine: it answers with what reached it.
  on('prompt.submit', (_, e) => ({ text: e.text, context: e.context }))

  const sent = await $.prompt.submit(from({ kind: 'composer' }, LONG))

  expect(LONG.trim().length).toBeGreaterThan(200)
  expect(sent.text).toBe(LONG)
  expect(sent.context?.some(block => block.startsWith('promt-mod:'))).toBe(true)
})

test('a short prompt goes through untouched', async ($, on) => {
  on('prompt.submit', (_, e) => ({ text: e.text, context: e.context }))

  const sent = await $.prompt.submit(
    from({ kind: 'composer' }, 'Fix the checkout bug.'),
  )

  expect(sent.text).toBe('Fix the checkout bug.')
  expect(sent.context ?? []).toEqual([])
})

test('a long task notification is not reviewed', async ($, on) => {
  on('prompt.submit', (_, e) => ({ text: e.text, context: e.context }))

  const sent = await $.prompt.submit(from({ kind: 'task-notification' }, LONG))

  expect(sent.text).toBe(LONG)
  expect(sent.context ?? []).toEqual([])
})
