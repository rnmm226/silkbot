import requests
from bs4 import BeautifulSoup
import json
import time
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from urllib.parse import urljoin

# Configuration
BASE_URL = "https://jort.tn"
LAKE_BASE = "https://lake.jort.tn"
SCRAPED_DATA_FILE = "x.json"
DOWNLOAD_DIR = "downloaded_jort_pdfs"
MAX_WORKERS = 20
REQUEST_DELAY = 0.05
MAX_RETRIES = 3

print_lock = Lock()

def safe_print(message, type="info"):
    with print_lock:
        if type == "error":
            print(f"❌ {message}")
        elif type == "success":
            print(f"✅ {message}")
        elif type == "warning":
            print(f"⚠️  {message}")
        else:
            print(message)

def get_soup(url):
    """Get BeautifulSoup object for a URL with retries."""
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(url, timeout=20)
            response.raise_for_status()
            return BeautifulSoup(response.content, 'html.parser')
        except Exception as e:
            if attempt == MAX_RETRIES - 1:
                safe_print(f"Failed to get {url}: {e}", "error")
                return None
            time.sleep(1)

def extract_years_from_collection(collection_url):
    """Extract all years from a collection page (e.g., /browse/journal-officiel)."""
    soup = get_soup(collection_url)
    if not soup:
        return []
    
    years = []
    # Find all year links - they look like /browse/collection-name/YYYY/
    for link in soup.find_all('a', href=True):
        href = link['href']
        # Match pattern: /browse/collection-name/YYYY/
        match = re.search(r'/browse/([^/]+)/(\d{4})/?$', href)
        if match:
            year = match.group(2)
            if year not in years:
                years.append(year)
    
    return sorted(years)

def get_issue_count_for_year(year_url):
    """Get the number of issues for a specific year page."""
    soup = get_soup(year_url)
    if not soup:
        return 0
    
    # Method 1: Look for the "Numéros (fr)" or "Numéros (ar)" text which shows the count
    # Example: "Numéros (fr)\n59"
    for header in soup.find_all(['h2', 'h3', 'div']):
        text = header.get_text()
        if 'Numéros' in text and '(' in text:
            # Extract the number from text like "Numéros (fr)\n59" or "Numéros (fr) 59"
            match = re.search(r'Numéros\s*\([^)]+\)\s*(\d+)', text)
            if match:
                return int(match.group(1))
    
    # Method 2: Count the actual issue links on the page
    # Look for links that contain issue numbers (e.g., N°001, N°002)
    issue_links = soup.find_all('a', href=re.compile(r'/browse/[^/]+/\d{4}/\d+'))
    if issue_links:
        return len(issue_links)
    
    # Method 3: Look for pattern like "N°001" through "N°059" in the text
    page_text = soup.get_text()
    # Find all N°XXX patterns
    issue_numbers = re.findall(r'N°(\d{3})', page_text)
    if issue_numbers:
        # Get the highest issue number
        max_issue = max([int(num) for num in issue_numbers])
        return max_issue
    
    # Method 4: Look for "Plage (fr)\nN°001 → N°059" pattern
    plage_match = re.search(r'Plage\s*\([^)]+\)\s*N°(\d+)\s*→\s*N°(\d+)', page_text)
    if plage_match:
        return int(plage_match.group(2))
    
    return 0

def scrape_all_collections():
    """Main scraping function - gets all PDF URLs from all collections at runtime."""
    collections = [
        {'name': 'journal-officiel', 'url': f"{BASE_URL}/browse/journal-officiel"},
        {'name': 'annonces-legales', 'url': f"{BASE_URL}/browse/annonces-legales"},
        {'name': 'tribunal-immobilier', 'url': f"{BASE_URL}/browse/tribunal-immobilier"}
    ]
    
    all_pdfs = []
    
    for collection in collections:
        safe_print(f"\n📁 Processing collection: {collection['name']}", "info")
        
        # Step 1: Get all years from the collection page
        years = extract_years_from_collection(collection['url'])
        safe_print(f"  Found {len(years)} years: {years[:5]}{'...' if len(years) > 5 else ''}")
        
        # Step 2: For each year, get the issue count
        years_data = []
        for year in years:
            year_url = f"{collection['url']}/{year}/"
            issue_count = get_issue_count_for_year(year_url)
            if issue_count > 0:
                years_data.append({'year': year, 'issue_count': issue_count})
                safe_print(f"    Year {year}: {issue_count} issues")
            else:
                safe_print(f"    Year {year}: could not determine issue count", "warning")
            time.sleep(REQUEST_DELAY)
        
        # Step 3: Generate all PDF URLs for this collection
        # Try both French and Arabic for each issue
        for year_data in years_data:
            year = year_data['year']
            issue_count = year_data['issue_count']
            
            for issue_num in range(1, issue_count + 1):
                issue_str = f"{issue_num:03d}"  # Format as 001, 002, etc.
                
                # Try French version first
                pdf_url_fr = f"{LAKE_BASE}/{collection['name']}/fr/{year}/{issue_str}.pdf"
                all_pdfs.append({
                    'pdf_url': pdf_url_fr,
                    'collection': collection['name'],
                    'year': year,
                    'issue': issue_str,
                    'language': 'fr',
                    'title': f"{collection['name']} {year} issue {issue_str} (French)"
                })
                
                # Try Arabic version
                pdf_url_ar = f"{LAKE_BASE}/{collection['name']}/ar/{year}/{issue_str}.pdf"
                all_pdfs.append({
                    'pdf_url': pdf_url_ar,
                    'collection': collection['name'],
                    'year': year,
                    'issue': issue_str,
                    'language': 'ar',
                    'title': f"{collection['name']} {year} issue {issue_str} (Arabic)"
                })
        
        safe_print(f"  Generated {len([p for p in all_pdfs if p['collection'] == collection['name']])} PDF URLs for {collection['name']}", "success")
    
    return all_pdfs

def load_progress():
    """Load already downloaded PDF URLs from SCRAPED_DATA_FILE."""
    if os.path.exists(SCRAPED_DATA_FILE):
        try:
            with open(SCRAPED_DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Handle both old and new format
                if isinstance(data, list) and len(data) > 0 and 'pdf_url' in data[0]:
                    # This is a list of PDF objects
                    downloaded_urls = set()
                    for item in data:
                        if item.get('downloaded', False):
                            downloaded_urls.add(item['pdf_url'])
                    return downloaded_urls
                elif isinstance(data, dict) and 'downloaded_urls' in data:
                    return set(data['downloaded_urls'])
        except Exception as e:
            safe_print(f"Error loading progress file: {e}", "error")
    
    return set()

def save_progress(pdf_list, downloaded_urls):
    """Save the complete PDF list with download status to SCRAPED_DATA_FILE."""
    # Create a list with download status for each PDF
    save_data = []
    for pdf in pdf_list:
        save_data.append({
            'pdf_url': pdf['pdf_url'],
            'collection': pdf['collection'],
            'year': pdf['year'],
            'issue': pdf['issue'],
            'language': pdf['language'],
            'title': pdf['title'],
            'downloaded': pdf['pdf_url'] in downloaded_urls
        })
    
    with open(SCRAPED_DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(save_data, f, ensure_ascii=False, indent=2)
    
    # Also save just the URLs for quick access
    with open(SCRAPED_DATA_FILE.replace('.json', '_urls.json'), 'w', encoding='utf-8') as f:
        json.dump(list(downloaded_urls), f, ensure_ascii=False, indent=2)

def sanitize_filename(filename):
    """Clean up filename to be filesystem-friendly."""
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    filename = re.sub(r'\s+', ' ', filename).strip()
    if len(filename) > 200:
        filename = filename[:200]
    return filename

def download_pdf(pdf_info, save_path, session, headers, downloaded_urls, stats):
    """Download a single PDF with progress tracking."""
    pdf_url = pdf_info['pdf_url']
    
    # Skip if already downloaded
    if pdf_url in downloaded_urls:
        with stats['lock']:
            stats['skipped'] += 1
        return True
    
    try:
        response = session.get(pdf_url, headers=headers, stream=True, timeout=30)
        
        # Check if PDF exists (404 means not available for that language/year)
        if response.status_code == 404:
            # Not an error - some combinations may not exist
            # Mark as "skipped" but don't retry
            with stats['lock']:
                stats['skipped'] += 1
                downloaded_urls.add(pdf_url)  # Mark as processed to avoid retry
            return True
        
        response.raise_for_status()
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        
        with open(save_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=32768):
                f.write(chunk)
        
        file_size = os.path.getsize(save_path) / 1024
        with stats['lock']:
            stats['successful'] += 1
            stats['total_size'] += file_size
            downloaded_urls.add(pdf_url)
            # Save progress after each successful download
            save_progress(stats['pdf_list'], downloaded_urls)
        
        safe_print(f"📥 Downloaded: {pdf_info['title'][:60]}... ({file_size:.1f} KB)", "success")
        return True
        
    except Exception as e:
        with stats['lock']:
            stats['failed'].append({
                'title': pdf_info['title'],
                'pdf_url': pdf_url,
                'reason': str(e)
            })
            stats['failed_count'] += 1
        safe_print(f"Failed: {pdf_info['title'][:60]}... - {e}", "error")
        return False

def download_all_parallel(pdf_list, max_workers=MAX_WORKERS):
    """Download all PDFs in parallel with progress saving."""
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    
    # Load progress from SCRAPED_DATA_FILE
    downloaded_urls = load_progress()
    safe_print(f"Resuming from {len(downloaded_urls)} already processed PDFs")
    
    stats = {
        'successful': 0,
        'failed_count': 0,
        'skipped': 0,
        'total_size': 0,
        'failed': [],
        'pdf_list': pdf_list,  # Store reference for saving progress
        'lock': Lock()
    }
    
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    def process_one(pdf_info):
        # Create directory structure: downloaded_pdfs/collection/year/
        folder_path = os.path.join(DOWNLOAD_DIR, pdf_info['collection'], pdf_info['year'])
        filename = sanitize_filename(f"{pdf_info['collection']}_{pdf_info['year']}_{pdf_info['issue']}_{pdf_info['language']}")
        save_path = os.path.join(folder_path, filename + '.pdf')
        
        with requests.Session() as session:
            return download_pdf(pdf_info, save_path, session, headers, downloaded_urls, stats)
    
    total = len(pdf_list)
    start_time = time.time()
    completed = 0
    
    safe_print(f"\n📊 Total PDFs to process: {total}")
    safe_print(f"🚀 Using {max_workers} concurrent workers")
    safe_print(f"📁 Downloads will be saved to: {DOWNLOAD_DIR}\n")
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(process_one, p): p for p in pdf_list}
        for future in as_completed(futures):
            completed += 1
            if completed % 10 == 0 or completed == total:
                elapsed = time.time() - start_time
                rate = completed / elapsed if elapsed > 0 else 0
                safe_print(f"\n📈 Progress: {completed}/{total} ({completed/total*100:.1f}%) - "
                          f"Speed: {rate:.2f} docs/sec - "
                          f"Success: {stats['successful']} - "
                          f"Skipped: {stats['skipped']} - "
                          f"Failed: {stats['failed_count']}")
    
    return stats

def main():
    # Always scrape fresh data from the website at runtime
    safe_print("🕷️  Scraping JORT collections at runtime...", "info")
    safe_print("This may take a few minutes depending on the number of years and issues...", "info")
    
    pdf_list = scrape_all_collections()
    
    if not pdf_list:
        safe_print("No PDFs found. Exiting.", "error")
        return
    
    safe_print(f"\n✅ Successfully generated {len(pdf_list)} PDF URLs from website", "success")
    
    # Ask about retrying failed downloads from previous run
    if os.path.exists(SCRAPED_DATA_FILE):
        response = input(f"\nFound existing {SCRAPED_DATA_FILE} from previous run. Continue where left off? (y/n): ")
        if response.lower() != 'y':
            # Backup old file and start fresh
            backup_file = f"{SCRAPED_DATA_FILE}.backup"
            os.rename(SCRAPED_DATA_FILE, backup_file)
            safe_print(f"Started fresh. Old data backed up to {backup_file}", "warning")
    
    # Download all PDFs (progress will be saved to SCRAPED_DATA_FILE)
    stats = download_all_parallel(pdf_list)
    
    # Final summary
    print("\n" + "="*60)
    print("📊 DOWNLOAD SUMMARY")
    print("="*60)
    print(f"Total PDFs processed: {len(pdf_list)}")
    print(f"✅ Successfully downloaded: {stats['successful']}")
    print(f"⏭️  Skipped (already exists or 404): {stats['skipped']}")
    print(f"❌ Failed: {stats['failed_count']}")
    print(f"💾 Total data downloaded: {stats['total_size'] / 1024:.2f} MB")
    
    if stats['failed']:
        failed_file = "failed_downloads.json"
        with open(failed_file, 'w', encoding='utf-8') as f:
            json.dump(stats['failed'], f, ensure_ascii=False, indent=2)
        safe_print(f"\n⚠️  {len(stats['failed'])} failed downloads saved to {failed_file}", "warning")
    
    safe_print(f"\n✨ Downloads saved in: {os.path.abspath(DOWNLOAD_DIR)}")
    safe_print(f"📝 Progress saved to: {os.path.abspath(SCRAPED_DATA_FILE)}")

if __name__ == "__main__":
    main()