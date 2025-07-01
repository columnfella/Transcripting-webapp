from video_utils import delete_video, VideoNotFoundError
from flaskApp import app
import click

@app.cli.command("delete-video")
@click.argument("vid", type=int)
def delete_video_command(vid):
    """Delete a video by ID from metadata and filesystem."""
    try:
        result = delete_video(vid)
        click.echo(result)
    except (VideoNotFoundError, FileNotFoundError, ValueError) as e:
        click.echo(f"Error: {e}")
