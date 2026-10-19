
export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === "/api/test") {
            return Response.json({
                success: true,
                message: "Suberboys backend is running!"
            });
        }

        return env.ASSETS.fetch(request);
    }
};
