export function addMessage(text, type = 'user', chatHistoryId = 'chatHistory') {
    console.log(`Adding ${type} message to ${chatHistoryId}:`, text);
    const chatHistory = document.getElementById(chatHistoryId);
    
    if (!chatHistory) {
        console.error(`Chat history element with ID "${chatHistoryId}" not found!`);
        return null;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message', `message-${type}`);
    messageDiv.innerHTML = text;
    
    chatHistory.appendChild(messageDiv);
    
    // Log the div state after appending
    console.log(`Message added, ${chatHistoryId} now has ${chatHistory.children.length} messages`);
    console.log(`${chatHistoryId} visibility:`, window.getComputedStyle(chatHistory).display);
    
    // Force scroll to bottom
    chatHistory.scrollTop = chatHistory.scrollHeight;
    
    return messageDiv;
}

export function showLoadingMessage(baseText = "Processing request", chatHistoryId = 'chatHistory') {
    console.log(`Showing loading in ${chatHistoryId}:`, baseText);
    const messageElement = addMessage(baseText, 'system', chatHistoryId);
    
    if (!messageElement) {
        console.error('Failed to create loading message element');
        return { 
            element: document.createElement('div'), 
            stop: () => {} 
        };
    }
    
    messageElement.classList.add('typing-dots');

    let dotCount = 0;
    const interval = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        messageElement.innerHTML = baseText + '.'.repeat(dotCount);
    }, 500);

    return { element: messageElement, stop: () => clearInterval(interval) };
}

