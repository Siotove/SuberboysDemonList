
export const PACK_CATEGORIES = [
    'Bronze',
    'Silver',
    'Gold',
    'Diamond',
    'Platinum',
];
export const PACK_DEFINITIONS = [
    {
        id: 'milestone-pack',
        name: 'Milestone Trilogy',
        category: 'Bronze',
        bonus: 100,
        levelPaths: ['MilestoneI', 'MilestoneII', 'MilestoneIII'],
    },
    {
        id: 'aina-pack',
        name: 'Aina Poni Bros',
        category: 'Bronze',
        bonus: 150,
        levelPaths: ['AinaPoni', 'AinaPoniII'],
    },
    {
        id: 'polychromatical-pack',
        name: 'Polychromaticalis',
        category: 'Silver',
        bonus: 200,
        levelPaths: ['Polychromatical', 'PolychromaticalII'],
    },
    {
        id: 'sadaclysm-pack',
        name: 'Sadaclysm Versions',
        category: 'Silver',
        bonus: 250,
        levelPaths: ['Sadaclysm', 'USadaclysm'],
    },
    {
        id: 'top-pack',
        name: 'Top 1 Pack 1',
        category: 'Gold',
        bonus: 300,
        levelPaths: ['SocietyButNo3','Polychromatical','MilestoneIII','NGWave'],
    },
];

/* Gold */
.category-gold {
    background-color: #f2c94c;
    color: #493600;
    border-color: #d4a72c;
}

/* Diamond */
.category-diamond {
    background-color: #a8e8f0;
    color: #124b59;
    border-color: #64cbdc;
}

/* Platinum */
.category-platinum {
    background-color: #d8c8f0;
    color: #422b62;
    border-color: #b69cdb;
}
