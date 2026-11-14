import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import url from 'node:url';
import test from 'node:test';
import moduleApi from 'node:module';

const script = url.fileURLToPath(new URL('../scripts/render-diagrams.mjs', import.meta.url));

// 用实际中文字形度量检查边界，防止“生成成功但标签越框”的回归。
test('keeps long Chinese text inside its node bounds', async () =>
{
    const root = await workspace();
    const source = path.join(root, 'chinese.dot');
    const output = path.join(root, 'rendered');
    const label = '原子保存申请快照和本单占用';
    await fs.writeFile(source, `digraph G { node[shape=box,fontname="Microsoft YaHei",fontsize=18]; a[label="${label}"]; }`);
    const result = run(source, output);
    assert.equal(result.status, 0, result.stderr);
    const svg = await fs.readFile(path.join(output, 'chinese.svg'), 'utf8');
    assert.match(svg, /font-family="Microsoft YaHei/);
    assert.doesNotMatch(svg, /font-family="Courier/);
    const node = svg.match(/<g id="node1" class="node">([\s\S]*?)<\/g>/)[1];
    const points = node.match(/<polygon[^>]*points="([^"]+)"/)[1]
        .split(' ').map(point => Number(point.split(',')[0]));
    const nodeWidth = Math.max(...points) - Math.min(...points);
    const requireFrom = process.env.PRD_DIAGRAM_MODULES
        ? moduleApi.createRequire(path.join(process.env.PRD_DIAGRAM_MODULES, '__test__.cjs'))
        : moduleApi.createRequire(import.meta.url);
    const sharp = requireFrom('sharp');
    const glyph = await sharp({ text: { text: label, font: 'Microsoft YaHei 18', dpi: 72 } }).metadata();
    assert.ok(nodeWidth >= glyph.width + 8, `node=${nodeWidth}pt, actual Chinese=${glyph.width}pt`);
});

/** 为渲染边界测试创建独立目录，不修改已有需求产物。 */
async function workspace()
{
    return fs.mkdtemp(path.join(os.tmpdir(), 'prd-diagrams-'));
}

/** 运行真实 CLI，验证文件交付与退出状态，而非复制实现逻辑。 */
function run(input, output, extra = [])
{
    const args = [script, '--input', input, '--output', output];
    if (process.env.PRD_DIAGRAM_MODULES)
    {
        args.push('--module-dir', process.env.PRD_DIAGRAM_MODULES);
    }
    return childProcess.spawnSync(process.execPath, [...args, ...extra],
    {
        encoding: 'utf8'
    });
}

// 中文可见标签、矢量与高清图片必须来自同一次真实渲染。
test('renders Chinese labels to SVG and a readable PNG', async () =>
{
    const root = await workspace();
    const source = path.join(root, 'business.dot');
    const output = path.join(root, 'rendered');
    await fs.writeFile(source, 'digraph G { a [label="提交结算"]; b [label="额度校验"]; a -> b [label="计划与金额"]; }');
    const result = run(source, output);
    assert.equal(result.status, 0, result.stderr);
    const svg = await fs.readFile(path.join(output, 'business.svg'), 'utf8');
    const png = await fs.readFile(path.join(output, 'business.png'));
    assert.match(svg, /<svg/);
    assert.match(svg, /提交结算/);
    assert.match(svg, /计划与金额/);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.ok(png.readUInt32BE(16) >= 400);
    assert.ok(png.readUInt32BE(20) > 0);
});

// 一批图中有语法错误时，不允许落下部分图并冒充整批完成。
test('rejects an invalid batch before publishing any diagrams', async () =>
{
    const root = await workspace();
    const input = path.join(root, 'sources');
    const output = path.join(root, 'rendered');
    await fs.mkdir(input);
    await fs.writeFile(path.join(input, 'a.dot'), 'digraph G { a -> b; }');
    await fs.writeFile(path.join(input, 'b.dot'), 'digraph G { a -> ; }');
    const result = run(input, output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /b\.dot/);
    const published = await fs.readdir(output).catch(() => []);
    assert.equal(published.length, 0);
});

// 默认保护已有文件；重绘需要显式标志，避免覆盖用户同名图。
test('preserves existing outputs unless overwrite is explicit', async () =>
{
    const root = await workspace();
    const source = path.join(root, 'existing.dot');
    const output = path.join(root, 'rendered');
    await fs.mkdir(output);
    await fs.writeFile(source, 'digraph G { a -> b; }');
    const existing = path.join(output, 'existing.svg');
    await fs.writeFile(existing, 'user-owned-content');
    const refused = run(source, output);
    assert.notEqual(refused.status, 0);
    assert.equal(await fs.readFile(existing, 'utf8'), 'user-owned-content');
    const accepted = run(source, output, ['--overwrite']);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.match(await fs.readFile(existing, 'utf8'), /<svg/);
});
