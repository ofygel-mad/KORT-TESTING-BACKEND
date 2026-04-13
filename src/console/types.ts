export type ConsoleLogLevel = 'info' | 'success' | 'warn' | 'error';

export type ConsoleLogSource =
  | 'system'
  | 'router'
  | 'auth'
  | 'api'
  | 'analytics'
  | 'console';

export type ConsoleFilter = {
  query: string;
  source: ConsoleLogSource | 'all';
  level: ConsoleLogLevel | 'all';
};

export type ConsoleLogEntry = {
  id: string;
  timestamp: string;
  level: ConsoleLogLevel;
  source: ConsoleLogSource;
  message: string;
  details?: string;
  command?: string;
};

export type ConsoleEventPayload = Omit<ConsoleLogEntry, 'id' | 'timestamp'> & {
  timestamp?: string;
};

export type ConsoleCommandResult = {
  level: ConsoleLogLevel;
  message: string;
  details?: string;
  clearBeforeLog?: boolean;
  closeConsole?: boolean;
};
