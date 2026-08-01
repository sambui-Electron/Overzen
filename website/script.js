document.addEventListener("DOMContentLoaded", () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('play-animation');
            } else {
                entry.target.classList.remove('play-animation');
            }
        })
    }, {
        threshold: 0.4
    });

    document.querySelectorAll('.hero, .reveal').forEach(el => observer.observe(el));

    loadGithubStars();
});

// Pulls the real, current star count straight from GitHub's public API so
// the number on the page is never stale or hand-typed. GitHub's 60/hour
// unauthenticated rate limit is per IP address, so one visitor's browser
// can't affect another visitor's - a plain fetch on page load is fine here.
// If the request fails (offline, rate-limited, etc.) the count is just
// removed and the badge quietly falls back to a plain "Star on GitHub" link.
async function loadGithubStars() {
    const badge = document.getElementById('github-star-count');
    const valueEl = document.getElementById('github-star-value');
    if (!badge || !valueEl) return;

    try {
        const response = await fetch('https://api.github.com/repos/sambui-Electron/Overzen');
        if (!response.ok) throw new Error('GitHub API error');
        const data = await response.json();

        if (typeof data.stargazers_count === 'number') {
            valueEl.textContent = data.stargazers_count.toLocaleString();
        } else {
            badge.remove();
        }
    } catch (err) {
        badge.remove();
    }
}