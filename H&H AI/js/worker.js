// worker.js
importScripts('ai_model.js');
importScripts('https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.8.0/math.js');
importScripts('https://cdn.jsdelivr.net/npm/compromise@14.11.2/builds/compromise.min.js'); // Advanced Public CDN NLP
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.11.0/dist/tf.min.js'); // TensorFlow
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/qna@1.0.1/dist/qna.min.js'); // TensorFlow Extractive QnA
try { importScripts('https://cdn.jsdelivr.net/npm/brain.js'); } catch(e) {} // Brain.js
try { importScripts('https://unpkg.com/ml5@latest/dist/ml5.min.js'); } catch(e) {} // ml5.js
try { importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js'); } catch(e) {} // ONNX Runtime Web
try { importScripts('db/index.js'); } catch(e) {} // Load the dynamic Database Index

// Load TF Model
let tfQnAModel = null;
async function initTF() {
    try {
        await tf.ready();
        tfQnAModel = await qna.load();
    } catch(e) {
        console.error("TF Initialization Error:", e);
    }
}
initTF();

const queryCache = new Map();
const MAX_CACHE_SIZE = 100;

// Memory System
let memory = {
    lastEntity: "",
    lastTopic: "",
    conversationHistory: [],
    wikiTextCache: new Map() // Cache full wikipedia text for entities
};

// ==========================================
// UTILITIES
// ==========================================

function formatAsSteps(text) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let stepOutput = "Here is a step-by-step breakdown:\n\n";
    let stepNum = 1;
    for (let s of sentences) {
        let clean = s.trim().replace(/<[^>]*>?/gm, ''); 
        if (clean.length > 15) {
            stepOutput += `${stepNum}. ${clean}\n`;
            stepNum++;
        }
    }
    return stepOutput;
}

function stripFillers(text) {
    const fillers = /^(nice|cool|awesome|great|ok|okay|so|and|well|but|tell me|wow|anyway|yes|no|yeah|yep|nope)[\s,]+/gi;
    let cleaned = text;
    while (fillers.test(cleaned)) {
        cleaned = cleaned.replace(fillers, "").trim();
    }
    return cleaned;
}

function resolvePronouns(text) {
    if (!memory.lastEntity) return text;
    const pronounRegex = /\b(he|she|it|his|her|its|him|they|them|their)\b/i;
    if (pronounRegex.test(text)) {
        // Replace the first pronoun with the entity to form a solid search string
        return text.replace(pronounRegex, memory.lastEntity);
    }
    return text;
}

// ==========================================
// EXTRACTIVE Q&A ENGINE (TensorFlow ML)
// ==========================================

async function extractBestAnswer(fullText, question) {
    if (tfQnAModel) {
        try {
            // TensorFlow requires a sensible context length, taking first 10k chars
            const context = fullText.substring(0, 10000);
            const answers = await tfQnAModel.findAnswers(question, context);
            
            if (answers && answers.length > 0) {
                // Return the highest confidence answer
                return answers[0].text;
            }
        } catch(e) {
            console.error("TF QnA Error:", e);
        }
    }

    // Fallback to manual heuristics if TF fails or hasn't loaded
    const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [];
    if (sentences.length === 0) return null;

    const stopwords = ["is", "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "what", "when", "where", "how", "why", "did", "does", "do", "he", "she", "it", "his", "her", "their", "are", "was", "were", "isnt", "arent", "dont", "doesnt"];
    const words = question.toLowerCase().split(/\s+/).map(w => w.replace(/[^\w]/g, ''));
    
    // Convert synonyms to help matching (e.g. "subs" -> "subscribers")
    const keywords = [];
    for (let w of words) {
        if (w.length <= 2 || stopwords.includes(w)) continue;
        if (w === "subs") keywords.push("subscribers");
        else if (w === "start") keywords.push("began", "created", "launched", "started");
        else keywords.push(w);
    }
    const finalKeywords = keywords.flat();

    let bestScore = -1;
    let bestSentence = "";

    for (let s of sentences) {
        let score = 0;
        let sLower = s.toLowerCase();

        // Keyword overlap
        for (let kw of finalKeywords) {
            if (sLower.includes(kw)) {
                score += 5;
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestSentence = s.trim();
        }
    }

    return bestScore > 0 ? bestSentence : null;
}

// ==========================================
// API FETCHERS
// ==========================================

function fetchLocalDatabase(entity) {
    if (typeof knowledgeIndex === 'undefined') return null;
    
    let entityLower = entity.toLowerCase();
    
    // 1. Exact Match
    if (knowledgeIndex[entityLower]) {
        try {
            importScripts(`db/${knowledgeIndex[entityLower]}`);
            return self.chunkData[entityLower];
        } catch(e) {}
    }
    
    let entityWords = entityLower.split(/[^\w\-]+/);
    let hasCodingKeyword = entityWords.some(w => ['html', 'css', 'javascript', 'js', 'code', 'script', 'function', 'tag', 'property', 'python'].includes(w));
    
    // 2. Fuzzy Keyword Match
    let bestKey = null;
    
    for (let key in knowledgeIndex) {
        if (entityLower === key) continue;
        
        let matchCount = 0;
        let keyWords = key.split(/[^\w\-]+/);
        
        for (let kw of keyWords) {
            if (kw.length > 2 && entityWords.includes(kw)) {
                matchCount++;
            }
        }
        
        if (matchCount > 0) {
            let score = matchCount / keyWords.length;
            
            // Strictly require a coding intent keyword to allow fuzzy matching, preventing random English words from returning code
            if (!hasCodingKeyword && score < 1.0) continue; 
            
            if (!bestKey || score > bestKey.score) {
                bestKey = { key: key, score: score };
            }
        }
    }
    
    if (bestKey && bestKey.score >= 0.3) {
        try {
            importScripts(`db/${knowledgeIndex[bestKey.key]}`);
            return self.chunkData[bestKey.key];
        } catch(e) {}
    }
    
    return null;
}

async function fetchWikipediaFullText(entity) {
    if (memory.wikiTextCache.has(entity)) return memory.wikiTextCache.get(entity);
    try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(entity)}&format=json&origin=*`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            if (pageId !== "-1" && pages[pageId].extract) {
                const text = pages[pageId].extract;
                memory.wikiTextCache.set(entity, text);
                return text;
            }
        }
    } catch(e) {}
    return null;
}

async function fetchWikipediaSummary(entity) {
    // 1. Try offline database first
    let localData = fetchLocalDatabase(entity);
    if (localData) return localData;

    // 2. Fallback to internet
    try {
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(entity)}`);
        if (res.ok) {
            const data = await res.json();
            return data.extract || null;
        }
    } catch(e) {}
    return null;
}

async function fetchDuckDuckGo(query) {
    try {
        const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
        if (res.ok) {
            const data = await res.json();
            if (data.Abstract) {
                return data.Abstract;
            } else if (data.RelatedTopics && data.RelatedTopics.length > 0 && data.RelatedTopics[0].Text) {
                return data.RelatedTopics[0].Text;
            }
        }
    } catch(e) {}
    return null;
}

// ==========================================
// MAIN NLP ROUTER
// ==========================================

self.onmessage = async function(e) {
    if (e.data && e.data.type === 'analyze') {
        const text = e.data.text || "";
        let rawText = e.data.rawText || text;
        
        if (queryCache.has(rawText)) {
            self.postMessage({ status: 'success', response: queryCache.get(rawText), cached: true });
            return;
        }

        try {
            // Split compound sentences into manageable clauses using the Compromise NLP CDN
            let clauses = [rawText];
            if (typeof nlp !== 'undefined') {
                let parsed = nlp(rawText).clauses().out('array');
                if (parsed && parsed.length > 0) {
                    clauses = parsed;
                }
            } else {
                // Basic fallback splitting
                clauses = rawText.split(/(?:,|\band\b|\bthen\b)/i).map(s => s.trim()).filter(s => s.length > 2);
            }

            let isConcise = /\b(concise|short|brief|summarize)\b/i.test(rawText);

            let responses = [];
            for (let clause of clauses) {
                // Filter out purely modifier clauses so it doesn't search for the definition of "concise"
                if (/^(and\s+)?(also\s+)?(tell\s+me\s+)?(make\s+it\s+)?(be\s+)?(concise|short|brief|summarize)$/i.test(clause.trim())) {
                    continue;
                }
                
                let res = await processSingleQuery(clause);
                if (res) {
                    if (isConcise) {
                        let sentences = res.match(/[^.!?]+[.!?]+/g) || [res];
                        if (sentences.length > 2) res = sentences.slice(0, 2).join(" ").trim();
                    }
                    responses.push(res);
                }
            }

            let finalResponse = responses.join("\n\n");
            if (!finalResponse) finalResponse = "I'm not exactly sure how to respond to that context.";
            
            // Add to Cache
            if (!finalResponse.includes("System Error")) {
                if (queryCache.size >= MAX_CACHE_SIZE) {
                    const firstKey = queryCache.keys().next().value;
                    queryCache.delete(firstKey);
                }
                queryCache.set(rawText, finalResponse);
                
                memory.conversationHistory.push({ user: rawText, ai: finalResponse });
                if (memory.conversationHistory.length > 10) memory.conversationHistory.shift();
            }

            self.postMessage({ status: 'success', response: finalResponse, cached: false });
        } catch (error) {
            self.postMessage({ status: 'error', message: error.message || error.toString() });
        }
    }
};

async function processSingleQuery(rawText) {

        // 1. PRE-PROCESSING
        let cleanText = rawText.replace(/[\?!\.]+$/, "").trim();
        cleanText = stripFillers(cleanText);
        
        // Remove leading conversational glue so that follow-up clauses hit engines correctly
        cleanText = cleanText.replace(/^(and\s+|also\s+|then\s+|so\s+|please\s+|tell\s+me\s+)+/gi, "").trim();
        
        const contextualText = resolvePronouns(cleanText);
        const lowerRaw = cleanText.toLowerCase();
        const contextualLowerRaw = contextualText.toLowerCase();

        let response = null;

        try {
            // 1.5 EMOTION & GREETING ENGINE
            const greetings = ["hello", "hi", "hey", "greetings", "sup", "yo"];
            if (!response && greetings.includes(lowerRaw)) {
                response = "Hello! I am Helios AI, your fully offline smart assistant. How can I help you today?";
            }

            const praiseRegex = /^(you are|you're)\s+(awesome|amazing|great|the best|smart|intelligent|good)|(nice|good job|excellent)/i;
            if (!response && praiseRegex.test(lowerRaw)) {
                response = "Thank you! I'm constantly learning and striving to be the best offline AI. What else can we build together?";
            }

            const hateRegex = /^(you are|you're|you)\s+(stupid|dumb|bad|terrible|suck|useless|crap|trash)/i;
            if (!response && hateRegex.test(lowerRaw)) {
                response = "I'm sorry if I misunderstood! I am a lightweight offline AI, meaning I run entirely on your device's RAM. Please try rephrasing your request, or ask me for specific coding documentation!";
            }

            // 2. MATH ENGINE
            const mathRegex = /^(?:what is|calculate|solve|math|how much is)?\s*([\d\s\+\-\*\/\(\)\.]+)$/i;
            const mathMatch = lowerRaw.match(mathRegex);
            if (mathMatch && mathMatch[1].trim().length > 0) {
                try {
                    const result = math.evaluate(mathMatch[1]);
                    if (result !== undefined && typeof result !== 'function') {
                        response = `The mathematical result is: ${result}`;
                    }
                } catch (err) {}
            }

            // 3. FACT EXTRACTION (WIKIPEDIA)
            const wikiRegex = /^(?:who|what|where)\s+(?:is|are|was|were)\s+(.+)/i;
            const wikiMatch = lowerRaw.match(wikiRegex);
            if (!response && wikiMatch) {
                let entity = wikiMatch[1].trim();
                let summary = await fetchWikipediaSummary(entity);
                
                if (summary) {
                    response = summary;
                    memory.lastEntity = entity; // Update memory
                    // Prefetch full text in background for follow-up questions
                    fetchWikipediaFullText(entity); 
                }
            }

            // 3.5 CODING GENERATION ENGINE
            const codeRegex = /^(?:can\s+you\s+)?(?:code|write|program|create|build)(?:\s+me)?\s+(?:(?:a|an|some)\s+)?(.+)/i;
            const codeMatch = lowerRaw.match(codeRegex);
            if (!response && codeMatch) {
                let codeTarget = codeMatch[1].trim(); 
                
                // Try to find the requested code in the offline database
                let localData = fetchLocalDatabase(codeTarget);
                if (localData) {
                    response = `Sure, here is the code and documentation for ${codeTarget}:\n\n${localData}`;
                } else {
                    // Try searching internet for the code if offline fails
                    let ddg = await fetchDuckDuckGo(codeTarget + " code example");
                    if (ddg) {
                        response = `Here is a code reference for ${codeTarget}:\n\n${ddg}`;
                    } else {
                        response = `I don't have a specific pre-built code snippet for "${codeTarget}" in my offline database. Try asking me for a specific HTML tag, CSS property, or JavaScript function!`;
                    }
                }
            }

            // 4. HOW-TO ENGINE
            const howToRegex = /^(?:how\s+to|how\s+can\s+i|explain|tell\s+me\s+about)\s+(.+)/i;
            const howToMatch = contextualLowerRaw.match(howToRegex);
            if (!response && howToMatch) {
                const noSteps = lowerRaw.includes("don't use steps") || lowerRaw.includes("no steps");
                let query = howToMatch[1].trim().replace(/\b(no steps|don't use steps)\b/i, '').trim();
                
                let summary = await fetchWikipediaSummary(query);
                if (summary) {
                    response = noSteps ? summary : formatAsSteps(summary);
                    memory.lastEntity = query;
                } else {
                    let ddg = await fetchDuckDuckGo(query);
                    if (ddg) {
                        response = noSteps ? ddg : formatAsSteps(ddg);
                        memory.lastEntity = query;
                    }
                }
            }

            // 5. EXTRACTIVE Q&A ENGINE (Deep NLP Question Answering)
            // Triggers if there's a question word OR it ends in ? OR it has auxiliary verbs (isnt, arent, does)
            const questionRegex = /^(?:search(?:\s+for)?|when|why|will|can|do|does|did|how|what|where|who|is|are|was|were|isnt|arent|dont|doesnt)\b/i;
            const questionMatch = contextualLowerRaw.match(questionRegex);
            const isQuestion = rawText.trim().endsWith("?");
            
            if (!response && (questionMatch || isQuestion)) {
                let searchStr = contextualLowerRaw; 
                
                // First, try DuckDuckGo Instant Answer as it has highly curated facts
                let ddg = await fetchDuckDuckGo(searchStr);
                if (ddg) {
                    response = ddg;
                }
                
                // If DuckDuckGo fails, run Extractive Q&A on Wikipedia Full Text!
                if (!response && memory.lastEntity) {
                    let fullText = await fetchWikipediaFullText(memory.lastEntity);
                    if (fullText) {
                        let answer = await extractBestAnswer(fullText, cleanText);
                        if (answer) {
                            response = `Based on my knowledge of ${memory.lastEntity}:\n\n"${answer}"`;
                        }
                    }
                }
                
                // If it STILL fails, and it's a direct search attempt, search wikipedia
                if (!response && searchStr.startsWith("search ")) {
                    const query = searchStr.replace(/^search\s+/i, '').trim();
                    let ddg2 = await fetchDuckDuckGo(query);
                    if (ddg2) response = `Search result: ${ddg2}`;
                }
            }

            // 5.5 NATIVE BROWSER AI (GEMINI NANO / PHI ZERO-DOWNLOAD)
            if (!response && self.ai && typeof self.ai.languageModel !== 'undefined') {
                try {
                    const capabilities = await self.ai.languageModel.capabilities();
                    if (capabilities.available !== "no") {
                        const session = await self.ai.languageModel.create();
                        let promptText = `You are a helpful offline AI assistant. Please answer: ${cleanText}`;
                        if (memory.lastEntity) {
                            promptText = `Context: ${memory.lastEntity}. Question: ${cleanText}`;
                        }
                        const aiResult = await session.prompt(promptText);
                        if (aiResult) {
                            response = aiResult;
                        }
                    }
                } catch(e) {
                    console.log("Native Browser AI error:", e);
                }
            }

            // 6. FALLBACK TO SEMANTIC ENGINE & ONLINE MIX
            if (!response) {
                let internetFallback = await fetchDuckDuckGo(cleanText);
                
                if (typeof aiModelData !== 'undefined') {
                    // Stripping punctuation entirely for semantic dictionary lookup
                    let dictClean = cleanText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"?]/g, "").trim();
                    let semanticResponse = aiModelData.analyzeAndRespond(dictClean);
                    
                    if (internetFallback) {
                        response = internetFallback;
                    } else {
                        response = semanticResponse;
                    }
                } else {
                    response = internetFallback ? internetFallback : "System Error: aiModelData not defined. Core engine offline.";
                }
            }
            
            return response;

        } catch (error) {
            return `System Error: ${error.message || error.toString()}`;
        }
}
// ==========================================
// ==========================================
// ADVANCED NLP TEXT PROCESSOR & SENTIMENT ANALYZER
// ==========================================
class AdvancedNLPProcessor {
    constructor() {
        this.version = "1.0.0";
        this.stopWords = new Set([
            "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at", 
            "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can't", "cannot", "could", 
            "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", "for", 
            "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", 
            "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", 
            "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", 
            "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", 
            "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", 
            "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there", 
            "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too", 
            "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", 
            "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", 
            "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", 
            "yourselves"
        ]);
        
        this.positiveWords = new Set([
            "good", "great", "excellent", "amazing", "wonderful", "fantastic", "superb", "brilliant", "outstanding", "perfect",
            "happy", "joyful", "delighted", "glad", "cheerful", "thrilled", "excited", "content", "satisfied", "pleased",
            "love", "adore", "cherish", "treasure", "admire", "respect", "appreciate", "value", "prize", "esteem",
            "success", "victory", "triumph", "achievement", "accomplishment", "attainment", "realization", "fulfillment",
            "beautiful", "gorgeous", "stunning", "handsome", "lovely", "attractive", "appealing", "charming", "elegant",
            "smart", "intelligent", "clever", "bright", "brilliant", "sharp", "astute", "shrewd", "perceptive", "insightful",
            "kind", "generous", "compassionate", "caring", "thoughtful", "considerate", "sympathetic", "empathetic", "warm",
            "brave", "courageous", "fearless", "valiant", "heroic", "bold", "daring", "intrepid", "gallant", "plucky",
            "calm", "peaceful", "tranquil", "serene", "placid", "quiet", "still", "restful", "relaxing", "soothing"
        ]);
        
        this.negativeWords = new Set([
            "bad", "terrible", "awful", "horrible", "dreadful", "appalling", "atrocious", "abysmal", "lousy", "poor",
            "sad", "unhappy", "miserable", "depressed", "sorrowful", "mournful", "melancholy", "gloomy", "heartbroken",
            "hate", "despise", "detest", "loathe", "abhor", "dislike", "resent", "scorn", "disdain", "revile",
            "fail", "lose", "defeat", "failure", "loss", "disaster", "catastrophe", "tragedy", "ruin", "destruction",
            "ugly", "hideous", "grotesque", "unattractive", "repulsive", "revolting", "disgusting", "sickening", "nauseating",
            "stupid", "dumb", "idiotic", "foolish", "silly", "ignorant", "unintelligent", "dense", "thick", "dim",
            "mean", "cruel", "malicious", "spiteful", "vindictive", "vicious", "nasty", "unkind", "harsh", "severe",
            "scared", "afraid", "terrified", "frightened", "fearful", "petrified", "panicked", "alarmed", "spooked",
            "angry", "mad", "furious", "enraged", "incensed", "outraged", "livid", "irate", "fuming", "boiling"
        ]);
        
        this.programmingKeywords = new Map([
            ["html", "markup"], ["css", "styling"], ["javascript", "scripting"], ["js", "scripting"], 
            ["python", "scripting"], ["java", "programming"], ["c++", "programming"], ["c#", "programming"], 
            ["ruby", "scripting"], ["php", "scripting"], ["swift", "programming"], ["go", "programming"], 
            ["rust", "programming"], ["typescript", "scripting"], ["sql", "database"], ["nosql", "database"], 
            ["react", "framework"], ["angular", "framework"], ["vue", "framework"], ["node", "runtime"], 
            ["express", "framework"], ["django", "framework"], ["flask", "framework"], ["spring", "framework"], 
            ["git", "tool"], ["docker", "tool"], ["kubernetes", "tool"], ["aws", "cloud"], ["azure", "cloud"]
        ]);
        
        this.intents = {
            GREETING: ["hello", "hi", "hey", "greetings", "morning", "afternoon", "evening", "sup"],
            FAREWELL: ["bye", "goodbye", "farewell", "later", "cya", "night"],
            QUESTION: ["who", "what", "where", "when", "why", "how", "is", "are", "do", "does", "can", "could"],
            COMMAND: ["code", "write", "create", "build", "make", "generate", "show", "tell", "explain"],
            APPRECIATION: ["thanks", "thank", "appreciate", "grateful", "awesome", "great"],
            COMPLAINT: ["bad", "terrible", "wrong", "incorrect", "fail", "suck", "stupid"]
        };
    }

    // 1. Tokenization and Normalization
    tokenize(text) {
        if (!text) return [];
        return text.toLowerCase()
                   .replace(/[^\w\s-]/g, ' ')
                   .split(/\s+/)
                   .filter(word => word.length > 0);
    }

    removeStopWords(tokens) {
        return tokens.filter(token => !this.stopWords.has(token));
    }

    // 2. Sentiment Analysis
    analyzeSentiment(tokens) {
        let score = 0;
        let positiveCount = 0;
        let negativeCount = 0;
        let details = [];

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            
            // Handle negation (e.g., "not good")
            let multiplier = 1;
            if (i > 0 && (tokens[i-1] === "not" || tokens[i-1] === "no" || tokens[i-1] === "never")) {
                multiplier = -1;
            }

            if (this.positiveWords.has(token)) {
                score += (1 * multiplier);
                if (multiplier > 0) positiveCount++;
                else negativeCount++;
                details.push({ word: token, polarity: 1 * multiplier });
            } else if (this.negativeWords.has(token)) {
                score -= (1 * multiplier);
                if (multiplier > 0) negativeCount++;
                else positiveCount++;
                details.push({ word: token, polarity: -1 * multiplier });
            }
        }

        let sentiment = "neutral";
        if (score >= 2) sentiment = "very_positive";
        else if (score > 0) sentiment = "positive";
        else if (score <= -2) sentiment = "very_negative";
        else if (score < 0) sentiment = "negative";

        return {
            score: score,
            sentiment: sentiment,
            positiveCount: positiveCount,
            negativeCount: negativeCount,
            details: details
        };
    }

    // 3. Intent Classification
    classifyIntent(tokens, rawText) {
        let matchedIntents = new Set();
        let primaryIntent = "UNKNOWN";
        let maxMatchCount = 0;

        for (const [intentName, keywords] of Object.entries(this.intents)) {
            let matchCount = 0;
            for (const kw of keywords) {
                if (tokens.includes(kw)) {
                    matchCount++;
                }
            }
            if (matchCount > 0) {
                matchedIntents.add({ name: intentName, score: matchCount });
                if (matchCount > maxMatchCount) {
                    maxMatchCount = matchCount;
                    primaryIntent = intentName;
                }
            }
        }

        // Override rules based on raw text structure
        if (rawText.trim().endsWith("?")) {
            primaryIntent = "QUESTION";
            matchedIntents.add({ name: "QUESTION", score: 10 });
        }

        return {
            primary: primaryIntent,
            allMatches: Array.from(matchedIntents).sort((a, b) => b.score - a.score)
        };
    }

    // 4. Entity & Topic Extraction
    extractTopics(tokens) {
        let topics = [];
        let programmingTopics = [];

        // Simple Noun Phrase Extraction (Heuristic based on non-stopwords)
        const contentWords = this.removeStopWords(tokens);
        
        for (const word of contentWords) {
            if (word.length > 3) {
                topics.push(word);
            }
            if (this.programmingKeywords.has(word)) {
                programmingTopics.push({
                    technology: word,
                    category: this.programmingKeywords.get(word)
                });
            }
        }

        return {
            general: [...new Set(topics)],
            programming: programmingTopics
        };
    }

    // 5. Semantic Similarity (Jaccard Index)
    calculateSimilarity(tokensA, tokensB) {
        const setA = new Set(this.removeStopWords(tokensA));
        const setB = new Set(this.removeStopWords(tokensB));
        
        if (setA.size === 0 && setB.size === 0) return 1.0;
        if (setA.size === 0 || setB.size === 0) return 0.0;

        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);

        return intersection.size / union.size;
    }

    // 6. Master Processing Pipeline
    process(text) {
        if (!text || typeof text !== 'string') {
            return { error: "Invalid input text" };
        }

        const startProcessing = performance.now();
        
        const tokens = this.tokenize(text);
        const cleanTokens = this.removeStopWords(tokens);
        const sentimentAnalysis = this.analyzeSentiment(tokens);
        const intentAnalysis = this.classifyIntent(tokens, text);
        const topicAnalysis = this.extractTopics(tokens);
        
        const endProcessing = performance.now();

        return {
            originalText: text,
            metadata: {
                tokenCount: tokens.length,
                cleanTokenCount: cleanTokens.length,
                processingTimeMs: (endProcessing - startProcessing).toFixed(2)
            },
            tokens: tokens,
            cleanTokens: cleanTokens,
            sentiment: sentimentAnalysis,
            intent: intentAnalysis,
            topics: topicAnalysis,
            isCodingRelated: topicAnalysis.programming.length > 0 || intentAnalysis.primary === "COMMAND"
        };
    }
    
    // 7. Contextual Fallback Generator
    generateSmartFallback(processedData) {
        const intent = processedData.intent.primary;
        const sentiment = processedData.sentiment.sentiment;
        const topics = processedData.topics.general.slice(0, 3).join(", ");
        
        if (intent === "GREETING") {
            return "Hello! I am ready to process your advanced NLP queries. What's on your mind?";
        }
        
        if (intent === "QUESTION") {
            if (processedData.isCodingRelated) {
                return `You're asking a technical question about ${topics || 'code'}. Let me search my local database for the exact documentation.`;
            } else {
                return `That's an interesting question about ${topics || 'that topic'}. Let me query my knowledge bases to find the exact answer.`;
            }
        }
        
        if (sentiment === "very_negative" || intent === "COMPLAINT") {
            return "I apologize if I haven't met your expectations. I am constantly learning and adapting. Please try providing more specific details.";
        }
        
        if (sentiment === "very_positive" || intent === "APPRECIATION") {
            return "Thank you! I appreciate the positive feedback. I'm here to help you build great things.";
        }
        
        if (topics.length > 0) {
            return `I am currently analyzing the semantic context of: ${topics}. Could you expand on what specifically you want to know?`;
        }
        
        return "I'm analyzing your input, but I need a bit more context. Could you clarify your request?";
    }
}

// Instantiate globally for the worker to use
self.nlpProcessor = new AdvancedNLPProcessor();
// ==========================================
