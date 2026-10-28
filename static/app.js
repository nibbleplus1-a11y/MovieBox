/**
 * CineScope Cinema — v3.0 Client Logic
 * Modern, adaptive cinema streaming with multi-audio dubs and 1080p player
 */

// ─── STATE ─────────────────────────────────────────────────────────────────
let currentTab = 'home';
let moviesPage = 1;
let moviesSort = 'RECOMMEND';
let currentMovieCategory = 'all';
let moviesGenreFilter = 'ALL';
let seriesPage = 1;
let seriesSort = 'RECOMMEND';
let currentSeriesCategory = 'all';

let activeStreamList = [];
let activeCaptionList = [];
let activeDubsList = [];
let currentTitleDubs = [];  // Persistent dubs for currently loaded title
let activeFallbackServers = [];
let currentSelectedServer = 'direct';
let activeMediaMeta = null;
let currentPlayingStream = null;
let currentPlayingSubjectId = '';
let currentSeason = 0;
let currentEpisode = 0;
let currentPlaybackMode = 'proxy';
let activeDetailItem = null;

let nextEpTimer = null;
let nextEpSecondsLeft = 5;

let plyrInstance = null;
let hlsInstance = null;

function safeText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function safeAttr(id, attr, val) {
    const el = document.getElementById(id);
    if (el) el[attr] = val;
}

// ─── HERO CAROUSEL DATA (Verified 2026 / 1080p Cinema with HD Posters) ──────
const HERO_SLIDES = [
    {
        title: 'Sacrifice [Hindi]',
        subject_id: '5244918809701544168',
        rating: '7.5',
        year: '2026',
        genre: 'Action • Thriller • Crime',
        desc: 'A gripping race against time where past choices collide with life-or-death decisions. Multi-language dubs available in Hindi, Tamil, Telugu, and Original Audio.',
        backdrop: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1920&q=80&fit=crop',
        cover: 'https://pbcdn.aoneroom.com/image/2026/10/18/c256143681ae74820d09386ea5c6372f.jpg',
        type: 'Movie'
    },
    {
        title: 'Masterplan [Hindi]',
        subject_id: '5774857026010610896',
        rating: '7.0',
        year: '2026',
        genre: 'Action • Drama • Suspense',
        desc: 'A mastermind pulls off an intricate heist that turns the tables on both the authorities and the syndicate. Stream in 1080p Ultra HD.',
        backdrop: 'https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=1920&q=80&fit=crop',
        cover: 'https://pbcdnw.aoneroom.com/image/2026/10/12/f2a6e0c0317e0b5774ff05178652d3a3.jpg',
        type: 'Movie'
    },
    {
        title: 'Prahaar: The Untold Story',
        subject_id: '2652252799219691752',
        rating: '6.8',
        year: '2026',
        genre: 'Biography • Drama • Courtroom',
        desc: 'The courtroom saga chronicling the relentless pursuit of justice by legendary special public prosecutor Ujjwal Nikam.',
        backdrop: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80&fit=crop',
        cover: 'https://pbcdn.aoneroom.com/image/2026/10/12/74cf309e3ba0cbfbc247fc23fc7b4697.jpg',
        type: 'Movie'
    },
    {
        title: 'Inception',
        subject_id: '6391474290696802080',
        rating: '8.8',
        year: '2010',
        genre: 'Sci-Fi • Action • Thriller',
        desc: 'A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.',
        backdrop: 'https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=1920&q=80&fit=crop',
        cover: 'https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_SX500.jpg',
        type: 'Movie'
    }
];

let currentHeroIndex = 0;
let heroCarouselTimer = null;

// ─── API ENDPOINTS DOCS ─────────────────────────────────────────────────────
const API_ENDPOINTS = [
    { method: 'GET', path: '/api/feed/home-curated', desc: 'Curated fresh shelves (Trending, Cinema, Hollywood, Series)', example: '/api/feed/home-curated' },
    { method: 'GET', path: '/api/stream/{id}', desc: 'Extract 1080p/720p/480p signed MP4 & DASH streams', example: '/api/stream/5244918809701544168' },
    { method: 'GET', path: '/api/stream/{id}/captions', desc: 'Multi-language SRT subtitle URLs', example: '/api/stream/5244918809701544168/captions' },
    { method: 'GET', path: '/detail/{id}', desc: 'Metadata, synopsis, genres, dubs breakdown', example: '/detail/5244918809701544168' },
    { method: 'GET', path: '/episodes/{id}', desc: 'TV Series season & episode breakdowns', example: '/episodes/6207982430134357800' },
    { method: 'GET', path: '/search?q={query}&page=1', desc: 'Keyword search with ratings & posters', example: '/search?q=Inception' },
    { method: 'GET', path: '/search/suggest?q={query}', desc: 'Live debounced autocomplete suggestions', example: '/search/suggest?q=Avatar' },
    { method: 'GET', path: '/movies?page=1&per_page=24&category=all', desc: 'Filtered movie catalog (categorized by Hollywood/Bollywood/Cinema)', example: '/movies?page=1&per_page=6&category=hollywood' },
    { method: 'GET', path: '/tv-series?page=1&per_page=24', desc: 'Paginated TV series catalog', example: '/tv-series?page=1&per_page=6' },
    { method: 'GET', path: '/api/proxy/stream?url={signed_url}', desc: 'HTTP Range proxy with anti-hotlink bypass', example: '/api/proxy/stream' },
    { method: 'GET', path: '/api/proxy/caption?url={srt_url}', desc: 'SRT → WebVTT subtitle converter proxy', example: '/api/proxy/caption' }
];

// ─── 💰 AD MONETIZATION ENGINE (Monetag + Adsterra + Frequency Capping) ────────
const AdEngine = {
    config: {
        enabled: true,
        test_mode: true,
        monetag: {
            enabled: true,
            zone_id: '',
            direct_link: '',
            preroll_enabled: true,
            preroll_duration_seconds: 5,
            preroll_cooldown_seconds: 60,
            exit_interstitial_enabled: true,
            exit_cooldown_seconds: 15
        },
        adsterra: {
            enabled: true,
            social_bar_enabled: true,
            social_bar_script_url: '',
            native_banner_enabled: true
        }
    },
    prerollTimer: null,
    prerollSecondsLeft: 5,
    playbackStartTime: 0,
    onPrerollCompleteCallback: null,

    async init() {
        try {
            const res = await fetch('/api/ads/config');
            if (res.ok) {
                this.config = await res.json();
            }
        } catch (e) {
            console.warn('AdEngine: Could not fetch config, using local defaults', e);
        }

        // Initialize Adsterra Social Bar if enabled
        if (this.config.enabled && this.config.adsterra && this.config.adsterra.social_bar_enabled) {
            setTimeout(() => this.showSocialBar(), 3500);
        }

        // Initialize In-Feed Native Banner if enabled
        if (this.config.enabled && this.config.adsterra && this.config.adsterra.native_banner_enabled) {
            const banner = document.getElementById('inFeedAdBanner');
            if (banner) banner.style.display = 'block';
        }
    },

    canShowPreroll() {
        if (!this.config || !this.config.enabled) return false;
        if (!this.config.monetag || !this.config.monetag.preroll_enabled) return false;

        const cooldown = (this.config.monetag.preroll_cooldown_seconds || 300) * 1000;
        const lastPreroll = parseInt(localStorage.getItem('cinescope_last_preroll_time') || '0', 10);
        const now = Date.now();

        // If cooldown has not elapsed, skip preroll to keep UX snappy
        if (now - lastPreroll < cooldown) {
            return false;
        }

        return true;
    },

    runPrerollIfEligible(onComplete) {
        this.playbackStartTime = Date.now();
        if (!this.canShowPreroll()) {
            if (typeof onComplete === 'function') onComplete();
            return;
        }

        const overlay = document.getElementById('cinemaPrerollOverlay');
        if (!overlay) {
            if (typeof onComplete === 'function') onComplete();
            return;
        }

        this.onPrerollCompleteCallback = onComplete;
        const totalDuration = (this.config.monetag && this.config.monetag.preroll_duration_seconds) || 5;
        this.prerollSecondsLeft = totalDuration;

        // Record timestamp for frequency capping
        localStorage.setItem('cinescope_last_preroll_time', Date.now().toString());

        // Setup UI
        const skipBtn = document.getElementById('prerollSkipBtn');
        const timerText = document.getElementById('prerollTimerText');
        const progressBar = document.getElementById('prerollProgressBar');

        if (skipBtn) {
            skipBtn.disabled = true;
            skipBtn.classList.remove('can-skip');
            skipBtn.textContent = `Skip in ${this.prerollSecondsLeft}s`;
        }
        if (timerText) timerText.textContent = `Movie starts in ${this.prerollSecondsLeft}s`;
        if (progressBar) progressBar.style.width = '0%';

        // Setup Ad Sponsor Link
        const adLink = document.getElementById('prerollAdLink');
        if (adLink && this.config.monetag && this.config.monetag.direct_link) {
            adLink.href = this.config.monetag.direct_link;
        }

        overlay.style.display = 'flex';

        // Clear any existing timer
        if (this.prerollTimer) clearInterval(this.prerollTimer);

        let elapsedTenths = 0;
        const totalTenths = totalDuration * 10;

        this.prerollTimer = setInterval(() => {
            elapsedTenths++;
            const pct = Math.min(100, (elapsedTenths / totalTenths) * 100);
            if (progressBar) progressBar.style.width = `${pct}%`;

            if (elapsedTenths % 10 === 0) {
                this.prerollSecondsLeft--;
                if (this.prerollSecondsLeft > 0) {
                    if (skipBtn && !skipBtn.classList.contains('can-skip')) {
                        skipBtn.textContent = `Skip in ${this.prerollSecondsLeft}s`;
                    }
                    if (timerText) timerText.textContent = `Movie starts in ${this.prerollSecondsLeft}s`;
                } else {
                    // Timer finished, allow skip or auto-proceed
                    if (skipBtn) {
                        skipBtn.disabled = false;
                        skipBtn.classList.add('can-skip');
                        skipBtn.textContent = 'Skip Ad ⏭';
                    }
                    if (timerText) timerText.textContent = 'Ready to stream!';
                    clearInterval(this.prerollTimer);
                    this.prerollTimer = null;
                    // Auto-start after a brief pause if user hasn't clicked skip
                    setTimeout(() => {
                        this.dismissPreroll();
                    }, 800);
                }
            }
        }, 100);
    },

    dismissPreroll() {
        if (this.prerollTimer) {
            clearInterval(this.prerollTimer);
            this.prerollTimer = null;
        }
        const overlay = document.getElementById('cinemaPrerollOverlay');
        if (overlay) overlay.style.display = 'none';

        if (typeof this.onPrerollCompleteCallback === 'function') {
            const cb = this.onPrerollCompleteCallback;
            this.onPrerollCompleteCallback = null;
            cb();
        }
    },

    canShowExitInterstitial() {
        if (!this.config || !this.config.enabled) return false;
        if (!this.config.monetag || !this.config.monetag.exit_interstitial_enabled) return false;

        const lastExit = parseInt(localStorage.getItem('cinescope_last_exit_ad_time') || '0', 10);
        const now = Date.now();

        // In test mode, allow exit ads to appear without long cooldown lockout
        if (this.config.test_mode) {
            if (now - lastExit < 1500) return false; // 1.5s debounce
            return true;
        }

        const cooldown = (this.config.monetag.exit_cooldown_seconds || 60) * 1000;
        if (now - lastExit < cooldown) {
            return false;
        }

        return true;
    },

    showExitInterstitial() {
        if (!this.canShowExitInterstitial()) return;

        localStorage.setItem('cinescope_last_exit_ad_time', Date.now().toString());
        const modal = document.getElementById('exitInterstitialModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }
    },

    closeExitInterstitial() {
        const modal = document.getElementById('exitInterstitialModal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    },

    showSocialBar() {
        if (sessionStorage.getItem('cinescope_social_bar_dismissed')) return;
        const bar = document.getElementById('adsterraSocialBar');
        if (bar) bar.style.display = 'flex';
    },

    dismissSocialBar() {
        sessionStorage.setItem('cinescope_social_bar_dismissed', 'true');
        const bar = document.getElementById('adsterraSocialBar');
        if (bar) bar.style.display = 'none';
    }
};

window.skipPrerollAd = () => AdEngine.dismissPreroll();
window.closeExitInterstitial = () => AdEngine.closeExitInterstitial();
window.dismissSocialBar = (e) => {
    if (e) e.stopPropagation();
    AdEngine.dismissSocialBar();
};

// ─── INIT ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const safeRun = (fn, name) => {
        try { fn(); } catch (err) { console.warn(`Error running ${name}:`, err); }
    };
    safeRun(initNavigation, 'initNavigation');
    safeRun(initGlobalSearch, 'initGlobalSearch');
    safeRun(initPlyr, 'initPlyr');
    safeRun(initHeroCarousel, 'initHeroCarousel');
    safeRun(renderContinueWatching, 'renderContinueWatching');
    safeRun(loadHomeFeed, 'loadHomeFeed');
    safeRun(renderApiPlayground, 'renderApiPlayground');
    safeRun(updateWatchlistBadge, 'updateWatchlistBadge');
    safeRun(initKeyboardShortcuts, 'initKeyboardShortcuts');
    safeRun(renderRecentSearchChips, 'renderRecentSearchChips');
    safeRun(() => AdEngine.init(), 'AdEngine.init');
});

// ─── MOBILE NAV ─────────────────────────────────────────────────────────────
function toggleMobileNav() {
    const nav = document.getElementById('mainNavLinks');
    if (nav) nav.classList.toggle('mobile-open');
}

// ─── TAB SWITCHING ───────────────────────────────────────────────────────────
function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const nav = document.getElementById('mainNavLinks');
    if (nav) nav.classList.remove('mobile-open');

    const pane = document.getElementById(`tab-${tabId}`);
    if (pane) pane.classList.add('active');

    const btn = document.getElementById(`tabBtn-${tabId}`);
    if (btn) btn.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tabId === 'movies' && !document.getElementById('moviesCatalogGrid').dataset.loaded) {
        loadMovies(1);
    } else if (tabId === 'series' && !document.getElementById('seriesCatalogGrid').dataset.loaded) {
        loadTVSeries(1);
    } else if (tabId === 'watchlist') {
        renderWatchlistGrid();
    }
}

function initNavigation() {
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            const si = document.getElementById('globalSearchInput');
            if (si) { si.focus(); si.select(); }
        }
    });
}

// ─── HERO CAROUSEL ───────────────────────────────────────────────────────────
function initHeroCarousel() {
    renderHeroSlide(0);
    heroCarouselTimer = setInterval(() => {
        currentHeroIndex = (currentHeroIndex + 1) % HERO_SLIDES.length;
        renderHeroSlide(currentHeroIndex);
    }, 8000);
}

function switchHeroSlide(index) {
    clearInterval(heroCarouselTimer);
    currentHeroIndex = index;
    renderHeroSlide(index);
    heroCarouselTimer = setInterval(() => {
        currentHeroIndex = (currentHeroIndex + 1) % HERO_SLIDES.length;
        renderHeroSlide(currentHeroIndex);
    }, 8000);
}

function renderHeroSlide(index) {
    const slide = HERO_SLIDES[index];
    if (!slide) return;

    const backdrop = document.getElementById('heroBackdrop');
    const title = document.getElementById('heroTitle');
    const desc = document.getElementById('heroDesc');
    const ratingBadge = document.getElementById('heroRatingBadge');
    const genreBadge = document.getElementById('heroGenreBadge');
    const playBtn = document.getElementById('heroPlayBtn');
    const detailsBtn = document.getElementById('heroDetailsBtn');

    if (backdrop) backdrop.style.backgroundImage = `url('${slide.backdrop}')`;
    if (title) title.textContent = slide.title;
    if (desc) desc.textContent = slide.desc;
    if (ratingBadge) ratingBadge.textContent = `★ ${slide.rating} IMDb`;
    if (genreBadge) genreBadge.textContent = slide.genre;
    if (playBtn) playBtn.onclick = () => quickPlay(slide.subject_id, slide.title);
    if (detailsBtn) detailsBtn.onclick = () => openDetailsModal(slide.subject_id);

    document.querySelectorAll('#heroDots .dot').forEach((d, i) => d.classList.toggle('active', i === index));
}

// ─── SKELETON HELPER ─────────────────────────────────────────────────────────
function renderSkeletons(container, count = 12) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-card">
                <div class="skeleton-poster"></div>
                <div class="skeleton-body">
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line short"></div>
                </div>
            </div>`;
    }
    container.innerHTML = html;
}

// ─── HOME FEED (Real 2026/2025 movies with 1500x2222 posters, 0 songs) ───────
async function loadHomeFeed() {
    const curatedGrid = document.getElementById('curatedGrid');
    const hollywoodGrid = document.getElementById('hollywoodGrid');
    const bollywoodGrid = document.getElementById('bollywoodGrid');
    const southIndianGrid = document.getElementById('southIndianGrid');
    const homeSeriesGrid = document.getElementById('homeSeriesGrid');

    if (curatedGrid) renderSkeletons(curatedGrid, 6);
    if (hollywoodGrid) renderSkeletons(hollywoodGrid, 6);
    if (bollywoodGrid) renderSkeletons(bollywoodGrid, 6);
    if (southIndianGrid) renderSkeletons(southIndianGrid, 6);
    if (homeSeriesGrid) renderSkeletons(homeSeriesGrid, 6);

    try {
        const res = await fetch('/api/feed/home-curated');
        const feed = await res.json();

        // 1. Trending & Fresh Cinema
        let trendingList = feed.trending || [];
        if (!trendingList.length) {
            try {
                const trRes = await fetch('/movies?page=1&per_page=12&sort=RECOMMEND');
                const trData = await trRes.json();
                trendingList = trData.items || [];
            } catch (e) {}
        }
        if (curatedGrid) {
            curatedGrid.innerHTML = trendingList.length
                ? trendingList.slice(0, 12).map(item => createMediaCardHtml({ ...item, type: 'Movie' })).join('')
                : '<div class="grid-loading">No trending movies found.</div>';
        }

        // 2. Hollywood Blockbusters
        let hollywoodList = feed.hollywood || [];
        if (!hollywoodList.length) {
            try {
                const hwRes = await fetch('/movies?page=1&per_page=12&category=hollywood');
                const hwData = await hwRes.json();
                hollywoodList = hwData.items || [];
            } catch (e) {}
        }
        if (hollywoodGrid) {
            hollywoodGrid.innerHTML = (hollywoodList.length ? hollywoodList : trendingList).slice(0, 12).map(item => createMediaCardHtml({ ...item, type: 'Movie' })).join('');
        }

        // 3. Bollywood Hits
        let bollywoodList = feed.bollywood || [];
        if (!bollywoodList.length) {
            try {
                const bwRes = await fetch('/movies?page=1&per_page=12&category=bollywood');
                const bwData = await bwRes.json();
                bollywoodList = bwData.items || [];
            } catch (e) {}
        }
        if (bollywoodGrid) {
            bollywoodGrid.innerHTML = (bollywoodList.length ? bollywoodList : trendingList.slice(3)).slice(0, 12).map(item => createMediaCardHtml({ ...item, type: 'Movie' })).join('');
        }

        // 4. South Indian Cinema
        let southList = feed.south_indian || [];
        if (!southList.length) {
            try {
                const siRes = await fetch('/movies?page=1&per_page=12&category=south_indian');
                const siData = await siRes.json();
                southList = siData.items || [];
            } catch (e) {}
        }
        if (southIndianGrid) {
            southIndianGrid.innerHTML = (southList.length ? southList : trendingList.slice(6)).slice(0, 12).map(item => createMediaCardHtml({ ...item, type: 'Movie' })).join('');
        }

        // 5. Top TV Series & Anime
        let seriesList = [...(feed.series || []), ...(feed.anime || [])];
        if (!seriesList.length) {
            try {
                const seRes = await fetch('/movies?page=1&per_page=12&category=series');
                const seData = await seRes.json();
                seriesList = seData.items || [];
            } catch (e) {}
        }
        if (homeSeriesGrid) {
            homeSeriesGrid.innerHTML = seriesList.slice(0, 12).map(item => createMediaCardHtml({ ...item, type: 'TV Series' })).join('');
        }
    } catch (err) {
        if (curatedGrid) curatedGrid.innerHTML = `<div class="grid-loading">Failed to load feed: ${escapeHtml(err.message)}</div>`;
    }
}

function browseMoviesByCategory(cat) {
    switchTab('movies');
    filterMoviesCategory(cat);
}

function filterMoviesCategory(cat, btn) {
    currentMovieCategory = cat;
    document.querySelectorAll('#moviesCategoryBar .cat-pill').forEach(b => b.classList.remove('active'));
    if (btn) {
        btn.classList.add('active');
    } else {
        const target = Array.from(document.querySelectorAll('#moviesCategoryBar .cat-pill')).find(b => b.onclick && b.onclick.toString().includes(cat));
        if (target) target.classList.add('active');
    }
    loadMovies(1);
}

function filterSeriesCategory(cat, btn) {
    currentSeriesCategory = cat;
    document.querySelectorAll('#seriesCategoryBar .cat-pill').forEach(b => b.classList.remove('active'));
    if (btn) {
        btn.classList.add('active');
    } else {
        const target = Array.from(document.querySelectorAll('#seriesCategoryBar .cat-pill')).find(b => b.onclick && b.onclick.toString().includes(cat));
        if (target) target.classList.add('active');
    }
    loadTVSeries(1);
}

/**
 * Heuristic to detect music/song/non-movie entries that appear in movie feed
 */
function isMusicEntry(item) {
    if (!item || !item.title) return false;
    if (item.subject_type === 6) return true;
    const t = item.title.toUpperCase();
    const musicPatterns = [
        'OST', 'SOUNDTRACK', 'MUSIC VIDEO', ' SONG', 'ALBUM', 'EP -',
        '(MUSIC)', 'OFFICIAL MV', '- MV', 'MV)', '(AUDIO)', 'VIDEO MIX',
        'CLUB BANGER', 'BONGO MIX', 'REMIX', 'MIXTAPE', 'HIT SONGS',
        'BEST OF ', 'TOP HITS', '(OFFICIAL AUDIO)', '(LYRICS VIDEO)',
        'NAIJA MUSIC', 'AFROBEAT', 'AMAPIANO MIX', 'JUKEBOX'
    ];
    return musicPatterns.some(k => t.includes(k));
}

// ─── MOVIES CATALOG ───────────────────────────────────────────────────────────
async function loadMovies(page = 1, sort = moviesSort) {
    moviesPage = page;
    moviesSort = sort;
    const grid = document.getElementById('moviesCatalogGrid');
    const indicator = document.getElementById('moviesPageIndicator');
    const prevBtn = document.getElementById('moviesPrevBtn');

    renderSkeletons(grid, 18);
    grid.dataset.loaded = 'true';

    try {
        const res = await fetch(`/movies?page=${page}&per_page=24&sort=${sort}&category=${currentMovieCategory}`);
        const data = await res.json();
        let items = (data.items || []).filter(item => item.title && !isMusicEntry(item));

        if (moviesGenreFilter !== 'ALL') {
            items = items.filter(i => (i.genre || '').toLowerCase().includes(moviesGenreFilter.toLowerCase()));
        }

        if (items.length) {
            grid.innerHTML = items.map(item => createMediaCardHtml({ ...item, type: 'Movie' })).join('');
        } else {
            grid.innerHTML = '<div class="grid-loading">No movies found in this category.</div>';
        }

        if (indicator) indicator.textContent = `Page ${page}`;
        if (prevBtn) prevBtn.disabled = page <= 1;
    } catch (err) {
        grid.innerHTML = `<div class="grid-loading">Error: ${err.message}</div>`;
    }
}

function filterByGenre(genre, type = 'movies', btn) {
    moviesGenreFilter = genre;
    document.querySelectorAll('#moviesGenreBar .genre-chip').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
    loadMovies(1);
}

function changeMoviesPage(delta) {
    loadMovies(Math.max(1, moviesPage + delta));
}

function setMoviesSort(sort, btn) {
    document.querySelectorAll('#fpRecommend, #fpHot, #fpNew').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    loadMovies(1, sort);
}

// ─── TV SERIES ───────────────────────────────────────────────────────────────
async function loadTVSeries(page = 1, sort = seriesSort) {
    seriesPage = page;
    seriesSort = sort;
    const grid = document.getElementById('seriesCatalogGrid');
    const indicator = document.getElementById('seriesPageIndicator');
    const prevBtn = document.getElementById('seriesPrevBtn');

    renderSkeletons(grid, 18);
    grid.dataset.loaded = 'true';

    try {
        const res = await fetch(`/tv-series?page=${page}&per_page=24&sort=${sort}&category=${currentSeriesCategory}`);
        const data = await res.json();
        const items = (data.items || []).filter(item => item.title && !isMusicEntry(item));

        if (items.length) {
            grid.innerHTML = items.map(item => createMediaCardHtml({ ...item, type: 'TV Series' })).join('');
        } else {
            grid.innerHTML = '<div class="grid-loading">No series found on this page.</div>';
        }

        if (indicator) indicator.textContent = `Page ${page}`;
        if (prevBtn) prevBtn.disabled = page <= 1;
    } catch (err) {
        grid.innerHTML = `<div class="grid-loading">Error: ${err.message}</div>`;
    }
}

function changeSeriesPage(delta) {
    loadTVSeries(Math.max(1, seriesPage + delta));
}

// ─── MEDIA CARD HTML ─────────────────────────────────────────────────────────
function createMediaCardHtml(item) {
    const fallback = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="100%" height="100%" fill="%230d1020"/><text x="50%" y="44%" fill="%238b5cf6" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">CineScope</text><text x="50%" y="54%" fill="%235a6480" font-family="sans-serif" font-size="11" text-anchor="middle">${encodeURIComponent((item.title || 'Cinema').slice(0, 22))}</text></svg>`;

    const poster = item.cover || fallback;
    const rating = item.rating || item.imdb_rating || '';
    const year = item.year || (item.release_date ? item.release_date.slice(0, 4) : '');
    const type = item.type || (item.subject_type === 2 ? 'TV Series' : 'Movie');
    const safeId = String(item.subject_id || '');
    const safeTitle = escapeAttr(item.title || 'Untitled');

    const isComingSoon = Boolean(item.coming_soon || (item.release_date && item.release_date.slice(0, 10) > new Date().toISOString().slice(0, 10)));

    return `
        <div class="media-card" onclick="openDetailsModal('${safeId}')" id="card-${safeId}">
            <div class="poster-wrap">
                <img class="card-poster" src="${poster}" alt="${escapeHtml(item.title || '')}" loading="lazy" onerror="this.src='${fallback}'">
                ${rating ? `<span class="card-badge-rating">★ ${rating}</span>` : ''}
                <span class="card-badge-type">${type}</span>
                ${isComingSoon ? `<span class="card-badge-coming-soon">⏳ Coming Soon</span>` : ''}
                ${isComingSoon ? `
                <div class="card-overlay-btn" onclick="event.stopPropagation(); showToast('${safeTitle} is coming soon (not released yet)', 'info');">
                    <div class="play-circle play-circle-locked" title="Coming Soon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                </div>` : `
                <div class="card-overlay-btn" onclick="event.stopPropagation(); quickPlay('${safeId}', '${safeTitle}')">
                    <div class="play-circle">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                </div>`}
            </div>
            <div class="card-body">
                <h3 class="card-title" title="${escapeHtml(item.title || '')}">
                    ${escapeHtml(item.title || 'Untitled')}
                    ${isComingSoon ? `<span class="badge-text-coming-soon">Coming Soon</span>` : ''}
                </h3>
                <div class="card-meta">
                    ${year ? `<span>${year}</span>` : ''}
                </div>
            </div>
        </div>`;
}

// ─── GLOBAL SEARCH ────────────────────────────────────────────────────────────
function initGlobalSearch() {
    const input = document.getElementById('globalSearchInput');
    const dropdown = document.getElementById('autocompleteDropdown');
    let debounceTimer = null;

    if (!input || !dropdown) return;

    input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const q = e.target.value.trim();
        if (q.length < 2) { dropdown.style.display = 'none'; return; }

        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`/search/suggest?q=${encodeURIComponent(q)}`);
                const data = await res.json();
                const suggestions = (data.suggestions || []).filter(s => s.title);
                if (!suggestions.length) { dropdown.style.display = 'none'; return; }

                dropdown.innerHTML = suggestions.slice(0, 8).map(s => {
                    const sid = (s.subject_id && s.subject_id !== 'None') ? s.subject_id : '';
                    const poster = s.cover ? `<img class="ac-thumb" src="${s.cover}" alt="" onerror="this.style.display='none'">` : '<div class="ac-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--violet)">🎬</div>';
                    const typeBadge = s.type ? `<span class="badge ${s.type === 'Series' ? 'badge-primary' : 'badge-outline'} ac-badge">${escapeHtml(s.type)}</span>` : '';
                    const ratingBadge = s.rating ? `<span class="ac-rating">★ ${s.rating}</span>` : '';
                    const yearSpan = s.year ? `<span class="ac-year">${s.year}</span>` : '';
                    const csBadge = s.coming_soon ? '<span class="badge-text-coming-soon">Coming Soon</span>' : '';
                    return `
                        <div class="autocomplete-item" onclick="selectSuggestion('${sid}', '${escapeAttr(s.title || '')}')">
                            ${poster}
                            <div class="ac-info">
                                <div class="ac-title">${escapeHtml(s.title || '')} ${csBadge}</div>
                                <div class="ac-meta-row">${typeBadge} ${ratingBadge} ${yearSpan}</div>
                            </div>
                        </div>`;
                }).join('');
                dropdown.style.display = 'block';
            } catch {
                dropdown.style.display = 'none';
            }
        }, 250);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const q = input.value.trim();
            dropdown.style.display = 'none';
            if (q) performFullSearch(q);
        } else if (e.key === 'Escape') {
            dropdown.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) dropdown.style.display = 'none';
    });
}

function selectSuggestion(subjectId, title) {
    document.getElementById('autocompleteDropdown').style.display = 'none';
    if (!subjectId || subjectId === 'None' || subjectId === 'undefined') {
        const input = document.getElementById('globalSearchInput');
        if (input) input.value = title;
        performFullSearch(title);
    } else {
        openDetailsModal(subjectId);
    }
}

async function performFullSearch(query) {
    saveRecentSearch(query);
    switchTab('search');
    const subtitle = document.getElementById('searchSubtitle');
    const grid = document.getElementById('searchResultsGrid');
    if (subtitle) subtitle.textContent = `Results for "${escapeHtml(query)}"`;
    renderSkeletons(grid, 12);

    try {
        const res = await fetch(`/search?q=${encodeURIComponent(query)}&page=1&per_page=20`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const results = (data.results || []).filter(r => r.title && !isMusicEntry(r));

        if (results.length) {
            grid.innerHTML = results.map(item => createMediaCardHtml(item)).join('');
        } else {
            grid.innerHTML = `<div class="grid-loading">No results found for "${escapeHtml(query)}"</div>`;
        }
        // Scroll to results
        setTimeout(() => grid.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
        grid.innerHTML = `<div class="grid-loading">Search failed: ${err.message}</div>`;
    }
}

// ─── RECENT SEARCHES ──────────────────────────────────────────────────────────
function getRecentSearches() {
    try { return JSON.parse(localStorage.getItem('cinescope_recent_searches') || '[]'); } catch { return []; }
}

function saveRecentSearch(query) {
    if (!query || query.length < 2) return;
    let recent = getRecentSearches().filter(q => q.toLowerCase() !== query.toLowerCase());
    recent.unshift(query);
    localStorage.setItem('cinescope_recent_searches', JSON.stringify(recent.slice(0, 8)));
    renderRecentSearchChips();
}

function renderRecentSearchChips() {
    const container = document.getElementById('recentSearchChips');
    if (!container) return;
    const recent = getRecentSearches();
    if (!recent.length) {
        container.innerHTML = '';
        const wrapper = document.getElementById('recentSearchesRow');
        if (wrapper) wrapper.style.display = 'none';
        return;
    }
    const wrapper = document.getElementById('recentSearchesRow');
    if (wrapper) wrapper.style.display = 'flex';
    container.innerHTML = recent.map(q => `
        <button class="recent-chip" onclick="document.getElementById('globalSearchInput').value='${escapeAttr(q)}'; performFullSearch('${escapeAttr(q)}')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 0 .5-4.5"/><polyline points="3 3 3 9 9 9"/></svg>
            ${escapeHtml(q)}
        </button>`).join('');
}

// ─── STREAM RESOLVER ─────────────────────────────────────────────────────────
function setResolverPreset(id, se = 0, ep = 0, title = '') {
    document.getElementById('resolverSubjectInput').value = id;
    document.getElementById('resolverSeasonInput').value = se;
    document.getElementById('resolverEpisodeInput').value = ep;
    if (title) showToast(`Preset: ${title}`);
}

async function executeResolver() {
    const subjectIdRaw = document.getElementById('resolverSubjectInput').value.trim();
    const se = parseInt(document.getElementById('resolverSeasonInput').value) || 0;
    const ep = parseInt(document.getElementById('resolverEpisodeInput').value) || 0;

    if (!subjectIdRaw) { showToast('Please enter a Title or Subject ID', 'error'); return; }

    const resultsContainer = document.getElementById('resolverResults');
    resultsContainer.style.display = 'flex';
    const streamsListEl = document.getElementById('streamsList');
    const captionsListEl = document.getElementById('captionsList');
    streamsListEl.innerHTML = '<div style="padding:18px;color:var(--text-muted)"><div class="loading-spinner" style="margin-right:12px;vertical-align:middle;"></div>Resolving streams…</div>';
    captionsListEl.innerHTML = '<div style="padding:18px;color:var(--text-muted)">Fetching subtitles…</div>';

    try {
        let subjectId = subjectIdRaw;
        if (!/^\d{10,}$/.test(subjectIdRaw)) {
            const searchRes = await fetch(`/search?q=${encodeURIComponent(subjectIdRaw)}&per_page=1`).then(r => r.json());
            const first = (searchRes.results || [])[0];
            if (first && first.subject_id) {
                subjectId = first.subject_id;
                document.getElementById('resolverSubjectInput').value = subjectId;
            } else {
                throw new Error(`Could not find: "${subjectIdRaw}"`);
            }
        }

        currentPlayingSubjectId = subjectId;
        currentSeason = se;
        currentEpisode = ep;

        // Parallel fetch for speed
        const [streamRes, captionRes, detailRes, episodeRes] = await Promise.allSettled([
            fetch(`/api/stream/${subjectId}?se=${se}&ep=${ep}`).then(r => r.json()),
            fetch(`/api/stream/${subjectId}/captions?se=${se}&ep=${ep}`).then(r => r.json()),
            fetch(`/detail/${subjectId}`).then(r => r.json()),
            fetch(`/episodes/${subjectId}`).then(r => r.json())
        ]);

        const streamData  = streamRes.status  === 'fulfilled' ? streamRes.value  : { streams: [] };
        const captionData = captionRes.status === 'fulfilled' ? captionRes.value : { captions: [] };
        const detail      = detailRes.status  === 'fulfilled' ? detailRes.value  : null;
        const episodeData = episodeRes.status === 'fulfilled' ? episodeRes.value : null;

        const rawStreams  = streamData.streams || [];
        const cleanStreams = rawStreams.filter(s => !isNoticeStream(s));
        activeStreamList  = cleanStreams.length > 0 ? cleanStreams : rawStreams;
        activeCaptionList = captionData.captions || [];
        activeDubsList    = streamData.dubs || (detail ? detail.dubs : []) || [];
        activeMediaMeta   = detail;

        // Populate Media Overview
        if (detail && detail.title) {
            document.getElementById('resolverMediaTitle').textContent = detail.title;
            document.getElementById('resolverMediaDesc').textContent = detail.description || 'No synopsis available.';
            document.getElementById('resolverMediaType').textContent = detail.type || 'Movie';
            document.getElementById('resolverMediaRating').textContent = `★ ${detail.imdb_rating || 'N/A'}`;
            document.getElementById('resolverMediaYear').textContent = detail.release_date ? detail.release_date.slice(0, 4) : '';
            document.getElementById('resolverMediaMeta').textContent = [detail.duration, detail.genre, detail.language ? `${detail.language}` : null].filter(Boolean).join(' • ');
            const posterEl = document.getElementById('resolverPoster');
            if (detail.cover) { posterEl.src = detail.cover; posterEl.style.display = 'block'; }
        }

        // Audio Dubs in Resolver
        const dubsRow = document.getElementById('resolverAudioDubsRow');
        const dubsPills = document.getElementById('resolverDubsPills');
        if (activeDubsList && activeDubsList.length > 0) {
            dubsRow.style.display = 'flex';
            dubsPills.innerHTML = activeDubsList.map(d => `
                <button class="dub-pill ${d.subject_id === subjectId ? 'active' : ''}" onclick="switchAudioDub('${d.subject_id}', '${escapeAttr(d.lang_name)}')">
                    ${escapeHtml(d.lang_name)}
                </button>`).join('');
        } else {
            dubsRow.style.display = 'none';
        }

        // Episodes Navigator
        const seriesNavContainer = document.getElementById('seriesNavigatorContainer');
        const seasons = episodeData ? episodeData.seasons : null;
        if (seasons && seasons.length > 0) {
            seriesNavContainer.style.display = 'block';
            document.getElementById('seriesTotalSeasons').textContent = `${seasons.length} Season${seasons.length > 1 ? 's' : ''}`;
            renderSeasonTabs(subjectId, seasons, se, ep);
        } else {
            seriesNavContainer.style.display = 'none';
        }

        // Render Streams
        document.getElementById('streamCount').textContent = activeStreamList.length;
        if (!activeStreamList.length) {
            streamsListEl.innerHTML = '<div style="padding:16px;color:var(--text-muted)">No streams found. Try Season 1 Episode 1 for series.</div>';
        } else {
            streamsListEl.innerHTML = activeStreamList.map((s, i) => {
                const is1080 = s.quality && s.quality.includes('1080');
                const sizeText = s.size_mb > 0 ? `${s.size_mb} MB` : 'DASH Adaptive';
                const safeStream = encodeURIComponent(JSON.stringify(s));
                return `
                <div class="stream-row-item">
                    <div class="stream-meta-left">
                        <span class="badge-res ${is1080 ? 'hd-1080' : ''}">${s.quality || 'HD'}</span>
                        <span class="stream-format-name">${s.format || 'MP4'}</span>
                        <span class="stream-info-tag">${sizeText}</span>
                        <span class="stream-info-tag">${s.codec || 'h264'}</span>
                        <span class="stream-info-tag" style="color:var(--text-dim);font-size:11px">${(s.source || '').split('(')[0].trim()}</span>
                    </div>
                    <div class="stream-actions">
                        <button class="btn btn-primary btn-sm" onclick="playInCinemaModal('${safeStream}')">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Play
                        </button>
                        <button class="btn btn-ghost btn-sm" onclick="copyStreamUrl('${s.url}')">Copy URL</button>
                    </div>
                </div>`;
            }).join('');
        }

        // Render Captions
        document.getElementById('captionCount').textContent = activeCaptionList.length;
        if (!activeCaptionList.length) {
            captionsListEl.innerHTML = '<div style="padding:16px;color:var(--text-muted)">No subtitle tracks found for this title.</div>';
        } else {
            captionsListEl.innerHTML = activeCaptionList.map(c => `
                <div class="caption-chip">
                    <span style="font-weight:600;">${escapeHtml(c.language || 'Unknown')}</span>
                    <a href="${c.url}" target="_blank" download>Download .SRT</a>
                </div>`).join('');
        }

        showToast(`✓ ${activeStreamList.length} stream${activeStreamList.length !== 1 ? 's' : ''} resolved`);

    } catch (err) {
        streamsListEl.innerHTML = `<div style="padding:16px;color:var(--rose)">Error: ${escapeHtml(err.message)}</div>`;
        showToast(err.message, 'error');
    }
}

// ─── AUDIO DUB SWITCHER ───────────────────────────────────────────────────────
async function switchAudioDub(dubSubjectId, langName) {
    if (dubSubjectId === currentPlayingSubjectId) return;
    showToast(`Switching audio: ${langName}…`);

    let resumeTime = 0;
    if (plyrInstance) resumeTime = plyrInstance.currentTime;

    // Update dub pills active state
    document.querySelectorAll('.dub-pill').forEach(p => {
        p.classList.toggle('active', p.onclick && p.onclick.toString().includes(dubSubjectId));
    });

    // Fetch new streams for the dub subject_id
    try {
        const res = await fetch(`/api/stream/${dubSubjectId}?se=${currentSeason}&ep=${currentEpisode}`).then(r => r.json());
        activeStreamList = res.streams || [];
        if (res.dubs && res.dubs.length > 0) {
            activeDubsList = res.dubs;
            currentTitleDubs = res.dubs;
        }
        currentPlayingSubjectId = dubSubjectId;

        if (activeStreamList.length > 0) {
            const playableStreams = (activeStreamList || []).filter(s => s && s.format !== 'DASH' && !s.url.includes('.mpd'));
            const listToUse = playableStreams.length > 0 ? playableStreams : activeStreamList;
            // Update quality selector
            const qualitySelect = document.getElementById('playerQualitySelect');
            if (qualitySelect) {
                qualitySelect.innerHTML = listToUse.map(s => `
                    <option value="${encodeURIComponent(JSON.stringify(s))}">${s.quality} (${s.format})</option>`).join('');
            }
            // Switch stream keeping resume time
            playInCinemaModal(encodeURIComponent(JSON.stringify(listToUse[0])), resumeTime);
        } else {
            showToast(`No streams for ${langName} dub`, 'error');
        }
    } catch (err) {
        showToast(`Failed to switch audio: ${err.message}`, 'error');
    }
}

// ─── SEASON/EPISODE TABS ─────────────────────────────────────────────────────
function renderSeasonTabs(subjectId, seasons, activeSe, activeEp) {
    const tabsContainer = document.getElementById('seasonTabsContainer');
    const episodesContainer = document.getElementById('episodesGridContainer');
    if (!tabsContainer || !episodesContainer) return;

    let selectedSeason = activeSe > 0 ? activeSe : (seasons[0] ? seasons[0].season : 1);

    tabsContainer.innerHTML = seasons.map(s => `
        <button class="season-tab-btn ${s.season === selectedSeason ? 'active' : ''}"
            onclick="selectSeason('${subjectId}', ${s.season}, ${s.episode_count}, this)">
            S${s.season} (${s.episode_count} eps)
        </button>`).join('');

    const cur = seasons.find(s => s.season === selectedSeason) || seasons[0];
    renderEpisodes(subjectId, cur.season, cur.episode_count, activeEp);
}

function selectSeason(subjectId, seasonNum, epCount, btn) {
    document.querySelectorAll('.season-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderEpisodes(subjectId, seasonNum, epCount, 1);
}

function renderEpisodes(subjectId, seasonNum, epCount, activeEp) {
    const container = document.getElementById('episodesGridContainer');
    if (!container) return;
    let html = '';
    for (let i = 1; i <= epCount; i++) {
        html += `
            <div class="episode-btn ${i === activeEp ? 'active' : ''}" onclick="selectAndResolveEpisode('${subjectId}', ${seasonNum}, ${i})">
                <span class="ep-num">Ep ${i}</span>
                <span class="ep-res-badge">HD</span>
            </div>`;
    }
    container.innerHTML = html;
}

function selectAndResolveEpisode(subjectId, seasonNum, episodeNum) {
    document.getElementById('resolverSubjectInput').value = subjectId;
    document.getElementById('resolverSeasonInput').value = seasonNum;
    document.getElementById('resolverEpisodeInput').value = episodeNum;
    document.querySelectorAll('#episodesGridContainer .episode-btn').forEach((b, i) => {
        b.classList.toggle('active', i + 1 === episodeNum);
    });
    showToast(`Loading S${seasonNum}E${episodeNum}…`);
    executeResolver();
}

// ─── PLYR & IN-PLAYER CINEMA ENGINE ──────────────────────────────────────────
function getCinemaVideoElement() {
    let video = document.getElementById('cinemaVideo');
    if (!video) {
        video = document.querySelector('#videoStage video');
    }
    if (!video && plyrInstance && plyrInstance.media) {
        video = plyrInstance.media;
    }
    if (!video) {
        const stage = document.getElementById('videoStage');
        if (stage) {
            video = document.createElement('video');
            video.id = 'cinemaVideo';
            video.setAttribute('playsinline', '');
            const ambient = document.getElementById('playerAmbientGlow');
            if (ambient && ambient.nextSibling) {
                stage.insertBefore(video, ambient.nextSibling);
            } else {
                stage.prepend(video);
            }
            if (typeof initPlyr === 'function') {
                try { initPlyr(); } catch {}
            }
        }
    }
    return video;
}

function setCinemaVideoSource(src, stream, titleText) {
    const video = getCinemaVideoElement();
    if (!video || !src) return;

    if (hlsInstance) {
        try { hlsInstance.destroy(); } catch {}
        hlsInstance = null;
    }

    const isHls = Boolean((src && (src.includes('.m3u8') || src.includes('hls'))) || (stream && stream.format === 'HLS'));

    if (isHls && typeof Hls !== 'undefined' && Hls.isSupported()) {
        try {
            hlsInstance = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                backBufferLength: 90
            });
            hlsInstance.loadSource(src);
            hlsInstance.attachMedia(video);
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                if (plyrInstance) {
                    try { plyrInstance.play().catch(() => {}); } catch {}
                }
            });
            hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            try { hlsInstance.startLoad(); } catch {}
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            try { hlsInstance.recoverMediaError(); } catch {}
                            break;
                        default:
                            try { hlsInstance.destroy(); } catch {}
                            hlsInstance = null;
                            break;
                    }
                }
            });
            return;
        } catch (e) {
            console.warn('Hls.js initialization error, falling back:', e);
        }
    }

    // Direct MP4 playback via Plyr API & HTML5 video element
    if (plyrInstance) {
        try {
            plyrInstance.source = {
                type: 'video',
                title: titleText || (activeMediaMeta && activeMediaMeta.title) || 'CineScope Stream',
                sources: [
                    {
                        src: src,
                        type: isHls ? 'application/x-mpegURL' : 'video/mp4',
                        size: stream ? (stream.quality_value || 1080) : 1080
                    }
                ]
            };
        } catch (e) {
            console.warn('Plyr source setter warning:', e);
        }
    }
    if (video.src !== src) {
        video.src = src;
        try { video.load(); } catch {}
    }
    // Automatically trigger watchdog to auto-switch if stream fails or stalls on start
    if (window._startStreamWatchdog) {
        window._startStreamWatchdog(7500);
    }
}

function initPlyr() {
    const video = getCinemaVideoElement();
    if (!video || typeof Plyr === 'undefined') return;

    if (plyrInstance) {
        try { plyrInstance.destroy(); } catch {}
        plyrInstance = null;
    }

    plyrInstance = new Plyr(video, {
        controls: [
            'play-large', 'play', 'rewind', 'fast-forward', 'progress',
            'current-time', 'duration', 'mute', 'volume', 'captions',
            'settings', 'pip', 'airplay', 'fullscreen'
        ],
        captions: { active: true, update: true },
        seekTime: 10,
        settings: ['captions', 'speed'],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        tooltips: { controls: true, seek: true },
        keyboard: { focused: true, global: true },
        fullscreen: {
            enabled: true,
            fallback: true,
            iosNative: false,
            container: '#videoStage'
        }
    });

    // Fullscreen state listeners (both browser and Plyr events)
    document.addEventListener('fullscreenchange', handleFullscreenStateChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenStateChange);
    plyrInstance.on('enterfullscreen', handleFullscreenStateChange);
    plyrInstance.on('exitfullscreen', handleFullscreenStateChange);

    // Auto-hide in-player HUD on inactivity during playback
    plyrInstance.on('play', resetInPlayerHudTimer);
    plyrInstance.on('pause', resetInPlayerHudTimer);

    // Keyboard shortcuts for cinema player
    window.addEventListener('keydown', (e) => {
        const modal = document.getElementById('playerModal');
        if (!modal || !modal.classList.contains('active')) return;
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            toggleCinemaFullscreen();
        } else if (e.key === 'Escape') {
            closeAllInPlayerMenus();
        }
    });

    plyrInstance.on('timeupdate', () => {
        if (!currentPlayingSubjectId || plyrInstance.currentTime < 5) return;
        // Throttle: save every 15s
        if (!plyrInstance._lastSave || Date.now() - plyrInstance._lastSave > 15000) {
            plyrInstance._lastSave = Date.now();
            saveContinueWatching();
        }
    });

    plyrInstance.on('ended', () => {
        if (currentEpisode > 0) {
            startNextEpisodeCountdown();
        }
    });

    // Smart Buffer & Stall Watchdog Engine
    let streamWatchdogTimer = null;
    let fallbackAttemptIndex = 0;
    window._resetFallbackFlag = () => { fallbackAttemptIndex = 0; };

    function clearStreamWatchdog() {
        if (streamWatchdogTimer) {
            clearTimeout(streamWatchdogTimer);
            streamWatchdogTimer = null;
        }
    }
    window._clearStreamWatchdog = clearStreamWatchdog;

    function startStreamWatchdog(timeoutMs = 7500) {
        clearStreamWatchdog();
        streamWatchdogTimer = setTimeout(() => {
            const modal = document.getElementById('playerModal');
            const v = getCinemaVideoElement();
            if (!modal || !modal.classList.contains('active')) return;
            // Trigger auto-fallback if direct server is struggling to buffer or start
            if (currentSelectedServer === 'direct' && v) {
                if (v.currentTime < 0.5 || v.readyState < 2) {
                    showToast('Direct stream is buffering slowly — auto-switching to Backup Server…', 'warning');
                    window.triggerAutoStreamFallback('stall');
                }
            }
        }, timeoutMs);
    }
    window._startStreamWatchdog = startStreamWatchdog;

    window.triggerAutoStreamFallback = async function(reason = 'error') {
        clearStreamWatchdog();
        const modal = document.getElementById('playerModal');
        if (!modal || !modal.classList.contains('active')) return;

        // If fallback servers are not yet loaded in memory, fetch them on-demand
        if (!activeFallbackServers || activeFallbackServers.length === 0) {
            const title = (activeMediaMeta && activeMediaMeta.title) || document.getElementById('playerMediaTitle')?.textContent || '';
            const year = (activeMediaMeta && activeMediaMeta.release_date) ? activeMediaMeta.release_date.slice(0, 4) : '';
            const isSer = Boolean(currentEpisode > 0 || (activeMediaMeta && (activeMediaMeta.type === 'Series' || activeMediaMeta.type === 'TV Series')));
            if (title) {
                try {
                    showToast('Switching to Backup Stream Server…', 'info');
                    const fbRes = await fetch(`/api/fallback-sources?title=${encodeURIComponent(title)}&year=${year}&is_series=${isSer}&season=${currentSeason || 1}&episode=${currentEpisode || 1}`).then(r => r.json());
                    if (fbRes.servers && fbRes.servers.length > 0) {
                        activeFallbackServers = fbRes.servers;
                        updatePlayerServerSelect();
                    }
                } catch {}
            }
        }

        // Auto-switch to backup servers if direct fails or stalls
        if (activeFallbackServers && activeFallbackServers.length > 0) {
            let nextServer = null;
            if (currentSelectedServer === 'direct') {
                nextServer = activeFallbackServers[0];
            } else {
                const curIdx = activeFallbackServers.findIndex(s => s.id === currentSelectedServer);
                if (curIdx >= 0 && curIdx + 1 < activeFallbackServers.length) {
                    nextServer = activeFallbackServers[curIdx + 1];
                }
            }
            if (nextServer) {
                const srvName = nextServer.name.split('(')[1]?.replace(')', '') || nextServer.name;
                showToast(`Auto-switching to ${srvName}…`, 'info');
                changePlayerServer(nextServer.id);
                return;
            }
        }

        // Alternative MP4 streams fallback
        const playableStreams = (activeStreamList || []).filter(s => s && s.format !== 'DASH' && !s.url.includes('.mpd') && s.url !== currentPlayingStream?.url);
        if (playableStreams.length > 0) {
            const altStream = playableStreams[0];
            showToast(`Auto-switching to mirror (${altStream.quality || 'Alt'})…`, 'warning');
            setTimeout(() => changePlayerQuality(encodeURIComponent(JSON.stringify(altStream))), 350);
            return;
        }

        // All options exhausted — re-fetch fresh streams from API with cache-bust
        try {
            const freshData = await fetch(`/api/stream/${currentPlayingSubjectId}?se=${currentSeason}&ep=${currentEpisode}&_bust=${Date.now()}`).then(r => r.json());
            if (freshData.fallback_servers && freshData.fallback_servers.length > 0) {
                activeFallbackServers = freshData.fallback_servers;
                updatePlayerServerSelect();
            }
            const freshStreams = (freshData.streams || []).filter(s => s && s.format !== 'DASH' && !s.url.includes('.mpd'));
            if (freshStreams.length > 0) {
                activeStreamList = freshData.streams;
                window._resetFallbackFlag();
                playInCinemaModal(encodeURIComponent(JSON.stringify(freshStreams[0])));
                showToast('Fresh stream URLs loaded.', 'success');
                return;
            }
            if (activeFallbackServers && activeFallbackServers.length > 0) {
                changePlayerServer(activeFallbackServers[0].id);
                return;
            }
        } catch {}
        showToast('All streaming options exhausted. Please select another server from the top bar.', 'error');
    };

    video.addEventListener('error', () => {
        window.triggerAutoStreamFallback('error');
    });

    video.addEventListener('waiting', () => {
        if (currentSelectedServer === 'direct') startStreamWatchdog(6000);
    });

    video.addEventListener('stalled', () => {
        if (currentSelectedServer === 'direct') startStreamWatchdog(6000);
    });

    video.addEventListener('playing', () => {
        clearStreamWatchdog();
    });

    video.addEventListener('timeupdate', () => {
        if (video.currentTime > 0.5) clearStreamWatchdog();
    });

    if (plyrInstance) {
        plyrInstance.on('error', () => window.triggerAutoStreamFallback('plyr_error'));
        plyrInstance.on('playing', () => clearStreamWatchdog());
    }

    // Video Stage Double Click & Mobile Touch Double-Tap for 10s Seek (Netflix style)
    const stage = document.getElementById('videoStage');
    if (stage) {
        stage.addEventListener('dblclick', (e) => {
            if (isScreenLocked) return;
            const rect = stage.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            if (clickX < width * 0.42) {
                if (plyrInstance) plyrInstance.rewind(10);
                triggerSeekRipple('left');
            } else if (clickX > width * 0.58) {
                if (plyrInstance) plyrInstance.forward(10);
                triggerSeekRipple('right');
            }
        });

        // Mobile touch double-tap handler
        let lastTouchTapTime = 0;
        let lastTouchTapX = 0;
        stage.addEventListener('touchend', (e) => {
            if (isScreenLocked) return;
            const now = Date.now();
            const touch = e.changedTouches && e.changedTouches[0];
            if (!touch) return;
            const rect = stage.getBoundingClientRect();
            const clickX = touch.clientX - rect.left;
            const timeDiff = now - lastTouchTapTime;
            const distDiff = Math.abs(clickX - lastTouchTapX);

            if (timeDiff > 40 && timeDiff < 320 && distDiff < 60) {
                // Detected rapid double tap on mobile screen!
                const width = rect.width;
                if (clickX < width * 0.45) {
                    if (plyrInstance) plyrInstance.rewind(10);
                    triggerSeekRipple('left');
                } else if (clickX > width * 0.55) {
                    if (plyrInstance) plyrInstance.forward(10);
                    triggerSeekRipple('right');
                }
                lastTouchTapTime = 0;
            } else {
                lastTouchTapTime = now;
                lastTouchTapX = clickX;
            }
        }, { passive: true });
    }
}

let isScreenLocked = false;
function toggleScreenLock() {
    isScreenLocked = !isScreenLocked;
    const stage = document.getElementById('videoStage');
    const icon = document.getElementById('screenLockIcon');
    if (stage) stage.classList.toggle('screen-locked', isScreenLocked);
    if (icon) icon.textContent = isScreenLocked ? '🔒' : '🔓';
    showToast(isScreenLocked ? 'Screen Locked (Controls hidden)' : 'Screen Unlocked', 'info');
}

// ─── IN-PLAYER FULLSCREEN & HUD CONTROLLER ────────────────────────────────────
function toggleCinemaFullscreen() {
    const stage = document.getElementById('videoStage');
    if (!stage) return;
    const isFs = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        stage.classList.contains('is-fullscreen') ||
        (plyrInstance && plyrInstance.fullscreen && plyrInstance.fullscreen.active)
    );

    if (!isFs) {
        try {
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(() => {});
            }
        } catch {}

        const req = stage.requestFullscreen || stage.webkitRequestFullscreen || stage.msRequestFullscreen;
        if (req) {
            req.call(stage).then(() => {
                stage.classList.add('is-fullscreen');
                handleFullscreenStateChange();
            }).catch(() => {
                stage.classList.add('is-fullscreen');
                handleFullscreenStateChange();
                if (plyrInstance && plyrInstance.fullscreen && !plyrInstance.fullscreen.active) {
                    try { plyrInstance.fullscreen.enter(); } catch {}
                }
            });
        } else {
            stage.classList.add('is-fullscreen');
            handleFullscreenStateChange();
        }
    } else {
        try {
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
        } catch {}

        const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
        if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
            exit.call(document).catch(() => {});
        }
        if (plyrInstance && plyrInstance.fullscreen && plyrInstance.fullscreen.active) {
            try { plyrInstance.fullscreen.exit(); } catch {}
        }
        stage.classList.remove('is-fullscreen');
        handleFullscreenStateChange();
    }
}

function handleFullscreenStateChange() {
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement || (plyrInstance && plyrInstance.fullscreen && plyrInstance.fullscreen.active));
    const stage = document.getElementById('videoStage');
    const fsIcon = document.getElementById('inPlayerFullscreenIcon');
    const modal = document.getElementById('playerModal');

    if (stage) stage.classList.toggle('is-fullscreen', isFs);
    if (modal) modal.classList.toggle('stage-fullscreen', isFs);
    if (fsIcon) fsIcon.textContent = isFs ? '⤓' : '⤢';
    resetInPlayerHudTimer();
}

function handleInPlayerBack() {
    if (document.fullscreenElement || document.webkitFullscreenElement || (plyrInstance && plyrInstance.fullscreen && plyrInstance.fullscreen.active)) {
        toggleCinemaFullscreen();
    } else {
        closePlayerModal();
    }
}

// In-Player Popover Menus
function closeAllInPlayerMenus() {
    document.querySelectorAll('.in-player-popover').forEach(el => el.classList.remove('open'));
}

function toggleInPlayerMenu(type, event) {
    if (event) event.stopPropagation();
    const idMap = {
        audio: 'inPlayerAudioMenu',
        quality: 'inPlayerQualityMenu',
        subs: 'inPlayerSubMenu',
        server: 'inPlayerServerMenu',
        speed: 'inPlayerSpeedMenu',
    };
    const targetId = idMap[type];
    const target = document.getElementById(targetId);
    if (!target) return;
    const isOpen = target.classList.contains('open');
    closeAllInPlayerMenus();
    if (!isOpen) {
        target.classList.add('open');
    }
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.in-player-dropdown-wrap')) {
        closeAllInPlayerMenus();
    }
});

function selectInPlayerAudio(dubId, dubName) {
    closeAllInPlayerMenus();
    const audioSelect = document.getElementById('playerAudioSelect');
    if (audioSelect) {
        audioSelect.value = dubId;
        changePlayerAudioDub(dubId);
    }
    safeText('inPlayerCurrentAudioText', `Audio: ${dubName}`);
    safeText('inPlayerDubBadge', dubName);
}

function selectInPlayerQuality(encodedStream, qualityLabel) {
    closeAllInPlayerMenus();
    const qualitySelect = document.getElementById('playerQualitySelect');
    if (qualitySelect) {
        qualitySelect.value = encodedStream;
        changePlayerQuality(encodedStream);
    }
    safeText('inPlayerCurrentQualityText', `Quality: ${qualityLabel}`);
    safeText('inPlayerQualityBadge', qualityLabel);
}

function selectInPlayerSub(subUrl, langLabel) {
    closeAllInPlayerMenus();
    const capSelect = document.getElementById('playerCaptionSelect');
    if (capSelect) {
        capSelect.value = subUrl;
    }
    changePlayerSubtitle(subUrl);
    safeText('inPlayerCurrentSubText', `Subtitles: ${langLabel}`);
    refreshInPlayerSubMenu(subUrl);
}

function selectInPlayerServer(serverId, srvName) {
    closeAllInPlayerMenus();
    const srvSelect = document.getElementById('playerServerSelect');
    if (srvSelect) {
        srvSelect.value = serverId;
        changePlayerServer(serverId);
    }
    safeText('inPlayerCurrentServerText', `Server: ${srvName}`);
}

function selectInPlayerSpeed(speed, event) {
    if (event) event.stopPropagation();
    closeAllInPlayerMenus();
    const speedSelect = document.getElementById('playerSpeedSelect');
    if (speedSelect) {
        speedSelect.value = String(speed);
        changePlayerSpeed(speed);
    }
    if (plyrInstance) plyrInstance.speed = speed;
    safeText('inPlayerCurrentSpeedText', `${speed}x`);
    document.querySelectorAll('#inPlayerSpeedMenu .popover-item').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.startsWith(String(speed)));
    });
}

// In-Player HUD Inactivity Auto-Hide
let inPlayerHudTimer = null;
function resetInPlayerHudTimer() {
    const stage = document.getElementById('videoStage');
    if (!stage) return;
    stage.classList.remove('hud-hidden');
    stage.classList.remove('hide-cursor');
    clearTimeout(inPlayerHudTimer);

    const hasOpenMenu = Boolean(document.querySelector('.in-player-popover.open'));
    if (!hasOpenMenu && plyrInstance && plyrInstance.playing && !isScreenLocked) {
        inPlayerHudTimer = setTimeout(() => {
            stage.classList.add('hud-hidden');
            stage.classList.add('hide-cursor');
        }, 2600);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const stage = document.getElementById('videoStage');
    if (stage) {
        stage.addEventListener('mousemove', resetInPlayerHudTimer);
        stage.addEventListener('touchstart', resetInPlayerHudTimer, { passive: true });
    }
});

// ─── AUDIO DIALOGUE BOOSTER (Prime Video style) ──────────────────────────────
let audioCtx = null;
let audioGainNode = null;
let isAudioBoosted = false;

function toggleAudioBoost() {
    const video = getCinemaVideoElement();
    if (!video) return;

    try {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
            const source = audioCtx.createMediaElementSource(video);
            audioGainNode = audioCtx.createGain();
            source.connect(audioGainNode);
            audioGainNode.connect(audioCtx.destination);
        }

        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        isAudioBoosted = !isAudioBoosted;
        if (audioGainNode) {
            audioGainNode.gain.value = isAudioBoosted ? 1.6 : 1.0;
        }

        const btn = document.getElementById('audioBoostBtn');
        const text = document.getElementById('audioBoostText');
        if (btn) btn.classList.toggle('boost-active', isAudioBoosted);
        if (text) text.textContent = isAudioBoosted ? 'Boost (160% ON)' : 'Boost (150%)';
        showToast(isAudioBoosted ? '🔊 Dialogue Audio Boosted (160%)' : 'Audio returned to normal', 'info');
    } catch (e) {
        showToast('Audio Boost not supported on this browser/stream', 'warning');
    }
}

// ─── SUBTITLE SYNC OFFSET ADJUSTMENT (Stremio style) ─────────────────────────
let currentSubtitleSyncOffset = 0;

function adjustSubtitleSync(delta) {
    currentSubtitleSyncOffset += delta;
    currentSubtitleSyncOffset = Math.max(-5, Math.min(5, Math.round(currentSubtitleSyncOffset * 10) / 10));
    const label = document.getElementById('subSyncLabel');
    if (label) {
        label.textContent = (currentSubtitleSyncOffset >= 0 ? '+' : '') + currentSubtitleSyncOffset.toFixed(1) + 's';
    }

    const video = getCinemaVideoElement();
    if (video && video.textTracks) {
        for (let i = 0; i < video.textTracks.length; i++) {
            const track = video.textTracks[i];
            if (track.cues) {
                for (let j = 0; j < track.cues.length; j++) {
                    const cue = track.cues[j];
                    if (cue._origStart === undefined) {
                        cue._origStart = cue.startTime;
                        cue._origEnd = cue.endTime;
                    }
                    cue.startTime = Math.max(0, cue._origStart + currentSubtitleSyncOffset);
                    cue.endTime = Math.max(0, cue._origEnd + currentSubtitleSyncOffset);
                }
            }
        }
    }
    showToast(`Subtitle sync: ${(currentSubtitleSyncOffset >= 0 ? '+' : '') + currentSubtitleSyncOffset.toFixed(1)}s`);
}

// ─── SMART RESUME PROMPT (Prime Video style) ─────────────────────────────────
let pendingResumeTimestamp = 0;
let resumePromptTimer = null;

function confirmResumePlayback() {
    const prompt = document.getElementById('resumePromptBox');
    if (prompt) prompt.style.display = 'none';
    clearTimeout(resumePromptTimer);
    if (pendingResumeTimestamp > 0 && plyrInstance) {
        plyrInstance.currentTime = pendingResumeTimestamp;
        plyrInstance.play().catch(() => {});
        showToast(`Resumed at ${formatTime(pendingResumeTimestamp)}`);
    }
}

function dismissResumePlayback() {
    const prompt = document.getElementById('resumePromptBox');
    if (prompt) prompt.style.display = 'none';
    clearTimeout(resumePromptTimer);
    pendingResumeTimestamp = 0;
    if (plyrInstance) {
        plyrInstance.currentTime = 0;
        plyrInstance.play().catch(() => {});
    }
}

// ─── IN-PLAYER EPISODES DRAWER ───────────────────────────────────────────────
function togglePlayerEpisodesDrawer() {
    const drawer = document.getElementById('playerEpisodesDrawer');
    if (!drawer) return;
    const isVisible = drawer.style.display === 'block';
    drawer.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        renderPlayerDrawerEpisodes();
    }
}

// Cached drawer episode data to avoid repeated fetches
let _drawerEpisodeData = null;

async function renderPlayerDrawerEpisodes() {
    const seasonTabs = document.getElementById('playerDrawerSeasonTabs');
    const episodesGrid = document.getElementById('playerDrawerEpisodesGrid');
    if (!currentPlayingSubjectId || !episodesGrid) return;

    try {
        // Use cached data if subject matches, otherwise fetch fresh
        let seasons;
        if (_drawerEpisodeData && _drawerEpisodeData.subject_id === currentPlayingSubjectId) {
            seasons = _drawerEpisodeData.seasons;
        } else {
            const res = await fetch(`/episodes/${currentPlayingSubjectId}`);
            const data = await res.json();
            seasons = data.seasons || [];
            _drawerEpisodeData = { subject_id: currentPlayingSubjectId, seasons };
        }

        if (!seasons.length) {
            episodesGrid.innerHTML = '<div style="color:var(--text-muted);padding:10px;">No episodes available.</div>';
            return;
        }

        // Use 'season' key (not 'season_num') — matches what api.py returns
        const activeSe = seasons.find(s => s.season === currentSeason) || seasons[0];
        const activeSeNum = activeSe.season;

        if (seasonTabs) {
            seasonTabs.innerHTML = seasons.map(s => `
                <button class="filter-pill ${s.season === activeSeNum ? 'active' : ''}" onclick="switchPlayerDrawerSeason(${s.season})">
                    Season ${s.season}
                </button>
            `).join('');
        }

        const eps = activeSe.episodes || [];
        episodesGrid.innerHTML = eps.map(e => `
            <button class="episode-btn ${e.episode === currentEpisode && e.season === currentSeason ? 'active' : ''}" onclick="selectDrawerEpisode(${e.season}, ${e.episode})">
                <span class="ep-num">EP ${e.episode}</span>
                <span class="ep-res-badge">▶</span>
            </button>
        `).join('');
    } catch (err) {
        if (episodesGrid) episodesGrid.innerHTML = '<div style="color:var(--rose);padding:10px;">Failed to load episodes.</div>';
    }
}

function switchPlayerDrawerSeason(seasonNum) {
    currentSeason = seasonNum;
    // Update active tab UI immediately
    document.querySelectorAll('#playerDrawerSeasonTabs .filter-pill').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim() === `Season ${seasonNum}`);
    });
    // Re-render only the episodes grid for the new season (no re-fetch needed)
    const seasonTabs = document.getElementById('playerDrawerSeasonTabs');
    const episodesGrid = document.getElementById('playerDrawerEpisodesGrid');
    if (_drawerEpisodeData && episodesGrid) {
        const seasons = _drawerEpisodeData.seasons || [];
        const activeSe = seasons.find(s => s.season === seasonNum);
        if (activeSe) {
            const eps = activeSe.episodes || [];
            episodesGrid.innerHTML = eps.map(e => `
                <button class="episode-btn ${e.episode === currentEpisode && e.season === currentSeason ? 'active' : ''}" onclick="selectDrawerEpisode(${e.season}, ${e.episode})">
                    <span class="ep-num">EP ${e.episode}</span>
                    <span class="ep-res-badge">▶</span>
                </button>
            `).join('');
            return;
        }
    }
    // If cache miss, fall back to full re-render
    renderPlayerDrawerEpisodes();
}

function selectDrawerEpisode(seasonNum, episodeNum) {
    currentSeason = seasonNum;
    currentEpisode = episodeNum;
    const drawer = document.getElementById('playerEpisodesDrawer');
    if (drawer) drawer.style.display = 'none';
    playDetailEpisode(currentPlayingSubjectId, seasonNum, episodeNum);
}

function triggerSeekRipple(direction) {
    const el = document.getElementById(direction === 'left' ? 'seekRippleLeft' : 'seekRippleRight');
    if (!el) return;
    el.classList.remove('active');
    void el.offsetWidth;
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 600);
}

function startNextEpisodeCountdown() {
    if (currentEpisode <= 0) return;
    const box = document.getElementById('nextEpCountdownBox');
    const secEl = document.getElementById('nextEpSec');
    if (!box || !secEl) return;
    clearInterval(nextEpTimer);
    nextEpSecondsLeft = 5;
    secEl.textContent = '5';
    box.style.display = 'block';

    nextEpTimer = setInterval(() => {
        nextEpSecondsLeft--;
        secEl.textContent = String(nextEpSecondsLeft);
        if (nextEpSecondsLeft <= 0) {
            clearInterval(nextEpTimer);
            box.style.display = 'none';
            playNextEpisode();
        }
    }, 1000);
}

function cancelNextEpisodeAutoplay() {
    clearInterval(nextEpTimer);
    const box = document.getElementById('nextEpCountdownBox');
    if (box) box.style.display = 'none';
    showToast('Next episode autoplay cancelled');
}

function playNextEpisodeImmediately() {
    clearInterval(nextEpTimer);
    const box = document.getElementById('nextEpCountdownBox');
    if (box) box.style.display = 'none';
    playNextEpisode();
}

function getEffectiveStreamUrl(stream) {
    if (!stream || !stream.url) return '';
    const sidParam = currentPlayingSubjectId ? `&subject_id=${encodeURIComponent(currentPlayingSubjectId)}` : '';
    const ref = (stream.headers && stream.headers.Referer) ? stream.headers.Referer : 'https://movieboxonline.net/';
    return `/api/proxy/stream?url=${encodeURIComponent(stream.url)}&referer=${encodeURIComponent(ref)}${sidParam}`;
}

function switchToDirectMode() {
    currentPlaybackMode = 'direct';
    const modeSelect = document.getElementById('playbackModeSelect');
    if (modeSelect) modeSelect.value = 'direct';
    if (currentPlayingStream) {
        const t = plyrInstance ? plyrInstance.currentTime : 0;
        const src = getEffectiveStreamUrl(currentPlayingStream);
        setCinemaVideoSource(src, currentPlayingStream, activeMediaMeta?.title);
        setTimeout(() => { if (plyrInstance) { plyrInstance.currentTime = t; plyrInstance.play().catch(() => {}); } }, 500);
    }
}

function isNoticeStream(s) {
    if (!s || !s.url) return true;
    const u = s.url.toLowerCase();
    if (u.includes('80da52722ee7de7a4303290af6783424') || u.includes('/other/') || u.includes('b164fbfb4347792950bdfbfb563d39d9') || u.includes('movieboxdownload')) {
        return true;
    }
    if (s.duration_sec && s.duration_sec <= 45 && s.size_mb > 0 && s.size_mb <= 5) {
        return true;
    }
    return false;
}

// ─── QUICK PLAY ───────────────────────────────────────────────────────────────
async function quickPlay(subjectId, title, startTime = 0) {
    showToast(`Loading "${title}"…`);
    currentPlayingSubjectId = subjectId;
    currentSeason = 0;
    currentEpisode = 0;
    _drawerEpisodeData = null; // Clear episode cache for new title

    try {
        const [streamRes, captionRes, detailRes] = await Promise.allSettled([
            fetch(`/api/stream/${subjectId}?se=0&ep=0`).then(r => r.json()),
            fetch(`/api/stream/${subjectId}/captions?se=0&ep=0`).then(r => r.json()),
            fetch(`/detail/${subjectId}`).then(r => r.json())
        ]);

        const streamData  = streamRes.status  === 'fulfilled' ? streamRes.value  : { streams: [] };
        const captionData = captionRes.status === 'fulfilled' ? captionRes.value : { captions: [] };
        const detail      = detailRes.status  === 'fulfilled' ? detailRes.value  : null;

        const rawStreams  = streamData.streams || [];
        const cleanStreams = rawStreams.filter(s => !isNoticeStream(s));
        activeStreamList  = cleanStreams.length > 0 ? cleanStreams : rawStreams;
        activeCaptionList = captionData.captions || [];
        const dubs = streamData.dubs || (detail ? detail.dubs : []) || [];
        if (dubs.length > 0) {
            activeDubsList = dubs;
            currentTitleDubs = dubs;
        }
        activeFallbackServers = streamData.fallback_servers || [];
        activeMediaMeta = detail || { title: title, cover: streamData.cover };

        const playableStreams = (activeStreamList || []).filter(s => s && s.format !== 'DASH' && !s.url.includes('.mpd'));
        const streamToPlay = playableStreams.length > 0 ? playableStreams[0] : activeStreamList[0];
        if (streamToPlay) {
            playInCinemaModal(encodeURIComponent(JSON.stringify(streamToPlay)), startTime);
            // If fallback servers not yet resolved (background IMDB lookup still running), fetch them in background
            if (activeFallbackServers.length === 0 && title) {
                setTimeout(async () => {
                    try {
                        const year = (activeMediaMeta && activeMediaMeta.release_date) ? activeMediaMeta.release_date.slice(0, 4) : '';
                        const isSer = Boolean(activeMediaMeta && (activeMediaMeta.type === 'Series' || activeMediaMeta.type === 'TV Series'));
                        const fbRes = await fetch(`/api/fallback-sources?title=${encodeURIComponent(title)}&year=${year}&is_series=${isSer}`).then(r => r.json());
                        if (fbRes.servers && fbRes.servers.length > 0 && activeFallbackServers.length === 0) {
                            activeFallbackServers = fbRes.servers;
                            updatePlayerServerSelect();
                        }
                    } catch {}
                }, 1200);
            }
        } else {
            // Check if this title is a TV Series (Season 1 Episode 1)
            const s1Res = await fetch(`/api/stream/${subjectId}?se=1&ep=1`).then(r => r.json()).catch(() => null);
            const s1Streams = ((s1Res && s1Res.streams) || []).filter(s => !isNoticeStream(s));
            if (s1Streams.length > 0) {
                activeStreamList = s1Streams;
                currentSeason = 1;
                currentEpisode = 1;
                if (s1Res.dubs && s1Res.dubs.length > 0) {
                    activeDubsList = s1Res.dubs;
                    currentTitleDubs = s1Res.dubs;
                }
                if (s1Res.fallback_servers) {
                    activeFallbackServers = s1Res.fallback_servers;
                }
                playInCinemaModal(encodeURIComponent(JSON.stringify(s1Streams[0])), startTime);
                return;
            }

            // Check if upcoming / pre-release - do NOT preview video, only notify
            if ((detail && detail.coming_soon) || (streamData && streamData.coming_soon)) {
                showToast(`"${title}" has not been released yet (Coming Soon)`, 'info');
                return;
            }

            // Check if backup servers are available (from streamData or on-demand resolution)
            if (activeFallbackServers && activeFallbackServers.length > 0) {
                const srvName = activeFallbackServers[0].name.split('(')[1]?.replace(')', '') || 'Cloud';
                showToast(`CineScope Direct has no stream — playing from Backup Server (${srvName})…`, 'info');
                playInCinemaModal(null, startTime, activeFallbackServers[0]);
                return;
            }

            // Fallback resolver query on demand
            try {
                const year = (detail && detail.release_date) ? detail.release_date.slice(0, 4) : '';
                const isSer = Boolean(detail && detail.type === 'Series');
                const fbRes = await fetch(`/api/fallback-sources?title=${encodeURIComponent(title)}&year=${year}&is_series=${isSer}`).then(r => r.json());
                if (fbRes.servers && fbRes.servers.length > 0) {
                    activeFallbackServers = fbRes.servers;
                    const srvName = fbRes.servers[0].name.split('(')[1]?.replace(')', '') || 'Cloud';
                    showToast(`CineScope Direct has no stream — playing from Backup Server (${srvName})…`, 'info');
                    playInCinemaModal(null, startTime, fbRes.servers[0]);
                    return;
                }
            } catch {}

            showToast(`No stream found for "${title}"`, 'error');
        }
    } catch (err) {
        showToast(`Failed to play: ${err.message}`, 'error');
    }
}

function updatePlayerServerSelect() {
    const serverSelect = document.getElementById('playerServerSelect');
    if (serverSelect) {
        let optionsHtml = '';
        if (activeStreamList && activeStreamList.length > 0) {
            optionsHtml += `<option value="direct" ${currentSelectedServer === 'direct' ? 'selected' : ''}>Server 1 (CineScope Direct 1080p)</option>`;
        } else {
            optionsHtml += `<option value="direct" disabled>Server 1 (CineScope Direct - No Streams)</option>`;
        }

        if (activeFallbackServers && activeFallbackServers.length > 0) {
            optionsHtml += activeFallbackServers.map(s =>
                `<option value="${s.id}" ${currentSelectedServer === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
            ).join('');
        }
        serverSelect.innerHTML = optionsHtml;
    }

    // Populate In-Player Popover Menu (Top HUD dropdown)
    const inPlayerServerList = document.getElementById('inPlayerServerList');
    if (inPlayerServerList) {
        let srvHtml = '';
        if (activeStreamList && activeStreamList.length > 0) {
            srvHtml += `<button class="popover-item ${currentSelectedServer === 'direct' ? 'active' : ''}" onclick="selectInPlayerServer('direct', 'Server 1 (Direct)')">
                <span>⚡ Server 1 (MovieBox Direct 1080p)</span>
                ${currentSelectedServer === 'direct' ? '<span>✓</span>' : ''}
            </button>`;
        }
        if (activeFallbackServers && activeFallbackServers.length > 0) {
            srvHtml += activeFallbackServers.map(s => {
                const isSel = currentSelectedServer === s.id;
                const shortName = s.name.replace('Server ', 'S').replace(' (', ' - ').replace(')', '');
                return `<button class="popover-item ${isSel ? 'active' : ''}" onclick="selectInPlayerServer('${s.id}', '${escapeHtml(shortName)}')">
                    <span>☁️ ${escapeHtml(s.name)}</span>
                    ${isSel ? '<span>✓</span>' : ''}
                </button>`;
            }).join('');
        }
        inPlayerServerList.innerHTML = srvHtml;
    }

    // Populate 1-Click Server Selector Strip (Below video stage)
    const pillsWrap = document.getElementById('playerServerPills');
    if (pillsWrap) {
        let pillsHtml = '';
        if (activeStreamList && activeStreamList.length > 0) {
            const isDirectSel = currentSelectedServer === 'direct';
            pillsHtml += `<button class="server-pill-tab ${isDirectSel ? 'active' : ''}" onclick="changePlayerServer('direct')">
                <span class="server-pill-icon">⚡</span>
                <span class="server-pill-name">S1: Direct (1080p)</span>
                ${isDirectSel ? '<span class="server-pill-active-dot"></span>' : ''}
            </button>`;
        }
        if (activeFallbackServers && activeFallbackServers.length > 0) {
            pillsHtml += activeFallbackServers.map(s => {
                const isSel = currentSelectedServer === s.id;
                const short = s.name.replace('Server ', 'S').replace(' (', ' - ').replace(')', '');
                return `<button class="server-pill-tab ${isSel ? 'active' : ''}" onclick="changePlayerServer('${s.id}')">
                    <span class="server-pill-icon">☁</span>
                    <span class="server-pill-name">${escapeHtml(short)}</span>
                    ${isSel ? '<span class="server-pill-active-dot"></span>' : ''}
                </button>`;
            }).join('');
        }
        pillsWrap.innerHTML = pillsHtml;
    }

    // Update Popout/External Player button in footer
    const extBtn = document.getElementById('playerExternalLinkBtn');
    if (extBtn) {
        if (currentSelectedServer !== 'direct') {
            const curTarget = (activeFallbackServers || []).find(s => s.id === currentSelectedServer);
            if (curTarget && curTarget.url) {
                extBtn.href = curTarget.url;
                extBtn.style.display = 'inline-flex';
            } else {
                extBtn.style.display = 'none';
            }
        } else {
            extBtn.style.display = 'none';
        }
    }
}

function changePlayerServer(serverId) {
    const video = getCinemaVideoElement();
    const iframe = document.getElementById('cinemaIframe');
    const plyrEl = document.querySelector('#videoStage .plyr');
    const stage = document.getElementById('videoStage');
    const quickBar = document.getElementById('inPlayerQuickBar');
    const qualityBadge = document.getElementById('inPlayerQualityBadge');
    const dubBadge = document.getElementById('inPlayerDubBadge');

    if (serverId === 'direct') {
        if (!activeStreamList || activeStreamList.length === 0) {
            showToast('MovieBox Direct has no stream for this title. Using Backup Server.', 'info');
            updatePlayerServerSelect();
            return;
        }
        if (stage) stage.classList.remove('is-iframe-mode');
        if (iframe) {
            iframe.src = 'about:blank';
            iframe.style.display = 'none';
        }
        if (plyrEl) plyrEl.style.display = '';
        if (video) video.style.display = 'block';
        if (quickBar) quickBar.style.display = 'flex';
        if (qualityBadge) qualityBadge.style.display = '';
        if (dubBadge) dubBadge.style.display = '';

        currentSelectedServer = 'direct';
        updatePlayerServerSelect();
        safeText('inPlayerCurrentServerText', 'Server 1 (Direct)');
        if (currentPlayingStream) {
            safeText('playerQualityTag', currentPlayingStream.quality || '1080p');
            safeText('playerMediaSub', `${currentPlayingStream.format || 'MP4'} • ${currentPlayingStream.codec || 'H.264'}`);
            setCinemaVideoSource(getEffectiveStreamUrl(currentPlayingStream), currentPlayingStream, activeMediaMeta?.title);
        }
        if (plyrInstance) plyrInstance.play().catch(() => {});
        showToast('Switched to MovieBox Direct (Full Features)');
        return;
    }

    // Switch to a fallback server
    const targetServer = (activeFallbackServers || []).find(s => s.id === serverId);
    if (!targetServer) {
        showToast('Server not found', 'error');
        return;
    }

    if (hlsInstance) {
        try { hlsInstance.destroy(); } catch {}
        hlsInstance = null;
    }
    if (plyrInstance) {
        try { plyrInstance.pause(); } catch {}
    }
    if (stage) stage.classList.add('is-iframe-mode');
    if (plyrEl) plyrEl.style.display = 'none';
    if (video) {
        video.style.display = 'none';
        try { video.pause(); } catch {}
    }
    // In iframe mode, direct controls DO NOT apply - hide quickbar completely
    if (quickBar) quickBar.style.display = 'none';
    if (qualityBadge) qualityBadge.style.display = 'none';
    if (dubBadge) dubBadge.style.display = 'none';

    if (iframe) {
        iframe.style.display = 'block';
        iframe.src = targetServer.url;
    }
    currentSelectedServer = targetServer.id;
    updatePlayerServerSelect();

    const shortName = targetServer.name.replace('Server ', 'S').replace(' (', ' - ').replace(')', '');
    safeText('inPlayerCurrentServerText', shortName);
    safeText('playerQualityTag', 'Cloud HD');
    safeText('playerMediaSub', `${targetServer.name} • Embedded Player`);
    safeText('playerSizeStat', 'Cloud Stream');
    safeText('playerCodecStat', 'Auto Adaptive');

    showToast(`Switched to ${targetServer.name}`);
    // Keep series ribbon visible after server switch
    renderPlayerSeriesRibbon();
}

// ─── CINEMA PLAYER MODAL ─────────────────────────────────────────────────────
function playInCinemaModal(encodedStream, seekToTime = 0, fallbackServer = null) {
    let stream = null;
    if (encodedStream) {
        try { stream = JSON.parse(decodeURIComponent(encodedStream)); } catch {}
    }
    currentPlayingStream = stream;

    const modal = document.getElementById('playerModal');
    const video = getCinemaVideoElement();
    const iframe = document.getElementById('cinemaIframe');
    const plyrEl = document.querySelector('#videoStage .plyr');

    const baseTitle = (activeMediaMeta && activeMediaMeta.title) ? activeMediaMeta.title : 'MovieBox Stream';
    const isSeries = Boolean(currentEpisode > 0 || (activeMediaMeta && (activeMediaMeta.type === 'Series' || activeMediaMeta.type === 'TV Series')));
    const epSuffix = (isSeries && currentEpisode > 0) ? ` • S${currentSeason || 1} E${currentEpisode}` : '';
    const titleText = `${baseTitle}${epSuffix}`;
    safeText('playerMediaTitle', titleText);

    // Ambient glow backlight
    const poster = activeMediaMeta ? activeMediaMeta.cover : null;
    const glow = document.getElementById('playerAmbientGlow');
    if (glow) {
        if (poster) {
            glow.style.backgroundImage = `url('${poster}')`;
            glow.style.opacity = '0.55';
        } else {
            glow.style.opacity = '0';
        }
    }

    // Episode buttons
    const nextEpBtn = document.getElementById('playerNextEpBtn');
    const epDrawerBtn = document.getElementById('inPlayerEpisodesBtn');
    if (isSeries || currentEpisode > 0) {
        if (epDrawerBtn) epDrawerBtn.style.display = 'inline-flex';
        if (nextEpBtn) {
            nextEpBtn.style.display = 'inline-flex';
            nextEpBtn.textContent = `Next Ep ${currentEpisode + 1} →`;
        }
    } else {
        if (epDrawerBtn) epDrawerBtn.style.display = 'none';
        if (nextEpBtn) nextEpBtn.style.display = 'none';
    }

    // Populate Audio dubs (always visible and selectable)
    const audioGroup = document.getElementById('playerAudioGroup');
    const audioSelect = document.getElementById('playerAudioSelect');
    const dubsToUse = (currentTitleDubs && currentTitleDubs.length > 0) ? currentTitleDubs : activeDubsList;
    if (dubsToUse && dubsToUse.length > 0) {
        audioGroup.style.display = 'flex';
        audioSelect.innerHTML = dubsToUse.map(d =>
            `<option value="${d.subject_id}" ${d.subject_id === currentPlayingSubjectId ? 'selected' : ''}>${escapeHtml(d.lang_name || d.language || 'Audio Dub')}</option>`
        ).join('');
    } else {
        audioGroup.style.display = 'flex';
        audioSelect.innerHTML = '<option value="">Original Audio</option>';
    }

    if (window._resetFallbackFlag) window._resetFallbackFlag();

    // Reset speed select
    const speedSelect = document.getElementById('playerSpeedSelect');
    if (speedSelect) speedSelect.value = '1';
    if (plyrInstance) plyrInstance.speed = 1.0;

    closeMiniPlayer();

    // Check if we should play via fallback server or direct stream
    if (fallbackServer || (!stream && activeFallbackServers && activeFallbackServers.length > 0)) {
        const srv = fallbackServer || activeFallbackServers[0];
        currentSelectedServer = srv.id;
        updatePlayerServerSelect();

        const stage = document.getElementById('videoStage');
        if (stage) stage.classList.add('is-iframe-mode');

        if (hlsInstance) {
            try { hlsInstance.destroy(); } catch {}
            hlsInstance = null;
        }
        if (plyrInstance) {
            try { plyrInstance.pause(); } catch {}
        }
        if (plyrEl) plyrEl.style.display = 'none';
        if (video) {
            video.style.display = 'none';
            try { video.pause(); } catch {}
        }

        const quickBar = document.getElementById('inPlayerQuickBar');
        if (quickBar) quickBar.style.display = 'none';
        const qualityBadge = document.getElementById('inPlayerQualityBadge');
        if (qualityBadge) {
            qualityBadge.style.display = 'inline-flex';
            qualityBadge.textContent = 'Cloud HD';
        }
        const dubBadge = document.getElementById('inPlayerDubBadge');
        if (dubBadge) {
            dubBadge.style.display = (dubsToUse && dubsToUse.length > 0) ? 'inline-flex' : 'none';
        }

        if (iframe) {
            iframe.style.display = 'block';
            iframe.src = srv.url;
        }

        safeText('inPlayerTitle', titleText);
        const shortName = srv.name.replace('Server ', 'S').replace(' (', ' - ').replace(')', '');
        safeText('inPlayerCurrentServerText', shortName);
        safeText('playerQualityTag', 'Cloud HD');
        safeText('playerMediaSub', `${srv.name} • Embedded Player`);
        safeText('playerSizeStat', 'Cloud Stream');
        safeText('playerCodecStat', 'Auto Adaptive');
        safeAttr('playerExternalLink', 'href', srv.url);

        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        renderPlayerSeriesRibbon();
        showToast(`Streaming via ${srv.name}`);

        // Trigger pre-roll ad overlay if eligible
        if (typeof AdEngine !== 'undefined') {
            AdEngine.runPrerollIfEligible(() => {});
        }
        return;
    }

    // Playing direct stream
    currentSelectedServer = 'direct';
    updatePlayerServerSelect();

    const stage = document.getElementById('videoStage');
    if (stage) stage.classList.remove('is-iframe-mode');

    if (iframe) {
        iframe.src = 'about:blank';
        iframe.style.display = 'none';
    }
    if (plyrEl) plyrEl.style.display = '';
    if (video) video.style.display = 'block';

    const quickBar = document.getElementById('inPlayerQuickBar');
    if (quickBar) quickBar.style.display = 'flex';
    const qualityBadge = document.getElementById('inPlayerQualityBadge');
    if (qualityBadge) qualityBadge.style.display = '';
    const dubBadge = document.getElementById('inPlayerDubBadge');
    if (dubBadge) dubBadge.style.display = '';

    safeText('playerQualityTag', stream ? (stream.quality || '1080p') : '1080p');
    safeText('playerMediaSub', stream ? `${stream.format || 'MP4'} • ${stream.codec || 'H.264'}` : 'Direct MP4');
    safeText('playerSizeStat', (stream && stream.size_mb > 0) ? `${stream.size_mb} MB` : 'DASH Adaptive');
    safeText('playerCodecStat', stream ? (stream.codec || 'H.264/AAC') : 'H.264');
    safeAttr('playerExternalLink', 'href', stream ? stream.url : '#');

    // Populate Quality selector - show playable MP4 streams
    const qualitySelect = document.getElementById('playerQualitySelect');
    const playableStreams = (activeStreamList || []).filter(s => s && s.format !== 'DASH' && !s.url.includes('.mpd'));
    const listToRender = playableStreams.length > 0 ? playableStreams : activeStreamList;
    qualitySelect.innerHTML = listToRender.map(s =>
        `<option value="${encodeURIComponent(JSON.stringify(s))}" ${stream && s.url === stream.url ? 'selected' : ''}>${s.quality} (${s.format})</option>`
    ).join('');

    // Synchronize In-Player Top HUD & Badges
    safeText('inPlayerTitle', titleText);
    // Determine current dub name accurately — match by subject_id OR use the stream source language
    const currentDubObj = (dubsToUse && dubsToUse.find(d => d.subject_id === currentPlayingSubjectId)) || null;
    let currentDubName;
    if (currentDubObj) {
        currentDubName = currentDubObj.lang_name || currentDubObj.language || 'Audio Dub';
    } else if (dubsToUse && dubsToUse.length > 0) {
        // Likely playing original audio — label it from the detail metadata language
        const origLang = (activeMediaMeta && activeMediaMeta.language) ? activeMediaMeta.language : 'Original';
        currentDubName = origLang;
    } else {
        currentDubName = 'Original Audio';
    }
    safeText('inPlayerDubBadge', currentDubName);
    safeText('inPlayerQualityBadge', stream ? (stream.quality || '1080p FHD') : '1080p FHD');
    safeText('inPlayerCurrentAudioText', `Audio: ${currentDubName}`);
    safeText('inPlayerCurrentQualityText', `Quality: ${stream ? (stream.quality || '1080p FHD') : '1080p FHD'}`);
    safeText('inPlayerCurrentServerText', `Server: ${currentSelectedServer === 'direct' ? 'MovieBox Direct' : 'Cloud Server'}`);

    // Populate In-Player Audio Popover List (Works inside Fullscreen!)
    const inPlayerAudioList = document.getElementById('inPlayerAudioList');
    if (inPlayerAudioList) {
        if (dubsToUse && dubsToUse.length > 0) {
            inPlayerAudioList.innerHTML = dubsToUse.map(d => {
                const isSel = d.subject_id === currentPlayingSubjectId;
                const name = d.lang_name || d.language || 'Audio Dub';
                return `<button class="popover-item ${isSel ? 'active' : ''}" onclick="selectInPlayerAudio('${d.subject_id}', '${escapeHtml(name)}')">
                    <span>${escapeHtml(name)}</span>
                    ${isSel ? '<span>✓</span>' : ''}
                </button>`;
            }).join('');
        } else {
            inPlayerAudioList.innerHTML = `<button class="popover-item active" onclick="selectInPlayerAudio('', 'Original Audio')"><span>Original Audio</span><span>✓</span></button>`;
        }
    }

    // Populate In-Player Quality Popover List (Works inside Fullscreen!)
    const inPlayerQualityList = document.getElementById('inPlayerQualityList');
    if (inPlayerQualityList) {
        inPlayerQualityList.innerHTML = listToRender.map(s => {
            const isSel = Boolean(stream && s.url === stream.url);
            return `<button class="popover-item ${isSel ? 'active' : ''}" onclick="selectInPlayerQuality('${encodeURIComponent(JSON.stringify(s))}', '${s.quality}')">
                <span>${s.quality} (${s.format})</span>
                ${isSel ? '<span>✓</span>' : ''}
            </button>`;
        }).join('');
    }

    // Populate captions, auto-select English, and setup default track
    const captionSelect = document.getElementById('playerCaptionSelect');
    const subSyncGroup = document.getElementById('subSyncGroup');
    currentSubtitleSyncOffset = 0;
    const subSyncLabel = document.getElementById('subSyncLabel');
    if (subSyncLabel) subSyncLabel.textContent = '0.0s';
    const inPlayerSubSyncVal = document.getElementById('inPlayerSubSyncVal');
    if (inPlayerSubSyncVal) inPlayerSubSyncVal.textContent = '0.0s';

    if (video && video.querySelectorAll) {
        video.querySelectorAll('track').forEach(t => t.remove());
    }

    let defaultIndex = -1;
    if (activeCaptionList && activeCaptionList.length > 0) {
        if (subSyncGroup) subSyncGroup.style.display = 'flex';
        // Auto-detect English subtitle or default to first
        const englishIndex = activeCaptionList.findIndex(c => (c.language || '').toLowerCase().includes('eng'));
        defaultIndex = englishIndex >= 0 ? englishIndex : 0;
        const selectedSub = activeCaptionList[defaultIndex];

        captionSelect.innerHTML = '<option value="">Subtitles Off</option>' +
            activeCaptionList.map((c, idx) => `<option value="${c.url}" ${idx === defaultIndex ? 'selected' : ''}>${escapeHtml(c.language || 'Unknown')}</option>`).join('');

        if (selectedSub) {
            safeText('inPlayerCurrentSubText', `Subtitles: ${selectedSub.language || 'English'}`);
            const proxyVttUrl = `/api/proxy/caption?url=${encodeURIComponent(selectedSub.url)}`;
            const track = document.createElement('track');
            track.kind = 'captions';
            track.label = selectedSub.language || 'English';
            track.srclang = selectedSub.code || 'en';
            track.src = proxyVttUrl;
            track.default = true;
            track.addEventListener('load', function() {
                if (this.track) this.track.mode = 'showing';
            });
            if (video) {
                video.appendChild(track);
                if (track.track) track.track.mode = 'showing';
            }
            if (plyrInstance) {
                try { plyrInstance.toggleCaptions(true); } catch {}
            }
        }
    } else {
        if (subSyncGroup) subSyncGroup.style.display = 'none';
        captionSelect.innerHTML = '<option value="">No Subtitles Available</option>';
        safeText('inPlayerCurrentSubText', 'Subtitles: Off');
    }

    // Populate In-Player Subtitles Popover List
    const inPlayerSubList = document.getElementById('inPlayerSubList');
    if (inPlayerSubList) {
        let subHtml = `<button class="popover-item ${defaultIndex < 0 ? 'active' : ''}" onclick="selectInPlayerSub('', 'Off')"><span>Subtitles Off</span></button>`;
        if (activeCaptionList && activeCaptionList.length > 0) {
            subHtml += activeCaptionList.map((c, idx) => {
                const isSel = idx === defaultIndex;
                const lang = c.language || 'English';
                return `<button class="popover-item ${isSel ? 'active' : ''}" onclick="selectInPlayerSub('${c.url}', '${escapeHtml(lang)}')">
                    <span>${escapeHtml(lang)}</span>
                    ${isSel ? '<span>✓</span>' : ''}
                </button>`;
            }).join('');
        }
        inPlayerSubList.innerHTML = subHtml;
    }

    // Populate In-Player Servers Popover List
    const inPlayerServerList = document.getElementById('inPlayerServerList');
    if (inPlayerServerList) {
        let srvHtml = `<button class="popover-item ${currentSelectedServer === 'direct' ? 'active' : ''}" onclick="selectInPlayerServer('direct', 'MovieBox Direct')">
            <span>Server 1 (Direct 1080p)</span>
            ${currentSelectedServer === 'direct' ? '<span>✓</span>' : ''}
        </button>`;
        if (activeFallbackServers && activeFallbackServers.length > 0) {
            srvHtml += activeFallbackServers.map(s => {
                const isSel = currentSelectedServer === s.id;
                return `<button class="popover-item ${isSel ? 'active' : ''}" onclick="selectInPlayerServer('${s.id}', '${escapeHtml(s.name)}')">
                    <span>${escapeHtml(s.name)}</span>
                    ${isSel ? '<span>✓</span>' : ''}
                </button>`;
            }).join('');
        }
        inPlayerServerList.innerHTML = srvHtml;
    }

    // Configure External / Download links with clean, sanitized filename (NEVER raw UUID)
    const cleanTitle = (titleText || 'Movie').replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').trim();
    const safeQuality = stream ? (stream.quality || '1080p') : '1080p';
    const cleanFilename = `${cleanTitle}_(${safeQuality}).mp4`;
    const safeDownloadUrl = stream ? `/api/proxy/stream?url=${encodeURIComponent(stream.url)}&referer=${encodeURIComponent(stream.headers?.Referer || '')}&download=true&filename=${encodeURIComponent(cleanFilename)}` : '#';
    safeAttr('playerExternalLink', 'href', safeDownloadUrl);
    safeAttr('playerExternalLink', 'download', cleanFilename);

    // Toggle Legacy In-Player Episodes Drawer Button
    const legacyEpDrawerBtn = document.getElementById('playerEpisodesDrawerBtn');
    if (legacyEpDrawerBtn) {
        legacyEpDrawerBtn.style.display = (currentEpisode > 0 || (activeMediaMeta && activeMediaMeta.type === 'Series')) ? 'inline-flex' : 'none';
    }

    // Set video source and load via unified player engine (HLS.js / Plyr / HTML5)
    if (stream) {
        const src = getEffectiveStreamUrl(stream);
        setCinemaVideoSource(src, stream, titleText);
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Smart Quick-Resume Prompt (Prime Video / Netflix UX)
    const continueList = getContinueWatching();
    const existingProgress = continueList.find(c => c.subject_id === currentPlayingSubjectId && (!c.season || c.season === currentSeason) && (!c.episode || c.episode === currentEpisode));
    const resumePrompt = document.getElementById('resumePromptBox');
    if (existingProgress && existingProgress.current_time > 20 && (!existingProgress.duration || existingProgress.current_time < existingProgress.duration * 0.92) && seekToTime <= 0) {
        pendingResumeTimestamp = existingProgress.current_time;
        if (resumePrompt) {
            const timeText = document.getElementById('resumeTimestampText');
            if (timeText) timeText.textContent = `at ${formatTime(existingProgress.current_time)}`;
            resumePrompt.style.display = 'flex';
            clearTimeout(resumePromptTimer);
            resumePromptTimer = setTimeout(() => {
                if (resumePrompt) resumePrompt.style.display = 'none';
            }, 8000);
        }
    } else {
        if (resumePrompt) resumePrompt.style.display = 'none';
    }

    // Start playback with browser autoplay policy resilience & AdEngine pre-roll
    const startPlayback = () => {
        if (!plyrInstance) return;
        const playPromise = plyrInstance.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                if (seekToTime > 0) {
                    setTimeout(() => { if (plyrInstance) plyrInstance.currentTime = seekToTime; }, 300);
                }
            }).catch(err => {
                console.warn('Autoplay prevented. Retrying muted:', err);
                plyrInstance.muted = true;
                plyrInstance.play().then(() => {
                    showToast('Playback started (Muted — click volume to unmute)', 'info');
                }).catch(() => {
                    showToast('Click play button to start watching', 'info');
                });
            });
        }
    };

    if (typeof AdEngine !== 'undefined') {
        AdEngine.runPrerollIfEligible(startPlayback);
    } else {
        setTimeout(startPlayback, 100);
        if (video) {
            video.addEventListener('canplay', () => { startPlayback(); }, { once: true });
        }
    }
    renderPlayerSeriesRibbon();

    // Netflix auto-hide cursor during playback
    const stageEl = document.getElementById('videoStage');
    if (stageEl && !stageEl.dataset.cursorBound) {
        stageEl.dataset.cursorBound = 'true';
        let curTimer = null;
        stageEl.addEventListener('mousemove', () => {
            stageEl.classList.remove('hide-cursor');
            clearTimeout(curTimer);
            curTimer = setTimeout(() => {
                if (plyrInstance && !plyrInstance.paused) {
                    stageEl.classList.add('hide-cursor');
                }
            }, 2500);
        });
    }

    showToast(`Streaming ${stream ? stream.quality || 'HD' : 'HD'} ${stream ? stream.format || 'MP4' : ''}`);
}

function changePlayerAudioDub(dubSubjectId) {
    if (!dubSubjectId) return;
    const dubsToUse = (currentTitleDubs && currentTitleDubs.length > 0) ? currentTitleDubs : activeDubsList;
    const dub = dubsToUse.find(d => d.subject_id === dubSubjectId);
    const dubName = dub ? (dub.lang_name || dub.language || 'Audio Dub') : ((activeMediaMeta && activeMediaMeta.language) || 'Original');
    // Update the HUD badges immediately before async switch
    safeText('inPlayerDubBadge', dubName);
    safeText('inPlayerCurrentAudioText', `Audio: ${dubName}`);
    if (dubSubjectId === currentPlayingSubjectId) return; // Already playing this dub
    switchAudioDub(dubSubjectId, dubName);
}

function playNextEpisode() {
    if (currentEpisode <= 0) return;
    const nextEp = currentEpisode + 1;
    currentEpisode = nextEp;
    document.getElementById('resolverEpisodeInput').value = nextEp;
    showToast(`Loading Episode ${nextEp}…`);
    executeResolver().then(() => {
        if (activeStreamList.length > 0) playInCinemaModal(encodeURIComponent(JSON.stringify(activeStreamList[0])));
    });
}

function changePlaybackMode(mode) {
    currentPlaybackMode = mode;
    if (currentPlayingStream) {
        const t = plyrInstance ? plyrInstance.currentTime : 0;
        const src = getEffectiveStreamUrl(currentPlayingStream);
        setCinemaVideoSource(src, currentPlayingStream, activeMediaMeta?.title);
        setTimeout(() => { if (plyrInstance) { plyrInstance.currentTime = t; plyrInstance.play().catch(() => {}); } }, 300);
        showToast(`Route: ${mode === 'proxy' ? 'Fast Proxy' : 'Direct CDN'}`);
    }
}

function changePlayerQuality(encodedStream) {
    if (!encodedStream || !plyrInstance) return;
    const stream = JSON.parse(decodeURIComponent(encodedStream));
    const t = plyrInstance.currentTime;
    currentPlayingStream = stream;
    const src = getEffectiveStreamUrl(stream);
    setCinemaVideoSource(src, stream, activeMediaMeta?.title);
    safeText('playerQualityTag', stream.quality || '1080p');
    safeText('inPlayerQualityBadge', stream.quality || '1080p');
    safeText('inPlayerCurrentQualityText', `Quality: ${stream.quality || '1080p'}`);
    setTimeout(() => { if (plyrInstance) { plyrInstance.currentTime = t; plyrInstance.play().catch(() => {}); } }, 300);
    showToast(`Quality: ${stream.quality}`);
}

function changePlayerSubtitle(subUrl) {
    const video = getCinemaVideoElement();
    if (video && video.querySelectorAll) {
        video.querySelectorAll('track').forEach(t => t.remove());
    }
    if (!subUrl) {
        if (plyrInstance) {
            try { plyrInstance.toggleCaptions(false); } catch {}
        }
        showToast('Subtitles off');
        return;
    }

    const subObj = (activeCaptionList || []).find(c => c.url === subUrl);
    const lang = subObj ? (subObj.language || 'English') : 'Subtitle';
    const code = subObj ? (subObj.code || 'en') : 'en';

    const finalTrackUrl = (subUrl.startsWith('blob:') || subUrl.startsWith('/api/proxy/online-caption'))
        ? subUrl
        : `/api/proxy/caption?url=${encodeURIComponent(subUrl)}`;

    const track = document.createElement('track');
    track.kind = 'captions';
    track.label = lang;
    track.srclang = code;
    track.src = finalTrackUrl;
    track.default = true;
    track.addEventListener('load', function() {
        if (this.track) this.track.mode = 'showing';
    });
    if (video) {
        video.appendChild(track);
        if (track.track) track.track.mode = 'showing';
    }

    if (plyrInstance) {
        try { plyrInstance.toggleCaptions(true); } catch {}
    }
    showToast(`Subtitles loaded: ${lang}`);
}

function refreshInPlayerSubMenu(activeUrl) {
    const inPlayerSubList = document.getElementById('inPlayerSubList');
    if (!inPlayerSubList) return;
    let subHtml = `<button class="popover-item ${!activeUrl ? 'active' : ''}" onclick="selectInPlayerSub('', 'Off')"><span>Subtitles Off</span>${!activeUrl ? '<span>✓</span>' : ''}</button>`;
    if (activeCaptionList && activeCaptionList.length > 0) {
        subHtml += activeCaptionList.map(c => {
            const isSel = c.url === activeUrl;
            const lang = c.language || 'English';
            return `<button class="popover-item ${isSel ? 'active' : ''}" onclick="selectInPlayerSub('${c.url}', '${escapeHtml(lang)}')">
                <span>${escapeHtml(lang)}</span>
                ${isSel ? '<span>✓</span>' : ''}
            </button>`;
        }).join('');
    }
    inPlayerSubList.innerHTML = subHtml;
}

function handleLocalSubtitleUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        let content = e.target.result;
        if (!content || !content.trim()) {
            showToast('Empty subtitle file', 'error');
            return;
        }
        // Convert SRT to WebVTT if needed
        if (!content.trim().startsWith('WEBVTT')) {
            content = "WEBVTT\n\n" + content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        }
        const blob = new Blob([content], { type: 'text/vtt; charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const namePart = file.name.replace(/\.[^/.]+$/, "").slice(0, 20);
        const customItem = {
            id: 'custom_' + Date.now(),
            language: `📁 Local (${namePart})`,
            code: 'local',
            url: blobUrl,
            isCustom: true
        };
        activeCaptionList.unshift(customItem);
        selectInPlayerSub(blobUrl, customItem.language);
        closeAllInPlayerMenus();
        showToast(`Loaded local subtitle: ${file.name}`, 'success');
    };
    reader.onerror = function() {
        showToast('Failed to read subtitle file', 'error');
    };
    reader.readAsText(file);
    event.target.value = '';
}

let allOnlineSubs = [];
let currentOnlineSubLang = 'all';

function openOnlineSubtitlesModal(event) {
    if (event) event.stopPropagation();
    closeAllInPlayerMenus();
    const modal = document.getElementById('onlineSubsModal');
    if (!modal) return;

    const title = (activeMediaMeta && activeMediaMeta.title) ? activeMediaMeta.title : (document.getElementById('playerMediaTitle')?.textContent || '');
    const year = (activeMediaMeta && activeMediaMeta.year) ? ` (${activeMediaMeta.year})` : '';
    safeText('onlineSubsMovieTitle', `${title}${year}`);
    safeAttr('onlineSubQueryInput', 'value', title);

    modal.style.display = 'flex';
    executeOnlineSubSearch();
}

function closeOnlineSubtitlesModal() {
    const modal = document.getElementById('onlineSubsModal');
    if (modal) modal.style.display = 'none';
}

async function executeOnlineSubSearch() {
    const listEl = document.getElementById('onlineSubsList');
    if (!listEl) return;
    const query = document.getElementById('onlineSubQueryInput')?.value.trim() || (activeMediaMeta?.title || '');
    const lang = document.getElementById('onlineSubLangSelect')?.value || 'all';

    if (!query) {
        listEl.innerHTML = '<div class="subs-empty-state">Please enter a movie title to search subtitles.</div>';
        return;
    }

    listEl.innerHTML = '<div class="subs-empty-state"><div class="spinner" style="width:24px;height:24px;margin:0 auto 10px;"></div>Searching OpenSubtitles library…</div>';

    try {
        const imdbId = (activeMediaMeta && activeMediaMeta.imdb_id) ? activeMediaMeta.imdb_id : '';
        const se = currentSeason || 0;
        const ep = currentEpisode || 0;
        const url = `/api/subtitles/online?title=${encodeURIComponent(query)}&imdb_id=${encodeURIComponent(imdbId)}&se=${se}&ep=${ep}&lang=${encodeURIComponent(lang)}`;
        const res = await fetch(url).then(r => r.json());
        allOnlineSubs = res.subtitles || [];
        renderOnlineSubsList();
    } catch (err) {
        listEl.innerHTML = `<div class="subs-empty-state" style="color:#ef4444;">Failed to fetch subtitles: ${err.message}</div>`;
    }
}

function filterOnlineSubLang(lang, btn) {
    currentOnlineSubLang = lang;
    document.querySelectorAll('.online-chip').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderOnlineSubsList();
}

function renderOnlineSubsList() {
    const listEl = document.getElementById('onlineSubsList');
    if (!listEl) return;

    let filtered = allOnlineSubs;
    if (currentOnlineSubLang && currentOnlineSubLang !== 'all') {
        filtered = allOnlineSubs.filter(s => s.language.toLowerCase() === currentOnlineSubLang.toLowerCase() || s.code.toLowerCase() === currentOnlineSubLang.toLowerCase());
    }

    if (!filtered || filtered.length === 0) {
        listEl.innerHTML = '<div class="subs-empty-state">No online subtitles found for this selection. Try searching another keyword or language.</div>';
        return;
    }

    listEl.innerHTML = filtered.map(s => `
        <div class="online-sub-item">
            <div class="online-sub-info">
                <div class="online-sub-lang-row">
                    <span class="online-sub-lang">${escapeHtml(s.language)}</span>
                    <span class="online-sub-badge">${escapeHtml(s.code.toUpperCase())}</span>
                </div>
                <div class="online-sub-filename" title="${escapeAttr(s.filename)}">${escapeHtml(s.filename)}</div>
                <div class="online-sub-stats">Downloads: ${s.downloads || '0'} · Rating: ★ ${s.rating || 'N/A'}</div>
            </div>
            <button class="btn-apply-sub" onclick="applyOnlineSubtitle('${escapeAttr(s.proxy_url)}', '${escapeAttr(s.language)}', '${escapeAttr(s.filename)}')">
                Apply Track
            </button>
        </div>
    `).join('');
}

function applyOnlineSubtitle(proxyUrl, lang, filename) {
    const onlineItem = {
        id: 'online_' + Date.now(),
        language: `🌐 ${lang} (Online)`,
        code: lang.slice(0, 2).toLowerCase(),
        url: proxyUrl,
        isOnline: true
    };
    activeCaptionList.unshift(onlineItem);
    selectInPlayerSub(proxyUrl, onlineItem.language);
    closeOnlineSubtitlesModal();
    showToast(`Loaded online subtitle: ${lang}`, 'success');
}

function changePlayerSpeed(speedVal) {
    const s = parseFloat(speedVal) || 1.0;
    if (plyrInstance) {
        plyrInstance.speed = s;
        showToast(`Speed: ${s}x`);
    }
}

function downloadCurrentStream() {
    if (!currentPlayingStream || !currentPlayingStream.url) {
        showToast('No active stream to download', 'error');
        return;
    }
    const rawTitle = (activeMediaMeta && activeMediaMeta.title) ? activeMediaMeta.title : 'Movie';
    const quality = currentPlayingStream.quality || '1080p';
    const cleanTitle = rawTitle.replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').trim();
    const filename = `${cleanTitle}_(${quality}).mp4`;
    const ref = currentPlayingStream.headers?.Referer || 'https://123moviesfree.club/';
    const downloadUrl = `/api/proxy/stream?url=${encodeURIComponent(currentPlayingStream.url)}&referer=${encodeURIComponent(ref)}&download=true&filename=${encodeURIComponent(filename)}`;
    
    showToast(`Downloading: ${filename}…`, 'info');
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 200);
}

function copyMpvCommand() {
    if (!currentPlayingStream || !currentPlayingStream.url) { showToast('No active stream', 'error'); return; }
    const referer = (currentPlayingStream.headers || {}).Referer || 'https://123moviesfree.club/';
    const cmd = `mpv "${currentPlayingStream.url}" --http-header-fields="Referer: ${referer}"`;
    navigator.clipboard.writeText(cmd).then(() => showToast('MPV command copied!')).catch(() => prompt('MPV:', cmd));
}

function closePlayerModal() {
    const modal = document.getElementById('playerModal');
    // Exit full screen if browser or stage is in fullscreen
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch {}
    }
    const stage = document.getElementById('videoStage');
    if (stage) {
        stage.classList.remove('is-fullscreen');
        stage.classList.remove('is-iframe-mode');
        stage.classList.remove('hide-cursor');
    }
    if (window._clearStreamWatchdog) window._clearStreamWatchdog();
    if (hlsInstance) {
        try { hlsInstance.destroy(); } catch {}
        hlsInstance = null;
    }
    if (plyrInstance) {
        saveContinueWatching();
        try { plyrInstance.pause(); } catch {}
    }
    const iframe = document.getElementById('cinemaIframe');
    if (iframe) {
        iframe.src = 'about:blank';
        iframe.style.display = 'none';
    }
    const plyrEl = document.querySelector('#videoStage .plyr');
    if (plyrEl) plyrEl.style.display = '';
    const video = getCinemaVideoElement();
    if (video) {
        video.style.display = 'block';
        try { video.pause(); } catch {}
        video.src = '';
    }
    const quickBar = document.getElementById('inPlayerQuickBar');
    if (quickBar) quickBar.style.display = 'flex';
    currentSelectedServer = 'direct';

    // Close any open in-player popovers that may block clicks on search
    document.querySelectorAll('.in-player-popover.open').forEach(p => p.classList.remove('open'));

    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        // Ensure no child element retains focus (blocks search input)
        try { modal.blur(); } catch {}
    }
    document.body.style.overflow = '';

    // Restore the search input's pointer-events (belt-and-suspenders)
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) {
        searchInput.style.pointerEvents = 'auto';
        searchInput.removeAttribute('disabled');
    }

    // Show exit interstitial if eligible
    if (typeof AdEngine !== 'undefined') {
        AdEngine.showExitInterstitial();
    }
}

async function renderPlayerSeriesRibbon() {
    const ribbon = document.getElementById('playerSeriesRibbon');
    if (!ribbon) return;
    const mediaType = activeMediaMeta && (activeMediaMeta.type || '');
    const isSeries = Boolean(
        currentEpisode > 0 ||
        mediaType === 'Series' ||
        mediaType === 'TV Series' ||
        (activeMediaMeta && activeMediaMeta.subject_type && activeMediaMeta.subject_type !== 1)
    );
    if (!isSeries) {
        ribbon.style.display = 'none';
        return;
    }
    ribbon.style.display = 'block';

    const seasonsWrap = document.getElementById('playerRibbonSeasons');
    const epWrap = document.getElementById('playerRibbonEpisodes');

    let seasonList = (activeMediaMeta && activeMediaMeta.seasons) ? activeMediaMeta.seasons : [];

    // Dynamically load seasons if not present in memory
    if ((!seasonList || seasonList.length === 0) && currentPlayingSubjectId) {
        try {
            const epData = await fetch(`/episodes/${currentPlayingSubjectId}`).then(r => r.json());
            if (epData && epData.seasons && epData.seasons.length > 0) {
                seasonList = epData.seasons;
                if (!activeMediaMeta) activeMediaMeta = {};
                activeMediaMeta.seasons = seasonList;
            }
        } catch {}
    }

    const curSeNum = Number(currentSeason || 1);

    if (seasonsWrap) {
        if (seasonList.length > 1) {
            seasonsWrap.innerHTML = seasonList.map(s => {
                const sNum = Number(s.season ?? s.season_number ?? 1);
                const isCur = sNum === curSeNum;
                return `
                    <button class="ribbon-season-btn ${isCur ? 'active' : ''}" onclick="switchPlayerRibbonSeason(${sNum})">
                        Season ${sNum}
                    </button>
                `;
            }).join('');
        } else {
            seasonsWrap.innerHTML = `<span class="ribbon-season-label">Season ${curSeNum}</span>`;
        }
    }

    if (epWrap) {
        const curSeasonObj = seasonList.find(s => Number(s.season ?? s.season_number ?? 1) === curSeNum);
        const maxEp = (curSeasonObj && curSeasonObj.episode_count) ? curSeasonObj.episode_count : ((activeMediaMeta && activeMediaMeta.episode_count) ? activeMediaMeta.episode_count : 24);
        let epHtml = '';
        for (let ep = 1; ep <= maxEp; ep++) {
            const isPlaying = ep === currentEpisode;
            epHtml += `<button class="ribbon-ep-btn ${isPlaying ? 'active' : ''}" onclick="playDetailEpisode('${currentPlayingSubjectId}', ${curSeNum}, ${ep})">
                Ep ${ep} ${isPlaying ? '▶' : ''}
            </button>`;
        }
        epWrap.innerHTML = epHtml;
    }
}

function switchPlayerRibbonSeason(seasonNum) {
    currentSeason = Number(seasonNum);
    currentEpisode = 1;
    renderPlayerSeriesRibbon();
    playDetailEpisode(currentPlayingSubjectId, currentSeason, 1);
}

function copyCurrentStreamUrl() {
    if (currentPlayingStream && currentPlayingStream.url) copyStreamUrl(currentPlayingStream.url);
}

function copyStreamUrl(url) {
    navigator.clipboard.writeText(url).then(() => showToast('Stream URL copied!')).catch(() => prompt('URL:', url));
}

// ─── MINI PLAYER ─────────────────────────────────────────────────────────────
function toggleMiniPlayer() {
    // Exit browser fullscreen if active
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch {}
    }
    const stage = document.getElementById('videoStage');
    if (stage) stage.classList.remove('is-fullscreen');

    const modal = document.getElementById('playerModal');
    const dock = document.getElementById('miniPlayerDock');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
    document.body.style.overflow = '';
    if (dock) dock.style.display = 'block';
    safeText('miniTitle', (activeMediaMeta && activeMediaMeta.title) ? activeMediaMeta.title : 'Playing');
}

function expandMiniPlayer() {
    const dock = document.getElementById('miniPlayerDock');
    if (dock) dock.style.display = 'none';
    const modal = document.getElementById('playerModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
    document.body.style.overflow = 'hidden';
}

function closeMiniPlayer() {
    const dock = document.getElementById('miniPlayerDock');
    dock.style.display = 'none';
}

// ─── CONTINUE WATCHING ────────────────────────────────────────────────────────
function getContinueWatching() {
    try { return JSON.parse(localStorage.getItem('moviebox_continue') || '[]'); } catch { return []; }
}

function saveContinueWatching() {
    if (!currentPlayingSubjectId || !plyrInstance || plyrInstance.duration < 10) return;
    const list = getContinueWatching().filter(i => i.subject_id !== currentPlayingSubjectId);
    list.unshift({
        subject_id: currentPlayingSubjectId,
        title: (activeMediaMeta && activeMediaMeta.title) ? activeMediaMeta.title : 'Stream',
        cover: activeMediaMeta ? activeMediaMeta.cover : null,
        currentTime: plyrInstance.currentTime,
        duration: plyrInstance.duration,
        progress: (plyrInstance.currentTime / plyrInstance.duration) * 100,
        season: currentSeason, episode: currentEpisode,
        savedAt: Date.now()
    });
    localStorage.setItem('moviebox_continue', JSON.stringify(list.slice(0, 10)));
    renderContinueWatching();
}

function formatDuration(seconds) {
    if (!seconds || seconds < 60) return `${Math.floor(seconds || 0)}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s > 0 ? s + 's' : ''}`;
}

function renderContinueWatching() {
    const shelf = document.getElementById('continueWatchingShelf');
    const grid = document.getElementById('continueWatchingGrid');
    if (!shelf || !grid) return;
    const list = getContinueWatching();
    if (!list.length) { shelf.style.display = 'none'; return; }

    shelf.style.display = 'block';
    grid.innerHTML = list.map(item => {
        const fallback = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMTUwIj48cmVjdCBmaWxsPSIjMGQxMDIwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZpbGw9IiM4YjVjZjYiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Nb3ZpZUJveDwvdGV4dD48L3N2Zz4=';
        const cover = item.cover || fallback;
        const pct = Math.min(100, Math.round(item.progress || 0));
        const timeLeft = item.duration ? formatDuration(item.duration - item.currentTime) : null;
        const epLabel = item.season > 0 ? ` · S${item.season}E${item.episode}` : '';
        return `
            <div class="continue-card" onclick="quickPlay('${item.subject_id}', '${escapeAttr(item.title)}', ${item.currentTime})">
                <div class="continue-thumb-wrap">
                    <img class="continue-thumb" src="${cover}" alt="${escapeHtml(item.title)}" onerror="this.onerror=null; this.src='${fallback}'">
                    <div class="continue-progress-overlay">
                        <span class="continue-pct-label">${pct}%</span>
                        ${timeLeft ? `<span class="continue-left-label">${timeLeft} left</span>` : ''}
                    </div>
                    <div class="continue-bar-bg"><div class="continue-bar-fill" style="width:${pct}%"></div></div>
                </div>
                <div class="continue-body">
                    <div class="continue-title">${escapeHtml(item.title)}${epLabel}</div>
                    <div class="continue-time">Resume: ${formatDuration(item.currentTime)} watched</div>
                </div>
            </div>`;
    }).join('');
}

function clearContinueWatching() {
    localStorage.removeItem('moviebox_continue');
    renderContinueWatching();
    showToast('Watch history cleared');
}

// ─── WATCHLIST ────────────────────────────────────────────────────────────────
function getWatchlist() {
    try { return JSON.parse(localStorage.getItem('moviebox_watchlist') || '[]'); } catch { return []; }
}

function updateWatchlistBadge() {
    const badge = document.getElementById('watchlistCountBadge');
    if (badge) badge.textContent = getWatchlist().length;
}

function isItemInWatchlist(sid) { return getWatchlist().some(i => i.subject_id === sid); }

function toggleDetailWatchlist() {
    if (!activeDetailItem) return;
    const inList = isItemInWatchlist(activeDetailItem.subject_id);
    let list = getWatchlist();
    if (inList) {
        list = list.filter(i => i.subject_id !== activeDetailItem.subject_id);
        document.getElementById('detailWatchlistText').textContent = 'Add to Watchlist';
        showToast(`Removed "${activeDetailItem.title}" from Watchlist`);
    } else {
        list.push(activeDetailItem);
        document.getElementById('detailWatchlistText').textContent = '✓ In Watchlist';
        showToast(`Saved "${activeDetailItem.title}" to Watchlist!`);
    }
    localStorage.setItem('moviebox_watchlist', JSON.stringify(list));
    updateWatchlistBadge();
    if (currentTab === 'watchlist') renderWatchlistGrid();
}

function renderWatchlistGrid() {
    const grid = document.getElementById('watchlistGrid');
    if (!grid) return;
    const list = getWatchlist();
    if (!list.length) {
        grid.innerHTML = '<div class="grid-loading">Your watchlist is empty. Click any title\'s detail to add.</div>';
        return;
    }
    grid.innerHTML = list.map(item => createMediaCardHtml(item)).join('');
}

function clearWatchlist() {
    if (!confirm('Clear your entire watchlist?')) return;
    localStorage.removeItem('moviebox_watchlist');
    updateWatchlistBadge();
    renderWatchlistGrid();
    showToast('Watchlist cleared');
}

// ─── DETAIL MODAL ─────────────────────────────────────────────────────────────
async function openDetailsModal(subjectId) {
    if (!subjectId || subjectId === 'None' || subjectId === 'undefined') {
        showToast('Invalid title ID', 'error');
        return;
    }
    const modal = document.getElementById('detailModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
    document.body.style.overflow = 'hidden';

    document.getElementById('detailTitleText').textContent = 'Loading…';
    document.getElementById('detailPlotText').textContent = '';
    document.getElementById('detailGenresText').textContent = '';
    document.getElementById('detailPoster').src = '';
    document.getElementById('detailTypeBadge').style.display = 'none';
    document.getElementById('detailRatingBadge').style.display = 'none';
    document.getElementById('detailYearBadge').style.display = 'none';
    document.getElementById('detailDurationBadge').style.display = 'none';
    const infoGrid = document.getElementById('detailInfoGrid');
    if (infoGrid) infoGrid.style.display = 'none';
    document.getElementById('detailSeriesContainer').style.display = 'none';
    document.getElementById('detailDubsSection').style.display = 'none';

    try {
        const [detail, episodes] = await Promise.allSettled([
            fetch(`/detail/${subjectId}`).then(r => r.json()),
            fetch(`/episodes/${subjectId}`).then(r => r.json())
        ]);

        const d = detail.status === 'fulfilled' ? detail.value : null;
        const ep = episodes.status === 'fulfilled' ? episodes.value : null;

        if (!d || !d.title) throw new Error('Failed to load details');

        document.getElementById('detailTitleText').textContent = d.title || 'Untitled';
        document.getElementById('detailPlotText').textContent = d.description || 'No synopsis available.';
        
        if (d.type) {
            const tb = document.getElementById('detailTypeBadge');
            tb.textContent = d.type;
            tb.style.display = 'inline-flex';
        }
        if (d.imdb_rating) {
            const rb = document.getElementById('detailRatingBadge');
            rb.textContent = `★ ${d.imdb_rating} IMDb`;
            rb.style.display = 'inline-flex';
        }
        if (d.release_date) {
            const yb = document.getElementById('detailYearBadge');
            yb.textContent = d.release_date.slice(0, 4);
            yb.style.display = 'inline-flex';
        }
        if (d.duration) {
            const db = document.getElementById('detailDurationBadge');
            db.textContent = d.duration;
            db.style.display = 'inline-flex';
        }

        document.getElementById('detailGenresText').textContent = d.genre || '';
        document.getElementById('detailLanguagesText').textContent = d.language || 'English';
        document.getElementById('detailCountryText').textContent = d.country || 'International';
        document.getElementById('detailSubjectIdText').textContent = subjectId;

        // Director & Cast
        const directorEl = document.getElementById('detailDirectorText');
        const castEl = document.getElementById('detailCastText');
        const dirBlock = document.getElementById('detailDirectorBlock');
        const castBlock = document.getElementById('detailCastBlock');
        if (directorEl && d.director) {
            directorEl.textContent = d.director;
            if (dirBlock) dirBlock.style.display = 'block';
        } else if (dirBlock) dirBlock.style.display = 'none';
        if (castEl && d.cast) {
            castEl.textContent = Array.isArray(d.cast) ? d.cast.slice(0, 5).join(', ') : d.cast;
            if (castBlock) castBlock.style.display = 'block';
        } else if (castBlock) castBlock.style.display = 'none';

        // IMDb vote count / viewers
        const voteEl = document.getElementById('detailVoteText');
        const voteBlock = document.getElementById('detailVoteBlock');
        if (voteEl && d.viewers) {
            const viewNum = parseInt(d.viewers);
            voteEl.textContent = viewNum > 1000000 ? `${(viewNum/1000000).toFixed(1)}M viewers` : viewNum > 1000 ? `${(viewNum/1000).toFixed(0)}K viewers` : `${viewNum} viewers`;
            if (voteBlock) voteBlock.style.display = 'block';
        } else if (voteBlock) voteBlock.style.display = 'none';

        // Content rating
        const crEl = document.getElementById('detailContentRatingBadge');
        if (crEl) {
            if (d.content_rating) {
                crEl.textContent = d.content_rating;
                crEl.style.display = 'inline-flex';
            } else {
                crEl.style.display = 'none';
            }
        }

        if (infoGrid) infoGrid.style.display = 'grid';

        if (d.cover) document.getElementById('detailPoster').src = d.cover;

        // Backdrop glow behind modal
        const detailCard = document.querySelector('.detail-modal-card');
        if (detailCard && (d.backdrop || d.cover)) {
            detailCard.style.setProperty('--detail-backdrop', `url('${d.backdrop || d.cover}')`);
        }

        // Dubs
        const dubs = d.dubs || [];
        if (dubs.length > 0) {
            document.getElementById('detailDubsSection').style.display = 'block';
            document.getElementById('detailDubsPills').innerHTML = dubs.map(dub => `
                <button class="dub-pill ${dub.subject_id === subjectId ? 'active' : ''}"
                    onclick="closeDetailModal(true); activeDubsList=[...activeDubsList]; switchAudioDub('${dub.subject_id}', '${escapeAttr(dub.lang_name)}')">
                    ${escapeHtml(dub.lang_name)}
                </button>`).join('');
        }

        activeDetailItem = {
            subject_id: subjectId,
            title: d.title || 'Untitled',
            cover: d.cover,
            rating: d.imdb_rating || 'N/A',
            year: d.release_date ? d.release_date.slice(0, 4) : '',
            type: d.type || 'Movie'
        };

        const watchlistTxt = document.getElementById('detailWatchlistText');
        if (watchlistTxt) watchlistTxt.textContent = isItemInWatchlist(subjectId) ? '✓ In Watchlist' : 'Add to Watchlist';

        const titleEl = document.getElementById('detailTitleText');
        if (d.coming_soon) {
            titleEl.innerHTML = `${escapeHtml(d.title || 'Untitled')} <span class="title-coming-soon-badge">Coming Soon</span>`;
        } else {
            titleEl.textContent = d.title || 'Untitled';
        }

        const csBadge = document.getElementById('detailComingSoonBadge');
        if (csBadge) {
            if (d.coming_soon) {
                csBadge.textContent = d.coming_soon_date ? `⏳ COMING SOON (${d.coming_soon_date})` : '⏳ COMING SOON';
                csBadge.style.display = 'inline-flex';
            } else {
                csBadge.style.display = 'none';
            }
        }

        const streamBtn = document.getElementById('detailStreamBtn');
        // Watch Trailer button — declared here so coming_soon block can reference it
        const trailerBtn = document.getElementById('detailTrailerBtn');

        if (d.coming_soon) {
            streamBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>Coming Soon</span>
            `;
            streamBtn.className = 'btn btn-secondary btn-block btn-coming-soon';
            streamBtn.style.background = '';
            streamBtn.onclick = () => {
                showToast(`"${d.title}" is an upcoming title and has not been released yet.`, 'info');
            };
            if (trailerBtn) trailerBtn.style.display = 'none';
        } else {
            streamBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <span>Stream Now</span>
            `;
            streamBtn.className = 'btn btn-primary btn-block';
            streamBtn.style.background = '';
            streamBtn.onclick = () => {
                closeDetailModal(true);
                quickPlay(subjectId, d.title);
            };
        }

        if (trailerBtn) {
            if (!d.coming_soon && d.trailer_url) {
                trailerBtn.style.display = 'block';
                trailerBtn.onclick = () => {
                    playTrailer(d.trailer_url, d.title || 'Movie', d.cover);
                };
            } else {
                trailerBtn.style.display = 'none';
            }
        }

        // Available Subtitles block
        const subsEl = document.getElementById('detailSubtitlesText');
        const subsBlock = document.getElementById('detailSubtitlesBlock');
        if (subsEl && d.subtitles_available) {
            subsEl.textContent = d.subtitles_available;
            if (subsBlock) subsBlock.style.display = 'block';
        } else if (subsBlock) subsBlock.style.display = 'none';

        // TV seasons
        const seasons = ep ? ep.seasons : null;
        
        // Set activeMediaMeta so the player ribbon has all data when playback starts
        activeMediaMeta = {
            ...d,
            seasons: (seasons && seasons.length > 0) ? seasons : (d.seasons || [])
        };
        currentPlayingSubjectId = subjectId;
        
        if (seasons && seasons.length > 0) {
            const sc = document.getElementById('detailSeriesContainer');
            sc.style.display = 'block';
            document.getElementById('detailSeasonTabs').innerHTML = seasons.map(s => `
                <button class="season-tab-btn ${s.season === 1 ? 'active' : ''}" onclick="selectDetailSeason('${subjectId}', ${s.season}, ${s.episode_count}, this)">
                    Season ${s.season}
                </button>`).join('');
            renderDetailEpisodes(subjectId, 1, seasons[0].episode_count);
        }

    } catch (err) {
        document.getElementById('detailTitleText').textContent = 'Title Unavailable';
        document.getElementById('detailPlotText').textContent = 'Could not load metadata for this title. Please try searching or selecting an alternative version.';
        showToast('Unable to load title details', 'error');
    }
}

function playTrailer(trailerUrl, title, poster) {
    if (!trailerUrl) {
        showToast('Trailer not available for this title', 'error');
        return;
    }
    const trailerStream = {
        url: trailerUrl,
        quality: 'Trailer (HD)',
        format: 'MP4',
        codec: 'H.264',
        size_mb: 0
    };
    activeMediaMeta = {
        title: `${title} (Official Trailer)`,
        cover: poster
    };
    activeStreamList = [trailerStream];
    closeDetailModal(true);
    playInCinemaModal(encodeURIComponent(JSON.stringify(trailerStream)));
    showToast(`Playing trailer: ${title}`);
}

function selectDetailSeason(subjectId, seasonNum, epCount, btn) {
    document.querySelectorAll('#detailSeasonTabs .season-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    // Update currentSeason so playDetailEpisode uses the correct season
    currentSeason = seasonNum;
    renderDetailEpisodes(subjectId, seasonNum, epCount);
}

function renderDetailEpisodes(subjectId, seasonNum, epCount) {
    const grid = document.getElementById('detailEpisodesGrid');
    let html = '';
    for (let i = 1; i <= epCount; i++) {
        html += `
            <div class="episode-btn" onclick="playDetailEpisode('${subjectId}', ${seasonNum}, ${i})">
                <span class="ep-num">Ep ${i}</span>
                <span class="ep-res-badge">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </span>
            </div>`;
    }
    grid.innerHTML = html;
}

function playDetailEpisode(subjectId, seasonNum, episodeNum) {
    closeDetailModal(true);
    currentPlayingSubjectId = subjectId;
    currentSeason = Number(seasonNum);
    currentEpisode = Number(episodeNum);
    showToast(`Loading S${seasonNum}E${episodeNum}…`);

    const isCurrentlyFallback = currentSelectedServer && currentSelectedServer !== 'direct';

    fetch(`/api/stream/${subjectId}?se=${seasonNum}&ep=${episodeNum}`)
        .then(async r => {
            const data = await r.json();
            const rawStreams = data.streams || [];
            const streams = rawStreams.filter(s => !isNoticeStream(s));
            activeStreamList = streams.length > 0 ? streams : rawStreams;
            activeCaptionList = [];
            if (data.dubs && data.dubs.length > 0) {
                activeDubsList = data.dubs;
                currentTitleDubs = data.dubs;
            }
            // Fetch captions in background
            fetch(`/api/stream/${subjectId}/captions?se=${seasonNum}&ep=${episodeNum}`)
                .then(res => res.json())
                .then(cd => { activeCaptionList = cd.captions || []; })
                .catch(() => {});

            activeFallbackServers = data.fallback_servers || [];

            // If fallback servers came empty, fetch from /api/fallback-sources
            if (activeFallbackServers.length === 0 && activeMediaMeta && activeMediaMeta.title) {
                try {
                    const t = activeMediaMeta.title;
                    const year = (activeMediaMeta.release_date) ? activeMediaMeta.release_date.slice(0, 4) : '';
                    const fbRes = await fetch(`/api/fallback-sources?title=${encodeURIComponent(t)}&year=${year}&is_series=true&season=${seasonNum}&episode=${episodeNum}`).then(res => res.json());
                    if (fbRes.servers && fbRes.servers.length > 0) {
                        activeFallbackServers = fbRes.servers;
                        updatePlayerServerSelect();
                    }
                } catch {}
            }

            // If user was already streaming via an embedded backup server, keep them on that server
            if (isCurrentlyFallback && activeFallbackServers.length > 0) {
                const target = activeFallbackServers.find(s => s.id === currentSelectedServer) || activeFallbackServers[0];
                playInCinemaModal(null, 0, target);
                renderPlayerSeriesRibbon();
                return;
            }

            if (activeStreamList.length > 0) {
                const playableStreams = (activeStreamList || []).filter(s => s && s.format !== 'DASH' && !s.url.includes('.mpd'));
                const streamToPlay = playableStreams.length > 0 ? playableStreams[0] : activeStreamList[0];
                playInCinemaModal(encodeURIComponent(JSON.stringify(streamToPlay)));
                renderPlayerSeriesRibbon();
            } else if (activeFallbackServers && activeFallbackServers.length > 0) {
                const srvName = activeFallbackServers[0].name.split('(')[1]?.replace(')', '') || 'Cloud';
                showToast(`Direct stream unavailable — playing S${seasonNum}E${episodeNum} via Backup Server (${srvName})…`, 'info');
                playInCinemaModal(null, 0, activeFallbackServers[0]);
                renderPlayerSeriesRibbon();
            } else {
                showToast(`No stream for S${seasonNum}E${episodeNum}`, 'error');
            }
        })
        .catch(err => showToast(`Error: ${err.message}`, 'error'));
}

function closeDetailModal(isTransitionToPlay = false) {
    const modal = document.getElementById('detailModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
    document.body.style.overflow = '';
    if (!isTransitionToPlay && typeof AdEngine !== 'undefined') {
        AdEngine.showExitInterstitial();
    }
}

// ─── API PLAYGROUND ───────────────────────────────────────────────────────────
function renderApiPlayground() {
    const tbody = document.getElementById('apiEndpointsTableBody');
    if (!tbody) return;
    tbody.innerHTML = API_ENDPOINTS.map(ep => `
        <tr>
            <td><span class="method-tag">${ep.method}</span></td>
            <td><span class="endpoint-url">${ep.path}</span></td>
            <td style="color:var(--text-secondary)">${ep.desc}</td>
            <td style="font-family:var(--font-mono);font-size:11px;color:var(--violet)">${ep.example}</td>
            <td>
                <button class="btn btn-ghost btn-sm" onclick="inspectApiEndpoint('${ep.example}')">Inspect</button>
                <a class="btn btn-ghost btn-sm" href="${ep.example}" target="_blank">Open</a>
            </td>
        </tr>`).join('');
}

async function inspectApiEndpoint(path) {
    const titleEl = document.getElementById('inspectorTitle');
    const codeEl = document.getElementById('inspectorCode');
    titleEl.textContent = `Inspector — ${path}`;
    codeEl.textContent = `// Loading ${path}…`;
    try {
        const res = await fetch(path);
        const data = await res.json();
        codeEl.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
        codeEl.textContent = `// Error: ${err.message}`;
    }
}

function copyInspectorJson() {
    const code = document.getElementById('inspectorCode').textContent;
    navigator.clipboard.writeText(code).then(() => showToast('JSON copied!'));
}

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────────────────────────
function openShortcutsModal() {
    const m = document.getElementById('shortcutsModal');
    if (m) m.classList.add('active');
}

function closeShortcutsModal() {
    const m = document.getElementById('shortcutsModal');
    if (m) m.classList.remove('active');
}

function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const shortcutsModal = document.getElementById('shortcutsModal');
        const playerModal = document.getElementById('playerModal');
        const detailModal = document.getElementById('detailModal');

        if (e.key === 'Escape') {
            if (shortcutsModal && shortcutsModal.classList.contains('active')) {
                closeShortcutsModal();
                return;
            }
            if (playerModal && playerModal.classList.contains('active')) {
                closePlayerModal();
                return;
            }
            if (detailModal && detailModal.classList.contains('active')) {
                closeDetailModal();
                return;
            }
            return;
        }

        const isInput = document.activeElement && 
            (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'TEXTAREA');

        if (!isInput) {
            if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
                e.preventDefault();
                openShortcutsModal();
                return;
            }
            if (e.key === '/' && !e.shiftKey) {
                e.preventDefault();
                const searchInput = document.getElementById('globalSearchInput');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
                return;
            }
        }

        if (playerModal && playerModal.classList.contains('active') && plyrInstance && !isInput) {
            if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
                e.preventDefault();
                plyrInstance.togglePlay();
            } else if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                plyrInstance.fullscreen.toggle();
            } else if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                plyrInstance.muted = !plyrInstance.muted;
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                plyrInstance.forward(10);
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                plyrInstance.rewind(10);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                plyrInstance.volume = Math.min(1, plyrInstance.volume + 0.1);
                showToast(`Volume: ${Math.round(plyrInstance.volume * 100)}%`);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                plyrInstance.volume = Math.max(0, plyrInstance.volume - 0.1);
                showToast(`Volume: ${Math.round(plyrInstance.volume * 100)}%`);
            } else if (e.key === 'c' || e.key === 'C') {
                e.preventDefault();
                plyrInstance.toggleCaptions();
            } else if (e.key === 'n' || e.key === 'N') {
                // Next episode shortcut
                if (currentEpisode > 0) {
                    e.preventDefault();
                    playNextEpisode();
                }
            } else if (/^[0-9]$/.test(e.key) && plyrInstance.duration > 0) {
                // 0-9 keys seek to % of video
                e.preventDefault();
                const pct = parseInt(e.key) / 10;
                plyrInstance.currentTime = plyrInstance.duration * pct;
                showToast(`Seeking to ${e.key}0%`);
            }
        }
    });
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(message, type = '') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    // Limit to at most 2 toasts simultaneously to eliminate popup spam
    while (container.children.length >= 2) {
        container.removeChild(container.firstChild);
    }
    const toast = document.createElement('div');
    toast.className = 'toast' + (type ? ` ${type}` : '');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}
