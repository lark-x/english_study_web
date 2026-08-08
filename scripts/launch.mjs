import { existsSync } from "node:fs";
import { readdirSync, rmSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const npmCli = isWindows ? resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js") : npmCommand;
const checkOnly = process.argv.includes("--check");
const noOpen = process.argv.includes("--no-open");
const localUrl = "http://localhost:4173/";
const cleanAnsi = (value) => value.replace(/\u001b\[[0-9;]*m/g, "");

const criticalDependencyFiles = [
  ["node_modules", "vinext", "package.json"],
  ["node_modules", "next", "package.json"],
  ["node_modules", "react", "package.json"],
  ["node_modules", "rolldown", "package.json"],
];

function findFirstRollupBinding() {
  const sharedDir = resolve(projectRoot, "node_modules", "rolldown", "dist", "shared");
  if (!existsSync(sharedDir)) return false;
  try {
    return readdirSync(sharedDir).some((name) => /^binding-[A-Za-z0-9_-]+\.mjs$/.test(name));
  } catch {
    return false;
  }
}

function dependenciesReady() {
  const allPresent = criticalDependencyFiles.every((parts) => existsSync(resolve(projectRoot, ...parts)));
  return allPresent && findFirstRollupBinding();
}

function verifyNodeVersion() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 13)) {
    console.error(`\n当前 Node.js 版本为 ${process.versions.node}，项目需要 22.13.0 或更高版本。`);
    console.error("请访问 https://nodejs.org/ 更新后再启动。\n");
    process.exit(1);
  }
}

function runNpm(args, stdio = "inherit") {
  const command = isWindows && existsSync(npmCli) ? process.execPath : npmCommand;
  const commandArgs = command === process.execPath ? [npmCli, ...args] : args;
  return spawn(command, commandArgs, {
    cwd: projectRoot,
    stdio,
    // npm.cmd can be spawned directly on Windows; shell mode causes DEP0190.
    shell: false,
    windowsHide: process.platform === "win32",
    env: { ...process.env, FORCE_COLOR: "1" },
  });
}

function waitFor(command) {
  return new Promise((resolvePromise, rejectPromise) => {
    command.once("error", rejectPromise);
    command.once("exit", (code) => code === 0 ? resolvePromise() : rejectPromise(new Error(`命令执行失败，退出代码 ${code ?? "未知"}`)));
  });
}

function openBrowser(url) {
  if (noOpen) return;
  const command = isWindows
    ? spawn("cmd.exe", ["/d", "/s", "/c", `start "" "${url}"`], { detached: true, stdio: "ignore", windowsHide: true })
    : process.platform === "darwin"
      ? spawn("open", [url], { detached: true, stdio: "ignore" })
      : spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
  command.unref();
}

async function existingServiceReady() {
  try {
    const response = await fetch(localUrl, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

verifyNodeVersion();

const dependencyReady = dependenciesReady();
const nodeModulesPresent = existsSync(resolve(projectRoot, "node_modules"));
if (checkOnly) {
  console.log(JSON.stringify({
    projectRoot,
    node: process.versions.node,
    dependencies: dependencyReady ? "installed" : "not-installed",
    launcher: "ready",
  }, null, 2));
  process.exit(0);
}

console.log("\n============================================================");
console.log(" Daily English · 本地阶段驱动英语学习系统");
console.log("============================================================\n");

if (await existingServiceReady()) {
  console.log(`学习网站已在运行：${localUrl}`);
  openBrowser(localUrl);
  process.exit(0);
}

if (!dependencyReady) {
  const nodeModulesDir = resolve(projectRoot, "node_modules");
  if (nodeModulesPresent) {
    const guardPrefix = `${resolve(projectRoot)}${sep}`;
    if (!nodeModulesDir.startsWith(guardPrefix) && nodeModulesDir !== resolve(projectRoot)) {
      console.error("检测到异常的 node_modules 路径，已停止，避免误删文件。");
      process.exit(1);
    }
    console.log("检测到依赖不完整，正在清理后重新安装，请保持网络连接并耐心等待...\n");
    try {
      rmSync(nodeModulesDir, { recursive: true, force: true });
    } catch (error) {
      console.error("清理 node_modules 失败，请手动删除该文件夹后重试。");
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  } else {
    console.log("首次启动：正在安装运行依赖，请保持网络连接并耐心等待...\n");
  }
  try {
    await waitFor(runNpm(["ci", "--no-audit", "--no-fund"]));
  } catch (error) {
    console.error("\n依赖安装失败。请确认网络正常，然后重新双击启动文件。");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
  console.log("\n依赖安装完成。\n");
}

console.log("正在启动学习服务，网页会在准备完成后自动打开...\n");

const server = runNpm(["run", "dev", "--", "--host", "localhost", "--port", "4173"], ["inherit", "pipe", "pipe"]);
let outputBuffer = "";
let browserOpened = false;

function handleOutput(chunk, destination) {
  const text = chunk.toString();
  destination.write(text);
  if (browserOpened) return;
  outputBuffer = `${outputBuffer}${cleanAnsi(text)}`.slice(-5000);
  const match = outputBuffer.match(/https?:\/\/(?:localhost|127\.0\.0\.1):\d+\/?/i);
  if (match) {
    browserOpened = true;
    const url = match[0];
    console.log(`\n学习网站已就绪：${url}`);
    if (!noOpen) console.log("正在打开默认浏览器...\n");
    openBrowser(url);
  }
}

server.stdout.on("data", (chunk) => handleOutput(chunk, process.stdout));
server.stderr.on("data", (chunk) => handleOutput(chunk, process.stderr));
server.once("error", (error) => {
  console.error("启动服务失败：", error.message);
  process.exitCode = 1;
});
server.once("exit", (code) => {
  if (code && code !== 0) {
    console.error(`\n学习服务已异常停止，退出代码：${code}`);
    process.exitCode = code;
  }
});
