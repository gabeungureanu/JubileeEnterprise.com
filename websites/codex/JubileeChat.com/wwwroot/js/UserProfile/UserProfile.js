$(document).ready(function () {

    //Bind dropdown to editprofile
    Fetch_DDL_Denomination();
    Fetch_DDL_DefaultLanguage();
    Fetch_DDL_TimeZones();
    Fetch_DDL_Dateformat();
    setTimeout(function () {
        $("#ddlTimezone").val(5);
        $("#ddlDateformat").val(1);
        $("#ddlDefaultLang").val('3afc5072-4af1-46b4-a9fa-31ae65941524');
    },500)


    //Open edit page 
    var editPageElement = document.getElementById("hdnEditPage");
    let editpage = ""; 

    if (editPageElement) {
        editpage = editPageElement.value.trim().toLowerCase();
    }

    if (editpage === "true") {
        editUserProfile();
        let btnUpdate = document.getElementById("btnupdate");
        if (btnUpdate) btnUpdate.style.display = "block";
    }
    else if (editpage === "user") {
        manageUserProfile();
        let btnUpdate = document.getElementById("btnupdate");
        if (btnUpdate) btnUpdate.style.display = "block";
    }
    else {
        let divImg = document.getElementById("divImg");
        let btnInsert = document.getElementById("btninsert");

        if (divImg) divImg.style.display = "block";  
        if (btnInsert) btnInsert.style.display = "block";  
    }

    // Add validation on input keyup
    $("#txtusername").keyup(function () {
        validate_UserName();
    });
    $("#txtfirstName").keyup(function () {
        validate_FirstName();
    });
    $("#txtlastName").keyup(function () {
        validate_lastName();
    });
    $("#ddlDefaultLang").change(function () {
        validate_DefaultLanguage();
    });
    $("#ddlTimezone").change(function () {
        validate_Timezone();
    });
    $("#ddlDateformat").change(function () {
        validate_Dateformat();
    });
    $("#txtOccupation").on("input", function () {
        validate_Occupation();
    });
    $("#txtEmailId").keyup(function () {
        validate_EmailID();
    });
    $("#txtPassword").keyup(function () {
        validate_Password();
    });
    $("#txtConfirmPassword").keyup(function () {
        validate_ConfirmPassword();
    });
    
});
//Open user edit profile page.
function editProfile() {
    window.location.href = "/EditProfile";
}
function closeAvatarPopup() {
    $("#imagePopup").hide();
    $("#editProfilepopup").show();
    // Remove 'active' class from the avatar elements
    document.querySelectorAll(".avatar-img-wrap").forEach(avatar => {
        avatar.classList.remove("active");
    });
}
var ProfileImageClassActive
function editUserProfile() {
    var LoginUserId = $("#hdnUserID").val();
    $.ajax({
        type: "POST",
        url: "/Account/EditUserProfile",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            /*"shareID": shareID*/
        },
        success: function (response) {
            if (response != null && response != undefined && response != '') {
                $("#txtusername").val(response.data.userName);
                $("#txtfirstName").val(response.data.firstName);
                $("#txtlastName").val(response.data.lastName);
                $("#txtOccupation").val(response.data.occupation);
                $("#txtEmailId").val(response.data.emailAddress);
                $("#txtPassword").val(response.data.password);
                $("#txtConfirmPassword").val(response.data.password);
                $("#profile-locked").prop("checked", response.data.isLocked === true);
                $("#EnaThisCom").prop("checked", response.data.isEnable === true);
                if (response.data.userID === response.data.accountUserID && LoginUserId !== response.data.userID ) {
                    document.getElementById("btnDelete").style.display = "block";
                    document.querySelector(".ManageProfileSettings").style.display = "block";
                }
                else {
                    document.getElementById("btnDelete").style.display = "none";
                    document.querySelector(".ManageProfileSettings").style.display = "none";
                }
                setTimeout(function () {
                    $("#ddlDenomination").val(response.data.denomination);
                    if (response.data.timezone !== null && response.data.timezone !== undefined && response.data.timezone !== '' && response.data.timezone !== 0)
                        $("#ddlTimezone").val(response.data.timezone);
                    else
                        $("#ddlTimezone").val(5);
                    if (response.data.dateFormat !== null && response.data.dateFormat !== undefined && response.data.dateFormat !== '' && response.data.dateFormat !== 0)
                        $("#ddlDateformat").val(response.data.dateFormat);
                    else
                        $("#ddlDateformat").val(1);
                    if (response.data.languageID !== null && response.data.languageID !== undefined && response.data.languageID !== '' && response.data.languageID !== "00000000-0000-0000-0000-000000000000")
                        $("#ddlDefaultLang").val(response.data.languageID);
                    else
                    $("#ddlDefaultLang").val('3afc5072-4af1-46b4-a9fa-31ae65941524');
                }, 1500);
                var profileImage = response.data.profileImage;
                var profileImagePath = response.data.profileImagePath;
                var profileImage = response.data.profileImage || "";
                var profileImagePath = response.data.profileImagePath || "";
                var profileImageClass = response.data.profileImageClass || "";
                var defaultImage = "/Images/user-icon.jpg"; // Default image path
                ProfileImageClassActive = profileImageClass;
                var divImg = document.getElementById("divImg");
                var profileImageElement = $("#ProfileImage");
                var divProfileImage = $("#divProfileImage");

                // Check if profileImage is a file (has "/") or profileImagePath is not empty
                if ((profileImage && profileImage.includes("/")) || (profileImagePath && profileImage)) {
                    // Construct the full image path
                    var fullImagePath = profileImagePath && profileImage ? profileImagePath + "/" + profileImage : defaultImage;

                    // Check if the image exists
                    if (imageExists(fullImagePath)) {
                        divImg.style.display = "block"; // Show the image div
                        profileImageElement.attr("src", fullImagePath).show(); // Show the image
                        divProfileImage.hide(); // Hide the avatar div
                    } else {
                        // If the image doesn't exist, show the default image
                        divImg.style.display = "block";
                        profileImageElement.attr("src", defaultImage).show();
                        divProfileImage.hide(); // Hide the avatar div
                    }
                } else if (profileImageClass) {
                    // If image is not available, check for avatar class
                    divProfileImage.removeAttr("src").removeClass().addClass(profileImageClass).show();
                    profileImageElement.hide(); // Hide the image element
                } else {
                    divImg.style.display = "block";
                    profileImageElement.attr("src", defaultImage).show();
                    divProfileImage.hide();
                }
            } else {
                alert("Oops! Something went wrong.");
            }
        },

        error: function (error) {
            console.log("Error in response");
            ;
        }
    });
}

// Function to check if an image exists on the server
function imageExists(url) {
    var http = new XMLHttpRequest();
    http.open('HEAD', url, false);
    http.send();
    return http.status !== 404;
}

//--------------------------------For Edit Profile--------------------------------------------
// Function to initialize the file input change event
function initializeFileInput() {
    let fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', previewImage);
    }
}

// Function to trigger file input dialog
function uploadImage() {
    setTimeout(function () {
        let fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.click(); // Trigger the file input dialog
        } else {
            console.error("fileInput element not found in uploadImage function!");
        }
    }, 100);
}

// Function to handle the image preview
function previewImage(event) {
    document.getElementById("divImg").style.display = "block";
    document.getElementById("ProfileImage").style.display = "block";
    document.getElementById("divProfileImage").style.display = "none";
    var divProfileImage = $("#divProfileImage");
    divProfileImage.removeAttr("src").removeClass()
    const file = event.target.files[0]; // Get the selected file
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            // Get the img tag inside the div with class edit-pro-img
            const imgElement = document.querySelector('.edit-pro-img img');
            if (imgElement) {
                imgElement.src = e.target.result;
            } else {
                console.error("Image element not found!");
            }
        };
        reader.readAsDataURL(file); // Convert to base64 format
    }
    $("." + ProfileImageClassActive).removeClass("active");
}

// Call initializeFileInput directly when you want to set up the file input
initializeFileInput();

function validate_UserName() {
    let UserName = $("#txtusername").val();
    if (UserName === null || UserName === "" || UserName === undefined) {
        $("#txtusername").addClass("md-input-filled md-input-danger");
        $("#txtusername").css("border-color", "red");
        //$("#txtusername").focus();
        return false;
    }
    else {
        $("#txtusername").removeClass("md-input-filled md-input-danger");
        $("#txtusername").addClass("md-input-filled md-input-focus");
        $("#txtusername").css("border-color", "");
    }
}
function validate_DefaultLanguage() {
    let DefaultLanguage = $("#ddlDefaultLang").val();
    if (DefaultLanguage === null || DefaultLanguage === "00000000-0000-0000-0000-000000000000" || DefaultLanguage === undefined) {
        $("#ddlDefaultLang").addClass("md-input-filled md-input-danger");
        $("#ddlDefaultLang").css("border-color", "red");
        //$("#ddlDefaultLang").focus();
        return false;
    }
    else {
        $("#ddlDefaultLang").removeClass("md-input-filled md-input-danger");
        $("#ddlDefaultLang").addClass("md-input-filled md-input-focus");
        $("#ddlDefaultLang").css("border-color", "");
    }
}
function validate_Timezone() {
    let Timezone = $("#ddlTimezone").val();
    if (Timezone === null || Timezone === "0" || Timezone === undefined) {
        $("#ddlTimezone").addClass("md-input-filled md-input-danger");
        $("#ddlTimezone").css("border-color", "red");
        //$("#ddlTimezone").focus();
    }
    else {
        $("#ddlTimezone").removeClass("md-input-filled md-input-danger");
        $("#ddlTimezone").addClass("md-input-filled md-input-focus");
        $("#ddlTimezone").css("border-color", "");
    }
}
function validate_FirstName() {
    let FirstName = $("#txtfirstName").val();
    if (FirstName === null || FirstName === "" || FirstName === undefined) {
        $("#txtfirstName").addClass("md-input-filled md-input-danger");
        $("#txtfirstName").css("border-color", "red");
        //$("#txtfirstName").focus();

        return false;
    }
    else {
        $("#txtfirstName").removeClass("md-input-filled md-input-danger");
        $("#txtfirstName").addClass("md-input-filled md-input-focus");
        $("#txtfirstName").css("border-color", "");
    }
}
function validate_lastName() {
    let lastName = $("#txtlastName").val();
    if (lastName === null || lastName === "" || lastName === undefined) {
        $("#txtlastName").addClass("md-input-filled md-input-danger");
        $("#txtlastName").css("border-color", "red");
        // $("#txtlastName").focus();

        return false;
    }
    else {
        $("#txtlastName").removeClass("md-input-filled md-input-danger");
        $("#txtlastName").addClass("md-input-filled md-input-focus");
        $("#txtlastName").css("border-color", "");
    }
}

function validate_Dateformat() {
    let Dateformat = $("#ddlDateformat").val();
    if (Dateformat === null || Dateformat === "0" || Dateformat === undefined) {
        $("#ddlDateformat").addClass("md-input-filled md-input-danger");
        $("#ddlDateformat").css("border-color", "red");
        //$("#ddlDateformat").focus();
        return false;
    }
    else {
        $("#ddlDateformat").removeClass("md-input-filled md-input-danger");
        $("#ddlDateformat").addClass("md-input-filled md-input-focus");
        $("#ddlDateformat").css("border-color", "");
    }
}
function validate_Occupation() {
    let Occupation = $("#txtOccupation").val();
    let sanitizedOccupationVal = Occupation.replace(/[^a-zA-Z\s]/g, "");
    if (Occupation !== sanitizedOccupationVal) {
        $("#txtOccupation").val(sanitizedOccupationVal);
    }
}

function validate_EmailID() {
    var EmailID = $("#txtEmailId").val();
    if (EmailID.trim() === "") {
        $("#txtEmailId").addClass("md-input-filled md-input-danger");
        $("#txtEmailId").css("border-color", "red");
        EmailIDcheck = false;
        return false;
    }
    var $email = $("#txtEmailId").val();
    var re = /[A-Z0-9._%+-]+@[A-Z0-9.-]+.[A-Z]{2,4}/igm;
    if ($email == '' || !re.test($email)) {
        $("#txtEmailId").addClass("md-input-filled md-input-danger");
        $("#txtEmailId").css("border-color", "red");
        return false;
    }
    else {
        $("#txtEmailId").removeClass("md-input-filled md-input-danger");
        $("#txtEmailId").addClass("md-input-filled md-input-focus");
        $("#txtEmailId").css("border-color", "");
        return true;
    }
}
function validate_Password() {
    let password = $("#txtPassword").val();
    if (password.trim() === null || password.trim() === "" || password.trim() === undefined) {
        $("#txtPassword").addClass("md-input-filled md-input-danger");
        $("#txtPassword").css("border-color", "red");
        return false;
    }
    else {
        $("#txtPassword").removeClass("md-input-filled md-input-danger");
        $("#txtPassword").addClass("md-input-filled md-input-focus");
        $("#txtPassword").css("border-color", "");
        return true;
    }
}
function validate_ConfirmPassword() {
    var ConfirmPassword = $("#txtConfirmPassword").val();
    var Password = $("#txtPassword").val();
    if (ConfirmPassword == "") {
        $("#txtConfirmPassword").addClass("md-input-wrapper md-input-filled md-input-danger");
        $("#txtConfirmPassword").css("border-color", "red");
        ConfirmPasswordCheck = false;
        return false;
    }
    else if (ConfirmPassword !== Password) {
        $("#txtConfirmPassword").addClass("md-input-wrapper md-input-filled md-input-danger");
        $("#txtConfirmPassword").css("border-color", "red");
        ConfirmPasswordCheck = false;
        return false;
    }
    else {
        $("#txtConfirmPassword").removeClass("md-input-wrapper md-input-filled md-input-danger");
        $("#txtConfirmPassword").addClass("md-input-wrapper md-input-filled md-input-focus");
        $("#txtConfirmPassword").css("border-color", "");
        return true;
    }
}
function UpdateUserInformation(ctrl) {
    validate_UserName();
    validate_DefaultLanguage();
    validate_Timezone();
    validate_FirstName();
    validate_lastName();
    validate_Dateformat();
    validate_Password();
    validate_EmailID();
    var UserName = $("#txtusername").val().trim();
    var FirstName = $("#txtfirstName").val().trim();
    var LastName = $("#txtlastName").val().trim();
    var Occupation = $("#txtOccupation").val().trim();
    var EmailID = $("#txtEmailId").val();
    var Password = $("#txtPassword").val().trim();
    var Denomination = $("#ddlDenomination").val();
    var DefaultLang = $("#ddlDefaultLang").val();
    var Timezone = $("#ddlTimezone").val();
    var Dateformat = $("#ddlDateformat").val();
    var UserID = $("#hdnUserID").val();
    var IsEnable = $("#EnaThisCom").prop("checked") ? true : false;
    var IsLocked = $("#profile-locked").prop("checked") ? true : false;
    var fileUpload = $("#fileInput").get(0);
    var profileClass = $("#divProfileImage").attr("class");
    var isProfileClass = false;
    if (profileClass !== null && profileClass !== "") {
        isProfileClass = true;
    }
    var data = new FormData();
    data.append("UserName", UserName);
    data.append("FirstName", FirstName);
    data.append("LastName", LastName);
    data.append("ProfileImageClass", profileClass);
    data.append("IsProfileImageClass", isProfileClass);
    data.append("Occupation", Occupation);
    data.append("EmailAddress", EmailID);
    data.append("Password", Password);
    data.append("Denomination", Denomination);
    data.append("LanguageID", DefaultLang);
    data.append("Timezone", Timezone);
    data.append("Dateformat", Dateformat);
    data.append("UserID", UserID);
    data.append("IsLocked", IsLocked);
    data.append("IsEnable", IsEnable);
    if (fileUpload && fileUpload.files.length > 0) {
        var files = fileUpload.files; // Get the selected file(s)

        for (var i = 0; i < files.length; i++) {
            data.append(files[i].name, files[i]);
        }
    }
    if (UserName !== "" && FirstName !== "" && EmailID !== "" &&  Password !== "" && LastName !== "" && DefaultLang !== "00000000-0000-0000-0000-000000000000" && Timezone !== "0" && Dateformat !== "0") {

        $.ajax({
            type: "post",
            url: "/Account/UpdateUserInformation",
            contentType: false,
            processData: false,
            datatype: "json",
            async: false,
            data: data,
            success: function (response) {
                if (response && response.status == 1) {
                    showNotification("success", response.message, "success", true);
                    setTimeout(function () {
                        window.location.href = "/";
                    }, 2000);
                } else {
                    showNotification("error", response.message, 'error', false);
                }
            },

            error: function (error) {
                showNotification("", "Internal server error!", 'error', false);
            }
        });

    }
    else {
        validate_UserName();
        validate_DefaultLanguage();
        validate_Timezone();
        validate_FirstName();
        validate_Dateformat();
        validate_lastName();
        validate_Password();
        validate_EmailID();
    }
}
function openImagePopup() {
    document.getElementById("imagePopup").style.display = "flex";
    document.getElementById("editProfilepopup").style.display = "none";
    $("." + ProfileImageClassActive).removeClass("active");
    $("." + ProfileImageClassActive.replace(/\s+/g, '.')).addClass("active");
}

function closeImagePopup() {
    document.getElementById("imagePopup").style.display = "none";
    document.getElementById("editProfilepopup").style.display = "block";
}

function selectAvatar(avatarClass) {
    // Remove active class from all avatars
    document.getElementById("divImg").style.display = "none";
    document.getElementById("divProfileImage").style.display = "block";
    document.querySelectorAll(".avatar-img-wrap").forEach(avatar => {
        avatar.classList.remove("active");
    });
    // Add active class to selected avatar
    document.querySelector("." + avatarClass).classList.add("active");
    ProfileImageClassActive = avatarClass;
    // Update the profile image background
    document.getElementById("divProfileImage").className = "avatar-img-wrap " + avatarClass;
    // Close the popup
    closeImagePopup();

}

// Add event listener to all avatars
document.querySelectorAll(".avatar-img-wrap").forEach(avatar => {
    avatar.addEventListener("click", function () {
        selectAvatar(this.classList[1]); // Get avatar class (e.g., avatar-1, avatar-2)
    });
});
function Fetch_DDL_Denomination() {
    $("#ddlDenomination").empty().append("<option selected='selected' value='0'>Select Denomination</option>");
    $.ajax({
        url: "/Account/Get_Denomination",
        type: "get",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {},
        success: function (result) {
            $("#ddlDenomination").empty().append("<option selected='selected' value='0'>Select Denomination</option>");
            $.each(result, function (Key, item) {
                $("#ddlDenomination").append($("<option  value=" + item.denomination + ">" + item.denominationName + "</option>"));
            });
        },
        error: function (error) {
            alert(error.responseytype);
        }
    });
}
function Fetch_DDL_DefaultLanguage() {
    //$("#ddlDefaultLang").empty().append("<option selected='selected' value='00000000-0000-0000-0000-000000000000'>Select Language</option>");
    $.ajax({
        url: "/Account/Get_Language",
        type: "get",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {},
        success: function (result) {
            //$("#ddlDefaultLang").empty().append("<option selected='selected' value='00000000-0000-0000-0000-000000000000'>Select Language</option>");
            $.each(result, function (Key, item) {
                $("#ddlDefaultLang").append($("<option  value=" + item.languageID + ">" + item.languageName + "</option>"));
            });
        },
        error: function (error) {
            alert(error.responseytype);
        }
    });
}
function Fetch_DDL_TimeZones() {
    //$("#ddlTimezone").empty().append("<option selected='selected' value='0'>Select Timezone</option>");
    $.ajax({
        url: "/Account/Get_Timezone",
        type: "get",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {},
        success: function (result) {
            // $("#ddlTimezone").empty().append("<option selected='selected' value='0'>Select Timezone</option>");
            $.each(result, function (Key, item) {
                $("#ddlTimezone").append($("<option  value=" + item.timezone + ">" + item.timezoneName + "</option>"));
            });
        },
        error: function (error) {
            alert(error.responseytype);
        }
    });
}
function Fetch_DDL_Dateformat() {
    //$("#ddlDateformat").empty().append("<option selected='selected' value='0'>Select Date Format</option>");
    $.ajax({
        url: "/Account/Get_DateFormat",
        type: "get",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {},
        success: function (result) {
            //$("#ddlDateformat").empty().append("<option selected='selected' value='0'>Select Date Format</option>");
            $.each(result, function (Key, item) {
                $("#ddlDateformat").append($("<option  value=" + item.dateFormat + ">" + item.dateFormatDescription + "</option>"));
            });
        },
        error: function (error) {
            alert(error.responseytype);
        }
    });
}
function GotoDashBoard() {
    window.location.href = '/';
} 
function togglePasswordVisibility() {
    var passwordInput = document.getElementById("txtPassword");
    var passwordEye = document.getElementById("password-addon");

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
    } else {
        passwordInput.type = "password";
    }
}
function ConfirmtogglePasswordVisibility() {
    var passwordInput = document.getElementById("txtConfirmPassword");
    var passwordEye = document.getElementById("Confirmpassword-addon");

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
    } else {
        passwordInput.type = "password";
    }
}

/*************************For New User*****************/
function InsertUserInformation(ctrl) {
    validate_UserName();
    validate_DefaultLanguage();
    validate_Timezone();
    validate_FirstName();
    validate_lastName();
    validate_Dateformat();
    validate_Password();
    validate_EmailID();
    var UserName = $("#txtusername").val().trim();
    var FirstName = $("#txtfirstName").val().trim();
    var LastName = $("#txtlastName").val().trim();
    var Occupation = $("#txtOccupation").val().trim();
    var EmailID = $("#txtEmailId").val();
    var Password = $("#txtPassword").val().trim();
    var Denomination = $("#ddlDenomination").val();
    var DefaultLang = $("#ddlDefaultLang").val();
    var Timezone = $("#ddlTimezone").val();
    var Dateformat = $("#ddlDateformat").val();
    var IsEnable = $("#EnaThisCom").prop("checked") ? true : false;
    var IsLocked = $("#profile-locked").prop("checked")? true : false;
    var fileUpload = $("#fileInput").get(0);
    var profileClass = $("#divProfileImage").attr("class");
    var isProfileClass = false;
    if (profileClass !== null && profileClass !== "") {
        isProfileClass = true;
    }
    var data = new FormData();
    data.append("UserName", UserName);
    data.append("FirstName", FirstName);
    data.append("LastName", LastName);
    data.append("ProfileImageClass", profileClass);
    data.append("IsProfileImageClass", isProfileClass);
    data.append("Occupation", Occupation);
    data.append("EmailAddress", EmailID);
    data.append("Password", Password);
    data.append("Denomination", Denomination);
    data.append("LanguageID", DefaultLang);
    data.append("Timezone", Timezone);
    data.append("Dateformat", Dateformat);
    data.append("IsLocked", IsLocked);
    data.append("IsEnable", IsEnable);
    if (fileUpload && fileUpload.files.length > 0) {
        var files = fileUpload.files; // Get the selected file(s)

        for (var i = 0; i < files.length; i++) {
            data.append(files[i].name, files[i]);
        }
    }
    if (UserName !== "" && FirstName !== "" && EmailID !== "" && Password !== "" && LastName !== "" && DefaultLang !== "00000000-0000-0000-0000-000000000000" && Timezone !== "0" && Dateformat !== "0") {

        $.ajax({
            type: "post",
            url: "/Account/InsertNewUserInformation",
            contentType: false,
            processData: false,
            datatype: "json",
            async: false,
            data: data,
            success: function (response) {
                if (response && response.status == 1) {
                    showNotification("success", response.message, "success", true);
                    setTimeout(function () {
                        window.location.href = "/";
                    }, 2000);
                } else {
                    showNotification("error", response.message, 'error', false);
                }
            },

            error: function (error) {
                showNotification("", "Internal server error!", 'error', false);
            }
        });

    }
    else {
        validate_UserName();
        validate_DefaultLanguage();
        validate_Timezone();
        validate_FirstName();
        validate_Dateformat();
        validate_lastName();
        validate_Password();
        validate_EmailID();
    }
}
function manageUserProfile() {
    var UserID = $("#hdnUserID").val();
    $.ajax({
        type: "POST",
        url: "/Account/ManageUserProfile",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: { UserID: UserID }, 
        success: function (response) {
            if (response != null && response != undefined && response != '') {
                $("#txtusername").val(response.data.userName);
                $("#txtfirstName").val(response.data.firstName);
                $("#txtlastName").val(response.data.lastName);
                $("#txtOccupation").val(response.data.occupation);
                $("#txtEmailId").val(response.data.emailAddress);
                $("#txtPassword").val(response.data.password);
                $("#txtConfirmPassword").val(response.data.password);
                $("#profile-locked").prop("checked", response.data.isLocked === true);
                $("#EnaThisCom").prop("checked", response.data.isEnable === true);
                if (response.data.userID === response.data.accountUserID) {
                    document.getElementById("btnDelete").style.display = "none";
                    document.querySelector(".ManageProfileSettings").style.display = "none";
                }
                else {
                    document.getElementById("btnDelete").style.display = "block";
                    document.querySelector(".ManageProfileSettings").style.display = "block";
                }
                setTimeout(function () {
                    $("#ddlDenomination").val(response.data.denomination);
                    if (response.data.timezone !== null && response.data.timezone !== undefined && response.data.timezone !== '' && response.data.timezone !== 0)
                        $("#ddlTimezone").val(response.data.timezone);
                    else
                        $("#ddlTimezone").val(5);
                    if (response.data.dateFormat !== null && response.data.dateFormat !== undefined && response.data.dateFormat !== '' && response.data.dateFormat !== 0)
                        $("#ddlDateformat").val(response.data.dateFormat);
                    else
                        $("#ddlDateformat").val(1);
                    if (response.data.languageID !== null && response.data.languageID !== undefined && response.data.languageID !== '' && response.data.languageID !== "00000000-0000-0000-0000-000000000000")
                        $("#ddlDefaultLang").val(response.data.languageID);
                    else
                        $("#ddlDefaultLang").val('3afc5072-4af1-46b4-a9fa-31ae65941524');
                }, 1500);
                var profileImage = response.data.profileImage;
                var profileImagePath = response.data.profileImagePath;
                var profileImage = response.data.profileImage || "";
                var profileImagePath = response.data.profileImagePath || "";
                var profileImageClass = response.data.profileImageClass || "";
                var defaultImage = "/Images/user-icon.jpg"; // Default image path
                ProfileImageClassActive = profileImageClass;
                var divImg = document.getElementById("divImg");
                var profileImageElement = $("#ProfileImage");
                var divProfileImage = $("#divProfileImage");

                // Check if profileImage is a file (has "/") or profileImagePath is not empty
                if ((profileImage && profileImage.includes("/")) || (profileImagePath && profileImage)) {
                    // Construct the full image path
                    var fullImagePath = profileImagePath && profileImage ? profileImagePath + "/" + profileImage : defaultImage;

                    // Check if the image exists
                    if (imageExists(fullImagePath)) {
                        divImg.style.display = "block"; // Show the image div
                        profileImageElement.attr("src", fullImagePath).show(); // Show the image
                        divProfileImage.hide(); // Hide the avatar div
                    } else {
                        // If the image doesn't exist, show the default image
                        divImg.style.display = "block";
                        profileImageElement.attr("src", defaultImage).show();
                        divProfileImage.hide(); // Hide the avatar div
                    }
                } else if (profileImageClass) {
                    // If image is not available, check for avatar class
                    divProfileImage.removeAttr("src").removeClass().addClass(profileImageClass).show();
                    profileImageElement.hide(); // Hide the image element
                } else {
                    divImg.style.display = "block";
                    profileImageElement.attr("src", defaultImage).show();
                    divProfileImage.hide();
                }
            } else {
                alert("Oops! Something went wrong.");
            }
        },

        error: function (error) {
            console.log("Error in response");
            ;
        }
    });
}
//Hide delete popup.
function hideDeletePopup() {
    $("#DeleteMessagePopup").hide();
    currentMemoryID = null;
}
//Show delete popup.
function showDeleteProfilePopup() {
    $("#DeleteMessagePopup").show();
}
//Delete memory data.
function DeleteUserProfile() {
    var UserID = $("#hdnUserID").val();
    if (UserID == null) {
        alert("No user for deletion.");
        return;
    }

    $.ajax({
        type: "POST",
        url: "/Account/DeleteUserProfile",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            UserID: UserID
        },
        success: function (response) {
            $("#DeleteMessagePopup").hide();
            if (response != null) {
                if (response.msg == "Success") {
                    showNotification("success", "user profile  delete Successfully!", "success", true);
                    setTimeout(function () {
                        window.location.href = "/";
                    }, 2000);

                }
                else {
                    showNotification("", "Failed to delete user profile!", "error", false);
                }

            }
        },
        error: function (error) {
            alert(error);
        }
    });
}


