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
});