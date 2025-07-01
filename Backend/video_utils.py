import json
import os

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'Uploads')
THUMBNAILS_FOLDER = os.path.join(os.getcwd(), 'thumbnails')
VID_PDF_DIR = os.path.join(SCRIPT_DIR, 'vid_pdfs')


class VideoNotFoundError(Exception):
    """Exception raised when a video with a given ID is not found."""
    pass


def delete_video(vid):
    """Delete a single video by ID"""
    if not isinstance(vid, (str, int)):
        raise ValueError(f"ID must be an integer or a string: {vid}.")

    # Access metadata.json from the same directory as the script
    metadata_file = os.path.join(SCRIPT_DIR, 'metadata.json')
    if not os.path.exists(metadata_file):
        raise FileNotFoundError("metadata.json not found.")

    with open(metadata_file, 'r+') as f:
        data = json.load(f)
        videos = data['videos']

        for i, video in enumerate(videos):
            if str(vid) == str(video['ID']):
                video_info = videos[i]
                del videos[i]
                data['total_uploads'] = int(data['total_uploads']) - 1

                f.seek(0)
                json.dump(data, f, indent=2)
                f.truncate()

                # Delete video file
                video_filename = video_info.get('filename', f'vid{vid}.mp4')
                video_file = os.path.join(UPLOAD_FOLDER, video_filename)
                if os.path.exists(video_file):
                    os.remove(video_file)

                # Delete thumbnail if exists
                thumbnail_filename = video_info.get('thumbnail')
                if thumbnail_filename:
                    thumbnail_file = os.path.join(THUMBNAILS_FOLDER, thumbnail_filename)
                    if os.path.exists(thumbnail_file):
                        os.remove(thumbnail_file)

                # Delete pdf file if exists
                pdf_filename = video_info.get('pdffile')
                if pdf_filename:
                    pdf_file = os.path.join(VID_PDF_DIR, pdf_filename)
                    if os.path.exists(pdf_file):
                        os.remove(pdf_file)

                return f'Deleted video {vid} successfully (including thumbnail and PDF).'

    raise VideoNotFoundError(f"Video with ID {vid} not found in metadata.")


def delete_multiple_videos(video_ids):
    """Delete multiple videos by their IDs"""
    if not isinstance(video_ids, list):
        raise ValueError("video_ids must be a list.")

    if not video_ids:
        return "No video IDs provided."

    deleted_count = 0
    errors = []

    for vid in video_ids:
        try:
            delete_video(vid)
            deleted_count += 1
        except (VideoNotFoundError, ValueError) as e:
            errors.append(f"ID {vid}: {str(e)}")

    result = f"Successfully deleted {deleted_count} video(s)."
    if errors:
        result += f"\nErrors: {'; '.join(errors)}"

    return result


def delete_all_videos():
    """Delete all videos and reset metadata"""
    # Access metadata.json from the same directory as the script
    metadata_file = os.path.join(SCRIPT_DIR, 'metadata.json')
    if not os.path.exists(metadata_file):
        raise FileNotFoundError("metadata.json not found.")

    with open(metadata_file, 'r+') as f:
        data = json.load(f)
        videos = data['videos']

        if not videos:
            return "No videos to delete."

        deleted_count = len(videos)

        # Delete all video files
        for video in videos:
            # Delete video file
            video_filename = video.get('filename', f"vid{video['ID']}.mp4")
            video_file = os.path.join(UPLOAD_FOLDER, video_filename)
            if os.path.exists(video_file):
                os.remove(video_file)

            # Delete thumbnail if exists
            thumbnail_filename = video.get('thumbnail')
            if thumbnail_filename:
                thumbnail_file = os.path.join(THUMBNAILS_FOLDER, thumbnail_filename)
                if os.path.exists(thumbnail_file):
                    os.remove(thumbnail_file)

        # Reset metadata
        data['videos'] = []
        data['total_uploads'] = 0

        f.seek(0)
        json.dump(data, f, indent=2)
        f.truncate()

        return f"Successfully deleted all {deleted_count} videos and thumbnails."


def list_videos():
    """List all videos with their details"""
    # Access metadata.json from the same directory as the script
    metadata_file = os.path.join(SCRIPT_DIR, 'metadata.json')
    if not os.path.exists(metadata_file):
        return "metadata.json not found."

    with open(metadata_file, 'r') as f:
        data = json.load(f)
        videos = data['videos']

        if not videos:
            return "No videos found."

        result = f"Total videos: {len(videos)}\n"
        result += "-" * 60 + "\n"

        for video in videos:
            result += f"ID: {video['ID']} | Title: {video.get('title', 'Untitled')} | "
            result += f"File: {video.get('filename', 'N/A')} | "
            result += f"Duration: {video.get('duration_formatted', 'N/A')}\n"

        return result


def show_menu():
    """Display menu options"""
    print("\n" + "=" * 50)
    print("VIDEO MANAGEMENT ADMIN TOOL")
    print("=" * 50)
    print("1. Delete single video")
    print("2. Delete multiple videos")
    print("3. Delete ALL videos")
    print("4. List all videos")
    print("5. Exit")
    print("-" * 50)


def get_video_ids_input():
    """Get multiple video IDs from user input"""
    print("Enter video IDs separated by commas (e.g., 1,2,3,5):")
    ids_input = input("Video IDs: ").strip()

    if not ids_input:
        return []

    try:
        # Split by comma and clean up whitespace
        video_ids = [id_str.strip() for id_str in ids_input.split(',')]
        return video_ids
    except Exception as e:
        print(f"Error parsing IDs: {e}")
        return []


def main():
    """Main program loop"""
    while True:
        try:
            show_menu()
            choice = input("Choose an option (1-5): ").strip()

            if choice == '1':
                # Delete single video
                vid = input('Enter video ID: ').strip()
                if vid:
                    result = delete_video(vid)
                    print(f"✓ {result}")
                else:
                    print("No ID provided.")

            elif choice == '2':
                # Delete multiple videos
                video_ids = get_video_ids_input()
                if video_ids:
                    print(f"About to delete videos with IDs: {', '.join(video_ids)}")
                    confirm = input("Are you sure? (y/N): ").strip().lower()
                    if confirm == 'y':
                        result = delete_multiple_videos(video_ids)
                        print(f"✓ {result}")
                    else:
                        print("Operation cancelled.")
                else:
                    print("No valid IDs provided.")

            elif choice == '3':
                # Delete all videos
                print("⚠️  WARNING: This will delete ALL videos and thumbnails!")
                confirm = input("Type 'DELETE ALL' to confirm: ").strip()
                if confirm == 'DELETE ALL':
                    result = delete_all_videos()
                    print(f"✓ {result}")
                else:
                    print("Operation cancelled. (Must type exactly 'DELETE ALL')")

            elif choice == '4':
                # List all videos
                result = list_videos()
                print(result)

            elif choice == '5':
                # Exit
                print("Arrivederci.")
                break

            else:
                print("Invalid choice. Please select 1-5.")

            # Ask if user wants to continue (except for exit)
            if choice != '5':
                input("\nPress Enter to continue...")

        except ValueError as e:
            print(f'ValueError: {e}')
        except VideoNotFoundError as e:
            print(f'VideoNotFoundError: {e}')
        except FileNotFoundError as e:
            print(f'FileNotFoundError: {e}')
        except KeyboardInterrupt:
            print("\n\nExiting...")
            break
        except Exception as e:
            print(f'Unexpected error: {e}')


if __name__ == "__main__":
    main()