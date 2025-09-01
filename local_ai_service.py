import os
import google.generativeai as genai
from flask import Flask, jsonify, request
from flask_cors import CORS
from bs4 import BeautifulSoup

# --- Initial Configuration ---
# The static_folder points to the 'offline_reader' directory.
# All files in it will be served from the root URL (e.g., /reader.html, /css/style.css)
app = Flask(__name__, static_folder='offline_reader', static_url_path='')
CORS(app) # Enable Cross-Origin Resource Sharing for the app

# The API key is no longer configured globally on startup.
# It will be provided by the user with each API request.
print("AI 服務已啟動。請在客戶端提供有效的 Gemini API 金鑰以使用 AI 功能。")

# --- API Endpoints ---

@app.route('/')
def index():
    """Serves the main reader.html page."""
    return app.send_static_file('reader.html')

@app.route('/status', methods=['GET'])
def status():
    """Checks if the service is running."""
    # The concept of the server having the key is removed.
    # The client is now responsible for holding the key.
    return jsonify({
        "ai_enabled": True, # We assume the client can provide a key.
        "message": "Service is running"
    })

@app.route('/summarize', methods=['POST'])
def summarize():
    """Receives post content and an API key, generates a summary, and returns it."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request"}), 400

    api_key = data.get('api_key')
    post_html = data.get('post_html')

    if not api_key:
        return jsonify({"error": "Missing API key"}), 400
    if not post_html:
        return jsonify({"error": "Missing post_html"}), 400

    try:
        genai.configure(api_key=api_key)
    except Exception as e:
        return jsonify({"error": f"無效的 API 金鑰或設定錯誤: {e}"}), 400

    soup = BeautifulSoup(post_html, 'html.parser')
    plain_text = soup.get_text(separator=' ', strip=True)

    if len(plain_text) < 20:
        return jsonify({"summary": "(內容過於簡短，無需摘要)"})

    prompt = f"""請為以下這段論壇文章內容產生一個風格客觀、長度約 50-100 字的摘要：

---
{plain_text[:2000]}
---"""

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return jsonify({"summary": response.text})

    except Exception as e:
        print(f"ERROR: An error occurred while calling the Gemini API: {e}")
        return jsonify({"error": f"呼叫 AI 服務時發生錯誤: {e}"}), 500

@app.route('/chat', methods=['POST'])
def chat():
    """Handles the interactive chat with the AI, using a provided API key."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request"}), 400

    api_key = data.get('api_key')
    user_prompt = data.get('prompt')
    chat_history = data.get('history')

    if not api_key:
        return jsonify({"error": "Missing API key"}), 400
    if not user_prompt or not isinstance(chat_history, list):
        return jsonify({"error": "Missing or invalid prompt or history"}), 400

    try:
        genai.configure(api_key=api_key)
    except Exception as e:
        return jsonify({"error": f"無效的 API 金鑰或設定錯誤: {e}"}), 400

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        chat_session = model.start_chat(history=chat_history)
        response = chat_session.send_message(user_prompt)
        return jsonify({"reply": response.text})

    except Exception as e:
        print(f"ERROR: An error occurred during chat with Gemini API: {e}")
        return jsonify({"error": f"與 AI 對話時發生錯誤: {e}"}), 500

if __name__ == '__main__':
    # Get port from environment variable or default to 5000
    port = int(os.environ.get("PORT", 8080))
    # Use 0.0.0.0 to make it accessible within the GCP Cloud Shell environment
    app.run(host='0.0.0.0', port=port, debug=True)