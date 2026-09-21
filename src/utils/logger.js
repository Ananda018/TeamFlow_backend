// Pass event names and safe metadata, never errors, credentials or bodies.
export const logger = {
  info(event, metadata = {}) {
    console.log(
      JSON.stringify({
        level: "info",
        time: new Date().toISOString(),
        event,
        ...metadata,
      })
    );
  },
  error(event, metadata = {}) {
    console.error(
      JSON.stringify({
        level: "error",
        time: new Date().toISOString(),
        event,
        ...metadata,
      })
    );
  },
};
