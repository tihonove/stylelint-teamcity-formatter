import fs from 'fs';

const reportName = 'Stylelint';

function escapeTeamCityString(str) {
    if (!str) {
        return '';
    }

    return str.replace(/\|/g, '||')
        .replace(/\'/g, '|\'')
        .replace(/\n/g, '|n')
        .replace(/\r/g, '|r')
        .replace(/\u0085/g, '|x') // TeamCity 6
        .replace(/\u2028/g, '|l') // TeamCity 6
        .replace(/\u2029/g, '|p') // TeamCity 6
        .replace(/\[/g, '|[')
        .replace(/\]/g, '|]');
}

function groupBy(array, propertyPicker) {
    const groups = {};
    array.forEach(item => {
        const groupKey = JSON.stringify(propertyPicker(item));
        groups[groupKey] = groups[groupKey] || [];
        groups[groupKey].push(item);
    });
    return Object.keys(groups).map(group => groups[group]);
}

export default function teamcityFormatter(allResults) {
    const packageJsonConfig = loadPackageJsonConfig();
    const outputType = packageJsonConfig.output || process.env.STYLELINT_TEAMCITY_FORMATTER_OUTPUT || "inspections";
    let output = '';
    if (outputType === "errors") {
        output = formatAsErrors(allResults);
    } else {
        output = formatAsInspections(allResults);
    }

    if (packageJsonConfig.statistics) {
        const { errors, warnings } = calculateStats(allResults);
        const statsLines = [
            `##teamcity[buildStatisticValue key='stylelint.errors' value='${errors}']`,
            `##teamcity[buildStatisticValue key='stylelint.warnings' value='${warnings}']`
        ];
        output = [output, ...statsLines].filter(Boolean).join('\n');
    }

    return output;
}

function formatAsInspections(allResults) {
    const output = [];

    allResults.forEach(x => {
        x.source = x.source.replace(process.cwd(), '').replace(/^\\/, '');
    });

    const groupedResults = groupBy(allResults, x => x.source);
    const reportedRules = new Set();

    for (const results of groupedResults) {
        if (results.reduce((x, y) => x || y.errored, false)) {

            for (let result of results) {
                for (let warning of result.warnings) {
                    if (!reportedRules.has(warning.rule)) {
                        reportedRules.add(warning.rule);
                        output.push(
                            `##teamcity[inspectionType ` +
                            `id='${escapeTeamCityString(warning.rule)}' ` +
                            `name='${escapeTeamCityString(warning.rule)}' ` +
                            `description='<a href="${escapeTeamCityString("https://stylelint.io/user-guide/rules/" + warning.rule)}">${escapeTeamCityString(warning.rule)}</a>' ` +
                            `category='Stylelint rules violations']`
                        );

                    }

                    output.push(
                        `##teamcity[inspection typeId='${escapeTeamCityString(warning.rule)}' ` +
                        `message='${escapeTeamCityString(warning.text)}' ` +
                        `file='${escapeTeamCityString(results[0].source)}' ` +
                        `line='${warning.line}' ` +
                        `SEVERITY='${warning.severity ? warning.severity.toUpperCase() : "ERROR"}']`
                    );
                }
            }
        }
    }

    return output.join('\n');
}

function formatAsErrors(allResults) {
    const output = [];

    allResults.forEach(x => {
        x.source = x.source.replace(process.cwd(), '').replace(/^\\/, '');
    });

    output.push(`##teamcity[testSuiteStarted name='${reportName}']`);

    const groupedResults = groupBy(allResults, x => x.source);

    for (const results of groupedResults) {
        const testNameEscaped = reportName + ': ' + escapeTeamCityString(results[0].source);

        output.push(`##teamcity[testStarted name='${testNameEscaped}']`);

        if (results.reduce((x, y) => x || y.errored, false)) {
            const message = results
                .map(result => result.warnings
                    .map(warning => `${warning.text} at (${warning.line}, ${warning.column})`)
                    .join('\n'))
                .join('\n');

            output.push(
                `##teamcity[testFailed name='${testNameEscaped}'` +
                ` message='${escapeTeamCityString(message)}']`);
        }

        output.push(`##teamcity[testFinished name='${testNameEscaped}']`);
    }

    output.push(`##teamcity[testSuiteFinished name='${reportName}']`);

    return output.join('\n');
}

function calculateStats(allResults) {
    let errors = 0;
    let warnings = 0;
    for (const result of allResults) {
        for (const w of result.warnings || []) {
            const sev = (w.severity || 'error').toString().toLowerCase();
            if (sev === 'warning') warnings++; else errors++;
        }
    }
    return { errors, warnings };
}

function loadPackageJsonConfig() {
    try {
        const packageJson = JSON.parse(fs.readFileSync("package.json"));
        return packageJson["stylelint-teamcity-formatter"] || {};
    } catch (e) {
        return {};
    }
}