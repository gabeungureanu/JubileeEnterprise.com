var IsAlbumPurchased = false;
var currentActive = "";
var EmailAddress = "";
document.addEventListener("DOMContentLoaded", () => {

    //setTimeout($(".scrollbar-macosx").scrollbar(), 5000);
    setTimeout(function () {
        $(".scrollbar-macosx").scrollbar()
    }, 1000);


    var IsAlbum = $("#IsAlbum").val();
    if (IsAlbum) {
        var ConatinerName = $("#txtconatinerName").val();
        SearchSong(null, ConatinerName);
    }

    var IsShareMusic = $("#IsShareMusic").val();
    if (IsShareMusic) {
        var SongIndex = $("#txtSongIndex").val();
        ShowShareMusicPopup(SongIndex);
    }

    var IsPayment = $("#IsPayment").val();

    if (IsPayment === "true") {
        ShowShareMusicPopup("ShareRequest12");
    }
    else if (IsPayment === "false") {
        ShowShareMusicPopup("ShareRequest16");
    }
    else if (IsPayment == null || IsPayment === undefined || IsPayment === "") {
        // do nothing
    }

    // 0. Globals
    let azurefileName = '';
    const audio = document.getElementById('audioPlayer2');
    const filterToggle = document.getElementById("filter");
    const volumeSlider = document.getElementById("volumeSlider");
    const volumeIcon = document.querySelector(".add-track-btn");
    const rewindBtn = document.querySelector(".prev-btn");
    const forwardBtn = document.querySelector(".next-btn");
    const progressBar = document.querySelector(".progress");
    const progressThumb = document.querySelector(".progress-thumb");
    const progressContainer = document.querySelector(".progress-container");
    const durationDisplay = document.getElementById("duration");
    const currentTimeDisplay = document.getElementById("currentTime");

    //1. Forward and Rewind 10 sec
    if (audio && rewindBtn && forwardBtn) {
        rewindBtn.addEventListener("click", () => {
            audio.currentTime = Math.max(0, audio.currentTime - 10);
        });

        forwardBtn.addEventListener("click", () => {
            audio.currentTime = Math.min(audio.duration || audio.currentTime + 10, audio.currentTime + 10);
        });
    }

    // 2. Volume slider logic (with null checks)
    if (audio && volumeSlider) {
        const volume = parseFloat(volumeSlider.value) || 1;
        audio.volume = volume;
        audio.muted = volume === 0;
        updateVolumeIcon(volume);

        //volumeSlider.addEventListener("input", function () {
        //    const volume = parseFloat(this.value) || 0;
        //    audio.volume = volume;
        //    audio.muted = volume === 0;
        //    updateVolumeIcon(volume);
        //});
    }

    // Utility function to update icon based on volume
    function updateVolumeIcon(volume) {
        if (!volumeIcon) return;

        if (volume === 0) {
            volumeIcon.src = "../images/mute.svg";
        } else {
            volumeIcon.src = "../images/volume.svg";
        }
    }

    // 3. Filter toggle logic (unchanged)
    if (filterToggle) {
        const currentPath = window.location.pathname.toLowerCase();
        filterToggle.checked = currentPath.includes("/album/");
        filterToggle.addEventListener("change", function () {
            const fileShareName = this.dataset.filesharename;
            if (!fileShareName) return;
            window.location.href = this.checked
                ? `/Album/${fileShareName}`
                : `/Share/${fileShareName}`;
        });
    }

    // 4. Core track loader
    function loadTrack(id, filename, onLoadedCallback) {
        $.ajax({
            type: "GET",
            url: "/GetFileDetails/" + encodeURIComponent(filename),
            dataType: "json"
        })
            .done(res => {
                if (res?.urlMapLink) {
                    audio.src = res.urlMapLink;

                    // Add event listener for loadeddata (fires when audio is ready)
                    audio.addEventListener('loadeddata', function handler() {
                        audio.removeEventListener('loadeddata', handler); // Remove after firing once
                        if (typeof onLoadedCallback === 'function') {
                            onLoadedCallback(); // Trigger play logic here
                        }
                    });

                    audio.load(); // Start loading
                } else {
                    console.error('Bad response', res);
                }
            });
    }
    function setPlayIcon(isPlaying) {
        const btn = document.querySelector('.play-btn');
        btn.src = isPlaying
            ? '../images/pause.svg'
            : '../images/play.svg';
    }
    // 5. ActivateItem for inline onclick
    window.ActivateItem = (rowID, Azurefilename, fileName, autoPlay = true) => {
        setPlayIcon(false);

        document.querySelectorAll('.playlist-row').forEach(r => {
            r.classList.remove('active', 'pause');
        });

        const row = document.getElementById('songlist-' + rowID);
        currentActive = row;
        if (row) {

            row.classList.remove('pause');
        }

        $("#songtitle").text(fileName);
        azurefileName = Azurefilename;

        //Here open popup.
        var fileExtension = currentActive.dataset.fileextension;
        if (fileExtension == ".mp4") {
            $("#audioPlayer2").attr("src", "");

            const formData = new FormData();
            formData.append('extension', fileExtension);
            formData.append('file', azurefileName);
            //Fetch upload thumbnail
            $.ajax({
                url: '/ShareRedirector/VideoPlayer', // Your endpoint
                type: 'POST',
                data: formData,
                contentType: false,
                processData: false,
                success: function (response) {
                    if (response != null) {
                        $("#videoPlayer").html(response);

                        // Wait for video tag to be rendered
                        const video = document.querySelector("#videoPlayer video");
                        if (video) {
                            video.addEventListener('ended', function () {
                                closeContentPopup();
                            });
                        }
                    }

                },
                error: function (err) {
                    showNotification("", "Upload failed.", "error", false);
                }
            });


        }

        $("#audioPlayer2").attr("src", "");
        if (fileExtension == ".mp3") {
            loadTrack(rowID, Azurefilename, () => {

                if (autoPlay) {
                    audio.play()
                        .then(() => setPlayIcon(true))
                        .catch(err => console.warn('Autoplay failed', err));

                    // 🔹 Remove .active from all rows
                    document.querySelectorAll('.playlist-row.active').forEach(el => {
                        el.classList.remove('active');
                    });

                    // 🔹 Add .active to the current row
                    row.classList.add('active');
                }
            });
        }


    };

    // ✅ Set initial volume after metadata loads
    audio.addEventListener("loadedmetadata", () => {
        const volume = parseFloat(volumeSlider.value) || 1;
        audio.volume = volume;
        audio.muted = volume === 0;
        updateVolumeIcon(volume);
    });




    const playlistRows = document.querySelectorAll('.playlist-row');
    let currentSelectedIndex = -1;

    $('.play-btn').on('click', () => {
        if (audio) {
            if (!audio.src) {
                // No track loaded yet, play the first song
                if (playlistRows.length > 0) {
                    currentSelectedIndex = 0;
                    const firstRow = playlistRows[0];

                    const nextId = firstRow.id.replace("songlist-", "");
                    const nextAzureFile = firstRow.getAttribute("data-azurefilename");
                    const nextFileName = firstRow.getAttribute("data-filename");

                    if (nextAzureFile) {
                        ActivateItem(nextId, nextAzureFile, nextFileName, true); // this will auto-play

                    } else {
                        //console.warn('First song has no Azure file.');
                    }
                } else {
                    //console.warn('Playlist is empty.');
                }
            } else {
                // Toggle play/pause
                if (audio.paused) {
                    audio.play();
                    setPlayIcon(true);
                    currentActive.classList.remove("pause");
                    currentActive.classList.add("active");
                } else {
                    audio.pause();
                    setPlayIcon(false);
                    currentActive.classList.add("pause");
                }
            }
        }
    });


    // 5. Icon swap
    if (audio) {
        audio.addEventListener('play', () => $('.play-btn').attr('src', '../images/pause.svg'));
        audio.addEventListener('pause', () => $('.play-btn').attr('src', '../images/play.svg'));


        // 6. Autoplay the next song when the current one ends
        audio.addEventListener("ended", () => {
            const currentRow = document.querySelector(".playlist-row.active");
            if (!currentRow) return;

            // Map specific song IDs to popup types
            const popupMap = {
                "songlist-1": "ShareRequest1",
                "songlist-2": "ShareRequest3",
                "songlist-3": "ShareRequest4",
                "songlist-4": "ShareRequest10"
            };

            const popupType = popupMap[currentRow.id] || null;
            const nextRow = currentRow.nextElementSibling;

            // Ensure next row exists and is a valid playlist item
            if (!nextRow || !nextRow.classList.contains("playlist-row")) return;

            if (popupType && !IsAlbumPurchased) {
                // Show popup for specific songs
                const formData = new FormData();
                formData.append("popupType", popupType);

                $.ajax({
                    url: "/ShareRedirector/ShareMusicDetails",
                    type: "POST",
                    data: formData,
                    contentType: false,
                    processData: false,
                    success: function (response) {
                        if (response) {
                            $("#viralMusicPlayer").css("display", "flex");
                            $("#" + currentRow.id).addClass("pause");
                            $("#viralMusicPlayer").html(response);
                            $("#sharePopup, #badgePopup").hide();
                            $("#ViralMusicPopup").css("display", "flex");
                            setTimeout(() => $(".scrollbar-macosx").scrollbar(), 500);
                        }
                    },
                    error: function () {
                        showNotification("", "Upload failed.", "error", false);
                    }
                });
            } else {
                // Default case: play the next song
                const nextId = nextRow.id.replace("songlist-", "");
                const nextAzureFile = nextRow.getAttribute("data-azurefilename");
                const nextFileName = nextRow.getAttribute("data-filename");

                if (nextAzureFile) {
                    ActivateItem(nextId, nextAzureFile, nextFileName, true);
                }
            }
        });


        // 6. Mute volume
        const volumeIcon = document.querySelector(".Volume img");

        let lastVolume = 1; // Track last non-zero volume

        volumeIcon.addEventListener("click", () => {
            if (audio.muted || audio.volume === 0) {
                // Unmute
                audio.muted = false;
                audio.volume = lastVolume;
                volumeSlider.value = lastVolume;
                volumeIcon.src = audio.muted ? "../images/mute.svg" : "../images/volume.svg";

            } else {
                // Mute
                lastVolume = audio.volume;
                audio.muted = true;
                audio.volume = 0;
                volumeSlider.value = 0;
                volumeIcon.src = audio.muted ? "../images/mute.svg" : "../images/volume.svg";
            }
        });

        audio.addEventListener("volumechange", () => {
            //console.log("Volume changed:", audio.volume);
        });

    }
    // allow seeking by clicking the bar
    progressContainer.addEventListener("click", e => {
        const rect = progressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const newTime = (clickX / rect.width) * audio.duration;
        audio.currentTime = newTime;
    });
    // optional: log time updates
    audio.addEventListener("timeupdate", function () {
        if (!audio.duration) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        // console.log(" Current time" + audio.currentTime+ "Duration"+audio.duration);
        progressBar.style.width = pct + "%";
        progressThumb.style.left = pct + "%";

        currentTimeDisplay.textContent = formatTime(audio.currentTime);
        durationDisplay.textContent = formatTime(audio.duration);
    });

    function resetSong() {
        //audio.src = filePath;
        audio.load(); // Reload the audio file
        //audio.play(); // Start playing

        // Optionally reset progress bar
        progressBar.style.width = "0%";
        progressThumb.style.left = "0%";
        currentTimeDisplay.textContent = "0:00";
        durationDisplay.textContent = "0:00";
    }

    //For the purpose to select next song.
    const downloadBtn = document.querySelector(".download-btn");
    let clickTimer = null; // For distinguishing single vs double click

    downloadBtn.addEventListener("click", function () {
        // If already waiting for a click, it may be a double-click — wait
        if (clickTimer) return;

        clickTimer = setTimeout(() => {
            clickTimer = null; // clear flag

            const currentRow = document.querySelector(".playlist-row.active");
            if (currentRow) {
                let CurrentID = currentRow.id; // e.g., "songlist-1"
                let part = CurrentID.split("-"); // ["songlist", "1"]

                let nextIndex = parseInt(part[1]) + 1; // Convert to number and increment
                let NextId = part[0] + "-" + nextIndex; // Reconstruct the ID

                $("#" + NextId).html();

                if ($("#" + NextId).hasClass("locked-track")) {
                    showNotification("", "Next song is locked.", "error", false);
                    return;
                }
            }

            // ✅ SINGLE CLICK HANDLER
            let currentIndex = -1;
            resetSong();

            playlistRows.forEach((row, index) => {
                if (row.classList.contains("active")) {
                    currentIndex = index;
                }
                row.classList.remove("active"); // Always ensure only one is active
            });

            const nextIndex = (currentIndex + 1) % playlistRows.length;

            const nextRow = playlistRows[nextIndex];
            nextRow.classList.add("active");
            nextRow.click();
        }, 250); // Delay of 250ms to check if double-click happens
    });

    downloadBtn.addEventListener("dblclick", function () {
        if (clickTimer) {
            clearTimeout(clickTimer); // Cancel the single click
            clickTimer = null;
        }

        // ✅ DOUBLE CLICK HANDLER
        document.querySelector(".download-btn").classList.add("disabled");

        setTimeout(function () {
            document.querySelector(".download-btn").classList.remove("disabled");
        }, 2000);
    });


    //For the purpose to select prev song.
    const uploadBtn = document.querySelector(".upload-btn");
    let uploadClickTimer = null;

    uploadBtn.addEventListener("click", function () {
        // Prevent action if a click is already being processed
        if (uploadClickTimer) return;

        // Set a short delay to distinguish single vs double click
        uploadClickTimer = setTimeout(() => {
            uploadClickTimer = null; // reset timer after single-click is handled
            const currentRow = document.querySelector(".playlist-row.active");
            const playlistRowsCount = document.querySelectorAll(".playlist-row").length;
            const lastIndex = playlistRowsCount - 1; // array index of last item
            const lastRow = document.querySelectorAll(".playlist-row")[lastIndex];

            if (currentRow) {
                let currentID = currentRow.id;
                if (currentID == lastRow.id) {
                    if ($("#" + lastRow.id).hasClass("locked-track")) {
                        showNotification("", "Previous song is locked.", "error", false);
                        return; // Stop if locked
                    }
                }
            } else {
                if ($("#" + lastRow.id).hasClass("locked-track")) {
                    showNotification("", "Previous song is locked.", "error", false);
                    return; // Stop if locked
                }
            }





            // ✅ SINGLE CLICK HANDLER
            let currentIndex = -1;
            resetSong();

            playlistRows.forEach((row, index) => {
                if (row.classList.contains("active")) {
                    currentIndex = index;
                }
                row.classList.remove("active"); // Ensure only one active
            });

            const previousIndex = (currentIndex - 1 + playlistRows.length) % playlistRows.length;

            const newActiveRow = playlistRows[previousIndex];
            newActiveRow.classList.add("active");
            newActiveRow.click();
            newActiveRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 250); // 250ms delay to detect if a double-click is coming
    });

    uploadBtn.addEventListener("dblclick", function () {
        // Cancel the single-click logic if double-click is detected
        if (uploadClickTimer) {
            clearTimeout(uploadClickTimer);
            uploadClickTimer = null;
        }

        // Optional: show a message or just ignore
        document.querySelector(".upload-btn").classList.add("disabled");

        setTimeout(function () {
            document.querySelector(".upload-btn").classList.remove("disabled");
        }, 2000);
    });


    //---------------------------------------------------------------------------------------------------------------
    function formatTime(time) {
        if (isNaN(time)) return "0.00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60).toString().padStart(2, "0");
        return `${minutes}.${seconds}`;
    }

});

function redirectToAlbum(containerName) {
    window.location.href = "/Albums/" + containerName;
}

function redirectToPlayList(element, azurefile) {
    if (element.classList.contains("locked-track")) {
        window.location.href = "/Album/" + azurefile;
        //console.log(element);
        // Do something for locked songs...
    } else {
        window.location.href = "/share/" + azurefile;
    }
}


function SearchSong(val) {
    var text = $("#searchSong").val();
    var ConatinerName = $("#txtconatinerName").val();
    const formData = new FormData();
    formData.append('text', text);
    formData.append('conatinerName', ConatinerName);
    //Fetch upload thumbnail
    $.ajax({
        url: '/ShareRedirector/SearchSongs', // Your endpoint
        type: 'POST',
        data: formData,
        contentType: false,
        processData: false,
        success: function (response) {
            if (response != null) {
                $("#albumlistdata").html(response);
                //setTimeout($(".scrollbar-macosx").scrollbar(), 5000);
                setTimeout(function () {
                    $(".scrollbar-macosx").scrollbar()
                }, 500);
            }

        },
        error: function (err) {
            showNotification("", "Upload failed.", "error", false);
        }
    });

}

$("#searchSong").keyup(function () {
    var text = $("#searchSong").val();
    if (text == "") {
        SearchSong();
    }
});

function ExpendSongs(id) {
    $.ajax({
        url: "/ShareRedirector/UnlockAlbumByID",
        type: "POST",
        data: { AlbumID: id }, // sending as form data
        success: function (response) {
            if (response && response.isAlbumPaid) {
                $("#SongsProductID_" + id).toggleClass("active");
                $("#ProductID_" + id).toggleClass("active");
                $("#SongsProductID_" + id + ".active .locked-track").removeClass("locked-track");
            } else {
                $("#SongsProductID_" + id).toggleClass("active");
                $("#ProductID_" + id).toggleClass("active");
            }
        },
        error: function (xhr, status, error) {
            console.error("Error unlocking album:", error);
        }
    });
}


//Close video popup on playlist and active next song.
function closeContentPopup() {
    var contentPopup = document.getElementById('fileContent');

    if (contentPopup) {
        contentPopup.style.display = "none"; // Hide the popup

        //var video = document.querySelector("#fileContent video");

        //if (video) {
        //    video.pause();
        //    video.currentTime = 0;
        //} else {
        //    var iframe = document.querySelector("#fileContent iframe");
        //    if (iframe) {
        //        iframe.src = "";
        //    }
        //}

        //// ✅ Find and play the next song
        //if (typeof currentActive !== "undefined" && currentActive !== null) {
        //    var nextRow = $(currentActive).next(".playlist-row")[0];
        //    if (nextRow) {
        //        var nextID = nextRow.id.replace("songlist-", "");
        //        var nextAzurefilename = nextRow.dataset.azurefilename;
        //        var nextFileName = nextRow.dataset.filename;

        //        // Call your ActivateItem function
        //        ActivateItem(nextID, nextAzurefilename, nextFileName);
        //    }
        //}
    }
}

function ShowShareMusicPopup(popupType) {

    if (popupType == "ShareRequest12") {
    } else if (popupType == "ShareRequest16") {
    }
    else {
        popupType = "ShareRequest1";
    }

    // Define popup type

    // Prepare form data for the AJAX request
    const formData = new FormData();
    formData.append('popupType', popupType);

    // Trigger AJAX request to get popup content after the song ends
    $.ajax({
        url: '/ShareRedirector/ShareMusicDetails',
        type: 'POST',
        data: formData,
        contentType: false,
        processData: false,
        success: function (response) {
            if (response) {

                $("#viralMusicPlayer").html(response);

                $("#badgePopup").css("display", "none");
                $("#contentPopup").css("display", "block");
                $("#sharePopup").css("display", "none");
                $("#ViralMusicPopup").css("display", "flex");
                $("#viralMusicPlayer").css("display", "flex");

                if (popupType == "ShareRequest12") {
                    IsAlbumPurchased = true;
                    // Get all elements with class "playlist-row"
                    const rows = document.getElementsByClassName("playlist-row");

                    // Loop through and remove "lock-track" if present
                    for (let i = 0; i < rows.length; i++) {
                        if (rows[i].classList.contains("locked-track")) {
                            rows[i].classList.remove("locked-track");
                        }
                    }
                    sendUpdateCookie();
                }

                // Initialize custom scrollbar with a slight delay
                setTimeout(() => {
                    $(".scrollbar-macosx").scrollbar();
                }, 500);

            }
        },
        error: function () {
            showNotification("", "Upload failed.", "error", false);
        }
    });
}

function closeSharePopup(popupType) {

    if (popupType == "ShareRequest10" || popupType == "ShareRequest17" || popupType == "ShareRequest18") {
        $("#viralMusicPlayer").css("display", "none");
        return;
    }
    $("#viralMusicPlayer").css("display", "none");

    if (popupType == "ShareRequest12") {
        const targetRow = document.getElementById("songlist-5");
        if (!targetRow) return; // Stop if it doesn't exist

        const targetId = targetRow.id.replace("songlist-", "");
        const targetAzureFile = targetRow.getAttribute("data-azurefilename");
        const targetFileName = targetRow.getAttribute("data-filename");

        if (targetAzureFile) {
            ActivateItem(targetId, targetAzureFile, targetFileName, true);
        }
        return;
    }

    if (popupType == "ShareRequest19") {
        // Get all elements with class "playlist-row"
        const rows = document.getElementsByClassName("playlist-row");
        IsAlbumPurchased = true
        // Loop through and remove "lock-track" if present
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].classList.contains("locked-track")) {
                rows[i].classList.remove("locked-track");
            }
        }

        const currentRow = document.querySelector(".playlist-row.active");
        if (!currentRow) return;

        const nextRow = currentRow.nextElementSibling;

        if (nextRow && nextRow.classList.contains("playlist-row")) {
            // Extract next song details
            const nextId = nextRow.id.replace("songlist-", "");
            const nextAzureFile = nextRow.getAttribute("data-azurefilename");
            const nextFileName = nextRow.getAttribute("data-filename");

            // Play the next song if a valid Azure file is found
            if (nextAzureFile) {
                $("#" + nextRow.id).removeClass("locked-track");
                ActivateItem(nextId, nextAzureFile, nextFileName, true);
            }

        }
        return;
    }



    if (popupType == "ShareRequest10") {
        return;
    }

    const currentRow = document.querySelector(".playlist-row.active");
    if (!currentRow) return;

    const nextRow = currentRow.nextElementSibling;

    if (nextRow && nextRow.classList.contains("playlist-row")) {
        // Extract next song details
        const nextId = nextRow.id.replace("songlist-", "");
        const nextAzureFile = nextRow.getAttribute("data-azurefilename");
        const nextFileName = nextRow.getAttribute("data-filename");

        // Play the next song if a valid Azure file is found
        if (nextAzureFile) {
            $("#" + nextRow.id).removeClass("locked-track");
            ActivateItem(nextId, nextAzureFile, nextFileName, true);
        }

    }

}

function SendShareOTP(popupType) {

    if (popupType == "ShareRequest18") {
        var emailInput = $("#Verifyemail");
        var email = emailInput.val();

        // Simple regex for email validation
        var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            // Invalid email → red border
            //emailInput.css("border", "1px solid red");
            emailInput.addClass("field-err");
            return false;
        } else {
            // Valid email → reset border.
            EmailAddress = email;
            emailInput.removeClass("field-err");
        }
    }

    let URL = window.location.href;
    const parts = URL.split("/");
    const ShareID = parts[parts.length - 1];
    var model = {
        Email: $("#Verifyemail").val(), // Get value from an input field
        ShareID: ShareID           // Pass popupType in the model
    };

    $.ajax({
        url: '/api/SendShareOTP',
        type: 'POST',
        data: JSON.stringify(model),  // Convert object to JSON string
        contentType: "application/json; charset=utf-8",
        success: function (result) {
            if (result != null) {

                switch (result) {
                    case "success":
                        showNextPopup("validateotp");
                        break;
                    case "no-payment-exist":
                        showNotification("", "There is no payment exist on this email", "error", false);
                        break;
                    case "albumid-not-exist":
                        showNotification("", "Album not exist..", "error", false);
                        break;
                    case "fail":
                        showNotification("", "Invalid OTP, Please try again", "error", false);
                        break;
                }
            }
        },
        error: function () {
             showNotification("", "Error sending OTP email.", "error", false);

        }
    });
}

function ResentOTP() {

    let URL = window.location.href;
    const parts = URL.split("/");
    const ShareID = parts[parts.length - 1];
    var model = {
        Email: EmailAddress, // Get value from an input field
        ShareID: ShareID           // Pass popupType in the model
    };

    $.ajax({
        url: '/api/ResendOTP',
        type: 'POST',
        data: JSON.stringify(model),  // Convert object to JSON string
        contentType: "application/json; charset=utf-8",
        success: function (result) {
            if (result != null) {

                switch (result) {
                    case "success":
                        showNotification("", "OTP sent successfully!", "success", true);
                        break;
                    case "fail":
                        showNotification("", "fail to send OTP", "error", false);
                        break;
                }
            }
        },
        error: function () {
            showNotification("", "Error sending OTP email.", "error", false);

        }
    });
}
function VerifyShareOTP(OTP) {

    let URL = window.location.href;
    const parts = URL.split("/");
    const ShareID = parts[parts.length - 1];
    var model = {
        Email: EmailAddress,
        ShareID: ShareID,
        OTP: OTP
    };

    $.ajax({
        url: '/api/VerifyShareOTP',
        type: 'POST',
        data: JSON.stringify(model),  // Convert object to JSON string
        contentType: "application/json; charset=utf-8",
        success: function (result) {
            if (result != null) {

                switch (result) {
                    case "success":
                        showNextPopup("ShareRequest19");
                        break;
                    case "no-payment-exist":
                        showNotification("", "There is no payment exist on this email.", "error", false);
                        break;
                    case "albumid-not-exist":
                        showNotification("", "Album not exist..", "error", false);
                        break;
                    case "notvalidate":
                         showNotification("", "OTP verification failed. Please try again.", "error", false);
                        break;
                    case "fail":
                        showNotification("", "Invalid OTP, Please try again", "error", false);
                        break;
                }
            }
        },
        error: function () {
            showNotification("", "Error in verify OTP.", "error", false);

        }
    });
}
function showNextPopup(popupType) {
    let popupIndex = popupType;
    const currentRow = document.querySelector(".playlist-row.active");

    if (popupIndex === "ShareRequest15") {
        if (currentRow) {
            if ((currentRow.id === "songlist-2" || currentRow.id === "songlist-3")) {
                popupIndex = "ShareRequest15"; // Explicitly reassign (optional, since it's already 15)
            } else if (currentRow.id === "songlist-4") {
                closeSharePopup();
                const targetRow = document.getElementById("songlist-5");
                if (!targetRow) return; // Stop if it doesn't exist

                // Get all elements with class "playlist-row"
                const rows = document.getElementsByClassName("playlist-row");
                IsAlbumPurchased = true
                // Loop through and remove "lock-track" if present
                for (let i = 0; i < rows.length; i++) {
                    if (rows[i].classList.contains("locked-track")) {
                        rows[i].classList.remove("locked-track");
                    }
                }

                const targetId = targetRow.id.replace("songlist-", "");
                const targetAzureFile = targetRow.getAttribute("data-azurefilename");
                const targetFileName = targetRow.getAttribute("data-filename");

                if (targetAzureFile) {
                    ActivateItem(targetId, targetAzureFile, targetFileName, true);
                }
                return;
            }
            else {
                closeSharePopup();
                return;
            }
        } else {
            closeSharePopup();
            const targetRow = document.getElementById("songlist-5");
            if (!targetRow) return; // Stop if it doesn't exist

            const targetId = targetRow.id.replace("songlist-", "");
            const targetAzureFile = targetRow.getAttribute("data-azurefilename");
            const targetFileName = targetRow.getAttribute("data-filename");

            if (targetAzureFile) {
                ActivateItem(targetId, targetAzureFile, targetFileName, true);
            }
            return;
        }
    }

    
    if (popupIndex == "ShareRequest18") {
        SendShareOTP(popupIndex);
        return;
    }
    if (popupIndex == "validateotp") {
        popupIndex = "ShareRequest18";
    }

    $.ajax({
        url: '/ShareRedirector/ShareMusicDetails',
        type: 'POST',
        data: { popupType: popupIndex },
        success: function (result) {

            $('#viralMusicPlayer').html(result); // assumes a <div id="popupContainer"></div>

            if (popupIndex == "ShareRequest13") {
                $("#contentPopup").css("display", "none");
                $("#sharePopup").css("display", "block");
                $("#badgePopup").css("display", "none");
                $("#ViralMusicPopup").css("display", "flex");
                $("#viralMusicPlayer").css("display", "flex");
            } else {
                $("#contentPopup").css("display", "block");
                $("#sharePopup").css("display", "none");
                $("#badgePopup").css("display", "none");
                $("#ViralMusicPopup").css("display", "flex");
                $("#viralMusicPlayer").css("display", "flex");
            }


            if (popupIndex == "ShareRequest13") {
                //$("#actionBtn").prop("disabled", true);
                $("#actionBtn").addClass('disable');
            }

            if (popupIndex == "ShareRequest15") {
                $("#badgePopup").css("display", "flex");
                $("#ViralMusicPopup").css("display", "none");
            }


        },
        error: function () {
            showNotification("", "Error loading popup.", "error", false);
        }
    });
}

function createShareMusicLink(platform) {
    var shareLink = window.location.href;

    switch (platform) {
        case "facebook":
            $("#actionBtn").removeClass('disable');
            platformLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`;
            break;

        case "x": // Twitter
            $("#actionBtn").removeClass('disable');
            platformLink = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareLink)}`;
            break;

        case "linkedin":
            $("#actionBtn").removeClass('disable');
            platformLink = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareLink)}`;
            break;

        case "whatsapp":
            $("#actionBtn").removeClass('disable');
            platformLink = `https://wa.me/?text=${encodeURIComponent(shareLink)}`;
            break;

        case "pinterest":
            $("#actionBtn").removeClass('disable');
            platformLink = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareLink)}`;
            break;

        case "youtube":
            $("#actionBtn").removeClass('disable');
            platformLink = `https://www.youtube.com/redirect?q=${encodeURIComponent(shareLink)}`;
            break;

        case "googleplus": // Note: Google+ was shut down, but here's the legacy format
            $("#actionBtn").removeClass('disable');
            platformLink = `https://plus.google.com/share?url=${encodeURIComponent(shareLink)}`;
            break;
        default:
            console.error("Unsupported platform:", platform);
            showNotification("", "Unsupported platform:" + platform, "error", false);
            return;
    }

    // Open the appropriate share link in a new tab
    window.open(platformLink, '_blank');
}

function redirectToPaymentGateway() {
    let URL = window.location.href;
    const parts = URL.split("/");
    const ShareID = parts[parts.length - 1];

    if (ShareID) {
        window.location.href = "/checkout-session/" + ShareID;
    }
}

function unlockAlbum() {
    $("#UnlockAlbumPopup").css("display", "flex");
}

function closeUnlockPopup() {
    $("#UnlockAlbumPopup").css("display", "none");
}

function VerifyEmailToUnlockAlbum() {
    var email = $("#txtEmailAddress").val().trim();

    // Check if email is empty
    if (email === "") {
        $("#txtEmailAddress").addClass("field-err");
        $("#EmailAddressError").css("display", "flex");
        $("#EmailAddressError").addClass("err-msg");
        $("#EmailAddressError").text("Please enter your email address.");
        return false;
    }

    // Email format regex
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        $("#txtEmailAddress").addClass("field-err");
        $("#EmailAddressError").css("display", "flex");
        $("#EmailAddressError").addClass("err-msg");
        $("#EmailAddressError").text("Please enter a valid email address.");
        return false;
    }
    $("#EmailAddressError").css("display", "none");
    $("#EmailAddressError").removeClass("err-msg");
    $("#EmailAddressError").text("");
    email.removeClass("field-err");
    // If passed both validations
    console.log("Email verified:", email);
    // Proceed with your unlock logic here...
    return true;
}

function verifyOTP() {
    let inputs = [
        $("#otpValue1"),
        $("#otpValue2"),
        $("#otpValue3"),
        $("#otpValue4")
    ];

    let isValid = true;

    inputs.forEach(function ($input) {
        let val = $input.val().trim();

        // Remove old error class
        $input.removeClass("field-err");

        // Required check
        if (val === "") {
            $input.addClass("field-err");
            isValid = false;
        }
        // Numeric check
        else if (!$.isNumeric(val)) {
            $input.addClass("field-err");
            isValid = false;
        }
    });

    if (!isValid) {
        return false; // Stop if any field is invalid
    }

    // If valid, join OTP
    let OTP = inputs.map($el => $el.val()).join("");
    VerifyShareOTP(OTP);
    return true;
}

function focusNext() {
    if ($("#otpValue1").val().trim() !== "") {
        $("#otpValue2").focus();

    }
}

function focusNext2() {
    if ($("#otpValue2").val().trim() !== "") {
        $("#otpValue3").focus();
    }
}

function focusNext3() {
    if ($("#otpValue3").val().trim() !== "") {
        $("#otpValue4").focus();
    }
}
//get cookie List
function getSessionTokenCookies() {
    const cookies = document.cookie.split(';');
    const sessionTokens = [];

    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'JubileeAlbum') {
            return value; // decode if stored as JSON
        }
    }

    return null;
}
function sendSessionTokensToApi() {
    const cookie = getSessionTokenCookies();
    if (cookie == null) return; 
    let URL = window.location.href;
    const parts = URL.split("/");
    const ShareID = parts[parts.length - 1];
    const payload = {
        shareId: ShareID,
        Cookie: decodeURIComponent(cookie)
    };

    $.ajax({
        url: '/api/checkalbumcookie', 
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(payload),
        success: function (response) {
            if (response != null) {
                if (response.success) {
                    // Get all elements with class "playlist-row"
                    const rows = document.getElementsByClassName("playlist-row");
                    IsAlbumPurchased = true
                    // Loop through and remove "lock-track" if present
                    for (let i = 0; i < rows.length; i++) {
                        if (rows[i].classList.contains("locked-track")) {
                            rows[i].classList.remove("locked-track");
                        }
                    }

                } else {
                    IsAlbumPurchased = false;
                }
            }            
        },
        error: function (err) {
            console.error('Error sending tokens:', err);
        }
    });
}
sendSessionTokensToApi();
function sendUpdateCookie() {
   
    let URL = window.location.href;
    const parts = URL.split("/");
    const ShareID = parts[parts.length - 1];
    const payload = {
        shareId: ShareID       
    };

    $.ajax({
        url: '/api/updatealbumcookie',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(payload),
        success: function (response) {
            if (response != null) {
                if (response.success) {
                    // Get all elements with class "playlist-row"
                    const rows = document.getElementsByClassName("playlist-row");
                    IsAlbumPurchased = true
                    // Loop through and remove "lock-track" if present
                    for (let i = 0; i < rows.length; i++) {
                        if (rows[i].classList.contains("locked-track")) {
                            rows[i].classList.remove("locked-track");
                        }
                    }

                } else {
                    IsAlbumPurchased = false;
                }
            }
        },
        error: function (err) {
            console.error('Error sending tokens:', err);
        }
    });
}