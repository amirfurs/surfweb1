(function (window) {
  const STORAGE_KEY = "aqala-data-v1";
  const DATA_VERSION = "2025-09-22";
  const SESSION_KEY = "aqala-active-session";
  const POLL_VOTE_PREFIX = "aqala-poll-vote-";

  const todayString = () => new Date().toISOString();

  const slugify = (input = "") => {
    return input
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[\u0600-\u06FF]+/g, (chars) => chars)
      .replace(/[\s_]+/g, "-")
      .replace(/[^\w\u0600-\u06FF-]+/g, "")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const normalizeParagraphs = (text = "") => {
    const trimmed = text.trim();
    if (!trimmed) return "<p></p>";
    return (
      "<p>" +
      trimmed
        .replace(/\r/g, "")
        .replace(/\n{2,}/g, "</p><p>")
        .replace(/\n/g, "<br>") +
      "</p>"
    );
  };

  const withFallbackStorage = (preferred, fallback) => {
    try {
      const key = `aqala-storage-test-${Date.now()}`;
      preferred.setItem(key, "1");
      preferred.removeItem(key);
      return preferred;
    } catch (error) {
      return fallback;
    }
  };

  class MockBackend {
    constructor() {
      this.storageKey = STORAGE_KEY;
      this.sessionKey = SESSION_KEY;
      this.storage = window.localStorage;
      this.sessionStore = withFallbackStorage(window.localStorage, window.sessionStorage);
      this.data = this._loadData();
      if (!this.data || this.data.__version !== DATA_VERSION) {
        this.data = this._seedData();
        this._persist();
      }
    }

    _loadData() {
      try {
        const raw = this.storage.getItem(this.storageKey);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        return null;
      }
    }

    _persist() {
      try {
        this.storage.setItem(this.storageKey, JSON.stringify(this.data));
      } catch (error) {
        // ignore when storage unavailable
      }
    }

    _seedData() {
      const adminUser = {
        id: "user-admin",
        name: "سارة المدير",
        email: "admin@aqala.com",
        password: "aqala123",
        role: "admin",
        avatar: "assets/images/thumb-5.svg"
      };

      const secondAdmin = {
        id: "user-editor",
        name: "أمجد المشرف",
        email: "admin2@aqala.com",
        password: "secure123",
        role: "admin",
        avatar: "assets/images/thumb-4.svg"
      };

      const basePosts = [
        {
          id: "post-1",
          slug: "rational-discourse",
          title: "كيف نبني خطاباً عقلانياً يواجه الشبهات",
          author: "أحمد السلمي",
          publishedAt: "2025-02-11T08:00:00.000Z",
          category: "logic",
          tags: ["المنطق", "الفلسفة"],
          excerpt: "نظرة استراتيجية إلى أدوات الخطاب العقلاني وكيفية إعداد الحجج المضادة للشبهات المعاصرة.",
          heroImage: "assets/images/article-1.svg",
          cardImage: "assets/images/article-1.svg",
          body: normalizeParagraphs(
            "يحتاج الخطاب العقلاني اليوم إلى مراجعة جذرية تستوعب التحولات السريعة في المجال المعرفي المعاصر. فمواجهة الشبهات لا تعتمد على استدعاء النصوص فحسب، بل تتطلب بناء منظومة فكرية تتقن أصول المنطق ومناهج النقد وقراءات التراث في سياقه.\n\nالمدخل الأول يبدأ من تحديد مصادر الشبهة وتحليل بنيتها المنطقية. كثير من الإشكالات المطروحة اليوم تعتمد على مغالطات تركيبية أو تفكيك سياقات النصوص عن بيئتها المعرفية، لذا يتعين تدريب المهتمين على كشف المغالطة قبل الرد على المضمون.\n\nكما ينبغي إدراك أن الخطاب الموجه للجمهور العام يختلف عن الخطاب الأكاديمي المتخصص. من المهم توفير طبقات متعددة من المحتوى: ملخصات مبسطة، مقالات بحثية، ودراسات مفصلة مع ملاحقها ومراجعها.\n\nالتاريخ الإسلامي يقدم نموذجاً ثرياً في التكامل بين النقل والعقل، خصوصاً في تجربة المتكلمين الذين واجهوا تيارات فكرية متعددة وأسهموا في بناء نظم معرفية دقيقة.\n\nوفي سياق مواجهة الشبهات، يجب أن يكون الهدف النهائي هو بناء ثقة معرفية تعزز اليقين وتفتح المجال للحوار الرشيد بعيداً عن التشنج أو الانغلاق."
          ),
          comments: 24,
          status: "published",
          trendingScore: 9,
          recommendedScore: 8
        },
        {
          id: "post-2",
          slug: "linguistic-argument-quran",
          title: "تفكيك الشبهة اللغوية حول نصوص القرآن",
          author: "ليلى الغامدي",
          publishedAt: "2025-01-24T08:00:00.000Z",
          category: "doubts",
          tags: ["القرآن", "السنة"],
          excerpt: "تحليل للسياقات اللغوية والبلاغية التي تُغفل عند طرح الشبهات حول النص القرآني.",
          heroImage: "assets/images/article-2.svg",
          cardImage: "assets/images/article-2.svg",
          body: normalizeParagraphs(
            "تبدأ معالجة الشبهات اللغوية بتأطير النص القرآني في سياقه التداولي، واستحضار فقه اللغة وتاريخ الألفاظ. كثير من الاعتراضات تُبنى على اقتطاع النصوص من سياقها الكامل، لذلك يلزم إعادة بناء السياق قبل الرد.") ,
          comments: 18,
          status: "published",
          trendingScore: 7,
          recommendedScore: 6
        },
        {
          id: "post-3",
          slug: "prophethood-evidence",
          title: "منهجية إثبات النبوة في ضوء الأدلة التاريخية",
          author: "سارة المدني",
          publishedAt: "2024-12-22T08:00:00.000Z",
          category: "prophethood",
          tags: ["النبوة", "السيرة"],
          excerpt: "رحلة في المصادر التاريخية والتحليل النقدي لإثبات دعوى النبوة.",
          heroImage: "assets/images/article-3.svg",
          cardImage: "assets/images/article-3.svg",
          body: normalizeParagraphs(
            "يستند إثبات النبوة إلى براهين مركبة تجمع بين شهادة النص القطعي والوقائع التاريخية والتحول الحضاري الذي أحدثه الوحي.") ,
          comments: 32,
          status: "published",
          trendingScore: 8,
          recommendedScore: 9
        },
        {
          id: "post-4",
          slug: "logic-philosophy-overview",
          title: "مدخل معاصر إلى فلسفة المنطق والتحليل",
          author: "د. يوسف الحمادي",
          publishedAt: "2024-12-05T08:00:00.000Z",
          category: "logic",
          tags: ["المنطق"],
          excerpt: "تأملات في علاقة المنطق بالعلوم العقلية ومناهج البرهنة الحديثة.",
          heroImage: "assets/images/article-4.svg",
          cardImage: "assets/images/article-4.svg",
          body: normalizeParagraphs(
            "يستعيد المقال الأساسات الكبرى للمنطق الصوري ثم يربطها بمباحث الاستدلال المعاصر مع مقارنة بين المدارس الإسلامية والاتجاهات الحديثة.") ,
          comments: 11,
          status: "published",
          trendingScore: 6,
          recommendedScore: 7
        },
        {
          id: "post-5",
          slug: "divine-justice-and-reason",
          title: "العدالة الإلهية بين النص والعقل",
          author: "مروان الراشد",
          publishedAt: "2024-11-18T08:00:00.000Z",
          category: "theology",
          tags: ["العقيدة", "العدالة"],
          excerpt: "تحقيق في مباحث العدل الإلهي بين المدارس الكلامية والفلسفية.",
          heroImage: "assets/images/article-5.svg",
          cardImage: "assets/images/article-5.svg",
          body: normalizeParagraphs(
            "يوازن المقال بين المعالجة الكلامية التقليدية لقضية العدل الإلهي ومقاربات الفلسفة الأخلاقية المعاصرة مع إبراز نقاط الالتقاء والاختلاف.") ,
          comments: 27,
          status: "published",
          trendingScore: 9,
          recommendedScore: 5
        },
        {
          id: "post-6",
          slug: "epistemology-in-islamic-thought",
          title: "معرفة اليقين: قراءة في نظريات المعرفة الإسلامية",
          author: "آمنة الأنصاري",
          publishedAt: "2024-10-29T08:00:00.000Z",
          category: "philosophy",
          tags: ["الفلسفة", "الابستمولوجيا"],
          excerpt: "عرض تحليلي لمفهوم المعرفة عند علماء الإسلام ومقارنته بالاتجاهات الحديثة.",
          heroImage: "assets/images/article-6.svg",
          cardImage: "assets/images/article-6.svg",
          body: normalizeParagraphs(
            "يتناول المقال محاور المعرفة اليقينية وقنواتها في التراث الإسلامي مع مقارنة موجزة بالمدارس التحليلية المعاصرة.") ,
          comments: 9,
          status: "published",
          trendingScore: 5,
          recommendedScore: 8
        }
      ];

      const poll = {
        id: "homepage-theme",
        title: "أي سمة تفضل لعرض المقالات؟",
        options: {
          light: { value: "light", label: "سمة مضيئة", votes: 42 },
          dark: { value: "dark", label: "سمة داكنة", votes: 24 },
          sepia: { value: "sepia", label: "سمة دافئة", votes: 12 }
        }
      };
      const firstPost = basePosts[0];
      const secondPost = basePosts[1];
      const thirdPost = basePosts[2];
      const fourthPost = basePosts[3];

      const adminFavorites = [firstPost, secondPost, thirdPost].filter(Boolean).map((post) => post.slug);
      const editorFavorites = [thirdPost, fourthPost].filter(Boolean).map((post) => post.slug);

      const adminHistory = [firstPost, thirdPost, secondPost].filter(Boolean).map((post, index) => ({
        slug: post.slug,
        title: post.title,
        category: post.category,
        progress: [0.92, 0.45, 0.68][index] || 0.5,
        lastReadAt: new Date(Date.now() - (index + 1) * 86400000).toISOString()
      }));

      const editorHistory = [secondPost, fourthPost].filter(Boolean).map((post, index) => ({
        slug: post.slug,
        title: post.title,
        category: post.category,
        progress: [0.6, 0.3][index] || 0.4,
        lastReadAt: new Date(Date.now() - (index + 3) * 86400000).toISOString()
      }));


      return {
        __version: DATA_VERSION,
        users: [adminUser, secondAdmin],
        posts: basePosts,
        polls: { [poll.id]: poll },
        newsletterSubscribers: [],
        ratings: {},
        profiles: {
          [adminUser.id]: {
            fullName: adminUser.name,
            email: adminUser.email,
            bio: "باحث رئيسي في المشروع يهتم بصناعة المحتوى الفلسفي.",
            location: "الرياض، السعودية",
            interests: ["الفكر الفلسفي", "رد الشبهات", "التاريخ الإسلامي"],
            notifications: {
              newsletter: true,
              readingReminders: true,
              digestFrequency: "weekly"
            },
            lastLoginAt: todayString()
          },
          [secondAdmin.id]: {
            fullName: secondAdmin.name,
            email: secondAdmin.email,
            bio: "محرر المحتوى ومسؤول مراجعة المواد.",
            location: "عمّان، الأردن",
            interests: ["علم الكلام", "تحرير المقالات"],
            notifications: {
              newsletter: false,
              readingReminders: true,
              digestFrequency: "monthly"
            },
            lastLoginAt: todayString()
          }
        },
        favorites: {
          [adminUser.id]: adminFavorites,
          [secondAdmin.id]: editorFavorites
        },
        readingHistory: {
          [adminUser.id]: adminHistory,
          [secondAdmin.id]: editorHistory
        }
      };
    }

    _requireAuth() {
      const user = this.getCurrentUser();
      if (!user) {
        const error = new Error("???? ????? ?????? ?????? ??? ???????");
        error.code = "UNAUTHENTICATED";
        throw error;
      }
      return user;
    }

    _ensureUserCollections(userId) {
      if (!userId) return null;
      const user = this.data.users.find((item) => item.id === userId);
      if (!this.data.profiles[userId]) {
        this.data.profiles[userId] = {
          fullName: user?.name || "",
          email: user?.email || "",
          bio: "",
          location: "",
          interests: [],
          notifications: {
            newsletter: false,
            readingReminders: false,
            digestFrequency: "weekly"
          },
          lastLoginAt: todayString(),
          avatar: user?.avatar || ""
        };
      } else if (user) {
        const profile = this.data.profiles[userId];
        profile.fullName = profile.fullName || user.name || "";
        profile.email = profile.email || user.email || "";
        profile.avatar = profile.avatar || user.avatar || "";
      }
      if (!this.data.favorites[userId]) {
        this.data.favorites[userId] = [];
      }
      if (!this.data.readingHistory[userId]) {
        this.data.readingHistory[userId] = [];
      }
      return this.data.profiles[userId];
    }

    _collectFavoritePosts(userId) {
      this._ensureUserCollections(userId);
      return this.data.favorites[userId]
        .map((slug) => this.getPostBySlug(slug))
        .filter(Boolean)
        .map((post) => ({
          slug: post.slug,
          title: post.title,
          category: post.category,
          cardImage: post.cardImage,
          excerpt: post.excerpt
        }));
    }

    _collectReadingHistory(userId) {
      this._ensureUserCollections(userId);
      return this.data.readingHistory[userId].map((entry) => {
        const post = this.getPostBySlug(entry.slug) || {};
        return {
          slug: entry.slug,
          title: entry.title || post.title || entry.slug,
          category: entry.category || post.category || "misc",
          progress: entry.progress ?? 0,
          lastReadAt: entry.lastReadAt || todayString()
        };
      });
    }

    getCurrentUser() {
      try {
        const raw = this.sessionStore.getItem(this.sessionKey);
        if (!raw) return null;
        const session = JSON.parse(raw);
        const user = this.data.users.find((item) => item.id === session.userId);
        if (!user) return null;
        const { password, ...safe } = user;
        return safe;
      } catch (error) {
        return null;
      }
    }

    login(payload = {}) {
      const email = (payload.email || "").trim().toLowerCase();
      const password = (payload.password || "").trim();
      const user = this.data.users.find((item) => item.email.toLowerCase() === email);
      if (!user || user.password !== password) {
        throw new Error("بيانات الدخول غير صحيحة");
      }
      this.sessionStore.setItem(
        this.sessionKey,
        JSON.stringify({ userId: user.id, loggedInAt: todayString() })
      );
      const { password: pw, ...safe } = user;
      const profile = this._ensureUserCollections(user.id);
      profile.lastLoginAt = todayString();
      this._persist();
      return {
        message: `?????? ${user.name}!`,
        user: safe,
        profile: { ...profile },
        favorites: this._collectFavoritePosts(user.id),
        history: this._collectReadingHistory(user.id)
      };
    }

    register(payload = {}) {
      const fullName = (payload.fullName || payload.name || "").trim();
      const email = (payload.email || "").trim().toLowerCase();
      const password = (payload.password || "").trim();
      const confirm = (payload.confirmPassword || payload.passwordConfirm || "").trim();
      if (!fullName || !email || !password) {
        throw new Error("يرجى تعبئة الحقول المطلوبة");
      }
      if (password.length < 6) {
        throw new Error("كلمة المرور يجب ألا تقل عن 6 أحرف");
      }
      if (password !== confirm) {
        throw new Error("كلمتا المرور غير متطابقتان");
      }
      if (this.data.users.some((user) => user.email.toLowerCase() === email)) {
        throw new Error("البريد الإلكتروني مستخدم بالفعل");
      }
      const id = `user-${Date.now()}`;
      const newUser = {
        id,
        name: fullName,
        email,
        password,
        role: "contributor",
        avatar: "assets/images/thumb-6.svg"
      };
      this.data.users.push(newUser);
      this._persist();
      this.sessionStore.setItem(
        this.sessionKey,
        JSON.stringify({ userId: newUser.id, loggedInAt: todayString() })
      );
      const { password: pw, ...safe } = newUser;
      const profile = this._ensureUserCollections(newUser.id);
      profile.fullName = newUser.name;
      profile.email = newUser.email;
      profile.lastLoginAt = todayString();
      this._persist();
      return {
        message: "?? ????? ?????? ?????",
        user: safe,
        profile: { ...profile },
        favorites: this._collectFavoritePosts(newUser.id),
        history: this._collectReadingHistory(newUser.id)
      };
    }
    getProfile() {
      const user = this._requireAuth();
      const profile = { ...this._ensureUserCollections(user.id) };
      const favorites = this._collectFavoritePosts(user.id);
      const history = this._collectReadingHistory(user.id);
      return {
        user,
        profile,
        favorites,
        history
      };
    }

    updateProfile(payload = {}) {
      const user = this._requireAuth();
      const record = this.data.users.find((item) => item.id === user.id);
      if (!record) {
        throw new Error("???? ????? ?????? ??????");
      }
      const fullName = (payload.fullName || payload.name || record.name || "").toString().trim();
      const emailInput = (payload.email || record.email || "").toString().trim().toLowerCase();
      if (!fullName) {
        throw new Error("???? ????? ?????? ????????");
      }
      if (!emailInput) {
        throw new Error("?????? ?????????? ?????? ??????");
      }
      if (emailInput !== record.email.toLowerCase()) {
        if (this.data.users.some((item) => item.id !== record.id && item.email.toLowerCase() === emailInput)) {
          throw new Error("?????? ?????????? ?????? ??????");
        }
        record.email = emailInput;
      }
      record.name = fullName;
      const profile = this._ensureUserCollections(user.id);
      profile.fullName = fullName;
      profile.email = record.email;
      profile.bio = (payload.bio || profile.bio || "").toString().trim();
      profile.location = (payload.location || profile.location || "").toString().trim();
      if (payload.interests !== undefined) {
        const rawInterests = Array.isArray(payload.interests)
          ? payload.interests
          : payload.interests
              .toString()
              .split(/[,،\r\n]+/);
        profile.interests = rawInterests
          .map((value) => value.trim())
          .filter(Boolean)
          .slice(0, 10);
      }
      const parseBoolean = (value, fallback) => {
        if (value === undefined || value === null || value === '') return fallback;
        if (typeof value === 'boolean') return value;
        const normalized = value.toString().toLowerCase();
        return ['true', '1', 'yes', 'on'].includes(normalized);
      };
      const currentNotifications = profile.notifications || {};
      profile.notifications = {
        newsletter: parseBoolean(payload.newsletter, !!currentNotifications.newsletter),
        readingReminders: parseBoolean(payload.readingReminders, !!currentNotifications.readingReminders),
        digestFrequency: (payload.digestFrequency || currentNotifications.digestFrequency || 'weekly').toString()
      };
      profile.updatedAt = todayString();
      this._persist();
      const { password, ...safe } = record;
      return {
        message: "?? ????? ?????? ??????",
        user: safe,
        profile: { ...profile },
        favorites: this._collectFavoritePosts(user.id),
        history: this._collectReadingHistory(user.id)
      };
    }

    getFavorites() {
      const user = this._requireAuth();
      return this._collectFavoritePosts(user.id);
    }

    toggleFavorite(payload = {}) {
      const user = this._requireAuth();
      const slug = (payload.slug || payload.postSlug || '').toString().trim();
      if (!slug) {
        throw new Error("?????? ??????? ?????");
      }
      const post = this.getPostBySlug(slug);
      if (!post) {
        throw new Error("?????? ??? ?????");
      }
      this._ensureUserCollections(user.id);
      const favorites = this.data.favorites[user.id];
      const index = favorites.indexOf(slug);
      let status = 'added';
      if (index >= 0) {
        favorites.splice(index, 1);
        status = 'removed';
      } else {
        favorites.unshift(slug);
      }
      this._persist();
      return {
        message: status === 'added' ? '?? ??? ????? ?????????' : '?? ????? ????? ?????????',
        status,
        favorites: this._collectFavoritePosts(user.id)
      };
    }

    getReadingHistory() {
      const user = this._requireAuth();
      return this._collectReadingHistory(user.id);
    }

    trackReading(payload = {}) {
      const user = this._requireAuth();
      const slug = (payload.slug || payload.postSlug || '').toString().trim();
      if (!slug) {
        throw new Error('?????? ??????? ?????');
      }
      const post = this.getPostBySlug(slug);
      if (!post) {
        throw new Error('?????? ??? ?????');
      }
      const progressValue = Number(payload.progress ?? payload.completion ?? payload.percentage ?? 0);
      const progress = Number.isFinite(progressValue) ? Math.max(0, Math.min(1, progressValue)) : 0;
      this._ensureUserCollections(user.id);
      const history = this.data.readingHistory[user.id];
      const existing = history.find((item) => item.slug === slug);
      if (existing) {
        existing.progress = Math.max(existing.progress ?? 0, progress);
        existing.lastReadAt = todayString();
        existing.title = post.title;
        existing.category = post.category;
      } else {
        history.unshift({
          slug: post.slug,
          title: post.title,
          category: post.category,
          progress,
          lastReadAt: todayString()
        });
      }
      this.data.readingHistory[user.id] = history.slice(0, 50);
      this._persist();
      return {
        message: '?? ????? ???? ???????',
        history: this._collectReadingHistory(user.id)
      };
    }

    logout() {
      this.sessionStore.removeItem(this.sessionKey);
    }

    subscribeNewsletter(payload = {}) {
      const email = (payload.email || "").trim().toLowerCase();
      if (!email) throw new Error("يرجى إدخال البريد الإلكتروني");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("البريد الإلكتروني غير صالح");
      }
      if (this.data.newsletterSubscribers.includes(email)) {
      }
      this.data.newsletterSubscribers.push(email);
      this._persist();
    }

    _getPoll(pollId) {
      const poll = this.data.polls[pollId];
      if (!poll) throw new Error("الاستطلاع غير متاح حالياً");
      return poll;
    }

    _recordVote(pollId, choice) {
      const key = `${POLL_VOTE_PREFIX}${pollId}`;
      try {
        window.localStorage.setItem(key, choice);
      } catch (error) {
        this.sessionStore.setItem(key, choice);
      }
    }

    _getVote(pollId) {
      const key = `${POLL_VOTE_PREFIX}${pollId}`;
      return window.localStorage.getItem(key) || this.sessionStore.getItem(key);
    }

    votePoll(payload = {}) {
      const { pollId, theme } = payload;
      const poll = this._getPoll(pollId);
      if (!poll.options[theme]) {
        throw new Error("الخيار المطلوب غير متاح");
      }
      if (this._getVote(pollId)) {
        throw new Error("لقد شاركت في الاستطلاع مسبقاً");
      }
      poll.options[theme].votes += 1;
      this._recordVote(pollId, theme);
      this._persist();
      return this.pollResults(pollId, theme);
    }

    pollResults(pollId, selectedValue) {
      const poll = this._getPoll(pollId);
      const totalVotes = Object.values(poll.options).reduce(
        (sum, option) => sum + (option.votes || 0),
        0
      );
      const vote = selectedValue || this._getVote(pollId);
      const options = Object.values(poll.options).map((option) => {
        const percent = totalVotes ? Math.round((option.votes / totalVotes) * 100) : 0;
          value: option.value,
          label: option.label,
          votes: option.votes,
          percent
        };
      });
        pollId,
        title: poll.title,
        options,
        totalVotes,
        hasVoted: Boolean(vote),
        selectedOption: vote || null
      };
    }

    getPosts(filter = {}) {
      const { category, tag, limit } = filter;
      let items = [...this.data.posts];
      if (category && category !== "all") {
        items = items.filter((post) => post.category === category);
      }
      if (tag) {
        items = items.filter((post) => post.tags?.includes(tag));
      }
      items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      return typeof limit === "number" ? items.slice(0, limit) : items;
    }

    getPostBySlug(slug) {
      return this.data.posts.find((post) => post.slug === slug) || null;
    }

    createArticle(payload = {}) {
      const user = this._requireAuth();
      const { title, category, tags, body } = payload;
      if (!title || !body) {
        throw new Error("يرجى إدخال عنوان ومحتوى للمقال");
      }
      const id = `post-${Date.now()}`;
      const baseSlug = slugify(title) || `article-${Date.now()}`;
      const slug = this.data.posts.some((post) => post.slug === baseSlug)
        ? `${baseSlug}-${Date.now()}`
        : baseSlug;
      const tagsArray = Array.isArray(tags)
        ? tags.filter(Boolean)
        : (tags || "")
            .split(/[,،]/)
            .map((item) => item.trim())
            .filter(Boolean);
      const article = {
        id,
        slug,
        title,
        author: user.name,
        publishedAt: todayString(),
        category: category || "misc",
        tags: tagsArray,
        excerpt: body.slice(0, 160) + (body.length > 160 ? "..." : ""),
        heroImage: "assets/images/article-4.svg",
        cardImage: "assets/images/article-4.svg",
        body: normalizeParagraphs(body),
        comments: 0,
        status: "published",
        trendingScore: Math.floor(Math.random() * 6) + 4,
        recommendedScore: Math.floor(Math.random() * 6) + 4
      };
      this.data.posts.unshift(article);
      this._persist();
        message: "تم حفظ المقال ونشره فوراً",
        article
      };
    }

    createPoll(payload = {}) {
      this._requireAuth();
      const { question, options } = payload;
      if (!question || !options) {
        throw new Error("يرجى إدخال سؤال وخيارات الاستطلاع");
      }
      const id = `poll-${Date.now()}`;
      const parsedOptions = options
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (parsedOptions.length < 2) {
        throw new Error("أدخل خيارين على الأقل");
      }
      const pollOptions = parsedOptions.reduce((acc, label, index) => {
        const value = slugify(label) || `option-${index + 1}`;
        acc[value] = { value, label, votes: 0 };
        return acc;
      }, {});
      this.data.polls[id] = {
        id,
        title: question,
        options: pollOptions
      };
      this._persist();
    }

    createUser(payload = {}) {
      this._requireAuth();
      const { fullName, email, role } = payload;
      if (!fullName || !email) {
        throw new Error("يرجى إدخال اسم وبريد المستخدم");
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (this.data.users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
        throw new Error("البريد الإلكتروني مستخدم بالفعل");
      }
      const id = `user-${Date.now()}`;
      const newUser = {
        id,
        name: fullName,
        email: normalizedEmail,
        role: role || "contributor",
        password: "password123"
      };
      this.data.users.push(newUser);
      this._persist();
      const { password, ...safeUser } = newUser;
        message: "تم إضافة المستخدم بكلمة مرور افتراضية",
        user: safeUser
      };
    }

    rateArticle(slug, payload = {}) {
      const { rating } = payload;
      if (!rating) throw new Error("يرجى اختيار تقييم");
      const article = this.getPostBySlug(slug);
      if (!article) throw new Error("المقال غير موجود");
      this.data.ratings[slug] = this.data.ratings[slug] || [];
      this.data.ratings[slug].push({ rating, at: todayString() });
      this._persist();
    }

    processRequest(endpoint = "", method = "GET", payload = {}) {
      const [path, queryString] = endpoint.split("?");
      const normalizedMethod = method.toUpperCase();
      const query = new URLSearchParams(queryString || "");

      switch (path) {
        case "/auth/login":
          if (normalizedMethod !== "POST") {
            throw new Error("طريقة الإرسال غير مدعومة");
          }
          return this.login(payload);
        case "/auth/register":
          if (normalizedMethod !== "POST") {
            throw new Error("طريقة الإرسال غير مدعومة");
          }
          return this.register(payload);
        case "/auth/logout":
          return this.logout();
        case "/newsletter/subscribe":
          return this.subscribeNewsletter(payload);
        case "/polls/vote":
          return this.votePoll(payload);
        case "/polls/results":
          return this.pollResults(query.get("pollId") || payload.pollId || "homepage-theme");
        case "/user/profile":
          if (normalizedMethod === "GET") {
            return this.getProfile();
          }
          if (["POST", "PUT", "PATCH"].includes(normalizedMethod)) {
            return this.updateProfile(payload);
          }
          throw new Error("????? ??????? ??? ??????");
        case "/user/favorites":
          if (normalizedMethod === "GET") {
            return this.getFavorites();
          }
          if (normalizedMethod === "POST") {
            return this.toggleFavorite(payload);
          }
          throw new Error("????? ??????? ??? ??????");
        case "/user/reading-history":
          if (normalizedMethod === "GET") {
            return this.getReadingHistory();
          }
          if (["POST", "PUT", "PATCH"].includes(normalizedMethod)) {
            return this.trackReading(payload);
          }
          throw new Error("????? ??????? ??? ??????");
        case "/admin/articles":
          if (normalizedMethod !== "POST") {
            throw new Error("طريقة الإرسال غير مدعومة");
          }
          return this.createArticle(payload);
        case "/admin/polls":
          return this.createPoll(payload);
        case "/admin/users":
          return this.createUser(payload);
        default: {
          const ratingMatch = path.match(/^\/articles\/(.+)\/rating$/);
          if (ratingMatch) {
            const slug = ratingMatch[1];
            return this.rateArticle(slug, payload);
          }
          throw new Error("المسار المطلوب غير متاح في بيئة التطوير المحلية");
        }
      }
    }
  }

  window.MockBackend = MockBackend;
  window.mockBackend = new MockBackend();
})(window);






