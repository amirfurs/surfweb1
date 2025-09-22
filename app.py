#!/usr/bin/env python3
"""
Flask backend for الفرسان (Al-Fursan) website
Handles authentication, newsletter, polls, articles, and admin functionality
"""

from flask import Flask, request, jsonify, session, send_from_directory
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from pathlib import Path
import os
from datetime import datetime
import uuid
import secrets
from contextlib import contextmanager

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)  # Generate a secure secret key

# Configuration
WEB_DIR = Path(__file__).resolve().parent
DATABASE_PATH = WEB_DIR / 'data.db'
UPLOAD_FOLDER = WEB_DIR / 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'}

# Create uploads directory if it doesn't exist
UPLOAD_FOLDER.mkdir(exist_ok=True)

app.config['UPLOAD_FOLDER'] = str(UPLOAD_FOLDER)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure data directory exists
DATABASE_PATH.parent.mkdir(exist_ok=True)

# Database initialization
@contextmanager
def get_db():
    """Context manager for database connections"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    """Initialize the database with required tables"""
    with get_db() as conn:
        # Create users table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create articles table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT NOT NULL,
                tags TEXT,
                image_url TEXT,
                author_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (author_id) REFERENCES users (id)
            )
        ''')
        
        # Create series table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS series (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                image_url TEXT,
                status TEXT DEFAULT 'active',
                author_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (author_id) REFERENCES users (id)
            )
        ''')
        
        # Create series_episodes table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS series_episodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                series_id INTEGER NOT NULL,
                episode_number INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                image_url TEXT,
                duration_minutes INTEGER,
                status TEXT DEFAULT 'published',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (series_id) REFERENCES series (id) ON DELETE CASCADE,
                UNIQUE(series_id, episode_number)
            )
        ''')
        
        # Create newsletter_subscribers table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS newsletter_subscribers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                active BOOLEAN DEFAULT TRUE
            )
        ''')
        
        # Create polls table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS polls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                poll_id TEXT UNIQUE NOT NULL,
                question TEXT NOT NULL,
                options TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.execute('''
            CREATE TABLE IF NOT EXISTS poll_votes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                poll_id TEXT NOT NULL,
                option_value TEXT NOT NULL,
                voter_ip TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (poll_id) REFERENCES polls (poll_id)
            )
        ''')
        
        # Create articles table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                content TEXT NOT NULL,
                tags TEXT DEFAULT '',
                image_url TEXT DEFAULT '',
                author_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (author_id) REFERENCES users (id)
            )
        ''')
        
        conn.execute('''
            CREATE TABLE IF NOT EXISTS article_ratings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                article_slug TEXT NOT NULL,
                rating TEXT NOT NULL,
                voter_ip TEXT,
                rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (article_slug) REFERENCES articles (slug)
            )
        ''')
        
        # Insert default poll if it doesn't exist
        conn.execute('''
            INSERT OR IGNORE INTO polls (poll_id, question, options)
            VALUES ('homepage-theme', 'أي سمة تفضل لعرض المقالات؟', 'light,dark,sepia')
        ''')
        
        # Add image_url column to articles table if it doesn't exist (for existing databases)
        try:
            columns = [column[1] for column in conn.execute('PRAGMA table_info(articles)').fetchall()]
            if 'image_url' not in columns:
                conn.execute('ALTER TABLE articles ADD COLUMN image_url TEXT DEFAULT ""')
                print("Added image_url column to articles table")
        except Exception as e:
            print(f"Note: Could not add image_url column: {e}")
        
        # Insert sample article if no articles exist
        article_count = conn.execute('SELECT COUNT(*) FROM articles').fetchone()[0]
        if article_count == 0:
            # Create default admin user first if it doesn't exist
            admin_password = generate_password_hash('admin123')
            conn.execute('''
                INSERT OR IGNORE INTO users (email, password_hash, full_name, role)
                VALUES ('admin@alukala.com', ?, 'مدير الموقع', 'admin')
            ''', (admin_password,))
            
            # Get admin user ID
            admin_user = conn.execute('SELECT id FROM users WHERE email = ?', ('admin@alukala.com',)).fetchone()
            if admin_user:
                conn.execute('''
                    INSERT INTO articles (slug, title, category, content, tags, image_url, author_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    'welcome-article',
                    'مرحباً بكم في موقع الفرسان',
                    'general',
                    '<h2>مرحباً بكم في موقع الفرسان</h2><p>هذا مقال تجريبي لاختبار النظام. يمكنكم الآن إنشاء وتحرير المقالات باستخدام المحرر الغني الجديد.</p><p>الميزات الجديدة تشمل:</p><ul><li>محرر نصوص غني مع أدوات التنسيق</li><li>إدراج الصور مع إمكانية تغيير الحجم</li><li>إدراج الآيات القرآنية بتصميم جميل</li><li>واجهة سهلة الاستخدام</li></ul>',
                    'عام,ترحيب,اختبار',
                    '',
                    admin_user[0]
                ))
                print("Created sample welcome article")
        else:
            # Ensure admin user exists even if articles exist
            admin_password = generate_password_hash('admin123')
            conn.execute('''
                INSERT OR IGNORE INTO users (email, password_hash, full_name, role)
                VALUES ('admin@alukala.com', ?, 'مدير الموقع', 'admin')
            ''', (admin_password,))
        
        conn.commit()

# Initialize database on startup
init_db()

# Static file serving
@app.route('/')
def index():
    return send_from_directory(WEB_DIR, 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(WEB_DIR, filename)

# Authentication endpoints
@app.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json() or request.form.to_dict()
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'البريد الإلكتروني وكلمة المرور مطلوبان'}), 400
    
    with get_db() as conn:
        user = conn.execute(
            'SELECT * FROM users WHERE email = ?', (email,)
        ).fetchone()
        
        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['user_email'] = user['email']
            session['user_role'] = user['role']
            return jsonify({
                'success': True,
                'message': 'تم تسجيل الدخول بنجاح',
                'user': {
                    'id': user['id'],
                    'email': user['email'],
                    'full_name': user['full_name'],
                    'role': user['role']
                }
            })
        else:
            return jsonify({'error': 'البريد الإلكتروني أو كلمة المرور غير صحيحة'}), 401

@app.route('/auth/register', methods=['POST'])
def register():
    data = request.get_json() or request.form.to_dict()
    email = data.get('email')
    password = data.get('password')
    full_name = data.get('fullName')
    
    if not all([email, password, full_name]):
        return jsonify({'error': 'جميع الحقول مطلوبة'}), 400
    
    password_hash = generate_password_hash(password)
    
    try:
        with get_db() as conn:
            conn.execute(
                'INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)',
                (email, password_hash, full_name)
            )
            conn.commit()
            return jsonify({'success': True, 'message': 'تم إنشاء الحساب بنجاح'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'البريد الإلكتروني مستخدم بالفعل'}), 409

@app.route('/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'تم تسجيل الخروج بنجاح'})

@app.route('/auth/status', methods=['GET'])
def auth_status():
    """Check current authentication status"""
    if 'user_id' in session:
        with get_db() as conn:
            user = conn.execute(
                'SELECT id, email, full_name, role FROM users WHERE id = ?',
                (session['user_id'],)
            ).fetchone()
            
            if user:
                return jsonify({
                    'authenticated': True,
                    'user': {
                        'id': user['id'],
                        'email': user['email'],
                        'full_name': user['full_name'],
                        'role': user['role']
                    }
                })
    
    return jsonify({'authenticated': False})

@app.route('/auth/me', methods=['GET'])
def get_current_user():
    if 'user_id' not in session:
        return jsonify({'user': None}), 200
    
    with get_db() as conn:
        user = conn.execute(
            'SELECT id, email, full_name, role FROM users WHERE id = ?', 
            (session['user_id'],)
        ).fetchone()
        
        if user:
            return jsonify({
                'user': {
                    'id': user['id'],
                    'email': user['email'],
                    'name': user['full_name'],
                    'role': user['role']
                }
            })
        else:
            session.clear()
            return jsonify({'user': None}), 200

# Newsletter endpoints
@app.route('/newsletter/subscribe', methods=['POST'])
def newsletter_subscribe():
    data = request.get_json() or request.form.to_dict()
    email = data.get('email')
    
    if not email:
        return jsonify({'error': 'البريد الإلكتروني مطلوب'}), 400
    
    try:
        with get_db() as conn:
            conn.execute(
                'INSERT INTO newsletter_subscribers (email) VALUES (?)',
                (email,)
            )
            conn.commit()
            return jsonify({'success': True, 'message': 'تم الاشتراك في النشرة بنجاح'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'البريد الإلكتروني مشترك بالفعل'}), 409

# Poll endpoints
@app.route('/polls/vote', methods=['POST'])
def poll_vote():
    data = request.get_json() or request.form.to_dict()
    poll_id = data.get('pollId')
    theme = data.get('theme')
    voter_ip = request.remote_addr
    
    if not all([poll_id, theme]):
        return jsonify({'error': 'معرف الاستطلاع والخيار مطلوبان'}), 400
    
    with get_db() as conn:
        # Check if poll exists
        poll = conn.execute(
            'SELECT * FROM polls WHERE poll_id = ?', (poll_id,)
        ).fetchone()
        
        if not poll:
            return jsonify({'error': 'الاستطلاع غير موجود'}), 404
        
        # Check if user already voted (by IP)
        existing_vote = conn.execute(
            'SELECT * FROM poll_votes WHERE poll_id = ? AND voter_ip = ?',
            (poll_id, voter_ip)
        ).fetchone()
        
        if existing_vote:
            return jsonify({'error': 'لقد قمت بالتصويت بالفعل'}), 409
        
        # Record the vote
        conn.execute(
            'INSERT INTO poll_votes (poll_id, option_value, voter_ip) VALUES (?, ?, ?)',
            (poll_id, theme, voter_ip)
        )
        conn.commit()
        
        return jsonify({'success': True, 'message': 'تم تسجيل صوتك بنجاح'})

@app.route('/polls/<poll_id>/results', methods=['GET'])
def poll_results(poll_id):
    with get_db() as conn:
        # Get poll info
        poll = conn.execute(
            'SELECT * FROM polls WHERE poll_id = ?', (poll_id,)
        ).fetchone()
        
        if not poll:
            return jsonify({'error': 'الاستطلاع غير موجود'}), 404
        
        # Get vote counts
        votes = conn.execute('''
            SELECT option_value, COUNT(*) as count
            FROM poll_votes
            WHERE poll_id = ?
            GROUP BY option_value
        ''', (poll_id,)).fetchall()
        
        total_votes = sum(vote['count'] for vote in votes)
        
        results = {}
        for vote in votes:
            results[vote['option_value']] = {
                'count': vote['count'],
                'percentage': round((vote['count'] / total_votes * 100) if total_votes > 0 else 0, 1)
            }
        
        return jsonify({
            'poll_id': poll_id,
            'question': poll['question'],
            'total_votes': total_votes,
            'results': results
        })

# Article endpoints
@app.route('/articles/<slug>/rating', methods=['POST'])
def rate_article(slug):
    data = request.get_json() or request.form.to_dict()
    rating = data.get('rating')
    voter_ip = request.remote_addr
    
    if not rating:
        return jsonify({'error': 'التقييم مطلوب'}), 400
    
    with get_db() as conn:
        # Check if article exists
        article = conn.execute(
            'SELECT * FROM articles WHERE slug = ?', (slug,)
        ).fetchone()
        
        if not article:
            return jsonify({'error': 'المقال غير موجود'}), 404
        
        # Check if user already rated (by IP)
        existing_rating = conn.execute(
            'SELECT * FROM article_ratings WHERE article_slug = ? AND voter_ip = ?',
            (slug, voter_ip)
        ).fetchone()
        
        if existing_rating:
            return jsonify({'error': 'لقد قمت بتقييم هذا المقال بالفعل'}), 409
        
        # Record the rating
        conn.execute(
            'INSERT INTO article_ratings (article_slug, rating, voter_ip) VALUES (?, ?, ?)',
            (slug, rating, voter_ip)
        )
        conn.commit()
        
        return jsonify({'success': True, 'message': 'تم تسجيل تقييمك بنجاح'})

# User profile endpoints
@app.route('/user/profile', methods=['GET'])
def get_profile():
    if 'user_id' not in session:
        return jsonify({'error': 'يجب تسجيل الدخول أولاً'}), 401
    
    with get_db() as conn:
        user = conn.execute(
            'SELECT id, email, full_name, role, created_at FROM users WHERE id = ?', 
            (session['user_id'],)
        ).fetchone()
        
        if not user:
            session.clear()
            return jsonify({'error': 'المستخدم غير موجود'}), 404
        
        # Get profile data from user_profiles table
        profile_data = conn.execute(
            'SELECT bio, location, interests, newsletter_enabled, reading_reminders, digest_frequency FROM user_profiles WHERE user_id = ?',
            (session['user_id'],)
        ).fetchone()
        
        # Create profile object with data from both tables
        profile = {
            'fullName': user['full_name'],
            'email': user['email'],
            'bio': profile_data['bio'] if profile_data else '',
            'location': profile_data['location'] if profile_data else '',
            'interests': profile_data['interests'].split(',') if profile_data and profile_data['interests'] else [],
            'notifications': {
                'newsletter': bool(profile_data['newsletter_enabled']) if profile_data else False,
                'readingReminders': bool(profile_data['reading_reminders']) if profile_data else False,
                'digestFrequency': profile_data['digest_frequency'] if profile_data else 'weekly'
            },
            'lastLoginAt': user['created_at']
        }
        
        return jsonify({
            'user': {
                'id': user['id'],
                'email': user['email'],
                'name': user['full_name'],
                'role': user['role']
            },
            'profile': profile,
            'favorites': [],
            'history': []
        })

@app.route('/user/profile', methods=['POST'])
def update_profile():
    if 'user_id' not in session:
        return jsonify({'error': 'يجب تسجيل الدخول أولاً'}), 401
    
    data = request.get_json() or request.form.to_dict()
    full_name = data.get('fullName')
    email = data.get('email')
    bio = data.get('bio', '')
    location = data.get('location', '')
    interests = data.get('interests', '')
    newsletter = data.get('newsletter', False)
    reading_reminders = data.get('readingReminders', False)
    digest_frequency = data.get('digestFrequency', 'weekly')
    
    if not full_name:
        return jsonify({'error': 'الاسم الكامل مطلوب'}), 400
    
    if not email:
        return jsonify({'error': 'البريد الإلكتروني مطلوب'}), 400
    
    with get_db() as conn:
        # Check if email is already used by another user
        existing = conn.execute(
            'SELECT id FROM users WHERE email = ? AND id != ?',
            (email, session['user_id'])
        ).fetchone()
        
        if existing:
            return jsonify({'error': 'البريد الإلكتروني مستخدم بالفعل'}), 409
        
        # Update user info in users table
        conn.execute(
            'UPDATE users SET full_name = ?, email = ? WHERE id = ?',
            (full_name, email, session['user_id'])
        )
        
        # Insert or update profile data in user_profiles table
        conn.execute('''
            INSERT INTO user_profiles (user_id, bio, location, interests, newsletter_enabled, reading_reminders, digest_frequency, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                bio = excluded.bio,
                location = excluded.location,
                interests = excluded.interests,
                newsletter_enabled = excluded.newsletter_enabled,
                reading_reminders = excluded.reading_reminders,
                digest_frequency = excluded.digest_frequency,
                updated_at = CURRENT_TIMESTAMP
        ''', (session['user_id'], bio, location, interests, newsletter, reading_reminders, digest_frequency))
        
        conn.commit()
        
        return jsonify({
            'success': True, 
            'message': 'تم تحديث الملف الشخصي بنجاح',
            'user': {
                'id': session['user_id'],
                'email': email,
                'name': full_name,
                'role': session.get('user_role', 'user')
            }
        })

# Admin endpoints
@app.route('/admin/stats', methods=['GET'])
def admin_stats():
    if session.get('user_role') not in ['admin', 'editor']:
        return jsonify({'error': 'غير مخول للوصول'}), 403
    
    with get_db() as conn:
        # Get articles count
        articles_count = conn.execute('SELECT COUNT(*) as count FROM articles').fetchone()['count']
        
        # Get newsletter subscribers count
        newsletter_count = conn.execute('SELECT COUNT(*) as count FROM newsletter_subscribers WHERE active = 1').fetchone()['count']
        
        # Get users count
        users_count = conn.execute('SELECT COUNT(*) as count FROM users').fetchone()['count']
        
        # Get poll votes count
        poll_votes_count = conn.execute('SELECT COUNT(*) as count FROM poll_votes').fetchone()['count']
        
        # Get recent counts for trends (last 30 days vs previous 30 days)
        from datetime import datetime, timedelta
        thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        sixty_days_ago = (datetime.now() - timedelta(days=60)).strftime('%Y-%m-%d')
        
        # Articles trend
        recent_articles = conn.execute(
            'SELECT COUNT(*) as count FROM articles WHERE created_at >= ?', 
            (thirty_days_ago,)
        ).fetchone()['count']
        
        previous_articles = conn.execute(
            'SELECT COUNT(*) as count FROM articles WHERE created_at >= ? AND created_at < ?', 
            (sixty_days_ago, thirty_days_ago)
        ).fetchone()['count']
        
        # Newsletter trend
        recent_newsletter = conn.execute(
            'SELECT COUNT(*) as count FROM newsletter_subscribers WHERE subscribed_at >= ?', 
            (thirty_days_ago,)
        ).fetchone()['count']
        
        # Users trend
        recent_users = conn.execute(
            'SELECT COUNT(*) as count FROM users WHERE created_at >= ?', 
            (thirty_days_ago,)
        ).fetchone()['count']
        
        # Poll votes trend
        recent_votes = conn.execute(
            'SELECT COUNT(*) as count FROM poll_votes WHERE voted_at >= ?', 
            (thirty_days_ago,)
        ).fetchone()['count']
        
        # Calculate trends
        def calculate_trend(recent, previous):
            if previous == 0:
                return f"+{recent} هذا الشهر" if recent > 0 else "لا توجد بيانات"
            
            if recent > previous:
                return f"+{recent - previous} هذا الشهر"
            elif recent < previous:
                return f"-{previous - recent} هذا الشهر"
            else:
                return "مستقر"
        
        return jsonify({
            'articles': {
                'count': articles_count,
                'trend': calculate_trend(recent_articles, previous_articles)
            },
            'newsletter': {
                'count': newsletter_count,
                'trend': f"+{recent_newsletter} هذا الشهر"
            },
            'users': {
                'count': users_count,
                'trend': f"+{recent_users} هذا الشهر"
            },
            'poll_votes': {
                'count': poll_votes_count,
                'trend': f"+{recent_votes} هذا الشهر"
            }
        })

# Article management endpoints
@app.route('/admin/articles', methods=['GET'])
def admin_get_articles():
    if session.get('user_role') not in ['admin', 'editor']:
        return jsonify({'error': 'غير مخول للوصول'}), 403
    
    with get_db() as conn:
        articles = conn.execute('''
            SELECT a.id, a.slug, a.title, a.category, a.content, a.tags, a.image_url, a.created_at,
                   u.full_name as author_name
            FROM articles a
            LEFT JOIN users u ON a.author_id = u.id
            ORDER BY a.created_at DESC
        ''').fetchall()
        
        return jsonify([{
            'id': article['id'],
            'slug': article['slug'],
            'title': article['title'],
            'category': article['category'],
            'content': article['content'],
            'tags': article['tags'].split(',') if article['tags'] else [],
            'image_url': article['image_url'] if article['image_url'] else '',
            'author': article['author_name'] or 'غير معروف',
            'created_at': article['created_at'],
            'status': 'published'  # For now, all articles are published
        } for article in articles])

@app.route('/admin/articles', methods=['POST'])
def admin_create_article():
    if session.get('user_role') not in ['admin', 'editor']:
        return jsonify({'error': 'غير مخول للوصول'}), 403
    
    data = request.get_json() or request.form.to_dict()
    title = data.get('title')
    category = data.get('category')
    content = data.get('body', '')  # Changed from 'content' to 'body' to match form
    tags = data.get('tags', '')
    image_url = data.get('image_url', '')
    
    if not all([title, category]):
        return jsonify({'error': 'العنوان والتصنيف مطلوبان'}), 400
    
    # Generate slug from title (improved)
    import re
    import uuid
    slug_base = re.sub(r'[^\w\s-]', '', title.lower())
    slug_base = re.sub(r'[-\s]+', '-', slug_base)
    slug = f"{slug_base}-{str(uuid.uuid4())[:8]}"
    
    try:
        with get_db() as conn:
            conn.execute(
                'INSERT INTO articles (slug, title, category, content, tags, image_url, author_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                (slug, title, category, content, tags, image_url, session['user_id'])
            )
            conn.commit()
            return jsonify({'success': True, 'message': 'تم إنشاء المقال بنجاح'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'حدث خطأ في إنشاء المقال'}), 409

@app.route('/admin/articles/<int:article_id>', methods=['PUT'])
def admin_update_article(article_id):
    if session.get('user_role') not in ['admin', 'editor']:
        return jsonify({'error': 'غير مخول للوصول'}), 403
    
    data = request.get_json() or request.form.to_dict()
    title = data.get('title')
    category = data.get('category')
    content = data.get('body', '')
    tags = data.get('tags', '')
    image_url = data.get('image_url', '')
    
    if not all([title, category]):
        return jsonify({'error': 'العنوان والتصنيف مطلوبان'}), 400
    
    with get_db() as conn:
        # Check if article exists
        article = conn.execute('SELECT id FROM articles WHERE id = ?', (article_id,)).fetchone()
        if not article:
            return jsonify({'error': 'المقال غير موجود'}), 404
        
        conn.execute(
            'UPDATE articles SET title = ?, category = ?, content = ?, tags = ?, image_url = ? WHERE id = ?',
            (title, category, content, tags, image_url, article_id)
        )
        conn.commit()
        return jsonify({'success': True, 'message': 'تم تحديث المقال بنجاح'})

@app.route('/admin/articles/<int:article_id>', methods=['DELETE'])
def admin_delete_article(article_id):
    if session.get('user_role') not in ['admin', 'editor']:
        return jsonify({'error': 'غير مخول للوصول'}), 403
    
    with get_db() as conn:
        # Check if article exists
        article = conn.execute('SELECT id FROM articles WHERE id = ?', (article_id,)).fetchone()
        if not article:
            return jsonify({'error': 'المقال غير موجود'}), 404
        
        conn.execute('DELETE FROM articles WHERE id = ?', (article_id,))
        conn.commit()
        return jsonify({'success': True, 'message': 'تم حذف المقال بنجاح'})

@app.route('/admin/polls', methods=['POST'])
def admin_create_poll():
    if session.get('user_role') != 'admin':
        return jsonify({'error': 'غير مخول للوصول'}), 403
    
    data = request.get_json() or request.form.to_dict()
    question = data.get('question')
    options = data.get('options')
    
    if not all([question, options]):
        return jsonify({'error': 'السؤال والخيارات مطلوبان'}), 400
    
    # Generate poll ID
    poll_id = f"poll-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    try:
        with get_db() as conn:
            conn.execute(
                'INSERT INTO polls (poll_id, question, options) VALUES (?, ?, ?)',
                (poll_id, question, options)
            )
            conn.commit()
            return jsonify({'success': True, 'message': 'تم إنشاء الاستطلاع بنجاح'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'خطأ في إنشاء الاستطلاع'}), 409

@app.route('/admin/users', methods=['POST'])
def admin_create_user():
    if session.get('user_role') != 'admin':
        return jsonify({'error': 'غير مخول للوصول'}), 403
    
    data = request.get_json() or request.form.to_dict()
    email = data.get('email')
    password = data.get('password')
    full_name = data.get('fullName')
    role = data.get('role', 'user')
    
    if not all([email, password, full_name]):
        return jsonify({'error': 'جميع الحقول مطلوبة'}), 400
    
    password_hash = generate_password_hash(password)
    
    try:
        with get_db() as conn:
            conn.execute(
                'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
                (email, password_hash, full_name, role)
            )
            conn.commit()
            return jsonify({'success': True, 'message': 'تم إنشاء المستخدم بنجاح'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'البريد الإلكتروني مستخدم بالفعل'}), 409

# API endpoints for frontend data
@app.route('/api/articles', methods=['GET'])
def get_articles():
    category = request.args.get('category', 'all')
    tag = request.args.get('tag')
    search = request.args.get('search')
    limit = request.args.get('limit', type=int)
    
    # Get real articles from database
    with get_db() as conn:
        # Build query based on filters
        query = '''
            SELECT a.id, a.slug, a.title, a.category, a.content, a.tags, a.image_url, a.created_at,
                   u.full_name as author_name
            FROM articles a
            LEFT JOIN users u ON a.author_id = u.id
        '''
        params = []
        
        # Add category filter
        if category != 'all':
            query += ' WHERE a.category = ?'
            params.append(category)
        
        # Add tag filter
        if tag:
            if 'WHERE' in query:
                query += ' AND a.tags LIKE ?'
            else:
                query += ' WHERE a.tags LIKE ?'
            params.append(f'%{tag}%')
        
        # Add search filter
        if search:
            if 'WHERE' in query:
                query += ' AND (a.title LIKE ? OR a.content LIKE ?)'
            else:
                query += ' WHERE (a.title LIKE ? OR a.content LIKE ?)'
            params.extend([f'%{search}%', f'%{search}%'])
        
        # Order by creation date (newest first)
        query += ' ORDER BY a.created_at DESC'
        
        # Add limit if specified
        if limit:
            query += f' LIMIT {limit}'
        
        articles = conn.execute(query, params).fetchall()
        
        # Convert to frontend format
        formatted_articles = []
        for article in articles:
            # Create excerpt from content (first 150 characters)
            content = article['content'] or ''
            # Remove HTML tags for excerpt
            import re
            clean_content = re.sub('<[^<]+?>', '', content)
            excerpt = clean_content[:150] + '...' if len(clean_content) > 150 else clean_content
            
            formatted_articles.append({
                'id': f'post-{article["id"]}',
                'slug': article['slug'],
                'title': article['title'],
                'author': article['author_name'] or 'غير معروف',
                'publishedAt': article['created_at'],
                'category': article['category'],
                'tags': article['tags'].split(',') if article['tags'] else [],
                'excerpt': excerpt,
                'heroImage': article['image_url'] or 'assets/images/default-article.svg',
                'cardImage': article['image_url'] or 'assets/images/default-article.svg',
                'comments': 0,  # We can add comments count later
                'status': 'published'
            })
        
        return jsonify(formatted_articles)

# Series API endpoints
@app.route('/api/series', methods=['GET'])
def get_series():
    """Get all series with episode counts"""
    with get_db() as conn:
        series = conn.execute('''
            SELECT s.*, u.full_name as author_name,
                   COUNT(e.id) as episode_count
            FROM series s
            LEFT JOIN users u ON s.author_id = u.id
            LEFT JOIN series_episodes e ON s.id = e.series_id AND e.status = 'published'
            GROUP BY s.id
            ORDER BY s.created_at DESC
        ''').fetchall()
        
        formatted_series = []
        for serie in series:
            formatted_series.append({
                'id': serie['id'],
                'slug': serie['slug'],
                'title': serie['title'],
                'description': serie['description'],
                'image': serie['image_url'] or 'assets/images/default-series.svg',
                'status': serie['status'],
                'author': serie['author_name'] or 'غير معروف',
                'episode_count': serie['episode_count'],
                'created_at': serie['created_at']
            })
        
        return jsonify(formatted_series)

@app.route('/api/series/<slug>', methods=['GET'])
def get_series_by_slug(slug):
    """Get series details with episodes"""
    with get_db() as conn:
        # Get series info
        serie = conn.execute('''
            SELECT s.*, u.full_name as author_name
            FROM series s
            LEFT JOIN users u ON s.author_id = u.id
            WHERE s.slug = ?
        ''', (slug,)).fetchone()
        
        if not serie:
            return jsonify({'error': 'السلسلة غير موجودة'}), 404
        
        # Get episodes
        episodes = conn.execute('''
            SELECT * FROM series_episodes
            WHERE series_id = ? AND status = 'published'
            ORDER BY episode_number ASC
        ''', (serie['id'],)).fetchall()
        
        formatted_episodes = []
        for episode in episodes:
            formatted_episodes.append({
                'id': episode['id'],
                'episode_number': episode['episode_number'],
                'title': episode['title'],
                'slug': episode['slug'],
                'image': episode['image_url'] or serie['image_url'] or 'assets/images/default-episode.svg',
                'duration_minutes': episode['duration_minutes'],
                'created_at': episode['created_at']
            })
        
        return jsonify({
            'id': serie['id'],
            'slug': serie['slug'],
            'title': serie['title'],
            'description': serie['description'],
            'image': serie['image_url'] or 'assets/images/default-series.svg',
            'status': serie['status'],
            'author': serie['author_name'] or 'غير معروف',
            'created_at': serie['created_at'],
            'episodes': formatted_episodes
        })

@app.route('/api/series/<series_slug>/episodes/<episode_slug>', methods=['GET'])
def get_episode(series_slug, episode_slug):
    """Get specific episode content"""
    with get_db() as conn:
        episode = conn.execute('''
            SELECT e.*, s.title as series_title, s.slug as series_slug,
                   u.full_name as author_name
            FROM series_episodes e
            JOIN series s ON e.series_id = s.id
            LEFT JOIN users u ON s.author_id = u.id
            WHERE e.slug = ? AND s.slug = ?
        ''', (episode_slug, series_slug)).fetchone()
        
        if not episode:
            return jsonify({'error': 'الحلقة غير موجودة'}), 404
        
        return jsonify({
            'id': episode['id'],
            'episode_number': episode['episode_number'],
            'title': episode['title'],
            'content': episode['content'],
            'slug': episode['slug'],
            'image': episode['image_url'] or 'assets/images/default-episode.svg',
            'duration_minutes': episode['duration_minutes'],
            'series_title': episode['series_title'],
            'series_slug': episode['series_slug'],
            'author': episode['author_name'] or 'غير معروف',
            'created_at': episode['created_at']
        })

@app.route('/api/articles/<slug>', methods=['GET'])
def get_article_by_slug(slug):
    """Get a single article by its slug"""
    with get_db() as conn:
        article = conn.execute('''
            SELECT a.id, a.slug, a.title, a.category, a.content, a.tags, a.image_url, a.created_at,
                   u.full_name as author_name
            FROM articles a
            LEFT JOIN users u ON a.author_id = u.id
            WHERE a.slug = ?
        ''', (slug,)).fetchone()
        
        if not article:
            return jsonify({'error': 'المقال غير موجود'}), 404
        
        # Remove HTML tags for excerpt
        import re
        content = article['content'] or ''
        clean_content = re.sub('<[^<]+?>', '', content)
        excerpt = clean_content[:150] + '...' if len(clean_content) > 150 else clean_content
        
        formatted_article = {
            'id': f'post-{article["id"]}',
            'slug': article['slug'],
            'title': article['title'],
            'author': article['author_name'] or 'غير معروف',
            'publishedAt': article['created_at'],
            'category': article['category'],
            'tags': article['tags'].split(',') if article['tags'] else [],
            'excerpt': excerpt,
            'content': article['content'],  # Full content for article page
            'heroImage': article['image_url'] or 'assets/images/default-article.svg',
            'cardImage': article['image_url'] or 'assets/images/default-article.svg',
            'comments': 0,  # We can add comments count later
            'status': 'published'
        }
        
        return jsonify(formatted_article)

@app.route('/test/articles')
def test_articles():
    """Test endpoint to check articles in database"""
    with get_db() as conn:
        articles = conn.execute('SELECT * FROM articles').fetchall()
        return jsonify([dict(article) for article in articles])

@app.route('/admin/create-default-user', methods=['POST'])
def create_default_user():
    """Create a default admin user for testing"""
    with get_db() as conn:
        # Check if admin user already exists
        existing_admin = conn.execute(
            'SELECT * FROM users WHERE email = ?', ('admin@example.com',)
        ).fetchone()
        
        if existing_admin:
            return jsonify({'error': 'المستخدم الافتراضي موجود بالفعل'}), 400
        
        # Create default admin user
        password_hash = generate_password_hash('admin123')
        
        conn.execute('''
            INSERT INTO users (email, password_hash, full_name, role, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        ''', ('admin@example.com', password_hash, 'مدير النظام', 'admin'))
        
        conn.commit()
        
        return jsonify({
            'success': True,
            'message': 'تم إنشاء المستخدم الافتراضي بنجاح',
            'credentials': {
                'email': 'admin@example.com',
                'password': 'admin123'
            }
        })

@app.route('/admin/cleanup-articles', methods=['POST'])
def cleanup_articles():
    """Remove articles that are not properly managed in admin panel"""
    if session.get('user_role') != 'admin':
        return jsonify({'error': 'غير مخول للوصول - مطلوب صلاحيات المدير'}), 403
    
    with get_db() as conn:
        # Get all articles
        all_articles = conn.execute('SELECT id, slug, title, category, author_id FROM articles').fetchall()
        
        # Find problematic articles (no author or invalid author)
        problematic_articles = conn.execute('''
            SELECT id, slug, title, category, author_id 
            FROM articles 
            WHERE author_id IS NULL OR author_id NOT IN (SELECT id FROM users)
        ''').fetchall()
        
        deleted_count = 0
        deleted_articles = []
        
        # Delete problematic articles
        for article in problematic_articles:
            conn.execute('DELETE FROM articles WHERE id = ?', (article['id'],))
            deleted_articles.append({
                'id': article['id'],
                'title': article['title'],
                'slug': article['slug']
            })
            deleted_count += 1
        
        conn.commit()
        
        # Get final count
        final_count = conn.execute('SELECT COUNT(*) as count FROM articles').fetchone()['count']
        
        return jsonify({
            'success': True,
            'message': f'تم حذف {deleted_count} مقالة غير صالحة',
            'deleted_count': deleted_count,
            'deleted_articles': deleted_articles,
            'remaining_count': final_count
        })

# Series management endpoints
@app.route('/admin/series', methods=['GET'])
def admin_get_series():
    """Get all series for admin panel"""
    if session.get('user_role') not in ['admin', 'editor']:
        return jsonify({'error': 'غير مخول للوصول'}), 403
    
    with get_db() as conn:
        series = conn.execute('''
            SELECT s.*, u.full_name as author_name,
                   COUNT(e.id) as episode_count
            FROM series s
            LEFT JOIN users u ON s.author_id = u.id
            LEFT JOIN series_episodes e ON s.id = e.series_id
            GROUP BY s.id
            ORDER BY s.created_at DESC
        ''').fetchall()
        
        return jsonify([{
            'id': serie['id'],
            'slug': serie['slug'],
            'title': serie['title'],
            'description': serie['description'],
            'status': serie['status'],
            'author': serie['author_name'] or 'غير معروف',
            'episode_count': serie['episode_count'],
            'created_at': serie['created_at']
        } for serie in series])

@app.route('/admin/series', methods=['POST'])
def admin_create_series():
    """Create a new series"""
    if session.get('user_role') not in ['admin', 'editor']:
        return jsonify({'error': 'غير مخول للوصول'}), 403
    
    data = request.get_json() or request.form.to_dict()
    title = data.get('title')
    slug = data.get('slug')
    description = data.get('description')
    image_url = data.get('image_url')
    status = data.get('status', 'active')
    
    if not all([title, slug, description]):
        return jsonify({'error': 'العنوان والرابط والوصف مطلوبان'}), 400
    
    try:
        with get_db() as conn:
            conn.execute('''
                INSERT INTO series (slug, title, description, image_url, status, author_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            ''', (slug, title, description, image_url, status, session['user_id']))
            
            conn.commit()
            return jsonify({'success': True, 'message': 'تم إنشاء السلسلة بنجاح'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'الرابط المختصر مستخدم بالفعل'}), 409

@app.route('/admin/episodes', methods=['POST'])
def admin_create_episode():
    """Create a new episode"""
    if session.get('user_role') not in ['admin', 'editor']:
        return jsonify({'error': 'غير مخول للوصول'}), 403
    
    data = request.get_json() or request.form.to_dict()
    series_id = data.get('series_id')
    episode_number = data.get('episode_number')
    title = data.get('title')
    slug = data.get('slug')
    content = data.get('content')
    image_url = data.get('image_url')
    duration_minutes = data.get('duration_minutes')
    status = data.get('status', 'published')
    
    if not all([series_id, episode_number, title, slug, content]):
        return jsonify({'error': 'جميع الحقول الأساسية مطلوبة'}), 400
    
    try:
        with get_db() as conn:
            # Check if series exists and user has permission
            serie = conn.execute(
                'SELECT * FROM series WHERE id = ?', (series_id,)
            ).fetchone()
            
            if not serie:
                return jsonify({'error': 'السلسلة غير موجودة'}), 404
            
            conn.execute('''
                INSERT INTO series_episodes (series_id, episode_number, title, slug, content, 
                                           image_url, duration_minutes, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ''', (series_id, episode_number, title, slug, content, image_url, duration_minutes, status))
            
            # Update series updated_at
            conn.execute(
                'UPDATE series SET updated_at = datetime("now") WHERE id = ?', (series_id,)
            )
            
            conn.commit()
            return jsonify({'success': True, 'message': 'تم إنشاء الحلقة بنجاح'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'رقم الحلقة أو الرابط المختصر مستخدم بالفعل'}), 409

@app.route('/admin/series/<int:series_id>', methods=['DELETE'])
def admin_delete_series(series_id):
    """Delete a series and all its episodes"""
    if session.get('user_role') not in ['admin', 'editor']:
        return jsonify({'error': 'غير مخول للوصول'}), 403
    
    with get_db() as conn:
        # Check if series exists
        serie = conn.execute('SELECT * FROM series WHERE id = ?', (series_id,)).fetchone()
        if not serie:
            return jsonify({'error': 'السلسلة غير موجودة'}), 404
        
        # Delete series (episodes will be deleted automatically due to CASCADE)
        conn.execute('DELETE FROM series WHERE id = ?', (series_id,))
        conn.commit()
        
        return jsonify({'success': True, 'message': 'تم حذف السلسلة وجميع حلقاتها بنجاح'})
    
    # Fallback to mock articles if database is empty
    mock_articles = [
        {
            'id': 'post-1',
            'slug': 'rational-discourse',
            'title': 'كيف نبني خطاباً عقلانياً يواجه الشبهات',
            'author': 'أحمد السلمي',
            'publishedAt': '2025-02-11T08:00:00.000Z',
            'category': 'logic',
            'tags': ['المنطق', 'الفلسفة'],
            'excerpt': 'نظرة استراتيجية إلى أدوات الخطاب العقلاني وكيفية إعداد الحجج المضادة للشبهات المعاصرة.',
            'heroImage': 'assets/images/article-1.svg',
            'cardImage': 'assets/images/article-1.svg',
            'comments': 24,
            'status': 'published'
        },
        {
            'id': 'post-2',
            'slug': 'prophethood-evidence',
            'title': 'منهجية إثبات النبوة في ضوء الأدلة التاريخية',
            'author': 'سارة المدني',
            'publishedAt': '2024-12-22T08:00:00.000Z',
            'category': 'prophethood',
            'tags': ['النبوة', 'السيرة'],
            'excerpt': 'رحلة في المصادر التاريخية والتحليل النقدي لإثبات دعوى النبوة.',
            'heroImage': 'assets/images/article-3.svg',
            'cardImage': 'assets/images/article-3.svg',
            'comments': 32,
            'status': 'published'
        },
        {
            'id': 'post-3',
            'slug': 'logic-philosophy-overview',
            'title': 'مدخل معاصر إلى فلسفة المنطق والتحليل',
            'author': 'د. يوسف الحمادي',
            'publishedAt': '2024-12-05T08:00:00.000Z',
            'category': 'logic',
            'tags': ['المنطق'],
            'excerpt': 'تأملات في علاقة المنطق بالعلوم العقلية ومناهج البرهنة الحديثة.',
            'heroImage': 'assets/images/article-4.svg',
            'cardImage': 'assets/images/article-4.svg',
            'comments': 11,
            'status': 'published'
        }
    ]
    
    # Filter by category
    if category != 'all':
        mock_articles = [a for a in mock_articles if a['category'] == category]
    
    # Filter by tag
    if tag:
        mock_articles = [a for a in mock_articles if tag in a.get('tags', [])]
    
    return jsonify(mock_articles)

@app.route('/api/trending', methods=['GET'])
def get_trending():
    # Mock trending articles for now
    trending = [
        {'title': 'الخطاب العقلي في القرآن', 'slug': 'rational-discourse'},
        {'title': 'براهين النبوة المحمدية', 'slug': 'prophethood-evidence'},
        {'title': 'مقدمة في فلسفة المنطق', 'slug': 'logic-philosophy-overview'}
    ]
    return jsonify(trending)

@app.route('/api/recommended', methods=['GET'])
def get_recommended():
    # Mock recommended articles for now
    recommended = [
        {'title': 'منهجية البحث العقدي', 'slug': 'theological-research'},
        {'title': 'الرد على الشبهات المعاصرة', 'slug': 'contemporary-doubts'},
        {'title': 'أصول الحوار الحضاري', 'slug': 'civilized-dialogue'}
    ]
    return jsonify(recommended)

# Test endpoint to verify Flask backend is working
@app.route('/api/test', methods=['GET'])
def test_endpoint():
    return jsonify({
        'status': 'success',
        'message': 'Flask backend is working!',
        'backend': 'Flask',
        'mock_disabled': True
    })

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/upload/image', methods=['POST'])
def upload_image():
    """Handle image file uploads"""
    if session.get('user_role') not in ['admin', 'editor']:
        return jsonify({'error': 'غير مخول للوصول'}), 403
    
    if 'image' not in request.files:
        return jsonify({'error': 'لم يتم اختيار ملف'}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'لم يتم اختيار ملف'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'نوع الملف غير مدعوم. الأنواع المدعومة: PNG, JPG, JPEG, GIF, WebP, SVG'}), 400
    
    if file:
        # Generate unique filename
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
        file_path = UPLOAD_FOLDER / unique_filename
        
        try:
            file.save(str(file_path))
            # Return the URL that can be used to access the file
            file_url = f"/uploads/{unique_filename}"
            return jsonify({
                'success': True,
                'message': 'تم رفع الصورة بنجاح',
                'url': file_url,
                'filename': unique_filename
            })
        except Exception as e:
            return jsonify({'error': f'فشل في رفع الملف: {str(e)}'}), 500

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    print(f"Starting Flask server...")
    print(f"Serving static files from: {WEB_DIR}")
    print(f"Database location: {DATABASE_PATH}")
    print(f"Access the site at: http://127.0.0.1:5000")
    print(f"Default admin login: admin@alukala.com / admin123")
    app.run(host='127.0.0.1', port=5000, debug=True)
