import "server-only";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

/*
 * Running the Codex CLI safely (ported from Creative Studio's companion). API keys are removed from the environment
 * before every spawn, so the CLI can only ever use the signed-in ChatGPT plan — never paid API usage by accident.
 */

const STRIP = ["OPENAI_API_KEY", "CODEX_API_KEY", "AZURE_OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS"];

export function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of STRIP) delete env[key];
  return env;
}

/** Finds a CLI on PATH, then in the usual install places (the dev server's PATH can be shorter than a terminal's). */
export function findBin(name: string): string {
  const dirs = [
    join(homedir(), ".local", "bin"),
    ...(process.env.PATH ?? "").split(delimiter),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    join(homedir(), ".npm-global", "bin"),
  ];
  for (const dir of dirs) {
    if (!dir) continue;
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return name;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
}

function stop(child: ChildProcess) {
  if (!child.killed) child.kill("SIGTERM");
}

/**
 * `doneWhen` is checked every 2 s; once it says the work is done, the CLI gets 5 s to exit on its own and is then
 * stopped. That ends runs where Codex has delivered the image but keeps running afterwards.
 */
export function run(bin: string, args: string[], opts: { cwd?: string; timeoutMs?: number; signal?: AbortSignal; doneWhen?: () => Promise<boolean> } = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn(bin, args, { cwd: opts.cwd, env: cleanEnv(), stdio: ["pipe", "pipe", "pipe"] });
    } catch (e) {
      resolve({ code: -1, stdout: "", stderr: e instanceof Error ? e.message : String(e), timedOut: false, aborted: false });
      return;
    }
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let aborted = false;
    const timer = setTimeout(() => {
      timedOut = true;
      stop(child);
    }, opts.timeoutMs ?? 300_000);
    const onAbort = () => {
      aborted = true;
      stop(child);
    };
    if (opts.signal?.aborted) onAbort();
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    let watcher: ReturnType<typeof setInterval> | undefined;
    if (opts.doneWhen) {
      const check = opts.doneWhen;
      watcher = setInterval(async () => {
        if (await check().catch(() => false)) {
          clearInterval(watcher);
          setTimeout(() => stop(child), 5_000);
        }
      }, 2_000);
    }
    child.stdout?.on("data", (c) => (stdout += c));
    child.stderr?.on("data", (c) => (stderr += c));
    const finish = (code: number) => {
      clearTimeout(timer);
      if (watcher) clearInterval(watcher);
      opts.signal?.removeEventListener("abort", onAbort);
      resolve({ code, stdout, stderr, timedOut, aborted });
    };
    child.on("error", (e) => {
      stderr += e.message;
      finish(-1);
    });
    child.on("close", (code) => finish(code ?? -1));
    // codex waits for stdin otherwise (the scripts used `< /dev/null`).
    child.stdin?.end();
  });
}
