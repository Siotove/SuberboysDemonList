
export default {
    template: `
        <main class="page-games">
            <section class="games-content">
                <h1>Games</h1>
                <p class="games-description">
                    Choose a game and customise its rules before starting.
                </p>

                <div class="games-grid">
                    <router-link class="game-card" to="/games/roulette">
                        <h2>Roulette</h2>
                        <p>
                            Beat percentage targets with random demons.
                        </p>
                        <span class="game-card-link">Play Roulette →</span>
                    </router-link>

                    <router-link
                        class="game-card"
                        to="/games/higher-lower"
                    >
                        <h2>Higher or Lower</h2>
                        <p>
                            Pick the harder demon and build your streak.
                        </p>
                        <span class="game-card-link">Play Higher or Lower →</span>
                    </router-link>
                </div>
            </section>
        </main>
    `,
};
