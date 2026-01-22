var assistancePrompt = "";
$(document).ready(function () {
    // Call the function to initialize
    initializeSpeechRecognition();
});

var recognition = new webkitSpeechRecognition();
var isResult = false;
var isActiveMode = false;
function initializeSpeechRecognition() {
    // Check browser support
    if (!('webkitSpeechRecognition' in window)) {
        showNotification("", "Speech recognition is not supported in this browser.", "error", false);
        return;
    }

    // Initialize speech recognition
    recognition.continuous = false; // Stop after a single input
    recognition.interimResults = false; // Avoid showing partial results
    recognition.lang = 'en-US'; // Set language
    // Function to handle recognized input
    recognition.onresult = (event) => {
        isResult = true;
        const transcript = event.results[0][0].transcript; // Get recognized text
        console.log(`You said: ${transcript}`);
        activateThinking();
        recognition.stop();
        setTimeout(() => {
            SearchUserPrompt(transcript);
            isResult = false;
        }, 1000);
    };
    // Reset status when recognition ends
    recognition.onend = () => {
        if (!isResult && !isStopCommunication) {
            activateListning();
            recognition.start();
            console.log("Speech recognition started.");
        }
        console.log("Speech recognition ended.");
    };
    // Handle errors
    recognition.onerror = (event) => {
        activateRefresh();
        let errorMessage = 'An unknown error occurred.';
        switch (event.error) {
            case 'no-speech':
                errorMessage = 'No speech was detected. Please try again.';
                break;
            case 'audio-capture':
                errorMessage = 'No microphone detected. Please check your microphone settings.';
                break;
            case 'not-allowed':
                errorMessage = 'Microphone access is denied. Please allow microphone access and try again.';
                break;
            case 'aborted':
                errorMessage = 'Speech recognition was aborted. Please try again.';
                break;
            case 'network':
                errorMessage = 'A network error occurred. Please check your connection.';
                break;
        }
        console.log('Speech recognition error: ' + errorMessage);
    };
    // Start recognition when button is clicked
    document.getElementById('mic-on').addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default behavior
        console.log("Listening for speech...");
        recognition.stop();
        activateRefresh();
        isResult = true;
    });
    // Stop recognition when button is clicked
    document.getElementById('mic-off').addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default behavior
        console.log("Listening stopped...");
        stopSpeaking();
        //recognition.start();
        //activateListning();
    });
    recognition.start();
    activateListning();
}

var isStopSpeechRecognization = false;
var isStopHit = false;

var isStop = false;
function stopSpeaking() {
    assistancePrompt = "";
    activateListning();

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    currentUtterance = null; // Reset the current utterance
    recognition.start();
    isStopHit = true;
    isStopCommunication = false;

    if (isStop == false) {
        setTimeout(function () {
            stopSpeaking();
            isStop = true;
        }, 500);
    }
}

var isStopCommunication = false;
function stopCommunication() {
    isStopCommunication = true;
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    currentUtterance = null; // Reset the current utterance
    isStopHit = true;
    activateRefresh();
    recognition.stop();
}

async function speakText(text) {
    // To calculate estimated time and remaining time
    let totalTime = 0;
    let wordsSpoken = 0;
    let remainingTimeInterval;
    let isStopHit = false;
    let rate = 1;

    var cleanText = text.replace(/[#*]/g, '');
    text = cleanText;

    if (!('speechSynthesis' in window)) {
        var message = 'Your browser does not support text-to-speech functionality. Please try using a different browser.';
        showNotification("", message, "error", false);
        return;
    }

    var allDivs = document.querySelectorAll('.speak-loud');
    var flag = false;
    allDivs.forEach(function (div) {
        if (div.classList.contains('active')) {
            flag = true;
        }
    });

    if (flag) {
        stopSpeakingAll();
    }

    if (!text) return;

    console.log("Full text to be spoken: \n" + text);

    //Detect the language of the text
    const languageCode = detectLanguage(text);//'en-US';
    //Get voice selection
    const selectedVoice = await getVoice(languageCode);

    if (languageCode.includes('hi'))
        rate = 1.4;
    else
        rate = 1.0;

    // Calculate word count and total time
    const wordCount = text.split(/\s+/).length;
    totalTime = (wordCount / (rate * 150)) * 60; // Estimate in seconds

    // Log estimated time
    console.log(`Estimated total time: ${Math.ceil(totalTime)} seconds`);

    // Update UI for estimated time
    const timeEstimateElement = document.getElementById('timeEstimate');
    const timeRemainingElement = document.getElementById('timeRemaining');
    if (timeEstimateElement) {
        timeEstimateElement.textContent = `Estimated total time: ${Math.ceil(totalTime)} seconds`;
    }
    if (timeRemainingElement) {
        timeRemainingElement.textContent = `Remaining time: ${Math.ceil(totalTime)} seconds`;
    }

    var chunks = text
        .split(/[।.|]|[\n\r]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    if (!chunks) {
        return;
    }

    let currentChunkIndex = 0;
    let elapsedTime = 0;

    function updateRemainingTime() {
        elapsedTime++;
        const remainingTime = Math.max(0, totalTime - elapsedTime);
        if (timeRemainingElement) {
            timeRemainingElement.textContent = `Remaining time: ${Math.ceil(remainingTime)} seconds`;
        }
        if (remainingTime <= 0) {
            clearInterval(remainingTimeInterval);
        }
        //console.log(`Remaining time: ${Math.ceil(remainingTime)} seconds`);
    }

    function speakNextChunk() {
        const speech = new SpeechSynthesisUtterance(chunks[currentChunkIndex]);
        speech.lang = languageCode;
        speech.pitch = 1.0;
        speech.rate = rate;
        speech.volume = 1;

        if (selectedVoice) {
            speech.voice = selectedVoice;
        }

        speech.onstart = function () {
            // Start interval to update remaining time
            if (currentChunkIndex === 0) {
                remainingTimeInterval = setInterval(updateRemainingTime, 1000);
            }
        };

        speech.onend = function () {
            if (!isStopHit) {
                currentChunkIndex++;
                if (currentChunkIndex < chunks.length) {
                    speakNextChunk();
                } else {
                    console.log("All chunks spoken. Restarting voice recognition...");
                    recognition.start(); // Restart voice recognition when all chunks are done
                    activateListning();
                    clearInterval(remainingTimeInterval);
                    if (timeRemainingElement) {
                        timeRemainingElement.textContent = "Speech completed.";
                    }
                }
            }
        };

        speech.onpause = function () {
            stopSpeakingAll();
        };

        speech.onerror = function () {
            currentChunkIndex = chunks.length;
            stopSpeakingAll();
            isStopHit = false;
            clearInterval(remainingTimeInterval);
        };

        if (currentChunkIndex === 0) {
            activateSpeaking();
        }
        window.speechSynthesis.speak(speech);
    }

    if (!isStopHit) {
        speakNextChunk();
    }
}

function stopSpeakingAll() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    currentUtterance = null; // Reset the current utterance
    //Write code to stop speek animation using ID
    activateRefresh();
}

function deActivateElementByID(id, className) {
    const element = document.getElementById(id); // Fetch the element by ID
    if (element) {
        if (element.classList.contains(className))
            element.classList.remove(className); // Remove the specified class
    }
}

function activateElementByID(id, className) {
    const element = document.getElementById(id); // Fetch the element by ID
    if (element) {
        if (!element.classList.contains(className))
            element.classList.add(className); // Remove the specified class
    }
}

function activateListning() {
    //Deactive
    activateElementByID('mic-on', 'active');
    deActivateElementByID('response', 'active');
    deActivateElementByID('processing', 'active');
    deActivateElementByID('speech-circle', 'active');
    deActivateElementByID('stop-speak', 'active');
    //Active
    deActivateElementByID('mic-off', 'active');
    activateElementByID('circle-ripple', 'active');
}

function activateThinking() {
    //Deactive
    activateElementByID('mic-off', 'active');
    deActivateElementByID('response', 'active');
    deActivateElementByID('speech-circle', 'active');
    deActivateElementByID('circle-ripple', 'active');
    deActivateElementByID('stop-speak', 'active');
    //Active
    deActivateElementByID('mic-on', 'active');
    activateElementByID('processing', 'active');
}

function activateSpeaking() {
    //Deactive
    activateElementByID('mic-off', 'active');
    deActivateElementByID('speech-circle', 'active');
    deActivateElementByID('circle-ripple', 'active');
    deActivateElementByID('processing', 'active');
    activateElementByID('stop-speak', 'active');
    //Active
    deActivateElementByID('mic-on', 'active');
    activateElementByID('response', 'active');
}

function activateRefresh() {
    //Deactive
    activateElementByID('mic-off', 'active');
    deActivateElementByID('circle-ripple', 'active');
    deActivateElementByID('processing', 'active');
    deActivateElementByID('response', 'active');
    deActivateElementByID('stop-speak', 'active');
    //Active
    deActivateElementByID('mic-on', 'active');
    activateElementByID('speech-circle', 'active');
}

async function getVoice(languageCode) {
    const voices = await preloadVoices();
    if (languageCode.toLowerCase().includes('hi'))
        selectedVoice = voices.find(voice => voice.lang.startsWith(languageCode) && voice.name.toLowerCase().includes('kalpana'));
    else {
        selectedVoice = voices.find(voice => voice.lang.startsWith(languageCode) && voice.name.toLowerCase().includes('female'));
        if (!selectedVoice)
            selectedVoice = voices.find(voice => voice.lang.startsWith(languageCode) && voice.name.toLowerCase().includes('google'));
        if (!selectedVoice)
            selectedVoice = voices.find(voice => voice.lang.startsWith(languageCode) && voice.name.toLowerCase().includes('kalpana'));
        if (!selectedVoice)
            selectedVoice = voices.find(voice => voice.lang.startsWith(languageCode) && voice.name.toLowerCase().includes('unidos'));
        if (!selectedVoice)
            selectedVoice = voices.find(voice => voice.lang.startsWith(languageCode) && voice.name.toLowerCase().includes('zira'));
        if (!selectedVoice)
            selectedVoice = voices.find(voice => voice.lang.startsWith(languageCode) && voice.name.toLowerCase().includes('heera'));
        if (!selectedVoice) {
            if (voices.find(voice => voice.lang.startsWith(languageCode)))
                selectedVoice = voices.find(voice => voice.lang.startsWith(languageCode))[0];
            else
                selectedVoice = null;
        }
    }
    return selectedVoice;
}

let availableVoices = [];
function preloadVoices() {
    return new Promise((resolve) => {
        const loadVoices = () => {
            availableVoices = window.speechSynthesis.getVoices();
            resolve(availableVoices);
        };
        if (window.speechSynthesis.getVoices().length) {
            loadVoices();
        } else {
            window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
        }
    });
}

function detectLanguage(text) {
    const langMap = {
        // Arabic Script - separated by specific characters more common in each language
        'ur': /[\u0627\u064B-\u0652\u0679\u06BE\u06C1-\u06CC]/,  // Urdu (specific characters like 'ے', 'ٹ', 'ہ')
        'ar': /[\u0621-\u064A\u0660-\u0669]/,  // Arabic
        'fa': /[\u067E\u0686\u06AF\u06A9]/,  // Persian (specific characters like 'پ', 'چ', 'گ')
        // Cyrillic Script
        'ru': /[\u0400-\u04FF]/,  // Russian, Ukrainian, Bulgarian
        // Devanagari Script
        'hi': /[\u0900-\u097F]/,  // Hindi, Marathi, Nepali
        // Latin Script (Basic Latin and Latin-1 Supplement)
        'en': /[\u0041-\u007A]/,  // English
        'fr': /[\u00C0-\u00FF]/,  // French
        'es': /[\u00C0-\u00FF]/,  // Spanish
        'de': /[\u00C0-\u00FF]/,  // German
        'pt': /[\u00C0-\u00FF]/,  // Portuguese
        'it': /[\u00C0-\u00FF]/,  // Italian
        // Chinese Characters
        'zh': /[\u4E00-\u9FFF]/,  // Chinese (Simplified and Traditional)
        // Japanese
        'ja': /[\u3040-\u30FF\u4E00-\u9FFF]/,  // Japanese (Hiragana, Katakana, Kanji)
        // Korean
        'ko': /[\uAC00-\uD7AF]/,  // Korean (Hangul)
        // Hebrew Script
        'he': /[\u0590-\u05FF]/,  // Hebrew
        // Greek Script
        'el': /[\u0370-\u03FF]/,  // Greek
        // Thai Script
        'th': /[\u0E00-\u0E7F]/,  // Thai
        // Bengali Script
        'bn': /[\u0980-\u09FF]/,  // Bengali
        // Tamil Script
        'ta': /[\u0B80-\u0BFF]/,  // Tamil
        // Telugu Script
        'te': /[\u0C00-\u0C7F]/,  // Telugu
        // Kannada Script
        'kn': /[\u0C80-\u0CFF]/,  // Kannada
        // Malayalam Script
        'ml': /[\u0D00-\u0D7F]/,  // Malayalam
        // Gujarati Script
        'gu': /[\u0A80-\u0AFF]/,  // Gujarati
        // Gurmukhi Script (Punjabi)
        'pa': /[\u0A00-\u0A7F]/,  // Punjabi (Gurmukhi)
        // Sinhala Script
        'si': /[\u0D80-\u0DFF]/,  // Sinhala
        // Lao Script
        'lo': /[\u0E80-\u0EFF]/,  // Lao
        // Amharic Script
        'am': /[\u1200-\u137F]/,  // Amharic
        // Burmese Script
        'my': /[\u1000-\u109F]/,  // Burmese
        // Khmer Script
        'km': /[\u1780-\u17FF]/,  // Khmer
        // Georgian Script
        'ka': /[\u10A0-\u10FF]/,  // Georgian
        // Armenian Script
        'hy': /[\u0530-\u058F]/,  // Armenian
    };

    // Check for other languages
    for (const [lang, regex] of Object.entries(langMap)) {
        if (regex.test(text)) {
            return lang;
        }
    }
    return 'en'; // Default to English if no match is found
}

function SearchUserPrompt(text) {
    try {
        activateThinking();
        $.ajax({
            type: "POST",
            url: "/Home/AIResponse",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            async: false,
            data: { "userPrompt": text, "assistancePrompt": assistancePrompt },
            success: function (response) {
                if (response != undefined && response != null) {
                    assistancePrompt = response;
                    speakText(response);
                }
                else {
                    activateRefresh();
                }
            },
            error: function (error) {
                activateRefresh();
            }
        });
    } catch (e) {
        activateRefresh();
    }
}

function speakText_Old(text) {
    //To calculate estimated time and remaining time
    let totalTime = 0;
    let wordsSpoken = 0;
    let remainingTimeInterval;
    let rate = 1;
    isStopHit = false;

    var cleanText = text.replace(/[#*]/g, '');
    text = cleanText;
    if (!('speechSynthesis' in window)) {
        var message = 'Your browser does not support text-to-speech functionality. Please try using a different browser.';
        showNotification("", message, "error", false);
        return;
    }

    var allDivs = document.querySelectorAll('.speak-loud');
    var flag = false;
    allDivs.forEach(function (div) {
        if (div.classList.contains('active')) {
            flag = true;
        }
    });

    if (flag) {
        stopSpeakingAll();
    }

    if (!text) return;

    var textLength = text.length;
    console.log("Full text find to speech: \n" + text);
    // Detect the language of the text
    const languageCode = 'en-US'//detectLanguage(text);
    const selectedVoice = getVoice(languageCode);

    if (languageCode.includes('hi'))
        rate = 1.5;
    else
        rate = 1.0;



    var chunks = text.split(/[।.|]|[\n\r]/).map(s => s.trim()).filter(s => s.length > 0);//text.split(/\n+/).map(s => s.trim()).filter(s => s.length > 0); //text.split(/[।.|]/).map(s => s.trim()).filter(s => s.length > 0);
    if (!chunks) {
        return;
    }

    let currentChunkIndex = 0;

    function speakNextChunk() {
        const speech = new SpeechSynthesisUtterance(chunks[currentChunkIndex]);
        speech.lang = languageCode;
        speech.pitch = 1.0;
        speech.rate = rate;
        speech.volume = 1;
        if (selectedVoice) {
            speech.voice = selectedVoice;
        }
        speech.onend = function () {
            if (!isStopHit) {
                currentChunkIndex++;
                if (currentChunkIndex < chunks.length) {
                    speakNextChunk();
                } else {
                    console.log("All chunks spoken. Restarting voice recognition...");
                    recognition.start(); // Restart voice recognition when all chunks are done
                    activateListning();
                }
            }
        };
        speech.onpause = function () {
            stopSpeakingAll();
        };

        speech.onerror = function () {
            currentChunkIndex = chunks.length;
            stopSpeakingAll();
            isStopHit = false;
            //Call of start listing
            //recognition.start();
        };
        if (currentChunkIndex == 0) {
            activateSpeaking();
        }
        window.speechSynthesis.speak(speech);
    }
    if (!isStopHit) {
        speakNextChunk();
    }
}
