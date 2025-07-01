export function addMessage(text, type = 'user') {
    const chatHistory = document.getElementById('chatHistory');

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message', `message-${type}`);
    messageDiv.innerHTML = text;

    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    return messageDiv;
}

export function showLoadingMessage(baseText = "Processing request") {
    const messageElement = addMessage(baseText, 'system');
    messageElement.classList.add('typing-dots');

    let dotCount = 0;
    const interval = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        messageElement.innerHTML = baseText + '.'.repeat(dotCount);
    }, 500);

    return { element: messageElement, stop: () => clearInterval(interval) };
}

