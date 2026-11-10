export function codeStatus(code, verifiedCode, attemptedCode, attemptResult) {
  if (!code.trim()) return 'empty';
  if (code === verifiedCode) return 'authenticated';
  if (code === attemptedCode && attemptResult === 'invalid') return 'invalid';
  if (code === attemptedCode && attemptResult === 'failed') return 'failed';
  return 'unchecked';
}

export function aiMode(serverStatus, code, verifiedCode, attemptedCode, attemptResult) {
  return serverStatus === 'configured' && codeStatus(code, verifiedCode, attemptedCode, attemptResult) === 'authenticated';
}
