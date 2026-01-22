$(document).ready(function () {

    let now = new Date();
    let month = String(now.getUTCMonth() + 1).padStart(2, '0'); // Months are 0-based
    let day = String(now.getUTCDate()).padStart(2, '0');
    let year = now.getUTCFullYear();

    let formattedDate = `${month}/${day}/${year}`;

    $("#chargeDate").val(formattedDate);

    $("#txtDescription").val("Recharge 0 Token");

    FetchTokenDetails();

    setTimeout(function () {
        let amount = parseFloat($("#txtAmount").val().trim());
        if (!isNaN(amount) && amount > 0) {
            CalculateToken();
        }
    }, 400)

    $("#txtAmount").on("input", function () {
        $("#txtAmount").css("border", "2px solid #979797");
        CalculateToken()
    });

    // Format on blur to always show two decimal places
    $("#txtAmount").on("blur", function () {
        let amount = parseFloat($(this).val()).toFixed(2);
        if (isNaN(amount)) amount = "0.00";
        $(this).val(amount);
    });

    $(document).on("keydown", function (event) {
        if (event.key === "Enter") {
            RechargeTokens();
        }
    });



    $("#paymentForm").submit(function (e) {
        var amount = parseFloat($("#txtAmount").val());

        if (isNaN(amount) || amount <= 0) {
            e.preventDefault(); // Prevent form submission
            $("#txtAmount").css("border", "2px solid red");
        } else {
            $("#txtAmount").css("border", ""); // Reset border if valid
        }
    });



});


function CalculateToken() {
    let inputVal = $("#txtAmount").val();

    // Allow only numbers and a single decimal point
    if (!/^\d*\.?\d{0,2}$/.test(inputVal)) {
        //$("#txtAmount").val(inputVal.slice(0, -1)); // Remove the last invalid character
        $("#txtAmount").val(inputVal.match(/^\d*\.?\d{0,2}/)?.[0] || "");
        return;
    }

    let amount = parseFloat(inputVal);
    if (isNaN(amount)) {
        amount = 0.00;
    }

    let tokens = parseFloat($("#txtTokens").val()) || 0;
    let planPrice = parseFloat($("#txtPlanPrice").val()) || 1;

    let tokenValue = (amount * tokens) / planPrice;

    $("#txtTokenvalue").val(Math.ceil(tokenValue));

    if (tokenValue > 0) {
        $("#txtDescription").val("Recharge " + Math.ceil(tokenValue).toLocaleString('en-US') + " Tokens");
    } else {
        $("#txtDescription").val("Recharge 0 Token");
    }
}
function GotoDashBoard() {
    window.location.href = '/';
}
//function RechargeTokens() {
//    let amount = parseFloat($("#txtAmount").val());
//    let tokenValue = $("#txtTokenvalue").val();

//    if (amount > 0) {
//        let btnText = document.getElementById("btnText");
//        let btnSpinner = document.getElementById("btnSpinner");
//        let continueBtn = document.getElementById("continueBtn");

//        // Disable button and show loading spinner
//        continueBtn.disabled = true;
//        continueBtn.style.pointerEvents = "none";
//        continueBtn.style.opacity = "0.5";
//        btnText.textContent = "Processing...";
//        btnSpinner.style.display = "inline-block";

//        let tokenRecharge = {
//            Amount: amount,
//            Tokens: tokenValue
//        };

//        $.ajax({
//            type: "POST",
//            url: "/Subscription/OneTimePayment",
//            contentType: "application/json",
//            dataType: "json",
//            data: JSON.stringify(tokenRecharge),
//            success: function (response) {
//                if (response && response.url) {
//                    window.location.href = response.url; // Redirect to Stripe checkout page
//                } else {
//                    alert("Failed to initiate payment. Please try again.");
//                    resetButton();
//                }
//            },
//            error: function (xhr) {
//                console.log("Error:", xhr.responseText);
//                alert("Payment processing error. Please try again.");
//                resetButton();
//            }
//        });
//    } else {
//        $("#txtAmount").css("border", "2px solid red");
//        alert("Please enter a valid amount.");
//    }

//    function resetButton() {
//        btnText.textContent = "Recharge Now";
//        btnSpinner.style.display = "none";
//        continueBtn.disabled = false;
//        continueBtn.style.pointerEvents = "auto";
//        continueBtn.style.opacity = "1";
//    }
//}

//function RechargeTokens() {
//    if (parseFloat($("#txtAmount").val()) > 0) {
//        let btnText = document.getElementById("btnText");
//        let btnSpinner = document.getElementById("btnSpinner");
//        let continueBtn = document.getElementById("continueBtn");       

//        continueBtn.disabled = true;
//        continueBtn.style.pointerEvents = "none"; // Disable clicks
//        continueBtn.style.opacity = "0.5"; // Reduce opacity to indicate disabled state

//        // Show processing state for 5 seconds
//        btnText.textContent = "Processing";
//        btnSpinner.style.display = "inline-block";
//        setTimeout(() => {

//            $.ajax({
//                type: "POST",
//                url: "/Subscription/OneTimePayment",
//                contentType: "application/json;charset=utf-8",
//                dataType: "json",
//                async: false,
//                data: JSON.stringify({ Amount: parseFloat($("#txtAmount").val()), Tokens: $("#txtTokenvalue").val() }),
//                success: function (response) {
//                    if (response != null) {
//                        if (response.additionalValue == 'success') {
//                            window.location.href = `/subscription/tokenrechargesuccessful?tokens=${$("#txtTokenvalue").val()}`;
//                        } else {
//                            $("#tokenRechargePopup").hide();
//                            $("#tokenRechargeFailedPopup").show();
//                        }
//                    }
//                },
//                error: function (xhr, status, error) {
//                    btnText.textContent = "Recharge Now";
//                    btnSpinner.style.display = "none";
//                    continueBtn.disabled = false;
//                    continueBtn.style.pointerEvents = "auto";
//                    continueBtn.style.opacity = "1";
//                    console.log("Error:", xhr.responseText);
//                }
//            });
//        }, 2000); // Waits for 2 seconds

//    }
//    else {
//        $("#txtAmount").css("border", "2px solid red");
//    }
//}
function GotoRetryPayment() {
    $("#tokenRechargePopup").show();
    $("#tokenRechargeFailedPopup").hide();
}

function FetchTokenDetails() {
    $.ajax({
        type: "post",
        url: "/Subscription/FetchCurrentPlanDetails",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: false,
        data: {},
        success: function (response) {
            if (response != null && response != '' && response != undefined) {
                $("#txtTokens").val(response.tokens)
                $("#txtPlanPrice").val(response.planPrice)
            }
        },
        error: function (error) {
            //alert(error.responsetype);
        }
    });
}


//10 * 50,000 / 19.95 = 25,062    amount * tokenpreviously / priceofsubscription

//10 * (200,000 / 99.95) = 20,010