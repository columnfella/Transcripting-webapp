import os
import random
import cv2
import logging
from datetime import datetime

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


def check_groq():
    """Check if Groq package is available"""
    try:
        import groq
        return True
    except ImportError:
        return False


def extract_video_metadata(video_path):
    """
    Extract video metadata using OpenCV
    Returns dict with duration, resolution, etc.
    """
    try:
        cap = cv2.VideoCapture(video_path)

        if not cap.isOpened():
            return {'error': 'Could not open video file'}

        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        # Calculate duration
        duration = frame_count / fps if fps > 0 else 0

        cap.release()

        return {
            'duration': duration,
            'resolution': f"{width}x{height}",
            'fps': fps,
            'frame_count': frame_count
        }

    except Exception as e:
        logging.error(f"{Colors.RED}Error extracting metadata: {str(e)}{Colors.END}")
        return {'error': str(e)}


def format_duration(seconds):
    """Format duration in seconds to HH:MM:SS or MM:SS format"""
    try:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)

        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
        else:
            return f"{minutes:02d}:{secs:02d}"
    except:
        return "00:00"


def transcribe_video(video_path):
    """
    Transcribe video using Groq API - works directly with video files
    """
    try:
        # Check if Groq is installed
        try:
            from groq import Groq
        except ImportError:
            return {
                'error': 'Groq package not installed. Please install it with: pip install groq'
            }

        # Initialize Groq client
        # Note: Current API key isn't valid anymore, replace with your own and everything will work
        GROQ_API_KEY = "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"

        if GROQ_API_KEY == "YOUR_GROQ_API_KEY_HERE":
            return {
                'error': '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'
            }

        client = Groq(api_key=GROQ_API_KEY)

        # Transcribe video directly using Groq (no FFmpeg needed!)
        with open(video_path, 'rb') as video_file:
            transcription = client.audio.transcriptions.create(
                file=video_file,
                model="whisper-large-v3-turbo",
                response_format="verbose_json",
                timestamp_granularities=["word", "segment"],
                temperature=0.0
            )

        # Convert to dict if it's a Pydantic model
        if hasattr(transcription, 'model_dump'):
            transcript_data = transcription.model_dump()
        else:
            transcript_data = transcription

        logging.info(
            f"{Colors.GREEN}✅ Transcription successful: {Colors.BOLD}{len(transcript_data.get('text', ''))}{Colors.END}{Colors.GREEN} characters{Colors.END}")

        return transcript_data

    except Exception as e:
        logging.error(f"{Colors.RED}Transcription error: {str(e)}{Colors.END}")
        return {'error': f'Transcription failed: {str(e)}'}


def generate_thumbnail(video_path, video_id, thumbnails_folder):
    """
    Generate a thumbnail from a random frame of the video
    Returns the thumbnail filename or None if failed
    """
    try:
        # Open video file
        cap = cv2.VideoCapture(video_path)

        if not cap.isOpened():
            logging.error(f"Could not open video file: {video_path}")
            return None

        # Get total frame count
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        if total_frames <= 0:
            logging.error(f"Invalid frame count for video: {video_path}")
            cap.release()
            return None

        # Choose a random frame (avoid first and last 10% of frames for better thumbnails)
        start_frame = int(total_frames * 0.1)
        end_frame = int(total_frames * 0.9)
        random_frame = random.randint(start_frame, end_frame) if start_frame < end_frame else total_frames // 2

        # Set frame position
        cap.set(cv2.CAP_PROP_POS_FRAMES, random_frame)

        # Read the frame
        ret, frame = cap.read()
        cap.release()

        if not ret or frame is None:
            logging.error(f"Could not read frame {random_frame} from video: {video_path}")
            return None

        # Generate thumbnail filename
        thumbnail_filename = f"thumb_{video_id}.jpg"
        thumbnail_path = os.path.join(thumbnails_folder, thumbnail_filename)

        # Resize frame to thumbnail size (e.g., 320x180 for 16:9 aspect ratio)
        height, width = frame.shape[:2]
        thumbnail_width = 320
        thumbnail_height = int((thumbnail_width * height) / width)

        # Resize the frame
        thumbnail = cv2.resize(frame, (thumbnail_width, thumbnail_height), interpolation=cv2.INTER_AREA)

        # Save thumbnail
        success = cv2.imwrite(thumbnail_path, thumbnail, [cv2.IMWRITE_JPEG_QUALITY, 85])

        if success:
            logging.info(
                f"{Colors.GREEN}Generated thumbnail: {Colors.BOLD}{thumbnail_filename}{Colors.END}{Colors.GREEN} from frame {random_frame}{Colors.END}")
            return thumbnail_filename
        else:
            logging.error(f"{Colors.RED}Failed to save thumbnail: {thumbnail_path}{Colors.END}")
            return None

    except Exception as e:
        logging.error(f"{Colors.RED}Error generating thumbnail for {video_path}: {str(e)}{Colors.END}")
        return None 

def detect_transcript_language(transcript):
    # Dummy implementation: look for French/English keywords or use langdetect if available
    try:
        from langdetect import detect
        return detect(transcript)
    except Exception:
        lang = ''
        # Fallback: simple heuristic
        if any(word in transcript.lower() for word in ['le', 'la', 'et', 'est', 'un', 'une']):
            return 'fr'
        return 'eng'