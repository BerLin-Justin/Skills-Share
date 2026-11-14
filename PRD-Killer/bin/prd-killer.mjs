#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';

const packageRoot = url.fileURLToPath(new URL('../', import.meta.url));
const skillEntries = ['SKILL.md', 'README.md', 'agents', 'references', 'assets', 'scripts', 'evals'];

/** 帮助与版本查询不加载图形依赖，安装Skill也不执行渲染。 */
function printHelp()
{
    process.stdout.write(`PRD-Killer：安装图解需求分析Skill，或渲染本地DOT图示。

用法：
  prd-killer install [--target <Skill目录>]
  prd-killer render --input <DOT文件或目录> --output <目录> [--width 400..4800] [--overwrite]
  prd-killer --version
  prd-killer --help

install 默认目录：CODEX_HOME/skills/prd-killer；未设置CODEX_HOME时使用 ~/.codex/skills/prd-killer。
已有目标不会覆盖；--target 指定完整Skill目录，支持含空格路径。
render 复用本地渲染器，可另传 --module-dir 指定已有node_modules；不上传业务数据。
此CLI提供安装与图示渲染，PRD分析由支持Skill的AI客户端执行。
`);
}

/** 只接受明确的单个安装目标，避免拼错参数后写入默认目录。 */
function installTarget(args)
{
    if (args.length === 0)
    {
        const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
        return path.resolve(codexHome, 'skills', 'prd-killer');
    }
    if (args.length !== 2 || args[0] !== '--target' || !args[1] || args[1].startsWith('--'))
    {
        throw new Error('安装参数无效：install [--target <完整Skill目录>]');
    }
    return path.resolve(args[1]);
}

/** 安装目标不得包含包源或落入包源，防止把资源递归复制到自身。 */
function overlapsPackage(source, target)
{
    const relative = path.relative(source, target);
    const reverse = path.relative(target, source);
    const outside = value => value === '..' || value.startsWith(`..${path.sep}`) || path.isAbsolute(value);
    return !outside(relative) || !outside(reverse);
}

/** 解析已有父目录的真实路径，再接回未创建部分，覆盖junction和符号链接。 */
async function canonicalDestination(target)
{
    let ancestor = target;
    const missing = [];
    while (true)
    {
        try
        {
            return path.join(await fs.realpath(ancestor), ...missing.toReversed());
        }
        catch (error)
        {
            if (error.code !== 'ENOENT' || path.dirname(ancestor) === ancestor)
            {
                throw error;
            }
            missing.push(path.basename(ancestor));
            ancestor = path.dirname(ancestor);
        }
    }
}

/** 预检资源后独占创建新目录；拒绝覆盖，不删除已有或部分写入的内容。 */
async function installSkill(target)
{
    const source = await fs.realpath(packageRoot);
    const destination = await canonicalDestination(target);
    if (overlapsPackage(source, destination))
    {
        throw new Error('安装目标与npm包目录重叠，请指定包目录以外的新Skill目录。');
    }
    await Promise.all(skillEntries.map(entry => fs.access(path.join(packageRoot, entry))));
    await fs.mkdir(path.dirname(target),
    {
        recursive: true
    });
    try
    {
        await fs.mkdir(target);
    }
    catch (error)
    {
        if (error.code === 'EEXIST')
        {
            throw new Error(`安装目标已存在，未覆盖：${target}。请先备份并使用新的目标目录。`);
        }
        throw error;
    }
    await copySkillResources(target);
    process.stdout.write(`Skill已安装：${target}\n`);
}

/** 复制的是可离线读取的Skill资源；失败明确报错，保留现场供用户检查。 */
async function copySkillResources(target)
{
    try
    {
        for (const entry of skillEntries)
        {
            await fs.cp(path.join(packageRoot, entry), path.join(target, entry),
            {
                recursive: true,
                force: false,
                errorOnExist: true
            });
        }
    }
    catch (error)
    {
        throw new Error(`安装未完成：${error.message}。${target}可能保留部分资源，请检查后再安装。`,
        {
            cause: error
        });
    }
}

/** 不经shell传递路径与参数，保留渲染器的输出、退出状态及覆盖保护。 */
function renderDiagrams(args)
{
    return new Promise((resolve, reject) =>
    {
        const child = childProcess.spawn(process.execPath,
            [path.join(packageRoot, 'scripts', 'render-diagrams.mjs'), ...args],
            {
                stdio: 'inherit',
                shell: false
            });
        child.once('error', reject);
        child.once('exit', (code, signal) =>
        {
            if (signal)
            {
                process.stderr.write(`渲染进程被${signal}终止。\n`);
            }
            resolve(code ?? 1);
        });
    });
}

/** 命令入口只做解析与分发，安装及渲染均不调用模型或外部业务接口。 */
async function main()
{
    const [command, ...args] = process.argv.slice(2);
    if (!command || ['help', '--help', '-h'].includes(command)
        || (args.length === 1 && ['--help', '-h'].includes(args[0])))
    {
        printHelp();
        return;
    }
    if (command === '--version' && args.length === 0)
    {
        const pkg = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
        process.stdout.write(`${pkg.version}\n`);
        return;
    }
    if (command === 'install')
    {
        await installSkill(installTarget(args));
        return;
    }
    if (command === 'render')
    {
        process.exitCode = await renderDiagrams(args);
        return;
    }
    throw new Error(`未知命令：${command}。使用 --help 查看用法。`);
}

// CLI失败必须显式返回非零，不能将部分安装或渲染失败显示为成功。
main().catch(error =>
{
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});
