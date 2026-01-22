$(document).ready(function () {
    const domainName = window.location.hostname;

    ClearAll();
    //$("#txtUserName").keyup(function () {
    //    validate_FirstName();
    //});
    //$("#txtEmailId").keyup(function () {
    //    validate_EmailID();
    //});
    //$("#txtPassword").keyup(function () {
    //    validate_Password();
    //});

    BindTestimonies();

    $("#txtConfirmPassword").keyup(function () {
        validate_ConfirmPassword();
    });

    $("#txtoldPassword").keyup(function () {
        validate_OldPassword();
    });

    $("#txtPassword").keydown(function (e) {
        if (e.keyCode == 13) {
            validate_FirstName();
            validate_EmailID();
            validate_Password();
            var UserName = $("#txtUserName").val();
            var EmailID = $("#txtEmailId").val();
            var Password = $("#txtPassword").val();
            if (Password !== "" && UserName !== "" && EmailID !== "") {
                SignUp(this);

            }
            else {
                validate_FirstName();
                validate_EmailID();
                validate_Password();
            }

        }
    });

    $("#txtConfirmPassword").keydown(function (e) {

        if (e.keyCode == 13) {
            var NewPassword = $("#txtPassword").val();
            var ConfirmPassword = $("#txtConfirmPassword").val();
            if (NewPassword !== "" && ConfirmPassword !== "") {
                if (NewPassword === ConfirmPassword) {
                    UpdatePassword();
                }
                else {
                    validate_Password();
                }
            }

        }
    });
    $("#txtEmailId").keydown(function (e) {

        if (e.keyCode == 13) {
            validate_EmailID();
            var EmailID = $("#txtEmailId").val();
            if (EmailID !== "") {
                ForgetPassword();
            }
            else {
                validate_EmailID();
            }
        }
    });

    var OldPassword = $("#txtoldPassword").val();
    var NewPassword = $("#txtPassword").val();
    var ConfirmPassword = $("#txtConfirmPassword").val();

    $("#txtoldPassword").keyup(function (e) {
        if (e.keyCode == 13) {
            if ($("#txtoldPassword").val().trim() !== "") {
                $("#txtPassword").focus();
            } else {
                validate_OldPassword();
                validate_Password();
                validate_ConfirmPassword();
            }
        }
    });
    $("#txtPassword").keyup(function (e) {
        if (e.keyCode == 13) {
            if ($("#txtPassword").val().trim() !== "") {
                $("#txtConfirmPassword").focus();
            } else {
                validate_Password();
                validate_ConfirmPassword();
            }
        }
    });
    $("#txtConfirmPassword").keyup(function (e) {
        if (e.keyCode == 13) {
            if ($("#txtConfirmPassword").val().trim() !== "") {
                ResetPassword();
            } else {
                validate_ConfirmPassword();
            }
        }
    });

    $("#txtDiscountCode").keyup(function () {
        validate_DiscountCode();
    });
});

function ClearAll() {
    $("#txtUserName").val("");
    $("#txtEmailId").val("");
    $("#txtPassword").val("");
    $("#txtUserName").focus();
}

function checkShowHideDiscountCode(ctrl) {
    const divDiscountCode = document.getElementById("divDiscountCode");
    if ($(ctrl).prop("checked")) {
        if (divDiscountCode) {
            divDiscountCode.style.display = "";
        }
    } else {
        if (divDiscountCode) {
            divDiscountCode.style.display = "none";
        }
    }
}

function checkEnableDisable(ctrl) {
    // Check if the checkbox is checked
    if ($(ctrl).prop("checked")) {
        $("#divSignUp").removeClass("disabled");
    } else {
        $("#divSignUp").addClass("disabled");
    }
}

//function validate_FirstName() {
//    let UserName = $("#txtUserName").val();
//    if (UserName === null || UserName === "" || UserName === undefined) {
//        $("#FirstNameError").show();
//        $("#txtUserName").addClass("md-input-filled md-input-danger");
//        $("#FirstNameError").html("<span>Please enter user name</span>");
//        $("#FirstNameError").css("color", "red");
//        $("#FirstNameError").focus();
//        return false;
//    }
//    else {
//        $("#txtUserName").removeClass("md-input-filled md-input-danger");
//        $("#txtUserName").addClass("md-input-filled md-input-focus");
//        $("#FirstNameError").hide();
//    }
//}

function validate_FirstName() {
    let UserName = $("#txtUserName").val().trim();
    let namePattern = /^[A-Za-z]+( [A-Za-z]+)*(\s*[A-Za-z]+)*$/; // Allows double or more spaces between words

    if (UserName === null || UserName === "" || UserName === undefined) {
        $("#FirstNameError").show();
        $("#txtUserName").addClass("md-input-filled md-input-danger");
        $("#FirstNameError").html("<span>Please enter user name</span>");
        $("#FirstNameError").css("color", "red");
        $("#txtUserName").focus();
        return false;
    }
    else if (!namePattern.test(UserName)) {
        $("#FirstNameError").show();
        $("#txtUserName").addClass("md-input-filled md-input-danger");
        $("#FirstNameError").html("<span>Only alphabets are allowed</span>");
        $("#FirstNameError").css("color", "red");
        $("#txtUserName").focus();
        return false;
    }
    else {
        $("#txtUserName").removeClass("md-input-danger").addClass("md-input-focus");
        $("#FirstNameError").hide();
        return true;
    }
}




function validate_EmailID() {
    var EmailID = $("#txtEmailId").val();
    if (EmailID.trim() === "") {
        $("#txtEmailIdError").show();
        $("#txtEmailId").addClass("md-input-filled md-input-danger");
        $("#txtEmailIdError").html("<span>Please enter  email id </span>");
        $("#txtEmailIdError").css("color", "red");
        $("#txtEmailIdError").focus();
        EmailIDcheck = false;
        return false;
    }
    var $email = $("#txtEmailId").val();
    var re = /[A-Z0-9._%+-]+@[A-Z0-9.-]+.[A-Z]{2,4}/igm;
    if ($email == '' || !re.test($email)) {
        $("#txtEmailIdError").show();
        $("#txtEmailId").addClass("md-input-filled md-input-danger");
        $("#txtEmailIdError").html("<span>Please enter  valid email id </span>");
        $("#txtEmailIdError").css("color", "red");
        $("#txtEmailIdError").focus();
        return false;
    }
    else {
        $("#txtEmailId").removeClass("md-input-filled md-input-danger");
        $("#txtEmailId").addClass("md-input-filled md-input-focus");
        $("div").removeClass("uk-input-group-danger");
        $("#txtEmailIdError").hide();
        return true;
    }
}

//function validate_Password() {
//    let password = $("#txtPassword").val();
//    if (password.trim() === null || password.trim() === "" || password.trim() === undefined) {
//        $("#PasswordError").show();
//        $("#txtPassword").addClass("md-input-filled md-input-danger");
//        $("#PasswordError").html("<span>Please enter a password value</span>");
//        $("#PasswordError").css("color", "red");
//        $("#PasswordError").focus();
//        return false;
//    }
//    else {
//        $("#txtPassword").removeClass("md-input-filled md-input-danger");
//        $("#txtPassword").addClass("md-input-filled md-input-focus");
//        $("#PasswordError").hide();
//    }
//}

function validate_Password() {
    let password = $("#txtPassword").val().trim();

    if (!password) {
        $("#PasswordError").show();
        $("#txtPassword").addClass("md-input-filled md-input-danger");
        $("#PasswordError").html("<span>Please enter a password</span>");
        $("#PasswordError").css("color", "red");
        $("#txtPassword").focus();
        return false;
    } else if (password.length < 6) {
        $("#PasswordError").show();
        $("#txtPassword").addClass("md-input-filled md-input-danger");
        $("#PasswordError").html("<span>Password must be at least 6 characters long</span>");
        $("#PasswordError").css("color", "red");
        $("#txtPassword").focus();
        return false;
    } else {
        $("#txtPassword").removeClass("md-input-danger");
        $("#txtPassword").addClass("md-input-filled md-input-focus");
        $("#PasswordError").hide();
        return true;
    }
}

function validate_DiscountCode() {
    let DiscountCode = $("#txtDiscountCode").val();
    let discountcheck = document.getElementById("discountcode-check");
    if (discountcheck.checked) {
        if (DiscountCode === null || DiscountCode === "" || DiscountCode === undefined) {
            $("#txtDiscountCodeError").show();
            $("#txtDiscountCode").addClass("md-input-filled md-input-danger");
            $("#txtDiscountCodeError").html("<span>Please enter discount code</span>");
            $("#txtDiscountCodeError").css("color", "red");
            $("#txtDiscountCodeError").focus();
            return false;
        }
        else {
            $("#txtDiscountCode").removeClass("md-input-filled md-input-danger");
            $("#txtDiscountCode").addClass("md-input-filled md-input-focus");
            $("#txtDiscountCodeError").hide();
        }
    }
}

function SignUp(ctrl) {
    var validateName =  validate_FirstName();
    var validateEmail = validate_EmailID();
    var validatePassword = validate_Password(); 
    
    validate_DiscountCode();
    var UserName = $("#txtUserName").val();
    var name = UserName.split(' ');

    if (name.length > 0) {
        var FirstName = name[0];
        var LastName = name.length > 1 ? name[1] : ""; // Handles cases where there's only a first name
    }

    if (!validateName) {
        return;
    }
    if (!validateEmail) {
        return;
    }
    if (!validatePassword) {
        return;
    }

    var EmailID = $("#txtEmailId").val();
    var Password = $("#txtPassword").val();
    var DiscountCode = $("#txtDiscountCode").val();

    var data = new FormData();
    data.append("FirstName", FirstName);
    data.append("LastName", LastName);
    data.append("UserName", UserName);
    data.append("EmailAddress", EmailID);
    data.append("Password", Password);
    data.append("DiscountCode", DiscountCode);
    data.append("IsDiscountCode", $("#discountcode-check").is(":checked"))
    data.append("IsTermCondition", $("#chkAgree").is(":checked"))

    if (UserName !== "" && EmailID !== "" && Password !== "") {
        let DiscountCode = $("#txtDiscountCode").val();
        let discountcheck = document.getElementById("discountcode-check");
        if (discountcheck.checked && DiscountCode == '') {
            validate_DiscountCode();
            return false;
        }
        var agreeCheckbox = document.getElementById('chkAgree');
        if (!agreeCheckbox.checked) {
            showNotification('', "Please agree to the terms and conditions.", 'error', false);
            $("#chkAgree").focus();
            return false;
        }
        $.ajax({
            type: "post",
            url: "/Account/InsertUserInformation",
            contentType: false,
            processData: false,
            datatype: "json",
            async: false,
            data: data,
            success: function (response) {
                if (response.Status == 1) {
                    ClearAll();
                    setTimeout(function () {
                        window.location.href = "/";
                    }, 100);
                }
                else {
                    showNotification('', response.Message, 'error', false);
                }
                if (response.Focus != "")
                    $("#" + response.Focus).focus();
            },
            error: function (error) {
                showNotification("", "Internal server error!", 'error', false);
            }
        });

    }
    else {
        validate_FirstName();
        validate_EmailID();
        validate_Password();
    }
}
function ShowPopup(id) {
    var myElement = document.getElementById(id);

    if (myElement.style.display === "none") {
        myElement.style.display = "block";
    } else {
        myElement.style.display = "none";
    }
}

function redirect_Page(pageName) {
    window.location.href = '/' + pageName;
}

function ClosePopup(id) {
    var myElement = document.getElementById(id);

    if (myElement.style.display === "block") {
        myElement.style.display = "none";
    } else {
        myElement.style.display = "block";
    }
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

function BindTestimonies() {
    $.ajax({
        type: "post",
        url: "/Account/BindTestimonies",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: false,
        data: {},
        success: function (response) {
            if (response != null && response.length > 0) {
                if (response[0].status == "1") {
                    var htmlTest = "";
                    var htmlCarouselBtn = "";
                    var length = response.length;
                    for (var i = 0; i < length; i++) {
                        if (i == 0)
                            htmlCarouselBtn += '<button type="button" data-bs-target="#reviewcarouselIndicators" data-bs-slide-to="' + i + '" class="active" aria-label="Slide ' + i + '" aria-current="true"></button>';
                        else
                            htmlCarouselBtn += '<button type="button" data-bs-target="#reviewcarouselIndicators" data-bs-slide-to="' + i + '" aria-label="Slide ' + i + '"></button>';

                        if (i == 0)
                            htmlTest += ' <div class="carousel-item active">                                     ';
                        else
                            htmlTest += ' <div class="carousel-item">                                            ';
                        htmlTest += '      <div class="testi-contain text-white">                                ';
                        /* htmlTest += '          <i class="bx bxs-quote-alt-left text-success display-6"></i>      ';*/
                        htmlTest += '          <h4 class="mt-4 fw-medium lh-base text-white">                    ';
                        htmlTest += response[i].testimonyText;
                        htmlTest += '          </h4>                                                             ';
                        htmlTest += '          <div class="mt-4 pt-3 pb-3">                                      ';
                        htmlTest += '              <div class="d-flex align-items-start">                        ';
                        htmlTest += '                  <div class="flex-grow-1 mb-4">                            ';
                        htmlTest += '                      <h5 class="font-size-24 color-orange">                  ';
                        htmlTest += response[i].testimonyName;
                        htmlTest += '                      </h5>                                                 ';
                        htmlTest += '                      <p class="mb-0 text-white-50">' + response[i].testimonyCityState + '</p>       ';
                        htmlTest += '                  </div>                                                    ';
                        htmlTest += '              </div>                                                        ';
                        htmlTest += '          </div>                                                            ';
                        htmlTest += '      </div>                                                                ';
                        htmlTest += '  </div>                                                                    ';
                    }

                    $("#divCarouselBtn").html(htmlCarouselBtn);
                    $("#divCrausal").html(htmlTest);
                }
            }
        },
        error: function (error) {
        }
    });
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

function ForgetPassword() {
    var EmailID = $("#txtEmailId").val();
    if (EmailID !== "") {
        $.ajax({
            type: "post",
            url: "/Account/Sent_Forget_Password_Mail",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            data: { "EmailID": EmailID },
            success: function (result) {
                if (result != undefined && result != null)
                    if (result.Status == "1") {
                        $("#divSuccespassword").show();
                        $("#spnemailaddress").html(EmailID);
                        $("#divforgetpassword").hide();
                    } else {
                        showNotification("", result.Msg, 'error', false);
                    }
            },
            error: function (error) {
                showNotification("", "Internal server error!", 'error', false);
            }
        });
    }
    else {
        validate_EmailID();
    }
}

function OldtogglePasswordVisibility() {
    var passwordInput = document.getElementById("txtoldPassword");
    var passwordEye = document.getElementById("oldpassword-addon");

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
    } else {
        passwordInput.type = "password";
    }
}

function validate_ConfirmPassword() {
    var ConfirmPassword = $("#txtConfirmPassword").val();
    var Password = $("#txtPassword").val();
    if (ConfirmPassword == "") {
        $("#ConfirmPasswordError").show();
        $("#txtConfirmPassword").addClass("md-input-wrapper md-input-filled md-input-danger");
        $("#ConfirmPasswordError").html("<span> Your password and confirm password should not be match !</span>");
        $("#ConfirmPasswordError").css("color", "red");
        $("#ConfirmPasswordError").focus();
        ConfirmPasswordCheck = false;
        return false;
    }
    else if (ConfirmPassword !== Password) {
        $("#ConfirmPasswordError").show();
        $("#txtConfirmPassword").addClass("md-input-wrapper md-input-filled md-input-danger");
        $("#ConfirmPasswordError").html("<span> Your password and confirm password should not be match !</span>");
        $("#ConfirmPasswordError").css("color", "red");
        $("#ConfirmPasswordError").focus();
        ConfirmPasswordCheck = false;
        return false;
    }
    else {
        $("#txtConfirmPassword").removeClass("md-input-wrapper md-input-filled md-input-danger");
        $("#txtConfirmPassword").addClass("md-input-wrapper md-input-filled md-input-focus");
        $("#ConfirmPasswordError").hide();
        return true;
    }
}

function UpdatePassword() {
    var NewPassword = $("#txtPassword").val();
    var ConfirmPassword = $("#txtConfirmPassword").val();
    var urlString = window.location.href;
    // Creating a URL object
    var url = new URL(urlString);
    // Getting the value of the TokenID parameter
    var TokenID = urlString.split('/')[5].split('=')[1];
    if (NewPassword !== "" && ConfirmPassword !== "") {
        if (NewPassword === ConfirmPassword) {
            $.ajax({
                type: "post",
                url: "/Account/UpdatePassword",
                contenttype: "application/json;charset=utf-8",
                datatype: "json",
                data: { "NewPassword": NewPassword, "TokenID": TokenID },
                success: function (result) {
                    if (result.status === "1") {
                        showNotification("", result.msg, 'success', false);
                        setTimeout(function () {
                            window.location.href = "/SignIn";
                        }, 2500);
                    } else {
                        showNotification("", result.msg, 'error', false);
                    }
                },
                error: function () {
                    showNotification("", "Internal server error!", 'error', false);
                }
            });
        }
    }
    else {
        validate_Password();
    }
}

function validate_OldPassword() {
    let password = $("#txtoldPassword").val();

    if (password.trim() === null || password.trim() === "" || password.trim() === undefined) {
        $("#OldPasswordError").show();
        $("#txtoldPassword").addClass("md-input-filled md-input-danger");
        $("#OldPasswordError").html("<span>Please enter a old password value</span>");
        $("#OldPasswordError").css("color", "red");
        $("#OldPasswordError").focus();
        return false;
    }
    else {
        $("#txtoldPassword").removeClass("md-input-filled md-input-danger");
        $("#txtoldPassword").addClass("md-input-filled md-input-focus");
        $("#OldPasswordError").hide();
    }
}

function ResetPassword() {
    var OldPassword = $("#txtoldPassword").val();
    var NewPassword = $("#txtPassword").val();
    var ConfirmPassword = $("#txtConfirmPassword").val();
    if (NewPassword !== "" && ConfirmPassword !== "") {
        if (NewPassword === ConfirmPassword) {
            $.ajax({
                type: "post",
                url: "/Account/ChangePassword",
                contenttype: "application/json;charset=utf-8",
                datatype: "json",
                data: { "NewPassword": NewPassword, "OldPassword": OldPassword },
                success: function (result) {
                    if (result.status === "1") {
                        showNotification('', result.msg, 'success', false);
                        setTimeout(function () {
                            window.location.href = "/SignIn";
                        }, 2000)
                    }
                    else {
                        showNotification('', result.msg, 'error', false);
                    }
                },
                error: function () {
                    showNotification("", "Internal server error!", 'error', false);
                }
            });
        }
    }
    else {
        validate_Password();
        validate_OldPassword();
    }

}
