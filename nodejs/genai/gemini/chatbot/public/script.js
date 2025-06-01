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

// --- Input History Variables ---
const messageHistory = []; // Array to store sent messages
let historyIndex = 0; // Index to navigate messageHistory
let currentInputDraft = ''; // To store the current input when navigating history


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

    // Add the plain text message to history BEFORE clearing the input
    // Only add if it's not the same as the last message in history
    if (messageHistory.length === 0 || messageHistory[messageHistory.length - 1] !== plainText) {
         messageHistory.push(plainText);
    }
    // Reset history index to the end (new message position)
    historyIndex = messageHistory.length;
    currentInputDraft = ''; // Clear the draft when a message is sent


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

// Send message on Enter key press in the input field and handle arrow keys
userInput.addEventListener('keydown', function(event) {
    // Check if the key pressed was Enter (key code 13) without Shift
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // Prevent the default Enter key action (new line)
        sendMessage(); // Call the send message function
    } else if (event.key === 'ArrowUp') {
        event.preventDefault(); // Prevent cursor movement in the input

        if (historyIndex === messageHistory.length) {
             // Store the current input draft before navigating history
             currentInputDraft = userInput.innerHTML;
        }

        if (historyIndex > 0) {
            historyIndex--;
            // Load the previous message from history
            userInput.innerHTML = messageHistory[historyIndex];
            // Place cursor at the end of the loaded text (optional but good UX)
            placeCaretAtEnd(userInput);
        }
    } else if (event.key === 'ArrowDown') {
        event.preventDefault(); // Prevent cursor movement in the input

        if (historyIndex < messageHistory.length) {
            historyIndex++;
            if (historyIndex === messageHistory.length) {
                // If navigating back to the latest (or empty) state, restore draft
                userInput.innerHTML = currentInputDraft;
                currentInputDraft = ''; // Clear draft once returned
            } else {
                // Load the next message from history
                userInput.innerHTML = messageHistory[historyIndex];
            }
            // Place cursor at the end (optional but good UX)
             placeCaretAtEnd(userInput);
        }
    } else if (historyIndex < messageHistory.length) {
        // If the user types anything other than Up/Down arrows while in history,
        // reset history index and clear draft as they are starting a new message.
        historyIndex = messageHistory.length;
        currentInputDraft = '';
    }
});

// Helper function to place cursor at the end of contenteditable div
function placeCaretAtEnd(el) {
    el.focus();
    if (typeof window.getSelection != "undefined"
            && typeof document.createRange != "undefined") {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false); // Collapse to the end
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    } else if (typeof document.body.createTextRange != "undefined") {
        // IE specific
        const textRange = document.body.createTextRange();
        textRange.moveToElementText(el);
        textRange.collapse(false);
        textRange.select();
    }
}


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

// Get a reference to the new save button
const saveConversationButton = document.getElementById('saveConversationButton');

// Function to save the conversation as Markdown
saveConversationButton.addEventListener('click', () => {
    let markdownContent = "# Chatbot Conversation\n\n";
    const messages = chatContainer.querySelectorAll('.message');

    messages.forEach(messageElement => {
        const sender = messageElement.classList.contains('user') ? 'You' : 'Bot';
        const messageContentElement = messageElement.querySelector('.message-content');
        let messageText = messageContentElement ? messageContentElement.innerText : '';

        // Basic Markdown formatting for content from the bot
        if (messageElement.classList.contains('agent')) {
            // For bot messages, we already have innerHTML as marked.parse output.
            // We need to convert it back to something resembling Markdown.
            // This is a simplification; a full HTML-to-Markdown conversion is complex.
            // For now, we'll try to reverse some common ones.
            messageText = messageContentElement.innerHTML
                .replace(/<\/?b>/g, '**')      // Bold
                .replace(/<\/?i>/g, '*')       // Italic
                .replace(/<\/?u>/g, '__')      // Underline
                .replace(/<a href="(.*?)"[^>]*>(.*?)<\/a>/g, '[$2]($1)') // Links
                .replace(/<ul>/g, '\n')        // Unordered lists
                .replace(/<\/ul>/g, '\n')      // Unordered lists
                .replace(/<ol>/g, '\n')        // Ordered lists
                .replace(/<\/ol>/g, '\n')      // Ordered lists
                .replace(/<li>/g, '* ')        // List items (simple bullet)
                .replace(/<\/li>/g, '\n')      // List items
                .replace(/<pre>(.*?)<\/pre>/gs, '```\n$1\n```') // Code blocks
                .replace(/&lt;/g, '<')         // Decode HTML entities
                .replace(/&gt;/g, '>')         // Decode HTML entities
                .replace(/&quot;/g, '"')       // Decode HTML entities
                .replace(/&#39;/g, "'")        // Decode HTML entities
                .replace(/&amp;/g, '&')        // Decode HTML entities last
                .replace(/\n\s*\n/g, '\n\n'); // Normalize multiple newlines
        }


        markdownContent += `**${sender}:**\n${messageText}\n\n`;
    });

    // Create a Blob with the Markdown content
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);

    // Create a temporary anchor element and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chatbot_conversation.md';
    document.body.appendChild(a);
    a.click();

    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});