import fs from 'node:fs/promises';
import path from 'node:path';
import moduleApi from 'node:module';

/** 解析显式参数，保持运行时与依赖目录由调用环境提供。 */
function optionsFrom(args)
{
    const options = { overwrite: false, width: 1800 };
    const keys = new Map([
        ['--input', 'input'], ['--output', 'output'],
        ['--module-dir', 'moduleDir'], ['--width', 'width']
    ]);
    for (let index = 0; index < args.length; index += 1)
    {
        const arg = args[index];
        if (arg === '--overwrite')
        {
            options.overwrite = true;
            continue;
        }
        if (!keys.has(arg) || !args[index + 1] || args[index + 1].startsWith('--'))
        {
            throw new Error(`未知参数或缺少值：${arg}`);
        }
        options[keys.get(arg)] = args[++index];
    }
    options.width = Number(options.width);
    if (!options.input || !options.output || !Number.isInteger(options.width)
        || options.width < 400 || options.width > 4800)
    {
        throw new Error('用法：--input 文件或目录 --output 目录 [--module-dir node_modules] [--width 400..4800] [--overwrite]');
    }
    return options;
}

/** 只处理明确指定目录的一层 DOT 文件，避免递归带入旧产物。 */
async function sourceFiles(input)
{
    const absolute = path.resolve(input);
    const stat = await fs.stat(absolute);
    if (stat.isFile())
    {
        if (path.extname(absolute).toLowerCase() !== '.dot')
        {
            throw new Error('输入文件必须为 .dot');
        }
        return [absolute];
    }
    const entries = await fs.readdir(absolute, { withFileTypes: true });
    const files = entries.filter(entry => entry.isFile() && /\.dot$/i.test(entry.name))
        .map(entry => path.join(absolute, entry.name)).sort();
    if (files.length === 0)
    {
        throw new Error('输入目录没有 .dot 文件');
    }
    return files;
}

/** 复用本地 Viz 与 Sharp，不联网下载或改变用户依赖。 */
function dependencies(moduleDir)
{
    const requireFrom = moduleDir
        ? moduleApi.createRequire(path.join(path.resolve(moduleDir), '__prd_resolver__.cjs'))
        : moduleApi.createRequire(import.meta.url);
    try
    {
        return { viz: requireFrom('@viz-js/viz'), sharp: requireFrom('sharp') };
    }
    catch (error)
    {
        throw new Error('未找到本地 @viz-js/viz 或 sharp；请传入已安装的 node_modules 目录，不会自动安装。', { cause: error });
    }
}

/** 转义真实标签供 Pango 和 SVG 使用，保留业务文字而不当作标记解析。 */
function xmlText(value)
{
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 拆分 DOT 的显式换行；动态标签需由作者先展开，避免恢复出错误业务文字。 */
function labelLines(raw)
{
    const lines = [];
    let text = '';
    for (let index = 0; index < raw.length; index += 1)
    {
        if (raw[index] !== '\\')
        {
            text += raw[index];
            continue;
        }
        const escaped = raw[++index];
        if ('nlr'.includes(escaped))
        {
            lines.push({ text, ending: `\\${escaped}` });
            text = '';
        }
        else if (escaped === '\\' || escaped === '"')
        {
            text += escaped;
        }
        else
        {
            throw new Error(`请将动态或特殊 DOT 标签预先展开：\\${escaped}`);
        }
    }
    lines.push({ text, ending: '' });
    return lines;
}

/** 以真实中文度量生成等宽占位标签，让 WASM 布局不依赖缺失的中文字体度量。 */
async function layoutLabels(dot, sharp)
{
    if (/\b(?:label|xlabel|headlabel|taillabel)\s*=\s*</.test(dot))
    {
        throw new Error('此离线助手使用引号文本标签；HTML 标签请改为普通多行标签或原生 SVG。');
    }
    const originals = new Map();
    const widths = new Map();
    const matches = [...dot.matchAll(/(\b(?:label|xlabel|headlabel|taillabel)\s*=\s*)"((?:\\.|[^"\\])*)"/g)];
    let prefix = 'Q';
    while (dot.includes(prefix))
    {
        prefix += 'Q';
    }
    let prepared = '';
    let cursor = 0;
    for (const match of matches)
    {
        let label = '';
        for (const line of labelLines(match[2]))
        {
            if (!widths.has(line.text))
            {
                const glyph = line.text ? await sharp(
                {
                    text: { text: xmlText(line.text), font: 'Microsoft YaHei 100', dpi: 72 }
                }).metadata() : { width: 0 };
                widths.set(line.text, glyph.width);
            }
            const identity = `${prefix}${originals.size.toString(36)}`;
            // Courier 每字符为 0.6em；保留安全余量，输出阶段恢复真实字体和原文。
            const length = Math.max(identity.length, Math.ceil(widths.get(line.text) * 1.06 / 60));
            const token = identity.padEnd(length, 'X');
            originals.set(token, line.text);
            label += token + line.ending;
        }
        prepared += dot.slice(cursor, match.index) + match[1] + `"${label}"`;
        cursor = match.index + match[0].length;
    }
    prepared += dot.slice(cursor);
    prepared = prepared.replace(/\bfontname\s*=\s*(?:"(?:\\.|[^"\\])*"|[^,\]\s;]+)/g, 'fontname="Courier"');
    return { dot: prepared, originals };
}

/** 保留布局位置，只恢复可见文字和真实字体，不用缩字掩盖越界。 */
function restoreLabels(svg, originals)
{
    return svg.replace(/font-family="Courier(?:,monospace)?"/g, 'font-family="Microsoft YaHei, sans-serif"')
        .replace(/(<text\b[^>]*>)([^<]*)(<\/text>)/g, (match, open, value, close) =>
        {
            return originals.has(value) ? open + xmlText(originals.get(value)) + close : match;
        });
}

/** 在任何写入前检查全部目标，默认不覆盖已有图。 */
async function verifyTargets(files, output, overwrite)
{
    if (overwrite)
    {
        return;
    }
    for (const source of files)
    {
        const stem = path.basename(source, path.extname(source));
        for (const extension of ['svg', 'png'])
        {
            const target = path.join(output, `${stem}.${extension}`);
            const exists = await fs.access(target).then(() => true, () => false);
            if (exists)
            {
                throw new Error(`目标已存在，未覆盖：${target}；重绘本人产物时可显式使用 --overwrite。`);
            }
        }
    }
}

/** 先完成整批渲染与栅格化，语法失败时不交付半批图。 */
async function renderBatch(files, tools, width)
{
    const viz = await tools.viz.instance();
    const images = [];
    for (const source of files)
    {
        const dot = await fs.readFile(source, 'utf8');
        const labels = await layoutLabels(dot, tools.sharp);
        const result = viz.render(labels.dot,
        {
            format: 'svg',
            graphAttributes: { bgcolor: '#ffffff', pad: 0.3, fontname: 'Courier' },
            nodeAttributes: { fontname: 'Courier', fontsize: 16 },
            edgeAttributes: { fontname: 'Courier', fontsize: 13 }
        });
        if (result.status !== 'success')
        {
            throw new Error(`${path.basename(source)}：${result.errors.map(item => item.message).join('; ')}`);
        }
        for (const warning of result.errors)
        {
            process.stderr.write(`渲染警告 ${path.basename(source)}：${warning.message}\n`);
        }
        const svg = restoreLabels(result.output, labels.originals);
        const png = await tools.sharp(Buffer.from(svg), { density: 192 })
            .resize({ width }).png().toBuffer();
        images.push({ stem: path.basename(source, path.extname(source)), svg, png });
    }
    return images;
}

/** 交付可编辑来源对应的矢量和 PNG，报告实际像素而不替代人工视觉检查。 */
async function main()
{
    const options = optionsFrom(process.argv.slice(2));
    const files = await sourceFiles(options.input);
    const output = path.resolve(options.output);
    await verifyTargets(files, output, options.overwrite);
    const tools = dependencies(options.moduleDir);
    const images = await renderBatch(files, tools, options.width);
    await fs.mkdir(output, { recursive: true });
    const report = [];
    for (const item of images)
    {
        await fs.writeFile(path.join(output, `${item.stem}.svg`), item.svg, 'utf8');
        await fs.writeFile(path.join(output, `${item.stem}.png`), item.png);
        const size = await tools.sharp(item.png).metadata();
        report.push({ name: item.stem, width: size.width, height: size.height });
    }
    process.stdout.write(`${JSON.stringify({ output, diagrams: report }, null, 2)}\n`);
}

// CLI 失败必须显式返回非零，不用空图或假成功替代渲染结果。
main().catch(error =>
{
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});
