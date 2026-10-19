export default {
    template: `
        <main class="page-games">
            <section style="padding: 32px; max-width: 900px; margin: auto;">
                <h1>Games</h1>
                <p style="color: #aaa; margin: 12px 0 24px;">
                    Play gaem pleese ts took me too longie.
                </p>

                <div style="
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 20px;
                ">
                    <router-link
                        to="/games/roulette"
                        style="
                            display: block;
                            padding: 24px;
                            border-radius: 12px;
                            background: var(--secondary-background, #222);
                            color: inherit;
                            text-decoration: none;
                        "
                    >
                        <h2>Roulette</h2>
                        <p style="margin-top: 12px;">
                            Test your skill with a roulettettettete.
                        </p>
                    </router-link>
                </div>
            </section>
        </main>
    `,
};
