import * as utilities from './utilities.js';
import { updateProgressBarWithQuery } from './progressBarController.js';
import {createVideoCard, showNamePrompt, showNotification, videoData, goToDetailedSearch, loadDetailedSearchVideo} from "./utilities.js";

const textBox = document.getElementById("chat-input");
const startBtn = document.getElementById("startBtn");
const uploadBtn = document.getElementById("uploadBtn");
const videoInput = document.getElementById("videoInput");
const sendButton = document.getElementById("send-button");
const frButton = document.getElementById('fr');
const engButton = document.getElementById('eng');
const videoGrid = document.getElementById('videoGrid');
const previewBtn = document.getElementById('previewBtn');
const downloadBtn = document.getElementById('downloadBtn');
const dragDropArea = document.getElementById('dragDropArea');

let currentLanguage = 'eng';

console.log("🔍 DEBUG: Main script loaded");
console.log('[DEBUG] window.location.pathname:', window.location.pathname);

// Character limit for video titles (should match the one in utilities.js)
const TITLE_CHARACTER_LIMIT = 50;

// EARLY FILE SIZE CHECK
const MAX_SIZE_MB = 25;

// GLOBAL VARIABLE TO STORE ALL VIDEO METADATA
window.allVideoMetadata = [];

// LOADING OVERLAY ELEMENT
let loadingOverlay = null;

// GLOBAL FLAG FOR UPLOAD STATUS
let isUploading = false;

// ENHANCED LOADING OVERLAY (less invasive)
function showLoadingOverlay() {
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.style.position = 'fixed';
        loadingOverlay.style.top = 0;
        loadingOverlay.style.left = 0;
        loadingOverlay.style.width = '100vw';
        loadingOverlay.style.height = '100vh';
        loadingOverlay.style.background = 'rgba(255,255,255,0.35)'; // more transparent
        loadingOverlay.style.zIndex = 2000;
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.alignItems = 'center';
        loadingOverlay.style.justifyContent = 'center';
        loadingOverlay.style.pointerEvents = 'none'; // allow interaction
        loadingOverlay.innerHTML = '<div style="font-size:1.2rem; color:#1e40af; opacity:0.7;"><i class="fas fa-spinner fa-spin"></i> Loading videos...</div>';
        document.body.appendChild(loadingOverlay);
    }
}

function hideLoadingOverlay() {
    if (loadingOverlay) {
        loadingOverlay.remove();
        loadingOverlay = null;
    }
}

// NOTIFY ON ERROR DURING INITIAL VIDEO LOAD
async function fetchAllVideoMetadata() {
    showLoadingOverlay();
    try {
        const res = await fetch('http://127.0.0.1:5000/videos/metadata');
        if (!res.ok) throw new Error('Failed to fetch video metadata');
        const data = await res.json();
        window.allVideoMetadata = data.videos || [];
    } catch (err) {
        window.allVideoMetadata = [];
        showNotification('Error loading videos: ' + (err.message || err), 'error');
    } finally {
        hideLoadingOverlay();
    }
}

// SEND VIDEO TITLE EDIT TO BACKEND
async function sendEditVideoTitle(videoId, newTitle) {
    try {
        const res = await fetch('http://127.0.0.1:5000/edit-video-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: videoId, title: newTitle })
        });
        if (!res.ok) throw new Error('Failed to update video title');
        return await res.json();
    } catch (err) {
        throw err;
    }
}

function handleSearch() {
    const query = textBox.value.trim();
    // Update progress bar with search query (now marker-based)
    updateProgressBarWithQuery(query);
    utilities.handleMessageSend(textBox);
    utilities.clearTextBox(textBox);
}

function toggleLanguage(selectedLang) {
    // Remove active class from all buttons
    frButton.classList.remove('active');
    engButton.classList.remove('active');

    // Add active class to selected button
    if (selectedLang === 'fr') {
        frButton.classList.add('active');
        currentLanguage = 'fr';
    } else {
        engButton.classList.add('active');
        currentLanguage = 'eng';
    }
}

function clearChatHistory() {
    const chatHistory = document.getElementById('chatHistory');
    if (chatHistory) chatHistory.innerHTML = '';
}

function clearProgressBarMarkers() {
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        const bar = progressBar.querySelector('.plain-progress-bar');
        if (bar) bar.querySelectorAll('.progress-marker').forEach(marker => marker.remove());
    }
}

function init() {
    // Debug: Check which elements exist
    console.log('Element check:', {
        textBox: !!textBox,
        startBtn: !!startBtn,
        uploadBtn: !!uploadBtn,
        videoInput: !!videoInput,
        sendButton: !!sendButton,
        frButton: !!frButton,
        engButton: !!engButton,
        videoGrid: !!videoGrid,
        previewBtn: !!previewBtn,
        downloadBtn: !!downloadBtn
    });

    if (uploadBtn) {
        uploadBtn.addEventListener("click", (e) => {
            e.preventDefault();
            showDragDropArea();
        });
    }

    if (sendButton) {
        sendButton.addEventListener("click", handleSearch);
    }

    if (startBtn) {
        startBtn.addEventListener("click", () => {
            window.location.assign("storage.html")
        })
    }

    if (textBox) {
        textBox.addEventListener("keydown", (event) => {
            if (event.key === 'Enter') {
                handleSearch();
            }
        });
    }

    if (frButton && engButton) {
        frButton.addEventListener('click', () => toggleLanguage('fr'));
        engButton.addEventListener('click', () => toggleLanguage('eng'));
    }

    // FETCH VIDEO METADATA ON STORAGE PAGE LOAD
    if (window.location.pathname.endsWith('storage.html')) {
        fetchAllVideoMetadata().then(() => {
            // Clear grid
            if (videoGrid) videoGrid.innerHTML = '';
            // Render cards from global metadata
            window.allVideoMetadata.forEach(video => {
                const card = createVideoCard(video);
                utilities.attachCardButtonListeners(card, video);
                videoGrid.appendChild(card);
            });
        });
    }

    // 🚨🚨🚨 DEBUG VERSION - VIDEO UPLOAD EVENT LISTENER 🚨🚨🚨
    if (videoInput && uploadBtn && videoGrid) {
        videoInput.addEventListener("change", async () => {
            console.log("🔍 DEBUG: File input changed");

            const file = videoInput.files[0];
            if (!file) {
                console.log("🔍 DEBUG: No file selected, exiting");
                return;
            }

            if (file.size > MAX_SIZE_MB * 1024 * 1024) {
                showNotification(`Error: Video cannot exceed ${MAX_SIZE_MB} MB`, 'error');
                videoInput.value = ""; // Clear the file input
                return;
            }

            console.log("🔍 DEBUG: File selected:", file.name);
            console.log("🔍 DEBUG: About to show name prompt...");

            // Step 1: Prompt for video name FIRST (video is NOT sent yet)
            const defaultTitle = file.name.replace(/\.[^/.]+$/, "");
            let videoName = await showNamePrompt(null, defaultTitle);

            console.log("🔍 DEBUG: Name prompt returned:", videoName);

            // Step 2: If user cancels, reset input and exit
            if (!videoName) {
                console.log("🔍 DEBUG: User cancelled, clearing input");
                videoInput.value = ""; // Clear the file input
                return;
            }

            console.log("🔍 DEBUG: User confirmed title:", videoName);

            // Step 3: Validate title length
            if (videoName.length > TITLE_CHARACTER_LIMIT) {
                console.log("🔍 DEBUG: Title too long, showing error");
                showNotification(`Title exceeds ${TITLE_CHARACTER_LIMIT} character limit. Please try again.`, 'error');
                videoInput.value = ""; // Clear the file input
                return;
            }

            console.log("🔍 DEBUG: Title validated, about to send video...");

            // Step 4: ONLY NOW send the video with confirmed title
            // Set global uploading flag
            isUploading = true;
            // Show drag-drop-area and spinner
            showDragDropArea();
            const content = dragDropArea.querySelector('.drag-drop-content');
            if (content) content.style.display = 'none';
            const closeBtn = dragDropArea.querySelector('.drag-drop-close-btn');
            if (closeBtn) closeBtn.disabled = true;
            dragDropArea.classList.add('processing');
            let spinner = dragDropArea.querySelector('.drag-drop-spinner');
            if (!spinner) {
                spinner = document.createElement('div');
                spinner.className = 'drag-drop-spinner';
                spinner.innerHTML = `<i class='fas fa-spinner fa-spin' style='font-size:2rem;color:var(--primary);'></i><div style='margin-top:10px;font-weight:600;color:#1e293b;'>Processing...</div>`;
                spinner.style.position = 'absolute';
                spinner.style.top = '50%';
                spinner.style.left = '50%';
                spinner.style.transform = 'translate(-50%, -50%)';
                spinner.style.display = 'flex';
                spinner.style.flexDirection = 'column';
                spinner.style.alignItems = 'center';
                spinner.style.justifyContent = 'center';
                spinner.style.zIndex = '20';
                dragDropArea.appendChild(spinner);
            }

            try {
                console.log("🔍 DEBUG: Calling sendVideo with file and title");
                // Send video with the confirmed title - pass the file AND title
                const backendData = await utilities.sendVideo(file, videoName);

                console.log("🔍 DEBUG: sendVideo completed successfully:", backendData);

                if (backendData && backendData.metadata) {
                    // Success: add to global metadata and create card
                    window.allVideoMetadata.unshift(backendData.metadata);
                    const card = createVideoCard(backendData.metadata);
                    utilities.attachCardButtonListeners(card, backendData.metadata);
                    videoGrid.prepend(card);
                    showNotification('Video uploaded and transcribed successfully!', 'success');
                } else {
                    showNotification('Video uploaded but no metadata returned.', 'warning');
                }
            } catch (err) {
                console.log("🔍 DEBUG: sendVideo failed:", err);
                showNotification('Upload failed: ' + (err.message || err), 'error');
            } finally {
                // Reset UI state and global flag
                isUploading = false;
                if (spinner) spinner.remove();
                if (content) content.style.display = '';
                if (closeBtn) closeBtn.disabled = false;
                dragDropArea.classList.remove('processing');
                hideDragDropArea();
                videoInput.value = ""; // Clear the file input
                console.log("🔍 DEBUG: Upload process completed, UI reset");
            }
        });
    }

    // On transcripting.html, load video and transcript on page load
    if (window.location.pathname.includes('transcripting.html')) {
        console.log('[Transcripting] Page loaded, setting up video loading...');
        const videoId = localStorage.getItem('detailedSearchVideoId');
        console.log('[Transcripting] Loaded from localStorage, videoId:', videoId);
        if (videoId) {
            console.log('[Transcripting] Loading video with ID:', videoId);
            utilities.loadDetailedSearchVideo(videoId).then(() => {
                // Set global variables for use elsewhere
                window.detailedSearchVideoId = videoId;
                window.detailedSearchVideo = window.detailedSearchVideo || null;
                window.detailedSearchTranscript = window.detailedSearchTranscript || null;
                console.log('[Transcripting] Global variables set:', {
                    detailedSearchVideoId: window.detailedSearchVideoId,
                    detailedSearchVideo: window.detailedSearchVideo,
                    detailedSearchTranscript: window.detailedSearchTranscript
                });
            });
        } else {
            console.warn('[Transcripting] No videoId found in localStorage.');
        }

        // Add clear chat and clear progress bar button listeners (only on transcripting.html)
        const clearChatBtn = document.getElementById('clearChatBtn');
        const clearProgressBtn = document.getElementById('clearProgressBtn');
        if (clearChatBtn) {
            clearChatBtn.addEventListener('click', clearChatHistory);
        }
        if (clearProgressBtn) {
            clearProgressBtn.addEventListener('click', clearProgressBarMarkers);
        }
    }
}

function getCurrentLanguage() {
    return currentLanguage;
}

if (frButton && engButton) {
    toggleLanguage('eng');
}

function showDragDropArea() {
    if (dragDropArea) dragDropArea.style.display = 'flex';
    if (uploadBtn) uploadBtn.style.display = 'none';
}
function hideDragDropArea() {
    if (dragDropArea) {
        dragDropArea.style.display = 'none';
        // Remove any spinner/message
        const spinner = dragDropArea.querySelector('.drag-drop-spinner');
        if (spinner) spinner.remove();
        // Restore drag-drop-content
        const content = dragDropArea.querySelector('.drag-drop-content');
        if (content) content.style.display = '';
    }
    if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.style.display = '';
    }
}

if (dragDropArea) {
    const closeBtn = dragDropArea.querySelector('.drag-drop-close-btn');
    // Click on drag area triggers file input (only if not uploading)
    dragDropArea.addEventListener('click', (e) => {
        if (e.target === closeBtn) return; // Don't trigger file input on close btn
        if (videoInput && !dragDropArea.classList.contains('processing')) videoInput.click();
    });
    // Drag events (only if not uploading)
    dragDropArea.addEventListener('dragover', (e) => {
        if (dragDropArea.classList.contains('processing')) return;
        e.preventDefault();
        dragDropArea.classList.add('dragover');
    });
    dragDropArea.addEventListener('dragleave', (e) => {
        if (dragDropArea.classList.contains('processing')) return;
        e.preventDefault();
        dragDropArea.classList.remove('dragover');
    });
    dragDropArea.addEventListener('drop', async (e) => {
        if (dragDropArea.classList.contains('processing')) return;
        e.preventDefault();
        dragDropArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (!files || !files.length) return;
        const file = files[0];
        // 🚩 EARLY FILE SIZE CHECK (25 MB limit)
        const MAX_SIZE_MB = 25;
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            showNotification(`Error: Video cannot exceed ${MAX_SIZE_MB} MB`, 'error');
            hideDragDropArea();
            return;
        }
        // Prompt for video name
        const defaultTitle = file.name.replace(/\.[^/.]+$/, "");
        let videoName = await showNamePrompt(null, defaultTitle);
        if (!videoName) {
            hideDragDropArea();
            return;
        }
        if (videoName.length > TITLE_CHARACTER_LIMIT) {
            showNotification(`Title exceeds ${TITLE_CHARACTER_LIMIT} character limit. Please try again.`, 'error');
            hideDragDropArea();
            return;
        }
        // Set global uploading flag
        isUploading = true;
        // Start upload animation in drag area
        if (uploadBtn) uploadBtn.disabled = true;
        // Hide drag-drop-content
        const content = dragDropArea.querySelector('.drag-drop-content');
        if (content) content.style.display = 'none';
        // Disable close button and mark processing
        const closeBtn = dragDropArea.querySelector('.drag-drop-close-btn');
        if (closeBtn) closeBtn.disabled = true;
        dragDropArea.classList.add('processing');
        let spinner = dragDropArea.querySelector('.drag-drop-spinner');
        if (!spinner) {
            spinner = document.createElement('div');
            spinner.className = 'drag-drop-spinner';
            spinner.innerHTML = `<i class='fas fa-spinner fa-spin' style='font-size:2rem;color:var(--primary);'></i><div style='margin-top:10px;font-weight:600;color:#1e293b;'>Processing...</div>`;
            spinner.style.position = 'absolute';
            spinner.style.top = '50%';
            spinner.style.left = '50%';
            spinner.style.transform = 'translate(-50%, -50%)';
            spinner.style.display = 'flex';
            spinner.style.flexDirection = 'column';
            spinner.style.alignItems = 'center';
            spinner.style.justifyContent = 'center';
            spinner.style.zIndex = '20';
            dragDropArea.appendChild(spinner);
        }
        try {
            const backendData = await utilities.sendVideo(file, videoName);
            if (backendData && backendData.metadata) {
                window.allVideoMetadata.unshift(backendData.metadata);
                const card = createVideoCard(backendData.metadata);
                utilities.attachCardButtonListeners(card, backendData.metadata);
                videoGrid.prepend(card);
                showNotification('Video uploaded and transcribed successfully!', 'success');
            } else {
                showNotification('Video uploaded but no metadata returned.', 'warning');
            }
        } catch (err) {
            showNotification('Upload failed: ' + (err.message || err), 'error');
        } finally {
            // Reset global uploading flag and UI
            isUploading = false;
            if (spinner) spinner.remove();
            if (content) content.style.display = '';
            if (uploadBtn) uploadBtn.disabled = false;
            if (closeBtn) closeBtn.disabled = false;
            dragDropArea.classList.remove('processing');
            hideDragDropArea();
        }
    });
    // Close button logic
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!closeBtn.disabled) hideDragDropArea();
        });
    }
}
// Hide drag area if file input is used or upload is cancelled
if (videoInput) {
    videoInput.addEventListener('change', () => {
        // This is handled within the videoInput change listener now
        // hideDragDropArea();
    });
}

function handleBeforeUnload(event) {
    if (isUploading) {
        event.preventDefault();
        event.returnValue = ''; // Standard for browser to show a confirmation dialog
        return ''; // For some older browsers
    }
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener('beforeunload', handleBeforeUnload);