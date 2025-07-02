// ==UserScript==
// @name         Rage Bait Detector - Enhanced Post Detection for X and Facebook (English) with GUI
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Detects potential "rage bait" in posts, placing a concise score in the top-right and detailed analysis at the bottom, with improved handling for ads and reposts, and enhanced post detection for X and Facebook. Includes a GUI for settings.
// @author       @quanvm0501alt1, @SamekoSaba
// @author       @vmquanalt1
// @author       quanvm0501@gmail.com
// @author       quanvm0501alt1@tutamail.com
// @author       Gemini, Grok // All supported AIs
// @match        http://facebook.com/
// @match        https://facebook.com/
// @match        http://facebook.com/*
// @match        https://facebook.com/*
// @match        http://x.com/
// @match        https://x.com/
// @match        http://x.com/*
// @match        https://x.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://github.com/Quanvm0501alt1/RageBaitDetector/raw/refs/heads/main/rage-bait-detector.user.js
// @downloadURL  https://github.com/Quanvm0501alt1/RageBaitDetector/raw/refs/heads/main/rage-bait-detector.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration (These will be overridden by GUI settings if available) ---
    let GROQCLOUD_API_KEY = 'YOUR_GROQCLOUD_API_KEY_HERE'; // Default placeholder
    let GROQCLOUD_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
    let GROQCLOUD_MODEL = 'llama3-8b-8192'; // Default model

    // List of available GroqCloud models for the dropdown
    const AVAILABLE_GROQCLOUD_MODELS = [
        { id: 'llama3-8b-8192', name: 'Llama 3 8B (Recommended)' },
        { id: 'llama3-70b-8192', name: 'Llama 3 70B' },
        { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
        { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B (Highest RPM, may be unstable)' },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' },
        { id: 'meta-llama/llama-guard-4-12b', name: 'Llama Guard 4 12B' },
        { id: 'meta-llama/llama-prompt-guard-2-22m', name: 'Llama Prompt Guard 2 22M' },
        { id: 'meta-llama/llama-prompt-guard-2-86m', name: 'Llama Prompt Guard 2 86M' },
    ];

    // Heuristic Threshold: If the heuristic score is >= this value, trigger AI analysis.
    const HEURISTIC_THRESHOLD = 5;

    // Selectors for identifying posts and their text content on different platforms.
    const PLATFORM_SELECTORS = {
        'facebook.com': {
            // Even broader and more specific post selectors for Facebook
            post: 'div[role="feed"] > div > div[data-pagelet^="FeedUnit_"], ' +
                  'div[role="feed"] > div > div[data-pagelet^="GroupFeed_"] > div[data-pagelet^="FeedUnit_"], ' +
                  'div[role="feed"] > div > div[data-pagelet^="ProfileFeed_"] > div[data-pagelet^="FeedUnit_"], ' +
                  'div[role="article"][aria-labelledby], ' +
                  'div[data-visualcompletion="lazy-load-initial-render"][tabindex="-1"], ' + // Very common wrapper for new posts
                  'div[data-visualcompletion="ignore-dynamic"][data-ft*="&quot;tn&quot;:&quot;K&quot;"], ' + // Another common post wrapper
                  'div[data-pagelet="Feed"] > div > div > div > div[data-visualcompletion="ignore-dynamic"]', // Added for more general feed posts
            // Text content selectors for Facebook (prioritized for accuracy)
            text: 'div[data-ad-preview="message"], ' +
                  'div[data-testid="post_message"], ' +
                  'div[data-ft*="&quot;tn&quot;:&quot;K&quot;"], ' +
                  'div[dir="auto"] > span[dir="auto"], ' +
                  'div[style*="text-align: start;"], ' +
                  'div[data-visualcompletion="ignore-dynamic"] > span[dir="auto"], ' +
                  'span[dir="auto"], ' +
                  'div[data-visualcompletion="reading-text"], ' +
                  'div[data-testid="post-content"] span[dir="auto"]', // More specific for main text content
            // Target for score placement at the bottom (action bar)
            targetForScoreBottom: 'div[role="feed"] div[aria-label="Actions for this post"], ' +
                                  'div[role="article"] [role="toolbar"], ' +
                                  'div[role="article"][aria-labelledby] > div:nth-child(2) > div:last-child > div:last-child, ' +
                                  'div[role="article"][aria-labelledby] > div:nth-child(2) > div:nth-child(3) > div:last-child, ' +
                                  'div[data-testid="UFI2ReactionSummary"] ~ div[role="toolbar"], ' +
                                  'div[data-visualcompletion="ignore-dynamic"] > div:last-child > div[role="toolbar"]', // Common toolbar at the bottom of posts
            // Target for score placement in the top-right (header area)
            targetForScoreTop: 'div[role="article"][aria-labelledby] > div:first-child, ' +
                               'div[role="feed"] > div > div[data-pagelet^="FeedUnit_"] > div:first-child, ' +
                               'div[role="feed"] > div > div[data-pagelet^="GroupFeed_"] > div[data-pagelet^="FeedUnit_"] > div:first-child, ' +
                               'div[role="feed"] > div > div[data-pagelet^="ProfileFeed_"] > div:first-child, ' +
                               'div[aria-label="More options for this post"], ' +
                               'div[data-visualcompletion="ignore-dynamic"] div[role="button"][aria-label="More options"], ' +
                               'div[data-visualcompletion="ignore-dynamic"] div[role="button"][aria-haspopup="menu"], ' +
                               'div[data-visualcompletion="ignore-dynamic"] > div:first-child > div:last-child > div[role="button"]' // A common pattern for the three-dot menu
        },
        'twitter.com': { // X.com
            post: 'article[data-testid="tweet"], div[data-testid="cellInnerDiv"] > article[role="article"]',
            text: 'div[data-testid="tweetText"], span[dir="auto"], div[lang]',
            targetForScoreBottom: 'div[role="group"][aria-label="Tweet actions"]',
            targetForScoreTop: 'div[data-testid="User-Names"] ~ div[dir="ltr"], div[data-testid="User-Names"]'
        },
        'default': {
            post: 'article, .post, .story, div[class*="post"], div[class*="article"], div[data-testid="post-content"]',
            text: 'p, span, div',
            targetForScoreBottom: '.post-footer, .post-meta, .entry-meta, .post-actions, .article-footer',
            targetForScoreTop: '.post-header, .entry-header'
        }
    };

    // --- Styling for the injected UI elements ---
    GM_addStyle(`
        /* Styles for the detailed score container at the bottom */
        .rage-bait-score-container {
            font-family: 'Inter', sans-serif;
            font-size: 12px;
            padding: 4px 8px;
            margin-left: 8px; /* Space from other buttons */
            border-radius: 8px;
            display: inline-block; /* Allows children to stack */
            vertical-align: middle; /* Vertically align with other inline elements */
            opacity: 0.9;
            transition: opacity 0.3s ease-in-out;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            background-color: #f0f0f0; /* Default light grey */
            color: #333;
            z-index: 9999;
            flex-shrink: 0;
            max-width: 200px; /* Limit overall width */
            white-space: normal; /* Allow text to wrap */
        }
        .rage-bait-score-container:hover {
            opacity: 1;
        }

        /* Styles for the concise score container in the top-right */
        .rage-bait-score-top-right {
            position: absolute;
            top: 8px; /* Distance from top of the post */
            right: 8px; /* Distance from right of the post */
            font-family: 'Inter', sans-serif;
            font-size: 12px;
            padding: 2px 6px; /* Smaller padding for compactness */
            border-radius: 8px;
            opacity: 0.9;
            transition: opacity 0.3s ease-in-out;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            background-color: #f0f0f0; /* Default light grey */
            color: #333;
            z-index: 9999;
            line-height: 1; /* Compact line height */
        }
        .rage-bait-score-top-right:hover {
            opacity: 1;
        }


        /* Common color classes for both score containers */
        .rage-bait-score-low {
            background-color: #d4edda; /* Light green */
            color: #155724;
        }
        .rage-bait-score-medium {
            background-color: #fff3cd; /* Light yellow */
            color: #856404;
        }
        .rage-bait-score-high {
            background-color: #f8d7da; /* Light red */
            color: #721c24;
        }
        .rage-bait-score-loading {
            background-color: #e2e3e5; /* Light grey for loading state */
            color: #6c757d;
        }

        /* AI result specific styling (only for bottom container) */
        .rage-bait-ai-result {
            display: block; /* Make AI result appear on its own line */
            margin-top: 2px; /* Small space above AI text */
            font-weight: bold;
            line-height: 1.2; /* Adjust line height for compactness */
        }

        /* Styling for the test button */
        .rage-bait-test-button {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: #4CAF50; /* Green */
            color: white;
            padding: 10px 15px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 10000; /* Ensure it's on top */
            transition: background-color 0.3s ease;
            font-family: 'Inter', sans-serif;
        }
        .rage-bait-test-button:hover {
            background-color: #45a049;
        }

        /* Styles for the settings GUI */
        .rage-bait-settings-button {
            position: fixed;
            bottom: 20px;
            left: 20px;
            background-color: #007bff; /* Blue */
            color: white;
            padding: 10px 15px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 10000;
            transition: background-color 0.3s ease;
            font-family: 'Inter', sans-serif;
        }
        .rage-bait-settings-button:hover {
            background-color: #0056b3;
        }

        .rage-bait-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10001;
            font-family: 'Inter', sans-serif;
        }

        .rage-bait-modal-content {
            background-color: #fff;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            width: 90%;
            max-width: 500px;
            box-sizing: border-box;
            position: relative;
        }

        .rage-bait-modal-content h2 {
            margin-top: 0;
            color: #333;
            font-size: 20px;
            margin-bottom: 20px;
            text-align: center;
        }

        .rage-bait-modal-content label {
            display: block;
            margin-bottom: 8px;
            color: #555;
            font-weight: bold;
        }

        .rage-bait-modal-content input[type="text"],
        .rage-bait-modal-content select {
            width: 100%;
            padding: 10px;
            margin-bottom: 20px;
            border: 1px solid #ddd;
            border-radius: 6px;
            box-sizing: border-box;
            font-size: 14px;
        }

        .rage-bait-modal-content button {
            background-color: #28a745; /* Green for Save */
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            transition: background-color 0.3s ease;
            width: 100%;
            box-sizing: border-box;
        }

        .rage-bait-modal-content button:hover {
            background-color: #218838;
        }

        .rage-bait-modal-close {
            position: absolute;
            top: 15px;
            right: 15px;
            font-size: 24px;
            cursor: pointer;
            color: #888;
        }
        .rage-bait-modal-close:hover {
            color: #333;
        }
    `);

    // --- Heuristic Rage Bait Scoring Algorithm ---
    /**
     * Calculates a heuristic "rage bait" score for a given text.
     * Score is from 1 to 10.
     * @param {string} text The post content to analyze.
     * @returns {number} The calculated score.
     */
    function calculateHeuristicScore(text) {
        let score = 0;
        const lowerText = text.toLowerCase();

        // 1. Excessive Capitalization (more than 20% of alphabetic characters are uppercase)
        const upperCount = (text.match(/[A-Z]/g) || []).length;
        const alphaCount = (text.match(/[a-zA-Z]/g) || []).length;
        if (alphaCount > 0 && (upperCount / alphaCount) > 0.2) {
            score += 2; // Initial strong penalty
            if ((upperCount / alphaCount) > 0.5) { // Even more for very high caps
                score += 2;
            }
        }

        // 2. Excessive Punctuation (multiple '!', '?', or combined)
        const punctuationCount = (text.match(/[!?]/g) || []).length;
        if (text.includes('!!!') || text.includes('???') || text.includes('!?!') || text.includes('?!?')) {
            score += 3; // Strong penalty for extreme sequences
        } else if (punctuationCount > 5) {
            score += 2; // Moderate penalty for many individual marks
        } else if (punctuationCount > 2) {
            score += 1; // Slight penalty
        }


        // 3. Common Rage Bait Keywords (case-insensitive) - Expanded list
        const keywords = [
            'outrageous', 'unbelievable', 'shocking', 'disgusting', 'furious',
            'you won\'t believe', 'can\'t believe', 'infuriating', 'sickening',
            'must see', 'viral', 'controversial', 'triggered', 'woke', 'cancel culture',
            'liberal', 'conservative', 'insane', 'ridiculous', 'pathetic', 'truth',
            'exposed', 'revealed', 'scandal', 'how dare they', 'this is why',
            'what happened next', 'you need to see this', 'shocking truth', 'wake up',
            'fuming', 'disgrace', 'unacceptable', 'fury', 'outrage', 'sheeple', 'agenda',
            'propaganda', 'fake news', 'tyranny', 'freedom', 'control', 'they don\'t want you to know'
        ];
        keywords.forEach(keyword => {
            if (lowerText.includes(keyword)) {
                score += 1.5; // Increased weight
            }
        });

        // 4. Strong Emotional Language (simple sentiment indicators) - Expanded list
        const emotionalWords = [
            'hate', 'love', 'anger', 'disgust', 'shock', 'trauma', 'victim',
            'hero', 'villain', 'evil', 'good', 'bad', 'wrong', 'right', 'justice',
            'injustice', 'pathetic', 'idiot', 'stupid', 'clown', 'liar', 'fraud',
            'brave', 'coward', 'courage', 'fear', 'despair', 'hope', 'rage', 'fury'
        ];
        emotionalWords.forEach(word => {
            if (lowerText.includes(word)) {
                score += 0.7; // Slightly increased weight
            }
        });

        // 5. Questions designed to provoke a strong reaction - Increased sensitivity
        if (lowerText.includes('do you agree') || lowerText.includes('what do you think') || lowerText.includes('am i wrong') || lowerText.includes('tell me why') || lowerText.includes('are you serious')) {
            score += 1.5; // Increased weight
        }

        // Cap score at 10 and ensure minimum 1
        return Math.min(10, Math.max(1, Math.round(score)));
    }

    // --- GroqCloud AI Analysis Function ---
    /**
     * Sends post content to GroqCloud API for "rage bait" analysis.
     * @param {string} postContent The text content of the post.
     * @returns {Promise<string>} A promise that resolves with the AI's analysis result.
     */
    async function analyzeWithGroqCloud(postContent) {
        // Use the dynamically loaded API key and model
        if (!GROQCLOUD_API_KEY || GROQCLOUD_API_KEY === 'YOUR_GROQCLOUD_API_KEY_HERE') {
            console.error('GroqCloud API Key is not set. Please update the userscript with your key via settings GUI.');
            return 'AI Error: API Key Missing';
        }

        const messages = [
            {
                role: "system",
                content: "You are an AI that analyzes text for 'rage bait'. Rage bait is content designed to provoke an angry, emotional, or extreme reaction from an audience, often for engagement or attention. Respond with 'YES' if the text is likely rage bait, 'NO' if it is not, and 'UNCERTAIN' if you cannot determine. Provide a brief, concise explanation (1-2 sentences) for your reasoning. Start your response with YES, NO, or UNCERTAIN."
            },
            {
                role: "user",
                content: `Is the following text rage bait?:\n\n"${postContent}"`
            }
        ];

        try {
            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "POST",
                    url: GROQCLOUD_API_URL,
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${GROQCLOUD_API_KEY}`
                    },
                    data: JSON.stringify({
                        model: GROQCLOUD_MODEL, // Use the dynamically loaded model
                        messages: messages,
                        temperature: 0.1, // Keep temperature low for more deterministic answers
                        max_tokens: 150 // Limit response length
                    }),
                    onload: function(response) {
                        if (response.status >= 200 && response.status < 300) {
                            resolve(JSON.parse(response.responseText));
                        } else {
                            reject(new Error(`GroqCloud API Error: ${response.status} ${response.statusText} - ${response.responseText}`));
                        }
                    },
                    onerror: function(error) {
                        reject(new Error(`Network error or CORS issue with GroqCloud API: ${error}`));
                    },
                    ontimeout: function() {
                        reject(new Error('GroqCloud API request timed out.'));
                    }
                });
            });

            if (response && response.choices && response.choices.length > 0 && response.choices[0].message) {
                return response.choices[0].message.content.trim();
            } else {
                return 'AI Error: Unexpected response format.';
            }
        } catch (error) {
            console.error('Error calling GroqCloud API:', error);
            return `AI Error: ${error.message}`;
        }
    }

    // --- Text Extraction for Specific Platforms ---
    /**
     * Attempts to extract the primary text content from a post element based on the current platform.
     * @param {HTMLElement} postElement The DOM element representing a post.
     * @returns {string} The extracted text content.
     */
    function getPostText(postElement) {
        const hostname = window.location.hostname;
        let textContent = '';

        if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
            // For X/Twitter, collect text from multiple potential sources
            const textSources = [
                ...postElement.querySelectorAll('div[data-testid="tweetText"]'),
                ...postElement.querySelectorAll('span[dir="auto"]'),
                ...postElement.querySelectorAll('div[lang]'),
                // Fallback for elements with aria-label that might contain text (e.g., image descriptions)
                ...postElement.querySelectorAll('[aria-label]')
            ];

            const collectedTexts = new Set(); // Use a Set to avoid duplicate text

            for (const source of textSources) {
                let currentText = '';
                if (source.hasAttribute('aria-label') && source.tagName !== 'A') { // Avoid links
                    currentText = source.getAttribute('aria-label').trim();
                } else {
                    currentText = source.textContent.trim();
                }

                if (currentText.length > 0) {
                    collectedTexts.add(currentText);
                }
            }
            textContent = Array.from(collectedTexts).filter(text => text.length > 0).join('\n---\n').trim();

        } else if (hostname.includes('facebook.com')) {
            // For Facebook, try to find text content in specific selectors
            const textSelectors = PLATFORM_SELECTORS['facebook.com'].text.split(', ');
            for (const selector of textSelectors) {
                const potentialTextElement = postElement.querySelector(selector);
                if (potentialTextElement) {
                    textContent = potentialTextElement.textContent.trim();
                    if (textContent.length > 0) break;
                }
            }
            // Add fallback for specific cases on Facebook
            if (textContent.length === 0) {
                const storyContent = postElement.querySelector('[data-pagelet="MediaViewer"] [aria-label="Story content"]');
                if (storyContent) {
                    textContent = storyContent.textContent.trim();
                }
            }
            // Generic fallback for text within Facebook posts
            if (textContent.length === 0) {
                const genericTextElements = postElement.querySelectorAll('div[dir="auto"], span[dir="auto"], p');
                for (const el of genericTextElements) {
                    const text = el.textContent.trim();
                    // Avoid irrelevant UI text (e.g., like counts, comments)
                    if (text.length > 10 && !text.match(/^\d+ (Likes|Comments|Shares)/)) {
                        textContent = text;
                        break;
                    }
                }
            }

        } else { // Default
            const textSelectors = PLATFORM_SELECTORS['default'].text.split(', ');
            for (const selector of textSelectors) {
                const potentialTextElement = postElement.querySelector(selector);
                if (potentialTextElement) {
                    textContent = potentialTextElement.textContent.trim();
                    if (textContent.length > 0) break;
                }
            }
        }

        // Fallback to direct text content if specific selectors fail or result in empty text
        if (textContent.length === 0) {
            textContent = postElement.textContent.trim();
        }

        // Remove common UI text that isn't part of the post content
        textContent = textContent.replace(/Like|Comment|Share|Retweet|Quote|Reply|View all comments|See more|Grok AI|Ad|Promoted|Sponsored|Được tài trợ/g, '').trim();

        return textContent;
    }


    // --- Main Logic to Process Posts ---
    /**
     * Processes a single post element, calculates its score, and displays results.
     * @param {HTMLElement} postElement The DOM element representing a post.
     */
    async function processPost(postElement) {
        const hostname = window.location.hostname;

        // Skip if already processed
        if (postElement.dataset.rageBaitChecked && postElement.dataset.rageBaitChecked === 'true') {
            return;
        }

        // Check for ads on X.com and Facebook
        let isAd = false;
        if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
            const userNameSection = postElement.querySelector('[data-testid="User-Names"]');
            if (userNameSection && (userNameSection.textContent.includes('Ad') || userNameSection.textContent.includes('Promoted'))) {
                isAd = true;
            }
        } else if (hostname.includes('facebook.com')) {
            // Facebook ads often have a 'Sponsored' or 'Được tài trợ' indicator
            if (postElement.textContent.includes('Sponsored') || postElement.textContent.includes('Được tài trợ')) {
                isAd = true;
            }
        }

        const postContent = getPostText(postElement);

        // Log extracted content for debugging
        console.log(`Processing post. Is Ad: ${isAd}. Content length: ${postContent.length}. Content snippet: "${postContent.substring(0, Math.min(postContent.length, 100))}..."`);

        if (!postContent || postContent.length < 30) { // Reduced minimum length slightly for very short valid posts
            // Mark as checked to prevent future attempts for too-short posts
            postElement.dataset.rageBaitChecked = 'true';
            console.log(`Skipping post due to insufficient content length (${postContent.length}).`);
            return;
        }

        // Mark as checked *before* performing heavy operations
        postElement.dataset.rageBaitChecked = 'true';

        const heuristicScore = calculateHeuristicScore(postContent);

        // --- 1. Create and inject the CONCISE TOP-RIGHT score display ---
        const topRightScoreContainer = document.createElement('div');
        topRightScoreContainer.className = 'rage-bait-score-top-right';
        if (heuristicScore >= 8) {
            topRightScoreContainer.classList.add('rage-bait-score-high');
        } else if (heuristicScore >= 5) {
            topRightScoreContainer.classList.add('rage-bait-score-medium');
        } else {
            topRightScoreContainer.classList.add('rage-bait-score-low');
        }
        topRightScoreContainer.innerHTML = `<strong>${heuristicScore}/10</strong>`;

        // Ensure post element is relatively positioned for absolute children
        if (window.getComputedStyle(postElement).position !== 'relative' && window.getComputedStyle(postElement).position !== 'absolute') {
            postElement.style.position = 'relative';
        }

        let appendedTopRight = false;
        if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
            // Try specific header elements for X, in order of preference
            const selectors = PLATFORM_SELECTORS['twitter.com'].targetForScoreTop.split(', ');
            for (const selector of selectors) {
                const headerInfoDiv = postElement.querySelector(selector);
                if (headerInfoDiv) {
                    const caretButton = headerInfoDiv.querySelector('[data-testid="caret"]');
                    if (caretButton && caretButton.parentElement) {
                        caretButton.parentElement.insertBefore(topRightScoreContainer, caretButton);
                        appendedTopRight = true;
                        break;
                    } else {
                        // Fallback if caret not found but headerInfoDiv exists
                        headerInfoDiv.prepend(topRightScoreContainer);
                        appendedTopRight = true;
                        break;
                    }
                }
            }
        } else if (hostname.includes('facebook.com')) {
             // Try specific header elements for Facebook
             const selectors = PLATFORM_SELECTORS['facebook.com'].targetForScoreTop.split(', ');
             for (const selector of selectors) {
                 const headerDiv = postElement.querySelector(selector);
                 if (headerDiv) {
                     const moreOptionsButton = headerDiv.querySelector('div[aria-label="More options for this post"]');
                     const moreOptionsButton2 = headerDiv.querySelector('div[role="button"][aria-haspopup="menu"]');
                     const moreOptionsButton3 = headerDiv.querySelector('div[role="button"][aria-label="Actions for this post"]');

                     if (moreOptionsButton && moreOptionsButton.parentElement) {
                         moreOptionsButton.parentElement.insertBefore(topRightScoreContainer, moreOptionsButton);
                         appendedTopRight = true;
                         break;
                     } else if (moreOptionsButton2 && moreOptionsButton2.parentElement) {
                         moreOptionsButton2.parentElement.insertBefore(topRightScoreContainer, moreOptionsButton2);
                         appendedTopRight = true;
                         break;
                     } else if (moreOptionsButton3 && moreOptionsButton3.parentElement) {
                         moreOptionsButton3.parentElement.insertBefore(topRightScoreContainer, moreOptionsButton3);
                         appendedTopRight = true;
                         break;
                     } else {
                         // If "More options" button not found, append to the end of the header div
                         headerDiv.appendChild(topRightScoreContainer);
                         appendedTopRight = true;
                         break;
                     }
                 }
             }
        }
        // Fallback for top-right if not appended to specific header or for default sites
        if (!appendedTopRight) {
             postElement.appendChild(topRightScoreContainer);
        }


        // --- 2. Create and inject the DETAILED BOTTOM action bar score display ---
        // Skip detailed analysis for ads to prevent misalignment and unnecessary API calls.
        if (isAd) {
             console.log('Skipping detailed rage bait analysis for ad:', postContent.substring(0, Math.min(postContent.length, 50)) + '...');
             return; // Exit here, don't show bottom score or run AI for ads
        }

        const bottomActionScoreContainer = document.createElement('div');
        bottomActionScoreContainer.className = 'rage-bait-score-container';
        if (heuristicScore >= 8) {
            bottomActionScoreContainer.classList.add('rage-bait-score-high');
        } else if (heuristicScore >= 5) {
            bottomActionScoreContainer.classList.add('rage-bait-score-medium');
        } else {
            bottomActionScoreContainer.classList.add('rage-bait-score-low');
        }
        bottomActionScoreContainer.innerHTML = `Heuristic Rage Bait Score: <strong>${heuristicScore}/10</strong>`;

        let targetSelectorBottom = PLATFORM_SELECTORS[hostname.includes('twitter.com') || hostname.includes('x.com') ? 'twitter.com' : (hostname.includes('facebook.com') ? 'facebook.com' : 'default')].targetForScoreBottom;
        let targetElementBottom = postElement.querySelector(targetSelectorBottom);

        if (!targetElementBottom) {
            // Fallback: search within the entire post element for common action bar elements
            targetElementBottom = postElement.querySelector('div[role="group"][aria-label], div[data-testid*="actions"], footer');
            if (!targetElementBottom) {
                 console.warn(`Could not find specific target for bottom score placement using selector "${targetSelectorBottom}". Appending to post element.`);
                 targetElementBottom = postElement;
            }
        }
        targetElementBottom.appendChild(bottomActionScoreContainer);


        // Only add AI analysis to the bottom container if heuristic score is high enough
        if (heuristicScore >= HEURISTIC_THRESHOLD) {
            const aiResultSpan = document.createElement('span');
            aiResultSpan.className = 'rage-bait-ai-result rage-bait-score-loading';
            aiResultSpan.textContent = ' (AI Analyzing...)';
            bottomActionScoreContainer.appendChild(aiResultSpan);

            try {
                const aiResult = await analyzeWithGroqCloud(postContent);
                aiResultSpan.textContent = ` (AI: ${aiResult})`;
                aiResultSpan.classList.remove('rage-bait-score-loading');
                if (aiResult.startsWith('YES')) {
                    aiResultSpan.style.color = '#a00'; // Darker red
                } else if (aiResult.startsWith('NO')) {
                    aiResultSpan.style.color = '#0a0'; // Darker green
                } else {
                    aiResultSpan.style.color = '#888'; // Grey
                }
            } catch (error) {
                aiResultSpan.textContent = ` (AI Error)`;
                aiResultSpan.style.color = '#f00';
                console.error('Error during AI analysis:', error);
            }
        }
    }

    // --- Observer to detect new posts dynamically loaded ---
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        const hostname = window.location.hostname;
                        let postSelector = PLATFORM_SELECTORS['default'].post;

                        if (hostname.includes('facebook.com')) {
                            postSelector = PLATFORM_SELECTORS['facebook.com'].post;
                        } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
                            postSelector = PLATFORM_SELECTORS['twitter.com'].post;
                        }

                        // Process the added node itself if it's a post
                        if (node.matches && node.matches(postSelector)) {
                            processPost(node);
                        }

                        // Recursively check for posts within the added node's children
                        if (node.querySelectorAll) {
                            // Use a more specific selector for X.com to avoid processing non-post articles
                            const specificPostSelector = (hostname.includes('twitter.com') || hostname.includes('x.com')) ? PLATFORM_SELECTORS['twitter.com'].post : postSelector;

                            node.querySelectorAll(specificPostSelector).forEach(post => {
                                // Ensure we're not reprocessing a parent that contains this post
                                if (!post.dataset.rageBaitChecked) {
                                    processPost(post);
                                }
                            });
                        }
                    }
                });
            }
        });
    });

    // Start observing the document body for changes
    observer.observe(document.body, { childList: true, subtree: true });

    // --- Initial scan of existing posts on page load ---
    function initialScan() {
        const hostname = window.location.hostname;
        let postSelector = PLATFORM_SELECTORS['default'].post;

        if (hostname.includes('facebook.com')) {
            postSelector = PLATFORM_SELECTORS['facebook.com'].post;
        } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
            postSelector = PLATFORM_SELECTORS['twitter.com'].post;
        }

        document.querySelectorAll(postSelector).forEach(processPost);
    }

    // Run initial scan after the DOM is fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialScan);
    } else {
        initialScan();
    }

    // --- Testing System ---
    /**
     * Mocks the GroqCloud API call for testing purposes.
     * @param {string} postContent The content to "analyze".
     * @returns {Promise<string>} A promise resolving with a mock AI result.
     */
    async function mockAnalyzeWithGroqCloud(postContent) {
        const lowerContent = postContent.toLowerCase();

        // High rage bait indicators
        if (lowerContent.includes('outrageous') || lowerContent.includes('unbelievable') || lowerContent.includes('shocking') || lowerContent.includes('insane') || lowerContent.includes('why is this happening')) {
            return 'YES: This text contains strong provocative language designed to elicit a strong emotional response.';
        }
        // Medium rage bait indicators
        if (lowerContent.includes('frustrated') || lowerContent.includes('controversial') || lowerContent.includes('ridiculous') || lowerContent.includes('what do you think') || lowerContent.includes('am i wrong') || lowerContent.includes('tell me why')) {
            return 'YES: The text uses emotionally charged words and asks for provocative opinions.';
        }
        // Low/Neutral indicators
        if (lowerContent.includes('pleasant') || lowerContent.includes('peaceful') || lowerContent.includes('calm') || lowerContent.includes('neutral') || lowerContent.includes('capital of france')) {
            return 'NO: The text appears neutral and non-provocative, focusing on factual or calm observations.';
        }

        return 'UNCERTAIN: The mock AI could not determine based on its predefined rules.';
    }

    /**
     * Runs a series of predefined tests for the heuristic algorithm and mock AI.
     * Logs results to the console.
     */
    async function runTests() {
        console.log('--- Running Rage Bait Detector Tests ---');

        const testCases = [
            {
                name: 'High Rage Bait (Heuristic & AI)',
                text: 'This is the most OUTRAGEOUS thing I have ever seen!!! You won\'t BELIEVE what happened next! Share if you agree!',
                expectedHeuristic: 10,
                expectedAI: 'YES'
            },
            {
                name: 'Medium Rage Bait (Heuristic)',
                text: 'I\'m so frustrated with the current state of affairs. What do you think about this controversial topic?',
                expectedHeuristic: 6,
                expectedAI: 'YES'
            },
            {
                name: 'Low Rage Bait (Heuristic & AI)',
                text: 'The weather today is quite pleasant. I plan to go for a peaceful walk in the park this afternoon.',
                expectedHeuristic: 1,
                expectedAI: 'NO'
            },
            {
                name: 'Mixed Content',
                text: 'Some people are so ridiculous! But then again, I had a nice cup of tea this morning. What\'s your opinion?',
                expectedHeuristic: 4,
                expectedAI: 'YES'
            },
            {
                name: 'Excessive Caps/Punctuation',
                text: 'WHY IS THIS HAPPENING?!?! THIS IS INSANE!!!',
                expectedHeuristic: 10,
                expectedAI: 'YES'
            },
            {
                name: 'Neutral Question',
                text: 'What is the capital of France?',
                expectedHeuristic: 1,
                expectedAI: 'NO'
            }
        ];

        for (const test of testCases) {
            console.log(`\n--- Test Case: "${test.name}" ---`);
            console.log(`Test Text: "${test.text}"`);

            // Test Heuristic Score
            const heuristicResult = calculateHeuristicScore(test.text);
            console.log(`Heuristic Score: ${heuristicResult}/10 (Expected: ${test.expectedHeuristic})`);
            if (Math.abs(heuristicResult - test.expectedHeuristic) <= 1) {
                console.log('Heuristic Test: PASSED (within tolerance)');
            } else {
                console.warn('Heuristic Test: FAILED');
            }

            // Test Mock AI Analysis
            const aiResult = await mockAnalyzeWithGroqCloud(test.text);
            console.log(`Mock AI Result: "${aiResult}"`);
            if (aiResult.startsWith(test.expectedAI)) {
                console.log('Mock AI Test: PASSED');
            } else {
                console.warn('Mock AI Test: FAILED');
            }
        }
        console.log('\n--- Tests Finished ---');
        console.log('Rage Bait Detector tests completed. Check your browser console for results.');
    }

    // Add a button to trigger tests
    function addTestButton() {
        const testButton = document.createElement('button');
        testButton.className = 'rage-bait-test-button';
        testButton.textContent = 'Run Tests';
        testButton.onclick = runTests;
        document.body.appendChild(testButton);
    }

    // Add the test button once the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addTestButton);
    } else {
        addTestButton();
    }

    // --- Settings GUI Functions ---
    let settingsModal = null;

    async function loadSettings() {
        GROQCLOUD_API_KEY = await GM_getValue('groqCloudApiKey', 'YOUR_GROQCLOUD_API_KEY_HERE');
        GROQCLOUD_MODEL = await GM_getValue('groqCloudModel', 'llama3-8b-8192');
        console.log('Settings loaded:', { GROQCLOUD_API_KEY: GROQCLOUD_API_KEY.substring(0, 5) + '...', GROQCLOUD_MODEL });
    }

    async function saveSettings() {
        const apiKeyInput = document.getElementById('groq-api-key-input');
        const modelSelect = document.getElementById('groq-model-select');

        if (apiKeyInput && modelSelect) {
            GROQCLOUD_API_KEY = apiKeyInput.value.trim();
            GROQCLOUD_MODEL = modelSelect.value;

            await GM_setValue('groqCloudApiKey', GROQCLOUD_API_KEY);
            await GM_setValue('groqCloudModel', GROQCLOUD_MODEL);

            console.log('Settings saved:', { GROQCLOUD_API_KEY: GROQCLOUD_API_KEY.substring(0, 5) + '...', GROQCLOUD_MODEL });
            console.log('Settings saved successfully! Please refresh the page for changes to take full effect.');
            closeSettingsModal();
        }
    }

    function openSettingsModal() {
        if (settingsModal) {
            settingsModal.style.display = 'flex';
            // Load current values into the form when opening
            document.getElementById('groq-api-key-input').value = GROQCLOUD_API_KEY;
            document.getElementById('groq-model-select').value = GROQCLOUD_MODEL;
            return;
        }

        settingsModal = document.createElement('div');
        settingsModal.className = 'rage-bait-modal-overlay';
        settingsModal.innerHTML = `
            <div class="rage-bait-modal-content">
                <span class="rage-bait-modal-close">&times;</span>
                <h2>Rage Bait Detector Settings</h2>
                <label for="groq-api-key-input">GroqCloud API Key:</label>
                <input type="text" id="groq-api-key-input" placeholder="Enter your GroqCloud API Key">

                <label for="groq-model-select">Select AI Model:</label>
                <select id="groq-model-select">
                    ${AVAILABLE_GROQCLOUD_MODELS.map(model => `<option value="${model.id}">${model.name}</option>`).join('')}
                </select>

                <button id="save-settings-button">Save Settings</button>
            </div>
        `;
        document.body.appendChild(settingsModal);

        // Add event listeners
        settingsModal.querySelector('.rage-bait-modal-close').onclick = closeSettingsModal;
        settingsModal.querySelector('#save-settings-button').onclick = saveSettings;

        // Load current values into the form
        document.getElementById('groq-api-key-input').value = GROQCLOUD_API_KEY;
        document.getElementById('groq-model-select').value = GROQCLOUD_MODEL;
    }

    function closeSettingsModal() {
        if (settingsModal) {
            settingsModal.style.display = 'none';
        }
    }

    // Add a button to open the settings GUI
    function addSettingsButton() {
        const settingsButton = document.createElement('button');
        settingsButton.className = 'rage-bait-settings-button';
        settingsButton.textContent = 'Open Settings';
        settingsButton.onclick = openSettingsModal;
        document.body.appendChild(settingsButton);
    }

    // Load settings and add GUI button on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            await loadSettings();
            addSettingsButton();
            addTestButton(); // Keep the test button
        });
    } else {
        (async () => {
            await loadSettings();
            addSettingsButton();
            addTestButton(); // Keep the test button
        })();
    }

})();
