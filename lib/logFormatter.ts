//************************************************************************************************
// This library makes sure there is consistent creation of log strings.  It also appends it
// to the supplied list if present.
//************************************************************************************************


export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'VERBOSE';

export interface LogMessage {
  when: number;
  level: LogLevel;
  msg: string;
}

const createMsg = function(level: LogLevel, msg: string, list?: LogMessage[]): LogMessage {
  const obj: LogMessage = { when: Date.now(), level, msg };
  if (list) {
    list.push(obj);
  }
  return obj;
}

// user can either use the return value or send in a list to have the message appended to it
export const error = function(msg: string, list?: LogMessage[]): LogMessage {
  return createMsg('ERROR', msg, list);
}

export const warn = function(msg: string, list?: LogMessage[]): LogMessage {
  return createMsg('WARN', msg, list);
}

export const info = function(msg: string, list?: LogMessage[]): LogMessage {
  return createMsg('INFO', msg, list);
}

export const debug = function(msg: string, list?: LogMessage[]): LogMessage {
  return createMsg('DEBUG', msg, list);
}

export const verbose = function(msg: string, list?: LogMessage[]): LogMessage {
  return createMsg('VERBOSE', msg, list);
}
