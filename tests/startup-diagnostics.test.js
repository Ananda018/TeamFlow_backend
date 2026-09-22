import assert from "node:assert/strict";
import { test } from "node:test";
import { startupDiagnostics } from "../src/utils/startup-diagnostics.js";
import { readEnvironment } from "../src/config/environment.js";

test("reports MongoDB TLS errors wrapped in topology descriptions without private details", () => {
  const error = new Error("mongodb://user:secret@private-host/database");
  error.reason = {
    servers: new Map([
      [
        "private-host",
        {
          error: {
            cause: {
              code: "ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR",
              message: "secret",
            },
          },
        },
      ],
    ]),
  };
  const result = startupDiagnostics("database", error);
  assert.equal(result.stage, "database");
  assert.equal(result.code, "TLS_CONNECTION_FAILED");
  assert.match(result.hint, /IP access list/);
  assert.doesNotMatch(
    JSON.stringify(result),
    /secret|private-host|mongodb:\/\//
  );
});

test("identifies refused Redis connections inside AggregateError", () => {
  const error = new AggregateError([
    Object.assign(new Error("secret"), { code: "ECONNREFUSED" }),
  ]);
  const result = startupDiagnostics("redis", error);
  assert.equal(result.code, "ECONNREFUSED");
  assert.match(result.hint, /Start Redis/);
});

test("reports safe configuration requirements instead of supplied values", () => {
  let error;
  try {
    readEnvironment({ PORT: "private-value" });
  } catch (caught) {
    error = caught;
  }
  const result = startupDiagnostics("configuration", error);
  assert.equal(result.code, "INVALID_CONFIGURATION");
  assert.match(result.hint, /PORT must be/);
  assert.doesNotMatch(JSON.stringify(result), /private-value/);
});

test("classifies DNS, authentication, timeout and listener failures", () => {
  for (const [code, expected] of [
    ["ENOTFOUND", "DNS_LOOKUP_FAILED"],
    [18, "AUTHENTICATION_FAILED"],
    ["ETIMEDOUT", "CONNECTION_TIMED_OUT"],
    ["EADDRINUSE", "EADDRINUSE"],
  ]) {
    assert.equal(
      startupDiagnostics("database", { code, message: "private" }).code,
      expected
    );
  }
});

test("generic errors and cyclic causes do not expose raw data or crash diagnostics", () => {
  const error = {
    name: "private-name",
    code: "private-code",
    message: "secret",
    errors: {},
  };
  error.cause = error;
  const result = startupDiagnostics("database", error);
  assert.equal(result.code, "STARTUP_FAILED");
  assert.doesNotMatch(JSON.stringify(result), /secret|private/);
  assert.equal(
    startupDiagnostics("database", { name: "MongooseServerSelectionError" })
      .code,
    "DATABASE_UNREACHABLE"
  );
});
