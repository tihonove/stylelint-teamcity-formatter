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

const reportName = 'StyleLint Violations';

export default function teamcityFormatter(allResults) {
    allResults.forEach(x => {
        x.source = x.source.replace(process.cwd(), '').replace(/^\\/, '');
    });
    console.log(`##teamcity[testSuiteStarted name='${reportName}']`);
    const groupedResults = groupBy(allResults, x => x.source);

    for (const results of groupedResults) {
        const testNameEscaped = reportName + ': ' + escapeTeamCityString(results[0].source);
        console.log(`##teamcity[testStarted name='${testNameEscaped}']`);
        if (results.reduce((x, y) => x || y.errored, false)) {
            const message = results
                .map(result => result.warnings
                    .map(warning => `${warning.text} at (${warning.line}, ${warning.column})`)
                    .join('\n'))
                .join('\n');
            console.log(
                `##teamcity[testFailed name='${testNameEscaped}'` +
                ` message='${escapeTeamCityString(message)}']`);
        }
        console.log(`##teamcity[testFinished name='${testNameEscaped}']`);
    }
    console.log(`##teamcity[testSuiteFinished name='${reportName}']`);
}
