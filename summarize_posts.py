import json
import time
import sys
import os
import re
import requests
import argparse
from bs4 import BeautifulSoup
from tqdm import tqdm

youtube_regex = re.compile(r'https?://(?:www\.)?youtu(?:be\.com/(?:watch\?v=|embed/)|\.be/)([a-zA-Z0-9_-]{11})')

def fetch_youtube_metadata(url):
    oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
    }
    try:
        response = requests.get(oembed_url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data.get('title'), data.get('author_name', '')
        else:
            return None, None
    except requests.exceptions.RequestException as e:
        print(f"\n抓取 YouTube oEmbed API 時發生網路錯誤：{e}")
        return None, None

def generate_mock_summary(text, source_type='TEXT'):
    time.sleep(1.5)
    if source_type == 'YOUTUBE':
        return f"[AI影片摘要] 這是關於影片 '{text[:30].strip()}...' 的摘要內容。"
    else:
        soup = BeautifulSoup(text, 'html.parser')
        plain_text = soup.get_text(separator=' ', strip=True)
        return f"[AI文字摘要] 這是關於 '{plain_text[:30].strip()}...' 的摘要內容。"

def create_backup(filepath):
    backup_path = filepath + '.bak'
    if not os.path.exists(backup_path):
        print(f"為 {os.path.basename(filepath)} 創建備份檔案：{os.path.basename(backup_path)}")
        with open(filepath, 'rb') as f_in, open(backup_path, 'wb') as f_out:
            f_out.write(f_in.read())
    return backup_path

def generate_summaries_in_file(filepath, selective=False):
    print(f"--- 模式：產生摘要 ---")
    if selective:
        print("啟用選擇性處理模式：只處理標記為 `ai_summarize: true` 的文章。")

    create_backup(filepath)

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f"錯誤：無法讀取或解析檔案 {filepath}。 {e}")
        return

    if selective:
        posts_to_process = [p for p in data.get('posts', []) if p.get('ai_summarize')]
    else:
        posts_to_process = [p for p in data.get('posts', []) if not p.get('summary', '').strip() or p['summary'] in ["這是一般文章的文字摘要 (AI生成)。", "這是一段關於 YouTube 影片的摘要 (AI生成)。"]]
    
    if not posts_to_process:
        print("沒有需要處理的文章，任務結束。")
        return

    print(f"檔案 '{filepath}' 載入成功，共 {len(data.get('posts', []))} 篇文章，其中 {len(posts_to_process)} 篇需要生成摘要。")

    for post in tqdm(posts_to_process, desc="生成摘要進度"):
        post_html = post.get('post_html', '')
        youtube_match = youtube_regex.search(post_html)
        summary = ''
        if youtube_match:
            video_id = youtube_match.group(1)
            canonical_url = f"https://www.youtube.com/watch?v={video_id}"
            tqdm.write(f"\n偵測到 YouTube 影片 (ID: {video_id})，查詢中...")
            title, author = fetch_youtube_metadata(canonical_url)
            if title:
                summary = generate_mock_summary(f"標題：{title} 作者：{author}", source_type='YOUTUBE')
            else:
                summary = f"[處理失敗] 無法獲取 YouTube 影片 (ID: {video_id}) 資訊。"
        else:
            summary = generate_mock_summary(post_html, source_type='TEXT')
        
        # Find the post in the original data and update it
        for original_post in data.get('posts', []):
            if original_post['post_id'] == post['post_id']:
                original_post['summary'] = summary
                if selective:
                    original_post['ai_summarize'] = False # Clear the flag after processing
                break


    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

    print("\n所有需要處理的文章摘要已生成完畢！")

def export_summaries(source_path, output_path):
    print(f"--- 模式：匯出摘要 ---")
    try:
        with open(source_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f"錯誤：無法讀取來源檔案 {source_path}。 {e}")
        return

    summaries_data = {str(post['post_id']): post.get('summary', '') for post in data.get('posts', [])}
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(summaries_data, f, ensure_ascii=False, indent=4)
    
    print(f"成功從 {os.path.basename(source_path)} 匯出 {len(summaries_data)} 筆摘要到 {os.path.basename(output_path)}。")

def import_summaries(summaries_path, target_path):
    print(f"--- 模式：匯入摘要 ---")
    try:
        with open(summaries_path, 'r', encoding='utf-8') as f:
            summaries_data = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f"錯誤：無法讀取摘要檔案 {summaries_path}。 {e}")
        return

    create_backup(target_path)

    try:
        with open(target_path, 'r', encoding='utf-8') as f:
            target_data = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f"錯誤：無法讀取目標檔案 {target_path}。 {e}")
        return

    update_count = 0
    for post in tqdm(target_data.get('posts', []), desc="匯入摘要進度"):
        post_id_str = str(post['post_id'])
        if post_id_str in summaries_data:
            post['summary'] = summaries_data[post_id_str]
            update_count += 1

    with open(target_path, 'w', encoding='utf-8') as f:
        json.dump(target_data, f, ensure_ascii=False, indent=4)

    print(f"成功將 {update_count} 筆摘要匯入到 {os.path.basename(target_path)}。")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='phpBB 文章摘要處理工具')
    subparsers = parser.add_subparsers(dest='mode', required=True, help='操作模式')

    # Generate mode
    parser_generate = subparsers.add_parser('generate', help='為 JSON 檔案中的文章產生摘要')
    parser_generate.add_argument('filepath', help='要處理的 topic JSON 檔案路徑')
    parser_generate.add_argument('--selective', action='store_true', help='只處理被標記為需要 AI 摘要的文章')

    # Export mode
    parser_export = subparsers.add_parser('export', help='從一個 JSON 檔案匯出所有摘要')
    parser_export.add_argument('source', help='來源 topic JSON 檔案路徑')
    parser_export.add_argument('output', help='要儲存摘要的 JSON 檔案路徑')

    # Import mode
    parser_import = subparsers.add_parser('import', help='將摘要從檔案匯入到另一個 JSON 檔案')
    parser_import.add_argument('summaries', help='包含摘要的 JSON 檔案路徑')
    parser_import.add_argument('target', help='要匯入摘要的目標 topic JSON 檔案路徑')

    args = parser.parse_args()

    if args.mode == 'generate':
        generate_summaries_in_file(args.filepath, args.selective)
    elif args.mode == 'export':
        export_summaries(args.source, args.output)
    elif args.mode == 'import':
        import_summaries(args.summaries, args.target)
