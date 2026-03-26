import i18n from '../i18n/index.js'

/**
 * Translate an error message with i18n support.
 *
 * Resolution order:
 * 1. If the error object has a `code` field, look up `errors.{code}`
 * 2. Try to use the message as a direct i18n key (e.g. `errors.loginFailed`)
 * 3. Fallback: return the raw message string
 *
 * @param {Error|string|object} err - The error to translate
 * @returns {string} Translated error message
 */
export function translateError(err) {
  const t = i18n.global.t
  const te = i18n.global.te

  // Extract code and message
  let code = ''
  let message = ''

  if (typeof err === 'string') {
    message = err
  } else if (err instanceof Error) {
    message = err.message
    code = err.code || ''
  } else if (err && typeof err === 'object') {
    code = err.code || ''
    message = err.message || err.error || String(err)
  }

  // 1. Try error code mapping
  if (code) {
    const codeKey = `errors.${code}`
    if (te(codeKey)) {
      return t(codeKey)
    }
  }

  // 2. Try message as i18n key
  if (message) {
    const msgKey = `errors.${message}`
    if (te(msgKey)) {
      return t(msgKey)
    }
  }

  // 3. Fallback to raw message
  return message || t('errors.operationFailed')
}
