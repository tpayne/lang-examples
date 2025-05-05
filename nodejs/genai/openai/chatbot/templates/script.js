const chatContainer = document.getElementById('chat_container');
const userInput = document.getElementById('user_input');
const sendButton = document.getElementById('send_button');

// New elements for the floating widget
const chatbotWidgetContainer = document.getElementById('chatbot-widget-container');
const chatIcon = document.getElementById('chat-icon');
const chatCloseButton = document.getElementById('chat-close-button');
const chatWindow = document.getElementById('chat-window');

// --- Page Timer Logic ---
const timerElement = document.getElementById('page-timer');
const startTime = new Date().getTime(); // Record the time when the script starts

function updateTimer() {
    const currentTime = new Date().getTime();
    const elapsedTime = currentTime - startTime; // Elapsed time in milliseconds

    const seconds = Math.floor((elapsedTime / 1000) % 60);
    const minutes = Math.floor((elapsedTime / (1000 * 60)) % 60);
    const hours = Math.floor((elapsedTime / (1000 * 60 * 60)) % 24);
    const days = Math.floor(elapsedTime / (1000 * 60 * 60 * 24));

    // Format the time with leading zeros
    const formattedTime =
        `${String(days).padStart(2, '0')}:` +
        `${String(hours).padStart(2, '0')}:` +
        `${String(minutes).padStart(2, '0')}:` +
        `${String(seconds).padStart(2, '0')}`;

    timerElement.textContent = formattedTime;
}

// Update the timer every second
setInterval(updateTimer, 1000);

// Initial call to display 00:00:00:00 immediately
updateTimer();


// --- Carousel Elements ---
const carouselInner = document.querySelector('.carousel-inner');
const prevArrow = document.getElementById('prevPane');
const nextArrow = document.getElementById('nextPane');
const indicatorsContainer = document.getElementById('carouselIndicators');
const panes = document.querySelectorAll('.carousel-pane');
const totalPanes = panes.length;
let currentPaneIndex = 0;
let autoCycleInterval;

// --- Carousel Functions ---
function showPane(index) {
    if (index < 0) {
        index = totalPanes - 1; // Wrap around to the last pane
    } else if (index >= totalPanes) {
        index = 0; // Wrap around to the first pane
    }

    currentPaneIndex = index;
    const offset = -index * 100; // Calculate the percentage to translate
    carouselInner.style.transform = `translateX(${offset}%)`;

    // Update indicators
    updateIndicators();
}

function nextPane() {
    showPane(currentPaneIndex + 1);
}

function prevPane() {
    showPane(currentPaneIndex - 1);
}

function createIndicators() {
    indicatorsContainer.innerHTML = ''; // Clear existing indicators
    for (let i = 0; i < totalPanes; i++) {
        const dot = document.createElement('div');
        dot.classList.add('indicator-dot');
        dot.addEventListener('click', () => {
            showPane(i);
            resetAutoCycle(); // Reset timer on manual interaction
        });
        indicatorsContainer.appendChild(dot);
    }
    updateIndicators();
}

function updateIndicators() {
    const dots = indicatorsContainer.querySelectorAll('.indicator-dot');
    dots.forEach((dot, index) => {
        if (index === currentPaneIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

function startAutoCycle() {
    // Clear any existing interval to prevent multiple intervals running
     if (autoCycleInterval) {
         clearInterval(autoCycleInterval);
     }
    autoCycleInterval = setInterval(nextPane, 60000); // Cycle every 60 seconds
}

 function resetAutoCycle() {
     clearInterval(autoCycleInterval); // Stop the current interval
     startAutoCycle(); // Start a new interval
 }


// --- Chatbot Widget Functions ---
// Function to open the chat window
function openChat() {
    chatbotWidgetContainer.classList.remove('chat-closed');
    chatbotWidgetContainer.classList.add('chat-open');
    // Optional: focus on the input field when opening
    userInput.focus();
     // Show initial message if not already shown
     showInitialMessageOnce();
}

// Function to close the chat window
function closeChat() {
    chatbotWidgetContainer.classList.remove('chat-open');
    chatbotWidgetContainer.classList.add('chat-closed');
}


function sendMessage() {
    const message = userInput.value.trim();
    if (message === '') {
        return;
    }
    appendMessage('User', message);
    userInput.value = '';
    userInput.disabled = true;
    sendButton.disabled = true;
    chatContainer.style.cursor = "wait"; // Indicate processing

    appendTypingIndicator();
    // getResponse is the function that talks to your backend
    getResponse(message).then(response => {
        removeTypingIndicator();
        // Ensure response is a string or handle other types if necessary
        const botMessage = (typeof response === 'object' && response !== null) ? JSON.stringify(response, null, 2) : String(response);
        appendMessage('Bot', botMessage);
        chatContainer.style.cursor = ""; // Reset cursor
        userInput.disabled = false;
        sendButton.disabled = false;
        userInput.focus(); // Keep focus on input after response
    }).catch(error => {
        removeTypingIndicator();
        console.error("Error getting response:", error);
        appendMessage('Bot', "Sorry, there was an error getting a response.");
        chatContainer.style.cursor = "";
        userInput.disabled = false;
        sendButton.disabled = false;
        userInput.focus();
    });
}

function appendMessage(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender.toLowerCase());

    const senderSpan = document.createElement('span');
    senderSpan.classList.add('sender', 'text-gray-600');
    senderSpan.textContent = sender + ':';

    const messageContentDiv = document.createElement('div');
    messageContentDiv.classList.add('message-content');

    let dataApp = message;

    if (sender === 'Bot') {
        // Ensure bot message is a string before passing to marked
        dataApp = String(message);
        // Use marked for Markdown parsing
        const mStr = marked.parse(dataApp);
        // Remove potential leading/trailing empty lines from marked output
        messageContentDiv.innerHTML = mStr.replace(/(^\s*<p>\s*<\/p>\s*)|(\s*<p>\s*<\/p>\s*$)/g, "").trim();

    } else {
        // For user messages, just set text content to prevent XSS
        messageContentDiv.textContent = message;
    }

    // For 'user' messages, the sender label is usually omitted or placed differently.
    // Based on current CSS alignment, appending senderSpan is fine, but you might
    // want to adjust its display or order based on the sender class if needed.
    // messageElement.appendChild(senderSpan); // Optional: keep sender label for user
    messageElement.appendChild(messageContentDiv);

    // Adjust message bubble alignment based on sender
    if (sender.toLowerCase() === 'user') {
        messageElement.style.alignSelf = 'flex-end';
    } else { // Bot or Agent
        messageElement.style.alignSelf = 'flex-start';
    }


    chatContainer.appendChild(messageElement);
    // Scroll to the bottom after adding a message
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function appendTypingIndicator() {
    // Remove any existing typing indicator first
    removeTypingIndicator();

    const typingIndicator = document.createElement('div');
    typingIndicator.classList.add('message', 'agent', 'typing-indicator-container'); // Add a class to easily find it

    const indicatorDiv = document.createElement('div');
    indicatorDiv.classList.add('typing-indicator');
    for (let i = 0; i < 3; i++) {
        const dotSpan = document.createElement('span');
        indicatorDiv.appendChild(dotSpan);
    }

    typingIndicator.appendChild(indicatorDiv);
    chatContainer.appendChild(typingIndicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeTypingIndicator() {
    const typingIndicator = chatContainer.querySelector('.typing-indicator-container'); // Use the specific class
    if (typingIndicator) {
        typingIndicator.remove();
    }
}


async function getResponse(userMessage) {
    // This function makes the API call to your backend
    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: userMessage }),
            credentials: 'include' // Include cookies for session
        });

        if (!response.ok) {
            // Log the error response body if available
            const errorBody = await response.text();
            console.error(`Server error: ${response.status}`, errorBody);
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        if (data && data.response !== undefined) { // Check for undefined explicitly
            return data.response;
        } else {
            console.error("Invalid response format:", data);
            return "The server returned an invalid response."
        }
    } catch (err) {
        console.error("Fetch error:", err);
        return "Could not connect to the server or an error occurred.";
    }
}

// Event Listeners for the widget toggle
chatIcon.addEventListener('click', openChat);
chatCloseButton.addEventListener('click', closeChat);

// Event Listeners for the chat input
userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent default form submission
        sendMessage();
    }
});
sendButton.addEventListener('click', sendMessage);

// Add an initial message *after* the user opens the chat for the first time
let initialMessageShown = false;
function showInitialMessageOnce() {
     if (!initialMessageShown) {
         appendMessage('Bot', 'Hello! How can I help you today?');
         initialMessageShown = true;
     }
}
// Note: initial message is now triggered by openChat

// --- Carousel Initialization ---
// Add event listeners for arrows
prevArrow.addEventListener('click', () => {
    prevPane();
    resetAutoCycle(); // Reset timer on manual interaction
});
nextArrow.addEventListener('click', () => {
    nextPane();
    resetAutoCycle(); // Reset timer on manual interaction
});

// Create and set up indicators
createIndicators();

// Show the first pane initially
showPane(0);

// Start automatic cycling
startAutoCycle();

// --- Copy to Clipboard Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const copyButtons = document.querySelectorAll('.copy-button');

    copyButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Find the previous sibling <pre> element
            const codeBlock = button.previousElementSibling;

            if (codeBlock && codeBlock.tagName === 'PRE') {
                const textToCopy = codeBlock.textContent;

                // Use the modern clipboard API
                navigator.clipboard.writeText(textToCopy).then(() => {
                    // Optional: Provide feedback to the user
                    const originalText = button.textContent;
                    button.textContent = 'Copied!';
                    button.classList.add('copied');

                    setTimeout(() => {
                        button.textContent = originalText;
                        button.classList.remove('copied');
                    }, 2000); // Revert text after 2 seconds

                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                    // Optional: Provide error feedback
                    const originalText = button.textContent;
                    button.textContent = 'Error!';
                     button.classList.add('error'); // Add a specific error class if desired
                    setTimeout(() => {
                        button.textContent = originalText;
                         button.classList.remove('error');
                    }, 2000);
                });
            } else {
                 console.error('Could not find previous PRE element for copy button.');
            }
        });
    });
});
