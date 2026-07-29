const procs: { name: string; proc: Bun.Subprocess }[] = [];

function spawn(name: string, cmd: string[], cwd?: string) {
  const proc = Bun.spawn(cmd, {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  });
  procs.push({ name, proc });
  proc.exited.finally(() => {
    const idx = procs.findIndex((entry) => entry.proc === proc);
    if (idx >= 0) {
      procs.splice(idx, 1);
    }
  });
  return proc;
}

const runPowerShell = (scriptLines: string[]) => {
  const script = scriptLines.join("\n");
  return Bun.spawnSync(["powershell", "-NoProfile", "-Command", script]);
};

const isWindows = process.platform === "win32";
const devPorts = [4174, 4175, 4176, 4177, 4178, 4179];
const projectRoot = process.cwd();
const projectRootPosix = projectRoot.replace(/\\/g, "/");

const escapeForPowerShellString = (value: string) =>
  value.replace(/`/g, "``").replace(/"/g, '""');
const escapeForBash = (value: string) => value.replace(/'/g, "'\\''");

const projectRootPs = escapeForPowerShellString(projectRoot);
const projectRootSh = escapeForBash(projectRootPosix);

const runShell = (scriptLines: string[]) => {
  const script = scriptLines.join("\n");
  return Bun.spawnSync(["bash", "-lc", script]);
};

const platformGuards = () => {
  if (isWindows) return;
  try {
    const output = runShell(["command -v lsof >/dev/null 2>&1; echo $?"]);
    const stdout = output.stdout ? Buffer.from(output.stdout).toString().trim() : "";
    if (stdout !== "0") {
      console.warn("[web-ide-dev] lsof not found; port cleanup may be incomplete on macOS.");
    }
  } catch {
    // ignore
  }
};

platformGuards();

let children: Bun.Subprocess[] = [];

const killPidsAndChildren = (pids: number[]) => {
  if (pids.length === 0) return;
  if (isWindows) {
    const list = pids.join(",");
    try {
      runPowerShell([
        "try {",
        `  $targets = \"${list}\".Split(',');`,
        "  foreach ($pid in $targets) {",
        "    if ([int]::TryParse($pid, [ref]$null)) {",
        "      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue;",
        "      taskkill /T /F /PID $pid | Out-Null;",
        "      Get-CimInstance Win32_Process -Filter \"ParentProcessId=$pid\" |",
        "        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
        "    }",
        "  }",
        "  $root = \"${projectRootPs}\";",
        "  $rootRegex = [regex]::Escape($root);",
        "  Get-CimInstance Win32_Process |",
        "    Where-Object { $_.CommandLine -match 'vite' -and ($_.CommandLine -match $rootRegex -or $_.CommandLine -match 'packages\\\\web-ide') } |",
        "    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
        "  Get-CimInstance Win32_Process |",
        "    Where-Object { $_.CommandLine -match 'bun\\.exe\\s+run\\s+src\\/server\\.ts' } |",
        "    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
        "  $vitePids = (Get-CimInstance Win32_Process |",
        "    Where-Object { $_.CommandLine -match 'vite' -and ($_.CommandLine -match $rootRegex -or $_.CommandLine -match 'packages\\\\web-ide') } |",
        "    Select-Object -ExpandProperty ProcessId -Unique)",
        "  if ($vitePids) {",
        "    foreach ($pid in $vitePids) {",
        "      taskkill /T /F /PID $pid | Out-Null",
        "    }",
        "  }",
        "} catch {}",
      ]);
    } catch {
      // ignore
    }
    return;
  }
  const list = pids.join(" ");
  try {
    runShell([
      `pids=\"${list}\"`,
      "for pid in $pids; do",
      "  if [ -n \"$pid\" ]; then",
      "    kill -9 $pid 2>/dev/null || true",
      "    pkill -P $pid 2>/dev/null || true",
      "  fi",
      "done",
      `vite_pids=$(pgrep -f 'vite.*${projectRootSh}/packages/web-ide' || true)`,
      "if [ -n \"$vite_pids\" ]; then kill -9 $vite_pids 2>/dev/null || true; fi",
      "server_pids=$(pgrep -f 'bun .*run .*src/server.ts' || true)",
      "if [ -n \"$server_pids\" ]; then kill -9 $server_pids 2>/dev/null || true; fi",
    ]);
  } catch {
    // ignore
  }
};

const killProcessTree = (pid: number) => {
  try {
    if (isWindows) {
      Bun.spawnSync(["taskkill", "/T", "/F", "/PID", String(pid)]);
    } else {
      runShell([`kill -9 ${pid} 2>/dev/null || true`, `pkill -P ${pid} 2>/dev/null || true`]);
    }
  } catch {
    // ignore
  }
};

const killRemainingPorts = () => {
  try {
    if (isWindows) {
      const output = runPowerShell([
        `$ports = @(${devPorts.join(",")})`,
        "$conns = Get-NetTCPConnection -State Listen -LocalPort $ports -ErrorAction SilentlyContinue",
        "if ($null -ne $conns) {",
        "  $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique",
        "  $pids -join ','",
        "}",
      ]);
      const stdout = output.stdout ? Buffer.from(output.stdout).toString().trim() : "";
      const pids = stdout
        ? stdout
          .split(/\s*,\s*/)
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
        : [];
      if (pids.length > 0) {
        killPidsAndChildren(pids);
        console.log("[web-ide-dev] Cleared lingering dev ports:", devPorts.join(", "));
      } else {
        killPidsAndChildren([0]);
        console.log("[web-ide-dev] No listening dev ports; ran fallback cleanup.");
      }
      return;
    }
    const output = runShell([
      `for p in ${devPorts.join(" ")}; do lsof -ti tcp:$p -sTCP:LISTEN; done | sort -u`,
    ]);
    const stdout = output.stdout ? Buffer.from(output.stdout).toString().trim() : "";
    const pids = stdout
      ? stdout
        .split(/\s+/)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
      : [];
    if (pids.length > 0) {
      killPidsAndChildren(pids);
      console.log("[web-ide-dev] Cleared lingering dev ports:", devPorts.join(", "));
    }
  } catch (err) {
    console.error("[web-ide-dev] Failed to clear dev ports", err);
  }
};

const killNodeDevServers = () => {
  try {
    if (isWindows) {
      runPowerShell([
        "try {",
        "  $root = \"${projectRootPs}\";",
        "  $rootRegex = [regex]::Escape($root);",
        "  # Kill all node.exe processes running vite.js from this project",
        "  Get-CimInstance Win32_Process |",
        "    Where-Object { $_.ProcessName -eq 'node.exe' -and $_.CommandLine -match 'vite\\.js' -and $_.CommandLine -match $rootRegex } |",
        "    ForEach-Object { ",
        "      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue",
        "      taskkill /T /F /PID $_.ProcessId 2>$null | Out-Null",
        "    }",
        "  # Kill all vite.exe processes from this project",
        "  Get-CimInstance Win32_Process |",
        "    Where-Object { $_.ProcessName -eq 'vite.exe' -and $_.CommandLine -match $rootRegex } |",
        "    ForEach-Object { ",
        "      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue",
        "      taskkill /T /F /PID $_.ProcessId 2>$null | Out-Null",
        "    }",
        "  # Kill any process with 'vite' in command line from this project",
        "  Get-CimInstance Win32_Process |",
        "    Where-Object { $_.CommandLine -match 'vite' -and ($_.CommandLine -match $rootRegex -or $_.CommandLine -match 'packages\\\\web-ide') } |",
        "    ForEach-Object { ",
        "      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue",
        "      taskkill /T /F /PID $_.ProcessId 2>$null | Out-Null",
        "    }",
        "  # Kill bun processes running server.ts",
        "  Get-CimInstance Win32_Process |",
        "    Where-Object { $_.CommandLine -match 'bun\\.exe\\s+run\\s+src\\/server\\.ts' } |",
        "    ForEach-Object { ",
        "      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue",
        "      taskkill /T /F /PID $_.ProcessId 2>$null | Out-Null",
        "    }",
        "  # Kill all processes listening on dev ports",
        `  $ports = @(${devPorts.join(",")})`,
        "  $conns = Get-NetTCPConnection -State Listen -LocalPort $ports -ErrorAction SilentlyContinue",
        "  if ($conns) {",
        "    $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique",
        "    foreach ($pid in $pids) {",
        "      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue",
        "      taskkill /T /F /PID $pid 2>$null | Out-Null",
        "    }",
        "  }",
        "} catch {}",
      ]);
      return;
    }
    runShell([
      `for p in ${devPorts.join(" ")}; do lsof -ti tcp:$p -sTCP:LISTEN; done | sort -u > /tmp/esproc-dev-pids.txt`,
      "pids=$(cat /tmp/esproc-dev-pids.txt 2>/dev/null || true)",
      "if [ -n \"$pids\" ]; then kill -9 $pids 2>/dev/null || true; fi",
      `pkill -f 'node.*vite\\.js.*${projectRootSh}' 2>/dev/null || true`,
      `pkill -f 'vite.*${projectRootSh}/packages/web-ide' 2>/dev/null || true`,
      "pkill -f 'bun .*run .*src/server.ts' 2>/dev/null || true",
      "pkill -f 'vite' 2>/dev/null || true",
    ]);
  } catch {
    // ignore
  }
};

let shuttingDown = false;
const shutdown = (reason: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[web-ide-dev] Shutting down: ${reason}`);

  // First, kill all child processes
  children.forEach((proc) => {
    try {
      proc.kill("SIGKILL");
      if (proc.pid) {
        killProcessTree(proc.pid);
      }
    } catch {
      // ignore
    }
  });

  // Immediate cleanup
  killRemainingPorts();
  killNodeDevServers();

  // Aggressive repeated cleanup to catch any stragglers
  setTimeout(() => {
    killRemainingPorts();
    killNodeDevServers();
  }, 300);
  setTimeout(() => {
    killRemainingPorts();
    killNodeDevServers();
  }, 800);
  setTimeout(() => {
    killRemainingPorts();
    killNodeDevServers();
  }, 1500);
  setTimeout(() => {
    killRemainingPorts();
    killNodeDevServers();
  }, 2200);
};

const groupId = "web-ide-dev";

children = [
  spawn("web-server", ["bun", "run", "--filter", "depa-data-web-server", "dev"]),
  spawn("web-ide", ["bun", "run", "--filter", "depa-data-web-ide", "dev"]),
];

// Track child PIDs for cleanup
const childPids: number[] = [];
children.forEach((proc) => {
  if (proc.pid) {
    childPids.push(proc.pid);
  }
});

const scheduleExit = (code: number) => {
  setTimeout(() => {
    // Final aggressive cleanup before exit
    killPidsAndChildren(childPids);
    killRemainingPorts();
    killNodeDevServers();
    process.exit(code);
  }, 3000);
};

const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"];
signals.forEach((sig) => {
  process.on(sig, () => {
    shutdown(sig);
    scheduleExit(0);
  });
});

process.on("exit", () => {
  shutdown("exit");
  // Synchronous final cleanup
  killPidsAndChildren(childPids);
});
process.on("beforeExit", () => shutdown("beforeExit"));
process.on("uncaughtException", (err) => {
  console.error(err);
  shutdown("uncaughtException");
  scheduleExit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error(reason);
  shutdown("unhandledRejection");
  scheduleExit(1);
});
