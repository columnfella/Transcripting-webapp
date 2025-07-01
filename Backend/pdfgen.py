import os
import json
import tempfile
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.units import cm
import math
from collections import defaultdict

METADATA_FILE = os.path.join(os.path.dirname(__file__), 'metadata.json')
VID_PDF_DIR = os.path.join(os.path.dirname(__file__), 'vid_pdfs')
TEMP_PDF_DIR = VID_PDF_DIR  # For backward compatibility
os.makedirs(VID_PDF_DIR, exist_ok=True)

def load_metadata():
    with open(METADATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def list_videos(metadata):
    print("\nAvailable Videos:")
    for v in metadata['videos']:
        print(f"[{v['ID']}] {v.get('title', 'Untitled')} (File: {v.get('filename', 'N/A')}, Duration: {v.get('duration_formatted', 'N/A')})")

def select_videos(metadata):
    list_videos(metadata)
    ids = input("\nEnter video ID(s) to generate PDF for (comma-separated for multiple): ").strip()
    selected_ids = [i.strip() for i in ids.split(',') if i.strip()]
    selected = [v for v in metadata['videos'] if v['ID'] in selected_ids]
    if not selected:
        print("No valid videos selected.")
        return []
    return selected

def format_metadata_table(video):
    data = [
        ["Title", video.get('title', 'Untitled')],
        ["Filename", video.get('filename', 'N/A')],
        ["Duration", video.get('duration_formatted', 'N/A')],
        ["Resolution", video.get('resolution', 'N/A')],
        ["Size (MB)", str(video.get('size_mb', 'N/A'))],
        ["Upload Date", video.get('upload_date', 'N/A')],
        ["FPS", str(video.get('fps', 'N/A'))],
        ["Frame Count", str(video.get('frame_count', 'N/A'))],
    ]
    table = Table(data, colWidths=[4*cm, 10*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('BACKGROUND', (0, 1), (-1, -1), colors.whitesmoke),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    return table

def format_timestamp(seconds):
    return str(timedelta(seconds=int(seconds)))

def group_words_by_interval(words, interval=30, total_duration=None):
    if not words:
        return []

    # Group words by their respective interval start time
    grouped = defaultdict(list)
    max_time = 0
    
    for word in words:
        try:
            word_start = float(word.get('start', 0))
            # Track the maximum timestamp to ensure we include all content
            max_time = max(max_time, word_start)
            # Calculate the start of the interval this word belongs to
            interval_start = math.floor(word_start / interval) * interval
            grouped[interval_start].append(word)
        except (ValueError, TypeError):
            # Skip words with invalid start times
            continue

    # Determine the last interval to include
    if total_duration is not None:
        last_time = float(total_duration)
    else:
        last_time = max_time
    last_interval_start = math.floor(last_time / interval) * interval

    # Build all intervals from 0 up to last_interval_start
    result_intervals = []
    current = 0
    while current <= last_interval_start:
        word_list = grouped.get(current, [])
        result_intervals.append((current, word_list))
        current += interval

    return result_intervals

def debug_word_structure(words, context=""):
    """Debug function to check word data structure"""
    print(f"DEBUG {context}: Analyzing word structure...")
    
    if not words:
        print(f"DEBUG {context}: No words found in transcript")
        return
    
    print(f"DEBUG {context}: Total words: {len(words)}")
    print(f"DEBUG {context}: First few words structure:")
    for i, word in enumerate(words[:3]):
        print(f"  Word {i}: {word}")
        
    # Check for common issues
    words_with_start = [w for w in words if 'start' in w]
    print(f"DEBUG {context}: Words with 'start' field: {len(words_with_start)}")
    
    if words_with_start:
        try:
            start_times = [float(w.get('start', 0)) for w in words_with_start]
            print(f"DEBUG {context}: Time range: {min(start_times):.2f}s to {max(start_times):.2f}s")
        except (ValueError, TypeError) as e:
            print(f"DEBUG {context}: Error processing start times: {e}")
    else:
        print(f"DEBUG {context}: No start times found in words!")

def generate_pdf_for_video(video, output_dir=VID_PDF_DIR):
    # Use the values from the passed-in video dictionary directly
    transcript = video.get('transcript', {})
    words = transcript.get('words', [])
    pdf_filename = f"video_{video['ID']}_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
    pdf_path = os.path.join(output_dir, pdf_filename)

    doc = SimpleDocTemplate(pdf_path, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    elements = []

    # Add a global title at the top of the PDF
    report_title_style = ParagraphStyle('ReportTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=22, alignment=TA_CENTER, textColor=colors.HexColor('#1a237e'))
    elements.append(Paragraph("Transcription Report", report_title_style))
    elements.append(Spacer(1, 18))

    # Transcript by 30s intervals
    interval_style = ParagraphStyle('Interval', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=14, textColor=colors.HexColor('#1565c0'), spaceAfter=8)
    word_style = ParagraphStyle('Word', parent=styles['Normal'], fontName='Helvetica', fontSize=11, textColor=colors.black, leftIndent=12, spaceAfter=2)
    elements.append(Paragraph("Transcript (30-second intervals):", interval_style))
    elements.append(Spacer(1, 8))

    # Pass duration if available
    duration = video.get('duration')
    intervals = group_words_by_interval(words, interval=30, total_duration=duration)
    for start, word_list in intervals:
        ts = format_timestamp(start)
        elements.append(Paragraph(f"<b>Interval {ts}</b>", interval_style))
        if word_list:
            text = ' '.join([w.get('word', '') for w in word_list])
            elements.append(Paragraph(text, word_style))
        else:
            elements.append(Paragraph("No words in this interval.", word_style))
        elements.append(Spacer(1, 8))

    doc.build(elements)
    print(f"PDF generated: {pdf_path}")

    # Update metadata.json with pdffile field
    metadata_file = METADATA_FILE
    with open(metadata_file, 'r+', encoding='utf-8') as f:
        data = json.load(f)
        for v in data['videos']:
            if str(v['ID']) == str(video['ID']):
                v['pdffile'] = pdf_filename
                break
        f.seek(0)
        json.dump(data, f, indent=2)
        f.truncate()

    return pdf_path

def generate_pdf_for_video_interval(video, start, end, output_dir=VID_PDF_DIR):
    """
    Generate PDF for a specific time interval with improved error handling and debugging
    """
    
    # Validate and convert parameters
    try:
        start = float(start)
        end = float(end)
    except (ValueError, TypeError):
        print(f"ERROR: Invalid start ({start}) or end ({end}) values")
        return None
    
    # Validate range
    if start >= end:
        print(f"ERROR: Invalid range - start ({start}) >= end ({end})")
        return None
    
    if start < 0:
        print(f"ERROR: Start time cannot be negative ({start})")
        return None
    
    # Get transcript data
    transcript = video.get('transcript', {})
    words = transcript.get('words', [])
    
    if not words:
        print(f"ERROR: No words found in transcript for video {video.get('ID')}")
        return None
    
    # Debug info
    print(f"DEBUG: Searching interval {start}s - {end}s for video {video.get('ID')}")
    debug_word_structure(words, f"Video {video.get('ID')}")
    
    # Find words in interval with improved logic
    epsilon = 0.1  # Small buffer for float precision issues
    interval_words = []
    
    for w in words:
        if 'start' not in w:
            continue
            
        try:
            word_start = float(w['start'])
            # Use inclusive range with epsilon buffer
            if (start - epsilon) <= word_start <= (end + epsilon):
                interval_words.append(w)
        except (ValueError, TypeError):
            print(f"WARNING: Invalid start time in word: {w}")
            continue
    
    print(f"DEBUG: Found {len(interval_words)} words in interval {start}-{end}")
    
    # Show sample of found words for debugging
    if interval_words:
        print(f"DEBUG: Sample words found:")
        for i, w in enumerate(interval_words[:5]):
            print(f"  Word {i}: start={w.get('start')}, word='{w.get('word')}'")
        if len(interval_words) > 5:
            print(f"  ... and {len(interval_words) - 5} more words")
    else:
        print("WARNING: No words found in specified interval")
        # Check if there are words nearby
        nearby_words = []
        buffer = 5.0  # Look 5 seconds before and after
        for w in words:
            if 'start' in w:
                try:
                    word_start = float(w['start'])
                    if (start - buffer) <= word_start <= (end + buffer):
                        nearby_words.append(w)
                except (ValueError, TypeError):
                    continue
        
        if nearby_words:
            print(f"DEBUG: Found {len(nearby_words)} words within {buffer}s buffer")
            print("DEBUG: Nearby words:")
            for w in nearby_words[:10]:
                print(f"  start={w.get('start')}, word='{w.get('word')}'")
        else:
            print(f"DEBUG: No words found even in extended range")
    
    # Generate PDF filename
    pdf_filename = f"video_{video['ID']}_interval_{int(start)}_{int(end)}_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
    pdf_path = os.path.join(output_dir, pdf_filename)

    # Create PDF document
    doc = SimpleDocTemplate(pdf_path, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    elements = []

    # Add title
    report_title_style = ParagraphStyle('ReportTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=22, alignment=TA_CENTER, textColor=colors.HexColor('#1a237e'))
    elements.append(Paragraph(f"Transcription Report (Interval: {int(start)}s - {int(end)}s)", report_title_style))
    elements.append(Spacer(1, 18))

    # Add video info
    video_info_style = ParagraphStyle('VideoInfo', parent=styles['Normal'], fontName='Helvetica', fontSize=12, alignment=TA_CENTER, textColor=colors.HexColor('#374151'))
    elements.append(Paragraph(f"Video: {video.get('title', 'Untitled')} (ID: {video.get('ID')})", video_info_style))
    elements.append(Spacer(1, 12))

    # Transcript section
    interval_style = ParagraphStyle('Interval', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=14, textColor=colors.HexColor('#1565c0'), spaceAfter=8)
    word_style = ParagraphStyle('Word', parent=styles['Normal'], fontName='Helvetica', fontSize=11, textColor=colors.black, leftIndent=12, spaceAfter=2)
    elements.append(Paragraph(f"Transcript (from {format_timestamp(start)} to {format_timestamp(end)}):", interval_style))
    elements.append(Spacer(1, 8))

    if interval_words:
        # Group words by time intervals (1-second groups for better readability)
        grouped = defaultdict(list)
        
        for w in interval_words:
            try:
                # Group by 1-second intervals for better readability
                ts_group = int(float(w.get('start', 0)))
                word_text = w.get('word', '').strip()
                if word_text:  # Only add non-empty words
                    grouped[ts_group].append(word_text)
            except (ValueError, TypeError):
                continue
        
        if grouped:
            for ts in sorted(grouped.keys()):
                timestamp = format_timestamp(ts)
                # Join words with proper spacing
                text = ' '.join(grouped[ts])
                if text.strip():  # Only add non-empty text
                    elements.append(Paragraph(f"[{timestamp}] {text}", word_style))
            
            print(f"DEBUG: Added {len(grouped)} time groups to PDF")
        else:
            elements.append(Paragraph("No valid words found in this interval (words may be empty or invalid).", word_style))
            print("DEBUG: No valid words after grouping")
    else:
        elements.append(Paragraph("No words found in this interval.", word_style))
        
        # Add diagnostic information to PDF if no words found
        diagnostic_style = ParagraphStyle('Diagnostic', parent=styles['Normal'], fontName='Helvetica', fontSize=10, textColor=colors.HexColor('#666666'), leftIndent=12, spaceAfter=2)
        elements.append(Spacer(1, 12))
        elements.append(Paragraph("Diagnostic Information:", interval_style))
        elements.append(Paragraph(f"• Requested interval: {start}s - {end}s", diagnostic_style))
        elements.append(Paragraph(f"• Total words in transcript: {len(words)}", diagnostic_style))
        
        if words:
            try:
                words_with_start = [w for w in words if 'start' in w]
                if words_with_start:
                    start_times = [float(w.get('start', 0)) for w in words_with_start]
                    min_time = min(start_times)
                    max_time = max(start_times)
                    elements.append(Paragraph(f"• Transcript time range: {min_time:.2f}s - {max_time:.2f}s", diagnostic_style))
                else:
                    elements.append(Paragraph("• No words have start times", diagnostic_style))
            except Exception as e:
                elements.append(Paragraph(f"• Error analyzing transcript: {str(e)}", diagnostic_style))
    
    elements.append(Spacer(1, 8))

    # Build PDF
    doc.build(elements)
    print(f"PDF generated for interval: {pdf_path}")
    return pdf_path

def main():
    print("\n=== Video PDF Report Generator (Admin Tool) ===\n")
    try:
        metadata = load_metadata()
    except Exception as e:
        print(f"Error loading metadata: {e}")
        return
    selected_videos = select_videos(metadata)
    if not selected_videos:
        return
    for video in selected_videos:
        try:
            generate_pdf_for_video(video)
        except Exception as e:
            print(f"Failed to generate PDF for video {video.get('ID')}: {e}")
    print(f"\nAll PDFs are stored in: {VID_PDF_DIR}\n")

if __name__ == '__main__':
    main()