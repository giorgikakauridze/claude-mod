import type { Register } from 'claude-code'

const COMMAND = 'promt-mod'

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
}
