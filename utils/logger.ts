// src/utils/logger.ts

type LogFields = {
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  userId?: number;
  message: string;
  stack?: string;
};
const log = (fields: LogFields) => {
  const line = { time: new Date().toISOString(), ...fields };
  process.stderr.write(JSON.stringify(line) + "\n");
};

export default log;
