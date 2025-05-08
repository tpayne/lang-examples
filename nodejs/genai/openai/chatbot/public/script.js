const chatContainer = document.getElementById('chat_container');
const userInput = document.getElementById('user_input'); // Now a contenteditable div
const sendButton = document.getElementById('send_button');

// New elements for the floating widget
const chatbotWidgetContainer = document.getElementById('chatbot-widget-container');
const chatIcon = document.getElementById('chat-icon');
const chatCloseButton = document.getElementById('chat-close-button');
const chatWindow = document.getElementById('chat-window');

// New element for the toolbar
const toolbar = document.getElementById('toolbar');


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


// --- Chatbot Widget Toggle Logic ---
chatIcon.addEventListener('click', () => {
    chatbotWidgetContainer.classList.remove('chat-closed');
    chatbotWidgetContainer.classList.add('chat-open');
    // Optional: Focus the input when chat opens
    userInput.focus();
});

chatCloseButton.addEventListener('click', () => {
    chatbotWidgetContainer.classList.remove('chat-open');
    chatbotWidgetContainer.classList.add('chat-closed');
});


// Function to add a message to the chat
function addMessage(sender, message, isBot = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);

    // Create icon element
    const iconElement = document.createElement('div');
    iconElement.classList.add('message-icon');
    iconElement.textContent = sender === 'user' ? '👤' : '🤖'; // Use emojis for icons

    // Create message content element
    const contentElement = document.createElement('div');
    contentElement.classList.add('message-content');

    // Use marked.js to render Markdown for bot messages
    if (isBot) {
        contentElement.innerHTML = marked.parse(message);
    } else {
        // For user messages, display the plain text (or original rich text if preferred)
        // We will display the plain text version that was sent to the bot
         contentElement.textContent = message; // Display the plain text sent
        // If you wanted to display the original rich text in the chat bubble:
        // contentElement.innerHTML = message; // Display the original HTML content
    }


    // Append icon and content based on sender
    if (sender === 'user') {
        messageElement.appendChild(contentElement);
        messageElement.appendChild(iconElement);
    } else { // agent or bot
        messageElement.appendChild(iconElement);
        messageElement.appendChild(contentElement);
    }


    chatContainer.appendChild(messageElement);

    // Scroll to the bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Function to convert HTML content to plain text
function htmlToPlainText(html) {
    // Create a temporary div element
    const tempDiv = document.createElement('div');
    // Set the HTML content of the div
    tempDiv.innerHTML = html;
    // Get the text content, which strips out HTML tags
    let text = tempDiv.textContent || tempDiv.innerText || "";

    // Optional: Normalize whitespace and handle newlines
    // Replace multiple whitespace characters with a single space
    text = text.replace(/[ \t]+/g, ' ');
    // Replace multiple newline characters with a single newline
    text = text.replace(/\n\n+/g, '\n');
    // Trim leading/trailing whitespace
    text = text.trim();


    return text;
}


// Function to handle sending a message
async function sendMessage() {
    // Get the rich HTML content from the contenteditable div
    const richText = userInput.innerHTML.trim();

    if (!richText || richText === '<br>') { // Also check for just a newline
        userInput.innerHTML = ''; // Clear the input field if only <br>
        return; // Don't send empty messages
    }


    // Convert the rich text to plain ASCII text for the bot
    const plainText = htmlToPlainText(richText);

    // Add the user's message (plain text version) to the chat display
    // You could choose to display the richText here instead if desired
    addMessage('user', plainText); // Display the plain text that was sent

    // Clear the input field
    userInput.innerHTML = ''; // Clear the contenteditable div

    // Add typing indicator
    const typingIndicatorElement = document.createElement('div');
    typingIndicatorElement.classList.add('message', 'agent', 'typing-indicator-container');
     typingIndicatorElement.innerHTML = `
         <div class="message-icon">🤖</div>
         <div class="typing-indicator">
             <span></span>
             <span></span>
             <span></span>
         </div>
     `;
    chatContainer.appendChild(typingIndicatorElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;


    try {
        // Send the plain text message to the backend
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: plainText }), // Send the plain text
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Remove typing indicator
        chatContainer.removeChild(typingIndicatorElement);

        // Add the bot's response to the chat display
        addMessage('agent', data.response, true); // Pass true for isBot to render Markdown

    } catch (error) {
        console.error('Error sending message:', error);
        // Remove typing indicator
        if (chatContainer.contains(typingIndicatorElement)) {
             chatContainer.removeChild(typingIndicatorElement);
        }
        // Display an error message in the chat
        addMessage('agent', 'Sorry, something went wrong. Please try again.', true);
    }
}

// Send message on button click
sendButton.addEventListener('click', sendMessage);

// Send message on Enter key press in the input field
userInput.addEventListener('keypress', function(event) {
    // Check if the key pressed was Enter (key code 13)
    // Also check if the Shift key was NOT pressed (to allow Shift+Enter for new line)
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // Prevent the default Enter key action (new line)
        sendMessage(); // Call the send message function
    }
});


// --- Toolbar Button Logic ---
// Add event listener to keep track of the selection range
// This needs to be outside the click handler so currentRange persists
let currentRange = null;
userInput.addEventListener('mouseup', () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        currentRange = selection.getRangeAt(0);
    }
});
userInput.addEventListener('keyup', () => {
     const selection = window.getSelection();
     if (selection.rangeCount > 0) {
         currentRange = selection.getRangeAt(0);
     }
});


toolbar.addEventListener('click', function(event) {
    const button = event.target.closest('.toolbar-button'); // Get the clicked button or its closest ancestor

    if (!button) return; // If no button was clicked, do nothing

    const command = button.dataset.command; // Get the command from the data-command attribute

    // Ensure the contenteditable div is focused before executing command
    userInput.focus();

    // Attempt to restore the selection range before executing the command
    if (currentRange) {
        const selection = window.getSelection();
        // Check if the active element is still the userInput before removing ranges
        // This prevents errors if focus has shifted unexpectedly
        if (document.activeElement === userInput) {
            selection.removeAllRanges();
            selection.addRange(currentRange);
        }
    }

    if (command) {
        // For commands like createLink, prompt the user for input
        if (command === 'createLink') {
             const url = prompt('Enter the URL:');
             // Ensure the input is focused again after the prompt, as it might lose focus
             userInput.focus();
             // Restore range again after focus, just in case
             if (currentRange && document.activeElement === userInput) {
                 const selection = window.getSelection();
                 selection.removeAllRanges();
                 selection.addRange(currentRange);
             }
             if (url) {
                  document.execCommand('createLink', false, url);
             } else {
                 // If user cancels the prompt, unlink the current selection if any
                 document.execCommand('unlink', false, null);
             }
        } else {
            // Execute the command for bold, italic, underline, lists
            document.execCommand(command, false, null);
        }

        // After execCommand, re-capture the selection range as it might have changed
        // and ensure focus remains on the input.
        setTimeout(() => { // Use a small timeout to allow DOM changes to settle
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                currentRange = selection.getRangeAt(0);
            }
             userInput.focus(); // Ensure focus remains
        }, 10);

    }
});


// --- Code Block Copy Button Logic ---
// Wait for the DOM to be fully loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Select all copy buttons
    const copyButtons = document.querySelectorAll('.copy-button');

    // Add a click event listener to each button
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