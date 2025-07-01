import {addMessage, showLoadingMessage} from "./chatController.js";
import {findWordInstances} from "./transcriptProcessor.js";
import {updateProgressBarWithQuery} from "./progressBarController.js";

console.log("Utilities module loaded");

// Global variable for detailed transcript and video
export let detailedTranscriptBundle = null;

export function _dispatchLogEvent(ev) {
    window.dispatchEvent(ev);
    console.log("Dispatching event:", ev);
}

export function clearTextBox(textBox) {
    textBox.value = "";
}

// DEBUG VERSION FOR ASYNC VIDEO UPLOAD FLOW
export function sendVideo(file, videoTitle) {
    console.log("🚨 DEBUG: sendVideo called!");
    console.log("🚨 DEBUG: File parameter:", file);
    console.log("🚨 DEBUG: Title parameter:", videoTitle);
    console.trace("🚨 DEBUG: Call stack:");

    // Validate inputs
    if (!file) {
        console.log("🚨 DEBUG: No file provided, rejecting");
        return Promise.reject(new Error('No file provided'));
    }

    if (!videoTitle || typeof videoTitle !== 'string' || videoTitle.trim() === '') {
        console.log("🚨 DEBUG: Invalid title, rejecting");
        return Promise.reject(new Error('Valid video title is required'));
    }

    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', videoTitle.trim());

    console.log("🚨 DEBUG: FormData created, sending to server...");

    // Return a promise so the caller can await the backend response
    return fetch('http://127.0.0.1:5000/upload-video', {
        method: 'POST',
        body: formData,
    })
        .then(async response => {
            console.log("🚨 DEBUG: Server response received:", response.status);
            if (!response.ok) {
                // Try to parse error message from backend
                let errorMsg = 'Upload failed';
                try {
                    const err = await response.json();
                    errorMsg = err.error || errorMsg;
                } catch {}
                throw new Error(errorMsg);
            }
            return response.json();
        });
}

let isProcessing = false;

export function handleMessageSend(input, systemReply = true) {
    const text = input.value.trim();
    if (!text) return;
    if (isProcessing) {
        alert("Please wait until the current request is finished.");
        return;
    }
    isProcessing = true;
    addMessage(text, 'user');
    const loading = showLoadingMessage();
    // Only search in the loaded transcript, do not request from backend
    const transcriptToUse = detailedTranscriptBundle?.transcript;
    if (!transcriptToUse || !transcriptToUse.words || !Array.isArray(transcriptToUse.words) || transcriptToUse.words.length === 0) {
        loading.stop();
        loading.element.remove();
        addMessage("No transcript loaded. Please load a video first.", 'system');
        isProcessing = false;
        return;
    }
    if (systemReply) {
        setTimeout(() => {
            loading.stop();
            try {
                let instanceResults = findWordInstances(transcriptToUse, text);
                if (!Array.isArray(instanceResults) || instanceResults.length === 0) {
                    loading.element.remove();
                    addMessage("No match was found.", 'system');
                    isProcessing = false;
                    return;
                }
                const totalInstances = instanceResults.length;
                if (totalInstances === 0) {
                    loading.element.remove();
                    addMessage("No match was found.", 'system');
                    isProcessing = false;
                    return;
                }
                updateProgressBarWithQuery(text, detailedTranscriptBundle.transcript);
                loading.element.remove();
                // --- Custom: Add Show Details button and details logic ---
                const msg = `Found ${totalInstances} instance${totalInstances !== 1 ? 's' : ''} of "${text}".`;
                const messageDiv = addMessage(msg, 'system');
                // Create Show Details button
                const detailsBtn = document.createElement('button');
                detailsBtn.textContent = 'Show Details';
                detailsBtn.style.marginTop = '8px';
                detailsBtn.style.display = 'block';
                detailsBtn.style.background = '#2563eb';
                detailsBtn.style.color = 'white';
                detailsBtn.style.border = 'none';
                detailsBtn.style.borderRadius = '6px';
                detailsBtn.style.padding = '6px 16px';
                detailsBtn.style.fontSize = '0.95rem';
                detailsBtn.style.cursor = 'pointer';
                detailsBtn.style.marginLeft = 'auto';
                detailsBtn.style.marginRight = 'auto';
                // Details container (hidden by default)
                const detailsDiv = document.createElement('div');
                detailsDiv.style.display = 'none';
                detailsDiv.style.marginTop = '10px';
                detailsDiv.style.background = 'linear-gradient(135deg, #2563eb22 60%, #1e40af11 100%)';
                detailsDiv.style.border = '2px solid #2563eb';
                detailsDiv.style.borderRadius = '12px';
                detailsDiv.style.padding = '14px 18px 14px 18px';
                detailsDiv.style.fontSize = '1.01rem';
                detailsDiv.style.color = '#1e293b';
                detailsDiv.style.boxShadow = '0 2px 12px rgba(30,64,175,0.10)';
                detailsDiv.style.fontFamily = 'Segoe UI, Roboto, Arial, sans-serif';
                detailsDiv.style.maxHeight = '220px';
                detailsDiv.style.overflowY = 'auto';
                detailsDiv.style.marginLeft = 'auto';
                detailsDiv.style.marginRight = 'auto';
                detailsDiv.style.width = '95%';
                // Build details list
                let html = '<b style="color:#2563eb;">Instances:</b><ul style="margin:10px 0 0 0;padding-left:22px;">';
                instanceResults.forEach((inst, idx) => {
                    html += `<li style='margin-bottom:6px;'><span style='font-weight:600;color:#fff;'>${inst.word}</span> <span style='color:#64748b;'>at</span> <span style='color:#2563eb;font-weight:600;'>${formatDuration(inst.start)}</span></li>`;
                });
                html += '</ul>';
                detailsDiv.innerHTML = html;
                // Toggle logic
                detailsBtn.addEventListener('click', () => {
                    if (detailsDiv.style.display === 'none') {
                        detailsDiv.style.display = 'block';
                        detailsBtn.textContent = 'Hide Details';
                    } else {
                        detailsDiv.style.display = 'none';
                        detailsBtn.textContent = 'Show Details';
                    }
                });
                // Append button and details to message
                messageDiv.appendChild(detailsBtn);
                messageDiv.appendChild(detailsDiv);
                // --- End custom ---
                isProcessing = false;
            } catch (error) {
                loading.element.remove();
                addMessage("Invalid search query. Please use only letters, spaces, and basic accented characters.", 'system');
                isProcessing = false;
                console.warn('Search processing failed:', error.message);
            }
        }, 1000);
    }
}

export const videoData = [
    {
        id: 1,
        title: "Business Meeting Analysis",
        duration: "12:45",
        uploadDate: "2025-06-20T14:30:00Z",
        size: "245 MB",
        speakers: 3
    },
    {
        id: 2,
        title: "Marketing Strategy Session",
        duration: "08:22",
        uploadDate: "2025-06-18T10:15:00Z",
        size: "168 MB",
        speakers: 2
    },
    {
        id: 3,
        title: "Product Demo Recording",
        duration: "22:15",
        uploadDate: "2025-06-15T09:45:00Z",
        size: "432 MB",
        speakers: 1
    }
];

// Format date for display
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Character limit for video titles
const TITLE_CHARACTER_LIMIT = 50;

// Create a video card element
export function createVideoCard(video) {
    // Use backend metadata format
    const card = document.createElement('div');
    card.className = 'video-card';
    card.dataset.id = video.ID || video.id;

    // Compose fields from backend format (only show required fields)
    const title = video.title || video.filename || 'Untitled';
    const duration = video.duration_formatted || (video.duration ? `${Math.floor(video.duration/60)}:${String(Math.floor(video.duration%60)).padStart(2,'0')}` : 'N/A');
    // Robust upload date and size parsing
    let uploadDate = 'N/A';
    if (typeof video.upload_date === 'string' && video.upload_date.trim()) {
        const d = new Date(video.upload_date);
        if (!isNaN(d.getTime())) uploadDate = d.toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'});
        else { console.warn('Invalid upload_date:', video.upload_date, video); }
    } else {
        console.warn('Missing upload_date:', video);
    }
    let size = 'N/A';
    if (typeof video.size_mb === 'number' && !isNaN(video.size_mb)) {
        size = `${video.size_mb.toFixed(2)} MB`;
    } else if (typeof video.size_mb === 'string' && !isNaN(parseFloat(video.size_mb))) {
        size = `${parseFloat(video.size_mb).toFixed(2)} MB`;
    } else if (video.size) {
        size = video.size;
    } else {
        console.warn('Missing size_mb:', video);
    }
    const resolution = video.resolution || 'N/A';
    // Asynchronous thumbnail loading
    const thumbnailName = video.thumbnail;

    card.innerHTML = `
        <div class="video-thumbnail">
          <span class="thumbnail-placeholder"><i class="fas fa-play-circle"></i></span>
          <!-- Icon-only edit/delete buttons stacked vertically -->
          <div class="video-top-actions" style="display:flex;flex-direction:column;gap:8px;justify-content:flex-start;align-items:flex-end;position:absolute;top:38px;right:10px;z-index:11;">
            <button class="edit-title-btn" title="Edit Title" style="background:rgba(59,130,246,0.9);color:white;border:none;border-radius:50%;padding:7px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;opacity:0.95;"><i class="fas fa-pencil-alt"></i></button>
            <button class="delete-btn" title="Delete Video" style="background:rgba(239,68,68,0.95);color:white;border:none;border-radius:50%;padding:7px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;opacity:0.95;"><i class="fas fa-trash"></i></button>
          </div>
          <button class="detailed-search-btn">
            <i class="fas fa-search"></i>
            <span>Detailed Search</span>
          </button>
          <div class="video-overlay">
            <div>
              <div class="video-title-container">
                <h3 class="video-title">${title}</h3>
              </div>
            </div>
          </div>
        </div>
        <div class="video-content">
          <div class="video-meta">
            <div class="video-info"><i class="fas fa-calendar-alt"></i> <span>Uploaded: ${uploadDate}</span></div>
            <div class="video-info"><i class="fas fa-clock"></i> <span>Duration: ${duration}</span></div>
            <div class="video-info"><i class="fas fa-expand"></i> <span>Resolution: ${resolution}</span></div>
            <div class="video-info"><i class="fas fa-file"></i> <span>Size: ${size}</span></div>
          </div>
          <div class="video-actions">
            <button class="action-button preview-button"><i class="fas fa-eye"></i> Preview Transcript</button>
            <button class="action-button download-button"><i class="fas fa-download"></i> Download Transcript</button>
          </div>
        </div>
      `;

    // Load thumbnail asynchronously and handle errors
    if (thumbnailName) {
        loadThumbnail(thumbnailName).then(url => {
            if (url) {
                const thumbImg = document.createElement('img');
                thumbImg.src = url;
                thumbImg.alt = 'Thumbnail';
                thumbImg.style.width = '100%';
                thumbImg.style.height = '100%';
                thumbImg.style.objectFit = 'cover';
                thumbImg.style.borderRadius = '8px 8px 0 0';
                const thumbContainer = card.querySelector('.video-thumbnail');
                const placeholder = thumbContainer.querySelector('.thumbnail-placeholder');
                if (placeholder) placeholder.replaceWith(thumbImg);
                else thumbContainer.prepend(thumbImg);
            } else {
                showNotification('Could not load video thumbnail.', 'error');
            }
        }).catch(() => {
            showNotification('Could not load video thumbnail.', 'error');
        });
    }

    // Move edit/delete/preview/download button event wiring to new location
    const editBtn = card.querySelector('.edit-title-btn');
    const deleteBtn = card.querySelector('.delete-btn');
    const previewBtn = card.querySelector('.preview-button');
    const downloadBtn = card.querySelector('.download-button');
    const titleElement = card.querySelector('.video-title');

    // DETAILED SEARCH BUTTON HANDLER
    const detailedSearchBtn = card.querySelector('.detailed-search-btn');
    if (detailedSearchBtn) {
        detailedSearchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            goToDetailedSearch(video.ID || video.id);
        });
    }

    // REMOVE previewBtn and downloadBtn event listeners from here
    return card;
}

// Modern PDF overlay modal
export function showPdfOverlay(pdfUrl, title = 'PDF Preview') {
    // Remove any existing overlay
    const existing = document.querySelector('.pdf-modal-backdrop');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.className = 'pdf-modal-backdrop';
    modal.innerHTML = `
      <div class="pdf-modal-content">
        <div class="pdf-modal-header">
          <span class="pdf-modal-title">${title}</span>
          <button class="pdf-modal-close" title="Close">&times;</button>
        </div>
        <iframe src="${pdfUrl}" class="pdf-modal-iframe" frameborder="0"></iframe>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.pdf-modal-close').onclick = () => modal.remove();
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// Show modal for transcript interval selection
export function showTranscriptIntervalModal(video) {
    return new Promise((resolve) => {
        // Remove any existing modal
        const existing = document.querySelector('.interval-modal-backdrop');
        if (existing) existing.remove();
        // Duration in seconds
        const duration = video.duration || (video.duration_formatted ? (
            video.duration_formatted.split(':').reduce((acc, t) => 60 * acc + +t, 0)
        ) : 0);
        // Modal HTML
        const modal = document.createElement('div');
        modal.className = 'interval-modal-backdrop';
        modal.style = `position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.75);z-index:3000;display:flex;align-items:center;justify-content:center;`;
        modal.innerHTML = `
          <div class="interval-modal-content" style="background:#111c2e;padding:32px 28px 24px 28px;border-radius:16px;min-width:420px;max-width:600px;box-shadow:0 8px 32px rgba(30,64,175,0.18);text-align:center;display:flex;flex-direction:column;align-items:center;">
            <h2 style="color:#3b82f6;font-size:1.2rem;font-weight:700;margin-bottom:22px;">Select Transcript Interval</h2>
            <div style="width:100%;margin-bottom:24px;">
              <div style="display:flex;justify-content:space-between;font-size:15px;color:#60a5fa;margin-bottom:2px;font-weight:700;">
                <span id="sliderStartLabel">00:00</span>
                <span id="sliderEndLabel">${formatDuration(duration)}</span>
              </div>
              <div style="position:relative;width:100%;height:64px;">
                <div id="sliderTrack" style="position:absolute;top:32px;left:0;right:0;height:6px;background:linear-gradient(90deg,#2563eb,#1e40af);border-radius:3px;"></div>
                <div id="sliderRange" style="position:absolute;top:32px;height:6px;background:linear-gradient(90deg,#f87171,#fbbf24);border-radius:3px;"></div>
                <div id="handleStart" class="slider-handle" style="position:absolute;top:18px;width:12px;height:32px;background:#fbbf24;border:2.5px solid #f87171;border-radius:6px;cursor:pointer;z-index:2;box-shadow:0 2px 8px #f8717155;"></div>
                <div id="handleEnd" class="slider-handle" style="position:absolute;top:18px;width:12px;height:32px;background:#f87171;border:2.5px solid #fbbf24;border-radius:6px;cursor:pointer;z-index:2;box-shadow:0 2px 8px #fbbf2455;"></div>
                <div id="handleStartTime" style="position:absolute;top:54px;font-size:13px;color:#fff;font-weight:600;left:0;transform:translateX(-50%);"></div>
                <div id="handleEndTime" style="position:absolute;top:54px;font-size:13px;color:#fff;font-weight:600;right:0;transform:translateX(-50%);"></div>
              </div>
            </div>
            <div style="margin-bottom:18px;display:flex;align-items:center;justify-content:center;gap:10px;">
              <input type="checkbox" id="fullTranscriptCheck" style="appearance:none;width:22px;height:22px;border:2px solid #3b82f6;border-radius:6px;vertical-align:middle;outline:none;box-shadow:0 1px 4px #1e40af33;position:relative;background:#19223a;cursor:pointer;display:inline-block;margin:0;">
              <label for="fullTranscriptCheck" style="color:#cbd5e1;font-size:15px;vertical-align:middle;cursor:pointer;margin:0;">Full transcript</label>
            </div>
            <div style="display:flex;gap:18px;justify-content:center;">
              <button class="modal-btn cancel-btn" style="background:#1e293b;color:#60a5fa;border-radius:6px;padding:10px 22px;font-size:1rem;border:1.5px solid #3b82f6;">Cancel</button>
              <button class="modal-btn confirm-btn" style="background:linear-gradient(90deg,#2563eb,#3b82f6);color:white;border-radius:6px;padding:10px 22px;font-size:1rem;border:1.5px solid #2563eb;box-shadow:0 2px 8px #2563eb55;transition:background 0.2s;">Confirm</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        // Slider logic
        const track = modal.querySelector('#sliderTrack');
        const range = modal.querySelector('#sliderRange');
        const handleStart = modal.querySelector('#handleStart');
        const handleEnd = modal.querySelector('#handleEnd');
        const handleStartTime = modal.querySelector('#handleStartTime');
        const handleEndTime = modal.querySelector('#handleEndTime');
        const startLabel = modal.querySelector('#sliderStartLabel');
        const endLabel = modal.querySelector('#sliderEndLabel');
        const fullCheck = modal.querySelector('#fullTranscriptCheck');
        const confirmBtn = modal.querySelector('.confirm-btn');
        const cancelBtn = modal.querySelector('.cancel-btn');
        // Slider state
        let min = 0;
        let max = duration;
        let start = 0;
        let end = duration;
        // Position handles
        function updateHandles() {
            const trackRect = track.getBoundingClientRect();
            const width = trackRect.width;
            const left = 0;
            const right = width;
            const startX = left + (start / max) * width;
            const endX = left + (end / max) * width;
            handleStart.style.left = `${startX - 6}px`;
            handleEnd.style.left = `${endX - 6}px`;
            range.style.left = `${startX}px`;
            range.style.width = `${endX - startX}px`;
            handleStartTime.style.left = `${startX}px`;
            handleStartTime.textContent = formatDuration(start);
            handleEndTime.style.left = `${endX}px`;
            handleEndTime.textContent = formatDuration(end);
        }
        // Drag logic
        let dragging = null;
        function onMouseMove(e) {
            const trackRect = track.getBoundingClientRect();
            const width = trackRect.width;
            let x = (e.touches ? e.touches[0].clientX : e.clientX) - trackRect.left;
            x = Math.max(0, Math.min(width, x));
            let value = (x / width) * max;
            value = Math.round(value);
            if (dragging === 'start') {
                if (value > end) value = end;
                start = value;
            } else if (dragging === 'end') {
                if (value < start) value = start;
                end = value;
            }
            updateHandles();
        }
        function onMouseUp() {
            dragging = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('touchmove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('touchend', onMouseUp);
        }
        handleStart.addEventListener('mousedown', () => { dragging = 'start'; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); });
        handleEnd.addEventListener('mousedown', () => { dragging = 'end'; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); });
        handleStart.addEventListener('touchstart', () => { dragging = 'start'; document.addEventListener('touchmove', onMouseMove); document.addEventListener('touchend', onMouseUp); }, {passive:false});
        handleEnd.addEventListener('touchstart', () => { dragging = 'end'; document.addEventListener('touchmove', onMouseMove); document.addEventListener('touchend', onMouseUp); }, {passive:false});
        // Checkbox disables slider
        fullCheck.addEventListener('change', () => {
            const disabled = fullCheck.checked;
            handleStart.style.pointerEvents = handleEnd.style.pointerEvents = disabled ? 'none' : 'auto';
            handleStart.style.opacity = handleEnd.style.opacity = disabled ? 0.5 : 1;
            range.style.background = disabled ? '#64748b' : 'linear-gradient(90deg,#f87171,#fbbf24)';
        });
        // Confirm
        confirmBtn.addEventListener('click', () => {
            const full = fullCheck.checked;
            modal.remove();
            resolve({ full, start, end });
        });
        // Cancel
        cancelBtn.addEventListener('click', () => {
            modal.remove();
            resolve(null);
        });
        // Initial
        updateHandles();
        window.addEventListener('resize', updateHandles);
        setTimeout(updateHandles, 100); // Ensure correct on open

        // Custom checkmark styling
        setTimeout(() => {
            const cb = modal.querySelector('#fullTranscriptCheck');
            if (cb) {
                cb.addEventListener('change', function() {
                    if (this.checked) {
                        this.style.background = 'linear-gradient(135deg,#2563eb 60%,#3b82f6 100%)';
                        this.style.borderColor = '#2563eb';
                        this.style.boxShadow = '0 2px 8px #2563eb55';
                        this.style.backgroundImage += ',url("data:image/svg+xml;utf8,<svg width=\'18\' height=\'18\' viewBox=\'0 0 18 18\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'><path d=\'M4 9.5L8 13.5L14 5.5\' stroke=\'white\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/></svg>")';
                        this.style.backgroundRepeat = 'no-repeat';
                        this.style.backgroundPosition = 'center';
                    } else {
                        this.style.background = '#19223a';
                        this.style.borderColor = '#3b82f6';
                        this.style.boxShadow = '0 1px 4px #1e40af33';
                        this.style.backgroundImage = '';
                    }
                });
            }
        }, 0);
    });
}

function formatDuration(seconds) {
    seconds = Math.round(seconds);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Update previewTranscript to preview PDF with interval selection
export async function previewTranscript(video) {
    try {
        const interval = await showTranscriptIntervalModal(video);
        if (!interval) return;
        let pdfUrl;
        if (interval.full) {
        if (!video.pdffile) throw new Error('No PDF available for this video');
            pdfUrl = `http://127.0.0.1:5000/pdf/${video.pdffile}`;
        } else {
            // Request interval PDF from backend
            const res = await fetch(`http://127.0.0.1:5000/pdf-interval/${video.ID || video.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ start: interval.start, end: interval.end })
            });
            if (!res.ok) throw new Error('Failed to generate interval PDF');
            const data = await res.json();
            pdfUrl = `http://127.0.0.1:5000/pdf/${data.pdffile}`;
        }
        showPdfOverlay(pdfUrl, video.title || 'PDF Preview');
    } catch (err) {
        showNotification('Error loading PDF: ' + (err.message || err), 'error');
        throw err;
    }
}

// Update downloadTranscript to download PDF with interval selection
export async function downloadTranscript(video) {
    try {
        const interval = await showTranscriptIntervalModal(video);
        if (!interval) return;
        let pdfUrl;
        if (interval.full) {
        if (!video.pdffile) throw new Error('No PDF available for this video');
            pdfUrl = `http://127.0.0.1:5000/pdf/${video.pdffile}`;
        } else {
            // Request interval PDF from backend
            const res = await fetch(`http://127.0.0.1:5000/pdf-interval/${video.ID || video.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ start: interval.start, end: interval.end })
            });
            if (!res.ok) throw new Error('Failed to generate interval PDF');
            const data = await res.json();
            pdfUrl = `http://127.0.0.1:5000/pdf/${data.pdffile}`;
        }
        const res = await fetch(pdfUrl);
        if (!res.ok) throw new Error('Failed to download PDF');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = pdfUrl.split('/').pop();
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showNotification('PDF downloaded!', 'success');
    } catch (err) {
        showNotification('Error downloading PDF: ' + (err.message || err), 'error');
        throw err;
    }
}

// REQUEST FUNCTION: DELETE VIDEO
export async function deleteVideo(videoId) {
    try {
        const res = await fetch(`http://127.0.0.1:5000/delete-video/${videoId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete video');
        showNotification('Video deleted!', 'success');
        return true;
    } catch (err) {
        showNotification('Error deleting video: ' + (err.message || err), 'error');
        return false;
    }
}

// REQUEST FUNCTION: EDIT VIDEO TITLE
export async function sendEditVideoTitle(videoId, newTitle) {
    try {
        const res = await fetch('http://127.0.0.1:5000/edit-video-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: videoId, title: newTitle })
        });
        if (!res.ok) throw new Error('Failed to update video title');
        showNotification('Title updated!', 'success');
        return await res.json();
    } catch (err) {
        showNotification('Error updating title: ' + (err.message || err), 'error');
        throw err;
    }
}

// IMPROVED CONFIRMATION DIALOG WITH COLOR SCHEME
export function showConfirmDialog(message, confirmText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
          <div class="confirm-dialog" style="background: #f9fafb; border-radius: 12px; padding: 32px 32px 24px 32px; min-width: 340px; max-width: 400px; box-shadow: 0 8px 32px rgba(30,64,175,0.10); text-align: center; border: 1.5px solid #3b82f6;">
            <div class="confirm-icon" style="font-size: 40px; color: #3b82f6; margin-bottom: 12px;"><i class="fas fa-exclamation-triangle"></i></div>
            <h2 class="confirm-title" style="margin: 0 0 12px 0; color: #1e40af; font-size: 1.1rem; font-weight: 600;">Confirm Action</h2>
            <p class="confirm-message" style="margin: 0 0 20px 0; color: #374151; font-size: 1rem; line-height: 1.5;">${message}</p>
            <div class="modal-buttons" style="display: flex; gap: 18px; justify-content: center; margin-top: 18px;">
              <button class="modal-btn cancel-btn" style="background: #e0e7ef; color: #1e40af; border-radius: 6px; padding: 10px 22px; font-size: 1rem; border: 1px solid #cbd5e1;">${cancelText}</button>
              <button class="modal-btn confirm-btn" style="background: #3b82f6; color: white; border-radius: 6px; padding: 10px 22px; font-size: 1rem; border: 1px solid #2563eb;">${confirmText}</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        const confirmBtn = modal.querySelector('.confirm-btn');
        const cancelBtn = modal.querySelector('.cancel-btn');
        confirmBtn.addEventListener('click', () => { modal.remove(); resolve(true); });
        cancelBtn.addEventListener('click', () => { modal.remove(); resolve(false); });
        modal.addEventListener('click', (e) => { if (e.target === modal) { modal.remove(); resolve(false); } });
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
                resolve(false);
            }
        });
    });
}

export function showNamePrompt(videoId = null, currentTitle = '') {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
          <div class="name-prompt">
            <h2 class="modal-title">${videoId ? 'Edit Video Title' : 'Name Your Video'}</h2>
            <input type="text" class="name-input" value="${currentTitle}" placeholder="Enter video name" maxlength="${TITLE_CHARACTER_LIMIT}">
            <div class="character-counter">
              <span class="current-count">${currentTitle.length}</span>/${TITLE_CHARACTER_LIMIT}
            </div>
            <div class="modal-buttons">
              <button class="modal-btn cancel-btn">Cancel</button>
              <button class="modal-btn confirm-btn">Confirm</button>
            </div>
          </div>
        `;

        document.body.appendChild(modal);

        const input = modal.querySelector('.name-input');
        const currentCount = modal.querySelector('.current-count');
        const counter = modal.querySelector('.character-counter');

        input.value = currentTitle;
        input.focus();
        input.select();

        // Update character counter on input
        input.addEventListener('input', () => {
            const length = input.value.length;
            currentCount.textContent = length;

            // Change color when approaching limit
            if (length > TITLE_CHARACTER_LIMIT * 0.8) {
                counter.style.color = '#ef4444';
            } else {
                counter.style.color = '#6b7280';
            }
        });

        const confirmBtn = modal.querySelector('.confirm-btn');
        const cancelBtn = modal.querySelector('.cancel-btn');

        // Handle confirm button
        confirmBtn.addEventListener('click', () => {
            const newTitle = input.value.trim();
            if (newTitle) {
                if (newTitle.length > TITLE_CHARACTER_LIMIT) {
                    input.style.borderColor = '#ef4444';
                    counter.style.color = '#ef4444';
                    setTimeout(() => {
                        input.style.borderColor = '';
                    }, 1000);
                    return;
                }
                modal.remove();
                resolve(newTitle);
            } else {
                input.style.borderColor = '#ef4444';
                setTimeout(() => {
                    input.style.borderColor = '';
                }, 1000);
            }
        });

        // Handle cancel button
        cancelBtn.addEventListener('click', () => {
            modal.remove();
            resolve(null);
        });

        // Handle Enter key
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmBtn.click();
            }
        });
    });
}

export function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '14px 24px';
    notification.style.color = 'white';
    notification.style.borderRadius = '10px';
    notification.style.zIndex = '1000';
    notification.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)';
    notification.style.animation = 'fadeIn 0.3s, fadeOut 0.3s 2.7s';

    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#10b981';
            break;
        case 'error':
            notification.style.backgroundColor = '#ef4444';
            break;
        case 'warning':
            notification.style.backgroundColor = '#f59e0b';
            break;
        default:
            notification.style.backgroundColor = '#1e40af';
    }

    document.body.appendChild(notification);

    // Remove notification after animation
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// LOAD THUMBNAIL FUNCTION
export async function loadThumbnail(thumbnailName) {
    if (!thumbnailName) return '';
    try {
        const res = await fetch(`http://127.0.0.1:5000/thumbnails/${thumbnailName}`);
        if (!res.ok) throw new Error('Failed to load thumbnail');
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    } catch (err) {
        showNotification('Error loading thumbnail: ' + (err.message || err), 'error');
        return '';
    }
}

// DELETE VIDEO TITLE FUNCTION
export async function deleteVideoTitle(videoId) {
    try {
        const res = await fetch('http://127.0.0.1:5000/delete-video-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: videoId })
        });
        if (!res.ok) throw new Error('Failed to delete video title');
        showNotification('Video title deleted!', 'success');
        return true;
    } catch (err) {
        showNotification('Error deleting video title: ' + (err.message || err), 'error');
        return false;
    }
}

// Attach delete and edit button listeners to a video card
export function attachCardButtonListeners(card, video) {
    const deleteBtn = card.querySelector('.delete-btn');
    const editBtn = card.querySelector('.edit-title-btn');
    const titleElement = card.querySelector('.video-title');
    // DELETE VIDEO HANDLER
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const confirmed = await showConfirmDialog(
                `Are you sure you want to delete "${video.title || video.filename || 'Untitled'}"?`,
                'Delete',
                'Cancel'
            );
            if (confirmed) {
                const success = await deleteVideo(video.ID || video.id);
                if (success) card.remove();
            }
        });
    }
    // EDIT TITLE HANDLER
    if (editBtn) {
        editBtn.addEventListener('click', async () => {
            const newTitle = await showNamePrompt(video.ID || video.id, video.title || video.filename || 'Untitled');
            if (newTitle === null) return;
            if (typeof newTitle === 'string' && newTitle.trim() === '') {
                showNotification(`Please enter a valid title.`, 'error');
                return;
            }
            if (typeof newTitle === 'string') {
                if (newTitle.length > 50) {
                    showNotification(`Title exceeds 50 character limit. Current length: ${newTitle.length}`, 'error');
                    return;
                }
                try {
                    await sendEditVideoTitle(video.ID || video.id, newTitle);
                    if (titleElement) titleElement.textContent = newTitle;
                    video.title = newTitle;
                    showNotification(`Title updated to "${newTitle}"`, 'success');
                } catch (err) {
                    showNotification('Failed to update title: ' + (err.message || err), 'error');
                }
            }
        });
    }
    // PREVIEW PDF HANDLER
    if (card.querySelector('.preview-button')) {
        card.querySelector('.preview-button').addEventListener('click', async () => {
            await previewTranscript(video);
        });
    }
    // DOWNLOAD PDF HANDLER
    if (card.querySelector('.download-button')) {
        card.querySelector('.download-button').addEventListener('click', async () => {
            await downloadTranscript(video);
        });
    }
}

// Store video ID and redirect to detailed search page
export function goToDetailedSearch(videoId) {
    if (!videoId) return;
    console.log('[goToDetailedSearch] Storing videoId in localStorage:', videoId);
    localStorage.setItem('detailedSearchVideoId', videoId);
    console.log('[goToDetailedSearch] Navigating to transcripting.html');
    window.location.href = 'transcripting.html';
}

// Load video and transcript for detailed search page
export async function loadDetailedSearchVideo(videoId) {
    console.log('[loadDetailedSearchVideo] Called with videoId:', videoId);
    // Wait for DOMContentLoaded if not already loaded
    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    }
    if (!videoId) {
        videoId = localStorage.getItem('detailedSearchVideoId');
        console.log('[loadDetailedSearchVideo] Loaded videoId from localStorage:', videoId);
    }
    if (!videoId) {
        console.warn('[loadDetailedSearchVideo] No videoId provided or found in localStorage.');
        return;
    }
    // Try to get video metadata from global variable first
    let video = null;
    if (window.allVideoMetadata && Array.isArray(window.allVideoMetadata)) {
        video = window.allVideoMetadata.find(v => String(v.ID) === String(videoId));
        console.log('[loadDetailedSearchVideo] Found video in window.allVideoMetadata:', video);
    }
    // If not found, fetch from backend
    if (!video) {
        console.log('[loadDetailedSearchVideo] Fetching video metadata from backend...');
        const metaRes = await fetch(`http://127.0.0.1:5000/videos`);
        const metaData = await metaRes.json();
        video = (metaData.videos || []).find(v => String(v.ID) === String(videoId));
        console.log('[loadDetailedSearchVideo] Video fetched from backend:', video);
    }
    if (!video) {
        console.error('[loadDetailedSearchVideo] Video not found for ID:', videoId);
        return;
    }
    // Fetch transcript
    console.log('[loadDetailedSearchVideo] Fetching transcript for videoId:', videoId);
    const transcriptRes = await fetch(`http://127.0.0.1:5000/video/${videoId}/transcript`);
    const transcript = await transcriptRes.json();
    window.detailedSearchVideo = video;
    window.detailedSearchTranscript = transcript;
    // Set global detailedTranscriptBundle
    detailedTranscriptBundle = { video, transcript };
    console.log('[loadDetailedSearchVideo] Set global variables:', {
        detailedSearchVideo: window.detailedSearchVideo,
        detailedSearchTranscript: window.detailedSearchTranscript,
        detailedTranscriptBundle
    });
    // Attach video to video wrapper
    const videoPlayer = document.getElementById('videoPlayer');
    if (videoPlayer && video.filename) {
        const videoUrl = `http://127.0.0.1:5000/uploads/${video.filename}`;
        console.log('[loadDetailedSearchVideo] Preparing to load video:', videoUrl);
        // Remove all existing sources
        while (videoPlayer.firstChild) {
            videoPlayer.removeChild(videoPlayer.firstChild);
        }
        // Create new source
        const source = document.createElement('source');
        source.src = videoUrl;
        source.type = 'video/mp4';
        videoPlayer.appendChild(source);
        try {
            videoPlayer.load();
            console.log('[loadDetailedSearchVideo] Video loaded into player:', videoUrl);
        } catch (err) {
            console.error('[loadDetailedSearchVideo] Error loading video into player:', err);
        }
        // Extra debug: check if video can play
        videoPlayer.oncanplay = () => {
            console.log('[loadDetailedSearchVideo] Video can play!');
        };
        videoPlayer.onerror = (e) => {
            console.error('[loadDetailedSearchVideo] Video player error:', e);
        };
    } else {
        console.warn('[loadDetailedSearchVideo] videoPlayer element not found or video filename missing:', videoPlayer, video && video.filename);
    }
}