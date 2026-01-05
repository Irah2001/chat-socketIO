const root = document.documentElement

function applyTheme(theme) {
    root.classList.remove('theme-light', 'theme-dark')
    root.classList.add(theme)
}

function initTheme() {
    const stored = localStorage.getItem('theme')

    if (stored) {
        applyTheme(stored)
        return
    }

    // Détection automatique initiale
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    applyTheme(prefersDark ? 'theme-dark' : 'theme-light')
}

function toggleTheme() {
    const current = root.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light'
    const next = current === 'theme-dark' ? 'theme-light' : 'theme-dark'

    applyTheme(next)
    localStorage.setItem('theme', next)

    updateToggleText(next)
}

function updateToggleText(theme) {
    const btn = document.getElementById('theme-toggle')
    if (btn) {
        btn.textContent = theme === 'theme-dark' ? 'Mode clair' : 'Mode sombre'
    }
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    initTheme()
    const theme = root.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light'
    updateToggleText(theme)
})
