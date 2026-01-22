$(document).ready(function () {
    ClearAll();
    $(".keypress-handler").on("keypress", function (event) {
        if (event.key === "Enter" || event.keyCode === 13) {
            if ($("#txtEmailAddress").val().trim() !== "" || $("#txtPassword").val().trim() !== "") {
                Login();
            }
        }
    });
    BindTestimonies();
});

$("#txtPassword").keydown(function (e) {

    if (e.keyCode == 13) {
        var EmailID = $("#txtEmailId").val();
        var Password = $("#txtPassword").val();
        if (Password !== "" && EmailID !== "") {
            Login();
        }
    }
});

function Login() {
    $.ajax({
        type: "post",
        url: "/Account/GetUserInformation",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: false,
        data: {
            "EmailAddress": $("#txtEmailAddress").val().trim(),
            "Password": $("#txtPassword").val().trim(),
            "RememberMe": $("#chkRememberMe").prop("checked")
        },
        success: function (response) {
            if (response != null) {
                if (response.status == "1") {
                    ClearAll();
                    setTimeout(function () {
                        window.location.href = "/";
                    }, 100);
                }
                else {
                    showNotification('', response.message, 'error', false);
                }
                if (response.focus != "") {
                    $("#" + response.focus).focus();
                }
            }
            else {
                showNotification('', "Please enter valid login credentials!", 'error', false);
            }
        },
        error: function (error) {
            showNotification('', error.responsetype, 'error', false);
        }
    });
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
                        htmlTest += '          <div class="mt-3 pt-3 pb-3">                                      ';
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
            //alert(error.responsetype);
        }
    });
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

function ClearAll() {
    $("#txtEmailAddress").val("");
    $("#txtPassword").val("");
    $("#txtEmailAddress").focus();
}
