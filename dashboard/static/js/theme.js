document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    const appLogo = document.getElementById('app-logo');

    const logoClair = appLogo ? appLogo.getAttribute('data-logo-clair') : '';
    const logoSombre = appLogo ? appLogo.getAttribute('data-logo-sombre') : '';

    // Function to set theme
    function setTheme(theme) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem('carburflow_theme', theme);

        if (theme === 'dark') {
            if (themeIcon) themeIcon.className = 'bi bi-moon-stars-fill text-warning';
            if (themeText) themeText.textContent = 'Mode Sombre';
            if (appLogo && logoSombre) appLogo.src = logoSombre;
        } else {
            if (themeIcon) themeIcon.className = 'bi bi-sun-fill text-warning';
            if (themeText) themeText.textContent = 'Mode Clair';
            if (appLogo && logoClair) appLogo.src = logoClair;
        }
    }

    // Saved theme or default to dark
    const savedTheme = localStorage.getItem('carburflow_theme') || 'dark';
    setTheme(savedTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-bs-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
        });
    }
});
