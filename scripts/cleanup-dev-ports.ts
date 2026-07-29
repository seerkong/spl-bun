#!/usr/bin/env bun

const isWindows = process.platform === "win32";
const allDevPorts = [4174, 4175, 4176, 4177, 4178, 4179];

// Get ports from command line arguments, or use all ports if none specified
const args = process.argv.slice(2);
const devPorts = args.length > 0 ? args.map(Number).filter(n => !isNaN(n)) : allDevPorts;

const projectRoot = process.cwd();

const escapeForPowerShellString = (value: string) =>
  value.replace(/`/g, "``").replace(/"/g, '""');

const projectRootPs = escapeForPowerShellString(projectRoot);

const runPowerShell = (scriptLines: string[]) => {
  const script = scriptLines.join("\n");
  return Bun.spawnSync(["powershell", "-NoProfile", "-Command", script]);
};

const runShell = (scriptLines: string[]) => {
  const script = scriptLines.join("\n");
  return Bun.spawnSync(["bash", "-lc", script]);
};

const cleanupPorts = () => {
  console.log("[cleanup] Cleaning up dev ports:", devPorts.join(", "));

  if (isWindows) {
    try {
      const result = runPowerShell([
        `$ports = @(${devPorts.join(",")})`,
        "$conns = Get-NetTCPConnection -State Listen -LocalPort $ports -ErrorAction SilentlyContinue",
        "if ($conns) {",
        "  $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique",
        "  Write-Host \"[cleanup] Found processes on ports: $($pids -join ', ')\"",
        "  foreach ($procId in $pids) {",
        "    Write-Host \"[cleanup] Killing process $procId\"",
        "    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue",
        "    taskkill /T /F /PID $procId 2>$null | Out-Null",
        "  }",
        "} else {",
        "  Write-Host \"[cleanup] No processes found on specified ports\"",
        "}",
        `$root = "${projectRootPs}"`,
        "$rootRegex = [regex]::Escape($root)",
        "$nodeViteProcs = Get-CimInstance Win32_Process | Where-Object {",
        "  $_.ProcessName -eq 'node.exe' -and",
        "  $_.CommandLine -match 'vite\\.js' -and",
        "  $_.CommandLine -match $rootRegex",
        "}",
        "if ($nodeViteProcs) {",
        "  $nodeViteProcs | ForEach-Object {",
        "    Write-Host \"[cleanup] Killing node.exe vite process $($_.ProcessId)\"",
        "    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue",
        "  }",
        "}",
        "$viteExeProcs = Get-CimInstance Win32_Process | Where-Object {",
        "  $_.ProcessName -eq 'vite.exe' -and",
        "  $_.CommandLine -match $rootRegex",
        "}",
        "if ($viteExeProcs) {",
        "  $viteExeProcs | ForEach-Object {",
        "    Write-Host \"[cleanup] Killing vite.exe process $($_.ProcessId)\"",
        "    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue",
        "  }",
        "}",
        "Write-Host \"[cleanup] Cleanup complete\"",
      ]);

      // Print output
      if (result.stdout) {
        console.log(Buffer.from(result.stdout).toString());
      }
      if (result.stderr) {
        console.error(Buffer.from(result.stderr).toString());
      }
    } catch (err) {
      console.error("[cleanup] Error:", err);
    }
  } else {
    try {
      const projectRootPosix = projectRoot.replace(/\\/g, "/");
      const escapeForBash = (value: string) => value.replace(/'/g, "'\\''");
      const projectRootSh = escapeForBash(projectRootPosix);

      runShell([
        `for p in ${devPorts.join(" ")}; do lsof -ti tcp:$p -sTCP:LISTEN 2>/dev/null; done | sort -u | xargs -r kill -9`,
        `pkill -f 'node.*vite\\.js.*${projectRootSh}' 2>/dev/null || true`,
        `pkill -f 'vite.*${projectRootSh}' 2>/dev/null || true`,
      ]);
    } catch (err) {
      console.error("[cleanup] Error:", err);
    }
  }
};

cleanupPorts();
