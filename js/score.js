/**
 * Numbers of decimal digits to round to
 */
const scale = 3;

/**
 * Calculate the score awarded for a percentage on a list level.
 * Rank 1 = 500 points
 * Rank 150 = 1 point
 *
 * @param {Number} rank Position on the list (1-150)
 * @param {Number} percent Percentage of completion
 * @param {Number} minPercent Minimum percentage required
 * @returns {Number}
 */
export function score(rank, percent, minPercent) {
    if (rank < 1 || rank > 150) {
        return 0;
    }

    if (rank > 75 && percent < 100) {
        return 0;
    }

    let rankPoints;

    if (rank <= 25) {
        // Rank 1 = 1000, rank 25 = 250
        rankPoints = 1000 - ((rank - 1) * 750 / 24);
    } else if (rank <= 50) {
        // Rank 25 = 250, rank 50 = 100
        rankPoints = 250 - ((rank - 25) * 150 / 25);
    } else if (rank <= 75) {
        // Rank 50 = 100, rank 75 = 50
        rankPoints = 100 - ((rank - 50) * 50 / 25);
    } else {
        // Rank 75 = 50, rank 150 = 1
        rankPoints = 50 - ((rank - 75) * 49 / 75);
    }

    const percentMultiplier =
        (percent - (minPercent - 1)) /
        (100 - (minPercent - 1));

    return Math.max(round((rankPoints * percentMultiplier) / 4), 0);
}

export function round(num) {
    if (!('' + num).includes('e')) {
        return +(Math.round(num + 'e+' + scale) + 'e-' + scale);
    } else {
        const arr = ('' + num).split('e');
        let sig = '';

        if (+arr[1] + scale > 0) {
            sig = '+';
        }

        return +(
            Math.round(+arr[0] + 'e' + sig + (+arr[1] + scale)) +
            'e-' +
            scale
        );
    }
}
