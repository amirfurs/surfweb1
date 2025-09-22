const state = {
  currentUser: null, // Will be set when backend loads
  account: {
    profile: null,
    favorites: [],
    history: []
  },
  filters: {
    category: "all",
    tag: null
  }
};

const categoryLabels = {
  "all": "الكل",
  "series": "السلاسل",
  "doubts": "دفع الشبهات",
  "prophethood": "إثبات النبوة",
  "logic": "المنطق",
  "theology": "بحوث عقدية",
  "philosophy": "قضايا فلسفية",
  "misc": "أقسام متنوعة",
  "general": "عام"
};

const storageKeys = {
  theme: "aqala-theme"
};
const ensureAccountState = () => {
  if (!state.account) {
    state.account = { profile: null, favorites: [], history: [] };
  }
};

const applyAccountSnapshot = (snapshot = {}) => {
  ensureAccountState();
  if (snapshot.user) {
    state.currentUser = snapshot.user;
  }
  if (snapshot.profile) {
    state.account.profile = snapshot.profile;
  }
  if (Array.isArray(snapshot.favorites)) {
    state.account.favorites = snapshot.favorites;
  }
  if (Array.isArray(snapshot.history)) {
    state.account.history = snapshot.history;
  }
};

const refreshAccountSnapshot = async () => {
  if (!state.currentUser) {
    ensureAccountState();
    state.account.profile = null;
    state.account.favorites = [];
    state.account.history = [];
    return;
  }
  
  try {
    // Try to get profile from Flask backend
    const response = await fetch('/user/profile');
    if (response.ok) {
      const snapshot = await response.json();
      applyAccountSnapshot(snapshot);
      return;
    }
  } catch (error) {
    console.log('Failed to fetch profile from Flask backend:', error);
  }
  
  // Fallback to mock backend if available
  if (window.mockBackend) {
    try {
      const snapshot = window.mockBackend.getProfile();
      applyAccountSnapshot(snapshot);
    } catch (error) {
      /* ignore */
    }
  } else {
    // No backend available, reset account state
    ensureAccountState();
    state.account.profile = null;
    state.account.favorites = [];
    state.account.history = [];
  }
};

const updateFavoriteButtons = () => {
  const favoriteSlugs = (state.account?.favorites || []).map((item) => item.slug);
  document.querySelectorAll("[data-action='toggle-favorite']").forEach((btn) => {
    const slug = btn.dataset.article;
    const isActive = slug && favoriteSlugs.includes(slug);
    btn.classList.toggle('is-active', Boolean(isActive));
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    const label = btn.querySelector('[data-favorite-label]');
    const heart = btn.querySelector(".icon-heart");
    if (heart) {
      heart.innerHTML = isActive ? "&#9829;" : "&#9825;";
    }
    if (label) {
      label.textContent = isActive ? '?? ????? ????? ?????????' : '?? ??? ????? ?????????';
    }
  });
};


const applyTheme = (theme) => {
  if (!theme) return;
  const supported = ["theme-light", "theme-dark", "theme-sepia"];
  const normalized = theme.startsWith("theme-") ? theme : `theme-${theme}`;
  const resolved = supported.includes(normalized) ? normalized : "theme-light";
  document.body.classList.remove(...supported);
  document.body.classList.add(resolved);
  try {
    window.localStorage.setItem(storageKeys.theme, resolved);
  } catch (error) {
    /* ignore */
  }
};

const initThemeToggle = () => {
  let stored = "theme-light";
  try {
    stored = window.localStorage.getItem(storageKeys.theme) || stored;
  } catch (error) {
    stored = "theme-light";
  }
  applyTheme(stored);

  document
    .querySelectorAll("#themeToggle, #articleThemeToggle, #adminThemeToggle")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const isDark = document.body.classList.contains("theme-dark");
        applyTheme(isDark ? "theme-light" : "theme-dark");
      });
    });
};

const serializeFormToJSON = (form) => {
  const formData = new FormData(form);
  const payload = {};
  formData.forEach((value, key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const current = payload[key];
      if (Array.isArray(current)) {
        current.push(value);
      } else {
        payload[key] = [current, value];
      }
    } else {
      payload[key] = value;
    }
  });
  return payload;
};

const ensureStatusElement = (form) => {
  let status = form.querySelector(".form-status");
  if (!status) {
    status = document.createElement("p");
    status.className = "form-status";
    status.hidden = true;
    form.appendChild(status);
  }
  return status;
};

const showFormStatus = (form, message = "", type = "success") => {
  const status = ensureStatusElement(form);
  if (!message) {
    status.hidden = true;
    status.textContent = "";
    status.classList.remove("is-success", "is-error");
    return;
  }
  status.hidden = false;
  status.textContent = message;
  status.classList.toggle("is-success", type === "success");
  status.classList.toggle("is-error", type === "error");
};

const toggleButtonState = (button, loading) => {
  if (!button) return;
  if (!button.dataset.original) {
    button.dataset.original = button.textContent.trim();
  }
  if (loading) {
    button.disabled = true;
    button.classList.add("is-loading");
    if (button.dataset.loading) {
      button.textContent = button.dataset.loading;
    }
  } else {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.textContent = button.dataset.original;
  }
};

const popupManager = (() => {
  let activeId = null;

  const setVisibility = (id, show) => {
    const popup = document.getElementById(id);
    if (!popup) return;
    popup.setAttribute("aria-hidden", show ? "false" : "true");
    if (show) {
      activeId = id;
      popup.querySelector("input, textarea, button")?.focus({ preventScroll: true });
    } else if (activeId === id) {
      activeId = null;
    }
  };

  document.addEventListener("click", (event) => {
    if (event.target.classList?.contains("popup")) {
      setVisibility(event.target.id, false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeId) {
      setVisibility(activeId, false);
    }
  });

  return {
    open: (id) => setVisibility(id, true),
    close: (id) => setVisibility(id, false)
  };
})();

const updateAuthState = async (snapshot) => {
  if (snapshot && typeof snapshot === "object") {
    applyAccountSnapshot(snapshot);
    if (!snapshot.profile && state.currentUser && window.mockBackend?.getProfile) {
      refreshAccountSnapshot();
    }
    return;
  }
  
  // Try to get current user from Flask backend
  try {
    const response = await fetch('/auth/me');
    if (response.ok) {
      const data = await response.json();
      state.currentUser = data.user;
    } else {
      state.currentUser = null;
    }
  } catch (error) {
    // Fallback to mock backend if Flask is not available
    state.currentUser = window.mockBackend ? window.mockBackend.getCurrentUser() : null;
  }
  
  if (state.currentUser) {
    refreshAccountSnapshot();
  } else {
    ensureAccountState();
    state.account.profile = null;
    state.account.favorites = [];
    state.account.history = [];
  }
};

const requireAuth = () => {
  if (state.currentUser) return true;
  popupManager.open("authPopup");
  const status = document.querySelector("#authPopup .form-status");
  if (status) {
    status.textContent = "يرجى تسجيل الدخول للوصول إلى لوحة التحكم";
    status.classList.add("is-error");
    status.hidden = false;
  }
  return false;
};

const handleFormSubmission = async (form) => {
  const endpoint = form.dataset.endpoint || form.getAttribute("action") || "";
  const method = (form.dataset.method || form.getAttribute("method") || "POST").toUpperCase();
  const encoding = (form.dataset.encoding || "json").toLowerCase();
  const payload = encoding === "form-data" ? new FormData(form) : serializeFormToJSON(form);

  const invokeBackend = () => {
    if (!window.mockBackend || !endpoint.startsWith("/")) {
      throw new Error("تعذّر الاتصال بالخادم المحلي");
    }
    const plainPayload = payload instanceof FormData ? Object.fromEntries(payload) : payload;
    return window.mockBackend.processRequest(endpoint, method, plainPayload);
  };

  if (!endpoint) {
    throw new Error("لم يتم تحديد مسار الإرسال");
  }

  if (window.mockBackend && endpoint.startsWith("/")) {
    return Promise.resolve(invokeBackend());
  }

  const options = {
    method,
    headers: {
      Accept: "application/json, text/plain, */*"
    }
  };

  if (payload instanceof FormData) {
    options.body = payload;
  } else {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(payload);
  }

  try {
    const response = await fetch(endpoint, options);
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      const error = new Error(data?.message || "تعذّر إتمام الطلب");
      error.payload = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (window.mockBackend && endpoint.startsWith("/")) {
      return Promise.resolve(invokeBackend());
    }
    if (error.message === "Failed to fetch") {
      throw new Error("تعذّر الاتصال بالخادم. تأكد من تشغيله أو جرّب إعادة تحميل الصفحة.");
    }
    throw error;
  }
};

const updateAuthUI = () => {
  const authButtons = Array.from(document.querySelectorAll('.auth-btn'));
  const logoutButtons = document.querySelectorAll("[data-action='logout']");
  const adminLabel = document.querySelector('.admin-user span');

  authButtons
    .filter((btn) => !btn.closest('.admin-user'))
    .forEach((btn) => {
      const isLink = btn.tagName === 'A';
      if (state.currentUser) {
        btn.textContent = 'الإعدادات';
        btn.removeAttribute('data-popup-target');
        if (isLink) {
          btn.setAttribute('href', 'profile.html');
          btn.removeAttribute('data-action');
        } else {
          btn.dataset.action = 'go-profile';
        }
      } else {
        btn.textContent = 'دخول / تسجيل';
        btn.removeAttribute('data-popup-target');
        if (isLink) {
          btn.setAttribute('href', 'login.html');
          btn.removeAttribute('data-action');
        } else {
          btn.dataset.action = 'go-login';
        }
      }
    });

  if (state.currentUser) {
    logoutButtons.forEach((btn) => btn.removeAttribute('hidden'));
    if (adminLabel) {
      const roleLabel = state.currentUser.role === 'admin' ? 'مدير' : state.currentUser.role;
      adminLabel.textContent = `مرحبًا ${state.currentUser.name} (${roleLabel})`;
    }
  } else {
    logoutButtons.forEach((btn) => btn.setAttribute('hidden', 'hidden'));
    if (adminLabel) {
      adminLabel.textContent = 'الرجاء تسجيل الدخول';
    }
  }

  updateFavoriteButtons();
};
const renderArticleCard = (article) => {
  const published = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(article.publishedAt));
  const commentsLabel = article.comments === 1 ? "تعليق" : "تعليقات";
  const isFavorite = (state.account?.favorites || []).some((item) => item.slug === article.slug);
  const favoriteLabel = isFavorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة";
  return `
    <article class="article-card" data-category="${article.category}" data-tags="${(article.tags || []).join(",")}">
      <img src="${article.cardImage}" alt="${article.title}" class="article-image" loading="lazy">
      <div class="article-content">
        <h3 class="article-title">${article.title}</h3>
        <p class="article-meta">بقلم: ${article.author} \u0007 ${published} \u0007 ${article.comments} ${commentsLabel}</p>
        <p class="article-excerpt">${article.excerpt}</p>
        <div class="article-footer">
          <span class="tag-badge">#${article.tags?.[0] || "عام"}</span>
          <div class="article-actions">
            <a href="article.html?slug=${article.slug}" class="read-link">قراءة المزيد</a>
            <button type="button" class="icon-btn favorite-toggle${isFavorite ? " is-active" : ""}" data-action="toggle-favorite" data-article="${article.slug}" aria-pressed="${isFavorite}">
              <span class="icon-heart" aria-hidden="true">${isFavorite ? "♥" : "♡"}</span>
              <span class="sr-only" data-favorite-label>${favoriteLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  `;
};

const getFilteredPosts = async () => {
  try {
    const { category, tag, search } = state.filters;
    let url = '/api/articles';
    const params = new URLSearchParams();
    
    if (category && category !== 'all') {
      params.append('category', category);
    }
    if (tag) {
      params.append('tag', tag);
    }
    if (search) {
      params.append('search', search);
    }
    
    if (params.toString()) {
      url += '?' + params.toString();
    }
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch articles');
    }
    
    const articles = await response.json();
    return articles;
  } catch (error) {
    console.error('Error fetching articles:', error);
    return [];
  }
};

const renderSidebarList = (selector, items) => {
  const list = document.querySelector(selector);
  if (!list) return;
  list.innerHTML = items
    .map(
      (item) => `
        <li>
          <img src="${item.cardImage}" alt="${item.title}">
          <span>${item.title}</span>
        </li>
      `
    )
    .join("");
};

const renderHeroArticle = async () => {
  const heroArticle = document.getElementById("heroArticle");
  const articlesCount = document.getElementById("articlesCount");
  if (!heroArticle) return;
  
  try {
    // Get the latest article
    const response = await fetch('/api/articles');
    if (!response.ok) throw new Error('Failed to fetch articles');
    
    const articles = await response.json();
    
    // Update articles count
    if (articlesCount) {
      articlesCount.textContent = articles.length;
    }
    
    if (articles.length === 0) {
      heroArticle.innerHTML = '<div class="loading-placeholder">لا توجد مقالات متاحة حالياً</div>';
      return;
    }
    
    const latestArticle = articles[0]; // First article is the latest
    const published = new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(new Date(latestArticle.publishedAt));
    
    heroArticle.innerHTML = `
      <div class="featured-article">
        <div class="article-image">
          <img src="${latestArticle.cardImage || latestArticle.heroImage || 'assets/images/default-article.svg'}" 
               alt="${latestArticle.title}" 
               loading="lazy">
        </div>
        <div class="article-content">
          <h3 class="article-title">${latestArticle.title}</h3>
          <p class="article-meta">
            <span>بقلم: ${latestArticle.author}</span>
            <span>•</span>
            <span>${published}</span>
          </p>
          <p class="article-excerpt">${latestArticle.excerpt}</p>
          <a href="article.html?slug=${latestArticle.slug}" class="read-more">قراءة المقال كاملاً ←</a>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Error loading hero article:', error);
    heroArticle.innerHTML = '<div class="loading-placeholder">تعذر تحميل المقال</div>';
  }
};

const renderHomePage = async () => {
  if (!document.body.classList.contains("home-page")) return;
  const grid = document.getElementById("articleGrid");
  const results = document.querySelector(".results-count");
  
  // Load hero article
  renderHeroArticle();
  
  // Show loading state
  if (grid) {
    grid.innerHTML = '<p class="empty-state">جارٍ تحميل المقالات...</p>';
  }
  
  const posts = await getFilteredPosts();
  if (grid) {
    grid.innerHTML = posts.length
      ? posts.map(renderArticleCard).join("")
      : '<p class="empty-state">لا توجد مقالات مطابقة حالياً.</p>';
  }
  if (results) {
    const label = posts.length === 1 ? "مقالة" : "مقالات";
    results.textContent = `${posts.length} ${label}`;
  }

  updateFavoriteButtons();
  
  // Load sidebar content (trending and recommended)
  if (posts.length > 0) {
    const trending = posts.slice(0, 3);
    const recommended = posts.slice(0, 3);
    renderSidebarList("#trendingList", trending);
    renderSidebarList("#recommendedList", recommended);
  }
};

const renderSeriesPage = async () => {
  if (!document.body.classList.contains("series-page")) return;
  
  const seriesGrid = document.getElementById("seriesGrid");
  const seriesCount = document.getElementById("seriesCount");
  const episodesCount = document.getElementById("episodesCount");
  
  if (!seriesGrid) return;
  
  try {
    // Show loading state
    seriesGrid.innerHTML = '<div class="loading-placeholder">جارٍ تحميل السلاسل...</div>';
    
    // Fetch series data
    const response = await fetch('/api/series');
    if (!response.ok) throw new Error('Failed to fetch series');
    
    const series = await response.json();
    
    // Update stats
    if (seriesCount) {
      seriesCount.textContent = series.length;
    }
    
    const totalEpisodes = series.reduce((total, serie) => total + serie.episode_count, 0);
    if (episodesCount) {
      episodesCount.textContent = totalEpisodes;
    }
    
    // Render series grid
    if (series.length === 0) {
      seriesGrid.innerHTML = '<div class="empty-state">لا توجد سلاسل متاحة حالياً</div>';
      return;
    }
    
    seriesGrid.innerHTML = series.map(renderSeriesCard).join('');
    
    // Initialize filters
    initSeriesFilters(series);
    
  } catch (error) {
    console.error('Error loading series:', error);
    seriesGrid.innerHTML = '<div class="empty-state">تعذر تحميل السلاسل</div>';
  }
};

const renderSeriesCard = (serie) => {
  const statusLabels = {
    'active': 'نشطة',
    'completed': 'مكتملة',
    'paused': 'متوقفة مؤقتاً'
  };
  
  const createdDate = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long"
  }).format(new Date(serie.created_at));
  
  return `
    <div class="series-card" data-status="${serie.status}">
      <div class="series-card-image">
        <img src="${serie.image}" alt="${serie.title}" loading="lazy">
        <div class="series-status-badge ${serie.status}">${statusLabels[serie.status] || serie.status}</div>
      </div>
      <div class="series-card-content">
        <h3 class="series-card-title">${serie.title}</h3>
        <p class="series-card-description">${serie.description}</p>
        <div class="series-card-meta">
          <span class="series-author">بقلم: ${serie.author}</span>
          <span class="series-date">${createdDate}</span>
        </div>
        <div class="series-card-footer">
          <div class="series-episode-count">${serie.episode_count} حلقة</div>
          <a href="series-detail.html?slug=${serie.slug}" class="series-view-btn">عرض السلسلة</a>
        </div>
      </div>
    </div>
  `;
};

const initSeriesFilters = (allSeries) => {
  const statusFilter = document.getElementById('statusFilter');
  if (!statusFilter) return;
  
  statusFilter.addEventListener('change', () => {
    const selectedStatus = statusFilter.value;
    const seriesGrid = document.getElementById('seriesGrid');
    
    let filteredSeries = allSeries;
    if (selectedStatus !== 'all') {
      filteredSeries = allSeries.filter(serie => serie.status === selectedStatus);
    }
    
    if (filteredSeries.length === 0) {
      seriesGrid.innerHTML = '<div class="empty-state">لا توجد سلاسل مطابقة للفلتر المحدد</div>';
    } else {
      seriesGrid.innerHTML = filteredSeries.map(renderSeriesCard).join('');
    }
  });
};

const renderSeriesDetailPage = async () => {
  if (!document.body.classList.contains("series-detail-page")) return;
  
  const seriesDetail = document.getElementById("seriesDetail");
  const seriesBreadcrumb = document.getElementById("seriesBreadcrumb");
  
  if (!seriesDetail) return;
  
  // Get series slug from URL
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug');
  
  if (!slug) {
    seriesDetail.innerHTML = '<div class="empty-state">معرف السلسلة غير صحيح</div>';
    return;
  }
  
  try {
    // Show loading state
    seriesDetail.innerHTML = '<div class="loading-placeholder">جارٍ تحميل تفاصيل السلسلة...</div>';
    
    // Fetch series details
    const response = await fetch(`/api/series/${slug}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('السلسلة غير موجودة');
      }
      throw new Error('فشل في تحميل السلسلة');
    }
    
    const serie = await response.json();
    
    // Update breadcrumb
    if (seriesBreadcrumb) {
      seriesBreadcrumb.textContent = serie.title;
    }
    
    // Update page title
    document.title = `${serie.title} - الفرسان`;
    
    // Render series detail
    seriesDetail.innerHTML = renderSeriesDetailContent(serie);
    
  } catch (error) {
    console.error('Error loading series detail:', error);
    seriesDetail.innerHTML = `<div class="empty-state">تعذر تحميل السلسلة: ${error.message}</div>`;
  }
};

const renderSeriesDetailContent = (serie) => {
  const statusLabels = {
    'active': 'نشطة',
    'completed': 'مكتملة',
    'paused': 'متوقفة مؤقتاً'
  };
  
  const createdDate = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(serie.created_at));
  
  const episodesHtml = serie.episodes.length > 0 
    ? serie.episodes.map(renderEpisodeCard).join('')
    : '<div class="empty-state">لا توجد حلقات منشورة حتى الآن</div>';
  
  return `
    <div class="series-detail-header">
      <div class="series-detail-image">
        <img src="${serie.image}" alt="${serie.title}">
      </div>
      <div class="series-detail-info">
        <h1>${serie.title}</h1>
        <div class="series-detail-meta">
          <div class="series-detail-meta-item">
            <span class="series-detail-meta-label">الحالة</span>
            <span class="series-detail-meta-value">${statusLabels[serie.status] || serie.status}</span>
          </div>
          <div class="series-detail-meta-item">
            <span class="series-detail-meta-label">عدد الحلقات</span>
            <span class="series-detail-meta-value">${serie.episodes.length} حلقة</span>
          </div>
          <div class="series-detail-meta-item">
            <span class="series-detail-meta-label">المؤلف</span>
            <span class="series-detail-meta-value">${serie.author}</span>
          </div>
          <div class="series-detail-meta-item">
            <span class="series-detail-meta-label">تاريخ الإنشاء</span>
            <span class="series-detail-meta-value">${createdDate}</span>
          </div>
        </div>
        <div class="series-detail-description">
          ${serie.description}
        </div>
      </div>
    </div>
    
    <div class="episodes-section">
      <h2>حلقات السلسلة</h2>
      <div class="episodes-grid">
        ${episodesHtml}
      </div>
    </div>
  `;
};

const renderEpisodeCard = (episode) => {
  const duration = episode.duration_minutes 
    ? `${episode.duration_minutes} دقيقة`
    : 'غير محدد';
  
  const createdDate = new Intl.DateTimeFormat("ar-EG", {
    month: "short",
    day: "numeric"
  }).format(new Date(episode.created_at));
  
  return `
    <div class="episode-card">
      <div class="episode-number">${episode.episode_number}</div>
      <div class="episode-info">
        <h3>${episode.title}</h3>
        <div class="episode-meta">
          <span class="episode-duration">${duration}</span>
          <span class="episode-date">${createdDate}</span>
        </div>
      </div>
      <a href="episode.html?series=${episode.series_slug || ''}&episode=${episode.slug}" class="episode-play-btn">
        ▶ تشغيل
      </a>
    </div>
  `;
};

const renderArticlePage = async () => {
  console.log('renderArticlePage called, body classes:', document.body.className);
  if (!document.body.classList.contains("article-page")) return;
  const urlSlug = new URLSearchParams(window.location.search).get("slug");
  const fallbackSlug = document.body.dataset.articleId;
  const slug = urlSlug || fallbackSlug;
  console.log('Article slug detection - URL:', urlSlug, 'Fallback:', fallbackSlug, 'Final:', slug);
  if (!slug) return;
  
  const container = document.querySelector(".article-detail");
  if (!container) return;
  
  // Show loading state but preserve the structure
  const loadingMessage = container.querySelector('.article-body');
  if (loadingMessage) {
    loadingMessage.innerHTML = '<p class="empty-state">جارٍ تحميل المقال...</p>';
  }
  
  try {
    // Fetch specific article by slug
    console.log('Fetching article from:', `/api/articles/${slug}`);
    const response = await fetch(`/api/articles/${slug}`);
    console.log('Response status:', response.status, response.statusText);
    if (!response.ok) {
      console.error('Failed to fetch article:', response.status);
      throw new Error('Article not found');
    }
    
    const article = await response.json();
    console.log('Article loaded:', article);

    const categoryLabel = container.querySelector(".category-label");
    if (categoryLabel) {
      categoryLabel.textContent = categoryLabels[article.category] || article.category;
    }
    const heading = container.querySelector("h1");
    if (heading) heading.textContent = article.title;

    const info = container.querySelector(".article-info");
    if (info) {
      const formattedDate = new Intl.DateTimeFormat("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric"
      }).format(new Date(article.publishedAt));
      info.innerHTML = `<span>${article.author}</span><span>${formattedDate}</span><span>${article.comments} تعليقاً</span>`;
    }

    const heroImg = container.querySelector(".article-hero img");
    if (heroImg) {
      heroImg.src = article.heroImage;
      heroImg.alt = article.title;
    }

    const body = container.querySelector(".article-body");
    if (body) {
      console.log('Setting article content:', article.content);
      let content = article.content || article.body || '';
      
      // If content doesn't have proper HTML structure, format it
      if (!content.includes('<p>') && !content.includes('<div>')) {
        // Clean up and format plain text content
        content = content
          .trim()
          .replace(/\n\s*\n/g, '</p><p>') // Convert double line breaks to paragraph breaks
          .replace(/\n/g, '<br>') // Convert single line breaks to <br>
          .replace(/^\s*/, '<p>') // Add opening paragraph tag
          .replace(/\s*$/, '</p>'); // Add closing paragraph tag
        
        // Fix any double paragraph tags
        content = content.replace(/<\/p><p><\/p><p>/g, '</p><p>');
        content = content.replace(/<p><\/p>/g, '');
      }
      
      // Clean up any malformed HTML
      content = content
        .replace(/<p>\s*<\/p>/g, '') // Remove empty paragraphs
        .replace(/(<p[^>]*>)\s*(<p[^>]*>)/g, '$2') // Remove nested opening p tags
        .replace(/(<\/p>)\s*(<\/p>)/g, '$1'); // Remove duplicate closing p tags
      
      body.innerHTML = content;
      console.log('Article body updated, innerHTML length:', body.innerHTML.length);
    } else {
      console.error('Article body container not found!');
    }

    const ratingForm = document.querySelector(".rating-form");
    if (ratingForm) {
      ratingForm.dataset.endpoint = `/articles/${article.slug}/rating`;
    }
    const articleFavoriteBtn = document.querySelector("[data-role='article-favorite']");
    if (articleFavoriteBtn) {
      articleFavoriteBtn.dataset.article = article.slug;
    }

    updateFavoriteButtons();
    
  } catch (error) {
    console.error('Error loading article:', error);
    const errorMessage = container.querySelector('.article-body');
    if (errorMessage) {
      errorMessage.innerHTML = '<p class="empty-state">تعذر تحميل المقال: ' + error.message + '</p>';
    } else {
      container.innerHTML = '<div class="empty-state">تعذر تحميل المقال: ' + error.message + '</div>';
    }
  }
};

const fetchAdminStats = async () => {
  try {
    const response = await fetch('/admin/stats');
    if (!response.ok) {
      throw new Error('Failed to fetch admin stats');
    }
    
    const stats = await response.json();
    
    // Update metric cards with real data
    const updateMetric = (name, count, trend) => {
      const countEl = document.querySelector(`[data-metric="${name}-count"]`);
      const trendEl = document.querySelector(`[data-metric="${name}-trend"]`);
      
      if (countEl) {
        countEl.textContent = count.toLocaleString('ar-EG');
      }
      
      if (trendEl) {
        trendEl.textContent = trend;
        // Add appropriate CSS classes based on trend
        trendEl.className = 'metric-trend';
        if (trend.includes('+')) {
          trendEl.classList.add('up');
        } else if (trend.includes('-')) {
          trendEl.classList.add('down');
        } else {
          trendEl.classList.add('neutral');
        }
      }
    };
    
    // Update all metrics
    updateMetric('articles', stats.articles.count, stats.articles.trend);
    updateMetric('newsletter', stats.newsletter.count, stats.newsletter.trend);
    updateMetric('users', stats.users.count, stats.users.trend);
    updateMetric('poll-votes', stats.poll_votes.count, stats.poll_votes.trend);
    
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    
    // Show error state in metrics
    document.querySelectorAll('[data-metric$="-count"]').forEach(el => {
      el.textContent = '—';
    });
    document.querySelectorAll('[data-metric$="-trend"]').forEach(el => {
      el.textContent = 'تعذر تحميل البيانات';
      el.className = 'metric-trend neutral';
    });
  }
};

const fetchAdminArticles = async () => {
  try {
    const response = await fetch('/admin/articles');
    if (!response.ok) {
      throw new Error('Failed to fetch articles');
    }
    
    const articles = await response.json();
    renderArticlesTable(articles);
    
  } catch (error) {
    console.error('Error fetching articles:', error);
    const tableBody = document.getElementById("adminArticlesTable");
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #e74c3c;">تعذر تحميل المقالات</td></tr>';
    }
  }
};

const renderArticlesTable = (articles) => {
  const tableBody = document.getElementById("adminArticlesTable");
  if (!tableBody) return;
  
  if (articles.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">لا توجد مقالات حتى الآن</td></tr>';
    return;
  }
  
  const formatter = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  
  tableBody.innerHTML = articles
    .map((article) => `
      <tr>
        <td>${article.title}</td>
        <td>${categoryLabels[article.category] || article.category}</td>
        <td>${article.author}</td>
        <td>${formatter.format(new Date(article.created_at))}</td>
        <td class="actions">
          <button class="icon-btn" data-action="edit-article" data-article-id="${article.id}" title="تعديل">✏️</button>
          <button class="icon-btn" data-action="delete-article" data-article-id="${article.id}" title="حذف">🗑️</button>
          <button class="icon-btn" data-action="preview-article" data-article="${article.slug}" title="عرض">👁</button>
        </td>
      </tr>
    `)
    .join("");
};

const openArticleModal = (article = null) => {
  const modal = document.getElementById('articleModal');
  const form = document.getElementById('articleForm');
  const title = document.getElementById('articleModalTitle');
  const submitBtn = document.getElementById('articleSubmitBtn');
  
  if (article) {
    // Edit mode
    title.textContent = 'تعديل المقال';
    submitBtn.innerHTML = '<span class="btn-icon">✓</span>تحديث المقال';
    form.dataset.method = 'PUT';
    form.dataset.endpoint = `/admin/articles/${article.id}`;
    
    // Fill form with article data
    document.getElementById('articleId').value = article.id;
    document.getElementById('articleTitle').value = article.title;
    document.getElementById('articleCategory').value = article.category;
    document.getElementById('articleTags').value = Array.isArray(article.tags) ? article.tags.join(', ') : article.tags || '';
    document.getElementById('articleImageUrl').value = article.image_url || '';
    
    // Set editor content
    if (window.setEditorContent) {
      window.setEditorContent(article.content || '');
    }
    
    // Show image preview if exists
    if (article.image_url) {
      const previewImg = document.getElementById('previewImg');
      const imagePreview = document.getElementById('imagePreview');
      const uploadPlaceholder = document.getElementById('uploadPlaceholder');
      
      if (previewImg && imagePreview && uploadPlaceholder) {
        previewImg.src = article.image_url;
        uploadPlaceholder.style.display = 'none';
        imagePreview.style.display = 'block';
      }
    }
  } else {
    // Create mode
    title.textContent = 'إضافة مقال جديد';
    submitBtn.innerHTML = '<span class="btn-icon">✓</span>حفظ ونشر المقال';
    form.dataset.method = 'POST';
    form.dataset.endpoint = '/admin/articles';
    
    // Clear form
    form.reset();
    document.getElementById('articleId').value = '';
    
    // Reset image upload
    if (window.resetImageUpload) {
      window.resetImageUpload();
    }
    
    // Clear editor content
    if (window.clearEditorContent) {
      window.clearEditorContent();
    }
  }
  
  // Open modal directly
  if (modal) {
    modal.setAttribute('aria-hidden', 'false');
    // Focus the first input
    const firstInput = modal.querySelector('input[type="text"]');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 200);
    }
    // Initialize image upload functionality
    setTimeout(() => {
      initImageUpload();
    }, 100);
    // Initialize rich text editor components
    setTimeout(() => {
      initRichTextEditor();
      initQuranModal();
      initImageInsertModal();
    }, 200);
  }
};

const deleteArticle = async (articleId) => {
  if (!confirm('هل أنت متأكد من حذف هذا المقال؟ لا يمكن التراجع عن هذا الإجراء.')) {
    return;
  }
  
  try {
    const response = await fetch(`/admin/articles/${articleId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      // Refresh articles table
      fetchAdminArticles();
      // Show success message
      alert('تم حذف المقال بنجاح');
    } else {
      const error = await response.json();
      alert(error.error || 'فشل في حذف المقال');
    }
  } catch (error) {
    console.error('Error deleting article:', error);
    alert('حدث خطأ أثناء حذف المقال');
  }
};

const initImageUpload = () => {
  const uploadArea = document.getElementById('imageUploadArea');
  const uploadPlaceholder = document.getElementById('uploadPlaceholder');
  const fileInput = document.getElementById('articleImageFile');
  const imagePreview = document.getElementById('imagePreview');
  const previewImg = document.getElementById('previewImg');
  const changeImageBtn = document.getElementById('changeImageBtn');
  const removeImageBtn = document.getElementById('removeImageBtn');
  const uploadProgress = document.getElementById('uploadProgress');
  const progressFill = document.querySelector('.progress-fill');
  const progressText = document.querySelector('.progress-text');
  const imageUrlInput = document.getElementById('articleImageUrl');
  
  if (!uploadArea || !fileInput) return;
  
  // Click to upload
  uploadPlaceholder.addEventListener('click', () => {
    fileInput.click();
  });
  
  // Drag and drop functionality
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--color-primary)';
    uploadArea.style.backgroundColor = 'rgba(95, 77, 238, 0.1)';
  });
  
  uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--color-border)';
    uploadArea.style.backgroundColor = 'var(--color-surface-alt)';
  });
  
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--color-border)';
    uploadArea.style.backgroundColor = 'var(--color-surface-alt)';
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });
  
  // File input change
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });
  
  // Change image button
  changeImageBtn.addEventListener('click', () => {
    fileInput.click();
  });
  
  // Remove image button
  removeImageBtn.addEventListener('click', () => {
    resetImageUpload();
  });
  
  const handleFileUpload = async (file) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح');
      return;
    }
    
    // Validate file size (16MB)
    if (file.size > 16 * 1024 * 1024) {
      alert('حجم الملف كبير جداً. الحد الأقصى 16MB');
      return;
    }
    
    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      showImagePreview();
    };
    reader.readAsDataURL(file);
    
    // Show upload progress
    showUploadProgress();
    
    // Upload file
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const response = await fetch('/upload/image', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Set the uploaded image URL
        imageUrlInput.value = result.url;
        previewImg.src = result.url;
        hideUploadProgress();
        showSuccessMessage('تم رفع الصورة بنجاح!');
      } else {
        throw new Error(result.error || 'فشل في رفع الصورة');
      }
    } catch (error) {
      console.error('Upload error:', error);
      hideUploadProgress();
      showErrorMessage(error.message || 'حدث خطأ أثناء رفع الصورة');
      resetImageUpload();
    }
  };
  
  const showImagePreview = () => {
    uploadPlaceholder.style.display = 'none';
    imagePreview.style.display = 'block';
  };
  
  const hideImagePreview = () => {
    uploadPlaceholder.style.display = 'block';
    imagePreview.style.display = 'none';
  };
  
  const showUploadProgress = () => {
    uploadProgress.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'جارٍ الرفع...';
    
    // Simulate progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress > 90) progress = 90;
      progressFill.style.width = progress + '%';
    }, 200);
    
    // Store interval to clear it later
    uploadProgress.dataset.interval = interval;
  };
  
  const hideUploadProgress = () => {
    const interval = uploadProgress.dataset.interval;
    if (interval) {
      clearInterval(interval);
    }
    progressFill.style.width = '100%';
    setTimeout(() => {
      uploadProgress.style.display = 'none';
    }, 500);
  };
  
  const showSuccessMessage = (message) => {
    // You can implement a toast notification here
    console.log('Success:', message);
  };
  
  const showErrorMessage = (message) => {
    alert(message);
  };
  
  const resetImageUpload = () => {
    hideImagePreview();
    imageUrlInput.value = '';
    fileInput.value = '';
    previewImg.src = '';
  };
  
  // Public method to reset when opening modal
  window.resetImageUpload = resetImageUpload;
};

const initRichTextEditor = () => {
  const editorContent = document.getElementById('articleBody');
  const hiddenTextarea = document.getElementById('articleBodyHidden');
  const toolbar = document.querySelector('.editor-toolbar');
  
  if (!editorContent || !hiddenTextarea || !toolbar) return;
  
  // Ensure editor is properly set up
  editorContent.setAttribute('contenteditable', 'true');
  editorContent.style.direction = 'rtl';
  editorContent.style.textAlign = 'right';
  
  // Prevent multiple initializations
  if (editorContent.dataset.initialized) return;
  editorContent.dataset.initialized = 'true';
  
  // Focus and selection management
  let currentRange = null;
  
  function saveSelection() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      currentRange = selection.getRangeAt(0);
    }
  }
  
  function restoreSelection() {
    if (currentRange) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(currentRange);
    }
  }
  
  // Toolbar button handlers
  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('.toolbar-btn');
    if (!btn) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Focus editor first
    editorContent.focus();
    
    const command = btn.dataset.command;
    const value = btn.dataset.value;
    
    // Handle special commands
    if (command === 'createLink') {
      const selectedText = window.getSelection().toString();
      const url = prompt('أدخل رابط URL:', 'https://');
      if (url && url !== 'https://') {
        if (selectedText) {
          document.execCommand('createLink', false, url);
        } else {
          const linkText = prompt('أدخل نص الرابط:', url);
          if (linkText) {
            document.execCommand('insertHTML', false, `<a href="${url}" target="_blank">${linkText}</a>`);
          }
        }
      }
    } else if (command === 'formatBlock') {
      // Handle heading and blockquote formatting
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        document.execCommand('formatBlock', false, `<${value}>`);
      }
    } else if (command === 'justifyRight') {
      document.execCommand('justifyRight', false, null);
      editorContent.style.direction = 'rtl';
    } else if (command === 'justifyLeft') {
      document.execCommand('justifyLeft', false, null);
      editorContent.style.direction = 'ltr';
    } else if (command === 'justifyCenter') {
      document.execCommand('justifyCenter', false, null);
    } else if (command) {
      // Standard commands
      document.execCommand(command, false, value);
    }
    
    // Update UI
    setTimeout(() => {
      updateToolbarStates();
      updateHiddenTextarea();
    }, 10);
  });
  
  // Handle editor events
  editorContent.addEventListener('input', () => {
    updateHiddenTextarea();
  });
  
  editorContent.addEventListener('keydown', (e) => {
    // Handle Enter key for better paragraph handling
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.execCommand('insertHTML', false, '<br><br>');
    }
  });
  
  editorContent.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    setTimeout(updateHiddenTextarea, 10);
  });
  
  // Update toolbar states on selection change
  editorContent.addEventListener('keyup', updateToolbarStates);
  editorContent.addEventListener('mouseup', updateToolbarStates);
  editorContent.addEventListener('focus', updateToolbarStates);
  
  // Save selection when clicking outside editor
  editorContent.addEventListener('blur', saveSelection);
  
  function updateHiddenTextarea() {
    let content = editorContent.innerHTML;
    // Clean up the HTML
    content = content.replace(/<div><br><\/div>/g, '<br>');
    content = content.replace(/<div>/g, '<p>').replace(/<\/div>/g, '</p>');
    hiddenTextarea.value = content;
  }
  
  function updateToolbarStates() {
    const buttons = toolbar.querySelectorAll('.toolbar-btn[data-command]');
    buttons.forEach(btn => {
      const command = btn.dataset.command;
      try {
        let isActive = false;
        if (command === 'bold' || command === 'italic' || command === 'underline') {
          isActive = document.queryCommandState(command);
        } else if (command === 'justifyRight' || command === 'justifyCenter' || command === 'justifyLeft') {
          isActive = document.queryCommandState(command);
        } else if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
          isActive = document.queryCommandState(command);
        }
        btn.classList.toggle('active', isActive);
      } catch (e) {
        // Some commands might not be supported
      }
    });
  }
  
  // Insert image button handler
  const insertImageBtn = document.getElementById('insertImageBtn');
  if (insertImageBtn && !insertImageBtn.dataset.initialized) {
    insertImageBtn.dataset.initialized = 'true';
    insertImageBtn.addEventListener('click', (e) => {
      e.preventDefault();
      saveSelection();
      popupManager.open('imageInsertModal');
    });
  }
  
  // Insert Quran verse button handler
  const insertQuranBtn = document.getElementById('insertQuranBtn');
  if (insertQuranBtn && !insertQuranBtn.dataset.initialized) {
    insertQuranBtn.dataset.initialized = 'true';
    insertQuranBtn.addEventListener('click', (e) => {
      e.preventDefault();
      saveSelection();
      popupManager.open('quranModal');
    });
  }
  
  // Public methods
  window.setEditorContent = (content) => {
    editorContent.innerHTML = content || '';
    updateHiddenTextarea();
  };
  
  window.getEditorContent = () => {
    return editorContent.innerHTML;
  };
  
  window.clearEditorContent = () => {
    editorContent.innerHTML = '';
    updateHiddenTextarea();
  };
  
  window.insertIntoEditor = (html) => {
    editorContent.focus();
    if (currentRange) {
      restoreSelection();
    }
    document.execCommand('insertHTML', false, html);
    updateHiddenTextarea();
  };
  
  // Add resizing functionality
  initResizableElements();
  
  // Initial setup
  updateHiddenTextarea();
};

const initResizableElements = () => {
  const editorContent = document.getElementById('articleBody');
  if (!editorContent) return;
  
  let isResizing = false;
  let currentElement = null;
  let startX, startY, startWidth, startHeight;
  
  // Handle clicks on resizable elements
  editorContent.addEventListener('click', (e) => {
    // Remove previous selections
    editorContent.querySelectorAll('.selected').forEach(el => {
      el.classList.remove('selected');
    });
    
    // Select clicked resizable element
    const resizableImg = e.target.closest('.resizable-img');
    const quranVerse = e.target.closest('.quran-verse');
    
    if (resizableImg) {
      resizableImg.classList.add('selected');
      e.stopPropagation();
    } else if (quranVerse) {
      quranVerse.classList.add('selected');
      e.stopPropagation();
    }
  });
  
  // Handle resize handles for images
  editorContent.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('resize-handle')) {
      e.preventDefault();
      e.stopPropagation();
      
      isResizing = true;
      currentElement = e.target.closest('.resizable-img');
      
      if (currentElement) {
        const rect = currentElement.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startWidth = rect.width;
        startHeight = rect.height;
        
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
        
        // Prevent text selection during resize
        document.body.style.userSelect = 'none';
      }
    }
  });
  
  function handleResize(e) {
    if (!isResizing || !currentElement) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    let newWidth = startWidth;
    let newHeight = startHeight;
    
    // Calculate new dimensions based on which handle is being dragged
    const handle = document.querySelector('.resize-handle:hover') || 
                  currentElement.querySelector('.resize-handle');
    
    if (handle.classList.contains('bottom-right')) {
      newWidth = startWidth + deltaX;
    } else if (handle.classList.contains('bottom-left')) {
      newWidth = startWidth - deltaX;
    } else if (handle.classList.contains('top-right')) {
      newWidth = startWidth + deltaX;
    } else if (handle.classList.contains('top-left')) {
      newWidth = startWidth - deltaX;
    }
    
    // Maintain aspect ratio and set minimum size
    newWidth = Math.max(100, Math.min(newWidth, 800));
    
    currentElement.style.width = newWidth + 'px';
    
    // Update hidden textarea
    if (document.getElementById('articleBodyHidden')) {
      document.getElementById('articleBodyHidden').value = editorContent.innerHTML;
    }
  }
  
  function stopResize() {
    isResizing = false;
    currentElement = null;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.userSelect = '';
  }
  
  // Handle keyboard shortcuts for resizing
  editorContent.addEventListener('keydown', (e) => {
    const selected = editorContent.querySelector('.selected');
    if (!selected) return;
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      selected.remove();
      updateHiddenTextarea();
    }
  });
  
  function updateHiddenTextarea() {
    const hiddenTextarea = document.getElementById('articleBodyHidden');
    if (hiddenTextarea) {
      hiddenTextarea.value = editorContent.innerHTML;
    }
  }
};

const initQuranModal = () => {
  const quranForm = document.getElementById('quranForm');
  if (!quranForm) return;
  
  quranForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const surahSelect = document.getElementById('surahSelect');
    const ayahNumber = document.getElementById('ayahNumber');
    const ayahText = document.getElementById('ayahText');
    
    const surahName = surahSelect.options[surahSelect.selectedIndex].text;
    const ayahNum = ayahNumber.value;
    const text = ayahText.value;
    
    if (!text.trim()) {
      alert('يرجى إدخال نص الآية');
      return;
    }
    
    // Create Quran verse HTML
    const quranHtml = `
      <div class="quran-verse" contenteditable="false" style="width: 500px; max-width: 100%;">
        <div class="quran-text">${text}</div>
        <div class="quran-reference">سورة ${surahName} - الآية ${ayahNum}</div>
      </div>
      <p><br></p>
    `;
    
    // Insert into editor using the improved method
    if (window.insertIntoEditor) {
      window.insertIntoEditor(quranHtml);
    }
    
    // Clear form and close modal
    quranForm.reset();
    popupManager.close('quranModal');
  });
};

const initImageInsertModal = () => {
  const imageInsertForm = document.getElementById('imageInsertForm');
  const inlineUploadArea = document.getElementById('inlineImageUploadArea');
  const inlineUploadPlaceholder = document.getElementById('inlineUploadPlaceholder');
  const inlineImageFile = document.getElementById('inlineImageFile');
  const inlineImagePreview = document.getElementById('inlineImagePreview');
  const inlinePreviewImg = document.getElementById('inlinePreviewImg');
  
  if (!imageInsertForm) return;
  
  // File upload handling
  inlineUploadPlaceholder.addEventListener('click', () => {
    inlineImageFile.click();
  });
  
  inlineImageFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      inlinePreviewImg.src = e.target.result;
      inlineUploadPlaceholder.style.display = 'none';
      inlineImagePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
    
    // Upload file
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const response = await fetch('/upload/image', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      if (response.ok && result.success) {
        inlinePreviewImg.src = result.url;
        inlinePreviewImg.dataset.uploadedUrl = result.url;
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('فشل في رفع الصورة');
    }
  });
  
  // Form submission
  imageInsertForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const imageUrl = inlinePreviewImg.dataset.uploadedUrl || inlinePreviewImg.src;
    const imageAlt = document.getElementById('imageAlt').value || 'صورة';
    const imageAlign = document.getElementById('imageAlign').value;
    
    if (!imageUrl) {
      alert('يرجى اختيار صورة أولاً');
      return;
    }
    
    // Create resizable image HTML
    const imageHtml = `
      <div class="resizable-img align-${imageAlign}" style="width: 300px; max-width: 100%;">
        <img src="${imageUrl}" alt="${imageAlt}" draggable="false">
        <div class="resize-handle top-left"></div>
        <div class="resize-handle top-right"></div>
        <div class="resize-handle bottom-left"></div>
        <div class="resize-handle bottom-right"></div>
      </div>
      <p><br></p>
    `;
    
    // Insert into editor using the improved method
    if (window.insertIntoEditor) {
      window.insertIntoEditor(imageHtml);
    }
    
    // Reset form and close modal
    imageInsertForm.reset();
    inlineUploadPlaceholder.style.display = 'block';
    inlineImagePreview.style.display = 'none';
    inlinePreviewImg.src = '';
    delete inlinePreviewImg.dataset.uploadedUrl;
    popupManager.close('imageInsertModal');
  });
};

const cleanupArticles = async () => {
  const cleanupBtn = document.getElementById('cleanupArticlesBtn');
  if (!cleanupBtn) return;
  
  // Confirm action
  if (!confirm('هل أنت متأكد من حذف المقالات غير الصالحة؟ هذا الإجراء لا يمكن التراجع عنه.')) {
    return;
  }
  
  try {
    // Show loading state
    cleanupBtn.disabled = true;
    cleanupBtn.textContent = '🔄 جارٍ التنظيف...';
    
    const response = await fetch('/admin/cleanup-articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to cleanup articles');
    }
    
    const result = await response.json();
    
    // Show success message
    alert(`تم بنجاح!\n${result.message}\nالمقالات المتبقية: ${result.remaining_count}`);
    
    // Refresh the articles table
    await fetchAdminArticles();
    
  } catch (error) {
    console.error('Error cleaning up articles:', error);
    alert('حدث خطأ أثناء تنظيف المقالات. يرجى المحاولة مرة أخرى.');
  } finally {
    // Reset button state
    cleanupBtn.disabled = false;
    cleanupBtn.textContent = '🗑️ تنظيف';
  }
};

const fetchAdminSeries = async () => {
  try {
    const response = await fetch('/admin/series');
    if (!response.ok) {
      throw new Error('Failed to fetch series');
    }
    
    const series = await response.json();
    renderSeriesTable(series);
    populateSeriesSelect(series);
    
  } catch (error) {
    console.error('Error fetching series:', error);
    const tableBody = document.getElementById("adminSeriesTable");
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #e74c3c;">تعذر تحميل السلاسل</td></tr>';
    }
  }
};

const renderSeriesTable = (series) => {
  const tableBody = document.getElementById("adminSeriesTable");
  if (!tableBody) return;
  
  if (series.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">لا توجد سلاسل حتى الآن</td></tr>';
    return;
  }
  
  const formatter = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
  
  const statusLabels = {
    'active': 'نشطة',
    'completed': 'مكتملة',
    'paused': 'متوقفة مؤقتاً'
  };
  
  tableBody.innerHTML = series.map(serie => `
    <tr>
      <td>
        <strong>${serie.title}</strong>
        <br>
        <small style="color: var(--color-text-muted);">${serie.description.substring(0, 60)}...</small>
      </td>
      <td>
        <span class="status ${serie.status}">${statusLabels[serie.status] || serie.status}</span>
      </td>
      <td>${serie.episode_count} حلقة</td>
      <td>${serie.author}</td>
      <td>${formatter.format(new Date(serie.created_at))}</td>
      <td>
        <button class="icon-btn" onclick="deleteSeries(${serie.id})" title="حذف السلسلة">🗑️</button>
      </td>
    </tr>
  `).join('');
};

const populateSeriesSelect = (series) => {
  const select = document.getElementById('episodeSeriesSelect');
  if (!select) return;
  
  // Clear existing options except the first one
  select.innerHTML = '<option value="">اختر السلسلة...</option>';
  
  // Add series options
  series.forEach(serie => {
    const option = document.createElement('option');
    option.value = serie.id;
    option.textContent = serie.title;
    select.appendChild(option);
  });
};

const deleteSeries = async (seriesId) => {
  if (!confirm('هل أنت متأكد من حذف هذه السلسلة؟ سيتم حذف جميع الحلقات أيضاً. هذا الإجراء لا يمكن التراجع عنه.')) {
    return;
  }
  
  try {
    const response = await fetch(`/admin/series/${seriesId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete series');
    }
    
    const result = await response.json();
    alert(result.message);
    
    // Refresh the series table
    await fetchAdminSeries();
    
  } catch (error) {
    console.error('Error deleting series:', error);
    alert('حدث خطأ أثناء حذف السلسلة. يرجى المحاولة مرة أخرى.');
  }
};

// Make deleteSeries available globally for onclick handlers
window.deleteSeries = deleteSeries;

const renderAdminPage = async () => {
  if (!document.body.classList.contains("admin-page")) return;
  
  // Fetch and display admin data
  await fetchAdminStats();
  await fetchAdminArticles();
  await fetchAdminSeries();
  
  // Initialize cleanup button
  const cleanupBtn = document.getElementById('cleanupArticlesBtn');
  if (cleanupBtn) {
    cleanupBtn.addEventListener('click', cleanupArticles);
  }
  
  
  const gate = document.getElementById("adminAuthGate");
  const metrics = document.querySelector(".metrics");
  const panels = document.querySelector(".admin-panels");
  const headerUser = document.querySelector(".admin-user span");
  const loginBtn = document.querySelector(".admin-user .auth-btn");
  const logoutBtn = document.querySelector("[data-action='logout']");

  const setLocked = (locked) => {
    if (gate) gate.setAttribute("aria-hidden", locked ? "false" : "true");
    [metrics, panels].forEach((section) => {
      if (section) section.classList.toggle("is-blurred", locked);
    });
    if (loginBtn) loginBtn.hidden = !locked;
    if (logoutBtn) logoutBtn.hidden = locked;
    if (headerUser) {
      headerUser.textContent = locked ? "يرجى تسجيل الدخول" : `مرحباً، ${state.currentUser.name}`;
    }
  };

  if (!state.currentUser) {
    setLocked(true);
    return;
  }

  setLocked(false);

  // Fetch and display admin statistics
  fetchAdminStats();

  // Fetch and display articles
  fetchAdminArticles();
  
  // Add direct event listener for the add article button
  const addArticleBtn = document.querySelector('[data-modal-target="articleModal"]');
  if (addArticleBtn) {
    addArticleBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (this.dataset.requiresAuth === "true" && !requireAuth()) {
        return;
      }
      openArticleModal();
    });
  }
  
  // Add image upload functionality
  setTimeout(() => {
    initImageUpload();
  }, 100);
};
const renderProfilePage = async () => {
  if (!document.body.classList.contains("profile-page")) return;

  if (!state.currentUser) {
    window.location.href = "login.html";
    return;
  }

  await refreshAccountSnapshot();

  const profile = state.account?.profile || {};
  const favorites = state.account?.favorites || [];
  const history = state.account?.history || [];

  const displayName = profile.fullName || state.currentUser.name || "";
  const nameEl = document.querySelector("[data-profile-name]");
  if (nameEl) nameEl.textContent = displayName;

  const roleEl = document.querySelector("[data-profile-role]");
  if (roleEl) {
    const roleKey = state.currentUser.role || "guest";
    const roleMap = {
      admin: "مدير",
      editor: "محرر",
      contributor: "مساهم",
      guest: "زائر"
    };
    roleEl.textContent = roleMap[roleKey] || roleKey;
  }

  document.querySelectorAll("[data-role='admin']").forEach((node) => {
    node.hidden = !["admin", "editor"].includes(state.currentUser.role);
  });

  const emailValue = profile.email || state.currentUser.email || "";
  const emailEl = document.querySelector("[data-profile-email]");
  if (emailEl) {
    emailEl.textContent = emailValue || "—";
    if (emailValue) {
      emailEl.setAttribute("href", `mailto:${emailValue}`);
    } else {
      emailEl.removeAttribute("href");
    }
  }

  const locationEl = document.querySelector("[data-profile-location]");
  if (locationEl) {
    locationEl.textContent = profile.location || "—";
  }

  const lastLoginEl = document.querySelector("[data-profile-last-login]");
  if (lastLoginEl) {
    const stamp = profile.lastLoginAt || null;
    if (stamp) {
      const formatted = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(stamp));
      lastLoginEl.textContent = formatted;
    } else {
      lastLoginEl.textContent = "—";
    }
  }

  const bioEl = document.querySelector("[data-profile-bio]");
  if (bioEl) {
    bioEl.textContent = profile.bio || "أضف نبذة تعريفية قصيرة لتظهر هنا.";
  }

  const avatarEl = document.querySelector("[data-profile-avatar]");
  if (avatarEl) {
    avatarEl.innerHTML = "";
    const avatar = profile.avatar || state.currentUser.avatar;
    if (avatar) {
      avatarEl.style.setProperty("--avatar-image", `url(${avatar})`);
      avatarEl.classList.add("has-image");
    } else {
      avatarEl.style.removeProperty("--avatar-image");
      avatarEl.classList.remove("has-image");
      const initial = (displayName || state.currentUser.email || "؟").trim().charAt(0) || "؟";
      avatarEl.textContent = initial.toUpperCase();
    }
  }

  const form = document.querySelector("[data-profile-form]");
  if (form) {
    const setValue = (name, value) => {
      const field = form.querySelector(`[name='${name}']`);
      if (!field) return;
      if (field.type === "checkbox") {
        field.checked = Boolean(value);
      } else {
        field.value = value || "";
      }
    };
    setValue("fullName", profile.fullName || state.currentUser.name || "");
    setValue("email", emailValue);
    setValue("location", profile.location || "");
    setValue("bio", profile.bio || "");
    const interestsList = Array.isArray(profile.interests) ? profile.interests.join("\n") : "";
    setValue("interests", interestsList);

    const notifications = profile.notifications || {};
    setValue("newsletter", notifications.newsletter);
    setValue("readingReminders", notifications.readingReminders);
    const digestField = form.querySelector("[name='digestFrequency']");
    if (digestField) {
      digestField.value = notifications.digestFrequency || "weekly";
    }
  }

  const favoritesContainer = document.querySelector("[data-profile-favorites]");
  if (favoritesContainer) {
    if (!favorites.length) {
      favoritesContainer.innerHTML = '<p class="empty-state">لا توجد عناصر مفضلة حتى الآن.</p>';
    } else {
      const markup = favorites
        .map((item) => {
          const categoryLabel = categoryLabels[item.category] || item.category || "مقالات";
          return `
        <article class="favorite-item">
          <img src="${item.cardImage || "assets/images/article-1.svg"}" alt="${item.title}" loading="lazy">
          <div class="favorite-body">
            <h4>${item.title}</h4>
            <p class="favorite-meta">${categoryLabel}</p>
            <div class="favorite-actions">
              <a href="article.html?slug=${item.slug}" class="read-link">قراءة الآن</a>
              <button type="button" class="text-link" data-action="toggle-favorite" data-article="${item.slug}">
                إزالة من المفضلة
              </button>
            </div>
          </div>
        </article>
      `;
        })
        .join("");
      favoritesContainer.innerHTML = markup;
    }
  }

  const historyContainer = document.querySelector("[data-reading-history]");
  if (historyContainer) {
    if (!history.length) {
      historyContainer.innerHTML = '<p class="empty-state">لم يتم تسجيل أي قراءة حديثًا.</p>';
    } else {
      const markup = history
        .map((entry) => {
          const progress = Math.min(100, Math.round((entry.progress || 0) * 100));
          const formatted = entry.lastReadAt
            ? new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.lastReadAt))
            : "غير معروف";
          const categoryLabel = categoryLabels[entry.category] || entry.category || "عام";
          return `
        <div class="history-item">
          <div class="history-header">
            <div>
              <h4>${entry.title}</h4>
              <span class="history-meta">${categoryLabel}</span>
            </div>
            <span class="history-date">${formatted}</span>
          </div>
          <div class="history-progress">
            <span style="width:${progress}%"></span>
          </div>
          <div class="history-progress-label">${progress}% مكتمل</div>
        </div>
      `;
        })
        .join("");
      historyContainer.innerHTML = markup;
    }
  }

  updateFavoriteButtons();
};

const renderPollResults = (results) => {
  const pollResults = document.getElementById("pollResults");
  if (!pollResults || !results) return;
  const totalNode = pollResults.querySelector("[data-role='total-votes']");
  if (totalNode) {
    totalNode.textContent = results.totalVotes ? `${results.totalVotes} مصوّت` : "لم تسجل أصوات بعد";
    totalNode.hidden = !results.totalVotes;
  }
  pollResults.querySelectorAll(".result-bar").forEach((bar) => {
    const value = bar.dataset.value;
    const match = results.options.find((option) => option.value === value);
    bar.classList.toggle("selected", results.selectedOption === value);
    const fill = bar.querySelector(".bar span");
    const percentNode = bar.querySelector(".percent");
    if (match) {
      if (fill) fill.style.width = `${match.percent}%`;
      if (percentNode) percentNode.textContent = `${match.percent}%`;
    }
  });
};

const initPoll = () => {
  const pollForm = document.getElementById("pollForm");
  const pollResults = document.getElementById("pollResults");
  if (!pollForm || !pollResults || !window.mockBackend) return;
  const pollId = pollForm.querySelector("[name='pollId']")?.value || "homepage-theme";
  try {
    const initial = window.mockBackend.pollResults(pollId);
    renderPollResults(initial);
    if (initial.hasVoted) {
      pollForm.hidden = true;
      pollResults.hidden = false;
    }
  } catch (error) {
    // ignore initial failure
  }

  pollForm.addEventListener("form:success", (event) => {
    const response = event.detail?.response;
    if (response?.options) {
      renderPollResults(response);
      pollForm.hidden = true;
      pollResults.hidden = false;
    }
  });

  pollForm.addEventListener("form:error", () => {
    pollForm.hidden = false;
  });
};

const initFilterBar = () => {
  const categoryFilter = document.getElementById("categoryFilter");
  if (categoryFilter) {
    categoryFilter.addEventListener("change", () => {
      state.filters.category = categoryFilter.value;
      renderHomePage();
    });
  }
  document.querySelectorAll(".filter-group.tags .tag").forEach((tagBtn) => {
    tagBtn.addEventListener("click", () => {
      state.filters.tag = state.filters.tag === tagBtn.dataset.tag ? null : tagBtn.dataset.tag;
      document.querySelectorAll(".filter-group.tags .tag").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.tag === state.filters.tag);
      });
      renderHomePage();
    });
  });
};

const initNavFilters = () => {
  const navLinks = document.querySelectorAll('.main-nav a[data-filter]');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const filter = link.dataset.filter;
      state.filters.category = filter;
      renderHomePage();
      
      // Scroll to articles section
      const articlesSection = document.getElementById('articles');
      if (articlesSection) {
        articlesSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
};

const loadNavDropdownContent = async (category, dropdownId) => {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;
  
  try {
    let content = '';
    
    if (category === 'series') {
      try {
        // Fetch latest series from API
        const response = await fetch('/api/series?limit=3&sort=newest');
        if (!response.ok) throw new Error('Failed to fetch series');
        
        const series = await response.json();
        
        if (series.length > 0) {
          // If series exist, show them
          content = `
            <div class="dropdown-header">آخر السلاسل</div>
            ${series.map(serie => `
              <a href="series-detail.html?slug=${serie.slug || serie.id}" class="dropdown-item">
                <img src="${serie.thumbnail || 'assets/images/default-series.svg'}" alt="${serie.title}">
                <div class="dropdown-item-content">
                  <div class="dropdown-item-title">${serie.title}</div>
                  <div class="dropdown-item-meta">${serie.episode_count || 0} حلقة • ${serie.status || 'جديدة'}</div>
                </div>
              </a>
            `).join('')}
          `;
        } else {
          // If no series exist, show message
          content = `
            <div class="dropdown-loading">لا توجد سلاسل حالياً</div>
          `;
        }
      } catch (error) {
        console.error('Error loading series:', error);
        content = `
          <div class="dropdown-loading">لا توجد سلاسل حالياً</div>
        `;
      }
    } else {
      // For categories, fetch latest articles
      const response = await fetch(`/api/articles?category=${category}&limit=3`);
      if (!response.ok) throw new Error('Failed to fetch articles');
      
      const articles = await response.json();
      const categoryName = categoryLabels[category] || category;
      
      if (articles.length === 0) {
        content = `
          <div class="dropdown-header">آخر مقالات ${categoryName}</div>
          <div class="dropdown-loading">لا توجد مقالات في هذا التصنيف حالياً</div>
        `;
      } else {
        content = `<div class="dropdown-header">آخر مقالات ${categoryName}</div>`;
        
        articles.slice(0, 3).forEach(article => {
          const published = new Intl.DateTimeFormat("ar-EG", {
            month: "short",
            day: "numeric"
          }).format(new Date(article.publishedAt));
          
          content += `
            <a href="article.html?slug=${article.slug}" class="dropdown-item">
              <img src="${article.cardImage || 'assets/images/default-article.svg'}" alt="${article.title}">
              <div class="dropdown-item-content">
                <div class="dropdown-item-title">${article.title}</div>
                <div class="dropdown-item-meta">${article.author} • ${published}</div>
              </div>
            </a>
          `;
        });
      }
    }
    
    dropdown.innerHTML = content;
  } catch (error) {
    console.error('Error loading dropdown content:', error);
    dropdown.innerHTML = '<div class="dropdown-loading">تعذر تحميل المحتوى</div>';
  }
};

const initNavDropdowns = () => {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    const category = item.dataset.category;
    const dropdownId = `dropdown-${category}`;
    let isLoaded = false;
    
    item.addEventListener('mouseenter', () => {
      if (!isLoaded) {
        loadNavDropdownContent(category, dropdownId);
        isLoaded = true;
      }
    });
  });
};

const initTagCloudShortcuts = () => {
  document.querySelectorAll(".tags-cloud .tag-badge[data-tag]").forEach((badge) => {
    badge.addEventListener("click", (event) => {
      const tag = badge.dataset.tag;
      if (!tag) return;
      event.preventDefault();
      state.filters.tag = tag;
      state.filters.category = "all";
      const select = document.getElementById("categoryFilter");
      if (select) select.value = "all";
      document.querySelectorAll(".filter-group.tags .tag").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.tag === tag);
      });
      renderHomePage();
      document.getElementById("articles")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
};

const initCarouselControls = () => {
  document.querySelectorAll(".carousel-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.carousel;
      const track = document.querySelector(`[data-carousel-track="${key}"]`);
      if (!track) return;
      const direction = btn.classList.contains("next") ? 1 : -1;
      track.scrollBy({
        left: direction * (track.clientWidth * 0.9),
        behavior: "smooth"
      });
    });
  });
};

const initPopups = () => {
  document.querySelectorAll("[data-modal-target]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = btn.dataset.modalTarget;
      console.log('Modal button clicked:', targetId);
      
      // Check authentication if required
      if (btn.dataset.requiresAuth === "true") {
        if (!state.currentUser || state.currentUser.role !== 'admin') {
          alert('يرجى تسجيل الدخول كمدير للوصول إلى هذه الميزة');
          return;
        }
      }
      
      if (targetId === "articleModal") {
        openArticleModal(); // Open in create mode
      } else if (targetId === "seriesModal") {
        console.log('Opening series modal');
        popupManager.open(targetId);
      } else if (targetId === "episodeModal") {
        console.log('Opening episode modal');
        // Refresh series list for episode creation
        if (typeof fetchAdminSeries === 'function') {
          fetchAdminSeries();
        }
        popupManager.open(targetId);
      } else {
        popupManager.open(targetId);
      }
    });
  });

  document.querySelectorAll("[data-popup-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const popup = btn.closest(".popup");
      if (popup?.id) popupManager.close(popup.id);
    });
  });
};

const initForms = () => {
  document.querySelectorAll("form[data-endpoint]").forEach((form) => {
    showFormStatus(form, "");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitBtn = form.querySelector("[type='submit']");
      toggleButtonState(submitBtn, true);
      showFormStatus(form, "");
      try {
        const response = await handleFormSubmission(form);
        const successMessage = response?.message || form.dataset.success || "✓ تم الحفظ";
        showFormStatus(form, successMessage, "success");
        form.dispatchEvent(new CustomEvent("form:success", { detail: { response }, bubbles: true }));
        if (response && typeof response === "object") {
          if (response.user || response.profile || response.favorites || response.history) {
            updateAuthState(response);
            updateAuthUI();
            renderProfilePage();
            updateFavoriteButtons();
          }
        }

        if (form.dataset.resetOnSuccess !== "false") {
          form.reset();
        }

        if (form.dataset.closeOnSuccess === "true") {
          const popup = form.closest(".popup");
          if (popup?.id) {
            window.setTimeout(() => popupManager.close(popup.id), 400);
          }
        }
        
        const endpoint = form.dataset.endpoint;
        // Special handling for series and episode forms
        if (endpoint === '/admin/series' || endpoint === '/admin/episodes') {
          // Refresh admin series data
          if (typeof fetchAdminSeries === 'function') {
            await fetchAdminSeries();
          }
          
          // Close modal
          const popup = form.closest(".popup");
          if (popup?.id) {
            setTimeout(() => popupManager.close(popup.id), 800);
          }
        }

        if (form.dataset.resetOnSuccess !== "false") {
          form.reset();
        }

        if (form.dataset.endpoint === "/auth/login") {
          // Refresh auth state after login
          await updateAuthState();
          updateAuthUI();
          renderAdminPage();
          if (document.body.classList.contains("login-page")) {
            const adminRole = state.currentUser?.role === "admin" || state.currentUser?.role === "editor";
            const destination = adminRole ? "admin.html" : "index.html";
            setTimeout(() => (window.location.href = destination), 800);
          }
        }

        if (form.dataset.endpoint === "/auth/register") {
          // Refresh auth state after registration
          await updateAuthState();
          updateAuthUI();
          renderAdminPage();
          if (document.body.classList.contains("signup-page")) {
            setTimeout(() => (window.location.href = "index.html"), 1200);
          }
        }

        if (form.dataset.endpoint === "/admin/articles" || form.dataset.endpoint.includes("/admin/articles/")) {
          // Refresh articles table after successful article creation/update
          fetchAdminArticles();
          // Close modal
          const popup = form.closest(".popup");
          if (popup?.id) {
            setTimeout(() => popupManager.close(popup.id), 800);
          }
          document.dispatchEvent(new CustomEvent("aqala:posts-updated"));
        }
      } catch (error) {
        const message = error.message || form.dataset.error || "تعذّر إتمام الطلب";
        showFormStatus(form, message, "error");
        form.dispatchEvent(new CustomEvent("form:error", { detail: { error }, bubbles: true }));
      } finally {
        toggleButtonState(submitBtn, false);
      }
    });
  });
};

const initAuthActions = () => {
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;

    if (action === "open-dashboard") {
      event.preventDefault();
      if (!requireAuth()) return;
      window.location.href = "admin.html";
      return;
    }

    if (action === "go-login") {
      event.preventDefault();
      window.location.href = "login.html";
      return;
    }

    if (action === "go-profile") {
      event.preventDefault();
      if (!requireAuth()) return;
      window.location.href = "profile.html";
      return;
    }
    if (action === "toggle-favorite") {
      event.preventDefault();
      const slug = target.dataset.article;
      if (!slug) return;
      if (!requireAuth()) return;
      try {
        const result = window.mockBackend?.toggleFavorite({ slug });
        if (result) {
          applyAccountSnapshot({ favorites: result.favorites });
          renderProfilePage(); // Remove await since we can't make the parent function async easily
          renderHomePage();
          updateFavoriteButtons();
        }
      } catch (error) {
        target.classList.add("is-error");
        setTimeout(() => target.classList.remove("is-error"), 1200);
      }
      return;
    }


    if (action === "logout") {
      event.preventDefault();
      
      // Call Flask backend logout endpoint
      fetch('/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }).then(async () => {
        // Update auth state and UI after logout
        await updateAuthState();
        updateAuthUI();
        renderAdminPage();
        updateFavoriteButtons();
        renderProfilePage();
        
        // Redirect to home page
        window.location.href = 'index.html';
      }).catch(error => {
        console.error('Logout error:', error);
        // Even if logout fails, clear local state
        state.currentUser = null;
        updateAuthUI();
        window.location.href = 'index.html';
      });
    }

    if (action === "preview-article") {
      const slug = target.dataset.article;
      if (slug) window.open(`article.html?slug=${slug}`, "_blank");
    }

    if (action === "copy-link") {
      const slug = target.dataset.article;
      if (!slug || !navigator.clipboard) return;
      navigator.clipboard
        .writeText(new URL(`article.html?slug=${slug}`, window.location.href).toString())
        .then(() => {
          target.textContent = "✓";
          setTimeout(() => (target.textContent = "🔗"), 1200);
        })
        .catch(() => {
          target.textContent = "✕";
          setTimeout(() => (target.textContent = "🔗"), 1200);
        });
    }

    if (action === "edit-article") {
      event.preventDefault();
      const articleId = target.dataset.articleId;
      if (!articleId) return;
      
      // Fetch article data and open modal for editing
      fetch(`/admin/articles`)
        .then(response => response.json())
        .then(articles => {
          const article = articles.find(a => a.id == articleId);
          if (article) {
            openArticleModal(article);
          }
        })
        .catch(error => {
          console.error('Error fetching article for edit:', error);
          alert('فشل في تحميل بيانات المقال');
        });
    }

    if (action === "delete-article") {
      event.preventDefault();
      const articleId = target.dataset.articleId;
      if (articleId) {
        deleteArticle(articleId);
      }
    }
  });
};

const initArticleRating = () => {
  const form = document.querySelector(".rating-form");
  if (!form) return;
  form.addEventListener("form:success", () => {
    const status = form.querySelector(".form-status");
    if (status) status.textContent = "شكراً لتقييمك";
  });
};

// Load and display latest series on home page
const loadLatestSeries = async () => {
  const seriesGrid = document.getElementById('seriesGrid');
  if (!seriesGrid) return;

  try {
    const response = await fetch('/api/series?limit=3&sort=newest');
    if (!response.ok) throw new Error('Failed to fetch series');
    
    const series = await response.json();
    
    if (series.length === 0) {
      seriesGrid.innerHTML = `
        <div class="empty-state">
          <p>لا توجد سلاسل متاحة حالياً</p>
          <a href="series.html" class="btn primary">تصفح جميع السلاسل</a>
        </div>`;
      return;
    }

    seriesGrid.innerHTML = series.map(serie => `
      <article class="series-card">
        <img src="${serie.thumbnail || 'assets/images/default-series.svg'}" 
             alt="${serie.title}" 
             loading="lazy">
        <div class="card-body">
          ${serie.category ? `<span class="series-tag">${serie.category}</span>` : ''}
          <h3>${serie.title}</h3>
          <p>${serie.description || ''}</p>
          <a href="series-detail.html?slug=${serie.slug || serie.id}" class="card-link">
            عرض السلسلة
          </a>
        </div>
      </article>
    `).join('');
  } catch (error) {
    console.error('Error loading series:', error);
    seriesGrid.innerHTML = `
      <div class="error-state">
        <p>حدث خطأ أثناء تحميل السلاسل</p>
        <button class="btn" onclick="window.location.reload()">إعادة المحاولة</button>
      </div>`;
  }
};

const init = async () => {
  // Update current user when backend is available
  await updateAuthState();
  
  initThemeToggle();
  initPopups();
  initForms();
  initCarouselControls();
  initAuthActions();
  initPoll();
  initFilterBar();
  initNavFilters();
  initNavDropdowns();
  initTagCloudShortcuts();
  initArticleRating();
  updateAuthUI();
  renderHomePage();
  renderSeriesPage();
  renderSeriesDetailPage();
  renderArticlePage();
  renderAdminPage();
  renderProfilePage();
  updateFavoriteButtons();
  loadLatestSeries();

  document.addEventListener("aqala:posts-updated", () => {
    renderHomePage();
    renderAdminPage();
    renderProfilePage();
    updateFavoriteButtons();
  });
};

document.addEventListener("DOMContentLoaded", init);

































