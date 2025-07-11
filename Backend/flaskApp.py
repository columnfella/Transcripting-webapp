import os
import json
from datetime import datetime, timezone
from shlex import quote
from typing import Optional
from flask import Flask, request, jsonify, send_from_directory, Response, make_response, after_this_request
from flask_cors import CORS
import logging
import re
import time
from word2word import Word2word
import requests
from pdfgen import generate_pdf_for_video
from video_utils import delete_video, VideoNotFoundError
from utils import *
from deep_translator import GoogleTranslator

# Initialize Flask app
app = Flask(__name__)
CORS(app, origins=["http://localhost:63342"], supports_credentials=True)  # Enable CORS for all routes


# ANSI color codes for terminal output
class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'  # End formatting


class ColoredFormatter(logging.Formatter):
    """Custom formatter to add colors to log levels"""

    COLORS = {
        'DEBUG': Colors.CYAN,
        'INFO': Colors.GREEN,
        'WARNING': Colors.YELLOW,
        'ERROR': Colors.RED,
        'CRITICAL': Colors.RED + Colors.BOLD,
    }

    def format(self, record):
        # Get the original formatted message
        log_message = super().format(record)

        # Add color based on log level
        level_color = self.COLORS.get(record.levelname, '')
        if level_color:
            # Color the entire message
            log_message = f"{level_color}{log_message}{Colors.END}"

        return log_message


# Initialize Flask app
app = Flask(__name__)
CORS(app, origins=["*"], supports_credentials=True)  # Enable CORS for all routes

# Configure logging with colors
handler = logging.StreamHandler()
handler.setFormatter(ColoredFormatter(
    fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
))

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
logger.addHandler(handler)

# Reduce Flask/Werkzeug logging noise but keep it visible
werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.INFO)
werkzeug_handler = logging.StreamHandler()
werkzeug_handler.setFormatter(ColoredFormatter(
    fmt='%(asctime)s - Flask - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
))

# Constants - adjust these paths according to your setup
UPLOAD_FOLDER = 'Uploads'  # Adjust this path
THUMBNAILS_FOLDER = 'thumbnails'
METADATA_FILE = 'metadata.json'  # Adjust this path
PDF_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'vid_pdfs')

# Create folders if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(THUMBNAILS_FOLDER, exist_ok=True)
os.makedirs(PDF_OUTPUT_DIR, exist_ok=True)


@app.before_request
def before_request() -> Optional[Response]:
    if request.method == "OPTIONS":
        response = make_response("{}", 200)
        origin = request.headers.get('Origin')
        if origin and origin.startswith('http://localhost'):
            response.headers['Access-Control-Allow-Origin'] = origin
        else:
            response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS, DELETE'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    if origin and origin.startswith('http://localhost'):
        response.headers['Access-Control-Allow-Origin'] = origin
    else:
        response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response


@app.route('/upload-video', methods=['POST'])
def handle_video_file():
    if 'video' not in request.files:
        return jsonify({'error': 'No video file part'}), 400

    video = request.files['video']
    video_title = request.form.get('title', 'Untitled')  # Get video title

    if video.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    logger.info(f"{Colors.BLUE}📹 Ingesting video...{Colors.END}")
    _, ext = os.path.splitext(video.filename)

    with open(METADATA_FILE, 'r+') as f:
        data = json.load(f)
        new_id = str(int(data['total_uploads']) + 1)
        new_filename = f"vid{new_id}{ext}"
        save_path = os.path.join(UPLOAD_FOLDER, new_filename)

        # Save file
        with open(save_path, 'wb') as file_out:
            file_out.write(video.read())
            file_out.flush()
            os.fsync(file_out.fileno())

        # Extract metadata
        meta = extract_video_metadata(save_path)
        if 'error' in meta:
            return jsonify({'error': 'Metadata extraction failed', 'details': meta['error']}), 500

        # Get size in MB
        size_bytes = os.path.getsize(save_path)
        size_mb = round(size_bytes / (1024 * 1024), 2)

        # Format duration
        formatted_duration = format_duration(meta['duration'])

        # Generate thumbnail
        thumbnail_filename = generate_thumbnail(save_path, new_id, THUMBNAILS_FOLDER)
        if thumbnail_filename:
            logger.info(f"{Colors.GREEN}🖼️  Thumbnail generated: {Colors.BOLD}{thumbnail_filename}{Colors.END}")
        else:
            logger.warning(f"{Colors.YELLOW}⚠️  Failed to generate thumbnail for {new_filename}{Colors.END}")

        # Generate transcript
        logger.info(f"{Colors.BLUE}🎙️  Starting transcription...{Colors.END}")
        transcript = transcribe_video(save_path)

        if 'error' in transcript:
            logger.warning(
                f"{Colors.YELLOW}⚠️  Transcription failed for {new_filename}: {transcript['error']}{Colors.END}")
            transcript_text = "Transcription failed"
            transcript_data = transcript  # Keep the full error info
            detected_language = 'eng'
            translated_transcript = {}
        else:
            # Extract actual transcript text
            transcript_text = transcript.get('text', '')
            logger.info(
                f"{Colors.GREEN}✅ Transcription successful: {Colors.BOLD}{len(transcript_text)}{Colors.END}{Colors.GREEN} characters{Colors.END}")

            # Store structured transcript data - handle both dict and model formats
            transcript_data = {
                'text': transcript_text,
                'words': transcript.get('words', []),
                'segments': transcript.get('segments', [])
            }

            # --- Language Detection ---
            lang = detect_transcript_language(transcript_text)
            if lang.startswith('fr'):
                detected_language = 'fr'
            elif lang.startswith('en'):
                detected_language = 'eng'
            else:
                detected_language = 'eng'
            logger.info(f"{Colors.CYAN}Detected language: {detected_language}{Colors.END}")

            # --- Split and translate transcript into 30-second chunks ---
            logger.info(f"{Colors.BLUE}Splitting and translating transcript into 30-second chunks using deep-translator...{Colors.END}")
            segments = transcript.get('segments', [])
            interval = 30.0
            chunked_translated = []
            if segments:
                max_time = max(seg.get('end', 0) for seg in segments)
                num_intervals = int(max_time // interval) + 1
                for i in range(num_intervals):
                    chunk_start = i * interval
                    chunk_end = (i + 1) * interval
                    chunk_segs = [seg for seg in segments if seg.get('start', 0) >= chunk_start and seg.get('end', 0) <= chunk_end]
                    chunk_text = ' '.join(seg.get('text', '') for seg in chunk_segs)
                    if chunk_text.strip():
                        try:
                            translated_chunk_text = GoogleTranslator(source='auto', target='fr' if detected_language == 'eng' else 'en').translate(chunk_text)
                            logger.debug(f"{Colors.GREEN}Chunk {i+1}: {chunk_start:.2f}-{chunk_end:.2f} translated.{Colors.END}")
                        except Exception as e:
                            logger.warning(f"{Colors.YELLOW}Chunk {i+1} translation failed: {str(e)}{Colors.END}")
                            translated_chunk_text = chunk_text
                        chunked_translated.append({
                            'start': chunk_start,
                            'end': chunk_end,
                            'text': translated_chunk_text
                        })
            else:
                logger.warning(f"{Colors.YELLOW}No segments found; using one big chunk for translation.{Colors.END}")
                try:
                    translated_chunk_text = GoogleTranslator(source='auto', target='fr' if detected_language == 'eng' else 'en').translate(transcript_text)
                except Exception as e:
                    logger.warning(f"{Colors.YELLOW}Fallback chunk translation failed: {str(e)}{Colors.END}")
                    translated_chunk_text = transcript_text
                chunked_translated.append({
                    'start': 0,
                    'end': 1e9,
                    'text': translated_chunk_text
                })
            logger.info(f"{Colors.GREEN}All chunks translated. Total chunks: {len(chunked_translated)}{Colors.END}")

            # Join all chunk texts to form the translated 'text' field
            translated_text = ' '.join(chunk['text'] for chunk in chunked_translated)
            logger.info(f"{Colors.GREEN}Joined all chunk texts for translated 'text' field. Length: {len(translated_text)}{Colors.END}")

            # Build translated transcript structure
            translated_transcript = {
                'text': translated_text,
                'words': chunked_translated
            }

        # Generate PDF after transcript
        pdf_filename = None
        try:
            meta_for_pdf = meta.copy()
            meta_for_pdf['transcript'] = transcript_data
            meta_for_pdf['ID'] = new_id  # Ensure ID is present for PDF
            pdf_path = generate_pdf_for_video(meta_for_pdf, output_dir=PDF_OUTPUT_DIR)
            pdf_filename = os.path.basename(pdf_path)
        except Exception as e:
            logger.error(f"{Colors.RED}PDF generation failed: {str(e)}{Colors.END}")
            pdf_filename = None

        # Update metadata
        meta.update({
            'ID': new_id,
            'filename': new_filename,
            'title': video_title,  # Add title from request
            'thumbnail': thumbnail_filename,  # Add thumbnail filename
            'upload_date': datetime.now(timezone.utc).isoformat(),
            'size_mb': size_mb,
            'duration_formatted': formatted_duration,
            'transcript': transcript_data,  # Store structured transcript data
            'pdffile': pdf_filename,  # Add PDF file name
            'language': detected_language,  # Store detected language
            'translated_transcript': translated_transcript  # Store translated transcript
        })

        data['total_uploads'] = new_id
        data['videos'].append(meta)

        f.seek(0)
        json.dump(data, f, indent=2)
        f.truncate()

    logger.info(
        f"{Colors.GREEN}💾 Saved video: {Colors.BOLD}{new_filename}{Colors.END}{Colors.GREEN} (Title: '{video_title}'){Colors.END}")

    # Provide transcript info in response
    if 'error' not in transcript:
        word_count = len(transcript_text.split())
        logger.info(
            f"{Colors.GREEN}📝 Transcript generated with {Colors.BOLD}{word_count}{Colors.END}{Colors.GREEN} words{Colors.END}")
        transcript_summary = transcript_text[:500] + '...' if len(transcript_text) > 500 else transcript_text
    else:
        transcript_summary = f"Transcription failed: {transcript.get('error', 'Unknown error')}"

    # Return metadata with transcript summary
    return jsonify({
        'message': f'Video saved as {new_filename}',
        'metadata': {
            'ID': new_id,
            'title': video_title,
            'filename': new_filename,
            'thumbnail': thumbnail_filename,  # Include thumbnail in response
            'duration': meta['duration'],
            'resolution': meta['resolution'],
            'transcript_summary': transcript_summary,
            'upload_date': meta['upload_date'],
            'size_mb': size_mb,
            'pdffile': pdf_filename  # Include PDF file name in response
        },
        'total_videos': new_id
    })


@app.route('/thumbnails/<filename>')
def serve_thumbnail(filename):
    """Serve thumbnail images"""
    logger.info(f"{Colors.CYAN}Serving thumbnail: {filename}{Colors.END}")
    return send_from_directory(THUMBNAILS_FOLDER, filename)


@app.route('/videos')
def get_videos():
    """Get all videos with their metadata"""
    try:
        with open(METADATA_FILE, 'r') as f:
            data = json.load(f)
            logger.info(f"{Colors.CYAN}Fetched all video metadata ({len(data.get('videos', []))} videos).{Colors.END}")
            return jsonify(data)
    except FileNotFoundError:
        logger.warning(f"{Colors.YELLOW}metadata.json not found when fetching videos.{Colors.END}")
        return jsonify({'videos': [], 'total_uploads': 0})
    except Exception as e:
        logger.error(f"{Colors.RED}Error fetching videos: {str(e)}{Colors.END}")
        return jsonify({'error': str(e)}), 500


@app.route('/video/<video_id>/transcript')
def get_transcript(video_id):
    """Get full transcript for a specific video"""
    try:
        with open(METADATA_FILE, 'r') as f:
            data = json.load(f)

        # Find video by ID
        video = next((v for v in data['videos'] if v['ID'] == video_id), None)
        if not video:
            logger.warning(f"{Colors.YELLOW}Transcript requested for missing video ID {video_id}.{Colors.END}")
            return jsonify({'error': 'Video not found'}), 404

        transcript = video.get('transcript', {})
        logger.info(f"{Colors.CYAN}Transcript served for video ID {video_id}.{Colors.END}")
        return jsonify(transcript)

    except Exception as e:
        logger.error(f"{Colors.RED}Error fetching transcript for video {video_id}: {str(e)}{Colors.END}")
        return jsonify({'error': str(e)}), 500


@app.route('/videos/metadata')
def get_videos_metadata():
    """Get all videos metadata without transcript or extra fields"""
    try:
        with open(METADATA_FILE, 'r') as f:
            data = json.load(f)
            videos = data.get('videos', [])
            # Exclude 'transcript' and any non-metadata fields
            metadata_list = []
            for v in videos:
                meta = {k: v[k] for k in v if k != 'transcript'}
                metadata_list.append(meta)
            logger.info(f"{Colors.CYAN}Fetched metadata for {len(metadata_list)} videos (no transcript).{Colors.END}")
            return jsonify({'videos': metadata_list, 'total_uploads': data.get('total_uploads', 0)})
    except FileNotFoundError:
        logger.warning(f"{Colors.YELLOW}metadata.json not found when fetching video metadata.{Colors.END}")
        return jsonify({'videos': [], 'total_uploads': 0})
    except Exception as e:
        logger.error(f"{Colors.RED}Error fetching video metadata: {str(e)}{Colors.END}")
        return jsonify({'error': str(e)}), 500


@app.route('/pdf/<pdf_filename>')
def serve_pdf(pdf_filename):
    """Serve a generated PDF file by filename from the vid_pdfs folder only"""
    pdf_path = os.path.join(PDF_OUTPUT_DIR, pdf_filename)
    if os.path.exists(pdf_path):
        logger.info(f"{Colors.CYAN}Serving PDF: {pdf_filename}{Colors.END}")
        return send_from_directory(PDF_OUTPUT_DIR, pdf_filename)
    else:
        logger.warning(f"{Colors.YELLOW}PDF not found: {pdf_filename}{Colors.END}")
        return jsonify({'error': 'PDF not found'}), 404


@app.route('/edit-video-title', methods=['POST'])
def edit_video_title():
    data = request.get_json()
    video_id = data.get('id')
    new_title = data.get('title')
    if not video_id or not new_title:
        logger.warning(f"{Colors.YELLOW}Edit title request missing id or title.{Colors.END}")
        return jsonify({'error': 'Missing id or title'}), 400
    try:
        # Update metadata.json
        with open(METADATA_FILE, 'r+') as f:
            meta = json.load(f)
            found = False
            for v in meta['videos']:
                if str(v['ID']) == str(video_id):
                    v['title'] = new_title
                    found = True
                    break
            if not found:
                logger.warning(f"{Colors.YELLOW}Edit title: Video not found for ID {video_id}.{Colors.END}")
                return jsonify({'error': 'Video not found'}), 404
            f.seek(0)
            json.dump(meta, f, indent=2)
            f.truncate()
        logger.info(f"{Colors.GREEN}Title updated for video ID {video_id}: '{new_title}'{Colors.END}")
        return jsonify({'message': 'Title updated successfully'})
    except Exception as e:
        logger.error(f"{Colors.RED}Error updating title for diddddiiii {video_id}: {str(e)}{Colors.END}")
        return jsonify({'error': str(e)}), 500


@app.route('/delete-video/<video_id>', methods=['DELETE'])
def delete_video_api(video_id):
    try:
        result = delete_video(video_id)
        logger.info(f"{Colors.GREEN}Deleted video ID {video_id}.{Colors.END}")
        return jsonify({'message': result})
    except VideoNotFoundError as e:
        logger.warning(f"{Colors.YELLOW}Delete video: Not found {video_id}.{Colors.END}")
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"{Colors.RED}Error deleting video {video_id}: {str(e)}{Colors.END}")
        return jsonify({'error': str(e)}), 500


@app.route('/uploads/<filename>')
def serve_uploaded_video(filename):
    logger.info(f"{Colors.CYAN}Serving uploaded video: {filename}{Colors.END}")
    return send_from_directory(UPLOAD_FOLDER, filename)


@app.route('/pdf-interval/<video_id>', methods=['POST'])
def generate_pdf_for_interval(video_id):
    data = request.get_json()
    start = data.get('start')
    end = data.get('end')
    if start is None or end is None:
        logger.warning(f"{Colors.YELLOW}Interval PDF request missing start or end for video {video_id}.{Colors.END}")
        return jsonify({'error': 'Missing start or end'}), 400
    # Load metadata
    with open(METADATA_FILE, 'r', encoding='utf-8') as f:
        meta = json.load(f)
        video = next((v for v in meta['videos'] if str(v['ID']) == str(video_id)), None)
    if not video:
        logger.warning(f"{Colors.YELLOW}Interval PDF: Video not found for ID {video_id}.{Colors.END}")
        return jsonify({'error': 'Video not found'}), 404
    # Import and call the interval PDF generator
    from pdfgen import generate_pdf_for_video_interval
    pdf_path = generate_pdf_for_video_interval(video, start, end)
    pdf_filename = os.path.basename(pdf_path)
    logger.info(f"{Colors.GREEN}Interval PDF generated for video {video_id} ({start}-{end}s): {pdf_filename}{Colors.END}")
    return jsonify({'pdffile': pdf_filename})

@app.route('/translate-transcript/<video_id>', methods=['POST'])
def translate_transcript(video_id):
    logger.info(f"{Colors.CYAN}Received translate-transcript request for video ID {video_id}{Colors.END}")
    try:
        with open(METADATA_FILE, 'r', encoding='utf-8') as f:
            meta = json.load(f)
            video = next((v for v in meta['videos'] if str(v['ID']) == str(video_id)), None)
            if not video:
                logger.warning(f"{Colors.YELLOW}Video not found for ID {video_id}{Colors.END}")
                return jsonify({'error': 'Video not found'}), 404
            translated_transcript = video.get('translated_transcript')
            if not translated_transcript:
                logger.warning(f"{Colors.YELLOW}No translated_transcript found for video ID {video_id}{Colors.END}")
                return jsonify({'error': 'No translated transcript available'}), 404
            logger.info(f"{Colors.GREEN}Returning translated_transcript for video ID {video_id}{Colors.END}")
            return jsonify(translated_transcript)
    except Exception as e:
        logger.error(f"{Colors.RED}Failed to load translated transcript: {str(e)}{Colors.END}")
        return jsonify({'error': f'Failed to load translated transcript: {str(e)}'}), 500

@app.route('/video-language/<video_id>', methods=['GET'])
def get_video_language(video_id):
    logger.info(f"{Colors.CYAN}Language detection requested for video ID {video_id}{Colors.END}")
    try:
        with open(METADATA_FILE, 'r', encoding='utf-8') as f:
            meta = json.load(f)
            video = next((v for v in meta.get('videos', []) if str(v.get('ID')) == str(video_id)), None)
            if not video:
                logger.warning(f"{Colors.YELLOW}Video not found for ID {video_id}. Returning 'eng' as fallback.{Colors.END}")
                return jsonify({'language': 'eng'})
            transcript = video.get('transcript', {})
            transcript_text = transcript.get('text', '')
            if not transcript_text:
                logger.warning(f"{Colors.YELLOW}Transcript text missing for video ID {video_id}. Returning 'eng' as fallback.{Colors.END}")
                return jsonify({'language': 'eng'})
            logger.info(f"{Colors.GREEN}Transcript loaded from metadata.json for language detection (length: {len(transcript_text)} chars).{Colors.END}")
    except Exception as e:
        logger.warning(f"{Colors.YELLOW}Error loading transcript from metadata.json for video ID {video_id}: {str(e)}. Returning 'eng' as fallback.{Colors.END}")
        return jsonify({'language': 'eng'})

    lang = detect_transcript_language(transcript_text)
    logger.info(f"{Colors.CYAN}Raw detected language: {lang}{Colors.END}")
    # Normalize output
    if lang.startswith('fr'):
        lang = 'fr'
    elif lang.startswith('en'):
        lang = 'eng'
    logger.info(f"{Colors.GREEN}Normalized detected language for video ID {video_id}: {lang}{Colors.END}")
    return jsonify({'language': lang})

if __name__ == '__main__':
    # Initialize metadata file if it doesn't exist
    if not os.path.exists(METADATA_FILE):
        initial_data = {
            'total_uploads': 0,
            'videos': []
        }
        with open(METADATA_FILE, 'w') as f:
            json.dump(initial_data, f, indent=2)

    # Check system requirements on startup (only in main process, not reloader)
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        print(f"\n{Colors.BLUE}{Colors.BOLD}{'=' * 50}")
        print("🎥 VIDEO UPLOAD SERVER")
        print(f"{'=' * 50}{Colors.END}")

        # Check dependencies
        missing_deps = []

        if not check_groq():
            missing_deps.append("Groq")
            print(f"{Colors.RED}❌ Groq: Not installed{Colors.END}")
            print(f"{Colors.YELLOW}   Install with: pip install groq{Colors.END}")
        else:
            print(f"{Colors.GREEN}✅ Groq: Available{Colors.END}")

        if missing_deps:
            print(
                f"\n{Colors.YELLOW}{Colors.BOLD}⚠️  Warning: {', '.join(missing_deps)} missing - transcription will fail{Colors.END}")
        else:
            print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 All dependencies available - ready for transcription!{Colors.END}")

        print(f"\n{Colors.CYAN}{Colors.BOLD}🚀 Starting server on http://127.0.0.1:5000{Colors.END}")
        print(f"{Colors.BLUE}{Colors.BOLD}{'=' * 50}{Colors.END}\n")

    app.run(debug=True, host='127.0.0.1', port=5000)