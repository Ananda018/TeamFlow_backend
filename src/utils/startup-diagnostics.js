import { ConfigurationError } from "../errors/ConfigurationError.js";

const hints = {
  configuration: "Check the variable names and formats in Backend/.env.",
  database:
    "Check MONGO_URI (or MONGODB_URI), database availability, and network access.",
  redis: "Start Redis or set REDIS_URL to a reachable Redis instance.",
  http: "Check PORT and whether another process is using it.",
};

export function startupDiagnostics(stage, error) {
  if (error instanceof ConfigurationError) {
    return {
      stage: "configuration",
      code: "INVALID_CONFIGURATION",
      hint: error.message,
    };
  }

  // MongoDB wraps socket/TLS failures inside topology server descriptions.
  // Only emit known classifications, never raw error messages or URLs.
  const nodes = [];
  const seen = new Set();
  function visit(value) {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    nodes.push(value);
    visit(value.cause);
    visit(value.reason);
    if (Array.isArray(value.errors)) {
      for (const child of value.errors) visit(child);
    }
    if (value.servers instanceof Map) {
      for (const server of value.servers.values()) visit(server.error);
    }
  }
  visit(error);
  const hasCode = (...codes) => nodes.some((node) => codes.includes(node.code));

  if (
    hasCode(
      "ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR",
      "CERT_HAS_EXPIRED",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "SELF_SIGNED_CERT_IN_CHAIN",
      "DEPTH_ZERO_SELF_SIGNED_CERT"
    )
  ) {
    return {
      stage,
      code: "TLS_CONNECTION_FAILED",
      hint:
        stage === "database"
          ? "MongoDB TLS handshake failed. For Atlas, check the current IP access list and cluster availability; also check firewall/VPN/TLS inspection. Keep certificate verification enabled."
          : "TLS connection failed. Check the service TLS settings and certificate trust.",
    };
  }
  if (
    hasCode(18, "AuthenticationFailed", "WRONGPASS", "NOAUTH") ||
    nodes.some((node) =>
      /authentication failed|bad auth|WRONGPASS|NOAUTH/i.test(
        node.message || ""
      )
    )
  ) {
    return {
      stage,
      code: "AUTHENTICATION_FAILED",
      hint: "Check the service username/password and URL-encode credentials in its connection string.",
    };
  }
  if (hasCode("ECONNREFUSED"))
    return {
      stage,
      code: "ECONNREFUSED",
      hint: hints[stage] || "Start the configured service and check its port.",
    };
  if (hasCode("ENOTFOUND", "EAI_AGAIN", "ENODATA"))
    return {
      stage,
      code: "DNS_LOOKUP_FAILED",
      hint: "Check the connection hostname, DNS resolver, and network connection.",
    };
  if (hasCode("ETIMEDOUT", "ETIMEOUT"))
    return {
      stage,
      code: "CONNECTION_TIMED_OUT",
      hint: "Check service availability, firewall rules, and the database/service IP access list.",
    };
  if (hasCode("EADDRINUSE"))
    return {
      stage,
      code: "EADDRINUSE",
      hint: "PORT is already in use. Stop the other server or choose another PORT.",
    };
  if (
    nodes.some((node) =>
      ["MongooseServerSelectionError", "MongoServerSelectionError"].includes(
        node.name
      )
    )
  ) {
    return {
      stage,
      code: "DATABASE_UNREACHABLE",
      hint: "No MongoDB server was reachable. For Atlas, check cluster availability and add your current public IP to Network Access; check firewall/VPN connectivity.",
    };
  }
  return {
    stage,
    code: "STARTUP_FAILED",
    hint: hints[stage] || "Check application startup configuration.",
  };
}
