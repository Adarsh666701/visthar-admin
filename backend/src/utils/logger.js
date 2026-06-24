export function log(level, event, payload = {}) {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...payload,
  };
  console.log(JSON.stringify(line));
}
