export default {
    name: 'Home',
    template: `
        <main class="sbdl-home">
            <section class="sbdl-home__hero">
                <div class="sbdl-home__hero-copy">
                    <p class="sbdl-home__eyebrow"><span aria-hidden="true"></span> SUBERBOYS DEMONLIST</p>
                    <h1>Welcome to the <em>SBDL.</em></h1>
                    <p class="sbdl-home__intro">A list for the hardest Geometry Dash demons made by the Suberboys community. Explore the rankings, check player points, and find your next challenge.</p>
                    <div class="sbdl-home__actions">
                        <router-link class="sbdl-home__button sbdl-home__button--primary" to="/">Browse the Demon List <span aria-hidden="true">→</span></router-link>
                        <router-link class="sbdl-home__button sbdl-home__button--secondary" to="/leaderboard">Player leaderboard</router-link>
                    </div>
                </div>
                <div class="sbdl-home__mark" aria-hidden="true">
                    <div class="sbdl-home__mark-inner"><span>S</span></div>
                    <p>SUBERBOYS<br>DEMONLIST</p>
                </div>
            </section>
            <section class="sbdl-home__section" aria-labelledby="sbdl-home-explore-title">
                <p class="sbdl-home__kicker">EXPLORE SBDL</p>
                <h2 id="sbdl-home-explore-title">Everything starts here.</h2>
                <p class="sbdl-home__section-intro">Jump into the list, check the leaderboard, or explore more of the community features.</p>
                <div class="sbdl-home__cards">
                    <router-link class="sbdl-home__card" to="/">
                        <span class="sbdl-home__card-icon" aria-hidden="true">▤</span>
                        <h3>Demon List <span aria-hidden="true">↗</span></h3>
                        <p>Browse the ranked levels and see which demons make the list.</p>
                    </router-link>
                    <router-link class="sbdl-home__card" to="/leaderboard">
                        <span class="sbdl-home__card-icon" aria-hidden="true">♜</span>
                        <h3>Leaderboard <span aria-hidden="true">↗</span></h3>
                        <p>Explore player rankings and points earned across SBDL.</p>
                    </router-link>
                    <router-link class="sbdl-home__card" to="/history">
                        <span class="sbdl-home__card-icon" aria-hidden="true">◷</span>
                        <h3>List History <span aria-hidden="true">↗</span></h3>
                        <p>Look back through previous rankings and changes to the list.</p>
                    </router-link>
                    <router-link class="sbdl-home__card" to="/packs">
                        <span class="sbdl-home__card-icon" aria-hidden="true">▦</span>
                        <h3>Level Packs <span aria-hidden="true">↗</span></h3>
                        <p>Find packs and challenges to work through.</p>
                    </router-link>
                    <router-link class="sbdl-home__card" to="/achievements">
                        <span class="sbdl-home__card-icon" aria-hidden="true">✦</span>
                        <h3>Achievements <span aria-hidden="true">↗</span></h3>
                        <p>See milestones and achievements available on the site.</p>
                    </router-link>
                    <router-link class="sbdl-home__card" to="/games">
                        <span class="sbdl-home__card-icon" aria-hidden="true">◈</span>
                        <h3>Games <span aria-hidden="true">↗</span></h3>
                        <p>Take a break with the SBDL mini-games.</p>
                    </router-link>
                </div>
            </section>
        </main>
    `,
};
