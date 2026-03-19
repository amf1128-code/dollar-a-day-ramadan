const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const PII_FIELDS = ['venmo_handle', 'venmoHandle', 'zelle_identifier', 'zelleIdentifier', 'email', 'phone', 'donor_first_name', 'donorFirstName', 'full_name', 'fullName'];

function sanitizeData(data) {
  if (!data || typeof data !== 'object') return data;
  const clean = { ...data };
  for (const key of PII_FIELDS) {
    if (key in clean) {
      clean[key] = '[REDACTED]';
    }
  }
  return clean;
}

function createLogger() {
  const isDev = typeof window !== 'undefined' && window.location?.hostname === 'localhost';
  const minLevel = isDev ? 'debug' : 'warn';
  const minLevelValue = LOG_LEVELS[minLevel];

  function log(level, module, message, data) {
    if (LOG_LEVELS[level] < minLevelValue) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${module}]`;
    const sanitized = data ? sanitizeData(data) : undefined;
    const args = sanitized ? [prefix, message, JSON.stringify(sanitized)] : [prefix, message];

    switch (level) {
      case 'debug': console.debug(...args); break;
      case 'info': console.info(...args); break;
      case 'warn': console.warn(...args); break;
      case 'error': console.error(...args); break;
    }
  }

  return {
    debug: (module, message, data) => log('debug', module, message, data),
    info: (module, message, data) => log('info', module, message, data),
    warn: (module, message, data) => log('warn', module, message, data),
    error: (module, message, data) => log('error', module, message, data),
  };
}

export const logger = createLogger();
