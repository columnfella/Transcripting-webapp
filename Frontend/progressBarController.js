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
    // Remove all previous markers (both query and contextual)
    bar.querySelectorAll('.progress-marker, .contextual-marker').forEach(marker => marker.remove());

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

// Create markers for contextual chat intervals with color gradient based on position
export function createContextualMarkers(intervals = [], onMarkerClick = null) {
    const progressBar = document.getElementById('progressBar');
    const video = document.getElementById('videoPlayer');
    if (!progressBar || !Array.isArray(intervals) || intervals.length === 0) return;
    const bar = ensureBaseProgressBar();
    if (!bar) return;
    // Remove all previous markers (both query and contextual)
    bar.querySelectorAll('.progress-marker, .contextual-marker').forEach(marker => marker.remove());

    // Helper to get color based on position
    function getMarkerColor(position) {
        // Strong green for position <= 1, fade to gray as position increases
        if (position <= 1) return '#32CD32'; // LimeGreen
        // Interpolate between #32CD32 and #64748b (gray-blue) as position increases
        // Clamp max position for color fade at 5
        const maxPos = 5;
        const t = Math.min((position - 1) / (maxPos - 1), 1);
        // #32CD32 rgb(50,205,50), #64748b rgb(100,116,139)
        const r = Math.round(50 + (100-50)*t);
        const g = Math.round(205 + (116-205)*t);
        const b = Math.round(50 + (139-50)*t);
        return `rgb(${r},${g},${b})`;
    }

    intervals.forEach((interval, idx) => {
        // Calculate proportion for marker placement (use start_time)
        const duration = video && video.duration ? video.duration : (interval.total_duration || 1);
        const proportion = duration > 0 ? (interval.start_time / duration) : 0;
        const marker = document.createElement('div');
        marker.className = 'contextual-marker';
        marker.style.position = 'absolute';
        marker.style.left = `${(proportion * 100).toFixed(2)}%`;
        marker.style.top = '0';
        marker.style.width = '6px';
        marker.style.height = '100%';
        marker.style.background = getMarkerColor(interval.position);
        marker.style.borderRadius = '2px';
        marker.style.cursor = 'pointer';
        marker.style.zIndex = '20';
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
        tooltip.innerHTML = `<b>Interval:</b> ${interval.start_time.toFixed(2)}s - ${interval.end_time.toFixed(2)}s<br><b>Position:</b> ${interval.position}`;
        marker.appendChild(tooltip);

        marker.addEventListener('mouseenter', () => {
            marker.style.background = '#32CD32';
            marker.style.zIndex = '1001';
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateX(-50%) translateY(-4px)';
        });
        marker.addEventListener('mouseleave', () => {
            marker.style.background = getMarkerColor(interval.position);
            marker.style.zIndex = '20';
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateX(-50%) translateY(0)';
        });
        marker.addEventListener('click', () => {
            if (typeof onMarkerClick === 'function') {
                onMarkerClick(interval);
            } else if (video && typeof interval.start_time === 'number') {
                video.currentTime = Math.max(0, interval.start_time - 0.5);
                video.play();
            }
        });
        bar.appendChild(marker);
    });
}

// Helper: interpolate color from dark yellow to light yellow
function getDensityColor(count, maxCount) {
    // Dark yellow: #b7791f (amber-600), Light yellow: #fef9c3 (yellow-100)
    if (maxCount <= 1) return '#fef9c3';
    
    // Invert the t value so higher counts get darker colors (more intense)
    const t = Math.max(0, Math.min(1, 1 - (count / maxCount)));
    
    // Interpolate RGB - dark amber to light yellow
    const dark = [183, 121, 31];  // Dark amber #b7791f
    const light = [254, 249, 195]; // Light yellow #fef9c3
    
    const r = Math.round(dark[0] + (light[0] - dark[0]) * t);
    const g = Math.round(dark[1] + (light[1] - dark[1]) * t);
    const b = Math.round(dark[2] + (light[2] - dark[2]) * t);
    
    return `rgb(${r},${g},${b})`;
}

export function createIntervalDensityMarkers(intervals, videoDuration) {
    const progressBar = document.getElementById('progressBar');
    if (!progressBar || !Array.isArray(intervals) || intervals.length === 0 || !videoDuration) return;
    const bar = ensureBaseProgressBar();
    if (!bar) return;
    
    // Remove ALL previous markers (query, contextual, and interval density)
    bar.querySelectorAll('.progress-marker, .contextual-marker, .interval-density-marker').forEach(marker => marker.remove());

    // Find max count for color scaling
    const maxCount = Math.max(...intervals.map(i => i.count || 0));
    
    // Sort intervals by start time to ensure proper rendering
    const sortedIntervals = [...intervals].sort((a, b) => a.start - b.start);
    
    sortedIntervals.forEach((interval, idx) => {
        if (!interval || !interval.count || interval.count <= 0) return;
        
        const startProp = Math.max(0, Math.min(1, interval.start / videoDuration));
        const endProp = Math.max(0, Math.min(1, interval.end / videoDuration));
        const left = (startProp * 100).toFixed(2) + '%';
        const width = ((endProp - startProp) * 100).toFixed(2) + '%';
        
        const marker = document.createElement('div');
        marker.className = 'interval-density-marker';
        marker.style.position = 'absolute';
        marker.style.left = left;
        marker.style.width = width;
        marker.style.top = '0';
        marker.style.height = '100%';
        marker.style.background = getDensityColor(interval.count, maxCount);
        marker.style.borderRadius = '4px';
        marker.style.cursor = 'pointer';
        marker.style.zIndex = '15';
        marker.style.opacity = '0.9';
        marker.style.transition = 'background 0.2s, opacity 0.2s';
        marker.style.border = '1px solid rgba(0,0,0,0.1)';
        
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
        // Create tooltip content showing only matches and interval
        let tooltipContent = `<b>Matches:</b> ${interval.count}<br><b>Interval:</b> ${formatTime(interval.start)} - ${formatTime(interval.end)}`;
        
        // Add query if available
        if (interval.query) {
            tooltipContent += `<br><br><span style="color:#2563eb;font-weight:600;">"${interval.query}"</span>`;
        }
        
        tooltip.innerHTML = tooltipContent;
        marker.appendChild(tooltip);
        
        // Add click handler to only jump to this interval in the video
        marker.addEventListener('click', () => {
            // Jump to this interval in the video
            const video = document.getElementById('videoPlayer');
            if (video) {
                video.currentTime = interval.start;
                video.play().catch(e => console.warn('Could not autoplay:', e));
            }
        });
        
        marker.addEventListener('mouseenter', () => {
            marker.style.opacity = '1';
            marker.style.transform = 'scaleY(1.1)';
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateX(-50%) translateY(-4px)';
        });
        
        marker.addEventListener('mouseleave', () => {
            marker.style.opacity = '0.9';
            marker.style.transform = 'scaleY(1)';
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateX(-50%) translateY(0)';
        });
        
        bar.appendChild(marker);
    });
}

// Helper function to show translated chunk text with highlighted query
// Make it available globally
window.showTranslatedChunkModal = function(interval, query = '') {
    // Remove any existing modal
    const existingModal = document.querySelector('.translated-chunk-modal');
    if (existingModal) existingModal.remove();

    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'translated-chunk-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(15, 23, 42, 0.75)';
    modal.style.backdropFilter = 'blur(3px)';
    modal.style.zIndex = '5000';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.3s ease-in-out';

    // Create modal content
    const content = document.createElement('div');
    content.className = 'translated-chunk-content';
    content.style.background = '#fff';
    content.style.borderRadius = '12px';
    content.style.padding = '24px';
    content.style.maxWidth = '700px';
    content.style.width = '90%';
    content.style.maxHeight = '80vh';
    content.style.boxShadow = '0 10px 25px rgba(15, 23, 42, 0.2)';
    content.style.transform = 'translateY(20px)';
    content.style.transition = 'transform 0.3s ease-in-out';
    content.style.position = 'relative';

    // Create header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '16px';
    header.style.borderBottom = '1px solid #e2e8f0';
    header.style.paddingBottom = '12px';

    // Create title
    const title = document.createElement('h3');
    title.textContent = `Translated Text (${formatTime(interval.start)} - ${formatTime(interval.end)})`;
    title.style.margin = '0';
    title.style.fontSize = '1.25rem';
    title.style.fontWeight = '600';
    title.style.color = '#1e40af';

    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '1.75rem';
    closeBtn.style.lineHeight = '1';
    closeBtn.style.color = '#64748b';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '0';
    closeBtn.style.marginLeft = '16px';

    // Add elements to header
    header.appendChild(title);
    header.appendChild(closeBtn);

    // Create text container
    const textContainer = document.createElement('div');
    textContainer.style.overflow = 'auto';
    textContainer.style.maxHeight = 'calc(80vh - 120px)';
    textContainer.style.padding = '8px';
    textContainer.style.fontSize = '1.05rem';
    textContainer.style.lineHeight = '1.6';
    textContainer.style.color = '#334155';
    
    // Format and highlight text
    let text = interval.text || 'No text available for this interval';
    
    if (query && query.trim() && text) {
        // Escape special regex characters in the query
        const safeQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Create regex with word boundaries if possible
        const regex = new RegExp(`(${safeQuery})`, 'gi');
        // Replace with highlighted version
        text = text.replace(regex, '<span style="background-color:#fef9c3;font-weight:600;padding:0 2px;border-radius:2px;">$1</span>');
    }
    
    textContainer.innerHTML = text;

    // Add match count if available
    if (interval.count && interval.count > 0) {
        const matchCount = document.createElement('div');
        matchCount.style.marginTop = '16px';
        matchCount.style.padding = '8px 12px';
        matchCount.style.background = '#f1f5f9';
        matchCount.style.borderRadius = '6px';
        matchCount.style.fontSize = '0.95rem';
        matchCount.style.color = '#64748b';
        matchCount.innerHTML = `<span style="color:#2563eb;font-weight:600;">${interval.count}</span> match${interval.count !== 1 ? 'es' : ''} found in this interval`;
        textContainer.appendChild(matchCount);
    }

    // Add elements to content
    content.appendChild(header);
    content.appendChild(textContainer);

    // Add content to modal
    modal.appendChild(content);

    // Add modal to document
    document.body.appendChild(modal);

    // Add event listeners
    closeBtn.addEventListener('click', () => {
        modal.style.opacity = '0';
        content.style.transform = 'translateY(20px)';
        setTimeout(() => modal.remove(), 300);
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.opacity = '0';
            content.style.transform = 'translateY(20px)';
            setTimeout(() => modal.remove(), 300);
        }
    });

    // Trigger animation
    setTimeout(() => {
        modal.style.opacity = '1';
        content.style.transform = 'translateY(0)';
    }, 10);
}