/**
 * Frees a TCP listen port so npm run dev:* can start after a leftover process.
 * Usage: node scripts/free-port.cjs 3000
 */
const { execSync } = require("node:child_process");

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1) {
  console.error("Usage: node scripts/free-port.cjs <port>");
  process.exit(1);
}

function pidsOnPort(p) {
  try {
    const out = execSync(`netstat -ano`, { encoding: "utf8" });
    const ids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes(`:${p} `) && !line.includes(`:${p}\t`)) continue;
      if (!/LISTENING/i.test(line)) continue;
      const pid = line.trim().split(/\s+/).pop();
      if (pid && pid !== "0") ids.add(pid);
    }
    return [...ids];
  } catch {
    return [];
  }
}

const pids = pidsOnPort(port);
for (const pid of pids) {
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
    console.log(`Freed port ${port} (stopped PID ${pid})`);
  } catch {
    console.log(`Port ${port} still held by PID ${pid}; stop it manually if start fails.`);
  }
}

if (!pids.length) {
  console.log(`Port ${port} is free`);
}
