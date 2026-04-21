import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { parsePastedInput } from '../lib/parser';
import {
	clearFormattingCache,
	formatBibliographyEntries,
} from '../lib/formatting/csl';
import {
	createEmptyManualEntryFields,
	createManualCitation,
} from '../lib/manual-entry';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'output', 'benchmarks');
const fixturesDir = path.join(repoRoot, 'src', 'benchmarks', 'fixtures');
const FIXTURE_NAMES = [
	'import-freetext-10.txt',
	'import-freetext-25.txt',
	'import-freetext-50.txt',
];
const STYLE_SWITCH_SEQUENCE = ['ieee', 'vancouver', 'mla-9'];
const DEFAULT_STYLE = 'chicago-notes-bibliography';
const RUNS = 5;

function readFixture(name) {
	return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

function round(value) {
	return Number(value.toFixed(2));
}

function summarize(values) {
	const sorted = [...values].sort((a, b) => a - b);
	const total = values.reduce((sum, value) => sum + value, 0);
	const average = total / values.length;
	const median =
		sorted.length % 2 === 1
			? sorted[(sorted.length - 1) / 2]
			: (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

	return {
		runs: values.map(round),
		minMs: round(sorted[0]),
		maxMs: round(sorted[sorted.length - 1]),
		avgMs: round(average),
		medianMs: round(median),
	};
}

async function timeAsync(fn) {
	const start = performance.now();
	const result = await fn();
	return {
		result,
		elapsedMs: performance.now() - start,
	};
}

async function benchmarkFixtureImport(name) {
	const input = readFixture(name);
	const parseDeferredRuns = [];
	const formatRuns = [];
	const combinedRuns = [];
	let entryCount = 0;

	for (let index = 0; index < RUNS; index += 1) {
		clearFormattingCache();
		const deferred = await timeAsync(() =>
			parsePastedInput(input, DEFAULT_STYLE, { deferFormatting: true })
		);
		parseDeferredRuns.push(deferred.elapsedMs);
		entryCount = deferred.result.entries.length;

		const format = await timeAsync(() =>
			Promise.resolve(
				formatBibliographyEntries(
					deferred.result.entries.map((entry) => entry.csl),
					DEFAULT_STYLE
				)
			)
		);
		formatRuns.push(format.elapsedMs);
		combinedRuns.push(deferred.elapsedMs + format.elapsedMs);
	}

	return {
		fixture: name,
		entries: entryCount,
		parseDeferred: summarize(parseDeferredRuns),
		formatBatch: summarize(formatRuns),
		combinedEditorPath: summarize(combinedRuns),
	};
}

async function benchmarkStyleSwitch(baseEntries) {
	const results = [];

	for (const styleKey of STYLE_SWITCH_SEQUENCE) {
		const runs = [];

		for (let index = 0; index < RUNS; index += 1) {
			clearFormattingCache();
			const { elapsedMs } = await timeAsync(() =>
				Promise.resolve(
					formatBibliographyEntries(
						baseEntries.map((entry) => entry.csl),
						styleKey
					)
				)
			);
			runs.push(elapsedMs);
		}

		results.push({
			styleKey,
			...summarize(runs),
		});
	}

	return results;
}

async function benchmarkManualEntry() {
	const runs = [];
	const fields = {
		...createEmptyManualEntryFields('book'),
		title: 'Benchmark Manual Entry',
		authors: 'Example, Ada',
		year: '2026',
	};

	for (let index = 0; index < RUNS; index += 1) {
		clearFormattingCache();
		const { elapsedMs } = await timeAsync(() =>
			createManualCitation(fields, DEFAULT_STYLE)
		);
		runs.push(elapsedMs);
	}

	return summarize(runs);
}

function writeOutputs(report) {
	fs.mkdirSync(outputDir, { recursive: true });
	const jsonPath = path.join(outputDir, 'latest.json');
	const markdownPath = path.join(outputDir, 'latest.md');

	fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

	const lines = [
		'# Performance benchmark report',
		'',
		`Generated: ${report.generatedAt}`,
		'',
		'## Import fixtures',
		'',
		'| Fixture | Entries | Parse deferred avg (ms) | Batch format avg (ms) | Combined editor path avg (ms) |',
		'| --- | ---: | ---: | ---: | ---: |',
	];

	for (const fixture of report.fixtures) {
		lines.push(
			`| ${fixture.fixture} | ${fixture.entries} | ${fixture.parseDeferred.avgMs} | ${fixture.formatBatch.avgMs} | ${fixture.combinedEditorPath.avgMs} |`
		);
	}

	lines.push(
		'',
		'## Style switch batch formatting',
		'',
		'| Style | Avg (ms) | Median (ms) | Min (ms) | Max (ms) |',
		'| --- | ---: | ---: | ---: | ---: |'
	);

	for (const style of report.styleSwitch) {
		lines.push(
			`| ${style.styleKey} | ${style.avgMs} | ${style.medianMs} | ${style.minMs} | ${style.maxMs} |`
		);
	}

	lines.push(
		'',
		'## Manual entry',
		'',
		`- Average add time: ${report.manualEntry.avgMs} ms`,
		`- Median add time: ${report.manualEntry.medianMs} ms`
	);
	fs.writeFileSync(markdownPath, `${lines.join('\n')}\n`);

	return { jsonPath, markdownPath };
}

const runBenchmark = process.env.RUN_PERF_BENCHMARK === '1';

(runBenchmark ? describe : describe.skip)(
	'performance benchmark harness',
	() => {
		beforeAll(() => {
			jest.setTimeout(120000);
		});

		it('records repeatable local benchmark timings', async () => {
			const fixtures = [];
			for (const fixtureName of FIXTURE_NAMES) {
				fixtures.push(await benchmarkFixtureImport(fixtureName));
			}

			const styleBase = await parsePastedInput(
				readFixture('import-freetext-50.txt'),
				DEFAULT_STYLE,
				{ deferFormatting: true }
			);

			const report = {
				generatedAt: new Date().toISOString(),
				defaults: {
					style: DEFAULT_STYLE,
					runs: RUNS,
				},
				fixtures,
				styleSwitch: await benchmarkStyleSwitch(styleBase.entries),
				manualEntry: await benchmarkManualEntry(),
			};

			const { jsonPath, markdownPath } = writeOutputs(report);

			// eslint-disable-next-line no-console
			console.log(`Wrote benchmark report to ${jsonPath}`);
			// eslint-disable-next-line no-console
			console.log(`Wrote benchmark summary to ${markdownPath}`);

			expect(report.fixtures).toHaveLength(FIXTURE_NAMES.length);
			expect(report.styleSwitch).toHaveLength(
				STYLE_SWITCH_SEQUENCE.length
			);
			expect(report.manualEntry.avgMs).toBeGreaterThanOrEqual(0);
		});
	}
);
