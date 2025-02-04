// inspired by https://github.com/Jamoxidase/Save-Claude-Convo/blob/main/script.js
// Configuration for the export
const config = {
    includeTimestamps: true,
    includeFileContent: true,
    exportFormat: 'markdown', // 'markdown' or 'json'
    skipLastMessages: 0, // Number of messages to skip at the end of the chat
    assistantName: 'Claude', // Name to display for assistant messages
    humanName: 'Phil', // Name to display for human messages
};

// Format a readable timestamp (date only)
function formatTimestamp(isoString) {
    const date = new Date(isoString);
    const options = { 
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
    };
    return date.toLocaleDateString('en-US', options);
}

// Format a single message
function formatMessage(message, config) {
    console.log('Formatting message:', message); // Debug log
    let formatted = '';
    
    // Add message header with sender and timestamp
    const senderName = message.sender === 'assistant' ? config.assistantName : config.humanName;
    if (config.includeTimestamps) {
        formatted += `### ${senderName} - ${formatTimestamp(message.created_at)}\n\n`;
        console.log('Added header:', formatted); // Debug log
    } else {
        formatted += `### ${senderName}\n\n`;
    }
    
    // Process message content
    console.log('Processing message with UUID:', message.uuid); // Debug log
    console.log('Message content array:', JSON.stringify(message.content, null, 2)); // Debug log in detail
    if (Array.isArray(message.content)) {
        message.content.forEach((contentItem, index) => {
            console.log(`Processing content item ${index}:`, contentItem.type); // Debug log
            
            // Handle different content types
            switch (contentItem.type) {
                case 'text':
                    if (contentItem.text) {
                        const textContent = contentItem.text.trim();
                        formatted += textContent + '\n\n';
                        console.log('Added text content length:', textContent.length);
                    }
                    break;
                    
                case 'tool_use':
                    if (contentItem.name === 'artifacts' && contentItem.input) {
                        console.log('Found artifact:', contentItem.input.title);
                        formatted += `\n### ${contentItem.input.title}\n\n`;
                        formatted += contentItem.input.content + '\n\n';
                        console.log('Added artifact content');
                    }
                    break;
                    
                case 'tool_result':
                    // Skip tool results as they're just confirmations
                    console.log('Skipped tool result');
                    break;
                    
                case 'code':
                    if (contentItem.code) {
                        formatted += '```' + (contentItem.language || '') + '\n';
                        formatted += contentItem.code.trim() + '\n';
                        formatted += '```\n\n';
                        console.log('Added code block');
                    }
                    break;
                    
                case 'example':
                    if (contentItem.content) {
                        formatted += '> Example:\n';
                        formatted += contentItem.content.split('\n').map(line => '> ' + line).join('\n');
                        formatted += '\n\n';
                        console.log('Added example block');
                    }
                    break;
                    
                case 'link':
                    if (contentItem.url) {
                        formatted += `[${contentItem.title || contentItem.url}](${contentItem.url})\n\n`;
                        console.log('Added link');
                    }
                    break;
                    
                default:
                    console.log('Unhandled content type:', contentItem.type);
            }
        });
    }
    
    // Add file content if present and enabled
    if (config.includeFileContent) {
        // Handle attachments
        if (message.attachments && message.attachments.length > 0) {
            message.attachments.forEach(attachment => {
                if (attachment.extracted_content) {
                    formatted += '#### Attached File Content\n\n';
                    formatted += '```\n' + attachment.extracted_content + '\n```\n\n';
                }
            });
        }
        
        // Handle files_v2 (newer format)
        if (message.files_v2 && message.files_v2.length > 0) {
            message.files_v2.forEach(file => {
                formatted += `#### File: ${file.name}\n\n`;
                if (file.content) {
                    formatted += '```\n' + file.content + '\n```\n\n';
                }
            });
        }
        
        // Handle sync_sources if present
        if (message.sync_sources && message.sync_sources.length > 0) {
            message.sync_sources.forEach(source => {
                if (source.content) {
                    formatted += `#### Synced Content: ${source.name || 'Content'}\n\n`;
                    formatted += '```\n' + source.content + '\n```\n\n';
                }
            });
        }
    }
    
    console.log('Final formatted message length:', formatted.length); // Debug log
    return formatted;
}

// Format the entire conversation
function formatConversation(data, config) {
    console.log('Starting conversation formatting...'); // Debug log
    if (config.exportFormat === 'json') {
        return JSON.stringify(data, null, 2);
    }

    let output = '';
    
    // Add conversation title as main heading
    if (data.name) {
        output += `# ${data.name}\n\n`;
    }
    
    // Add export date and description if available
    output += `**Exported:** ${formatTimestamp(data.created_at)}\n\n`;
    if (data.summary) {
        output += `**Description:** ${data.summary}\n\n`;
    }
    output += '---\n\n';
    
    console.log('Chat messages array:', data.chat_messages); // Debug log
    console.log('Number of messages:', data.chat_messages.length); // Debug log
    
    // Process all messages if skipLastMessages is 0, otherwise slice
    const messagesToInclude = config.skipLastMessages > 0
        ? data.chat_messages.slice(0, -config.skipLastMessages)
        : data.chat_messages;
    
    console.log('Messages to process:', messagesToInclude.length); // Debug log
    
    // Format each message
    messagesToInclude.forEach((message, index) => {
        console.log(`Processing message ${index + 1} of ${messagesToInclude.length}`); // Debug log
        const formattedMessage = formatMessage(message, config);
        output += formattedMessage;
        output += '---\n\n';
        console.log(`Message ${index + 1} formatted length:`, formattedMessage.length); // Debug log
    });
    
    console.log('Final output length:', output.length); // Debug log
    return output;
}

// Download the formatted content
function downloadContent(content, format) {
    console.log('Downloading content length:', content.length); // Debug log
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `claude-chat-${timestamp}.${format === 'json' ? 'json' : 'md'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Function to extract a snippet based on starting and ending indices
function extractSnippet(startIndex, endIndex) {
    // Select all <script nonce> tags
    const scriptTags = document.querySelectorAll('script[nonce]');

    // Iterate through each script tag and check for "lastActiveOrg"
    for (let script of scriptTags) {
        const content = script.textContent;
        // Check if the content contains "lastActiveOrg"
        const index = content.indexOf('lastActiveOrg');
        if (index !== -1) {
            console.log('Found "lastActiveOrg" in script content');
            const snippet = content.substring(index + 28, index + 64);
            console.log('Extracted snippet:', snippet); // Debug log
            return snippet;
        }
    }

    console.log('Finished checking all script tags');
    return null;
}

// Main export function
async function exportConversation() {
    try {
        // Get chat UUID from URL
        const chatId = window.location.pathname.split('/').pop();
        console.log('Chat UUID:', chatId);

        // Extract org ID using the new parsing logic
        const orgId = extractSnippet(28, 64);
        if (!orgId) {
            throw new Error('Could not find organization ID');
        }
        console.log('Org ID:', orgId);

        // Construct and fetch the API URL
        const apiUrl = `https://claude.ai/api/organizations/${orgId}/chat_conversations/${chatId}?tree=True&rendering_mode=messages&render_all_tools=true`;
        console.log('Fetching from:', apiUrl);

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch conversation data: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Received data with message count:', data.chat_messages.length); // Debug log
        
        // Format and download the conversation
        const formatted = formatConversation(data, config);
        console.log('Formatted content length:', formatted.length); // Debug log
        downloadContent(formatted, config.exportFormat);
        
        console.log('Export completed successfully!');
    } catch (error) {
        console.error('Error exporting chat:', error);
        alert('Error exporting chat: ' + error.message);
    }
}

// Run the export
exportConversation();
