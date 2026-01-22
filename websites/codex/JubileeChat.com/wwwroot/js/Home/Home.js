var IsChild = 0;
var PromptID;
var IsArchived;
var IsFavorite;
var IsToday;
var curSelection;
var popup;

$(document).ready(function () {

    var shareContent = $("#hdnContent").val();
    if (shareContent) {
    } else {
        // Redirect if the browser is not Chrome or Edge
        if (!isAllowedBrowser()) {
            //console.log("Unsupported browser detected. Redirecting...");
            window.location.replace("/BrowserError");
        }
    }

    //To display token in international number system
    
    let totalTokens = parseInt($("#totalTokenRemaining").text(), 10);
    $("#totalTokenRemaining").text(totalTokens.toLocaleString("en-US"));
    $(".token-tooltip-txt").text(totalTokens.toLocaleString("en-US"));
    // Bind voice to user on page load
    GetHomeUserVoice();
    ShowLeftMenuItems();

    var txtSearch = document.getElementById("txtsearch");
    var txtSearch = document.getElementById("txtsearch");
    if (txtSearch) {
        txtSearch.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault(); // Prevent the default behavior (adding a <br> tag)
                if (!event.shiftKey && $("#txtsearch").html().trim() !== "") {
                    Redirect_Search();
                }
                else if (event.shiftKey && $("#txtsearch").html().trim() !== "") {
                    document.execCommand('insertLineBreak');
                }
            }
            //else {
            //    activateVoiceMode_SearchText();
            //}
        });

        txtSearch.addEventListener("focus", function (event) {
            activateSearchMode_SearchText();
        });

        txtSearch.addEventListener("blur", function (event) {
            let element = document.getElementById('txtsearch');
            if (element.innerText.trim() == "") {
                activateVoiceMode_SearchText();
            }
        });

        document.getElementById('txtsearch').addEventListener('paste', function (event) {
            event.preventDefault();
            var clipboardData = (event.clipboardData || window.clipboardData);
            var pastedData = clipboardData.getData('text/plain');
            document.execCommand('insertText', false, pastedData);
        });



        // This function will execture when user come with share chat URL.
        var shareID = $("#shareChatID").val().trim();

        if (shareID != null && shareID != undefined && shareID != "") {

            stopSpeakingAll();
            var allBtnPrompts = document.querySelectorAll('.lnil-1');
            $("#btn-newchat").removeClass("btn-sel-active");
            //allBtnPrompts.forEach(function (btnPrompt) {
            //    if (btnPrompt !== element.parentElement)
            //        btnPrompt.classList.remove('active');
            //});

            var divElement = document.getElementById("myDiv");
            if (divElement) {
                divElement.classList.add("main-container-inner");
            }
            //hide logo
            var divLogo = document.getElementById("divLogo");
            if (divLogo) {
                divLogo.style.display = "none";
            }

            var hideToken = document.querySelector('.token-counter');
            if (hideToken) {
                hideToken.style.display = 'none'
            }

            let readResponses = document.querySelectorAll('.read-response');
            if (readResponses) {
                readResponses.forEach(function (elem) {
                    if (elem) {
                        if (!elem.classList.contains('active'))
                            elem.classList.remove('active');
                    }
                });
            }
            //hide discription
            var divLogo = document.getElementById("divDisc");
            if (divLogo) {
                divLogo.style.display = "none";
            }
            //disable search bar
            document.getElementById("txtsearch").setAttribute("contenteditable", "false");

            var divLogo = document.getElementById("divloader1");
            if (divLogo) {
                divLogo.disabled = true; // Disables the button
            }
            //hide short discription
            var divLogo = document.getElementById("divShortDisc");
            if (divLogo) {
                divLogo.text = "";
            }
            //hide share button on chat
            var divSharebtn = document.getElementById("sharebtn");
            if (divSharebtn) {
                divSharebtn.style.display = "none";
            }

            const elementCont = document.querySelector(".parent-container");
            if (elementCont) {
                $(".parent-container").removeClass("close-nav");
            }

            var IsLogin = $("#hdnIsLogin").val();
            if (!IsLogin) {
                var leftnav = document.querySelector(".brand-nav-item");
                if (leftnav) {
                    leftnav.style.display = "none";
                }
            } else {
                var leftnav = document.querySelector(".brand-nav-item");
                if (leftnav) {
                    leftnav.style.display = "flex";
                }
            }

            IsChild = 0;
            PromptID = shareID;
            serialNumber = 1;

            $("#hdParentID").val(shareID);

            $("#divResults").html("");
            setTimeout(function () {
                //fetch share chat and bind.
                bindsharechat(shareID)
                //fetch left nav of share chat.
                BindSharedLeftMenuPrompt(shareID);
            }, 1);
        }
        else {
            BindLeftMenuPrompt();
        }

    }

    document.addEventListener('click', function (event) {
        var element = document.querySelector('.thread-option-box[style*="display: block"]');
        if (element) {
            element.style.display = 'none';
        }
    });


    $(".left-nav-bar").resizable();

    BindModeSection();

    stopSpeakingAll();

    activateVoiceMode_SearchText();

    initializeSpeechRecognition();

    BindVoiceLanguageRightSection();


    //setTimeout(function () {
    //    ProcessTextToAudio('Hello! I appreciate your warm greeting. I\'m here and ready to assist you.If there\'s anything specific you\'d like to discuss or any questions you have, feel free to share! How can I support you today ? ');
    //}, 5000);
    $(".prog-container").css("background", "radial-gradient(closest-side, white 79%, transparent 80% 100%), conic-gradient(#d9d9d9 calc(" + parseInt($('#hdnCalRemainingValue').val()) + " * 1%), #4CAF50 0)");

});

function isAllowedBrowser() {
    var userAgent = navigator.userAgent;

    var isChrome = userAgent.includes("Chrome") && !userAgent.includes("Chromium") && !userAgent.includes("OPR");
    var isEdge = userAgent.includes("Edg");

    return isChrome || isEdge;
}
function BindVoiceLanguageRightSection() {
    try {
        $.ajax({
            type: "get",
            url: "/Home/BindVoiceLanguages",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            async: true,
            success: function (response) {
                var html = '';
                if (response != null) {
                    response.forEach(item => {
                       
                        if (item.isDefault) {
                            $("#hdnLangPrompt").val(item.languageID);
                            html += `<div class="countrynamedisplay countrytooltip" id="divenglish-` + item.languageID + `"  >` + item.languageName + `</div> <div id="divflag-` + item.languageID + `" class="flag-icon tooltip active ` + item.languageFlag + `"  onmouseover="GetCordinates(event, '` + item.languageID + `')" onmouseout="OutGetCordinates(event, '` + item.languageID + `')"   onclick="ExecutePrompt2(this, '${item.languageID} ', '${item.languageName.replace(/'/g, "\\'")} ', '${item.languageFlag.replace(/'/g, "\\'")}')"></div>`;
                        } else {
                            html += `<div class="countrynamedisplay countrytooltip" id="divenglish-` + item.languageID + `"  >` + item.languageName + `</div> <div id="divflag-` + item.languageID + `" class="flag-icon tooltip ` + item.languageFlag + `" onmouseover="GetCordinates(event, '` + item.languageID + `')" onmouseout="OutGetCordinates(event, '` + item.languageID + `')"  onclick="ExecutePrompt2(this, '${item.languageID} ', '${item.languageName.replace(/'/g, "\\'")} ', '${item.languageFlag.replace(/'/g, "\\'")} ')"></div>`;
                        }

                    });
                }
                $("#sp-lang-wrapper").html(html);
            },
            error: function (error) {
                HideLoader();
            }
        });
    } catch {

    }
}

function GetCordinates(event, languageID) {
    var elemenID = "#divflag-" + languageID;  // Add '#' for ID selector
    var element = document.querySelector(elemenID);
    var flagelemenID = "#divenglish-" + languageID;  // Add '#' for ID selector
    var flagelement = document.querySelector(flagelemenID);

    if (element && flagelement) {
        document.querySelectorAll(".countrynamedisplay").forEach(function (element) {
            element.style.display = "none";
        });
        //var mouseX = event.clientX;
        //var mouseY = event.clientY;
        var rect = element.getBoundingClientRect();
        var ycoordinate = rect.top;
        if (rect.bottom > window.innerHeight) {
        } else {
            flagelement.style.marginTop = ycoordinate - 62 + "px";
            flagelement.style.display = "block";
        }
    }
}

function OutGetCordinates(event, languageID) {
    document.querySelectorAll(".countrynamedisplay").forEach(function (element) {
        element.style.display = "none";
    });
}

//#region Mic functionallity

var recognition = new webkitSpeechRecognition();
function initializeSpeechRecognition() {
    // Check browser support
    if (!('webkitSpeechRecognition' in window)) {
        //showNotification("", "Speech recognition is not supported in this browser.", "error", false);
        //window.location.replace("/BrowserError");
        return;
    }

    // Initialize speech recognition
    recognition.continuous = false; // Stop after a single input
    recognition.interimResults = false; // Avoid showing partial results
    recognition.lang = 'en-US'; // Set language

    // On Audio capturing start
    recognition.onaudiostart = function (event) {
        activateListning();
        console.log("Audio capturing started.");
    };

    // On Audio capturing ended
    recognition.onaudioend = function (event) {
        console.log("Audio capturing ended.");
    };

    // Function to handle recognized input
    recognition.onresult = (event) => {
        console.log("Speech recognition result found.");
        const transcript = event.results[0][0].transcript; // Get recognized text
        console.log(`You said: ${transcript}`);
        isCommunicationStop = true;
        setTimeout(() => {
            recognition.stop();
            activateThinking();
            if (parseInt($("#totalTokenRemaining").text().replace(/,/g, ''), 10) > 0)
                ConversationResult(transcript);
            else
                if (parseInt($("#totalTokenRemaining").text().replace(/,/g, ''), 10) == 0 && $("#hdnSubscriptionStatus").val() !== "paid" && $("#hdnPaymentPlanID").val() != 'c7e3226b-b947-4d72-90a3-512c06661989' && $("#hdnPaymentPlanID").val() != '4B8BBD72-3E56-40B4-A82D-79BF62E0DC78') {
                    window.location.href = "home/paymentfailed";
                }
                else {
                    if ($("#hdnPaymentPlanID").val() == 'c7e3226b-b947-4d72-90a3-512c06661989' || $("#hdnPaymentPlanID").val() == '4B8BBD72-3E56-40B4-A82D-79BF62E0DC78') {
                        window.location.href = "home/trialoutoftoken";
                    } else {
                        window.location.href = "home/outoftoken";
                    }
                }
        }, 1000);
    };

    // Reset status when recognition ends
    recognition.onend = () => {
        if (!isCommunicationStop) {
            activateListning();
            recognition.start();
            console.log("Speech recognition started.");
        } else {
            console.log("Speech recognition ended.");
        }
    };

    // Handle errors
    recognition.onerror = (event) => {
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
        activateRefresh();
    };

    // Start recognition when button is clicked
    document.getElementById('mic-on').addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default behavior
        isCommunicationStop = true;
        recognition.stop();
        activateRefresh();
    });

    // Stop recognition when button is clicked
    document.getElementById('mic-off').addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default behavior
        isCommunicationStop = false;
        isStopHit = false;
        recognition.start();
    });
}

var isCommunicationStop = false;

function stopCommunication() {
    isStopHit = true;
    isCommunicationStop = true;
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    currentUtterance = null; // Reset the current utterance
    activateRefresh();
    recognition.stop();
    if (!isMiddleSectionAudio)
        audioManager.stopAudio();
}

//#endregion Mic functionallity

//#region TextToSpeech

var isStopHit = false;
function speakText(event, resultId) {
    isStopHit = false;
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

    var parentDiv = event.target.closest('.speak-loud');
    if (parentDiv) {
        parentDiv.classList.add('active');
    }

    const resultElement = document.getElementById(resultId);
    if (!resultElement) return;

    const text = resultElement.textContent || resultElement.innerText;
    if (!text) return;

    var textLength = text.length;

    // Detect the language of the text
    const languageCode = detectLanguage(text);
    const selectedVoice = getVoice(languageCode);

    var chunks = text.split(/[।.|]/).map(s => s.trim()).filter(s => s.length > 0);
    if (!chunks) {
        return;
    }

    let currentChunkIndex = 0;

    function speakNextChunk() {
        const textNew = resultElement.textContent || resultElement.innerText;
        if (textNew.length > textLength) {
            chunks = textNew.split(/[।.|]/).map(s => s.trim()).filter(s => s.length > 0);
            textLength = textNew.length;
        }

        if (currentChunkIndex >= chunks.length) {
            // All chunks have been spoken
            if (parentDiv) {
                parentDiv.classList.remove('active');
            }
            return;
        }

        const speech = new SpeechSynthesisUtterance(chunks[currentChunkIndex]);
        speech.lang = languageCode;
        speech.pitch = 1.0;
        if (languageCode.includes('hi'))
            speech.rate = 1.5;
        else
            speech.rate = 1.1;
        speech.volume = 1;
        if (selectedVoice) {
            speech.voice = selectedVoice;
        }

        speech.onend = function () {
            if (currentChunkIndex == chunks.length - 1 && textNew.length == textLength) {
                stopSpeakingAll();
            }

            if (!isStopHit) {
                currentChunkIndex++;
                speakNextChunk();
            }
        };
        speech.onpause = function () {
            stopSpeakingAll();
        };

        speech.onerror = function () {
            currentChunkIndex = chunks.length;
            stopSpeakingAll();
            isStopHit = false;
        };
        window.speechSynthesis.speak(speech);
    }
    if (!isStopHit) {
        speakNextChunk();
    }
}

function stopSpeaking(event) {
    isStopHit = true;
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    currentUtterance = null; // Reset the current utterance

    var parentDiv = event.target.closest('.speak-loud');
    if (parentDiv) {
        parentDiv.classList.remove('active');
    }
}

function stopSpeakingAll() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    currentUtterance = null; // Reset the current utterance

    var allDivs = document.querySelectorAll('.speak-loud');
    if (allDivs) {
        allDivs.forEach(function (div) {
            div.classList.remove('active')
        });
    }
}

function getVoice(languageCode) {
    // Get the list of available voices
    const voices = window.speechSynthesis.getVoices();
    selectedVoice = voices.find(voice => voice.lang.startsWith(languageCode) && voice.name.toLowerCase().includes('female'));
    if (!selectedVoice)
        selectedVoice = voices.find(voice => voice.lang.startsWith(languageCode) && voice.name.toLowerCase().includes('kalpana'));
    if (!selectedVoice)
        selectedVoice = voices.find(voice => voice.lang.startsWith(languageCode) && voice.name.toLowerCase().includes('unidos'));
    if (!selectedVoice)
        selectedVoice = voices.find(voice => voice.lang.startsWith(languageCode) && voice.name.toLowerCase().includes('zira'));
    if (!selectedVoice)
        selectedVoice = voices.find(voice => voice.lang.startsWith(languageCode) && voice.name.toLowerCase().includes('heera'));
    if (!selectedVoice)
        selectedVoice = voices.find(voice => voice.lang.startsWith(languageCode));
    return selectedVoice;
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

async function detectLanguages(text) {
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&q=${encodeURIComponent(text)}`);
    const data = await response.json();
    const languageCode = data[2];
    console.log(`Detected language code: ${languageCode}`);
    return languageCode;
}

//#endregion TextToSpeech

function removeHtmlTags(input) {
    return input.replace(/<[^>]*>/g, '');
}

function ShowTodayPrompts() {
    if ($("#divtoday").hasClass("active")) {
        $("#divtoday").removeClass("active");
    }
    else {
        $("#divtoday").addClass("active");
    }
    $("#divchats").removeClass("active");
    if (IsToday) {
        IsToday = false;
    }
    else {
        IsToday = true;
    }
    BindLeftMenuPrompt("", IsArchived, IsFavorite, IsToday);
}

function ShowArchived() {
    if ($("#btn-archive").hasClass("btn-sel-active")) {
        $("#btn-archive").removeClass("btn-sel-active");
    }
    else {
        $("#btn-archive").addClass("btn-sel-active");
    }
    $("#btn-newchat").removeClass("btn-sel-active");

    if (IsArchived) {
        IsArchived = false;
        curSelection = "";
    }
    else {
        IsArchived = true;
        curSelection = "archived";
    }
    PromptID = "";
    IsChild = "";
    $("#hdParentID").val("");
    $("#divResults").html("");

    BindLeftMenuPrompt("", IsArchived, IsFavorite, IsToday);
}

function ShowFavoritePrompts() {
    if ($("#divfavorites").hasClass("active")) {
        $("#divfavorites").removeClass("active");
        IsFavorite = false;
    }
    else {
        $("#divfavorites").addClass("active");
        IsFavorite = true;
    }
    BindLeftMenuPrompt("", IsArchived, IsFavorite, IsToday);

}

function StartNewChat() {
    if ($(window).width() <= 768) {

        //Stop listning
        deActivateVoice();
        //Stop Speaking
        stopSpeakingAll();
        //Show main panel
        const mainCont = document.querySelector(".main-panel-container");
        if (mainCont) {
            mainCont.classList.remove("hide");
        }
        deActivateJubileeJSVGenesis();

        //Hide voice panel in mobile
        const addRightPanel = document.querySelector(".right-panel");
        if (addRightPanel) {
            addRightPanel.classList.remove("active");
        }
        //Hide voice language in mobile
        const voicelang = document.getElementById("sp-lang-wrapper");
        if (voicelang) {
            voicelang.style.display = "none";
        }
        //Show written languages
        const writeLang = document.querySelector(".select-lang");
        if (writeLang) {
            writeLang.style.display = "flex";
        }

        var myDiv = document.getElementById("myDiv");
        myDiv.classList.remove("main-container-inner");
        //Close left nav
        const leftNav = document.querySelector(".parent-container");
        if (leftNav) {
            leftNav.classList.add("close-nav");
        }
        //Show new chat button
        var newBtn = document.querySelector(".top-bar button.header-link");
        if (newBtn) {
            newBtn.style.display = "flex";
        }
        // Show search bar
        const searchBar = document.querySelector(".search-bar-container");
        if (searchBar) {
            searchBar.style.display = "flex";
        }
        // Show search bar
        const mainContainer = document.querySelector(".main-container");
        if (mainContainer) {
            mainContainer.classList.add("main-container-inner");
        }
        var divLogo = document.getElementById("divLogo");
        divLogo.style.display = "none";

        var divDisc = document.getElementById("divDisc");
        divDisc.style.display = "";

        var divSharebtn = document.getElementById("sharebtn");
        if (divSharebtn) {
            divSharebtn.style.display = "none";
        }

        //disable search bar
        document.getElementById("txtsearch").setAttribute("contenteditable", "true");


        var divShortDisc = document.getElementById("divShortDisc");
        divShortDisc.style.display = "none";
        $("#txtsearch").html("");
        $("#hdParentID").val("");
        $("#divResults").html("");

        BindLeftMenuPrompt("", IsArchived, IsFavorite, IsToday);
    } else {
        deActivateJubileeJSVGenesis();
        var myDiv = document.getElementById("myDiv");
        myDiv.classList.remove("main-container-inner");

        var divLogo = document.getElementById("divLogo");
        divLogo.style.display = "";

        var divDisc = document.getElementById("divDisc");
        divDisc.style.display = "";

        var divSharebtn = document.getElementById("sharebtn");
        if (divSharebtn) {
            divSharebtn.style.display = "none";
        }

        //disable search bar
        document.getElementById("txtsearch").setAttribute("contenteditable", "true");


        var divShortDisc = document.getElementById("divShortDisc");
        divShortDisc.style.display = "none";
        $("#txtsearch").html("");
        $("#hdParentID").val("");
        $("#divResults").html("");

        BindLeftMenuPrompt("", IsArchived, IsFavorite, IsToday);
    }
}

function ShowHideLang(element) {
    if ($(".lang-selection-popup").hasClass("show-lsp")) {
        $(".lang-selection-popup").removeClass("show-lsp");
    } else {
        $(".lang-selection-popup").addClass("show-lsp");
    }
    //show-lsp
}

function showHideUserInfo() {
    var divToHide = document.getElementById("divUserInfo");
    divToHide.style.display = "none";
}

function ShowLoader() {
    $("#divloader").addClass("loading");
}

function HideLoader() {
    $("#divloader").removeClass("loading");
}

async function Redirect_Search() {
    if ($(window).width() <= 768) {

        var searchText = removeHtmlTags($("#txtsearch").html());
        var searchTextWithHTML = $("#txtsearch").html();
        if (LoginCheck() != "1") {
            showLoginPopup();
            $("#txtsearch").html("");
            //showNotification("", "Please login to search...", "error", false);
            //setTimeout(function () {
            //    window.location.href = "/signin";
            //}, 3000);
            return false;
        }

        $("#txtsearch").html("");
        if (searchText.trim() !== "") {
            var myDiv = document.getElementById("myDiv");
            myDiv.classList.add("main-container-inner");

            var divLogo = document.getElementById("divLogo");
            if (divLogo) {
                divLogo.style.display = "none";
            }

            var divDisc = document.getElementById("divDisc");
            divDisc.style.display = "none";

            var divShortDisc = document.getElementById("divShortDisc");
            divShortDisc.style.display = "";


            IsArchived = false;

            setTimeout(() => {
                $("#hdnIsSearched").val("1");
                if (parseInt($("#totalTokenRemaining").text().replace(/,/g, ''), 10) > 0)
                    SearchResult(searchTextWithHTML);
                else
                    if (parseInt($("#totalTokenRemaining").text().replace(/,/g, ''), 10) == 0 && $("#hdnSubscriptionStatus").val() !== "paid" && $("#hdnPaymentPlanID").val() != 'c7e3226b-b947-4d72-90a3-512c06661989' && $("#hdnPaymentPlanID").val() != '4B8BBD72-3E56-40B4-A82D-79BF62E0DC78') {
                        window.location.href = "home/paymentfailed";
                    }
                    else {
                        if ($("#hdnPaymentPlanID").val() == 'c7e3226b-b947-4d72-90a3-512c06661989' || $("#hdnPaymentPlanID").val() == '4B8BBD72-3E56-40B4-A82D-79BF62E0DC78') {
                            window.location.href = "/home/trialoutoftoken";
                        } else {
                            window.location.href = "home/outoftoken";
                        }
                    }
            }, 100);
        }
        else {
            showNotification("", "Please enter text to search!", "error", false);
        }
    }
    else {
        var searchText = removeHtmlTags($("#txtsearch").html());
        var searchTextWithHTML = $("#txtsearch").html();
        if (LoginCheck() != "1") {
            showLoginPopup();
            $("#txtsearch").html("");
            //showNotification("", "Please login to search...", "error", false);
            //setTimeout(function () {
            //    window.location.href = "/signin";
            //}, 3000);
            return false;
        }

        $("#txtsearch").html("");
        if (searchText.trim() !== "") {
            var myDiv = document.getElementById("myDiv");
            myDiv.classList.add("main-container-inner");

            var divLogo = document.getElementById("divLogo");
            divLogo.style.display = "none";

            var divDisc = document.getElementById("divDisc");
            divDisc.style.display = "none";

            var divShortDisc = document.getElementById("divShortDisc");
            divShortDisc.style.display = "";

            var divSharebtn = document.getElementById("sharebtn");
            if (divSharebtn) {
                divSharebtn.style.display = "flex";
            }

            //var newchat = document.getElementById("btn-newchat");
            //newchat.classList.remove("btn-sel-active");

            //var archive = document.getElementById("btn-archive");
            //archive.classList.remove("btn-sel-active");

            IsArchived = false;

            setTimeout(() => {
                $("#hdnIsSearched").val("1");
                if (parseInt($("#totalTokenRemaining").text().replace(/,/g, ''), 10) > 0)
                    SearchResult(searchTextWithHTML);
                else
                    if (parseInt($("#totalTokenRemaining").text().replace(/,/g, ''), 10) == 0 && $("#hdnSubscriptionStatus").val() !== "paid" && $("#hdnPaymentPlanID").val() != 'c7e3226b-b947-4d72-90a3-512c06661989' && $("#hdnPaymentPlanID").val() != '4B8BBD72-3E56-40B4-A82D-79BF62E0DC78') {
                        window.location.href = "home/paymentfailed";
                    }
                    else {
                        if ($("#hdnPaymentPlanID").val() == 'c7e3226b-b947-4d72-90a3-512c06661989' || $("#hdnPaymentPlanID").val() == '4B8BBD72-3E56-40B4-A82D-79BF62E0DC78') {
                            window.location.href = "home/trialoutoftoken";
                        } else {
                            window.location.href = "home/outoftoken";
                        }
                    }
            }, 100);
        }
        else {
            showNotification("", "Please enter text to search!", "error", false);
        }
    }

}

function HighlightSubChild(ID) {
    const items = document.querySelectorAll('.cmn-item-3');
    items.forEach(item => {
        item.classList.remove('hilight');
    });
    var subChildID = document.getElementById("divSubChild_" + ID);
    if (subChildID) {
        setTimeout(function () {
            subChildID.classList.add("hilight");
        }, 200)
    }
}

// Activate search panel
function deActivateJubileeJSVGenesis() {
    let searchContainers = document.querySelectorAll('.search-container-wrapper');
    let resultPanels = document.querySelectorAll('.result-panel');
    let bookContents = document.querySelectorAll('.book-content');
    if (searchContainers) {
        searchContainers.forEach(elem => {
            elem.style.display = ''
        });
    }
    if (resultPanels) {
        resultPanels.forEach(elem => {
            elem.style.display = ''
        });
    }
    if (bookContents) {
        bookContents.forEach(elem => {
            elem.style.display = 'none'
        });
    }
}

// To activate Genesis
function ActivateJubileeJSVGenesis() {
    let searchContainers = document.querySelectorAll('.search-container-wrapper');
    let resultPanels = document.querySelectorAll('.result-panel');
    let bookContents = document.querySelectorAll('.book-content');
    if (searchContainers) {
        searchContainers.forEach(elem => {
            elem.style.display = 'none'
        });
    }
    if (resultPanels) {
        resultPanels.forEach(elem => {
            elem.style.display = 'none'
        });
    }
    if (bookContents) {
        bookContents.forEach(elem => {
            elem.style.display = ''
        });
    }
}

function ExecuteUsingChatGPT(BibleBookID, BibleDescritpion) {
    HighlightSubChild(BibleBookID);
    if (BibleDescritpion.trim().toLowerCase() === 'genesis') {
        ActivateJubileeJSVGenesis();
    } else {
        deActivateJubileeJSVGenesis();
        if (BibleBookID != null) {
            var myDiv = document.getElementById("myDiv");
            if (myDiv)
                myDiv.classList.add("main-container-inner");

            var divLogo = document.getElementById("divLogo");
            if (divLogo)
                divLogo.style.display = "none";

            var divDisc = document.getElementById("divDisc");
            if (divDisc)
                divDisc.style.display = "none";

            var divShortDisc = document.getElementById("divShortDisc");
            if (divShortDisc)
                divShortDisc.style.display = "";

            //var newchat = document.getElementById("btn-newchat");
            //if (newchat)
            //    newchat.classList.remove("btn-sel-active");

            //var archive = document.getElementById("btn-archive");
            //if (archive) {
            //    archive.classList.remove("btn-sel-active");
            //    IsArchived = false;
            //}
            setTimeout(() => {
                $("#hdnIsSearched").val("1");
                SearchBibleJIVResult(BibleBookID, BibleDescritpion);
            }, 100);
        } else {
            showNotification("", "Oops! Something went wrong. Please try again later.", "error", false);
        }
    }
}

function DisableLeftMenuPanel() {
    const element = document.querySelector(".left-nav-panel-inner");
    if (element)
        element.classList.add("non-clickable");
}

function EnableLeftMenuPanel() {
    const element = document.querySelector(".left-nav-panel-inner");
    if (element)
        element.classList.remove("non-clickable");
}

function DisableSearch() {
    const element1 = document.querySelector("#txtsearch");
    const element2 = document.querySelector("#divloader");
    if (element1) {
        element1.setAttribute('contenteditable', 'false');
        element1.classList.add("disabled");
        element1.removeAttribute('tabindex');
    }
    if (element2)
        element2.classList.add("non-clickable");
}

function EnableSearch() {
    const element1 = document.querySelector("#txtsearch");
    const element2 = document.querySelector("#divloader");
    if (element1) {
        element1.setAttribute('contenteditable', 'true');
        element1.classList.remove("disabled");
        element1.setAttribute('tabindex', '1');
    }
    if (element2)
        element2.classList.remove("non-clickable");
}

function SearchBibleJIVResult(BibleBookID, BibleDescritpion) {
    showSearch("1", BibleDescritpion.trim());
    showBlinkCursor();
    DisableSearch();
    DisableLeftMenuPanel();
    $.ajax({
        type: "post",
        url: "/Home/SearchJubileeBookJIVResult",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "BibleBookID": BibleBookID,
            "LangPromptID": $("#hdnLangPrompt").val()
        },
        success: function (response) {
            HideLoader();
            hideBlinkCursor();
            if (response != null) {
                if (response != "") {
                    var replacedText = "";
                    if (response.domainName != undefined || response.domainName != null || response.domainName != "") {
                        replacedText = response.domainName.toUpperCase();
                    }
                    showResponse(response.response, replacedText, "1");
                    var PromptID = $("#hdParentID").val(response.parentID);
                }
            }
        },
        error: function (error) {
            hideBlinkCursor();
            HideLoader();
            EnableLeftMenuPanel();
            EnableSearch();
            showNotification("", "Oops! Internal server error. Please try again later.", "error", false);
        }
    });
}

function ExecutePrompt2(element, id, languageName, languageFlag) {
    var elem_lang = document.querySelectorAll('.lang-item');
    var elem_icon = document.querySelectorAll('.flag-icon');
    if (elem_icon) {
        elem_icon.forEach(function (elem) {
            elem.classList.remove('active');
        });
    }
    if (elem_lang) {
        elem_lang.forEach(function (elem) {
            elem.classList.remove('active');
        });
    }
    element.classList.add('active');
    $("#hdnLangPrompt").val(id);

    /// Add new flag icon in the top header
    changeHeaderFlagPerLanguageSelect(languageFlag);

    /// Save clicked language to user
    addLanguageToUser(id);
}

function changeHeaderFlagPerLanguageSelect(languageFlag) {
    var elem_select_lang = document.querySelector('.select-lang');
    if (elem_select_lang) {
        const child = elem_select_lang.firstChild;
        if (child) {
            child.className = 'flag-icon ' + languageFlag;
            //child.classList.add(languageFlag);
        }
    }
}

function addLanguageToUser(ID) {
    if (ID != null && ID != undefined) {
        $.ajax({
            type: "post",
            url: "/Home/SaveLanguageToUser",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            async: true,
            data: {
                "ID": ID
            },
            success: function (response) {
            },
            error: function (error) {
            }
        });
    }
}

function Toggle_Navbar() {

    $(".parent-container").toggleClass("close-nav");
}

function CheckRequestStatus() {
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: "get",
            url: "/Home/CheckRequestStatus",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            success: function (response) {
                return resolve(response);
            },
            error: function (error) {
                reject(error);
            }
        });
    });
}

function SearchResult(searchTextWithHTML) {
    if (LoginCheck() != "1") {
        showLoginPopup();
        $("#txtsearch").html("");
        return false;
    }
    var SubPrompt = "";

    // Add sub prompts from the right panel selected radio button
    var checkMode = document.querySelector("#chkMode");
    if (checkMode) {
        if (checkMode.checked) {
            var radioButtons = document.getElementsByName('radio_SubPrompt');
            for (var i = 0; i < radioButtons.length; i++) {
                if (radioButtons[i].checked) {
                    SubPrompt = radioButtons[i].value;
                    break;
                }
            }
        }
    }

    showSearch("1", searchTextWithHTML.trim());
    showBlinkCursor();
    DisableSearch();
    $("#txtsearch").html("");

    $.ajax({
        type: "post",
        url: "/Home/SearchTextResult",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "searchtext": searchTextWithHTML.trim(),
            "prefix": $("#hdPromptPrefix").val().trim(),
            "parentID": $("#hdParentID").val(),
            "subPrompt": SubPrompt,
            "LangPromptID": $("#hdnLangPrompt").val()
        },
        success: function (response) {
            hideBlinkCursor();
            if (response != null) {
                if (response != "") {
                    if (response.loginStatus != null && response.loginStatus == "1") {
                        if (response.isMaxRequestReached !== null && response.isMaxRequestReached == "1") {

                            //showNotification("", "Apologies, but you've reached the maximum search limit. Further searches are restricted at the moment!", "error", false);
                            showNotification("", "Oops! You've hit the maximum search limit. Upgrade now to unlock more tokens and continue searching without restrictions!", "error", false);
                        } else {
                            if (response.isInsufficientTokenBalance && ($("#hdnPaymentPlanID").val() == 'c7e3226b-b947-4d72-90a3-512c06661989' || $("#hdnPaymentPlanID").val() == '4B8BBD72-3E56-40B4-A82D-79BF62E0DC78')) {
                                window.location.href = "/home/trialoutoftoken";
                            } else if (response.isInsufficientTokenBalance) {
                                window.location.href = "home/outoftoken";
                            }
                            $("#hdParentID").val(response.parentID);
                            var replacedText = "";
                            if (response.domainName != undefined || response.domainName != null || response.domainName != "") {
                                replacedText = response.domainName.toUpperCase();
                            }
                            showResponse(response.response, replacedText, response.id, "1");
                            BindLeftMenuPrompt("", false, IsFavorite, IsToday);
                            $("#totalTokenRemaining").text(response.totalRemainingToken.toLocaleString("en-US"));
                            $("#hdnCalRemainingValue").val(response.tokenBalancePercentage);
                            console.log(response.tokenBalancePercentage);
                            $(".token-tooltip-txt").text(response.totalRemainingToken.toLocaleString("en-US"));
                            //$('.progress').css('--progress-value', '60');
                            $(".prog-container").css("background", "radial-gradient(closest-side, white 79%, transparent 80% 100%), conic-gradient(#d9d9d9 calc(" + parseInt(response.tokenBalancePercentage) + " * 1%), #4CAF50 0)");
                            //$('.progress').css('--progress-value', '60');
                        }
                    }

                    else {
                        showLoginPopup();
                    }
                }
            }
            HideLoader();
        },
        error: function (error) {
            hideBlinkCursor();
            HideLoader();
            EnableSearch();
        }
    });
}

var blinkhtml = "";
function showBlinkCursor() {
    const elemImg = document.querySelector('#imgMainLogo');
    var imgSrc = "";
    if (elemImg) {
        imgSrc = elemImg.src;
    }

    const displayedText = '';
    const dotCursor = "<span class='dot-cursor123'></span>";
    //container.querySelector('.result-wrapper').innerHTML = displayedText + dotCursor;
    const repText = $("#hfResReplacedText").val();
    //blinkhtml = '<div class="user-response cursor"><div class="result-container ' + serialNumber + ' newresponse"><div class="askyeshua-icon"><img src="' + imgSrc + '" /></div><div class="result-wrapper" style="padding-left:10px;"><p><strong>' + repText + '</strong></p><p>' + dotCursor + '</p></div></div></div>';
    blinkhtml = '<div class="user-response cursor"><div class="result-container ' + serialNumber + ' newresponse"><div class="askyeshua-icon"><img src="' + imgSrc + '" /></div><div class="result-wrapper" style="padding-left:10px;"><p><strong>' + repText + '</strong></p><p><div class="dot-blink">' + dotCursor + '<span class="proc"> ...</span></div></p></div></div></div>';
    $("#divResults").append(blinkhtml);

    /*$("#divResults")[0].scrollTop = $("#divResults")[0].scrollHeight;*/

    const divResults = document.getElementById('result-panel');
    divResults.scrollTop = divResults.scrollHeight;

    function toggleBlink() {
        $('.dot-blink').fadeIn(500, function () {
            $(this).fadeOut(500);
        });

        //$('.dot-cursor123').fadeToggle(500);
        //$('.dot-cursor123').toggle();
    }

    // Set interval to toggle every 500 milliseconds (adjust as needed)
    setInterval(toggleBlink, 1000);
}

function hideBlinkCursor() {
    //$("#divResults").remove(blinkhtml);
    // Assuming you want to remove the div with class "user-response" from "divResult"
    var divResult = document.getElementById('divResults'); // Assuming 'divResult' is the id of the parent div
    if (divResult) {
        var elementsToRemove = divResult.getElementsByClassName('cursor');
        for (var i = 0; i < elementsToRemove.length; i++) {
            var element = elementsToRemove[i];
            divResult.removeChild(element); // Remove the matched element
            break; // Exit the loop assuming there's only one element to remove

        }
    }
    // Clear the interval responsible for blinking
    clearInterval(window.blinkInterval);

    // Function to clear the fadeToggle effect
    $('.dot-cursor123').stop().css('opacity', '');

    // Additional cleanup (if needed)
    $('.dot-cursor123').remove();
}

function displayTypingEffect(text, elementId) {
    const element = document.getElementById(elementId);
    let index = 0;

    // Create a container for the typing text with a blinking cursor
    const typingContainer = document.createElement('span');
    typingContainer.classList.add('typing-container');
    element.innerHTML = '';
    element.appendChild(typingContainer);

    function typeCharacter() {
        if (index < text.length) {
            typingContainer.innerHTML += text.charAt(index);
            index++;
            setTimeout(typeCharacter, 50); // Adjust typing speed here (50ms per character)
        } else {
            // Remove the cursor after typing is done
            typingContainer.style.borderRight = 'none';
        }
    }

    typeCharacter();
}

function showSearch(IsAppend, searchText) {
    var innerHtmlRearch = "";
    var FName = $("#hdFName").val();
    var LName = $("#hdLName").val();
    if (FName != null) {
        var displayName = FName.charAt(0);
        if (LName != null)
            displayName += LName.charAt(0);
        innerHtmlRearch += '<div class="user-search"><div class="question-container"><div class="user-titles"><div class="user-initials">' + displayName.toUpperCase() + '</div><div class="user-name">' + FName + ' ' + LName + '</div></div><div class="result-wrapper"><p> ' + searchText + '</p></div></div></div> ';
    }
    else {
        innerHtmlRearch += '<div class="user-search"><div class="question-container"><div class="user-titles"><div class="user-initials">GU</div><div class="user-name">Gabriel Ungureanu</div></div><div class="result-wrapper"><p> ' + searchText + '</p></div></div></div> ';
    }
    if (IsAppend != undefined && IsAppend == "1")
        $("#divResults").append(innerHtmlRearch);
    else
        $("#divResults").html(innerHtmlRearch);
}

function BindLeftMenuPrompt(parentID, IsArchived, IsFavorite, IsToday) {
    $.ajax({
        type: "POST",
        url: "/Home/GetUserPrompts",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "parentID": parentID,
            "IsArchived": IsArchived,
            "IsFavorite": IsFavorite,
            "IsToday": IsToday
        },
        success: function (response) {
            if (response != null) {
                if (response.length > 0) {
                    $("#divParentChildNode").html("");
                    var htmlParent = "";
                    for (var i = 0; i < response.length; i++) {
                        if (parentID != undefined && parentID != null && response[i].promptFolderID == parentID) {
                            htmlParent += `<div class="lnil-1 active" id="divParents_` + response[i].promptFolderID + `">`;
                        } else {

                            htmlParent += `<div class="lnil-1" id="divParents_` + response[i].promptFolderID + `">`;  //active  
                        }
                        //--------------------remove this node------------------                        
                        htmlParent += '<div id="divParentT_' + response[i].promptFolderID + '" class="lnil-1-content" style="display:none;" >';
                        htmlParent += '<input type="text" id="txt_' + response[i].promptFolderID + '" style="color:#858585;" class="lnil-1-txt" value="' + response[i].promptText + '" onkeyup="SaveParentPrompt(event,\'' + response[i].promptFolderID + '\')" onblur="SaveParentPromptOnBlur(\'' + response[i].promptFolderID + '\')" />';
                        htmlParent += '</div>';

                        htmlParent += `<div style="cursor:pointer;" id="divParentP_` + response[i].promptFolderID + `" class="lnil-1-content" onclick="ShowSessionPrompts(this,'` + response[i].promptFolderID + `')">`;
                        //------------------------------------------------------
                        if (response[i].isFavourite) {
                            htmlParent += '<div class="lnil-1-icon star-icon"></div>';
                        } else {
                            htmlParent += '<div class="lnil-1-icon chat-icon"></div>';
                        }
                        htmlParent += '<p id="pera_' + response[i].promptFolderID + '" class="lnil-1-txt">' + response[i].promptText + '</p><i class="mdi mdi-dots-vertical thread_options" onclick="Showfunction(\'' + response[i].promptFolderID + '\', event)"></i>';
                        htmlParent += '<div id="divthread_' + response[i].promptFolderID + '" class="thread-option-box">';
                        htmlParent += '<div class="thread-option" onclick="RenameParentPrompt(this,\'' + response[i].promptFolderID + '\')"><i class="mdi mdi-pencil-outline"></i> Rename</div>';
                        if (!response[i].isFavourite) {
                            htmlParent += '<div class="thread-option" onclick="AddFavoritePromptByID(this)"><i class="mdi mdi-star-outline"></i> Favorite</div>';
                        } else {
                            htmlParent += '<div class="thread-option" onclick="RemoveFavoritePromptByID(this)"><i class="mdi mdi-star-outline"></i> Unfavorite</div>';
                        }
                        if (response[i].isArchived) {
                            htmlParent += '<div class="thread-option" onclick="ArchivePromptByID(this)" style="color:red;"><i class="mdi mdi-trash-can-outline"></i> Delete</div>';
                        } else {
                            htmlParent += '<div class="thread-option" onclick="ArchivePromptByID(this)" style="color:red;"><i class="mdi mdi-trash-can-outline"></i> Recycle Bin</div>';
                        }
                        htmlParent += '</div>';
                        htmlParent += '</div>';
                        //---------------------------------------------------------------------
                        var htmlChild = '<div class="lnil-1-nav" id="divSearchText">';
                        for (var j = 0; j < response[i].userPrompts.length; j++) {
                            htmlChild += AddLeftMenuPrompt(response[i].userPrompts[j].prompt, "1", response[i].userPrompts[j].promptID);
                        }
                        htmlChild += '</div>';
                        htmlParent += htmlChild;
                        htmlParent += '</div>';
                    }
                    $("#divParentChildNode").html(htmlParent);
                    var PropmtID = $("#hdParentID").val()
                    if (PropmtID != null && PropmtID != "" && PropmtID != undefined) {
                        $("#divParents_" + PropmtID).addClass('active');
                        $($($("#divParents_" + PropmtID).find("a")[0])).addClass("active");
                    }
                } else {
                    $("#divParentChildNode").html("");
                    $("#divResults").html("");
                    $("#hdParentID").val("");
                }
            }
        },
        error: function (error) {
            // alert(error.responsetype);
        }
    });
}

//Make parent rename
function RenameParentPrompt(element, ID) {
    var divParentText = document.getElementById("divParentT_" + ID);
    var divParentPera = document.getElementById("divParentP_" + ID);
    divParentText.style.display = "";
    divParentPera.style.display = "none";
    $("#txt_" + ID).focus();
}

function SaveParentPromptOnBlur(ID) {
    var divParentText = document.getElementById("divParentT_" + ID);
    var divParentPera = document.getElementById("divParentP_" + ID);
    var divThread = document.getElementById("divthread_" + ID);
    if ($("#txt_" + ID).val().trim() != "") {
        $.ajax({
            type: "POST",
            url: "/Home/UpdateParentPrompt",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            async: true,
            data: {
                "ID": ID,
                "Prompt": $("#txt_" + ID).val().trim(),
            },
            success: function (response) {
                if (response != null) {
                    if (response == "1") {
                        $("#pera_" + ID).html($("#txt_" + ID).val().trim());
                    }
                    divParentText.style.display = "none";
                    divParentPera.style.display = "";
                }
                else {
                    showNotification("", "Internal server error!", "error", false);
                    divParentText.style.display = "none";
                    divParentPera.style.display = "";
                }
            },
            error: function (error) {
                showNotification("", "Internal server error!", "error", false);
                divParentText.style.display = "none";
                divParentPera.style.display = "";
            }
        });
        Showfunction(ID, event);
    } else {
        divParentText.style.display = "none";
        divParentPera.style.display = "";
    }
}

function SaveParentPrompt(event, ID) {
    var divParentText = document.getElementById("divParentT_" + ID);
    var divParentPera = document.getElementById("divParentP_" + ID);
    var divThread = document.getElementById("divthread_" + ID);
    if (event.keyCode == 13) {
        if ($("#txt_" + ID).val().trim() != "") {
            $.ajax({
                type: "POST",
                url: "/Home/UpdateParentPrompt",
                contenttype: "application/json;charset=utf-8",
                datatype: "json",
                async: true,
                data: {
                    "ID": ID,
                    "Prompt": $("#txt_" + ID).val().trim(),
                },
                success: function (response) {
                    if (response != null) {
                        if (response == "1") {
                            $("#pera_" + ID).html($("#txt_" + ID).val().trim());
                        }
                        divParentText.style.display = "none";
                        divParentPera.style.display = "";
                    }
                    else {
                        showNotification("", "Internal server error!", "error", false);
                        divParentText.style.display = "none";
                        divParentPera.style.display = "";
                    }
                },
                error: function (error) {
                    showNotification("", "Internal server error!", "error", false);
                    divParentText.style.display = "none";
                    divParentPera.style.display = "";
                }
            });
            Showfunction(ID, event);
        } else {

        }
    } else if (event.keyCode === 27) {
        divParentText.style.display = "none";
        divParentPera.style.display = "";
        Showfunction(ID, event);
    }
}

function Showfunction(ID, event) {
    stopSpeakingAll();
    //popup = "active";
    setTimeout(function () {
        var divThread = document.getElementById("divthread_" + ID);
        // Check the current display property
        var currentDisplay = window.getComputedStyle(divThread, null).getPropertyValue("display");
        event.stopPropagation();
        // Toggle the display property
        if (currentDisplay === "none") {
            divThread.style.display = "block";
        } else {
            divThread.style.display = "none";
        }
    }, 10)
}

function ShowSessionPrompts(element, ID) {

    if ($(window).width() <= 768) {
        stopSpeakingAll();
        var allBtnPrompts = document.querySelectorAll('.lnil-1');
        $("#btn-newchat").removeClass("btn-sel-active");
        allBtnPrompts.forEach(function (btnPrompt) {
            if (btnPrompt !== element.parentElement)
                btnPrompt.classList.remove('active');
        });
        //Stop listning
        deActivateVoice();
        //Show main panel
        const mainCont = document.querySelector(".main-panel-container");
        if (mainCont) {
            mainCont.classList.remove("hide");
        }
        //Show new chat button
        var newBtn = document.querySelector(".top-bar button.header-link");
        if (newBtn) {
            newBtn.style.display = "flex";
        }
        //Hide voice panel in mobile
        const addRightPanel = document.querySelector(".right-panel");
        if (addRightPanel) {
            addRightPanel.classList.remove("active");
        }
        // Show search bar
        const searchBar = document.querySelector(".search-bar-container");
        if (searchBar) {
            searchBar.style.display = "flex";
        }
        const jubileeText = document.querySelector(".search-container-wrapper");
        if (jubileeText) {
            jubileeText.style.display = "none";
        }

        //Hide voice language in mobile
        const voicelang = document.getElementById("sp-lang-wrapper");
        if (voicelang) {
            voicelang.style.display = "none";
        }
        //Show written languages
        const writeLang = document.querySelector(".select-lang");
        if (writeLang) {
            writeLang.style.display = "flex";
        }
        //Close left nav
        const leftNav = document.querySelector(".parent-container");
        if (leftNav) {
            leftNav.classList.add("close-nav");
        }

        if (element.parentElement.classList.contains('active')) {
            element.parentElement.classList.remove('active');
        } else {
            element.parentElement.classList.add('active');
        }

        var divElement = document.getElementById("myDiv");
        if (divElement) {
            divElement.classList.add("main-container-inner");
        }

        var divLogo = document.getElementById("divLogo");
        if (divLogo) {
            divLogo.style.display = "none";
        }
        var divLogo = document.getElementById("divDisc");
        if (divLogo) {
            divLogo.style.display = "none";
        }
        var divLogo = document.getElementById("divShortDisc");
        if (divLogo) {
            divLogo.style.display = "";
        }

        var shareID = $("#shareChatID").val().trim();
        if (shareID != null && shareID != undefined && shareID != "") {
            var divSharebtn = document.getElementById("sharebtn");
            if (divSharebtn) {
                divSharebtn.style.display = "none";
            }
        } else {
            var divSharebtn = document.getElementById("sharebtn");
            if (divSharebtn) {
                divSharebtn.style.display = "none";
            }
        }


        IsChild = 0;
        PromptID = ID;
        serialNumber = 1;

        $("#hdParentID").val(ID);

        $("#divResults").html("");

        $.ajax({
            type: "POST",
            url: "/Home/ShowClickedSessionPrompts",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            async: true,
            data: {
                "parentID": ID,
                "IsArchived": IsArchived,
            },
            success: function (response) {
                if (response != null) {
                    if (response.length > 0) {
                        var count = response.length;

                        var replacedText = "";
                        if (response[0].domainName != undefined && response[0].domainName != null && response[0].domainName != "") {
                            replacedText = response[0].domainName.toUpperCase();
                        }
                        $("#hdnIsSearched").val("");
                        for (var i = 0; i < count; i++) {
                            showSearch("1", response[i].prompt);
                            showResponse(response[i].response, replacedText, response[i].id, undefined, response[i].feedBackType);
                        }
                    }
                }
            },
            error: function (error) {
                //alert(error.responsetype);
            }
        });
    }
    else {

        stopSpeakingAll();
        var allBtnPrompts = document.querySelectorAll('.lnil-1');
        $("#btn-newchat").removeClass("btn-sel-active");
        allBtnPrompts.forEach(function (btnPrompt) {
            if (btnPrompt !== element.parentElement)
                btnPrompt.classList.remove('active');
        });


        if (element.parentElement.classList.contains('active')) {
            element.parentElement.classList.remove('active');
        } else {
            element.parentElement.classList.add('active');
        }

        var divElement = document.getElementById("myDiv");
        if (divElement) {
            divElement.classList.add("main-container-inner");
        }

        var divLogo = document.getElementById("divLogo");
        if (divLogo) {
            divLogo.style.display = "none";
        }
        var divLogo = document.getElementById("divDisc");
        if (divLogo) {
            divLogo.style.display = "none";
        }
        var divLogo = document.getElementById("divShortDisc");
        if (divLogo) {
            divLogo.style.display = "";
        }

        var shareID = $("#shareChatID").val().trim();
        if (shareID != null && shareID != undefined && shareID != "") {
            var divSharebtn = document.getElementById("sharebtn");
            if (divSharebtn) {
                divSharebtn.style.display = "none";
            }
        } else {
            var divSharebtn = document.getElementById("sharebtn");
            if (divSharebtn) {
                divSharebtn.style.display = "flex";
            }
        }


        IsChild = 0;
        PromptID = ID;
        serialNumber = 1;

        $("#hdParentID").val(ID);

        $("#divResults").html("");

        $.ajax({
            type: "POST",
            url: "/Home/ShowClickedSessionPrompts",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            async: true,
            data: {
                "parentID": ID,
                "IsArchived": IsArchived,
            },
            success: function (response) {
                if (response != null) {
                    if (response.length > 0) {
                        var count = response.length;

                        var replacedText = "";
                        if (response[0].domainName != undefined && response[0].domainName != null && response[0].domainName != "") {
                            replacedText = response[0].domainName.toUpperCase();
                        }
                        $("#hdnIsSearched").val("");
                        for (var i = 0; i < count; i++) {
                            showSearch("1", response[i].prompt);
                            showResponse(response[i].response, replacedText, response[i].id, undefined, response[i].feedBackType);
                        }
                    }
                }
            },
            error: function (error) {
                //alert(error.responsetype);
            }
        });
    }
}


function ArchivePromptByID(element) {
    if (PromptID != null && PromptID != "") {
        var TitleData = ""; //Archive Prompt
        var HTMLData = "Are you sure you want to delete the prompt?</br> Click Yes to continue";
        if (IsArchived) {
            TitleData = "";
            HTMLData = "The prompt will be permanently deleted. Are you sure?</br> Click Yes to continue.";
        }
        swal({
            title: TitleData,
            html: HTMLData,
            type: 'warning',
            showCancelButton: true,
            width: 530,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            preConfirm: function () {
                return new Promise(function (resolve) {
                    setTimeout(function () {
                        resolve();
                    }, 50);
                });
            }
        }).then(
            function (result) {
                if (result != null && result.value != null && result.value == true) {
                    if (PromptID != null && PromptID != "") {
                        if (IsChild == 1) {
                            CompleteDeletePrompAction(PromptID, false);
                        } else {
                            CompleteDeletePrompAction(PromptID, true);
                        }
                    }
                    PromptID = "";
                    IsChild = 0;
                }
            }, function (dismiss) {
                // dismiss can be 'cancel', 'overlay', 'esc' or 'timer'
            }
        );
        return false;
    }
}

function AddFavoritePromptByID(element) {
    if (PromptID != null && PromptID != "") {
        if (IsChild == 1) {
        } else {
            PerformFavoritePromptFolder(PromptID, true);
        }
    }
    PromptID = "";
    IsChild = 0;
}

function RemoveFavoritePromptByID(element) {
    if (PromptID != null && PromptID != "") {
        if (IsChild == 1) {
        } else {
            PerformUnFavoritePromptFolder(PromptID, true);
        }
    }
    PromptID = "";
    IsChild = 0;
}

function PerformUnFavoritePromptFolder(promptId, isParent) {
    var promptId = $("#hdParentID").val();
    //var isParent = true;
    $.ajax({
        type: "POST",
        url: "/Home/UnFavoritePrompt",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: { "promptId": promptId, "isParent": isParent },
        success: function (response) {
            if (response != null) {
                if (response.status == "1") {
                    //showNotification('', response.msg, 'success', false);
                    BindLeftMenuPrompt("", false, IsFavorite, IsToday);
                }
                else {
                    showNotification('', response.msg, 'error', false);
                }
            }
        },
        error: function (error) {
            // alert(error.responsetype);
        }
    });
}

function PerformFavoritePromptFolder(promptId, isParent) {
    var promptId = $("#hdParentID").val();
    //var isParent = true;
    $.ajax({
        type: "POST",
        url: "/Home/FavoriteUserPrompt",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: { "promptId": promptId, "isParent": isParent },
        success: function (response) {
            if (response != null) {
                if (response.status == "1") {
                    //showNotification('', response.msg, 'success', false);
                    BindLeftMenuPrompt("", false, IsFavorite, IsToday);
                }
                else {
                    showNotification('', response.msg, 'error', false);
                }
            }
        },
        error: function (error) {
            // alert(error.responsetype);
        }
    });
}

function CompleteDeletePrompAction(promptId, isParent) {
    $.ajax({
        type: "POST",
        url: "/Home/DeleteUserPrompt",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: { "promptId": promptId, "isParent": isParent },
        success: function (response) {
            if (response != null) {
                if (response.status == "1") {
                    showNotification('', response.msg, 'success', false);
                    var a = IsArchived;
                    var b = IsToday;
                    $("#divResults").html("");
                    BindLeftMenuPrompt("", IsArchived, IsFavorite, IsToday);
                }
                else {
                    showNotification('', response.msg, 'error', false);
                }
            }
        },
        error: function (error) {
            // alert(error.responsetype);
        }
    });
}

function ShowPromptByID(Id) {
    if ($(window).width() <= 768) {
        //For mobile
        var divElement = document.getElementById("myDiv");
        divElement.classList.remove("main-container-inner");

        $("#divResults").html("");

        $.ajax({
            type: "post",
            url: "/Home/ShowClickedPrompt",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            async: true,
            data: {
                "Id": Id
            },
            success: function (response) {
                if (response != null) {
                    if (response != "") {
                        var replacedText = "";
                        if (response.domainName != undefined && response.domainName != null && response.domainName != "") {
                            replacedText = response.domainName.toUpperCase();
                        }
                        $("#hdnIsSearched").val("");
                        showSearch("0", response.prompt);
                        showResponse(response.response, replacedText, response.id, undefined, response.feedBackType);
                    }
                }
            },
            error: function (error) {
                alert(error.responsetype);
            }
        });
    }
    else {
        //For web
        var divElement = document.getElementById("myDiv");
        divElement.classList.add("main-container-inner");

        var divLogo = document.getElementById("divLogo");
        divLogo.style.display = "none";

        var divLogo = document.getElementById("divDisc");
        divLogo.style.display = "none";

        var divLogo = document.getElementById("divShortDisc");
        divLogo.style.display = "";

        $("#divResults").html("");

        $.ajax({
            type: "post",
            url: "/Home/ShowClickedPrompt",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            async: true,
            data: {
                "Id": Id
            },
            success: function (response) {
                if (response != null) {
                    if (response != "") {
                        var replacedText = "";
                        if (response.domainName != undefined && response.domainName != null && response.domainName != "") {
                            replacedText = response.domainName.toUpperCase();
                        }
                        $("#hdnIsSearched").val("");
                        showSearch("0", response.prompt);
                        showResponse(response.response, replacedText, response.id, undefined, response.feedBackType);
                    }
                }
            },
            error: function (error) {
                alert(error.responsetype);
            }
        });
    }

}

function ShowUserPrompt(clickedElement) {
    if ($(window).width() <= 768) {
        stopSpeakingAll();

        //Show main panel
        const mainCont = document.querySelector(".main-panel-container");
        if (mainCont) {
            mainCont.classList.remove("hide");
        }
        //Close left nav
        const leftNav = document.querySelector(".parent-container");
        if (leftNav) {
            leftNav.classList.add("close-nav");
        }

        var allBtnPrompts = document.querySelectorAll('.btnPrompt');
        allBtnPrompts.forEach(function (btnPrompt) {
            btnPrompt.classList.remove('active');
        });
        clickedElement.classList.add('active');

        $("#divSearchText .lnil-1-nav-item").find("input").hide();
        $("#divSearchText .lnil-1-nav-item").find("a").show();
        var dynamicId = $(clickedElement).data("id");
        ShowPromptByID(dynamicId);

        IsChild = 1;
        PromptID = dynamicId;
    }
    else {
        var allBtnPrompts = document.querySelectorAll('.btnPrompt');
        allBtnPrompts.forEach(function (btnPrompt) {
            btnPrompt.classList.remove('active');
        });
        clickedElement.classList.add('active');

        $("#divSearchText .lnil-1-nav-item").find("input").hide();
        $("#divSearchText .lnil-1-nav-item").find("a").show();
        var dynamicId = $(clickedElement).data("id");
        ShowPromptByID(dynamicId);

        IsChild = 1;
        PromptID = dynamicId;
    }
    var allBtnPrompts = document.querySelectorAll('.btnPrompt');
    allBtnPrompts.forEach(function (btnPrompt) {
        btnPrompt.classList.remove('active');
    });
    clickedElement.classList.add('active');

    $("#divSearchText .lnil-1-nav-item").find("input").hide();
    $("#divSearchText .lnil-1-nav-item").find("a").show();
    var dynamicId = $(clickedElement).data("id");
    ShowPromptByID(dynamicId);

    IsChild = 1;
    PromptID = dynamicId;
}

function FilterPrompt() {
    var SearchVal = $("#txtpromptsearch").val();
    var allPrompt = $("#divSearchText p");
    if (SearchVal.toString().trim() === "") {
        $("#divSearchText >div").show();
    }
    else {
        for (var i = 0; i < allPrompt.length; i++) {
            if ($(allPrompt[i]).html().toString().trim().toLowerCase().indexOf(SearchVal.toString().trim().toLowerCase()) > -1) {
                $(allPrompt[i]).closest("div").show();
            }
            else {
                $(allPrompt[i]).closest("div").hide();
            }
        }
    }
}

function EditPromptData(ctrl) {
    $("#divSearchText input").hide();
    $("#divSearchText a").show();

    $(ctrl).closest(".lnil-1-nav-item").find("a").hide();
    $(ctrl).closest(".lnil-1-nav-item").find("input").show();
    $(ctrl).closest(".lnil-1-nav-item").find("input").focus();
    $(ctrl).closest(".lnil-1-nav-item").find("input").select();
}

function ValidateActionPerformed(ev, ctrl) {
    //  alert(ev.keyCode);
    var KeyCode = ev.keyCode;
    if (KeyCode == null || KeyCode == undefined) {
        KeyCode = e.which;
    }
    // when esc key is pressed
    if (KeyCode === 27) {
        $(ctrl).val($(ctrl).attr("data-val"));
        $(ctrl).closest(".lnil-1-nav-item").find("input").hide();
        $(ctrl).closest(".lnil-1-nav-item").find("a").show();
    }
    // when User hit enter after modification key is pressed
    else if (KeyCode === 13) {
        //alert($(ctrl).attr("data-id"));
        //alert("Saving the data");
        UpdatePromptData($(ctrl).attr("data-id"), $(ctrl).val());

        $(ctrl).closest(".lnil-1-nav-item").find("input").hide();
        $(ctrl).closest(".lnil-1-nav-item").find("a").show();
        var Prompval = $(ctrl).val();
        if (Prompval.length > 25) {
            var NewText = Prompval.substring(0, 25);
            $(ctrl).closest(".lnil-1-nav-item").find("p").html(NewText.trim() + "...");

        }
        else {
            $(ctrl).closest(".lnil-1-nav-item").find("p").html($(ctrl).val().trim());
        }
        return false;
    }
}

function UpdatePromptData(ID, Promptval) {
    var status = "0"
    try {
        $.ajax({
            type: "POST",
            url: "/Home/UpdatePromptData",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            async: false,
            data: { "ID": ID, "Promptval": Promptval },
            success: function (response) {
                if (response != null) {
                    if (response != undefined && response != null && response == "1") {
                        status = response;
                        //BindLeftMenuPrompt();
                    }
                }
            },
            error: function (error) {
            }
        });
    } catch (e) {

    }
    return status;
}

function AddLeftMenuPrompt(inputText, loginStatus, Id) {
    var searchText = '<div class="lnil-1-nav-item">';
    searchText += '<img src="/images/chat.svg" />';
    //var inputText = $("#txtsearch").html();

    if (loginStatus == "1") {
        searchText += '<input type="text"  style="display:none;" data-id="' + Id + '" data-val=\"' + inputText + '"  class="lnil-1-nav-txt" onkeyUp="return ValidateActionPerformed(event,this)" value=\"' + inputText + '" />';
        if (inputText.length > 100) {
            //If the input text is longer than 15 characters, truncate it to 20 characters
            inputText = inputText.substring(0, 100);
            searchText += `<a class='btnPrompt' style="cursor:pointer;" data-id='${Id}' onclick='ShowUserPrompt(this)'><p class='lnil-1-nav-txt'>` + inputText + `...</p></a>`;
        } else {
            searchText += `<a class='btnPrompt' style="cursor:pointer;" data-id='${Id}' onclick='ShowUserPrompt(this)'><p class='lnil-1-nav-txt'>` + inputText + `</p></a>`;
        }
    }
    else {
        searchText += '<input type="text"  style="display:none;" data-id="' + Id + '"  data-val=\"' + inputText + '" class="lnil-1-nav-txt" onkeyUp="return ValidateActionPerformed(event,this)" value=\"' + inputText + '/>';
        if (inputText.length > 100) {
            //If the input text is longer than 15 characters, truncate it to 20 characters
            inputText = inputText.substring(0, 100);
            searchText += '<p class="lnil-1-nav-txt">' + inputText + '...</p>';

        } else {
            searchText += '<p class="lnil-1-nav-txt">' + inputText + '</p>';
        }
    }
    searchText += '<div class="left-nav-item-edit" >';
    searchText += '<?xml version="1.0" ?>';
    searchText += '<svg onclick="EditPromptData(this);" class="feather feather-edit" fill="none" height="18" stroke="#dedede"';
    searchText += 'stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"';
    searchText += 'xmlns="http://www.w3.org/2000/svg">';
    searchText += '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />';
    searchText += '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />';
    searchText += '</svg>';
    searchText += '</div>';
    searchText += '</div>';
    //$("#divSearchText").append(searchText);
    return searchText;
}

var serialNumber = 1;

async function showResponse(responseText, replacedText, responseID,IsBuffer,feedbacktype) {
    deActivateJubileeJSVGenesis();
    stopSpeakingAllMiddle();
    const elementsText = document.querySelector('#hfResponseReplacedText');
    if (elementsText) {
        if (elementsText.value != "") {
            replacedText = elementsText.value;
        }
    }
    const elemImg = document.querySelector('#imgMainLogo');
    var imgSrc = "";
    if (elemImg) {
        imgSrc = elemImg.src;
    }

    var innerHtml = "";
    var domainName = $("#hdDomainName").val();

    responseText = responseText.replace(new RegExp("ELOHIM", 'g'), 'E<small>LOHIM</small>');
    responseText = responseText.replace(new RegExp("YAHUAH", 'g'), 'T<small>AHUAH</small>');
    responseText = responseText.replace(new RegExp("BREATH OF ELOHIM", 'g'), 'B<small>REATH OF</small> E<small>LOHIM</small>');
    responseText = responseText.replace(new RegExp("RUACH ELOHIM", 'g'), 'R<small>UACH</small> E<small>LOHIM</small>');
    responseText = responseText.replace(new RegExp("RUACH KODESH", 'g'), 'R<small>UACH</small> K<small>ODESH</small>');
    responseText = responseText.replace(new RegExp("WORD OF ELOHIM", 'g'), 'W<small>ORD OF</small> E<small>LOHIM</small>');
    responseText = responseText.replace(new RegExp("RUACH", 'g'), 'R<small>UACH</small>');
    responseText = responseText.replace(new RegExp("ADONAI", 'g'), 'A<small>DONAI</small>');
    responseText = responseText.replace(new RegExp("TESHUAH", 'g'), 'T<small>ESHUAH</small>');

    responseText.replace(new RegExp("JubileeGPT", 'g'), replacedText)
    
    innerHtml += ' <div class="user-response"><div class="result-container ' + serialNumber + ' newresponse"><div class="askyeshua-icon"><img src="' + imgSrc + '" /></div><div class="result-wrapper" style="padding-left:10px;"><div class="result-title"> <p><strong>' + replacedText + '</strong></p></div><div class="results" id="result' + serialNumber + '">' + responseText + '  </div><div class="response-controls"><span class="read-response tooltip" id="read-response-' + serialNumber + '" onclick="speakSelected(this,' + serialNumber + ')"><img src="../images/read-response.svg" /><span class="tooltiptext">Read aloud</span></span> <span class="process-response tooltip" id="process-response-' + serialNumber + '" ><img src="../images/processing-image.gif" /><span class="tooltiptext">Processing</span></span> <span class="stop-read-response tooltip" id="stop-read-response-' + serialNumber + '" onclick="stopSpeakingAllMiddle(this,' + serialNumber + ')"><img src="../images/stop-read-response.svg" /><span class="tooltiptext">Stop</span></span><span class="copy-response tooltip" onclick="copyResponseToClipboard(event,' + serialNumber + ')" id="copy-response-' + serialNumber + '"><img src="../images/copy-response.svg" /><span class="tooltiptext">Copy</span></span><span class="response-copied tooltip" id="response-copied-' + serialNumber + '"><img src="../images/response-copied.svg" /><span class="tooltiptext" id="copytooltipid-' + serialNumber + '">Copy</span></span><span class="thumbs-up tooltip" id="upThumb_' + responseID + '" onclick="ResponseFeedback(\'' + responseID + '\', \'Positive\');"><svg width="28px" height="28px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"/>< g id = "SVGRepo_tracerCarrier" stroke - linecap="round" stroke - linejoin="round" /> <g id="SVGRepo_iconCarrier"> <path d="M20.22 9.55C19.79 9.04 19.17 8.75 18.5 8.75H14.47V6C14.47 4.48 13.24 3.25 11.64 3.25C10.94 3.25 10.31 3.67 10.03 4.32L7.49 10.25H5.62C4.31 10.25 3.25 11.31 3.25 12.62V18.39C3.25 19.69 4.32 20.75 5.62 20.75H17.18C18.27 20.75 19.2 19.97 19.39 18.89L20.71 11.39C20.82 10.73 20.64 10.06 20.21 9.55H20.22ZM5.62 19.25C5.14 19.25 4.75 18.86 4.75 18.39V12.62C4.75 12.14 5.14 11.75 5.62 11.75H7.23V19.25H5.62ZM17.92 18.63C17.86 18.99 17.55 19.25 17.18 19.25H8.74V11.15L11.41 4.9C11.45 4.81 11.54 4.74 11.73 4.74C12.42 4.74 12.97 5.3 12.97 5.99V10.24H18.5C18.73 10.24 18.93 10.33 19.07 10.5C19.21 10.67 19.27 10.89 19.23 11.12L17.91 18.62L17.92 18.63Z" fill="" /> </g></svg ><span class="tooltiptext">Good Response</span></span><span class="thumbs-down tooltip" id="downThumb_' + responseID + '"   onclick="ResponseFeedback(\'' + responseID + '\', \'Negative\');"><svg width="28px" height="28px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"/>< g id = "SVGRepo_tracerCarrier" stroke - linecap="round" stroke - linejoin="round" /> <g id="SVGRepo_iconCarrier"> <path d="M18.38 3.25H6.81C5.72 3.25 4.79 4.03 4.6 5.11L3.29 12.61C3.18 13.27 3.36 13.94 3.78 14.45C4.21 14.96 4.83 15.25 5.5 15.25H9.53V18C9.53 19.52 10.76 20.75 12.36 20.75C13.06 20.75 13.69 20.33 13.97 19.68L16.51 13.75H18.39C19.7 13.75 20.76 12.69 20.76 11.38V5.61C20.76 4.31 19.7 3.25 18.39 3.25H18.38ZM15.26 12.85L12.59 19.1C12.55 19.19 12.46 19.26 12.27 19.26C11.58 19.26 11.03 18.7 11.03 18.01V13.76H5.5C5.27 13.76 5.07 13.67 4.93 13.5C4.78 13.33 4.73 13.11 4.77 12.88L6.08 5.38C6.14 5.02 6.45001 4.76 6.82 4.76H15.26V12.85ZM19.25 11.38C19.25 11.86 18.86 12.25 18.38 12.25H16.77V4.75H18.38C18.86 4.75 19.25 5.14 19.25 5.61V11.38Z" fill="" /> </g></svg ><span class="tooltiptext">Bad Response</span></span><span class="exclamation tooltip" id="ExcReport_' + responseID + '" onclick="ReportFeedback(\'' + responseID + '\');"><span><img src="../images/exclamation.svg" /><span class="tooltiptext">Report Inappropriate Content</span></span></div> </div></div></div>';

    
    $("#divResults").append(innerHtml);

    if (feedbacktype == "Positive") {
        $("#upThumb_" + responseID).addClass('liked');
        $("#downThumb_" + responseID).hide();
    } else if (feedbacktype == "Negative") {
        $("#upThumb_" + responseID).removeClass('liked');
        $("#downThumb_" + responseID).addClass('disliked');
    } else {
        //Do nothing
    }

    var IsSearched = $("#hdnIsSearched").val();
    if (IsSearched != null && IsSearched != "" && IsSearched != undefined) {
        $("#result-panel")[0].scrollTop = $("#result-panel")[0].scrollHeight;
    }
 
    if (!IsBuffer) {
        activateSpeakCopyButtons();
    }

    if (IsBuffer != undefined && IsBuffer != null && IsBuffer == "1") {
        var divresults = document.getElementById("result-panel");
        divresults.scrollTop = divresults.scrollHeight;
        const elements = document.getElementsByClassName(serialNumber);
        for (var i = 0; i < elements.length; i++) {
            if (i == elements.length - 1) {
                animateTextAndImage(elements[i]);
            }
            else {
                setFullResponse(elements[i]);
            }
        }
    }
    serialNumber++;
}
function ResponseFeedback(id, response) {
    const upThumb = $("#upThumb_" + id);
    const downThumb = $("#downThumb_" + id);
    const isDisliked = downThumb.hasClass('disliked');

    if (response === "Negative") {
        // Toggling dislike
        if (isDisliked) {
            //downThumb.removeClass('disliked');
        } else {
            downThumb.addClass('disliked');

            $.ajax({
                type: 'POST',
                url: '/Home/InsertFeedback',
                data: {
                    feedbackType: "Negative",
                    responseId: id
                },
                success: function (response) {
                    // Optionally handle success
                },
                error: function (xhr, status, error) {
                    console.error('Error submitting feedback:', error);
                }
            });
        }
    }

    if (response === "Positive") {
        $.ajax({
            type: 'POST',
            url: '/Home/InsertFeedback',
            data: {
                feedbackType: "Positive",
                responseId: id
            },
            success: function (response) {
                if (response && response.status) {
                    upThumb.addClass('liked');
                    downThumb.detach(); // Remove dislike button
                } else {
                    showNotification("", "Fail to update response.", "error", false);
                }
            },
            error: function (xhr, status, error) {
                console.error('Error submitting feedback:', error);
            }
        });
    }
}

var ChatMessageId;
function submitReport() {
    const MessageID = ChatMessageId;
    const SelectedReason = $("#ddlReport option:selected").text().trim();
    const OptionalComment = $("#txtComment").val().trim();
    if (SelectedReason == "-- Select Reason --") {
        showNotification("", "Please select a reason.", "warning", false);
        return;
    }
    var Data = new FormData();
    Data.append("MessageId", MessageID);
    Data.append("SelectedReason", SelectedReason);
    Data.append("OptionalComment", OptionalComment);

    $.ajax({
        url: '/Home/InsertReportFeedback',
        type: 'POST',
        data: Data,
        contentType: false,
        processData: false,
        success: function (result) {
            //when submit report reason then
            closeExclamationPopup();
            showNotification("", "Report Submitted Successfully", "success", true);
        },
        error: function (xhr, status, error) {
            console.error('Error:', error);
        }
    });
}


function ReportFeedback(messageId) {
    const responseText = $("#ExcReport_" + messageId).parent().prev(".results").html().replace(/<[^>]*>/g, '');
    $("#responsePreview").html(responseText);
    ChatMessageId = messageId;
    $("#Exclamationpopup").css("display", "flex");
    BindFeedbackReason();
}

function closeExclamationPopup() {
    $("#Exclamationpopup").css("display", "none");
    ChatMessageId = null;
}




function setFullResponse(container) {
    //ShowLoader();
    var responseText = container.querySelector('.result-wrapper').getInnerHTML();
    responseText = responseText.replace(new RegExp("ELOHIM", 'g'), 'E<small>LOHIM</small>');
    responseText = responseText.replace(new RegExp("ELOHIM", 'g'), 'E<small>LOHIM</small>');
    responseText = responseText.replace(new RegExp("YAHUAH", 'g'), 'T<small>AHUAH</small>');
    responseText = responseText.replace(new RegExp("BREATH OF ELOHIM", 'g'), 'B<small>REATH OF</small> E<small>LOHIM</small>');
    responseText = responseText.replace(new RegExp("RUACH ELOHIM", 'g'), 'R<small>UACH</small> E<small>LOHIM</small>');
    responseText = responseText.replace(new RegExp("RUACH KODESH", 'g'), 'R<small>UACH</small> K<small>ODESH</small>');
    responseText = responseText.replace(new RegExp("WORD OF ELOHIM", 'g'), 'W<small>ORD OF</small> E<small>LOHIM</small>');
    responseText = responseText.replace(new RegExp("RUACH", 'g'), 'R<small>UACH</small>');
    responseText = responseText.replace(new RegExp("ADONAI", 'g'), 'A<small>DONAI</small>');
    responseText = responseText.replace(new RegExp("TESHUAH", 'g'), 'T<small>ESHUAH</small>');
    var imageElement = container.querySelector('.askyeshua-icon img');
    var index = 0;
    container.querySelector('.result-wrapper').innerHTML = responseText;
}

let typingStopped = false;

function animateTextAndImage(container) {
    try {
        /// Adjust the timeout for the desired typing speed
        var typeSpeed = 10;
        typingStopped = false;
        ShowPauseButton();
        //var responseText = container.querySelector('.result-wrapper').getInnerHTML();
        var resultContainer = container.querySelector('.results');
        if (resultContainer) {
            var responseText = resultContainer.innerHTML;
            responseText = responseText.replace(new RegExp("ELOHIM", 'g'), 'E<small>LOHIM</small>');
            responseText = responseText.replace(new RegExp("ELOHIM", 'g'), 'E<small>LOHIM</small>');
            responseText = responseText.replace(new RegExp("YAHUAH", 'g'), 'T<small>AHUAH</small>');
            responseText = responseText.replace(new RegExp("BREATH OF ELOHIM", 'g'), 'B<small>REATH OF</small> E<small>LOHIM</small>');
            responseText = responseText.replace(new RegExp("RUACH ELOHIM", 'g'), 'R<small>UACH</small> E<small>LOHIM</small>');
            responseText = responseText.replace(new RegExp("RUACH KODESH", 'g'), 'R<small>UACH</small> K<small>ODESH</small>');
            responseText = responseText.replace(new RegExp("WORD OF ELOHIM", 'g'), 'W<small>ORD OF</small> E<small>LOHIM</small>');
            responseText = responseText.replace(new RegExp("RUACH", 'g'), 'R<small>UACH</small>');
            responseText = responseText.replace(new RegExp("ADONAI", 'g'), 'A<small>DONAI</small>');
            responseText = responseText.replace(new RegExp("TESHUAH", 'g'), 'T<small>ESHUAH</small>');
            var imageElement = container.querySelector('.askyeshua-icon img');

            var index = 0;
            const dotCursor = "<span class='dot-cursor123'></span>";
            function updateTextAndImage() {
                try {
                    if (index < responseText.length && !typingStopped) {
                        const displayedText = responseText.substring(0, index + 1);
                        //container.querySelector('.result-wrapper').innerHTML = displayedText + dotCursor;
                        container.querySelector('.results').innerHTML = displayedText + dotCursor;
                        index++;
                        setTimeout(updateTextAndImage, typeSpeed);
                        /// Adjust the timeout for the desired typing speed
                        const divResults = document.getElementById('result-panel');
                        divResults.scrollTop = divResults.scrollHeight;
                    }
                    else {
                        //container.querySelector('.result-wrapper').innerHTML = responseText.substring(0, index + 1);
                        container.querySelector('.results').innerHTML = responseText.substring(0, index + 1);
                        index++;
                        // Activate speak copy buttons
                        activateSpeakCopyButtons();
                        if (!typingStopped) {
                            if (index < responseText.length - 1) {
                                setTimeout(updateTextAndImage, typeSpeed);
                                /// Adjust the timeout for the desired typing speed
                            }
                        }
                        HidePauseButton();
                        EnableLeftMenuPanel();
                        EnableSearch();
                        $("#txtsearch").focus();
                    }
                } catch (e) { }
            }
            if (!typingStopped) {
                updateTextAndImage();
            }
        }
    } catch (e) {
        //alert("Exception: " + e.message);
    }
}

function StopWriting() {
    typingStopped = true;
    // Activate speak copy buttons
    activateSpeakCopyButtons();
    showNotification("Oops!", "The operation was manually terminated by the user prior to completion.", "error", false);
}

function ShowPauseButton() {
    activateSearchMode_SearchText();
    var btnStop = document.getElementById("divloaderStop");
    var btnSearch = document.getElementById("divloader");

    setTimeout(function () {
        if (btnSearch) {
            if (btnSearch.classList.contains('active')) {
                btnSearch.classList.remove('active');
            }
        }
        if (btnStop) {
            if (!btnStop.classList.contains('active')) {
                btnStop.classList.add('active');
            }
        }
    }, 100);
}

function HidePauseButton() {
    var btnStop = document.getElementById("divloaderStop");
    var btnSearch = document.getElementById("divloader");
    if (btnStop) {
        if (btnStop.classList.contains('active')) {
            btnStop.classList.remove('active');
        }
    }
    //if (btnSearch) {
    //    if (!btnSearch.classList.contains('active')) {
    //        btnSearch.classList.add('active');
    //    }
    //}
    activateVoiceMode_SearchText();
}

function ShowHidePromptTextBox() {
    var status = LoginCheck();
    if (status != undefined && status != null && status == "1") {
        document.getElementById('divSearch').classList.remove('disabled');
    } else {
        document.getElementById('divSearch').classList.add('disabled');
    }
    HidePaseButon();
}

function LoginCheck() {
    var status = "0"
    try {
        $.ajax({
            type: "get",
            url: "/Home/CheckSession",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            async: false,
            data: {},
            success: function (response) {
                if (response != null) {
                    if (response.status != undefined && response.status != null && response.status == "1") {
                        status = response.status;
                    }
                }
            },
            error: function (error) {
            }
        });
    } catch (e) {

    }
    return status;
}

function CheckLogin() {
    try {
        $.ajax({
            type: "get",
            url: "/Home/CheckSession",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            async: true,
            data: {},
            success: function (response) {
                if (response != null) {
                    if (response.status == "1") {
                        ShowPopup();
                    } else {
                        window.location.href = '/signin';
                    }
                }
            },
            error: function (error) {
                alert(error.responsetype);
            }
        });
    } catch (e) {

    }
}

function ShowPopup() {
    try {
        var myElement = document.getElementById("divPremiumPopup");
        if (myElement.style.display === "none") {
            myElement.style.display = "block";
        } else {
            myElement.style.display = "none";
        }
    } catch (e) {

    }
}

function ShowHideSearchTextBox() {
    try {
        var status = LoginCheck();
        var btnSignup = document.getElementById("btnRedirectSignup");
        var divSearch = document.getElementById("divSearch");
        if (status != undefined && status != null && status == "1") {
            divSearch.style.display = "";
            btnSignup.style.display = "none";
        } else {
            btnSignup.style.display = "";
            divSearch.style.display = "none";
        }
    } catch (e) {

    }
}

function redirect_PaymentPage() {
    window.location.href = '/payment-page';
}

function redirect_Signup() {
    window.location.href = '/signin';
}

function ClosePopup() {
    var myElement = document.getElementById("divPremiumPopup");
    if (myElement.style.display === "block") {
        myElement.style.display = "none";
    } else {
        myElement.style.display = "block";
    }
}

function ShowHideModePanel(type) {
    var element = document.querySelector("#chkMode");
    var elementResult = document.querySelector(".result-panel");
    var elementMode = document.querySelector(".mode-btn-panel");
    if (element) {
        if (type == 'R')
            element.checked = false;
        if (elementResult) {
            elementResult.classList.toggle("show-mode", element.checked);
            elementMode.classList.toggle("mode-on", element.checked);
        }
    }
}

function toggleShowOption(element) {
    var modeWrapper = element.closest('.mode-wrapper');
    var allModeWrappers = document.querySelectorAll('.mode-wrapper');
    allModeWrappers.forEach(function (wrapper) {
        if (wrapper !== modeWrapper) {
            wrapper.classList.remove('show-option');
        }
    });
    if (modeWrapper) {
        modeWrapper.classList.toggle('show-option');
    }
}

var i = 1;
var previousRadioButton;
function toggleRadioButton(radioButton) {
    // Toggle the checked state of the clicked radio button
    if (radioButton == previousRadioButton) {
        if (i % 2 == 0)
            radioButton.checked = !radioButton.checked;
    } else {
        i = 1;
        if (i % 2 == 0)
            radioButton.checked = !radioButton.checked;
    }
    i++;
    previousRadioButton = radioButton;
    if (!radioButton.checked) {
        //If needs to close mode panel on unselect then radio button then uncomment the following line.
        //ShowHideModePanel('R');
    }
}

function BindModeSection() {
    try {
        $.ajax({
            type: "get",
            url: "/Home/BindModeSection",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            async: true,
            success: function (response) {
                var htmlMode = '';
                if (response != null) {
                    if (response.length > 0) {
                        for (var i = 0; i < response.length; i++) {
                            if (i == 0) {
                                htmlMode += '<div class="mode-wrapper show-option">';
                            } else {
                                htmlMode += '<div class="mode-wrapper">';
                            }
                            htmlMode += '    <div class="mode-name" onclick="toggleShowOption(this)" style="cursor:pointer;">';
                            htmlMode += '        <div class="mode-icon">';
                            htmlMode += '           ' + response[i].parentIcon + '';
                            htmlMode += '        </div > ';
                            htmlMode += '        <p class="mode-title">' + response[i].parentCategory + '</p>';
                            htmlMode += '    </div>';
                            htmlMode += '    <div class="mode-option-wrapper">';
                            if (response[i].modePromptChildren != null) {
                                for (var j = 0; j < response[i].modePromptChildren.length; j++) {
                                    htmlMode += '        <div class="mode-option">';
                                    htmlMode += '            <label class="rad">';
                                    if (i == 0 && j == 0)
                                        htmlMode += '                <input type="radio" checked name="radio_SubPrompt" id="r_' + response[i].modePromptChildren[j].childID + '" value="' + response[i].modePromptChildren[j].subPrompt + '" onclick="toggleRadioButton(this)">';
                                    else
                                        htmlMode += '                <input type="radio" name="radio_SubPrompt" id="r_' + response[i].modePromptChildren[j].childID + '" value="' + response[i].modePromptChildren[j].subPrompt + '" onclick="toggleRadioButton(this)">';
                                    htmlMode += '                    <span class="rad-chk"></span>';
                                    htmlMode += '            </label>';
                                    htmlMode += '            <div class="mode-option-icon">';
                                    htmlMode += '                ' + response[i].modePromptChildren[j].childIcon + '';
                                    htmlMode += '            </div>';
                                    htmlMode += '            <label class="mode-option-title" for="r_' + response[i].modePromptChildren[j].childID + '">' + response[i].modePromptChildren[j].childCategory + '</label>';
                                    htmlMode += '        </div>';
                                }
                            }
                            htmlMode += '    </div>';
                            htmlMode += '</div>';
                        }
                        var myElement = document.querySelector(".mode-btn-panel");
                        if (myElement)
                            myElement.style.display = ""
                    }
                }
                $(".mode-container").html(htmlMode);
            },
            error: function (error) {
            }
        });
    } catch (e) {

    }
}

function activateVoice() {
    if ($(window).width() <= 768) {
        //for mobile view
        let div = document.getElementById('right-panel');
        let div_mic_wrap = document.getElementById('mic-wrap-voice-active');
        if (div) {
            if (!div.classList.contains('active')) {
                div.classList.add('active');
            }
        }

        //hide voice launcher
        const voiceicon = document.querySelector(".mob-voice-launch");
        if (voiceicon) {
            voiceicon.style.display = "none";

        }


        // Show chats
        const mainContainer = document.querySelector(".main-container");
        if (mainContainer) {
            mainContainer.classList.remove("main-container-inner");
        }

        if (div_mic_wrap) {
            div_mic_wrap.style.display = 'none';
        }
        //Hide new chat button
        var newBtn = document.querySelector(".top-bar button.header-link");
        if (newBtn) {
            newBtn.style.display = "none";
        }
        //Hide Chats
        var divElement = document.getElementById("myDiv");
        if (divElement) {
            divElement.classList.remove("main-container-inner");
        }
        //Hide Logo
        var divLogo = document.getElementById("divLogo");
        if (divLogo) {
            divLogo.style.display = "none";
        }
        //Hide jubileeGPT text
        var jubleetext = document.querySelector(".search-container-wrapper");
        if (jubleetext) {
            jubleetext.style.display = "none";
        }
        //Hide Search bar Text
        var divSearch = document.getElementById("divSearch");
        if (divSearch) {
            divSearch.style.display = "none";
        }
        //Hide disclaimer
        var divDisc = document.getElementById("divDisc");
        if (divDisc) {
            divDisc.style.display = "none";
        }
        //Show voice language in mobile
        const voicelang = document.getElementById("sp-lang-wrapper");
        if (voicelang) {
            voicelang.style.display = "flex";
        }
        // Hide written languages
        const writeLang = document.querySelector(".select-lang");
        if (writeLang) {
            writeLang.style.display = "none";
        }
        isStopHit = false;
        isCommunicationStop = false;
        recognition.start();

    } else {
        //for web 
        let div = document.getElementById('right-panel');
        let div_mic_wrap = document.getElementById('mic-wrap-voice-active');
        if (div) {
            if (!div.classList.contains('active')) {
                div.classList.add('active');
            }
        }
        if (div_mic_wrap) {
            div_mic_wrap.style.display = 'none';
        }
        isStopHit = false;
        isCommunicationStop = false;
        recognition.start();
    }

}

function deActivateVoice() {
    stopCommunication();
    let div = document.getElementById('right-panel');
    let div_mic_wrap = document.getElementById('mic-wrap-voice-active');
    if (div) {
        if (div.classList.contains('active')) {
            div.classList.remove('active');
        }
    }
    if (div_mic_wrap) {
        div_mic_wrap.style.display = 'flex';
    }
}

function activateVoiceMode_SearchText() {
    let element = document.getElementById('searchbox-voice-mode');
    let btn = document.getElementById('divloader');
    let btnStop = document.getElementById('divloaderStop');
    if (element) {
        if (!element.classList.contains('active')) {
            element.classList.add('active');
        }
    }
    if (btn) {
        if (btn.classList.contains('active')) {
            btn.classList.remove('active');
        }
    }
    if (btnStop) {
        if (btnStop.classList.contains('active')) {
            btnStop.classList.remove('active');
        }
    }
}

function activateSearchMode_SearchText() {
    let element = document.getElementById('searchbox-voice-mode');
    let btn = document.getElementById('divloader');
    let btnStop = document.getElementById('divloaderStop');
    if (btn) {
        if (!btn.classList.contains('active')) {
            btn.classList.add('active');
        }
    }
    if (element) {
        if (element.classList.contains('active')) {
            element.classList.remove('active');
        }
    }
    if (btnStop) {
        if (btnStop.classList.contains('active')) {
            btnStop.classList.remove('active');
        }
    }
}

function activateWritingStopMode_SearchText() {
    let element = document.getElementById('searchbox-voice-mode');
    let btn = document.getElementById('divloader');
    let btnStop = document.getElementById('divloaderStop');
    if (element) {
        if (element.classList.contains('active')) {
            element.classList.remove('active');
        }
    }
    if (btn) {
        if (btn.classList.contains('active')) {
            btn.classList.remove('active');
        }
    }
    if (btnStop) {
        if (!btnStop.classList.contains('active')) {
            btnStop.classList.add('active');
        }
    }
}

function GetHomeUserVoice() {
    $.ajax({
        type: "get",
        url: "/Home/BindHomeUserVoice",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        success: function (response) {
            // Bind user selected value here
            let elementMale = document.getElementById('male-voice');
            let elementFemale = document.getElementById('female-voice');

            if (response != undefined && response != null) {
                if (response.voiceName != undefined && response.voiceName != null) {
                    if (response.voiceName.toLowerCase().trim() === 'male') {
                        if (elementMale) {
                            elementMale.style.display = 'flex';
                            elementMale.addEventListener("click", function () {
                                changeHomeVoiceSetting(response.voiceID);
                            });
                        }
                        if (elementFemale) {
                            elementFemale.style.display = 'none';
                        }
                    } else if (response.voiceName.toLowerCase().trim() === 'female') {
                        if (elementMale) {
                            elementMale.style.display = 'none';
                        }
                        if (elementFemale) {
                            elementFemale.style.display = 'flex';
                            elementFemale.addEventListener("click", function () {
                                changeHomeVoiceSetting(response.voiceID);
                            });
                        }
                    }
                }

            }
        },
        error: function (error) {
            alert("Error occured in GetVoiceToUser");
        }
    });
}

function changeHomeVoiceSetting(id) {
    $.ajax({
        type: "get",
        url: "/Home/SetVoiceByUser",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {
            "voiceID": id
        },
        success: function (response) {
            GetHomeUserVoice();
        },
        error: function (error) {
            //alert("Error occured in changeVoiceSetting");
        }
    });
}

function ConversationResult(text) {
    if ($(window).width() <= 768) {
        //For mobile view
        deActivateJubileeJSVGenesis();
        if (LoginCheck() != "1") {
            showNotification("", "Please login to continue conversation!", "error", false);
            $("#txtsearch").html("");
            return false;
        }

        DisableSearch();

        $.ajax({
            type: "post",
            url: "/Home/SearchAudioResult",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            async: true,
            data: {
                "searchtext": text.trim(),
                "parentID": $("#hdParentID").val(),
                "LangPromptID": $("#hdnLangPrompt").val()
            },
            success: function (response) {
                if (response != undefined && response != null) {
                    if (response.status === '1') {
                        $("#totalTokenRemaining").text(response.totalRemainingToken.toLocaleString("en-US"));
                        $("#hdnCalRemainingValue").val(response.tokenBalancePercentage);
                        $(".token-tooltip-txt").text(response.totalRemainingToken.toLocaleString("en-US"));
                        //$('.progress').css('--progress-value', '60');
                        $(".prog-container").css("background", "radial-gradient(closest-side, white 79%, transparent 80% 100%), conic-gradient(#d9d9d9 calc(" + parseInt(response.tokenBalancePercentage) + " * 1%), #4CAF50 0)");

                        //$('.progress').css('--progress-value', '60');
                        if (response.isInsufficientTokenBalance && ($("#hdnPaymentPlanID").val() == 'c7e3226b-b947-4d72-90a3-512c06661989' || $("#hdnPaymentPlanID").val() == '4B8BBD72-3E56-40B4-A82D-79BF62E0DC78')) {
                            window.location.href = "/home/trialoutoftoken";
                        } else if (response.isInsufficientTokenBalance) {
                            window.location.href = "home/outoftoken";
                        } else {
                            if (!isStopHit) {
                                var myDiv = document.getElementById("myDiv");
                                myDiv.classList.remove("main-container-inner");

                                var divLogo = document.getElementById("divLogo");
                                divLogo.style.display = "none";

                                var divDisc = document.getElementById("divDisc");
                                divDisc.style.display = "none";

                                var divShortDisc = document.getElementById("divShortDisc");
                                divShortDisc.style.display = "none";

                                IsArchived = false;
                                isMiddleSectionAudio = false;
                                audioManager = new AudioManager('audioPlayer', '/Audio/' + response.focus + '.mp3');
                                setTimeout(function () {
                                    audioManager.playAudio();
                                }, 100);

                                var replacedText = "";
                                $("#hdParentID").val(response.id);

                                //showSearch("1", text.trim());
                                //showResponse(response.msg, replacedText, "1");
                                BindLeftMenuPrompt("", false, IsFavorite, IsToday);
                            } else {
                                EnableSearch();
                                isCommunicationStop = true;
                                isStopHit = true;
                                recognition.stop();
                                activateRefresh();
                            }
                        }
                    }
                    else {
                        showNotification("", response.msg, "error", false);
                        EnableSearch();
                        isCommunicationStop = true;
                        isStopHit = true;
                        recognition.stop();
                        activateRefresh();
                    }
                } else {
                    EnableSearch();
                    isCommunicationStop = true;
                    isStopHit = true;
                    recognition.stop();
                    activateRefresh();
                }
            },
            error: function (error) {
                hideBlinkCursor();
                HideLoader();
                EnableSearch();
                isCommunicationStop = true;
                isStopHit = true;
                recognition.stop();
                activateRefresh();
            }
        });

    }
    else {
        //For web view.
        deActivateJubileeJSVGenesis();
        if (LoginCheck() != "1") {
            showNotification("", "Please login to continue conversation!", "error", false);
            $("#txtsearch").html("");
            return false;
        }

        DisableSearch();

        $.ajax({
            type: "post",
            url: "/Home/SearchAudioResult",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            async: true,
            data: {
                "searchtext": text.trim(),
                "parentID": $("#hdParentID").val(),
                "LangPromptID": $("#hdnLangPrompt").val()
            },
            success: function (response) {
                if (response != undefined && response != null) {
                    if (response.status === '1') {
                        $("#totalTokenRemaining").text(response.totalRemainingToken.toLocaleString("en-US"));
                        $("#hdnCalRemainingValue").val(response.tokenBalancePercentage);
                        $(".token-tooltip-txt").text(response.totalRemainingToken.toLocaleString("en-US"));
                        //$('.progress').css('--progress-value', '60');
                        $(".prog-container").css("background", "radial-gradient(closest-side, white 79%, transparent 80% 100%), conic-gradient(#d9d9d9 calc(" + parseInt(response.tokenBalancePercentage) + " * 1%), #4CAF50 0)");
                        if (response.isInsufficientTokenBalance && ($("#hdnPaymentPlanID").val() == 'c7e3226b-b947-4d72-90a3-512c06661989' || $("#hdnPaymentPlanID").val() == '4B8BBD72-3E56-40B4-A82D-79BF62E0DC78')) {
                            window.location.href = "/home/trialoutoftoken";
                        } else if (response.isInsufficientTokenBalance) {
                            window.location.href = "home/outoftoken";
                        } else {
                            if (!isStopHit) {
                                var myDiv = document.getElementById("myDiv");
                                myDiv.classList.add("main-container-inner");

                                var divLogo = document.getElementById("divLogo");
                                divLogo.style.display = "none";

                                var divDisc = document.getElementById("divDisc");
                                divDisc.style.display = "none";

                                var divShortDisc = document.getElementById("divShortDisc");
                                divShortDisc.style.display = "";

                                IsArchived = false;
                                isMiddleSectionAudio = false;
                                audioManager = new AudioManager('audioPlayer', '/Audio/' + response.focus + '.mp3');
                                setTimeout(function () {
                                    audioManager.playAudio();
                                }, 100);

                                var replacedText = "";
                                $("#hdParentID").val(response.id);

                                showSearch("1", text.trim());
                                showResponse(response.msg, replacedText, "1");
                                BindLeftMenuPrompt("", false, IsFavorite, IsToday);
                            } else {
                                EnableSearch();
                                isCommunicationStop = true;
                                isStopHit = true;
                                recognition.stop();
                                activateRefresh();
                            }
                        }
                    }
                    else {
                        showNotification("", response.msg, "error", false);
                        EnableSearch();
                        isCommunicationStop = true;
                        isStopHit = true;
                        recognition.stop();
                        activateRefresh();
                    }
                } else {
                    EnableSearch();
                    isCommunicationStop = true;
                    isStopHit = true;
                    recognition.stop();
                    activateRefresh();
                }
            },
            error: function (error) {
                hideBlinkCursor();
                HideLoader();
                EnableSearch();
                isCommunicationStop = true;
                isStopHit = true;
                recognition.stop();
                activateRefresh();
            }
        });
    }



}

var audioManager = "";
document.addEventListener('DOMContentLoaded', () => {
    audioManager = new AudioManager('audioPlayer', '/Audio/audio-6d87961e-f4d1-4daf-a5f0-654d70216bee.mp3');
});

function AudioManager(audioElementId, audioFilePath) {
    const audioPlayer = $('#' + audioElementId)[0];
    if (audioPlayer) {
        const audioSource = audioPlayer.querySelector('source');
    }
    // Set the audio source dynamically with timestamp to prevent caching
    function setAudioSource() {
        const timestamp = new Date().getTime(); // Generate a unique timestamp
        audioSource.src = `${audioFilePath}?timestamp=${timestamp}`;
        audioPlayer.load(); // Load the updated source
        console.log(`Audio source set to: ${audioSource.src}`);


        // Event listener for detecting end of playback
        audioPlayer.addEventListener('ended', () => {
            console.log('Audio playback ended.');
            if (isMiddleSectionAudio) {
                activateSpeakButtons();
            } else {
                if (!isStopHit) {
                    recognition.start();
                    isCommunicationStop = false;
                    activateListning();
                } else {
                    activateRefresh();
                }
            }
        });

        // Event listener for detecting errors
        audioPlayer.addEventListener('error', (event) => {
            console.log('Error occurred during audio playback:', event);
            if (isMiddleSectionAudio) {
                activateSpeakButtons();
            } else {
                if (!isStopHit) {
                    recognition.start();
                    isCommunicationStop = false;
                    activateListning();
                } else {
                    activateRefresh();
                }
            }
        });

        // Event listener for detecting pauses
        audioPlayer.addEventListener('pause', () => {
            if (audioPlayer.currentTime > 0 && audioPlayer.currentTime < audioPlayer.duration) {
                console.log('Audio paused by user or programmatically.');
                if (isMiddleSectionAudio) {
                    activateSpeakButtons();
                } else {
                    recognition.start();
                    activateListning();
                }
            }
        });
    }

    // Function to start playing the audio
    this.playAudio = function () {
        setAudioSource();
        audioPlayer.play()
            .then(() => {
                if (isMiddleSectionAudio) {
                    //activateStopSpeakingButtons();
                } else {
                    activateSpeaking();
                }
                console.log('Audio playback started.');
            })
            .catch((error) => {
                console.log('Error while trying to play audio:', error);
                if (isMiddleSectionAudio) {
                    activateSpeakButtons();
                } else {
                    recognition.start(); // Restart voice recognition when all chunks are done
                    isCommunicationStop = false;
                    activateListning();
                }
            });
    };


    // Function to pause the audio
    this.pauseAudio = function () {
        audioPlayer.pause();
        console.log('Audio playback paused.');
    };

    // Function to stop the audio
    this.stopAudio = function () {
        audioPlayer.pause();
        audioPlayer.currentTime = 0; // Reset to the beginning
        /*   console.log('Audio playback stopped.');*/
    };

}

function activateListning() {
    let micOn = document.getElementById('mic-on');
    let micOff = document.getElementById('mic-off');
    if (micOn) {
        micOn.classList.add('active');
    }
    if (micOff) {
        micOff.classList.remove('active');
    }
    let elementVoiceBubble = document.getElementById('voice-bubble');
    if (elementVoiceBubble) {
        elementVoiceBubble.className = 'voice-bubble listening';
    }
}

function activateThinking() {
    let micOn = document.getElementById('mic-on');
    let micOff = document.getElementById('mic-off');
    if (micOn) {
        micOn.classList.remove('active');
    }
    if (micOff) {
        micOff.classList.add('active');
    }
    activateMaleFemaleThinking();
}

function activateSpeaking() {
    let micOn = document.getElementById('mic-on');
    let micOff = document.getElementById('mic-off');
    if (micOn) {
        micOn.classList.remove('active');
    }
    if (micOff) {
        micOff.classList.add('active');
    }
    activateMaleFemaleVoice();
}

function activateRefresh() {
    let micOn = document.getElementById('mic-on');
    let micOff = document.getElementById('mic-off');
    let elementVoiceBubble = document.getElementById('voice-bubble');
    if (elementVoiceBubble) {
        elementVoiceBubble.className = 'voice-bubble';
    }
    if (micOn) {
        micOn.classList.remove('active');
    }
    if (micOff) {
        micOff.classList.add('active');
    }
}

function activateMaleFemaleVoice() {
    let elementMale = document.getElementById('male-voice');
    let elementFemale = document.getElementById('female-voice');
    let elementVoiceBubble = document.getElementById('voice-bubble');
    if (elementMale) {
        if (elementMale.style.display != 'none') {
            if (elementVoiceBubble) {
                elementVoiceBubble.className = 'voice-bubble ai-female';
            }
        }
    }
    if (elementFemale) {
        if (elementFemale.style.display != 'none') {
            if (elementVoiceBubble) {
                elementVoiceBubble.className = 'voice-bubble ai-male';
            }
        }
    }
}

function activateMaleFemaleThinking() {
    let elementMale = document.getElementById('male-voice');
    let elementFemale = document.getElementById('female-voice');
    let elementVoiceBubble = document.getElementById('voice-bubble');
    if (elementMale) {
        if (elementMale.style.display != 'none') {
            if (elementVoiceBubble) {
                elementVoiceBubble.className = 'voice-bubble thinking-female';
            }
        }
    }
    if (elementFemale) {
        if (elementFemale.style.display != 'none') {
            if (elementVoiceBubble) {
                elementVoiceBubble.className = 'voice-bubble thinking-male';
            }
        }
    }
}

function activateJubileeConversation(element) {
    if (element) {
        if (element.parentElement.classList.contains('active'))
            element.parentElement.classList.remove('active');
        else
            element.parentElement.classList.add('active');
    }
}

var isMiddleSectionAudio = false;
function ProcessTextToAudio(text, ID) {
    if (LoginCheck() != "1") {
        showNotification("", "Please login to continue conversation!", "error", false);
        $("#txtsearch").html("");
        activateElementByID('read-response-' + ID, 'active');
        deActivateElementByID('process-response-' + ID, 'active');
        return false;
    }

    $.ajax({
        type: "post",
        url: "/Home/ProcessTextToAudio",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "text": text.trim()
        },
        success: function (response) {
            if (response != undefined && response != null) {
                if (response.status === '1') {
                    isMiddleSectionAudio = true;
                    audioManager = new AudioManager('audioPlayer', '/Audio/' + response.focus + '.mp3');
                    setTimeout(function () {
                        deActivateElementByID('process-response-' + ID, 'active');
                        activateElementByID('stop-read-response-' + ID, 'active');
                        audioManager.playAudio();
                    }, 10);
                }
                else {
                    activateElementByID('read-response-' + ID, 'active');
                    deActivateElementByID('stop-read-response-' + ID, 'active');
                    showNotification("", response.msg, "error", false);
                }
            }
        },
        error: function (error) {
            activateElementByID('read-response-' + ID, 'active');
            deActivateElementByID('stop-read-response-' + ID, 'active');
        }
    });
}

function deActivateAllSpeakButtons() {
    let readResponses = document.querySelectorAll('.read-response');
    let stopReadResponses = document.querySelectorAll('.stop-read-response');
    let copyResponses = document.querySelectorAll('.copy-response');
    let copiedResponses = document.querySelectorAll('.response-copied');
    if (readResponses) {
        readResponses.forEach(function (elem) {
            if (elem) {
                if (elem.classList.contains('active'))
                    elem.classList.remove('active');
            }
        });
    }
    if (stopReadResponses) {
        stopReadResponses.forEach(function (elem) {
            if (elem) {
                if (elem.classList.contains('active'))
                    elem.classList.remove('active');
            }
        });
    }
    if (copyResponses) {
        copyResponses.forEach(function (elem) {
            if (elem) {
                if (elem.classList.contains('active'))
                    elem.classList.remove('active');
            }
        });
    }
    if (copiedResponses) {
        copiedResponses.forEach(function (elem) {
            if (elem) {
                if (elem.classList.contains('active'))
                    elem.classList.remove('active');
            }
        });
    }
}

function deActivateAllSpeakCopyButtons() {
    let readResponses = document.querySelectorAll('.read-response');
    let stopReadResponses = document.querySelectorAll('.stop-read-response');
    if (readResponses) {
        readResponses.forEach(function (elem) {
            if (elem) {
                if (elem.classList.contains('active'))
                    elem.classList.remove('active');
            }
        });
    }
    if (stopReadResponses) {
        stopReadResponses.forEach(function (elem) {
            if (elem) {
                if (elem.classList.contains('active'))
                    elem.classList.remove('active');
            }
        });
    }
}

function activateSpeakCopyButtons() {
    let readResponses = document.querySelectorAll('.read-response');
    let stopReadResponses = document.querySelectorAll('.stop-read-response');
    let copyResponses = document.querySelectorAll('.copy-response');
    let responseCopied = document.querySelectorAll('.response-copied');
    if (readResponses) {
        readResponses.forEach(function (elem) {
            if (elem) {
                if (!elem.classList.contains('active'))
                    elem.classList.add('active');
            }
        });
    }
    if (stopReadResponses) {
        stopReadResponses.forEach(function (elem) {
            if (elem) {
                if (elem.classList.contains('active'))
                    elem.classList.remove('active');
            }
        });
    }
    if (copyResponses) {
        copyResponses.forEach(function (elem) {
            if (elem) {
                if (!elem.classList.contains('active'))
                    elem.classList.add('active');
            }
        });
    }
    if (responseCopied) {
        responseCopied.forEach(function (elem) {
            if (elem) {
                if (elem.classList.contains('active'))
                    elem.classList.remove('active');
            }
        });
    }
}

function activateSpeakButtons() {
    let readResponses = document.querySelectorAll('.read-response');
    let stopReadResponses = document.querySelectorAll('.stop-read-response');
    if (readResponses) {
        readResponses.forEach(function (elem) {
            if (elem) {
                if (!elem.classList.contains('active'))
                    elem.classList.add('active');
            }
        });
    }
    if (stopReadResponses) {
        stopReadResponses.forEach(function (elem) {
            if (elem) {
                if (elem.classList.contains('active'))
                    elem.classList.remove('active');
            }
        });
    }
}

function activateStopSpeakingButtons(ID) {
    if (ID) {
        let stopReadResponse = document.getElementById('stop-read-response-' + ID);
        if (stopReadResponse) {
            if (!stopReadResponse.classList.contains('active'))
                stopReadResponse.classList.add('active');
        }
    }
}

function speakSelected(element, ID) {
    stopSpeakingAllMiddle();
    if (ID) {
        let textElement = document.getElementById('result' + ID);
        if (textElement) {
            let speakText = textElement.innerText;
            if (speakText.trim() != '') {
                activateElementByID('process-response-' + ID, 'active');
                deActivateElementByID('read-response-' + ID, 'active');
                ProcessTextToAudio(speakText, ID);
            }
        }
    }
}

function copyResponseToClipboard(event, ID) {
    // Find the closest `.result-container` and then the associated `.results` div
    const responseContainer = event.target.closest('.result-container')?.querySelector('.results');

    if (responseContainer) {
        // Get the HTML content of the results div
        const htmlContent = responseContainer.innerHTML;

        // Create a temporary DOM element to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;

        // Extract and format content if needed (Markdown-like or plain text)
        const formattedContent = tempDiv.innerText; // Change to tempDiv.innerHTML for raw HTML

        // Copy content to clipboard
        navigator.clipboard.writeText(formattedContent).then(() => {
            $("#copy-response-" + ID).toggleClass("active");
            $("#response-copied-" + ID).toggleClass("active");
            $("#copytooltipid-" + ID).html("Copied");
            setTimeout(function () {
                $("#copy-response-" + ID).toggleClass("active");
                $("#response-copied-" + ID).toggleClass("active");
                $("#copytooltipid-" + ID).html("Copy");
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    }
}

var isStopSpeakingAllMiddle = false;
function stopSpeakingAllMiddle() {
    isStopSpeakingAllMiddle = true;
    audioManager.stopAudio();
    activateSpeakButtons();

}

function GoToSignup() {
    window.location.href = '/signup';
}

function GoToSignin() {
    window.location.href = '/signin';
}

function hideLoginPopup() {
    $("#loginMessagePopup").hide();
}

function showLoginPopup() {
    $("#loginMessagePopup").show();
}

function showTokenInsufficientPopup() {
    $("#tokenInsufficientPopup").show();
}
function hideTokenInsufficientPopup() {
    $("#tokenInsufficientPopup").hide();
}

//function showShareChatPopup() {
//    var sharePopupID = document.getElementById('ShareChatPopup');
//    if (sharePopupID) {
//        sharePopupID.style.display = "flex";
//        $("#createbtn").text('Create Link');
//        $("#txtshareid").val('');
//    }

//    var promptID = $("#hdParentID").val();
//    /*    console.log(promptID);*/
//}
//function hideShareChatPopup() {
//    $("#ShareChatPopup").hide();
//}

function createShareChatLink(platform) {
    var promptID = $("#hdParentID").val();

    $.ajax({
        type: "POST",
        url: "/Home/CreateShareChatID",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "PromptID": promptID,
        },
        success: function (response) {
            if (response.msg == null) {


                if (response && response.shareLink) {
                    let shareLink = response.shareLink;
                    let platformLink = "";

                    switch (platform) {
                        case "facebook":
                            platformLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`;
                            break;
                        case "x":
                            platformLink = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareLink)}`;
                            break;
                        case "linkedin":
                            platformLink = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareLink)}`;
                            break;
                        case "whatsapp":
                            platformLink = `https://wa.me/?text=${encodeURIComponent(shareLink)}`;
                            break;
                        default:
                            console.error("Unsupported platform:", platform);
                            return;
                    }

                    // Open the appropriate share link in a new tab
                    window.open(platformLink, '_blank');
                } else {
                    console.error("Response does not contain a valid shareLink:", response);
                }
            } else {
                showNotification("", response.msg, "error", false);
            }
        },
        error: function (error) {
            console.error("Error occurred:", error.responseText || error);
        }
    });
}

function bindsharechat(shareID) {

    $.ajax({
        type: "POST",
        url: "/Home/ShareChat",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "shareID": shareID,
        },
        success: function (response) {
            if (response != null) {
                if (response.length > 0) {
                    if (response[0].msg == null) {
                        var count = response.length;

                        var replacedText = "";
                        if (response[0].domainName != undefined && response[0].domainName != null && response[0].domainName != "") {
                            replacedText = response[0].domainName.toUpperCase();
                        }
                        $("#hdnIsSearched").val("");
                        for (var i = 0; i < count; i++) {
                            showSearch("1", response[i].prompt);
                            showResponse(response[i].response, replacedText);
                        }
                    }
                }
            } else {
                showNotification("", response.msg, "error", false)
            }
        },
        error: function (error) {
            //alert(error.responsetype);
        }
    });
}

function BindSharedLeftMenuPrompt(shareID) {
    $.ajax({
        type: "POST",
        url: "/Home/GetUserPromptsbyShareID",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "shareID": shareID
        },
        success: function (response) {
            if (response != null) {
                if (response.length > 0) {
                    $("#divParentChildNode").html("");
                    var htmlParent = "";
                    for (var i = 0; i < response.length; i++) {
                        if (response[i].promptFolderID != null) {
                            htmlParent += `<div class="lnil-1" id="divParents_` + response[i].promptFolderID + `">`;  //active  
                        }
                        //--------------------remove this node------------------                        
                        htmlParent += '<div id="divParentT_' + response[i].promptFolderID + '" class="lnil-1-content" style="display:none;" >';
                        htmlParent += '<input type="text" id="txt_' + response[i].promptFolderID + '" style="color:#858585;" class="lnil-1-txt" value="' + response[i].promptText + '" onkeyup="SaveParentPrompt(event,\'' + response[i].promptFolderID + '\')" onblur="SaveParentPromptOnBlur(\'' + response[i].promptFolderID + '\')" />';
                        htmlParent += '</div>';

                        htmlParent += `<div style="cursor:pointer;" id="divParentP_` + response[i].promptFolderID + `" class="lnil-1-content" onclick="ShowSessionPrompts(this,'` + response[i].promptFolderID + `')">`;
                        //------------------------------------------------------
                        if (response[i].isFavourite) {
                            htmlParent += '<div class="lnil-1-icon star-icon"></div>';
                        } else {
                            htmlParent += '<div class="lnil-1-icon chat-icon"></div>';
                        }
                        htmlParent += '<p id="pera_' + response[i].promptFolderID + '" class="lnil-1-txt">' + response[i].promptText + '</p><i class="mdi mdi-dots-vertical thread_options" onclick="Showfunction(\'' + response[i].promptFolderID + '\', event)"></i>';
                        htmlParent += '<div id="divthread_' + response[i].promptFolderID + '" class="thread-option-box">';
                        htmlParent += '<div class="thread-option" onclick="RenameParentPrompt(this,\'' + response[i].promptFolderID + '\')"><i class="mdi mdi-pencil-outline"></i> Rename</div>';
                        if (!response[i].isFavourite) {
                            htmlParent += '<div class="thread-option" onclick="AddFavoritePromptByID(this)"><i class="mdi mdi-star-outline"></i> Favorite</div>';
                        } else {
                            htmlParent += '<div class="thread-option" onclick="RemoveFavoritePromptByID(this)"><i class="mdi mdi-star-outline"></i> Unfavorite</div>';
                        }
                        if (response[i].isArchived) {
                            htmlParent += '<div class="thread-option" onclick="ArchivePromptByID(this)" style="color:red;"><i class="mdi mdi-trash-can-outline"></i> Delete</div>';
                        } else {
                            htmlParent += '<div class="thread-option" onclick="ArchivePromptByID(this)" style="color:red;"><i class="mdi mdi-trash-can-outline"></i> Recycle Bin</div>';
                        }
                        htmlParent += '</div>';
                        htmlParent += '</div>';
                        //---------------------------------------------------------------------
                        var htmlChild = '<div class="lnil-1-nav" id="divSearchText">';
                        for (var j = 0; j < response[i].userPrompts.length; j++) {
                            htmlChild += AddLeftMenuPrompt(response[i].userPrompts[j].prompt, "1", response[i].userPrompts[j].promptID);
                        }
                        htmlChild += '</div>';
                        htmlParent += htmlChild;
                        htmlParent += '</div>';
                    }
                    $("#divParentChildNode").html(htmlParent);
                    var PropmtID = $("#hdParentID").val()
                    if (PropmtID != null && PropmtID != "" && PropmtID != undefined) {
                        $("#divParents_" + PropmtID).addClass('active');
                        $($($("#divParents_" + PropmtID).find("a")[0])).addClass("active");
                    }
                } else {
                    $("#divParentChildNode").html("");
                    $("#divResults").html("");
                    $("#hdParentID").val("");
                }
            }
        },
        error: function (error) {
            // alert(error.responsetype);
        }
    });
}

//--------------------------------For Mobile--------------------------------------------
$(document).ready(function () {
    if ($(window).width() <= 768) {
        console.log("Script Loaded Successfully!");

        //function detectBrowser() {
        //    const userAgent = navigator.userAgent;

        //    if (userAgent.includes("Firefox")) {
        //        return "Mozilla Firefox";
        //    } else if (userAgent.includes("Edg")) {
        //        return "Microsoft Edge";
        //    } else if (userAgent.includes("Chrome") && !userAgent.includes("Edg") && !userAgent.includes("OPR")) {
        //        return "Google Chrome";
        //    } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
        //        return "Apple Safari";
        //    } else if (userAgent.includes("Opera") || userAgent.includes("OPR")) {
        //        return "Opera";
        //    } else if (userAgent.includes("MSIE") || userAgent.includes("Trident")) {
        //        return "Internet Explorer";
        //    } else {
        //        return "Unknown Browser";
        //    }
        //}

        //// Ensure function is defined before calling
        //console.log(detectBrowser());

        // Hide search bar
        const searchBar = document.querySelector(".search-container-wrapper");
        if (searchBar) {
            searchBar.style.display = "none";
        }
        // Hide search bar
        const searchBar2 = document.querySelector(".main-container-inner .search-container-wrapper");
        if (searchBar2) {
            searchBar.style.display = "none";
        }
        // Activate voice panel
        const addRightPanel = document.querySelector(".right-panel");
        if (addRightPanel) {
            addRightPanel.classList.add("active");
        }

        const voicebubble = document.querySelector(".voice-bubble ");
        if (voicebubble) {
            voicebubble.classList.remove("listening");
        }

        // Hide share chat button
        const shareBtn = document.getElementById("sharebtn");
        if (shareBtn) {
            shareBtn.style.display = "none";
        }

        // Hide written languages
        const writeLang = document.querySelector(".select-lang");
        if (writeLang) {
            writeLang.style.display = "none";
        }
        //Show voice active button
        const voiceicon = document.querySelector(".mob-voice-launch");
        if (voiceicon) {
            voiceicon.style.display = "flex";

        }

    }
});

//Close Popup 
function closeContentPopup() {
    var contentPopup = document.getElementById('fileContent');
    if (contentPopup) {
        contentPopup.style.display = "none"; // Hide the popup

        var video = document.querySelector("#fileContent video");

        if (video) {
            video.pause(); // Pause the video
            video.currentTime = 0; // Reset the video to the beginning
        }
        else {
            document.querySelector("#fileContent iframe").src = "";
        }
        window.location.reload();
    }
}

function editProfile() {
    window.location.href = "/EditProfile";
}

//For share the file of azure blob
function ShareFile(shareURL, fileName, platformSocial) 
{
    var platform = platformSocial.toLowerCase()
    switch (platform) {
        case "facebook":
            platformLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareURL)}`;
            break;
        case "x":
            platformLink = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareURL)}`;
            break;
        case "linkedin":
            platformLink = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareURL)}`;
            break;
        case "whatsapp":
            platformLink = `https://wa.me/?text=${encodeURIComponent(shareURL)}`;
            break;
        case "mail":
            platformLink = `mailto:?subject=Check this out&body=${encodeURIComponent(shareURL)}`;
            break;

        default:
            console.error("Unsupported platform:", platform);
            return;
    }

    // Open the appropriate share link in a new tab
    window.open(platformLink, '_blank');
}


function Generic() {
    window.location.href = "/Home/Genericinsert";
}

//Bind Feedback Reasons in (Report Inappropriate Content) box
function BindFeedbackReason() {
    $.ajax({
        type: "GET",
        url: "/Home/GetFeedbackReasons",
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (response) {
            if (response && response.length > 0) {
                var ddl = $("#ddlReport");
                ddl.empty();
                ddl.append('<option value="0">-- Select Reason --</option>');

                for (var i = 0; i < response.length; i++) {
                    
                    ddl.append('<option value="' + response[i].reasonID + '">' + response[i].reasonText + '</option>');
                }
            }
        },
        error: function () {
            alert("Failed to bind Feedback Reason");
        }
    });
}




