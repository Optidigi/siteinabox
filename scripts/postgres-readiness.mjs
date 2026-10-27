import { spawnSync } from "node:child_process"

/** The entrypoint's temporary Unix-socket server is not the final database. */
export function postgresRehearsalReady(container, execute = spawnSync) {
  const probe = execute("docker", ["exec", "--env", "PGPASSWORD=verification-only", "--env", "PGCONNECT_TIMEOUT=3", container,
    "psql", "-X", "-h", "127.0.0.1", "-U", "payload", "-d", "payload_test", "-v", "ON_ERROR_STOP=1", "-Atc", "SELECT current_database()"],
  { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] })
  return !probe.error && probe.status === 0 && probe.stdout?.trim() === "payload_test"
}
