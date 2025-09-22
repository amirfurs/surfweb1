#!/usr/bin/env python3
"""
Script to remove articles that are not shown in the admin panel.
This will keep only articles that are properly managed through the admin interface.
"""

import sqlite3
import os

def cleanup_articles():
    db_path = 'database.db'
    
    if not os.path.exists(db_path):
        print(f"Database file {db_path} not found!")
        return
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    try:
        # Get all articles currently in database
        articles = conn.execute('SELECT id, slug, title, category, author_id FROM articles ORDER BY created_at DESC').fetchall()
        
        print(f"Found {len(articles)} articles in database:")
        print("-" * 80)
        
        for article in articles:
            print(f"ID: {article['id']}")
            print(f"Slug: {article['slug']}")
            print(f"Title: {article['title']}")
            print(f"Category: {article['category']}")
            print(f"Author ID: {article['author_id']}")
            print("-" * 40)
        
        # Check if there are any articles without proper author_id or other issues
        problematic_articles = conn.execute('''
            SELECT id, slug, title, category, author_id 
            FROM articles 
            WHERE author_id IS NULL OR author_id NOT IN (SELECT id FROM users)
        ''').fetchall()
        
        if problematic_articles:
            print(f"\nFound {len(problematic_articles)} problematic articles:")
            print("-" * 80)
            
            for article in problematic_articles:
                print(f"ID: {article['id']} - {article['title']} (Author ID: {article['author_id']})")
            
            # Ask for confirmation to delete problematic articles
            response = input(f"\nDo you want to delete these {len(problematic_articles)} problematic articles? (y/N): ")
            
            if response.lower() == 'y':
                for article in problematic_articles:
                    conn.execute('DELETE FROM articles WHERE id = ?', (article['id'],))
                    print(f"Deleted article: {article['title']}")
                
                conn.commit()
                print(f"\nDeleted {len(problematic_articles)} problematic articles.")
            else:
                print("No articles were deleted.")
        else:
            print("\nAll articles appear to be properly configured for the admin panel.")
        
        # Show final count
        final_count = conn.execute('SELECT COUNT(*) as count FROM articles').fetchone()
        print(f"\nFinal article count: {final_count['count']}")
        
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    cleanup_articles()
