$(document).ready(function () {
    HideLeftMenuItems();

    $(".left-nav-bar").resizable();
    $("#divMySettings").addClass("active");
    Toggle_Navbar();
    var div = document.getElementById("left-nav-bar");
    if (div) {
        if (div.classList.contains("bc-leftmenu")) {
        }
        else {
            div.classList.add("bc-leftmenu");
        }
    }

    BindPaymentMethod();
});

function ShowHideLang(element) {
    if ($(".lang-selection-popup").hasClass("show-lsp")) {
        $(".lang-selection-popup").removeClass("show-lsp");
    } else {
        $(".lang-selection-popup").addClass("show-lsp");
    }
    //show-lsp
}

function HideLeftMenuItems() {
    //-----------------------Hide left menu------------------------
    var PromptSection = document.getElementById("divPromptSection");
    PromptSection.style.display = "none";

    var searchBar = document.getElementById("divSearchBar");
    searchBar.style.display = "none";

    var navPanel = document.getElementById("divNevPanel");
    navPanel.style.display = "none";

    var iconPanel = document.getElementById("divIconPanel");
    iconPanel.style.display = "none";

    //------------------------------------------------------------
}

function BindPaymentMethod() {
    $.ajax({
        type: "GET",
        url: "/Subscription/BindPayment",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        success: function (response) {
            var html = "";
            if (response != null && response.length > 0) {
                for (var i = 0; i < response.length; i++) {
                    html += ' <div style="display:flex; padding:10px 0;">';
                    html += '     <div style="width:200px;display: flex;align-items: center;">';
                    html += '         <img src="/images/visa-icon.png" alt="' + response[i].cardType + ' Cards" style="margin-right:10px;" /><span>' + response[i].cardType + '</span> <span>...</span> ';
                    html += '         <span > ' + response[i].cardLastFourDigits + '</span >';
                    if (response[i].isDefault)
                        html += '     <span style = "background-color: #e3e8ee;font-size: 12px;padding: 2px 5px;border-radius: 4px;color: #656565; font-weight: bold; margin-left: 20px;" > Default</span > ';
                    html += '     </div>';
                    html += '     <div style="margin-left:50px;">Expires ' + response[i].expireMonth + '/' + response[i].expireYear + '</div>';
                    html += ' </div>';
                }

                html += ' <form action="/add-card-checkout-session" method="POST" style="text-align: center; margin-top:16px;">';
                html += '   <button class="cp-btn" id="basic-plan-btn"><i class="mdi mdi-plus"></i> Add Payment Method</button>';
                html += ' </form>';
                //html += '<p style="font-size: 16px;font-weight: 600;margin-top: 20px;color: #697386;cursor: pointer;"><i class="mdi mdi-plus"></i> Add Payment Method</p>';
            }
            $("#divPaymentMethods").html(html);
            BindBillingInformation();
        },
        error: function (error) {
        }
    });
}

function BindBillingInformation() {
    $.ajax({
        type: "GET",
        url: "/Subscription/BindBilling",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        success: function (response) {
            if (response != null && response.message != null) {
                showNotification("", response.message, "error", false);
                return;
            }
            var html = "";
            var htmlEdit = "";
            if (response != null && response.length > 0) {
                for (var i = 0; i < response.length; i++) {
                    html += ' <div style="display:flex; padding:0 0 10px;">';
                    html += '     <div style="width:170px;"><span>Name:</span></div>';
                    if (response[i].customerName !== null && response[i].customerName !== undefined && response[i].customerName !== '') {
                        //html += '     <div class="show" style="margin-left:50px;">' + response[i].customerName + '</div>';
                        html += '     <div class="show" style="margin-left:50px;"><input type="text" id="txtCustomerName" value="' + response[i].customerName + '" /></div>';
                        html += '     <div class="edit" style="margin-left:50px;"><input type="text" id="txtCustomerName" value="' + response[i].customerName + '" /></div>';
                    } else {
                        //html += '     <div class="show" style="margin-left:50px;">N/A</div>';
                        html += '     <div class="show" style="margin-left:50px;"><input type="text" id="txtCustomerName" /></div>';
                        html += '     <div class="edit" style="margin-left:50px;"><input type="text" id="txtCustomerName" /></div>';
                    }
                    html += ' </div>';

                    html += ' <div style="display:flex; padding:0 0 10px;">';
                    html += '     <div style="width:170px;"><span>Email:</span></div>';
                    if (response[i].emailAddress !== null && response[i].emailAddress !== undefined && response[i].emailAddress !== '') {
                        //html += '     <div class="show" style="margin-left:50px;">' + response[i].emailAddress + '</div>';
                        html += '     <div class="show" style="margin-left:50px;"><input type="text" id="txtEmailAddress" value="' + response[i].emailAddress + '" /></div>';
                        html += '     <div class="edit" style="margin-left:50px;"><input type="text" id="txtEmailAddress" value="' + response[i].emailAddress + '" /></div>';
                    } else {
                        //html += '     <div class="show" style="margin-left:50px;">N/A</div>';
                        html += '     <div class="show" style="margin-left:50px;"><input type="text" id="txtEmailAddress" /></div>';
                        html += '     <div class="edit" style="margin-left:50px;"><input type="text" id="txtEmailAddress" /></div>';
                    }
                    html += ' </div>';

                    html += ' <div style="display:flex; padding:0 0 10px;">';
                    html += '     <div style="width:170px;"><span>Phone Number:</span></div>';
                    if (response[i].phoneNumber !== null && response[i].phoneNumber !== undefined && response[i].phoneNumber !== '') {
                        //html += '     <div class="show" style="margin-left:50px;">' + response[i].phoneNumber + '</div>';
                        html += '     <div class="show" style="margin-left:50px;"><input type="text" id="txtPhone" value="' + response[i].phoneNumber + '" /></div>';
                        html += '     <div class="edit" style="margin-left:50px;"><input type="text" id="txtPhone" value="' + response[i].phoneNumber + '" /></div>';
                    } else {
                        //html += '     <div class="show" style="margin-left:50px;">N/A</div>';
                        html += '     <div class="show" style="margin-left:50px;"><input type="text" id="txtPhone" /></div>';
                        html += '     <div class="edit" style="margin-left:50px;"><input type="text" id="txtPhone" /></div>';
                    }
                    html += ' </div>';

                    html += ' <div style="display:flex; padding:0 0 10px;">';
                    html += '     <div style="width:170px;"><span>City:</span></div>';
                    if (response[i].city !== null && response[i].city !== undefined && response[i].city !== '') {
                        //html += '     <div class="show" style="margin-left:50px;">' + response[i].city + '</div>';
                        html += '     <div class="show" style="margin-left:50px;"><input type="text" id="txtCity" value="' + response[i].city + '" /></div>';
                        html += '     <div class="edit" style="margin-left:50px;"><input type="text" id="txtCity" value="' + response[i].city + '" /></div>';
                    } else {
                        //html += '     <div class="show" style="margin-left:50px;">N/A</div>';
                        html += '     <div class="show" style="margin-left:50px;"><input type="text" id="txtCity" /></div>';
                        html += '     <div class="edit" style="margin-left:50px;"><input type="text" id="txtCity" /></div>';
                    }
                    html += ' </div>';

                    html += ' <div style="display:flex; padding:0 0 10px;">';
                    html += '     <div style="width:170px;"><span>State:</span></div>';
                    if (response[i].state !== null && response[i].state !== undefined && response[i].state !== '') {
                        //html += '     <div class="show" style="margin-left:50px;">' + response[i].state + '</div>';
                        html += '     <div class="show" style="margin-left:50px;"><input type="text" id="txtState" value="' + response[i].state + '" /></div>';
                        html += '     <div class="edit" style="margin-left:50px;"><input type="text" id="txtState" value="' + response[i].state + '" /></div>';
                    } else {
                        //html += '     <div class="show" style="margin-left:50px;">N/A</div>';
                        html += '     <div class="show" style="margin-left:50px;"><input type="text" id="txtState" /></div>';
                        html += '     <div class="edit" style="margin-left:50px;"><input type="text" id="txtState" /></div>';
                    }
                    html += ' </div>';

                    html += ' <div style="display:flex; padding:0 0 10px;">';
                    html += '     <div style="width:170px;"><span>Country:</span></div>';
                    if (response[i].country !== null && response[i].country !== undefined && response[i].country !== '') {
                        //html += '     <div class="show" style="margin-left:50px;">' + response[i].country + '</div>';
                        html += '     <div class="show" style="margin-left:50px;"><input type="text" id="txtCountry" value="' + response[i].country + '" /></div>';
                        html += '     <div class="edit" style="margin-left:50px;"><input type="text" id="txtCountry" value="' + response[i].country + '" /></div>';
                    } else {
                        //html += '     <div class="show" style="margin-left:50px;">N/A</div>';
                        html += '     <div class="show" style="margin-left:50px;"><input type="text" id="txtCountry" /></div>';
                        html += '     <div class="edit" style="margin-left:50px;"><input type="text" id="txtCountry" /></div>';
                    }
                    html += ' </div>';

                    html += ' <div style="display:flex; padding:0 0 10px;">';
                    html += '     <div style="width:170px;"><span>Postal Code:</span></div>';
                    if (response[i].postalCode !== null && response[i].postalCode !== undefined && response[i].postalCode !== '') {
                        //html += '     <div class="show" style="margin-left:50px;">' + response[i].postalCode + '</div>';
                        html += '     <div class="show" style="margin-left:50px;"><input type="text" id="txtPostalCode" value="' + response[i].postalCode + '" /></div>';
                        html += '     <div class="edit" style="margin-left:50px;"><input type="text" id="txtPostalCode" value="' + response[i].postalCode + '" /></div>';
                    } else {
                        //html += '     <div class="show" style="margin-left:50px;">N/A</div>';
                        html += '     <div class="show" style="margin-left:50px;"><input type="text" id="txtPostalCode" /></div>';
                        html += '     <div class="edit" style="margin-left:50px;"><input type="text" id="txtPostalCode" /></div>';
                    }
                    html += ' </div>';

                    html += '<p class="edit" style="font-size: 16px;font-weight: 600;margin-top: 20px;color: #697386;cursor: pointer;" onclick="EditBillingInformation()" ><i class="mdi mdi-pencil"></i> Update Information</p>';
                    //html += '<p style="font-size: 16px;font-weight: 600;margin-top: 20px;color: #697386;cursor: pointer;" ><i class="mdi mdi-pencil"></i> Update Information</p>';

                    html += '<div class="show"><input class="cp-btn" type="button" id="btnUpdate" value="Update" onclick="UpdateCustomerBillingInfo(\'' + response[i].customerID + '\')"/>';
                    html += '                  <input class="cp-btn" type="button" id="btnCancel" value="Cancel" onclick="CancelEditBillingInformation()"/></div > ';

                    //html += '<p class="edit" style="font-size: 16px;font-weight: 600;margin-top: 20px;color: #697386;cursor: pointer;" onclick="UpdateCustomerBillingInfo(\'' + response[i].customerID + '\')"><i class="mdi mdi-access-point-plus"></i> Update</p>';
                    // html += '<p class="edit" style="font-size: 16px;font-weight: 600;margin-top: 20px;color: #697386;cursor: pointer;" onclick="CancelEditBillingInformation()"><i class="mdi mdi-cancel"></i> Cancel</p>';
                }

            }
            $("#divBillingInformation").html(html);
            CancelEditBillingInformation();
            //EditBillingInformation();
            BindInvoiceHistory();
        },
        error: function (error) {
        }
    });

    //BindMyAccounts();
}

function EditBillingInformation() {

    var elements = document.querySelectorAll('.edit');
    var elementsShow = document.querySelectorAll('.show');

    elements.forEach(function (element) {
        element.style.display = 'none';
    });

    elementsShow.forEach(function (element) {
        element.style.display = '';
    });

}

function CancelEditBillingInformation() {
    var elements = document.querySelectorAll('.edit');
    var elementsShow = document.querySelectorAll('.show');

    elements.forEach(function (element) {
        element.style.display = '';
    });

    elementsShow.forEach(function (element) {
        element.style.display = 'none';
    });
}

function UpdateCustomerBillingInfo(customerID) {
    $.ajax({
        type: "GET",
        url: "/Subscription/UpdateCustomerBillingInformation",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "customerID": customerID,
            "customerName": $("#txtCustomerName").val(),
            "emailAddress": $("#txtEmailAddress").val(),
            "phoneNumber": $("#txtPhone").val(),
            "city": $("#txtCity").val(),
            "state": $("#txtState").val(),
            "country": $("#txtCountry").val(),
            "postalCode": $("#txtPostalCode").val()
        },
        success: function (response) {
            if (response != null) {
                if (response.status === "1") {
                    showNotification("", response.msg, "success", false);
                    BindBillingInformation();
                    CancelEditBillingInformation();

                } else {
                    showNotification("", response.msg, "error", false);
                }
            }
        },
        error: function (error) {
            showNotification("", "Internal server error!", "error", false);
        }
    });
}

function BindInvoiceHistory() {
    $.ajax({
        type: "GET",
        url: "/Subscription/BindInvoice",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        success: function (response) {
            var html = "";
            if (response != null && response.length > 0) {
                for (var i = 0; i < response.length; i++) {
                    html += '<div style="display:flex; padding:10px 0;">';
                    html += '<div style="width:350px;display: flex;align-items: center;">';
                    html += '<span>' + response[i].invoiceDate + '</span> <span style="margin-left: 60px;width: 60px">$' + parseFloat(response[i].amount).toFixed(2) + '</span>';
                    if (response[i].status != null && (response[i].status == "paid" || response[i].status.toLowerCase() == "succeeded"))
                        html += '<span style = "background-color: #d7f7c2;font-size: 12px;padding: 2px 5px;border-radius: 4px;color: #006900; border:1px solid #a6eb84; font-weight: bold; margin-left: 60px;" > ' + response[i].status.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) + '</span > ';
                    else
                        html += '<span style="background-color: #ffbebe;font-size: 12px;padding: 2px 5px;border-radius: 4px;color: #c50000; border:1px solid #f59494; font-weight: bold; margin-left: 60px;">' + response[i].status.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) + '</span>';
                    html += '</div>';
                    html += '<div style="margin-left:60px;">' + response[i].domainName + ' ' + response[i].planName + '</div>';

                    //html += '<div style="margin-left:20px;"><a href="' + response[i].invoicePDFLink + '" target="_blank">Download</a></div>';
                    html += '</div>';

                }
            }
            $("#divInvoiceHistory").html(html);
        },
        error: function (error) {
        }
    });
}

function UnSubscribe(pageName) {
    var TitleData = "";
    var HTMLData = "Are you sure you want to cancel subscription?</br> Click Yes to continue";
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
                removeSubscription(pageName);
            }
        }, function (dismiss) {
            // dismiss can be 'cancel', 'overlay', 'esc' or 'timer'
        }
    );
    return false;
}

function removeSubscription(pageName) {
    $.ajax({
        type: "GET",
        url: "/Subscription/CancelUserSubscription",
        contenttype: "application/json; charset=utf-8",
        datatype: "json",
        async: true,
        data: {},
        success: function (response) {
            if (response != null) {
                if (response.status == "1") {
                    showNotification("", response.msg, "success", false);
                    if (pageName != undefined && pageName != null && pageName == 'price') {
                        setTimeout(() => {
                            window.location.href = "/pricing";
                        }, 2500);
                    } else {
                        setTimeout(() => {
                            window.location.href = "/currentsubscription";
                        }, 2500);
                    }
                }
                else {
                    showNotification("", response.msg, "error", false);
                }
            }
        },
        error: function (error) {
            //showNotification("", response.msg, "error", false);
        }
    });
}

function ClosePopup() {
    var element = document.getElementById("popupSubscription");
    if (element) {
        element.classList.remove('show');
    }
    //document.getElementById('popupSubscription').classList.remove('show');
}

function ShowSubscriptionPopup() {
    var element = document.getElementById("popupSubscription");
    if (element) {
        element.classList.add('show');
    }
    //document.getElementById('popupSubscription').classList.add('show');
}

function CloseErrorPopup() {
    var popupid = document.querySelector("#divSubscriptionErrorpopup");
    if (popupid) {
        popupid.style.display = "none";
        '@ViewBag.Message = null';
    }
}

//Open edit profile
function editProfile() {
    window.location.href = "/EditProfile";
}

//My Accounts Details
function BindMyAccounts() {
    $.ajax({
        type: "GET",
        url: "/Home/GetOpenAIBalance",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        success: function (response) {
            var html = "";
            if (response != null && response.length > 0) {
                var html = "<table border='1' style='width: 100%; text-align: left;'>";
                html += "<tr><th>Total Credits</th><th>Used Credits</th><th>Remaining Credits</th></tr>";
                html += "<tr>";
                html += "<td>" + response.totalCredits + "</td>";
                html += "<td>" + response.usedCredits + "</td>";
                html += "<td>" + response.remainingCredits + "</td>";
                html += "</tr>";
                html += "</table>";

                $("#divAccounts").html(html);
            } else {
                $("#divAccounts").html("<p>No account details found.</p>");
            }
            
        },
        error: function (error) {
            $("#divAccounts").html("<p>Error fetching data.</p>");
        }
    });
}
