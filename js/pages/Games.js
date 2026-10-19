
export default {
    template: `
        <main class="games-page">
            <header class="games-hero">
                <span class="games-eyebrow">THE ARCADE</span>
                <h1>Games</h1>
                <p>
                    Take a break from the list.
                    just play idk.
                </p>
            </header>

            <section class="games-section">
                <div class="games-section-heading">
                    <h2>Choose your game</h2>
                    <span>2 GAMES</span>
                </div>

                <div class="games-grid">
                    <router-link
                        class="game-card roulette-card"
                        to="/games/roulette"
                    >
                        <div class="game-card-top">
                            <span class="game-number">GAME 01</span>
                            <span class="game-icon">🎲</span>
                        </div>

                        <div class="game-card-content">
                            <h3>Roulette</h3>
                            <p>
                                Face random demons and reach each
                                percentage target to keep your run alive.
                            </p>
                        </div>

                        <div class="game-card-bottom">
                            <span>Progression challenge</span>
                            <span class="game-play">
                                Play now <span aria-hidden="true">↗</span>
                            </span>
                        </div>
                    </router-link>

                    <router-link
                        class="game-card higher-card"
                        to="/games/higher-lower"
                    >
                        <div class="game-card-top">
                            <span class="game-number">GAME 02</span>
                            <span class="game-icon">⚔️</span>
                        </div>

                        <div class="game-card-content">
                            <h3>Higher or Lower</h3>
                            <p>
                                Which demon is harder? Trust your knowledge
                                and see how long you can keep your streak.
                            </p>
                        </div>

                        <div class="game-card-bottom">
                            <span>Knowledge challenge</span>
                            <span class="game-play">
                                Play now <span aria-hidden="true">↗</span>
                            </span>
                        </div>
                    </router-link>
                </div>
            </section>

            <footer class="games-footer">
                More games are on za way.
            </footer>
        </main>
    `,
};
