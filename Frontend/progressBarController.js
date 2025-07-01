import { transcriptionData, findWordInstances } from './transcriptProcessor.js';

// Store current query globally for display
let currentQuery = '';

// Format time in seconds to HH:MM:SS or MM:SS format
function formatTime(seconds) {
    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

// Create or get the base progress bar (without markers)
function ensureBaseProgressBar() {
    const progressBar = document.getElementById('progressBar');
    if (!progressBar) return null;
    let bar = progressBar.querySelector('.plain-progress-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.className = 'plain-progress-bar';
        bar.style.position = 'relative';
        bar.style.width = 'calc(100% - 64px)';
        bar.style.marginLeft = '32px';
        bar.style.marginRight = '32px';
        bar.style.height = '18px';
        bar.style.background = 'linear-gradient(90deg,#2563eb,#1e40af)';
        bar.style.borderRadius = '8px';
        bar.style.marginTop = '0';
        bar.style.marginBottom = '0';
        bar.style.overflow = 'visible';
        progressBar.appendChild(bar);
    }
    return bar;
}

export function createProgressBarWithMarkers(query = '', transcriptOverride = null) {
    const progressBar = document.getElementById('progressBar');
    const video = document.getElementById('videoPlayer');
    // Use the provided transcript if given, otherwise fall back to transcriptionData
    const transcript = transcriptOverride || transcriptionData;
    if (!progressBar || !transcript || !transcript.words) return;
    currentQuery = query.trim();
    // Only remove old markers, not the bar itself
    const bar = ensureBaseProgressBar();
    if (!bar) return;
    // Remove all previous markers
    bar.querySelectorAll('.progress-marker').forEach(marker => marker.remove());

    // Find all word matches
    let matches = [];
    if (currentQuery) {
        try {
            matches = findWordInstances(transcript, currentQuery);
        } catch (e) {
            matches = [];
        }
    }

    // Render markers for each match
    matches.forEach((item, idx) => {
        const marker = document.createElement('div');
        marker.className = 'progress-marker';
        marker.style.position = 'absolute';
        marker.style.left = `${(item.proportion * 100).toFixed(2)}%`;
        marker.style.top = '0';
        // Marker width proportional to phrase length
        const markerWidth = Math.max(3, (item.length || 1) * 3);
        marker.style.width = markerWidth + 'px';
        marker.style.height = '100%';
        marker.style.background = '#fbbf24';
        marker.style.borderRadius = '2px';
        marker.style.cursor = 'pointer';
        marker.style.zIndex = '10';
        marker.style.transition = 'background 0.2s';

        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'marker-tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.bottom = '24px';
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translateX(-50%)';
        tooltip.style.background = 'rgba(0,0,0,0.92)';
        tooltip.style.color = 'white';
        tooltip.style.padding = '8px 14px';
        tooltip.style.borderRadius = '7px';
        tooltip.style.fontSize = '13px';
        tooltip.style.whiteSpace = 'nowrap';
        tooltip.style.opacity = '0';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.transition = 'opacity 0.2s, transform 0.2s';
        tooltip.style.zIndex = '1000';
        tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
        tooltip.innerHTML = `<b>Phrase:</b> ${item.word}<br><b>Time:</b> ${formatTime(item.start)}<br><b>Position:</b> ${(item.proportion*100).toFixed(1)}%`;
        marker.appendChild(tooltip);

        marker.addEventListener('mouseenter', () => {
            marker.style.background = '#32CD32';
            marker.style.zIndex = '1001';
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateX(-50%) translateY(-4px)';
        });
        marker.addEventListener('mouseleave', () => {
            marker.style.background = '#fbbf24';
            marker.style.zIndex = '10';
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateX(-50%) translateY(0)';
        });
        marker.addEventListener('click', () => {
            if (video && typeof item.start === 'number') {
                video.currentTime = Math.max(0, item.start - 0.5);
            }
        });
        bar.appendChild(marker);
    });
}

// Function to update progress bar when search query changes
export function updateProgressBarWithQuery(query, transcriptOverride = null) {
    createProgressBarWithMarkers(query, transcriptOverride);
}

// Initialize progress bar on load
// Only create the base bar, no markers

document.addEventListener('DOMContentLoaded', () => {
    ensureBaseProgressBar();
});