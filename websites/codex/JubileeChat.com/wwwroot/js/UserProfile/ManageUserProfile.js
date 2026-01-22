$(document).ready(function () {
    ManagerUserProfile();
});
//Open user edit profile page.
function editProfile() {
    window.location.href = "/EditProfile";
}
function createProfile() {
    window.location.href = "/CreateProfile";
}




function GotoDashBoard() {
    window.location.href = '/';
} 
//******************************************For Manage Profile*************/
function ManagerUserProfile() {
    $.ajax({
        type: "POST",
        url: "/Account/Get_ManageProfile",
        contentType: "application/json;charset=utf-8",
        dataType: "json",
        async: true,
        success: function (response) {
            if (response) {
                let userProfiles = response|| []; // Get user profiles array
                bindAvatars(userProfiles); // Call function to bind avatars
            } else {
                alert("Oops! Something went wrong.");
            }
        },
        error: function (error) {
            console.log("Error in response", error);
        }
    });
}

// Function to bind avatars dynamically


let userProfiles = [];

//function bindAvatars(profiles) {
//    userProfiles = profiles; // Assign profiles to the global variable
//    let maxProfiles = 5;
//    let avatarContainer = document.querySelector(".avatar-main-wrap");
//    avatarContainer.innerHTML = "";

//    let defaultImage = "/images/users-add-profile.svg";

//    for (let i = 0; i < maxProfiles; i++) {
//        let avatarWrap = document.createElement("div");
//        avatarWrap.classList.add("avatar-wrap");
//        //avatarWrap.classList.add("default-image");

//        if (userProfiles[i]) {
//            let avatarImgWrap = document.createElement("div");
//            //avatarImgWrap.classList.add("default-image");
//            avatarImgWrap.classList.add("avatar-img-wrap");

//            let fullClassString = userProfiles[i].profileImageClass || "";
//            fullClassString.split(" ").forEach(cls => {
//                if (cls.trim()) {
//                    avatarImgWrap.classList.add(cls);
//                }
//            });

//            if (userProfiles[i].profileImage && userProfiles[i].profileImagePath) {
//                let fullImagePath = `${userProfiles[i].profileImagePath}/${userProfiles[i].profileImage}`;
//                let avatarImg = document.createElement("img");
//                avatarImg.src = fullImagePath;

//                avatarImg.style.width = "140px";
//                avatarImg.style.height = "140px";
//                avatarImg.style.borderRadius = "50%";
//                avatarImg.style.border = "2px solid #ddd";

//                avatarImgWrap.appendChild(avatarImg);
//            }

//            let avatarName = document.createElement("div");
//            avatarName.classList.add("avatar-name");
//            avatarName.textContent = userProfiles[i].userName;

//            avatarWrap.appendChild(avatarImgWrap);
//            avatarWrap.appendChild(avatarName);

//            // Bind click event to each avatar
//            avatarImgWrap.addEventListener("click", function () {
//                setActiveProfile(this, userProfiles[i]); // Pass user data
//            });

//            // Set first user as active by default
//            if (i === 0) {
//                setActiveProfile(avatarImgWrap, userProfiles[i]);
//            }
//        } else {
//            let addProfileWrap = document.createElement("div");
//            addProfileWrap.classList.add("add-profile-wrap");

//            let addProfile = document.createElement("div");
//            addProfile.classList.add("add-profile");
//            addProfile.setAttribute("onclick", "createProfile()");

//            let addImg = document.createElement("img");
//            addImg.src = defaultImage;

//            addProfile.appendChild(addImg);
//            addProfileWrap.appendChild(addProfile);
//            avatarWrap.appendChild(addProfileWrap);

//            let avatarName = document.createElement("div");
//            avatarName.classList.add("avatar-name");
//            avatarName.textContent = "Add New";

//            avatarWrap.appendChild(avatarName);
//        }

//        avatarContainer.appendChild(avatarWrap);
//    }
//}

function bindAvatars(profiles) {
    userProfiles = profiles; // Assign profiles to the global variable
    let maxProfiles = 5;
    let avatarContainer = document.querySelector(".avatar-main-wrap");
    avatarContainer.innerHTML = "";

    let defaultImage = "/images/users-add-profile.svg";

    for (let i = 0; i < maxProfiles; i++) {
        let avatarWrap = document.createElement("div");
        avatarWrap.classList.add("avatar-wrap");

        if (userProfiles[i]) {
            let avatarImgWrap = document.createElement("div");
            avatarImgWrap.classList.add("avatar-img-wrap");

            let fullClassString = userProfiles[i].profileImageClass || "";

            if (fullClassString.trim() === "") {
                avatarImgWrap.classList.add("default-image");
            } else {
                fullClassString.split(" ").forEach(cls => {
                    if (cls.trim()) {
                        avatarImgWrap.classList.add(cls);
                    }
                });
            }

            if (userProfiles[i].profileImage && userProfiles[i].profileImagePath) {
                let fullImagePath = `${userProfiles[i].profileImagePath}/${userProfiles[i].profileImage}`;
                let avatarImg = document.createElement("img");
                avatarImg.src = fullImagePath;

                avatarImg.style.width = "140px";
                avatarImg.style.height = "140px";
                avatarImg.style.borderRadius = "50%";
                avatarImg.style.border = "2px solid #ddd";

                avatarImgWrap.appendChild(avatarImg);
            }

            let avatarName = document.createElement("div");
            avatarName.classList.add("avatar-name");
            avatarName.textContent = userProfiles[i].userName;

            avatarWrap.appendChild(avatarImgWrap);
            avatarWrap.appendChild(avatarName);

            // Bind click event to each avatar
            avatarImgWrap.addEventListener("click", function () {
                setActiveProfile(this, userProfiles[i]); // Pass user data
            });

            // Set first user as active by default
            if (i === 0) {
                setActiveProfile(avatarImgWrap, userProfiles[i]);
            }
        } else {
            let addProfileWrap = document.createElement("div");
            addProfileWrap.classList.add("add-profile-wrap");

            let addProfile = document.createElement("div");
            addProfile.classList.add("add-profile");
            addProfile.setAttribute("onclick", "createProfile()");

            let addImg = document.createElement("img");
            addImg.src = defaultImage;

            addProfile.appendChild(addImg);
            addProfileWrap.appendChild(addProfile);
            avatarWrap.appendChild(addProfileWrap);

            let avatarName = document.createElement("div");
            avatarName.classList.add("avatar-name");
            avatarName.textContent = "Add New";

            avatarWrap.appendChild(avatarName);
        }

        avatarContainer.appendChild(avatarWrap);
    }
}


// Function to set active profile
function setActiveProfile(element, user) {
    if (!user) return; 
    document.querySelectorAll(".avatar-img-wrap").forEach((profile) => {
        profile.classList.remove("active");
    });
    element.classList.add("active");

    // Update hidden fields with selected user details
    $("#hdnUserID").val(user.userID);
    $("#hdnEmailAdress").val(user.emailAddress);
    $("#hdnPassword").val(user.password);
}
function editProfile() {
    var userID = $("#hdnUserID").val();
    if (userID) {
        window.location.href = "/ManageUsersProfile?UserID=" + encodeURIComponent(userID);
    } 
}

function SwitichToUser() {
    var EmailAdress = $("#hdnEmailAdress").val();
    var Password = $("#hdnPassword").val();
    var RememberMe = true;
    $.ajax({
        url: "/Account/GetUserInformation",
        type: "POST",
        data: { EmailAddress: EmailAdress, Password: Password, RememberMe: RememberMe },
        success: function (response) {
            if (response != null) {
                if (response.status == "1") {
                    setTimeout(function () {
                        window.location.href = "/";
                    }, 100);
                }
                else {
                    showNotification("", "This profile is currently locked or disabled!", "error", false);
                }
            }
        },
        error: function (error) {
            console.error("Error:", error);
        }
    });
}




