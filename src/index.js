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
