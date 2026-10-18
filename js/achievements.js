
export const ACHIEVEMENTS = [
    // Level completion achievements
    {
        id: 'complete-1',
        name: 'First Goaaal Messi',
        description: 'Complete 1 level.',
        tier: 'Bronze',
        requirement: 'Complete 1 level',
    },
    {
        id: 'complete-5',
        name: 'i got this',
        description: 'Complete 5 levels.',
        tier: 'Silver',
        requirement: 'Complete 5 levels',
    },
    {
        id: 'complete-10',
        name: 'Im so cool!',
        description: 'Complete 10 levels.',
        tier: 'Silver',
        requirement: 'Complete 10 levels',
    },
    {
        id: 'complete-25',
        name: 'Level Mazter',
        description: 'Complete 25 levels.',
        tier: 'Gold',
        requirement: 'Complete 25 levels',
    },
    {
        id: 'complete-75',
        name: 'DemonSlayerTanjiro',
        description: 'Complete 75 levels.',
        tier: 'Diamond',
        requirement: 'Complete 75 levels',
    },
    {
        id: 'complete-150',
        name: 'Give Up',
        description: 'Complete 150 levels.',
        tier: 'Platinum',
        requirement: 'Complete 150 levels',
    },

    // Pack completion achievements
    {
        id: 'pack-1',
        name: 'Pack Victor',
        description: 'Complete 1 pack.',
        tier: 'Silver',
        requirement: 'Complete 1 pack',
    },
    {
        id: 'pack-5',
        name: 'Pack Collector',
        description: 'Complete 5 packs.',
        tier: 'Gold',
        requirement: 'Complete 5 packs',
    },
    {
        id: 'pack-10',
        name: 'Packzzzz',
        description: 'Complete 10 packs.',
        tier: 'Diamond',
        requirement: 'Complete 10 packs',
    },
    {
        id: 'gold-pack',
        name: 'Golden Hour',
        description: 'Complete a Gold pack.',
        tier: 'Gold',
        requirement: 'Complete 1 Gold pack',
    },
    {
        id: 'diamond-pack',
        name: 'TDiamond',
        description: 'Complete a Diamond pack.',
        tier: 'Diamond',
        requirement: 'Complete 1 Diamond pack',
    },
    {
        id: 'platinum-pack',
        name: 'Platinum Victor',
        description: 'Complete a Platinum pack.',
        tier: 'Platinum',
        requirement: 'Complete 1 Platinum pack',
    },
    {
        id: 'platinum-packs-5',
        name: 'Zoinkie',
        description: 'Complete 5 Platinum packs.',
        tier: 'Legendary',
        requirement: 'Complete 5 Platinum packs',
    },

    // Verification achievements
    {
        id: 'verify-1',
        name: 'First Verification',
        description: 'Verify 1 level.',
        tier: 'Silver',
        requirement: 'Verify 1 level',
    },
    {
        id: 'verify-10',
        name: 'Trusted Verifier',
        description: 'Verify 10 levels.',
        tier: 'Gold',
        requirement: 'Verify 10 levels',
    },
    {
        id: 'verify-25',
        name: 'Guys chip in',
        description: 'Verify 25 levels.',
        tier: 'Diamond',
        requirement: 'Verify 25 levels',
    },
    {
        id: 'verify-100',
        name: 'List Changed',
        description: 'Verify 100 levels.',
        tier: 'Platinum',
        requirement: 'Verify 100 levels',
    },

    // Achievement collection
    {
        id: 'achievements-10',
        name: 'Achievement Hunter',
        description: 'Unlock 10 achievements.',
        tier: 'Gold',
        requirement: 'Unlock 10 achievements',
    },

    // Progress achievements
    {
        id: 'progress-1',
        name: 'Making Progress',
        description: 'Make progress on 1 level.',
        tier: 'Bronze',
        requirement: 'Progress on 1 level',
    },
    {
        id: 'progress-10',
        name: 'Just Beat Them',
        description: 'Make progress on 10 levels.',
        tier: 'Silver',
        requirement: 'Progress on 10 levels',
    },
    {
        id: 'progress-50',
        name: 'Progressor',
        description: 'Make progress on 50 levels.',
        tier: 'Gold',
        requirement: 'Progress on 50 levels',
    },
];

export function getAchievements(player) {
    const completedCount = new Set(
        player.completed.map(level => level.path)
    ).size;

    const verifiedCount = new Set(
        player.verified.map(level => level.path)
    ).size;

    const progressedCount = new Set(
        player.progressed.map(level => level.path)
    ).size;

    const packs = player.packsBeaten || [];
    const packsBeatenCount = packs.length;

    const completedPackCategories = new Set(
        packs.map(pack => pack.category)
    );

    const platinumPacksCount = packs.filter(
        pack => pack.category === 'Platinum'
    ).length;

    const unlockedAchievements = ACHIEVEMENTS.filter(achievement => {
        switch (achievement.id) {
            case 'complete-1':
                return completedCount >= 1;
            case 'complete-5':
                return completedCount >= 5;
            case 'complete-10':
                return completedCount >= 10;
            case 'complete-25':
                return completedCount >= 25;
            case 'complete-75':
                return completedCount >= 75;
            case 'complete-150':
                return completedCount >= 150;

            case 'pack-1':
                return packsBeatenCount >= 1;
            case 'pack-5':
                return packsBeatenCount >= 5;
            case 'pack-10':
                return packsBeatenCount >= 10;
            case 'gold-pack':
                return completedPackCategories.has('Gold');
            case 'diamond-pack':
                return completedPackCategories.has('Diamond');
            case 'platinum-pack':
                return completedPackCategories.has('Platinum');
            case 'platinum-packs-5':
                return platinumPacksCount >= 5;

            case 'verify-1':
                return verifiedCount >= 1;
            case 'verify-10':
                return verifiedCount >= 10;
            case 'verify-25':
                return verifiedCount >= 25;
            case 'verify-100':
                return verifiedCount >= 100;

            case 'progress-1':
                return progressedCount >= 1;
            case 'progress-10':
                return progressedCount >= 10;
            case 'progress-50':
                return progressedCount >= 50;

            default:
                return false;
        }
    });

    const achievementHunterUnlocked =
        unlockedAchievements.length >= 10;

    return ACHIEVEMENTS.map(achievement => {
        let unlocked = unlockedAchievements.some(
            item => item.id === achievement.id
        );

        if (achievement.id === 'achievements-10') {
            unlocked = achievementHunterUnlocked;
        }

        return { ...achievement, unlocked };
    });
}
