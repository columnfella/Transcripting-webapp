import * as utilities from './utilities.js';
import { updateProgressBarWithQuery, createContextualMarkers, createIntervalDensityMarkers } from './progressBarController.js';
import { createVideoCard, showNamePrompt, showNotification, videoData, goToDetailedSearch, loadDetailedSearchVideo, setCurrentChatType, currentChatType } from "./utilities.js";
import { addMessage, showLoadingMessage } from './chatController.js';
import { searchInTranslatedChunks } from './utilities.js';

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
const chatTypeToggle = document.getElementById('chatTypeToggle');
const chatHistory = document.getElementById('chatHistory');
const chatHistoryAlt = document.getElementById('chatHistoryAlt');

let selectedChatType = 'main';
window.currentLanguage = 'eng'; // Will be updated based on video language when available

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

// MODERNIZED LOADING OVERLAY WITH ANIMATION
function showLoadingOverlay() {
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.style.position = 'fixed';
        loadingOverlay.style.top = 0;
        loadingOverlay.style.left = 0;
        loadingOverlay.style.width = '100vw';
        loadingOverlay.style.height = '100vh';
        loadingOverlay.style.background = 'rgba(15, 23, 42, 0.3)';
        loadingOverlay.style.backdropFilter = 'blur(8px)';
        loadingOverlay.style.zIndex = 2000;
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.alignItems = 'center';
        loadingOverlay.style.justifyContent = 'center';
        loadingOverlay.style.opacity = '0';
        loadingOverlay.style.transition = 'opacity 0.3s ease';
        
        // Create a more attractive loading indicator
        const loaderContainer = document.createElement('div');
        loaderContainer.style.background = 'linear-gradient(135deg, #1e40af, #3b82f6)';
        loaderContainer.style.borderRadius = '16px';
        loaderContainer.style.padding = '24px 40px';
        loaderContainer.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)';
        loaderContainer.style.display = 'flex';
        loaderContainer.style.flexDirection = 'column';
        loaderContainer.style.alignItems = 'center';
        loaderContainer.style.justifyContent = 'center';
        loaderContainer.style.gap = '15px';
        loaderContainer.style.transform = 'translateY(20px)';
        loaderContainer.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        loaderContainer.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        
        // Spinner icon
        const spinner = document.createElement('div');
        spinner.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:2rem; color:white;"></i>';
        
        // Loading text
        const text = document.createElement('div');
        text.textContent = 'Loading videos...';
        text.style.color = 'white';
        text.style.fontSize = '1.1rem';
        text.style.fontWeight = '600';
        text.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.2)';
        
        loaderContainer.appendChild(spinner);
        loaderContainer.appendChild(text);
        loadingOverlay.appendChild(loaderContainer);
        document.body.appendChild(loadingOverlay);
        
        // Trigger animation
        setTimeout(() => {
            loadingOverlay.style.opacity = '1';
            loaderContainer.style.transform = 'translateY(0)';
        }, 10);
    }
}

function hideLoadingOverlay() {
    if (loadingOverlay) {
        // Fade out animation
        loadingOverlay.style.opacity = '0';
        const loaderContainer = loadingOverlay.querySelector('div');
        if (loaderContainer) {
            loaderContainer.style.transform = 'translateY(20px)';
        }
        
        // Remove after animation completes
        setTimeout(() => {
            loadingOverlay.remove();
            loadingOverlay = null;
        }, 300);
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

// Show/hide language toggle based on selected chat type
function updateLanguageToggleVisibility() {
    const langToggle = document.getElementById('languageToggle');
    if (!langToggle) return;
    if (selectedChatType === 'main') {
        langToggle.style.display = '';
    } else {
        langToggle.style.display = 'none';
    }
}

function switchChatType(type) {
    // Subtle fade animation for chat history switch
    const oldChatDiv = selectedChatType === 'alt' ? chatHistoryAlt : chatHistory;
    const newChatDiv = type === 'alt' ? chatHistoryAlt : chatHistory;
    if (oldChatDiv && newChatDiv && oldChatDiv !== newChatDiv) {
        oldChatDiv.style.transition = 'opacity 0.3s';
        oldChatDiv.style.opacity = '0';
        setTimeout(() => {
            oldChatDiv.classList.remove('active');
            newChatDiv.classList.add('active');
            newChatDiv.style.transition = 'opacity 0.3s';
            newChatDiv.style.opacity = '0';
            // Force reflow to apply transition
            void newChatDiv.offsetWidth;
            newChatDiv.style.opacity = '1';
        }, 300);
    } else {
        // Fallback: just switch instantly
        if (type === 'alt') {
            chatHistory.classList.remove('active');
            chatHistoryAlt.classList.add('active');
        } else {
            chatHistory.classList.add('active');
            chatHistoryAlt.classList.remove('active');
        }
    }
    selectedChatType = type;
    // Toggle button active state
    document.querySelectorAll('.chat-type-btn').forEach(btn => {
        if (btn.dataset.chat === type) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    updateLanguageToggleVisibility();
}

// Modal to show interval text
function showIntervalModal(interval) {
    // Remove any existing modal
    const existing = document.querySelector('.interval-text-modal-backdrop');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.className = 'interval-text-modal-backdrop';
    modal.style = `position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.75);z-index:4000;display:flex;align-items:center;justify-content:center;`;
    modal.innerHTML = `
      <div class="interval-text-modal-content" style="background:#f9fafb;padding:32px 28px 24px 28px;border-radius:16px;min-width:340px;max-width:600px;box-shadow:0 8px 32px rgba(30,64,175,0.18);text-align:left;display:flex;flex-direction:column;align-items:stretch;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
          <span style="color:#2563eb;font-size:1.1rem;font-weight:700;">Interval Text</span>
          <button class="interval-modal-close" title="Close" style="background:none;border:none;font-size:2rem;line-height:1;color:#64748b;cursor:pointer;">&times;</button>
        </div>
        <div style="color:#1e293b;font-size:1.05rem;white-space:pre-line;margin-bottom:18px;">${interval.text || '(No text available for this interval)'}</div>
        <div style="color:#64748b;font-size:0.98rem;margin-bottom:6px;">Start: <b>${interval.start_time != null ? interval.start_time.toFixed(2) : '?'}</b> s &nbsp; | &nbsp; End: <b>${interval.end_time != null ? interval.end_time.toFixed(2) : '?'}</b> s</div>
        <div style="color:#64748b;font-size:0.98rem;">Position: <b>${interval.position}</b></div>
      </div>
    `;
    document.body.appendChild(modal);
    const closeBtn = modal.querySelector('.interval-modal-close');
    closeBtn.onclick = () => modal.remove();
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// Update handleSearch to use handleMessageSend for both chat types
async function handleSearch() {
    const query = textBox.value.trim();
    updateProgressBarWithQuery(query);
    // If contextual chat, handle markers after response
    if (selectedChatType === 'alt') {
        const chatHistoryId = 'chatHistoryAlt';
        const chatContainer = document.getElementById(chatHistoryId);
        // Add user message
        addMessage(query, 'user', chatHistoryId);
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
        // Show loading
        const loading = showLoadingMessage(undefined, chatHistoryId);
        try {
            const response = await utilities.sendContextualChatMessage(query, window.currentLanguage || 'eng');
            loading.stop();
            loading.element.remove();
            let responseText = '';
            let intervals = [];
            if (typeof response === 'object' && response.answer) {
                responseText = response.answer;
                if (Array.isArray(response.source_documents)) {
                    intervals = response.source_documents.map(doc => ({
                        start_time: doc.start_time,
                        end_time: doc.end_time,
                        position: doc.position,
                        text: doc.text // include text for modal
                    }));
                }
            } else if (typeof response === 'string') {
                responseText = response;
            }
            addMessage(responseText || 'No response received from the system.', 'system', chatHistoryId);
            if (intervals.length > 0) {
                createContextualMarkers(intervals, showIntervalModal);
            }
        } catch (error) {
            if (loading) {
                loading.stop();
                loading.element.remove();
            }
            addMessage(`Error: ${error.message || 'Unknown error occurred'}`, 'system', chatHistoryId);
        } finally {
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }
        utilities.clearTextBox(textBox);
        return;
    }
    // --- QUERYING MODE: Handle language switch and translation logic ---
    let transcriptToUse = utilities.detailedTranscriptBundle?.transcript;
    const selectedLang = window.currentLanguage || 'eng';
    const videoLang = window.loadedVideoLanguage || 'eng';
    const videoId = window.detailedSearchVideoId;
    
    // Always clear ALL marker types first (not just interval density markers)
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        const bar = progressBar.querySelector('.plain-progress-bar');
        if (bar) {
            bar.querySelectorAll('.progress-marker, .contextual-marker, .interval-density-marker').forEach(marker => marker.remove());
        }
    }
    
    // Use a global cache for translated transcripts
    if (videoId && transcriptToUse && selectedLang !== videoLang) {
        // Check if we already have a translated transcript for this language
        const cacheKey = `translatedTranscript_${selectedLang}`;
        if (!utilities.detailedTranscriptBundle[cacheKey]) {
            // Need to translate transcript to selected language (first time only)
            console.log(`[Querying] Translating transcript from ${videoLang} to ${selectedLang}...`);
            const translated = await utilities.translateTranscript(videoId, selectedLang);
            if (translated) {
                console.log('[Querying] Translated transcript:', translated);
                utilities.detailedTranscriptBundle[cacheKey] = translated;
                transcriptToUse = translated;
                utilities.detailedTranscriptBundle.transcript = translated;
                console.log('[Querying] Using translated transcript for search.');
            } else {
                console.warn('[Querying] Failed to translate transcript, falling back to original.');
                showNotification('Could not translate transcript. Using original language.', 'warning');
            }
        } else {
            // Use cached translation
            transcriptToUse = utilities.detailedTranscriptBundle[cacheKey];
            utilities.detailedTranscriptBundle.transcript = transcriptToUse;
            console.log(`[Querying] Using cached translated transcript for ${selectedLang}.`);
        }
        // --- Interval marker logic for translated transcript ---
        // Check if we're dealing with a translated transcript (30-second chunks format)
        const isTranslatedTranscript = transcriptToUse && transcriptToUse.words && 
                                       Array.isArray(transcriptToUse.words) && 
                                       transcriptToUse.words.length > 0 && 
                                       'start' in transcriptToUse.words[0] && 
                                       'end' in transcriptToUse.words[0] && 
                                       'text' in transcriptToUse.words[0];
                                       
        if (isTranslatedTranscript) {
            const video = utilities.detailedTranscriptBundle?.video;
            const videoDuration = video?.duration || (video?.duration_formatted ? (
                typeof video.duration_formatted === 'string' && video.duration_formatted.includes(':')
                    ? video.duration_formatted.split(':').reduce((acc, t) => 60 * acc + +t, 0)
                    : parseFloat(video.duration_formatted)
            ) : 0);
            
            // Always clear existing interval markers first
            const progressBar = document.getElementById('progressBar');
            if (progressBar) {
                const bar = progressBar.querySelector('.plain-progress-bar');
                if (bar) {
                    bar.querySelectorAll('.progress-marker, .contextual-marker, .interval-density-marker').forEach(marker => marker.remove());
                }
            }
            
            const intervals = searchInTranslatedChunks(transcriptToUse.words, textBox.value.trim());
            
            if (intervals.length > 0) {
                // Store the current query in the intervals for highlighting in the modal
                intervals.forEach(interval => {
                    interval.query = textBox.value.trim();
                });
                createIntervalDensityMarkers(intervals, videoDuration);
            }
            
            // Continue with the regular search to show the message in chat
        }
    } else if (videoId && selectedLang === videoLang && utilities.detailedTranscriptBundle?.originalTranscript) {
        // Restore the original transcript if switching back to the matchable language
        transcriptToUse = utilities.detailedTranscriptBundle.originalTranscript;
        utilities.detailedTranscriptBundle.transcript = utilities.detailedTranscriptBundle.originalTranscript;
        console.log('[Querying] Restored original transcript for search.');
        // Use the original marker logic
        updateProgressBarWithQuery(textBox.value.trim(), transcriptToUse);
    } else {
        // Use the original marker logic
        updateProgressBarWithQuery(textBox.value.trim(), transcriptToUse);
    }
    await utilities.handleMessageSend(textBox, true, selectedChatType, transcriptToUse);
    utilities.clearTextBox(textBox);
}

function clearChatHistory() {
    const isAlt = selectedChatType === 'alt';
    const chatDiv = isAlt ? chatHistoryAlt : chatHistory;
    if (!chatDiv) {
        utilities.showNotification('Chat history is already empty.', 'warning');
        return;
    }
    // Check for actual chat messages
    const hasMessages = chatDiv.querySelector('.chat-message');
    if (!hasMessages) {
        utilities.showNotification('Chat history is already empty.', 'warning');
        return;
    }
    const message = 'Are you sure you want to clear the chat history?';
    utilities.showConfirmDialog(message, 'Clear', 'Cancel').then(confirmed => {
        if (!confirmed) return;
        // Fade out animation
        chatDiv.style.transition = 'opacity 0.35s';
        chatDiv.style.opacity = '0';
        setTimeout(() => {
            chatDiv.innerHTML = '';
            chatDiv.style.opacity = '1';
        }, 350);
    });
}

function clearProgressBarMarkers() {
    const progressBar = document.getElementById('progressBar');
    if (!progressBar) return;
    // Check for markers (plain-progress-bar or progress-marker or contextual-marker or interval-density-marker)
    const bar = progressBar.querySelector('.plain-progress-bar');
    const markers = [
        ...(bar ? Array.from(bar.querySelectorAll('.progress-marker')) : Array.from(progressBar.querySelectorAll('.progress-marker'))),
        ...(bar ? Array.from(bar.querySelectorAll('.contextual-marker')) : Array.from(progressBar.querySelectorAll('.contextual-marker'))),
        ...(bar ? Array.from(bar.querySelectorAll('.interval-density-marker')) : Array.from(progressBar.querySelectorAll('.interval-density-marker')))
    ];
    if (!markers || markers.length === 0) {
        utilities.showNotification('Progress bar is already empty.', 'warning');
        return;
    }
    const message = 'Are you sure you want to clear the progress bar?';
    utilities.showConfirmDialog(message, 'Clear', 'Cancel').then(confirmed => {
        if (!confirmed) return;
        // Animate markers fade out
        markers.forEach(marker => {
            marker.style.transition = 'opacity 0.35s';
            marker.style.opacity = '0';
        });
        setTimeout(() => {
            markers.forEach(marker => marker.remove());
        }, 350);
    });
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
        downloadBtn: !!downloadBtn,
        chatTypeToggle: !!chatTypeToggle,
        chatHistory: !!chatHistory,
        chatHistoryAlt: !!chatHistoryAlt
    });

    // Initialize chat history visibility
    if (chatHistory && chatHistoryAlt) {
        chatHistory.classList.add('active');
        chatHistoryAlt.classList.remove('active');
    }

    // Add event listeners for chat type toggle buttons
    if (chatTypeToggle) {
        const chatTypeBtns = chatTypeToggle.querySelectorAll('.chat-type-btn');
        chatTypeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                switchChatType(btn.dataset.chat);
            });
        });
    }

    // Add event listeners for chat action buttons
    const clearChatBtn = document.getElementById('clearChatBtn');
    const clearProgressBtn = document.getElementById('clearProgressBtn');
    
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', clearChatHistory);
    }
    
    if (clearProgressBtn) {
        clearProgressBtn.addEventListener('click', clearProgressBarMarkers);
    }

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
        console.log('[Transcripting] Loaded videoId from localStorage:', videoId);
        if (videoId) {
            console.log('[Transcripting] Loading video with ID:', videoId);
            utilities.loadDetailedSearchVideo(videoId).then(async () => {
                // Set global variables for use elsewhere
                window.detailedSearchVideoId = videoId;
                window.detailedSearchVideo = window.detailedSearchVideo || null;
                window.detailedSearchTranscript = window.detailedSearchTranscript || null;
                console.log('[Transcripting] Global variables set:', {
                    detailedSearchVideoId: window.detailedSearchVideoId,
                    detailedSearchVideo: window.detailedSearchVideo,
                    detailedSearchTranscript: window.detailedSearchTranscript
                });
                // Send transcript to contextual server if available
                if (window.detailedSearchTranscript) {
                    utilities.sendTranscriptionToContextualServer(window.detailedSearchTranscript);
                    console.log('[Transcripting] Sent transcript to contextual server:', window.detailedSearchTranscript);
                }
                // Fetch and log the language of the video transcript
                window.loadedVideoLanguage = await utilities.fetchVideoLanguage(videoId);
                console.log('[Transcripting] Detected video transcript language:', window.loadedVideoLanguage);
                
                // Set current language to match video language
                window.currentLanguage = window.loadedVideoLanguage || 'eng';
                console.log('[Transcripting] Setting current language to:', window.currentLanguage);
                
                // Update language toggle UI
                const engBtn = document.getElementById('eng');
                const frBtn = document.getElementById('fr');
                if (engBtn && frBtn) {
                    if (window.currentLanguage === 'fr') {
                        engBtn.classList.remove('active');
                        frBtn.classList.add('active');
                    } else {
                        engBtn.classList.add('active');
                        frBtn.classList.remove('active');
                    }
                }
                
                // Store the original transcript for language switching
                if (utilities.detailedTranscriptBundle && utilities.detailedTranscriptBundle.transcript) {
                    utilities.detailedTranscriptBundle.originalTranscript = JSON.parse(JSON.stringify(utilities.detailedTranscriptBundle.transcript));
                }
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

    // Add language toggle event listeners
    const engBtn = document.getElementById('eng');
    const frBtn = document.getElementById('fr');
    if (engBtn && frBtn) {
        engBtn.addEventListener('click', () => {
            window.currentLanguage = 'eng';
            engBtn.classList.add('active');
            frBtn.classList.remove('active');
        });
        frBtn.addEventListener('click', () => {
            window.currentLanguage = 'fr';
            frBtn.classList.add('active');
            engBtn.classList.remove('active');
        });
    }

    updateLanguageToggleVisibility();
}

function getCurrentLanguage() {
    return window.currentLanguage || 'eng';
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