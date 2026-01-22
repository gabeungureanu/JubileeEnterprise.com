var timeIntervalSessionInMinutes = 1;
var rememberMe = true;
$(document).ready(function () {
    const fullPath = window.location.href;
    const lastSegment = fullPath.substring(fullPath.lastIndexOf('/') + 1);


    const domainName = window.location.hostname;
    GetWebSiteConfiguration(domainName);
    //$(".left-nav-bar").resizable();
    const elementNav = document.querySelector(".left-nav-bar");
    if (elementNav) {
        $(".left-nav-bar").resizable();
    }

    BindJubileeBible("");
    //BindContentManager("");

    //ShowWebsiteVisitorRevenueQuestion();

    $(".left-nav-item").on("click", function () {
        let items = document.querySelectorAll('.left-nav-item-wrap');
        if (items) {
            items.forEach(item => {
                item.classList.remove('active');
            });
        }
        // Toggle 'active' class on the parent element with class 'left-nav-item-wrap'
        $(this).closest(".left-nav-item-wrap").toggleClass("active");
    });
    //Keep session alive section
    timeIntervalSessionInMinutes ?? 5;
    var timeIntervalInMinutes = (timeIntervalSessionInMinutes * 60 * 1000) - 10000;
    const timerInterval = setInterval(() => {
        if (rememberMe != null && rememberMe) {
            SetSessionTimeOut();
        }
    }, parseInt(timeIntervalInMinutes));
    //Keep session alive section end
    if (lastSegment === '')
        BindLanguageRightSection();

    setTimeout(function () {
        if (lastSegment === '')
            GetVoice();
    }, 1000);

});

function toggleVoice() {
    let div = document.getElementById('voice-setting');
    if (div) {
        if (div.style.display === 'none') {
            div.style.display = ''; // Show the div
        } else {
            div.style.display = 'none'; // Hide the div
        }
    }
}

//////////////////////////////////////////////////////////////////////////////////
// Bind and set user voices
function GetVoice() {
    $.ajax({
        type: "get",
        url: "/Home/BindAllVoice",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        success: function (response) {
            // Bind all radio buttons here
            let html = '';
            if (response != undefined && response != null) {
                let i = 1;
                response.forEach(x => {
                    html += '<label><input type = "radio" name = "ai-charecter" value = ' + x.voiceID + ' > ' + x.voiceName + '</label >';
                    //html += '<input type="radio" id="test' + i + '" name="ai-charecter" value = ' + x.voiceID + '><label for="test' + i + '"> ' + x.voiceName + '</label>';
                    i++;
                });
            }
            // Call user voice and check user voice here GetVoiceToUser();
            const voiceSettingDiv = document.getElementById('voice-setting');
            if (voiceSettingDiv) {
                voiceSettingDiv.innerHTML = html;
            }            
            GetVoiceToUser();
        },
        error: function (error) {
            alert("Error occured");
        }
    });
}

function GetVoiceToUser() {
    $.ajax({
        type: "get",
        url: "/Home/BindVoiceByUser",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        success: function (response) {
            if (response != null) {
                // Bind user selected value here 
                const targetValue = response.voiceID;
                const radioButton = document.querySelector(`input[name="ai-charecter"][value="${targetValue}"]`);
                // Check if the radio button exists and select it
                if (radioButton) {
                    radioButton.checked = true;
                }
            }
        },
        error: function (error) {
            alert("Error occured in GetVoiceToUser");
        }
    });
}

// Attach event listener using event delegation
document.addEventListener('change', function (event) {
    // Check if the target is a radio button with the name 'ai-charecter'
    if (event.target.name === "ai-charecter" && event.target.checked) {
        const selectedValue = event.target.value;
        // Call your method or handle the selected value
        onRadioSelectionChange(selectedValue);
    }
});

// Method to handle radio button selection changes
function onRadioSelectionChange(value) {
    console.log("Selected Radio Button Value:", value);
    changeVoiceSetting(value);
    // Add your method logic here, e.g., make an API call or update UI
}

function changeVoiceSetting(id) {
    $.ajax({
        type: "get",
        url: "/Home/SetVoiceByUser",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {
            "voiceID": id
        },
        success: function (response) {
            if (response != undefined && response != null) {
                //alert(response.msg);
            }
        },
        error: function (error) {
            //alert("Error occured in changeVoiceSetting");
        }
    });
}

///////////////////////////////////////////////////////////////////////

function getBrowserName() {
    var browserName;
    if (navigator.userAgent.indexOf("Firefox") > -1) {
        browserName = "Mozilla Firefox";
    } else if (navigator.userAgent.indexOf("SamsungBrowser") > -1) {
        browserName = "Samsung Internet";
    } else if (navigator.userAgent.indexOf("Opera") > -1 || navigator.userAgent.indexOf("OPR") > -1) {
        browserName = "Opera";
    } else if (navigator.userAgent.indexOf("Trident") > -1) {
        browserName = "Microsoft Internet Explorer";
    } else if (navigator.userAgent.indexOf("Edge") > -1 || navigator.userAgent.indexOf("Edg") > -1) {
        browserName = "Microsoft Edge";
    } else if (navigator.userAgent.indexOf("Chrome") > -1) {
        browserName = "Google Chrome";
    } else if (navigator.userAgent.indexOf("Safari") > -1) {
        browserName = "Apple Safari";
    } else {
        browserName = "Unknown";
    }
    return browserName;
}

function showHideHeaderMenu() {
    const navDD = document.querySelector(".mob-nav-dd");
    const langPop = document.querySelector(".lang-selection-popup");
    if (navDD) {
        if (navDD.classList.contains("show")) {
            navDD.classList.remove("show");
        }
        else {
            navDD.classList.add("show");
            if (langPop) {
                if (langPop.classList.contains("show-lsp")) {
                    langPop.classList.remove("show-lsp");
                }
            }
        }
    }
}

function ShowHideLang(element) {
    const navDD = document.querySelector(".mob-nav-dd");
    const langPop = document.querySelector(".lang-selection-popup");

    if ($(".lang-selection-popup").hasClass("show-lsp")) {
        $(".lang-selection-popup").removeClass("show-lsp");
    } else {
        $(".lang-selection-popup").addClass("show-lsp");
        if (navDD) {
            if (navDD.classList.contains("show")) {
                navDD.classList.remove("show");
            }
        }
    }
    //show-lsp
}

function SetSessionTimeOut() {
    $.ajax({
        type: "GET",
        url: "/Account/KeepAliveSession",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        success: function (response) {
            if (response !== null) {
                timeIntervalSessionInMinutes = response.IdleTimeoutMinutes;
                rememberMe = response.RememberMe;
            }
        },
        error: function (error) {
        }
    });
}

function ShowHideChatSection() {
    var div = document.getElementById("divPromptSection");
    if (div) {
        if (div.classList.contains("active")) {
            div.classList.remove("active");
        } else {
            div.classList.add("active");
        }
    }
}

function Toggle_Navbar() {
    if ($(window).width() <= 768) {
        const elementCont = document.querySelector(".parent-container");

        if (elementCont && elementCont.classList.contains('close-nav')) {
            //const mainCont = document.querySelector(".main-panel-container");
            //if (mainCont) {
            //    mainCont.style.display = "none";
            //}
        }

        // Get the current page name from the URL
        const currentPage = window.location.pathname.split('/').pop(); // Extracts 'pricing' from '/pricing'

        // Check if the page is 'pricing'
        if (currentPage === "pricing") {
            // window.location.href = "/"; // Uncomment if redirection is needed
            // Add your specific actions here for the 'pricing' page
        } else {
            if (elementCont) {
                elementCont.classList.toggle("close-nav");
                //
               

                // Add width in left nav
                const leftPanelFull = document.getElementById("left-nav-bar");
                if (leftPanelFull) {
                    leftPanelFull.style.width = "100%";
                    leftPanelFull.style.maxWidth = "100%";
                }

            }
            const mainCont = document.querySelector(".main-panel-container");
            if (mainCont) {
                mainCont.classList.toggle("hide");
            }
            //const mainCont = document.querySelector(".main-panel-container .hidden");
            //if (mainCont) {
            //    mainCont.style.display = "none";
            //}
        }
    }
    else {
        const elementCont = document.querySelector(".parent-container");
        // Get the current page name from the URL
        const currentPage = window.location.pathname.split('/').pop(); // Extracts 'pricing' from '/pricing'

        // Check if the page is 'pricing'
        if (currentPage === "pricing") {
            //location.href("/");
            // Add your specific actions here for the 'pricing' page
        } else {
            if (elementCont) {
                $(".parent-container").toggleClass("close-nav");
            }
        }
    }
    
    
}

function showNotification(title, text, type, showConfirmButton) {
    swal({
        type: type,// success, error, warning, info, question,
        position: 'center',
        //icon: 'success',
        title: title,
        text: text,
        width: '500px',
        //animation: 'slide-from-top',
        showConfirmButton: showConfirmButton,      //false,
        timer: 4500
    });
}

function HideLeftMenuItems() {
    //-----------------------Hide left menu------------------------
    var PromptSection = document.getElementById("divPromptSection");
    if (PromptSection)
        PromptSection.style.display = "none";

    var searchBar = document.getElementById("divSearchBar");
    if (searchBar)
        searchBar.style.display = "none";

    var navPanel = document.getElementById("divNevPanel");
    if (navPanel)
        navPanel.style.display = "none";

    var iconPanel = document.getElementById("divIconPanel");
    if (iconPanel)
        iconPanel.style.display = "none";

    //------------------------------------------------------------
}

function ShowLeftMenuItems() {
    //-----------------------Hide left menu------------------------
    var PromptSection = document.getElementById("divPromptSection");
    if (PromptSection)
        PromptSection.style.display = "";

    var searchBar = document.getElementById("divSearchBar");
    if (searchBar)
        searchBar.style.display = "";

    var navPanel = document.getElementById("divNevPanel");
    if (navPanel)
        navPanel.style.display = "";

    var iconPanel = document.getElementById("divIconPanel");
    if (iconPanel)
        iconPanel.style.display = "";
    //------------------------------------------------------------
}

function OpenSubscriptionPage() {
    window.location.href = "/currentsubscription";
}

//===============================SS=====================================
function ClickExpandSettings() {
    var Divdata = $('#divMySettings');
    if (Divdata != null) {

        if ($('#divMySettings').hasClass('active')) {
            $('#divMySettings').removeClass('active');
        }
        else {
            $('#divMySettings').addClass('active');
        }
    }
}

//===================================================================

function GetWebSiteConfiguration(domainName) {

    $.ajax({
        type: "get",
        url: "/Home/GetWebSiteConfiguration",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: false,
        success: function (response, xhr) {
            if (response !== undefined) {
                if (response.system_WebsiteName != undefined || response.system_WebsiteName != null) {
                    //Bind main image
                    const elemMainLogo = document.querySelectorAll('#imgMainLogo');
                    if (elemMainLogo) {
                        elemMainLogo.forEach(element => {
                            element.src = response.mainImagePath;
                            element.alt = response.mainImageAltText;
                        });
                    }
                    //Bind Favicon
                    const elemFavico = document.querySelectorAll('#lnkFavicon');
                    if (elemFavico) {
                        elemFavico.forEach(element => {
                            element.href = response.faviconImagePath;
                        });
                    }
                    //Bind Brand Image
                    const elemBrand = document.querySelectorAll('#imgBrand');
                    if (elemBrand) {
                        elemBrand.forEach(element => {
                            element.src = response.brandImagePath;
                            element.alt = response.mainImageAltText;
                        });
                    }
                    //Bind Replace text
                    const elementsText = document.querySelector('#hfResponseReplacedText');
                    if (elementsText) {
                        elementsText.value = response.resReplacedText;
                    }
                    const elements = document.querySelectorAll('.webName');
                    if (elements) {
                        elements.forEach(element => {
                            element.innerText = response.system_WebsiteName;
                        });
                    }
                    const webName = document.querySelectorAll('.webNameUpperCase');
                    if (webName) {
                        webName.forEach(element => {
                            element.innerText = response.system_WebsiteName.toUpperCase();
                        });
                    }
                    const elementLogo = document.querySelectorAll('.ancLogo');
                    if (elementLogo) {
                        elementLogo.forEach(element => {
                            element.innerHTML = response.system_WebsitePrefix + "<span>" + response.system_WebsiteMiddle + "</span>" + response.system_WebsiteSuffix; //response.system_WebsiteName;
                        });
                    }
                    const elementLogoSignIn = document.querySelectorAll('.ancLogoSign');
                    if (elementLogoSignIn) {
                        elementLogoSignIn.forEach(element => {
                            element.innerHTML = '<span class="logo-txt">' + response.system_WebsitePrefix + '<span class="color-orange">' + response.system_WebsiteMiddle + '</span>' + response.system_WebsiteSuffix + '</span>'; //response.system_WebsiteName;
                        });
                    }

                    const elementLogoLeftMenu = document.querySelectorAll('.ancLogoLeftMenu');
                    const planNameDisplay = response.planName === "Free Plan" || response.planName === "" ? "JUBILEE AI BIBLE PERSONALITY - FREE PLAN": response.planName;
                    const planNameCss = response.planName === "Free Plan" || response.planName === "" ? 'style="bottom: -40px !important;"' : "";
                    if (elementLogoLeftMenu) {
                        elementLogoLeftMenu.forEach(element => {
                            element.innerHTML = '<p  class="nb-txt"><small id="dvCurrentPlan" >' + planNameDisplay + '</small>' + response.system_WebsitePrefix + '<span>' + response.system_WebsiteMiddle + '</span></p> ';

                            //element.innerHTML = '<span class="logo-txt">' + response.system_WebsitePrefix + '<span class="color-orange">' + response.system_WebsiteMiddle + '</span>' + response.system_WebsiteSuffix + '</span>'; //response.system_WebsiteName;
                        });
                    }
                    const elementsDisclaimer = document.querySelectorAll('.shortDisclaimer');
                    if (elementsDisclaimer) {
                        elementsDisclaimer.forEach(element => {
                            element.innerText = response.shortDisclaimer;
                        });
                    }
                }
            }
        },
        error: function (error) {
        }
    });
}

function setConfigurationCookie(configurationData) {
    document.cookie = `configData=${JSON.stringify(configurationData)}; path=/`;
}

function getConfigurationFromCookie() {
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('configData='));

    if (cookieValue) {
        const json = cookieValue.split('=')[1];
        return JSON.parse(json);
    }
}

function showLoader() {

}

function hideLoader() {

}

//======================================LEFT MENU CONTENT MANAGER CODE TO BIND AND INSERT DATA====================================
function SaveContentTypeText(e) {
    if (e.keyCode == 13) {
        SaveContentType();
    } else if (e.keyCode === 27) {
        HideContentTypeTextbox();
    }
}

function SaveContentTypeOnBlur() {
    HideContentTypeTextbox();
    //SaveContentType();
}

function SaveContentType() {
    if ($("#txtContentTypeText").val().trim() != "") {
        $.ajax({
            type: "post",
            url: "/ContentManager/SaveContentType",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            data: {
                "ContentName": $("#txtContentTypeText").val()
            },
            success: function (response) {
                if (response != null) {
                    if (response.Status == "1") {
                        BindContentManager("");
                        $("#txtContentTypeText").val("");
                        HideContentTypeTextbox();
                    } else {
                        showNotification("", response.Message, "error", false);
                    }
                }
            },
            error: function (error) {
            }
        });
    }
}

function SaveBookSeriesText(e, ID) {
    if (e.keyCode == 13) {
        SaveBookSeries(ID);
    } else if (e.keyCode === 27) {
        HideBookSeries(ID);
    }
}

function SaveBookSeriesOnBlur(ID) {
    HideBookSeries(ID);
}

function SaveBookSeries(ID) {
    if ($("#txtBookSeries_" + ID).val().trim() != "") {
        $.ajax({
            type: "post",
            url: "/ContentManager/SaveBookSeries",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            data: {
                "ID": ID,
                "BookSeriesName": $("#txtBookSeries_" + ID).val()
            },
            success: function (response) {
                if (response != null) {
                    if (response.Status == "1") {
                        if (response.ID != null && response.ID != "") {
                            BindContentManager(response.ID, ID);
                        } else {
                            BindContentManager(ID);
                        }
                        $("#txtBookSeries_" + ID).val("");
                        HideContentTypeTextbox();
                    } else {
                        showNotification("", response.Message, "error", false);
                    }
                }
            },
            error: function (error) {
            }
        });
    }
}

function BindContentManager(ParentID, ChildID) {
    $.ajax({
        type: "post",
        url: "/ContentManager/BindContentManager",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "ID": ""
        },
        success: function (response) {
            var html = '';
            if (response != null) {
                var CTLength = response.length;

                html += '<div class="anct" id="divContentTypeTextbox" style="display:none;">';
                html += '<input type="text" id="txtContentTypeText" onkeyup="SaveContentTypeText(event)" onblur="SaveContentTypeOnBlur()"/>';
                html += '</div > ';

                for (var i = 0; i < CTLength; i++) {
                    if (response[i].id == ParentID) {
                        html += '  <div class="cmn-item-1 active" id="divParent_' + response[i].id + '">                       ';
                    } else {
                        html += '  <div class="cmn-item-1" id="divParent_' + response[i].id + '">                       ';
                    }
                    html += '      <div class="cmn-item-1-title">                                                                                                               ';
                    html += '          <div class="cmn-expand-icon" style="cursor:pointer;" onclick="ShowHideParent(\'' + response[i].id + '\')">                                                                                                            ';
                    if (response[i].bookSeries.length > 0) {
                        html += '              <i class="mdi mdi-plus-box"></i>                                                                                                     ';
                    }
                    html += '          </div>                                                                                                                                   ';
                    html += '          <div class="cmi-icon"><img src="images/book-stack-icon.png" alt=""></div>                                                                ';
                    html += '          <p class="cmn-txt" style="cursor:pointer;" onclick="BindBookContentUsingContentType(\'' + response[i].id + '\')">' + response[i].description + '</p>                     ';
                    html += '          <i class="mdi mdi-plus-box-outline add-new-lbl" style="cursor:pointer;" title="Add New ..." onclick="AddBookSeries(\'' + response[i].id + '\')"></i>';
                    html += '      </div>                                                                                          ';
                    html += '      <div class="cmn-item-subnav">                                                                   ';

                    html += '<div class="anct" id="divContent_' + response[i].id + '" style="display:none;">';
                    html += '<input type="text" id="txtBookSeries_' + response[i].id + '" onkeyup="SaveBookSeriesText(event,\'' + response[i].id + '\')" onblur="SaveBookSeriesOnBlur(\'' + response[i].id + '\')"/>';
                    html += '</div > ';

                    for (var j = 0; j < response[i].bookSeries.length; j++) {
                        if (response[i].bookSeries[j].id == ChildID) {
                            html += '          <div class="cmn-item-2 active" id="divChild_' + response[i].bookSeries[j].id + '">                              ';
                        } else {
                            html += '          <div class="cmn-item-2" id="divChild_' + response[i].bookSeries[j].id + '">                              ';
                        }
                        html += '              <div class="cmn-item-2-title">                                                          ';
                        html += '                  <div class="cmn-expand-icon" style="cursor:pointer;" onclick="ShowHideChild(\'' + response[i].bookSeries[j].id + '\')">                                                       ';
                        if (response[i].bookSeries[j].books.length > 0) {
                            html += '                      <i class="mdi mdi-plus-box"></i>                                               ';
                        }
                        html += '                  </div>                                                                              ';
                        html += '                  <div class="cmi-icon"><img src="images/book-icon.png" alt=""></div>                 ';
                        html += '                  <p class="cmn-txt" style="cursor:pointer;" onclick="BindBookContentUsingContentType(\'' + response[i].bookSeries[j].id + '\')">' + response[i].bookSeries[j].description + '</p> ';
                        html += '                  <i class="mdi mdi-plus-box-outline add-new-lbl" title="Add New ..." onclick="AddBookSeries(\'' + response[i].bookSeries[j].id + '\')"></i>';
                        html += '              </div>                                                                                  ';

                        html += '              <div class="cmn-item-subnav">                                                           ';

                        html += '<div class="anct" id="divContent_' + response[i].bookSeries[j].id + '" style="display:none;">';
                        html += '<input type="text" id="txtBookSeries_' + response[i].bookSeries[j].id + '" onkeyup="SaveBookSeriesText(event,\'' + response[i].bookSeries[j].id + '\')" onblur="SaveBookSeriesOnBlur(\'' + response[i].bookSeries[j].id + '\')"/>';
                        html += '</div > ';

                        for (var k = 0; k < response[i].bookSeries[j].books.length; k++) {
                            html += '                  <div class="cmn-item-3" id="divSubChild_' + response[i].bookSeries[j].books[k].id + '" >                                                            ';
                            html += '                      <div class="cmn-item-3-title">                                                  ';
                            html += '                          <div class="cmi-icon"><img src="images/book-top-icon.png" alt=""></div>     ';
                            html += '                          <p class="cmn-txt" style="cursor:pointer;" onclick="BindBookContentUsingContentType(\'' + response[i].bookSeries[j].books[k].id + '\')">' + response[i].bookSeries[j].books[k].description + '</p>   ';
                            html += '                      </div>                                                                          ';
                            html += '                  </div>                                                                                  ';
                        }
                        html += '              </div>                                                                                  ';
                        html += '          </div>                                                                                      ';
                    }
                    html += '      </div>                                                                                          ';
                    html += '  </div>                                                                                              ';
                }
            }

            $("#cm-navAI").html(html);
        },
        error: function (error) {
            HideLoader();
        }
    });
}

function ShowHideParent(ID) {
    //$(".cmn-item-1").removeClass("active");
    //$(".cmn-item-2").removeClass("active");
    var elem = document.getElementById("divParent_" + ID)
    if (elem) {
        if (elem.classList.contains("active"))
            elem.classList.remove("active");
        else
            elem.classList.add("active");
    }
}

function ShowHideChild(ID) {
    //$(".cmn-item-2").removeClass("active");
    var elem = document.getElementById("divChild_" + ID)
    if (elem) {
        if (elem.classList.contains("active"))
            elem.classList.remove("active");
        else
            elem.classList.add("active");
    }

    //const items = document.querySelectorAll('.cmn-item-2');
    //// Add click event listener to each item
    //items.forEach(item => {
    //    item.addEventListener('click', () => {
    //        // Toggle the 'active' class on the clicked item
    //        item.classList.toggle('active');
    //    });
    //});
}

function AddBookSeries(ID) {

    var elementParent = document.getElementById("divParent_" + ID)
    if (elementParent) {
        //if (elem.classList.contains("active"))
        elementParent.classList.add("active");
    }

    var element = document.getElementById("divChild_" + ID)
    if (element) {
        //if (elem.classList.contains("active"))
        element.classList.add("active");
    }

    var elem = document.getElementById("divContent_" + ID)
    if (elem) {
        if (elem.style.display == "none")
            elem.style.display = "";
        else
            elem.style.display = "none";
    }
    $("#txtBookSeries_" + ID).focus();
}

function HideBookSeries(ID) {
    var elem = document.getElementById("divContent_" + ID)
    if (elem) {
        elem.style.display = "none";
    }
}

function AddNewContentTypeTextbox() {
    ShowContentTypeTextbox();
}

function HideContentTypeTextbox() {
    var divElement = document.getElementById("divContentTypeTextbox");
    if (divElement) {
        divElement.style.display = "none";
    }
}

function ShowContentTypeTextbox() {
    var divElement = document.getElementById("divContentTypeTextbox");
    if (divElement) {
        divElement.style.display = "";
    }
    $("txtContentTypeText").focus();
}

function ShowWebsiteVisitorRevenueQuestion() {
    $.ajax({
        type: "get",
        url: "/Home/WebsiteVisitorRevenueQuestion_Get",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        success: function (response) {
            var htmlQA = "";
            var htmlVisit = "";
            var htmlRevenue = "";
            var revenueData = [];
            var lblLabels = [];
            if (response != null) {
                htmlQA += '<p><span style="color:#c3c3c3; font-size:12px;"> ' + response.totalQuestions.toLocaleString('en-US') + ' | ' + response.domainTotalQuestions.toLocaleString('en-US') + ' QA</span></p>';
                htmlVisit += '<p class="visit-stat">Website Visits | ' + response.domainTotalVisitors.toLocaleString('en-US') + '</p>';
                htmlVisit += '<p class="visit-no">' + response.totalVisitors.toLocaleString('en-US') + '</p>';
                htmlRevenue += '<p><span style="font-weight:bold; color:gray;">$' + response.totalRevenue.toFixed(2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' | $' + response.domainTotalRevenue.toFixed(2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' R</span></p>';

                if (response.revenueGraphDatas != null) {
                    for (var i = 0; i < response.revenueGraphDatas.length; i++) {
                        revenueData.push(response.revenueGraphDatas[i].revenue.toFixed(2));
                        lblLabels.push(response.revenueGraphDatas[i].revenueDate);
                    }
                }
                $("#divQA").html(htmlQA);
                $("#divVisit").html(htmlVisit);
                $("#divRevenue").html(htmlRevenue);
                renderRevenueChart(revenueData, lblLabels, response.domainTotalRevenue, response.totalRevenue);
            }
        },
        error: function (error) {
        }
    });
}

function renderRevenueChart(revenueData, lblLabels, domainTotalRevenue, totalRevenue) {
    //const totalRevenue = revenueData.reduce((sum, value) => sum + value, 0);
    const ctx = document.getElementById('revenueChart').getContext('2d');
    //const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    //gradient.addColorStop(0, 'rgba(242, 242, 255, 1)'); // Start color
    //gradient.addColorStop(1, 'rgba(255, 255, 255, 0.5)');   // End color (transparent)

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(229, 229, 229, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    const emptyLabels = Array(revenueData.length).fill('');
    const verticalLineXPositions = [1, 2];
    const pluginTitle = '$' + totalRevenue.toFixed(2) + ' | ' + '$' + domainTotalRevenue.toFixed(2) + ' R';

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: emptyLabels,
            datasets: [{
                label: 'Revenue ($)',
                borderColor: 'rgb(102 103 245)',
                pointBorderColor: 'rgba(229, 229, 229)',
                borderWidth: 1,
                pointBackgroundColor: 'rgba(75, 192, 192, 1)',
                pointRadius: 0,
                data: revenueData,
                lineTension: 0.1,
                fill: true,
                backgroundColor: gradient,
            }],
        },
        options: {
            scales: {
                x: {
                    display: true, // Hide x-axis
                    beginAtZero: true,
                    maxRotation: 45,
                    minRotation: 45,
                },
                y: {
                    display: false, // Hide y-axis
                    beginAtZero: true,
                },
            },
            plugins: {
                title: {
                    display: true,
                    text: '',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    //position: 'bottom',
                    align: 'start',
                    font: {
                        weight: 'bold', // Set the font weight to 'bold'
                        family: 'Arial Black',
                    },
                },
                legend: {
                    display: false,
                    position: 'top',
                    align: 'center',
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                },
                annotation: {
                    annotations: [{
                        type: 'line',
                        mode: 'vertical', //'horizontal',
                        scaleID: 'x',
                        value: totalRevenue,
                        borderColor: 'rgba(255, 99, 132, 0.8)',
                        borderWidth: 2,
                        //label: {
                        //    enabled: true,
                        //    content: 'Total Revenue: $' + totalRevenue,
                        //},
                    }],
                },
            },
            responsive: true,
            maintainAspectRatio: false,
        },
    });
}

function validateTextboxValueReturnMessage(id, filedName) {
    var inputValue = $("#" + id).val();
    var isNullOrEmptyOrWhiteSpace = !inputValue || /^\s*$/.test(inputValue);
    if (isNullOrEmptyOrWhiteSpace) {
        return ("Please enter " + filedName);
    } else {
        return "";
    }
}

function validateDropDownValueReturnMessage(id, filedName) {
    var inputValue = $("#" + id).val();
    var isNullOrEmptyOrWhiteSpace = !inputValue || /^\s*$/.test(inputValue);
    if (isNullOrEmptyOrWhiteSpace) {
        return ("Please select " + filedName);
    } else {
        return "";
    }
}

function BindJubileeBible(ParentID, ChildID) {
    $.ajax({
        type: "post",
        url: "/ContentManager/BindJubileeBible  ",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "ID": ""
        },
        success: function (response) {
            var html = '';
            var count = 1;
            if (response != null) {
                var CTLength = response.length;
                for (var i = 0; i < CTLength; i++) {
                    if (response[i].id == ParentID) {
                        html += '  <div class="cmn-item-1 active" id="divParent_' + response[i].id + '">                       ';
                    } else {
                        html += '  <div class="cmn-item-1" id="divParent_' + response[i].id + '">                       ';
                    }
                    html += '      <div class="cmn-item-1-title" style="cursor:pointer;" onclick="ShowHideParent(\'' + response[i].id + '\')">                                                                                                               ';
                    html += '          <div class="cmn-expand-icon">                                                                                                            ';
                    if (response[i].jubileeBibleSeries.length > 0) {
                        html += '              <i class="mdi mdi-plus-box"></i>                                                                                                     ';
                    }
                    html += '          </div>                                                                                                                                   ';
                    html += '          <div class="cmi-icon"><img src="images/open-book.svg" alt=""></div>                                                                ';
                    html += '          <p class="cmn-txt">' + response[i].description + '</p>                     ';
                    html += '      </div>                                                                                          ';
                    html += '      <div class="cmn-item-subnav">                                                                   ';

                    html += '<div class="anct" id="divContent_' + response[i].id + '" style="display:none;">';
                    html += '</div > ';

                    for (var j = 0; j < response[i].jubileeBibleSeries.length; j++) {
                        if (response[i].jubileeBibleSeries[j].id == ChildID) {
                            html += '          <div class="cmn-item-2 active" id="divChild_' + response[i].jubileeBibleSeries[j].id + '">                              ';
                        } else {
                            html += '          <div class="cmn-item-2" id="divChild_' + response[i].jubileeBibleSeries[j].id + '">                              ';
                        }
                        html += '              <div class="cmn-item-2-title" style="cursor:pointer;" onclick="ShowHideChild(\'' + response[i].jubileeBibleSeries[j].id + '\')">                                                          ';
                        html += '                  <div class="cmn-expand-icon">                                                       ';
                        if (response[i].jubileeBibleSeries[j].jubileeBibleBooks.length > 0) {
                            html += '                      <i class="mdi mdi-plus-box"></i>                                               ';
                        }
                        html += '                  </div>                                                                              ';
                        html += '                  <div class="cmi-icon"><img src="images/book-stack.svg" alt=""></div>                 ';
                        html += '                  <p class="cmn-txt">' + response[i].jubileeBibleSeries[j].description + '</p> ';
                        html += '              </div>                                                                                  ';

                        html += '              <div class="cmn-item-subnav">                                                           ';

                        html += '<div class="anct" id="divContent_' + response[i].jubileeBibleSeries[j].id + '" style="display:none;">';
                        html += '</div > ';

                        for (var k = 0; k < response[i].jubileeBibleSeries[j].jubileeBibleBooks.length; k++) {
                            //if (i == 0 && j == 0 && k == 0) {
                            //    $("#hdnBiblePrompt").val(response[i].jubileeBibleSeries[j].jubileeBibleBooks[k].prompt);
                            //}
                            html += '                  <div class="cmn-item-3" id="divSubChild_' + response[i].jubileeBibleSeries[j].jubileeBibleBooks[k].id + '" >                                                            ';
                            html += '                      <div class="cmn-item-3-title" style="cursor:pointer;" onclick="ExecuteUsingChatGPT(\'' + response[i].jubileeBibleSeries[j].jubileeBibleBooks[k].id + '\',\'' + response[i].jubileeBibleSeries[j].jubileeBibleBooks[k].description + '\')">';
                            html += '                          <div class="cmi-icon"><img src="images/book-icon.svg" alt=""></div>     ';
                            html += '                          <p class="cmn-txt">' + count + '. ' + response[i].jubileeBibleSeries[j].jubileeBibleBooks[k].description + '</p>   ';
                            html += '                      </div>                                                                          ';
                            html += '                  </div>                                                                                  ';
                            count++;
                        }
                        html += '              </div>                                                                                  ';
                        html += '          </div>                                                                                      ';
                    }
                    html += '      </div>                                                                                          ';
                    html += '  </div>                                                                                              ';
                }
            }

            $("#cm-nav").html(html);
        },
        error: function (error) {
            HideLoader();
        }
    });
}

function BindLanguageRightSection() {
    try {
        $.ajax({
            type: "get",
            url: "/Home/BindLanguages",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            async: true,
            success: function (response) {
                var indexRecent = 0;
                var totalRecent = 0;
                var indexOther = 0;
                var totalOther = 0;
                var html = '';
                if (response != null) {
                    html += '<div class="lang-selection-popup-inner">';
                    response.forEach(item => {
                        if (item.category === 'Recent') {
                            totalRecent += 1;
                        } else {
                            totalOther += 1;
                        }
                    });
                    response.forEach(item => {
                        if (item.category === 'Recent') {
                            if (indexRecent !== totalRecent) {
                                if (indexRecent === 0) {
                                    html += '<p class="lang-cat">Recently Used</p>';
                                    html += '<div class="lang-wrapper">';
                                }
                                if (item.isDefault) {
                                    $("#hdnLangPrompt").val(item.languageID);
                                    changeHeaderFlagPerLanguageSelect(item.languageFlag);
                                    html += `<div class="lang-item active" onclick="ExecutePrompt2(this, '${item.languageID}', '${item.languageName.replace(/'/g, "\\'")}', '${item.languageFlag.replace(/'/g, "\\'")}')">`;
                                    html += '<div class="flag-icon ' + item.languageFlag + '"></div>';
                                    html += '<div class="lang-name">' + item.languageName + ' (Default)</div>';
                                } else {
                                    html += `<div class="lang-item" onclick="ExecutePrompt2(this, '${item.languageID}', '${item.languageName.replace(/'/g, "\\'")}', '${item.languageFlag.replace(/'/g, "\\'")}')">`;
                                    html += '<div class="flag-icon ' + item.languageFlag + '"></div>';
                                    html += '<div class="lang-name">' + item.languageName + '</div>';
                                }
                                html += '</div>';
                                if (indexRecent === totalRecent - 1) {
                                    html += '</div>';
                                }
                                indexRecent += 1;
                            }
                        } else {
                            if (indexOther !== totalOther) {
                                if (indexOther === 0) {
                                    html += '<p class="lang-cat">All Languages (Text Responses)</p>';
                                    html += '<div class="lang-wrapper">';
                                }
                                if (item.isDefault) {
                                    $("#hdnLangPrompt").val(item.languageID);
                                    html += `<div class="lang-item active" onclick="ExecutePrompt2(this, '${item.languageID}', '${item.languageName.replace(/'/g, "\\'")}', '${item.languageFlag.replace(/'/g, "\\'")}')">`;
                                    changeHeaderFlagPerLanguageSelect(item.languageFlag);
                                    html += '<div class="flag-icon ' + item.languageFlag + '"></div>';
                                    html += '<div class="lang-name">' + item.languageName + ' (Default)</div>';
                                } else {
                                    html += `<div class="lang-item " onclick="ExecutePrompt2(this, '${item.languageID}', '${item.languageName.replace(/'/g, "\\'")}', '${item.languageFlag.replace(/'/g, "\\'")}')">`;
                                    html += '<div class="flag-icon ' + item.languageFlag + '"></div>';
                                    html += '<div class="lang-name">' + item.languageName + '</div>';
                                }
                                html += '</div>';
                                if (indexOther === totalOther - 1) {
                                    html += '</div>';
                                }
                                indexOther += 1;
                            }
                        }
                    });
                    html += '</div>';
                }
                $("#divLanguage").html(html);
            },
            error: function (error) {
                HideLoader();
            }
        });
    } catch {

    }
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

function FilterNavItems() {
    const searchInput = document.getElementById("txtSearchNav").value.toLowerCase();
    const navItems = document.querySelectorAll(".left-nav-item-wrap"); // Adjust selector as per your structure
    if (searchInput == null) searchInput = '';
    navItems.forEach((item) => {
        const textContent = item.textContent || item.innerText;
        if (textContent.toLowerCase().includes(searchInput)) {
            item.style.display = ""; // Show item
        } else {
            item.style.display = "none"; // Hide item
        }
    });
}

function initSearchNavigationMenu() {
    const searchInput = document.getElementById("txtSearchNav");

    // Add an event listener to the search input
    searchInput.addEventListener("input", function () {
        const query = searchInput.value.toLowerCase();
        const menuItems = document.querySelectorAll(".left-nav-panel-inner .lnil-1");

        menuItems.forEach(item => {
            const textContent = item.innerText.toLowerCase();

            // Check if the item matches the query
            if (textContent.includes(query)) {
                let parent = item;
                let level = 0;

                // Traverse up to 3 levels to maintain visibility
                while (parent && level < 3) {
                    if (parent.classList.contains("lnil-1")) {
                        parent.classList.add("active");
                        parent.style.display = "block";
                    }
                    parent = parent.parentElement;
                    level++;
                }
            } else {
                item.classList.remove("active");
                item.style.display = "none";
            }
        });
    });
}

function searchTextInLeftNav(searchText) {
    const leftNavPanel = document.querySelector('.left-nav-panel');
    if (!leftNavPanel) {
        console.error("Left navigation panel not found!");
        return;
    }

    const result = [];

    // Search for text in visible navigation elements (up to 3 levels deep)
    const searchItems = leftNavPanel.querySelectorAll('.left-nav-item-wrap, .cmn-item-1, .lnil-1-nav-item');
    searchItems.forEach((item) => {
        if (item.textContent.toLowerCase().includes(searchText.toLowerCase())) {
            // Collect relevant details for matched item
            const itemDetails = {
                text: item.textContent.trim(),
                id: item.id || 'No ID',
                className: item.className,
            };
            result.push(itemDetails);
        }
    });

    // Output the results
    if (result.length > 0) {
        console.log("Search Results:", result);
    } else {
        console.log("No matching items found for the search text:", searchText);
    }
}

var activeItem = "";
var isSearch = false;
function searchMenu() {
    var input = document.getElementById('txtSearchNav').value.toLowerCase(); // Get user input
    var menuItems = document.querySelectorAll('.left-nav-item-wrap, .cmn-item-1, .lnil-1'); // Select relevant elements
    if (!isSearch) {
        activeItem = $('div.left-nav-item-wrap.active').attr('id');
        isSearch = true;
    }
    
    var ids = [];
    $('div.left-nav-item-wrap').not('.active').each(function () {
        ids.push($(this).attr('id'));
    });
    // Loop through all menu items and check if they match the search query
    menuItems.forEach(function (item) {
        var itemText = item.textContent.toLowerCase(); // Get text content of the item

        // Check if the item contains the search text
        if (itemText.indexOf(input) !== -1) {
            item.style.display = ''; // Show the item if it matches
            item.classList.add('active'); // Optionally add 'active' class if it matches
        } else {
            item.style.display = 'none'; // Hide the item if it doesn't match
            item.classList.remove('active'); // Optionally remove 'active' class
        }
    });

    // Optionally, expand the parent divs that contain matching items
    var parents = document.querySelectorAll('.left-nav-item-wrap, .cmn-item-1');
    parents.forEach(function (parent) {
        var childItems = parent.querySelectorAll('.lnil-1, .cmn-item-1');
        var hasMatchingChild = false;

        // Check if any child item inside this parent matches the search query
        childItems.forEach(function (child) {
            if (child.style.display !== 'none') { // If child is visible (matching)
                hasMatchingChild = true;
            }
        });

        // If this parent has visible children, ensure it is visible
        if (hasMatchingChild) {
            parent.style.display = ''; // Show the parent
            parent.classList.add('active'); // Expand the parent if it has matching children
        } else {
            parent.style.display = 'none'; // Hide the parent if no children match
            parent.classList.remove('active'); // Collapse the parent if no children match
        }
    });

    $.each(ids, function (index, id) {
        $('#' + id).removeClass('active');
    });
    if (input == "") {
        $('#' + activeItem).addClass('active');
        console.log("activeItem");
    }
    
}

//function togglePopup() {
//    var hamburger = document.querySelector('.mob-nav-dd'); // Select the mob-hamburger div
//    if (hamburger) {
//        hamburger.classList.toggle('show'); // Toggles the 'show' class
//    }
//}

//function removePopupClass() {
//    var hamburger = document.querySelector('.mob-nav-dd');
//    if (hamburger) {
//        hamburger.classList.remove('show'); // Remove the 'show' class when blurred
//    }
//}

document.addEventListener("DOMContentLoaded", function () {
    const mobNav = document.querySelector(".mob-nav");
    const mobNavDropdown = document.querySelector(".mob-nav-dd");

    function togglePopup() {
        if (mobNavDropdown) {
            mobNavDropdown.classList.toggle("show");

            if (mobNavDropdown.classList.contains("show")) {
                document.addEventListener("click", handleOutsideClick);
            } else {
                document.removeEventListener("click", handleOutsideClick);
            }
        }
    }

    function handleOutsideClick(event) {
        // If the click is outside both .mob-nav and .mob-nav-dd, close the popup
        if (!mobNav.contains(event.target) && !mobNavDropdown.contains(event.target)) {
            removePopupClass();
        }
    }

    function removePopupClass() {
        if (mobNavDropdown) {
            mobNavDropdown.classList.remove("show");
            document.removeEventListener("click", handleOutsideClick);
        }
    }

    mobNav.addEventListener("click", function (event) {
        event.stopPropagation(); // Prevent immediate closure
        togglePopup();
    });

    // Prevent closing when hovering over dropdown
    mobNavDropdown.addEventListener("mouseenter", function () {
        document.removeEventListener("click", handleOutsideClick);
    });

    // Re-enable outside click closing when leaving dropdown
    mobNavDropdown.addEventListener("mouseleave", function () {
        document.addEventListener("click", handleOutsideClick);
    });
});



