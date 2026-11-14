import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';
import test from 'node:test';

const root = url.fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'bin', 'prd-killer.mjs');

/** 通过真实命令验证打包后的使用边界，不修改用户真实Skill目录。 */
function run(args, extra = {})
{
    return childProcess.spawnSync(process.execPath, [cli, ...args],
    {
        encoding: 'utf8',
        ...extra
    });
}

/** 每个写入场景使用独立临时目录，保留测试失败现场。 */
async function workspace()
{
    return fs.mkdtemp(path.join(os.tmpdir(), 'prd-killer-cli-'));
}

test('help and version work without invoking the renderer', async () =>
{
    const help = run(['--help']);
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /install/);
    assert.match(help.stdout, /render/);
    const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
    const version = run(['--version']);
    assert.equal(version.status, 0, version.stderr);
    assert.equal(version.stdout.trim(), pkg.version);
});

test('install copies complete Skill resources and refuses to replace existing content', async () =>
{
    const temporary = await workspace();
    const target = path.join(temporary, 'skill with spaces');
    const installed = run(['install', '--target', target]);
    assert.equal(installed.status, 0, installed.stderr);
    for (const relative of ['SKILL.md', 'README.md', 'agents/openai.yaml', 'references/output-template.md',
        'references/example-confirmed-checklist.md', 'assets/small-query-example/diagrams/ticket-filter.png',
        'scripts/render-diagrams.mjs', 'evals/cases.md'])
    {
        assert.deepEqual(await fs.readFile(path.join(target, relative)), await fs.readFile(path.join(root, relative)));
    }
    await fs.writeFile(path.join(target, 'SKILL.md'), 'user-customized-skill');
    const refused = run(['install', '--target', target]);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /已存在/);
    assert.equal(await fs.readFile(path.join(target, 'SKILL.md'), 'utf8'), 'user-customized-skill');
});

test('default installation honors CODEX_HOME and rejects invalid or overlapping targets', async () =>
{
    const temporary = await workspace();
    const codexHome = path.join(temporary, 'isolated-codex');
    const result = run(['install'],
    {
        env:
        {
            ...process.env,
            CODEX_HOME: codexHome
        }
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(await fs.readFile(path.join(codexHome, 'skills', 'prd-killer', 'SKILL.md'), 'utf8'), /name: prd-killer/);
    const invalid = run(['install', '--target']);
    assert.notEqual(invalid.status, 0);
    const overlapping = path.join(root, 'assets', '__must-not-create__');
    const refused = run(['install', '--target', overlapping]);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /重叠/);
    assert.equal(await fs.access(overlapping).then(() => true, () => false), false);
    assert.notEqual(run(['unknown-command']).status, 0);
});

test('render forwards paths with spaces and preserves rendering failures', async () =>
{
    const temporary = await workspace();
    const source = path.join(temporary, 'business flow.dot');
    const output = path.join(temporary, 'rendered diagrams');
    await fs.writeFile(source, 'digraph G { a[label="登记收款"]; b[label="核验余额"]; a -> b; }');
    const args = ['render', '--input', source, '--output', output, '--width', '900'];
    if (process.env.PRD_DIAGRAM_MODULES)
    {
        args.push('--module-dir', process.env.PRD_DIAGRAM_MODULES);
    }
    const result = run(args);
    assert.equal(result.status, 0, result.stderr);
    const svg = await fs.readFile(path.join(output, 'business flow.svg'), 'utf8');
    const png = await fs.readFile(path.join(output, 'business flow.png'));
    assert.match(svg, /登记收款/);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 900);
    const refused = run(args);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /目标已存在/);
});

// Windows junction及目录符号链接也可能指回包源，不能仅按路径字符串判定。
test('install rejects a target that points into its package through a directory link', async () =>
{
    const temporary = await workspace();
    const source = path.join(temporary, 'isolated-package');
    await fs.mkdir(path.join(source, 'bin'),
    {
        recursive: true
    });
    await fs.copyFile(cli, path.join(source, 'bin', 'prd-killer.mjs'));
    await fs.writeFile(path.join(source, 'SKILL.md'), 'fixture');
    for (const name of ['agents', 'references', 'assets', 'scripts', 'evals'])
    {
        await fs.mkdir(path.join(source, name));
    }
    const alias = path.join(temporary, 'linked-package');
    await fs.symlink(source, alias, process.platform === 'win32' ? 'junction' : 'dir');
    const target = path.join(alias, 'new-skill');
    const result = childProcess.spawnSync(process.execPath,
        [path.join(source, 'bin', 'prd-killer.mjs'), 'install', '--target', target],
        {
            encoding: 'utf8'
        });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /重叠/);
    assert.equal(await fs.access(target).then(() => true, () => false), false);
});
