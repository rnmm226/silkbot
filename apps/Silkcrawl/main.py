import requests
from bs4 import BeautifulSoup
import json
import time
import os
import re
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from pathlib import Path

# Configuration
BASE_URL = "https://jibaya.tn"
SCRAPED_DATA_FILE = "jibaya_docs_data.json"
DOWNLOAD_DIR = "downloaded_pdfs"
MAX_WORKERS = 10  # Number of concurrent downloads (adjust based on your connection)
REQUEST_DELAY = 0.1  # Small delay between page requests (in seconds)
MAX_RETRIES = 3  # Number of retries for failed downloads

# Thread-safe print lock
print_lock = Lock()

def safe_print(message, type="info"):
    """Thread-safe printing."""
    with print_lock:
        if type == "error":
            print(f"❌ {message}")
        elif type == "success":
            print(f"✅ {message}")
        elif type == "warning":
            print(f"⚠️  {message}")
        else:
            print(message)

def load_scraped_data(filename):
    """Load the previously scraped JSON data."""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        safe_print(f"{filename} not found. Please run the scraping script first.", "error")
        return None
    except Exception as e:
        safe_print(f"Error loading JSON: {e}", "error")
        return None

def sanitize_filename(filename):
    """Clean up filename to be filesystem-friendly."""
    # Remove or replace problematic characters
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    # Remove extra spaces and limit length
    filename = re.sub(r'\s+', ' ', filename).strip()
    if len(filename) > 200:
        filename = filename[:200]
    return filename

def find_pdf_url(page_url, headers, session, retry_count=0):
    """Visit a document page and extract the PDF download URL with retries."""
    try:
        response = session.get(page_url, headers=headers, timeout=20)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Method 1: Find the download button (wp-block-file__button)
        download_button = soup.find('a', class_='wp-block-file__button')
        if download_button and download_button.get('href'):
            pdf_url = download_button['href']
            if pdf_url.endswith('.pdf'):
                return pdf_url
        
        # Method 2: Look for any PDF link in the wp-block-file div
        file_div = soup.find('div', class_='wp-block-file')
        if file_div:
            pdf_link = file_div.find('a', href=re.compile(r'\.pdf$', re.I))
            if pdf_link and pdf_link.get('href'):
                return pdf_link['href']
        
        # Method 3: Look for any PDF link in the page
        all_links = soup.find_all('a', href=re.compile(r'\.pdf$', re.I))
        for link in all_links:
            # Prefer links that say "Télécharger" or "Download"
            if link.get('href') and 'download' in link.get('class', []):
                return link['href']
        
        # If no PDF found and we haven't retried too many times
        if retry_count < MAX_RETRIES:
            time.sleep(1)
            return find_pdf_url(page_url, headers, session, retry_count + 1)
        
        return None
        
    except requests.exceptions.RequestException as e:
        if retry_count < MAX_RETRIES:
            time.sleep(1)
            return find_pdf_url(page_url, headers, session, retry_count + 1)
        safe_print(f"Error accessing {page_url}: {e}", "error")
        return None

def download_pdf(pdf_url, save_path, session, headers, retry_count=0):
    """Download a PDF file and save it locally with retries."""
    try:
        response = session.get(pdf_url, headers=headers, stream=True, timeout=30)
        response.raise_for_status()
        
        # Ensure the directory exists
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        
        # Ensure the file has .pdf extension
        if not save_path.endswith('.pdf'):
            save_path += '.pdf'
        
        with open(save_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=32768):
                f.write(chunk)
        
        file_size = os.path.getsize(save_path) / 1024  # Size in KB
        return True, file_size
        
    except requests.exceptions.RequestException as e:
        if retry_count < MAX_RETRIES:
            time.sleep(2)
            return download_pdf(pdf_url, save_path, session, headers, retry_count + 1)
        return False, 0

def process_document(article, main_category, sub_category, headers, session, stats):
    """Process a single document (find PDF URL and download)."""
    # Create directory structure
    main_dir = sanitize_filename(main_category)
    sub_dir = sanitize_filename(sub_category)
    folder_path = os.path.join(DOWNLOAD_DIR, main_dir, sub_dir)
    
    # Create filename
    filename = sanitize_filename(article['title'])
    pdf_path = os.path.join(folder_path, filename + '.pdf')
    
    # Skip if already downloaded
    if os.path.exists(pdf_path):
        with stats['lock']:
            stats['skipped'] += 1
        safe_print(f"⏭️  Already exists: {filename}", "warning")
        return True
    
    # Get the PDF URL from the document page
    pdf_url = find_pdf_url(article['url'], headers, session)
    
    if pdf_url:
        # Make sure URL is absolute
        if pdf_url.startswith('/'):
            pdf_url = urljoin(BASE_URL, pdf_url)
        
        # Download the PDF
        success, file_size = download_pdf(pdf_url, pdf_path, session, headers)
        
        if success:
            with stats['lock']:
                stats['successful'] += 1
                stats['total_size'] += file_size
            safe_print(f"📥 Downloaded: {filename[:60]}... ({file_size:.1f} KB)", "success")
            return True
        else:
            with stats['lock']:
                stats['failed'].append({
                    'title': article['title'],
                    'page_url': article['url'],
                    'pdf_url': pdf_url,
                    'reason': 'Download failed'
                })
                stats['failed_count'] += 1
            safe_print(f"Download failed: {filename[:60]}...", "error")
            return False
    else:
        with stats['lock']:
            stats['failed'].append({
                'title': article['title'],
                'page_url': article['url'],
                'pdf_url': 'Not found',
                'reason': 'PDF URL not found'
            })
            stats['failed_count'] += 1
        safe_print(f"PDF not found: {article['title'][:60]}...", "error")
        return False

def download_all_documents_parallel(scraped_data, max_workers=MAX_WORKERS):
    """Download all PDFs in parallel using ThreadPoolExecutor."""
    
    # Create base download directory
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    
    # Prepare all tasks
    tasks = []
    for main_category in scraped_data:
        for sub_category in main_category['sub_categories']:
            for article in sub_category['articles']:
                tasks.append({
                    'article': article,
                    'main_category': main_category['main_category'],
                    'sub_category': sub_category['sub_category_title']
                })
    
    total_tasks = len(tasks)
    safe_print(f"\n📊 Found {total_tasks} documents to process")
    safe_print(f"🚀 Using {max_workers} concurrent workers")
    safe_print(f"📁 Downloads will be saved to: {DOWNLOAD_DIR}\n")
    
    # Statistics tracking
    stats = {
        'successful': 0,
        'failed_count': 0,
        'skipped': 0,
        'total_size': 0,
        'failed': [],
        'lock': Lock()
    }
    
    # Create a session per thread (will be created in worker)
    def process_with_session(task):
        with requests.Session() as session:
            return process_document(
                task['article'],
                task['main_category'],
                task['sub_category'],
                {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'},
                session,
                stats
            )
    
    # Use ThreadPoolExecutor for parallel processing
    start_time = time.time()
    completed = 0
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_task = {executor.submit(process_with_session, task): task for task in tasks}
        
        # Process completed tasks
        for future in as_completed(future_to_task):
            completed += 1
            if completed % 10 == 0 or completed == total_tasks:
                elapsed = time.time() - start_time
                rate = completed / elapsed if elapsed > 0 else 0
                safe_print(f"\n📈 Progress: {completed}/{total_tasks} ({completed/total_tasks*100:.1f}%) - "
                          f"Speed: {rate:.1f} docs/sec - "
                          f"Success: {stats['successful']} - Failed: {stats['failed_count']} - Skipped: {stats['skipped']}")
    
    return stats

def save_failed_downloads(failed_downloads, filename="failed_downloads.json"):
    """Save list of failed downloads for later retry."""
    if failed_downloads:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(failed_downloads, f, ensure_ascii=False, indent=4)
        safe_print(f"\nFailed downloads saved to {filename}", "warning")

def retry_failed_downloads(filename="failed_downloads.json", max_workers=5):
    """Retry previously failed downloads."""
    if not os.path.exists(filename):
        safe_print(f"No failed downloads file found at {filename}", "warning")
        return
    
    with open(filename, 'r', encoding='utf-8') as f:
        failed_items = json.load(f)
    
    if not failed_items:
        safe_print("No failed items to retry", "info")
        return
    
    safe_print(f"\n🔄 Retrying {len(failed_items)} failed downloads...", "info")
    
    # Create a simple retry structure
    retry_tasks = []
    for item in failed_items:
        # Try to extract category info from the failed item
        retry_tasks.append({
            'article': {'title': item['title'], 'url': item['page_url']},
            'main_category': 'Retry',
            'sub_category': 'Failed Downloads'
        })
    
    # Process retries with fewer workers
    stats = download_all_documents_parallel([{'sub_categories': [{'articles': [t['article'] for t in retry_tasks]}]}], max_workers)
    return stats

def main():
    # Load previously scraped data
    safe_print("Loading scraped data...", "info")
    scraped_data = load_scraped_data(SCRAPED_DATA_FILE)
    
    if not scraped_data:
        safe_print("Exiting. Please run the scraping script first to generate the data file.", "error")
        return
    
    # Ask user if they want to retry failed downloads
    if os.path.exists("failed_downloads.json"):
        response = input("\nFound previous failed downloads. Retry them? (y/n): ")
        if response.lower() == 'y':
            retry_failed_downloads()
            return
    
    # Download all documents in parallel
    stats = download_all_documents_parallel(scraped_data)
    
    # Print summary
    elapsed_time = time.time() - start_time if 'start_time' in dir() else 0
    print("\n" + "="*60)
    print("📊 DOWNLOAD SUMMARY")
    print("="*60)
    print(f"Total documents processed: {len(scraped_data)} main categories")
    print(f"✅ Successfully downloaded: {stats['successful']}")
    print(f"⏭️  Already existed (skipped): {stats['skipped']}")
    print(f"❌ Failed: {stats['failed_count']}")
    print(f"💾 Total data downloaded: {stats['total_size'] / 1024:.2f} MB")
    print(f"⏱️  Time elapsed: {elapsed_time:.1f} seconds")
    print(f"📈 Average speed: {stats['successful'] / elapsed_time:.2f} PDFs/second" if elapsed_time > 0 else "")
    
    if stats['failed']:
        print(f"\nFailed documents: {len(stats['failed'])}")
        for i, doc in enumerate(stats['failed'][:5], 1):
            print(f"  {i}. {doc['title'][:60]}... - {doc['reason']}")
        if len(stats['failed']) > 5:
            print(f"  ... and {len(stats['failed']) - 5} more")
        
        # Save failed downloads for retry
        save_failed_downloads(stats['failed'])
    
    print(f"\n✨ Downloads saved in: {os.path.abspath(DOWNLOAD_DIR)}")

if __name__ == "__main__":
    # Store start time globally for summary
    start_time = time.time()
    main()