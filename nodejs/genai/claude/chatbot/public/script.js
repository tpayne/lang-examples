document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chat_container');
    const userInput = document.getElementById('user_input'); // Now a contenteditable div
    const sendButton = document.getElementById('send_button');
    const predictiveTextRibbon = document.getElementById('predictive_text_ribbon'); // New element

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

    // --- Predictive Text Variables ---
    let lastBotMessage = ''; // Stores the last bot message for predictive text generation

    // --- Automatic Theme Detection and Application ---
    function detectAndApplyTheme() {
        const body = document.body;
        // Check for dark mode preference
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (prefersDark) {
            body.classList.add('dark-theme');
        } else {
            body.classList.remove('dark-theme');
        }

        // Optional: Listen for changes in the color scheme
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (e.matches) {
                body.classList.add('dark-theme');
            } else {
                body.classList.remove('dark-theme');
            }
        });
    }

    // Run the theme detection function on load
    detectAndApplyTheme();


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
        // Clear predictive text when closing the chat
        displayPredictiveText([]);
    });


    // Function to add a message to the chat
    function addMessage(sender, message, isBot = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender);

        // Create icon element
        const iconElement = document.createElement('div');
        iconElement.classList.add('message-icon');
        iconElement.textContent = sender === 'user' ? '😀' : '🤖'; // Use emojis for icons

        // Create message content element
        const contentElement = document.createElement('div');
        contentElement.classList.add('message-content');

        // Use marked.js to render Markdown for bot messages
        if (isBot) {
            contentElement.innerHTML = marked.parse(message);
            lastBotMessage = message; // Store the raw bot message for predictive text
        } else {
            // For user messages, display the plain text (or original rich text if preferred)
            // We will display the plain text version that was sent to the bot
            contentElement.textContent = message; // Display the plain text that was sent
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

    /**
     * Displays predictive text suggestions in the ribbon.
     * @param {string[]} suggestions - An array of strings, each a suggested phrase.
     */
    function displayPredictiveText(suggestions) {
        // Ensure predictiveTextRibbon is not null before proceeding
        if (!predictiveTextRibbon) {
            console.error("Predictive text ribbon element not found!");
            return;
        }

        predictiveTextRibbon.innerHTML = ''; // Clear existing suggestions

        if (suggestions.length > 0) {
            predictiveTextRibbon.classList.remove('hidden');
            suggestions.forEach(suggestion => {
                const button = document.createElement('button');
                button.classList.add('predictive-button');
                button.textContent = suggestion;
                button.addEventListener('click', () => {
                    userInput.innerHTML = suggestion; // Set input to suggestion
                    sendMessage(); // Submit the message
                    displayPredictiveText([]); // Clear suggestions after submission
                });
                predictiveTextRibbon.appendChild(button);
            });
        } else {
            predictiveTextRibbon.classList.add('hidden'); // Hide the ribbon if no suggestions
        }
    }

    /**
     * Defines rules for generating predictive text suggestions.
     * Each rule has an array of keywords and a function to generate suggestions.
     * The order matters: more specific rules should come before more general ones.
     */
    const suggestionRules = [
        // --- GitHub Related Suggestions ---
        {
            keywords: ['list all the branches'],
            generate: (msg) => {
                const suggestions = [];
                const match = msg.match(/repo\s+([a-zA-Z0-9_-]+)\s+that is owned by the user\s+([a-zA-Z0-9_-]+)/);
                if (match && match[1] && match[2]) {
                    suggestions.push(`List files in ${match[1]} by ${match[2]}`);
                    suggestions.push(`Create a new branch in ${match[1]} by ${match[2]}`);
                } else {
                    suggestions.push('List files in a GitHub repo');
                    suggestions.push('Create a new branch in a GitHub repo');
                }
                suggestions.push('What else can you do with GitHub?');
                return suggestions;
            }
        },
        {
            keywords: ['list all the files'],
            generate: (msg) => {
                const suggestions = [];
                const match = msg.match(/repo\s+([a-zA-Z0-9_-]+)\s+that is owned by the user\s+([a-zA-Z0-9_-]+)/);
                if (match && match[1] && match[2]) {
                    suggestions.push(`Fetch contents of a file in ${match[1]} by ${match[2]}`);
                    suggestions.push(`Commit changes to ${match[1]} by ${match[2]}`);
                } else {
                    suggestions.push('Fetch contents of a file');
                    suggestions.push('Commit changes to GitHub');
                }
                suggestions.push('What else can you do with GitHub?');
                return suggestions;
            }
        },
        {
            keywords: ['create a new branch'],
            generate: () => [
                'Check if a branch exists',
                'Switch to an existing branch',
                'Create a pull request'
            ]
        },
        {
            keywords: ['commit files', 'upload files'],
            generate: () => [
                'Create a pull request for these changes',
                'List commit history for a file',
                'Fetch repository contents'
            ]
        },
        {
            keywords: ['pull request'],
            generate: () => [
                'List pull requests',
                'Merge a pull request',
                'Check pull request status'
            ]
        },
        {
            keywords: ['fetch repo contents', 'download repository'],
            generate: () => [
                'Save this code to a file',
                'Review this code',
                'List directory contents'
            ]
        },
        {
            keywords: ['github'], // General GitHub mention
            generate: () => [
                'List my public repos',
                'Create a new repo',
                'Review code in a repo',
                'List GitHub actions',
                'Check if a repository exists'
            ]
        },

        // --- Kubernetes Related Suggestions ---
        {
            keywords: ['kubernetes pods'],
            generate: () => [
                'List all Kubernetes deployments',
                'List all Kubernetes services',
                'Get logs for a specific pod',
                'Delete a Kubernetes pod'
            ]
        },
        {
            keywords: ['kubernetes deployments'],
            generate: () => [
                'Get deployment details',
                'Scale a Kubernetes deployment',
                'Create a Kubernetes deployment'
            ]
        },
        {
            keywords: ['kubernetes services'],
            generate: () => [
                'Get service details',
                'Create a Kubernetes service',
                'Delete a Kubernetes service'
            ]
        },
        {
            keywords: ['create a kubernetes resource'],
            generate: () => [
                'List Kubernetes resources',
                'Update a Kubernetes resource',
                'Delete a Kubernetes resource'
            ]
        },
        {
            keywords: ['kubernetes'], // General Kubernetes mention
            generate: () => [
                'List Kubernetes namespaces',
                'List Kubernetes nodes',
                'List Kubernetes secrets',
                'List Kubernetes events',
                'Get Kubernetes version'
            ]
        },

        // --- Database Related Suggestions ---
        {
            keywords: ['database structure', 'database connected', 'database type', 'successfully connected to'],
            generate: () => [
                'List all tables in the database',
                'Select data from a specific table',
                'Dump the database schema',
                'Run an ad-hoc SQL query',
                'List all schemas',
                'List objects in a schema'
            ]
        },
        {
            keywords: ['select data from'],
            generate: () => [
                'List tables in the database',
                'Dump the database structure',
                'Run a custom query'
            ]
        },
        {
            keywords: ['list schemas'],
            generate: () => [
                'List objects in a specific schema',
                'Dump schema structure'
            ]
        },
        {
            keywords: ['ad-hoc sql query'],
            generate: () => [
                'What kind of queries can I run?',
                'Show me example queries'
            ]
        },
        {
            keywords: ['database'], // General database mention
            generate: () => [
                'Connect to a database',
                'List available database types',
                'Troubleshoot database connection'
            ]
        },

        // --- Car Operations (DOSA) Related Suggestions ---
        {
            keywords: ['mot history for the car'],
            generate: (msg) => {
                const suggestions = [];
                const match = msg.match(/car\s+([a-zA-Z0-9]+)/);
                if (match && match[1]) {
                    suggestions.push(`Tell me all the MOT defects for ${match[1]}`);
                }
                suggestions.push('What other car information can you provide?');
                suggestions.push('Check MOT status for another car');
                return suggestions;
            }
        },
        {
            keywords: ['mot defects'],
            generate: () => [
                'What do these defects mean?',
                'How can I fix common MOT defects?'
            ]
        },
        {
            keywords: ['car', 'vehicle'], // General car/vehicle mention
            generate: () => [
                'Get MOT history for a vehicle',
                'Explain car registration numbers'
            ]
        },

        // --- Terraform Related Suggestions ---
        {
            keywords: ['terraform workflow', 'terraform plan', 'terraform apply', 'terraform destroy', 'terraform refresh'],
            generate: () => [
                'Perform a Terraform plan',
                'Perform a Terraform apply',
                'Perform a Terraform destroy',
                'List Terraform workspaces',
                'Set cloud context for Terraform CLI'
            ]
        },
        {
            keywords: ['terraform'], // General Terraform mention
            generate: () => [
                'List Terraform workspaces',
                'Create a Terraform workspace',
                'Run a Terraform plan',
                'Run a Terraform apply',
                'Set cloud context for Terraform CLI'
            ]
        },

        // --- General and Error Suggestions (Lower Priority) ---
        {
            keywords: ['something went wrong', 'not authorized', 'error', 'failed to'],
            generate: () => [
                'Can you try again?',
                'What kind of error occurred?',
                'Start a new conversation'
            ]
        },
        {
            keywords: ['how can i assist you today?', 'what can i help you with?'],
            generate: () => [
                'What are your capabilities?',
                'Tell me about GitHub integration',
                'Tell me about Kubernetes integration',
                'Tell me about database integration',
                'Tell me about car operations',
                'Tell me about Terraform integration'
            ]
        },
    ];

    /**
     * Generates predictive text suggestions based on the last bot message.
     * This is a rule-based example. In a real application, this could be
     * powered by a more sophisticated model or backend logic.
     */
    function generatePredictiveSuggestions() {
        let suggestions = [];
        const lowerCaseBotMessage = typeof lastBotMessage === 'string' ? lastBotMessage.toLowerCase() : '';

        // Iterate through rules and apply the first one that matches
        for (const rule of suggestionRules) {
            const matched = rule.keywords.some(keyword => lowerCaseBotMessage.includes(keyword));
            if (matched) {
                suggestions = rule.generate(lowerCaseBotMessage);
                break; // Stop after the first matching rule
            }
        }

        // Fallback: If no specific rule matches, provide some general suggestions
        if (suggestions.length === 0) {
            suggestions.push('What are your capabilities?');
            suggestions.push('Tell me a joke');
            suggestions.push('How does the predictive text work?');
            suggestions.push('Start a new conversation');
        }

        displayPredictiveText(suggestions);
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

        // Clear predictive text suggestions immediately after sending a message
        displayPredictiveText([]);

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

            // Generate and display new predictive suggestions after bot responds
            generatePredictiveSuggestions();

        } catch (error) {
            console.error('Error sending message:', error);
            // Remove typing indicator
            if (chatContainer.contains(typingIndicatorElement)) {
                chatContainer.removeChild(typingIndicatorElement);
            }
            // Display an error message in the chat
            addMessage('agent', 'Sorry, something went wrong. Please try again.', true);
            // Generate suggestions for error recovery
            generatePredictiveSuggestions();
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
                    // Use textContent to avoid interpreting text as HTML
                    userInput.textContent = messageHistory[historyIndex];
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

    // Helper function to place caret at the end of contenteditable div
    function placeCaretAtEnd(el) {
        el.focus();
        if (typeof window.getSelection != "undefined" &&
            typeof document.createRange != "undefined") {
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
    // This part is already wrapped in DOMContentLoaded, so it's fine.
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
                    .replace(/<\/?b>/g, '**') // Bold
                    .replace(/<\/?i>/g, '*') // Italic
                    .replace(/<\/?u>/g, '__') // Underline
                    .replace(/<a href="(.*?)"[^>]*>(.*?)<\/a>/g, '[$2]($1)') // Links
                    .replace(/<ul>/g, '\n') // Unordered lists
                    .replace(/<\/ul>/g, '\n') // Unordered lists
                    .replace(/<ol>/g, '\n') // Ordered lists
                    .replace(/<\/ol>/g, '\n') // Ordered lists
                    .replace(/<li>/g, '* ') // List items (simple bullet)
                    .replace(/<\/li>/g, '\n') // List items
                    .replace(/<pre>(.*?)<\/pre>/gs, '```\n$1\n```') // Code blocks
                    .replace(/&amp;/g, '&') // Decode HTML entities
                    .replace(/&lt;/g, '<') // Decode HTML entities
                    .replace(/&gt;/g, '>') // Decode HTML entities
                    .replace(/&quot;/g, '"') // Decode HTML entities
                    .replace(/&#39;/g, "'") // Decode HTML entities
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


    // --- Carousel Logic ---
    const carouselInner = document.querySelector('.carousel-inner');
    const carouselPanes = document.querySelectorAll('.carousel-pane');
    const prevButton = document.getElementById('prevPane');
    const nextButton = document.getElementById('nextPane');
    const carouselIndicators = document.getElementById('carouselIndicators');

    let currentPaneIndex = 0;
    const totalPanes = carouselPanes.length;

    // Create indicator dots
    function createIndicators() {
        carouselIndicators.innerHTML = ''; // Clear existing indicators
        for (let i = 0; i < totalPanes; i++) {
            const dot = document.createElement('span');
            dot.classList.add('indicator-dot');
            if (i === currentPaneIndex) {
                dot.classList.add('active');
            }
            dot.dataset.index = i; // Store index for click handling
            dot.addEventListener('click', () => showPane(i));
            carouselIndicators.appendChild(dot);
        }
    }

    // Update active indicator dot
    function updateIndicators() {
        const dots = carouselIndicators.querySelectorAll('.indicator-dot');
        dots.forEach((dot, index) => {
            if (index === currentPaneIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    // Show a specific carousel pane
    function showPane(index) {
        if (index < 0) {
            currentPaneIndex = totalPanes - 1; // Loop to last pane
        } else if (index >= totalPanes) {
            currentPaneIndex = 0; // Loop to first pane
        } else {
            currentPaneIndex = index;
        }
        const offset = -currentPaneIndex * 100;
        carouselInner.style.transform = `translateX(${offset}%)`;
        updateIndicators();
    }

    // Event listeners for carousel arrows
    prevButton.addEventListener('click', () => showPane(currentPaneIndex - 1));
    nextButton.addEventListener('click', () => showPane(currentPaneIndex + 1));

    // Initialize carousel
    createIndicators();
    showPane(0); // Show the first pane initially

    // Optional: Auto-cycle carousel (uncomment to enable)
    // setInterval(() => {
    //     showPane(currentPaneIndex + 1);
    // }, 7000); // Change pane every 7 seconds

});