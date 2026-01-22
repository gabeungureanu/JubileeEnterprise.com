var PlanPriceModel;
var planStatus = "no";
let subscriptionID = null;
$(document).ready(function () {
    BindPlans();
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
    if (PromptSection) {
        PromptSection.style.display = "none";
    }
    

    var searchBar = document.getElementById("divSearchBar");
    if (searchBar) {
        searchBar.style.display = "none";
    }
    

    var navPanel = document.getElementById("divNevPanel");
    if (navPanel) {
        navPanel.style.display = "none";
    }
    

    var iconPanel = document.getElementById("divIconPanel");
    if (iconPanel) {
        iconPanel.style.display = "none";
    }
    

    //------------------------------------------------------------
}

function BindPlanTypes() {
    $.ajax({
        type: "post",
        url: "/Subscription/BindPlanTypes",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: false,
        data: {},
        success: function (response) {
            if (response != null && response.length > 0) {

                var html = "";
                for (var i = 0; i < response.length; i++) {
                    if (response[i].planName.toLowerCase() == 'month') {
                        html += '  <li class="nav-item">';
                        html += ' <a class="nav-link px-3 rounded monthly active" id="monthly" data-bs-toggle="pill" href="#month" role="tab" aria-controls="month" aria-selected="true">Monthly</a>';
                        html += ' </li>';
                    } else if (response[i].planName.toLowerCase() == 'year') {
                        html += '  <li class="nav-item">';
                        html += '      <a class="nav-link px-3 rounded yearly" id="yearly" data-bs-toggle="pill" href="#year" role="tab" aria-controls="year" aria-selected="false">Yearly</a>';
                        html += '  </li>';
                    }
                }
                $("#pills-tab").html(html);
            }
        },
        error: function (error) {
            //alert(error.responsetype);
        }
    });
}



function BindFeaturesPlanButton() {
    $.ajax({
        type: "post",
        url: "/Subscription/BindPlans",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: false,
        data: {},
        success: function (response) {
            if (response != null && response.length > 0) {
                var html = "";
                for (var i = 0; i < response.length; i++) {
                    if (response[i].planPrice != 0) {

                        if (response[i].planName.toLowerCase() == "standard") {
                            html += '<form style="width:100%" action="/create-checkout-session/' + response[i].paymentPlanID + '" method="POST">';
                            html += '<button class="btn btn-blue w-100" id="basic-plan-btn">Choose Plan</button>';
                            html += '</form>';
                            $("#btnPlanStandard").html(html);
                            html = "";
                        }
                        else if (response[i].planName.toLowerCase() == "deluxe") {
                            html += '<form style="width:100%" action="/create-checkout-session/' + response[i].paymentPlanID + '" method="POST">';
                            html += '<button class="btn btn-blue w-100" id="basic-plan-btn">Choose Plan</button>';
                            html += '</form>';
                            $("#btnPlanDeluxe").html(html);
                            html = "";
                        }
                        else if (response[i].planName.toLowerCase() == "professional") {
                            html += '<form style="width:100%" action="/create-checkout-session/' + response[i].paymentPlanID + '" method="POST">';
                            html += '<button class="btn btn-blue w-100" id="basic-plan-btn">Choose Plan</button>';
                            html += '</form>';
                            $("#btnPlanProfessional").html(html);
                            html = "";
                        }
                        else if (response[i].planName.toLowerCase() == "enterprise") {
                            html += '<form style="width:100%" action="/create-checkout-session/' + response[i].paymentPlanID + '" method="POST">';
                            html += '<button class="btn btn-blue w-100" id="basic-plan-btn">Choose Plan</button>';
                            html += '</form>';
                            $("#btnPlanEnterprise").html(html);
                            html = "";
                        }
                    }
                }
            }
        },
        error: function (error) {
            //alert(error.responsetype);
        }
    });
}

function BindFeatures() {
    $.ajax({
        type: "post",
        url: "/Subscription/BindFeatures",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: false,
        data: {},
        success: function (response) {
            if (response != null && response.length > 0) {
                var html = "";
                for (var i = 0; i < response.length; i++) {
                    html += '<div class="pftb-row" id="tr_' + response[i].featureID + '">';
                    html += '<div class="pftbr-col-h">' + response[i].featureName + '</div>';
                    if (response[i].basicFree)
                        html += '<div class="pftbr-col"><span class="f-y"></span></div>';
                    else {
                        html += '<div class="pftbr-col"></div>';
                    }
                    if (response[i].standard)
                        html += '<div class="pftbr-col"><span class="f-y"></span></div>';
                    else {
                        html += '<div class="pftbr-col"></div>';
                    }
                    if (response[i].deluxe)
                        html += '<div class="pftbr-col"><span class="f-y"></span></div>';
                    else {
                        html += '<div class="pftbr-col"></div>';
                    }
                    if (response[i].professional)
                        html += '<div class="pftbr-col2"><span class="f-y"></span></div>';
                    else {
                        html += '<div class="pftbr-col2"></div>';
                    }
                    if (response[i].enterPrise)
                        html += '<div class="pftbr-col2"><span class="f-y"></span></div>';
                    else {
                        html += '<div class="pftbr-col2"></div>';
                    }
                    html += '</div>';
                }
                $("#divFeatures").html(html);
                $("#divFeaturesYearly").html(html);

                for (var x = 0; x < PlanPriceModel.length; x++) {
                    if (PlanPriceModel[x].planType.toLowerCase() == 'month') {
                        $($(".pft-footer .plan-pricing")[x]).html('$' + parseFloat(PlanPriceModel[x].planPrice).toFixed(2));
                        $($(".pft-footer .plan-duraion")[x]).html("per<br />month");
                        var ButtonHTML = "";
                        if (x > 0) {
                            if (PlanPriceModel[x].paymentPlanID == PlanPriceModel[x].currentPlanID) {
                                ButtonHTML += '<button class="btn btn-blue w-100" onclick="GoToCurrentSubscription()">Cancel Plan</button>';
                            } else {
                                if (planStatus == 'no') {
                                    ButtonHTML += '<form style="width:100%" action="/create-checkout-session/' + PlanPriceModel[x].paymentPlanID + '" method="POST">';
                                    ButtonHTML += '<button class="btn btn-blue w-100" id="basic-plan-btn">Choose Plan</button>';
                                    ButtonHTML += '</form>';
                                }
                            }
                            $($(".plan-sel")[x]).html(ButtonHTML)
                        }
                    }
                    if (PlanPriceModel[x].planType.toLowerCase() == 'year') {
                        $($(".pft-footer .plan-pricing")[x]).html('$' + parseFloat(PlanPriceModel[x].planPrice).toFixed(2));
                        $($(".pft-footer .plan-duraion")[x]).html("per<br />year");
                        var ButtonHTML = "";
                        if (x > 0) {
                            if (PlanPriceModel[x].paymentPlanID == PlanPriceModel[x].currentPlanID) {
                                ButtonHTML += '<button class="btn btn-blue w-100" onclick="GoToCurrentSubscription()">Cancel Plan</button>';
                            } else {
                                if (planStatus == 'no') {
                                    ButtonHTML += '<form style="width:100%" action="/create-checkout-session/' + PlanPriceModel[x].paymentPlanID + '" method="POST">';
                                    ButtonHTML += '<button class="btn btn-blue w-100" id="basic-plan-btn">Choose Plan</button>';
                                    ButtonHTML += '</form>';
                                }
                            }
                            $($(".plan-sel")[x]).html(ButtonHTML)
                        }
                    }
                }
                var FeatureMonthRow = document.getElementById("divFeatureMonthRow");
                if (FeatureMonthRow)
                    FeatureMonthRow.style.display = "";


                var FeatureYearRow = document.getElementById("divFeatureYearRow");
                if (FeatureYearRow)
                    FeatureYearRow.style.display = "";
            }
        },
        error: function (error) {
            // alert(error.responsetype);
        }
    });
}

function GoToCurrentSubscription() {
    window.location.href = "/currentsubscription";
}

function AddSubscription() {
    $.ajax({
        type: "post",
        url: "/Subscription/AddSubscription",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: false,
        data: {
            "EmailAddress": $("#txtEmailAddress").val().trim(),
            "CardNumber": $("#txtCardInfo").val().trim(),
            "ExpiryMonthYear": $("#txtExpiryDetails").val().trim(),
            "CVV": $("#txtCVV").val().trim(),
            "NameOnCard": $("#txtCardName").val().trim(),
            "Country": $("#ddlCountry").val().trim(),
            "ZIPCode": $("#txtZipCode").val().trim()
        },
        success: function (response) {
            if (response != null) {
                $("#txtEmailAddress").val(response.emailAddress);
            }
        },
        error: function (error) {
            // alert(error.responsetype);
        }
    });
}

function ResetAll() {
    //$("#txtEmailAddress").val("");
    $("#txtCardInfo").val("");
    $("#txtExpiryDetails").val("");
    $("#txtCVV").val("");
    $("#txtCardName").val("");
    $("#ddlCountry").val("United States");
    $("#txtZipCode").val("");
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

/*------------------------------------------------------------------------------------*/
function BindPlans() {
    $.ajax({
        type: "POST",
        url: "/Subscription/BindPlans",
        contentType: "application/json;charset=utf-8",
        dataType: "json",
        async: true, // It's better to use async: true for better user experience
        data: {},
        success: function (response) {
            if (response && response.length > 0) {
                PlanPriceModel = response;

                
                var checkicon = "";
                let planStatus = '';
                var headerhtml = "";
                let curActivePlan;
                var monthResult = response.filter(x => x.planName.toLowerCase() == "month");
                if (monthResult != null && monthResult.length > 0) {
                    var mplans = monthResult[0].paymentPlan.filter(x => x.planStatus.toLowerCase() === "yes");
                    if (mplans != null && mplans.length > 0) {
                        currentActivePlan = mplans[0];
                        isAnyPurchased = mplans.length;
                        curActivePlan = response[0].planTypeID;
                 
                    }
                }
                var yearResult = response.filter(x => x.planName.toLowerCase() == "year");
                if (yearResult != null && yearResult.length > 0) {
                    var yplans = yearResult[0].paymentPlan.filter(x => x.planStatus.toLowerCase() === "yes");
                    if (yplans != null && yplans.length > 0) {
                        currentActivePlan = yplans[0];
                        isAnyPurchased = yplans.length;
                        curActivePlan = response[1].planTypeID;
                        checkicon = "checked";
                        

                    }
                }

                for (let i = 0; i < response.length; i++) {
                    let planitem = response[i];



                    headerhtml += `
                    <span>${planitem.planName}</span>`;
                       if (i === 0) {
                          headerhtml += `
                        <label class="switch">
                        <input type="checkbox" ${checkicon}  id="togglePlan" onclick="TogglePlan(this, '${response[0].planTypeID}', '${response[1].planTypeID}')">
                        <span class="slider round"></span>
                       </label>`;
                       }
                }

                $("#divSubscriptionPlan").html(headerhtml);
                if (!curActivePlan) {
                    curActivePlan = response[0]?.planTypeID || "";
                }

             

                BindPlansDetails(response, curActivePlan);
               

                //response.forEach(function (item) {
                //    if (item.paymentPlanID === item.currentPlanID && item.planStatus.toLowerCase() === 'yes') {
                //        planStatus = 'yes';
                //    }
                //});

                
            }
        },
        error: function (error) {
            console.error("Error occurred during the AJAX request:", error);
        }
    });
}

function BindPlansDetails(response, planTypeID) {
    let activePlan = "";
    let htmlMonth = "";  
    var plans = response.filter(x => x.planTypeID == planTypeID)[0].paymentPlan;
    var plansItems = response.filter(x => x.planTypeID == planTypeID)[0].paymentPlanItem;
    var currentActivePlan = "";
    var planRunning = "";  
    var isAnyPurchased = [];
    var selectedPlanType = response.filter(x => x.planTypeID == planTypeID)[0].planName.toLowerCase();
    var monthResult = response.filter(x => x.planName.toLowerCase() == "month");
    if (monthResult != null && monthResult.length>0) {
        var mplans = monthResult[0].paymentPlan.filter(x => x.planStatus.toLowerCase() === "yes");
        if (mplans != null && mplans.length>0) {
            currentActivePlan = mplans[0];
            isAnyPurchased = mplans.length;
        }
    }
    var yearResult = response.filter(x => x.planName.toLowerCase() == "year");
    if (yearResult != null && yearResult.length>0) {
        var yplans = yearResult[0].paymentPlan.filter(x => x.planStatus.toLowerCase() === "yes");
        if (yplans != null && yplans.length > 0) {
            currentActivePlan = yplans[0];
            isAnyPurchased = yplans.length;
        }
    }

   
    // Generate HTML for Monthly Plans
    
                        htmlMonth = `
                            <table>
                                <thead>
                              <tr>
                                <th style="width:25%; position:relative;">
                                <a href="/" title="Back to Home" class="backtohome">
                                    <svg fill="#cbcbcb" width="28px" height="28px" viewBox="-1 0 19 19" xmlns="http://www.w3.org/2000/svg" class="cf-icon-svg"><path d="M16.416 9.579A7.917 7.917 0 1 1 8.5 1.662a7.916 7.916 0 0 1 7.916 7.917zm-2.753.005a.792.792 0 0 0-.791-.792H6.039l1.936-1.936a.792.792 0 0 0-1.12-1.119L3.568 9.024a.791.791 0 0 0 0 1.12l3.287 3.286a.792.792 0 0 0 1.12-1.119l-1.936-1.936h6.833a.792.792 0 0 0 .791-.791z"/></svg> 
                                    &nbsp; Back
                                </a>
                                    <h3>Subscription Plans</h3>
                                    <p>Whether you're a passionate student of the Scriptures or a thriving faith-based business, we’ve got the perfect plan tailored just for you! </p>
                                </th>
     
                                `
    //var isAnyPurchased = response.filter(x => x.planStatus.toLowerCase() === "yes").length;
    //if (isAnyPurchased > 0) {
    //    currentActivePlan = response.filter(x => x.planStatus.toLowerCase() === "yes")[0];
    //}

    var thClass, thActivelass;
    for (var i = 0; i < plans.length; i++) {
        var item = plans[i];
        // Check if i is 3, and if so, add the recommended-plan class
        thClass = (i === 3) ? 'recommended-plan' : '';
        var buttonName = (i === 0) ? 'Current Plan' : 'Get Started';
        var disabledClass = (i === 0) ? 'disabled' : '';
        
        thActivelass = (item.planStatus.toLowerCase() == "yes") ? 'active-plan' : '';
        if (isAnyPurchased > 0) {
            if (currentActivePlan.planIndex>=5)
            {
                thClass = "";
            }
            if (currentActivePlan?.planType?.toLowerCase() == "year") {
                if (selectedPlanType == "month") { 
                    if (i == 3 && currentActivePlan.planPrice < item.planPrice) {
                        thClass = "recommended";
                    }
                    else {
                        thClass = "";
                    }
                    htmlMonth += `
                        <th style="width:12.5%;" class="${thClass} ${thActivelass}">
                            <h4>${item.planName}</h4>
                            <p>${item.description}</p>
                            <h2 class="plan-price">$${item.planPrice === 0 ? '0.00' : item.planPrice.toFixed(2)}</h2>
      
                            <form action="/create-checkout-session/${item.paymentPlanID}" method="POST">
                        ${item.planPrice === 0 && isAnyPurchased == 0
                            ? `<button class="getstarted disabled" >Current Plan</button>`
                            : currentActivePlan.planPrice == item.planPrice
                                ? `<a href="/currentsubscription" class="getstarted">Plan Details</a>`
                                : `<button class="getstarted" 
                                          ${item.planPrice === 0 || currentActivePlan.planPrice > item.planPrice
                                    ? 'style="display:none"'
                                    : ''}>
                                       ${isAnyPurchased > 0 && currentActivePlan.planPrice < item.planPrice
                                    ? 'Upgrade'
                                    : 'Get Started'}
                                   </button>`
                        }
                             </form>

                        </th>
                    `;
                }
                else {
                    htmlMonth += `
                        <th style="width:12.5%;" class="${thClass} ${thActivelass}">
                            <h4>${item.planName}</h4>
                            <p>${item.description}</p>
                            <h2 class="plan-price">$${item.planPrice === 0 ? '0.00' : item.planPrice.toFixed(2)}</h2>
      
                            <form action="/create-checkout-session/${item.paymentPlanID}" method="POST">
                        ${item.planPrice === 0 && isAnyPurchased == 0
                            ? `<button class="getstarted disabled" >Current Plan</button>`
                            : currentActivePlan.planPrice == item.planPrice
                                ? `<a href="/currentsubscription" class="getstarted">Plan Details</a>`
                                : `<button class="getstarted" 
                                          ${item.planPrice === 0 || currentActivePlan.planPrice > item.planPrice
                                    ? 'style="display:none"'
                                    : ''}>
                                       ${isAnyPurchased > 0 && currentActivePlan.planPrice < item.planPrice
                                    ? 'Upgrade'
                                    : 'Get Started'}
                                   </button>`
                        }
                             </form>

                        </th>
                    `;
                }
            }
            else if (currentActivePlan?.planType?.toLowerCase() == "month") {
                if (selectedPlanType == "month") {

                    htmlMonth += `
                        <th style="width:12.5%;" class="${thClass} ${thActivelass}">
                            <h4>${item.planName}</h4>
                            <p>${item.description}</p>
                            <h2 class="plan-price">$${item.planPrice === 0 ? '0.00' : item.planPrice.toFixed(2)}</h2>
      
                            <form action="/create-checkout-session/${item.paymentPlanID}" method="POST">
                        ${item.planPrice === 0 && isAnyPurchased == 0
                            ? `<button class="getstarted disabled" >Current Plan</button>`
                            : currentActivePlan.planPrice == item.planPrice
                                ? `<a href="/currentsubscription" class="getstarted">Plan Details</a>`
                                : `<button class="getstarted" 
                                          ${item.planPrice === 0 || currentActivePlan.planPrice > item.planPrice
                                    ? 'style="display:none"'
                                    : ''}>
                                       ${isAnyPurchased > 0 && currentActivePlan.planPrice < item.planPrice
                                    ? 'Upgrade'
                                    : 'Get Started'}
                                   </button>`
                        }
                             </form>

                        </th>
                    `;

                } else {
                    htmlMonth += `
                        <th style="width:12.5%;" class="${thClass} ${thActivelass}">
                            <h4>${item.planName}</h4>
                            <p>${item.description}</p>
                            <h2 class="plan-price">$${item.planPrice === 0 ? '0.00' : item.planPrice.toFixed(2)}</h2>
      
                            <form action="/create-checkout-session/${item.paymentPlanID}" method="POST">
                                ${item.planPrice === 0 && isAnyPurchased == 0
                            ? `<button class="getstarted disabled" >Current Plan</button>`
                            : currentActivePlan.planPrice == item.planPrice
                            ? `<a href="/currentsubscription" class="getstarted">Plan Details</a>`
                            : `<button class="getstarted" ${currentActivePlan.planIndex > item.planIndex ? 'style="display:none"' : ''}>
                                       ${currentActivePlan.planPrice < item.planPrice ? 'Upgrade' : 'Get Started'}
                                   </button>`
                        }
                             </form>

                        </th>
                    `;
                }
                

            }
            else {

                htmlMonth += `
                        <th style="width:12.5%;" class="${thClass} ${thActivelass}">
                            <h4>${item.planName}</h4>
                            <p>${item.description}</p>
                            <h2 class="plan-price">$${item.planPrice === 0 ? '0.00' : item.planPrice.toFixed(2)}</h2>
      
                            <form action="/create-checkout-session/${item.paymentPlanID}" method="POST">
                                ${currentActivePlan.planType.toLowerCase() == "year" 
                                ? ``
                                : currentActivePlan.planPrice == item.planPrice
                                    ? `<a href="/currentsubscription" class="getstarted">Plan Details</a>`
                                    : `<button class="getstarted" 
                                                  ${item.planPrice === 0 || currentActivePlan.planPrice > item.planPrice
                                        ? 'style="display:none"'
                                        : ''}>
                                               ${isAnyPurchased > 0 && currentActivePlan.planPrice < item.planPrice
                                        ? 'Upgrade'
                                        : 'Get Started'}
                                           </button>`
                    }
                             </form>

                        </th>
                    `;

            }

        }
        else {          
            
                htmlMonth += `
                        <th style="width:12.5%;" class="${thClass}">
                            <h4>${item.planName}</h4>
                            <p>${item.description}</p>
                            <h2 class="plan-price">$${item.planPrice === 0 ? '0.00' : item.planPrice.toFixed(2)}</h2>
      
                            <form action="/create-checkout-session/${item.paymentPlanID}" method="POST">
                                <button class="getstarted ${disabledClass}"> ${buttonName} </button>
                            `;

            

            htmlMonth += `</form>`
            htmlMonth += '</th>'
                   

        }
      
    }


    htmlMonth += `</tr></thead>`

    htmlMonth += `<tbody>`
    //TBODY

    for (var x = 0; x < plansItems.length; x++) {        
     //console.log(response);
        var curPlanItems = plansItems[x];
        if (isAnyPurchased) {
            if (currentActivePlan.planIndex >= 5) {
                thClass = "";
            } else {
                thClass = "recommended";
            }
        } 
       
       
        if (currentActivePlan?.planType?.toLowerCase() == "month")
        {
            if (selectedPlanType == "month") {
                htmlMonth += `
                 <tr>
                    <td>
                        <h4>${curPlanItems.title}</h4>
                        <p>${curPlanItems.description}</p>
                    </td>
            
                    <td class="${currentActivePlan?.planIndex == 1 ? 'active' : ''} ${curPlanItems.plan1 === 'yes' ? 'yes' : (curPlanItems.plan1 === 'no' ? '' : '')}" style="vertical-align:middle;">
                        ${curPlanItems.plan1 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan1 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan1}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 60 : 5}-page book.</small></p></div>`)}
                    </td>
                    <td class="${currentActivePlan?.planIndex == 2 ? 'active' : ''} ${curPlanItems.plan2 === 'yes' ? 'yes' : (curPlanItems.plan2 === 'no' ? '' : '')}" style="vertical-align:middle;">
                        ${curPlanItems.plan2 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan2 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan2}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 216 : 18}-page book.</small></p></div>`)}
                    </td>
                    <td class="${currentActivePlan?.planIndex == 3 ? 'active' : ''} ${curPlanItems.plan3 === 'yes' ? 'yes' : (curPlanItems.plan3 === 'no' ? '' : '')}" style="vertical-align:middle;">
                        ${curPlanItems.plan3 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan3 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan3}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 756 : 63}-page book.</small></p></div>`)}
                    </td>
                    <td class="${currentActivePlan?.planIndex == 4 ? 'active' : ''} ${thClass} ${curPlanItems.plan4 === 'yes' ? 'yes' : (curPlanItems.plan4 === 'no' ? '' : '')}" style="vertical-align:middle;">
                        ${curPlanItems.plan4 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan4 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan4}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 1500 : 125}-page book.</small></p></div>`)}
                    </td>
                    <td class="${currentActivePlan?.planIndex == 5 ? 'active' : ''} ${curPlanItems.plan5 === 'yes' ? 'yes' : (curPlanItems.plan5 === 'no' ? '' : '')}" style="vertical-align:middle;">
                        ${curPlanItems.plan5 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan5 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan5}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 6000 : 500}-page book.</small></p></div>`)}
                    </td>
                    <td class="${currentActivePlan?.planIndex == 6 ? 'active' : ''} ${curPlanItems.plan6 === 'yes' ? 'yes' : (curPlanItems.plan6 === 'no' ? '' : '')}" style="vertical-align:middle;">
                        ${curPlanItems.plan6 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan6 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan6}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 12000 : 1000}-page book.</small></p></div>`)}
                    </td>
                </tr>`;
            }
            else if (selectedPlanType == "year") {

                htmlMonth += `
                 <tr>
                    <td>
                        <h4>${curPlanItems.title}</h4>
                        <p>${curPlanItems.description}</p>
                    </td>

                    <td class="${currentActivePlan?.planIndex == 1 && selectedPlanType == "month" ? 'active' : ''} ${curPlanItems.plan1 === 'yes' ? 'yes' : (curPlanItems.plan1 === 'no' ? '' : '')}" style="vertical-align:middle;">
                        ${curPlanItems.plan1 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan1 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan1}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 60 : 5}-page book.</small></p></div>`)}
                    </td>
                    <td class="${currentActivePlan?.planIndex == 2 && selectedPlanType == "month" ? 'active' : ''} ${curPlanItems.plan2 === 'yes' ? 'yes' : (curPlanItems.plan2 === 'no' ? '' : '')}" style="vertical-align:middle;">
                        ${curPlanItems.plan2 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan2 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan2}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 216 : 18}-page book.</small></p></div>`)}
                    </td>
                    <td class="${currentActivePlan?.planIndex == 3 && selectedPlanType == "month" ? 'active' : ''} ${curPlanItems.plan3 === 'yes' ? 'yes' : (curPlanItems.plan3 === 'no' ? '' : '')}" style="vertical-align:middle;">
                        ${curPlanItems.plan3 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan3 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan3}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 756 : 63}-page book.</small></p></div>`)}
                    </td>
                    <td class="${currentActivePlan?.planIndex == 4 && selectedPlanType == "month" ? 'active' : ''} ${thClass} ${curPlanItems.plan4 === 'yes' ? 'yes' : (curPlanItems.plan4 === 'no' ? '' : '')}" style="vertical-align:middle;">
                        ${curPlanItems.plan4 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan4 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan4}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 1500 : 125}-page book.</small></p></div>`)}
                    </td>
                    <td class="${currentActivePlan?.planIndex == 5 && selectedPlanType == "month" ? 'active' : ''} ${curPlanItems.plan5 === 'yes' ? 'yes' : (curPlanItems.plan5 === 'no' ? '' : '')}" style="vertical-align:middle;">
                        ${curPlanItems.plan5 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan5 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan5}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 6000 : 500}-page book.</small></p></div>`)}
                    </td>
                    <td class="${currentActivePlan?.planIndex == 6 && selectedPlanType == "month" ? 'active' : ''} ${curPlanItems.plan6 === 'yes' ? 'yes' : (curPlanItems.plan6 === 'no' ? '' : '')}" style="vertical-align:middle;">
                        ${curPlanItems.plan6 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan6 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan6}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 12000 : 1000}-page book.</small></p></div>`)}
                    </td>
                </tr>`;
            }
           
        }
        else if (currentActivePlan?.planType?.toLowerCase() == "year") {
            
            if (selectedPlanType == "month") {

                htmlMonth += `
             <tr>
                <td>
                    <h4>${curPlanItems.title}</h4>
                    <p>${curPlanItems.description}</p>
                </td>
            
                <td class="${currentActivePlan.planIndex === 1 && selectedPlanType == "year" ? 'active' : ''} ${curPlanItems.plan1 === 'yes' ? 'yes' : (curPlanItems.plan1 === 'no' ? '' : '')}" style="vertical-align:middle;">
                    ${curPlanItems.plan1 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan1 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan1}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 60 : 5}-page book.</small></p></div>`)}
                </td>
                <td class="${currentActivePlan.planIndex === 2 && selectedPlanType == "year" ? 'active' : ''} ${curPlanItems.plan2 === 'yes' ? 'yes' : (curPlanItems.plan2 === 'no' ? '' : '')}" style="vertical-align:middle;">
                    ${curPlanItems.plan2 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan2 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan2}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 216 : 18}-page book.</small></p></div>`)}
                </td>
                <td class="${currentActivePlan.planIndex === 3 && selectedPlanType == "year" ? 'active' : ''} ${curPlanItems.plan3 === 'yes' ? 'yes' : (curPlanItems.plan3 === 'no' ? '' : '')}" style="vertical-align:middle;">
                    ${curPlanItems.plan3 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan3 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan3}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 756 : 63}-page book.</small></p></div>`)}
                </td>
                <td class="${currentActivePlan.planIndex === 4 && selectedPlanType == "year" ? 'active' : ''} ${curPlanItems.plan4 === 'yes' ? 'yes' : (curPlanItems.plan4 === 'no' ? '' : '')}" style="vertical-align:middle;">
                    ${curPlanItems.plan4 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan4 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan4}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 1500 : 125}-page book.</small></p></div>`)}
                </td>
                <td class="${currentActivePlan.planIndex === 5 && selectedPlanType == "year" ? 'active' : ''} ${curPlanItems.plan5 === 'yes' ? 'yes' : (curPlanItems.plan5 === 'no' ? '' : '')}" style="vertical-align:middle;">
                    ${curPlanItems.plan5 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan5 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan5}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 6000 : 500}-page book.</small></p></div>`)}
                </td>
                <td class="${currentActivePlan.planIndex === 6 && selectedPlanType == "year" ? 'active' : ''} ${curPlanItems.plan6 === 'yes' ? 'yes' : (curPlanItems.plan6 === 'no' ? '' : '')}" style="vertical-align:middle;">
                    ${curPlanItems.plan6 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan6 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan6}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 12000 : 1000}-page book.</small></p></div>`)}
                </td>
            </tr>`;
            }
            else if (selectedPlanType == "year") {

                htmlMonth += `
             <tr>
                <td>
                    <h4>${curPlanItems.title}</h4>
                    <p>${curPlanItems.description}</p>
                </td>
            
                <td class="${currentActivePlan.planIndex === 1 ? 'active' : ''} ${curPlanItems.plan1 === 'yes' ? 'yes' : (curPlanItems.plan1 === 'no' ? '' : '')}" style="vertical-align:middle;">
                ${curPlanItems.plan1 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan1 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan1}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 60 : 5}-page book.</small></p></div>`)}
                </td>
                <td class="${currentActivePlan.planIndex === 2 ? 'active' : ''} ${curPlanItems.plan2 === 'yes' ? 'yes' : (curPlanItems.plan2 === 'no' ? '' : '')}" style="vertical-align:middle;">
                    ${curPlanItems.plan2 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan2 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan2}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 216 : 18}-page book.</small></p></div>`)}
                </td>
                <td class="${currentActivePlan.planIndex === 3 ? 'active' : ''} ${curPlanItems.plan3 === 'yes' ? 'yes' : (curPlanItems.plan3 === 'no' ? '' : '')}" style="vertical-align:middle;">
                    ${curPlanItems.plan3 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan3 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan3}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 756 : 63}-page book.</small></p></div>`)}
                </td>
                <td class="${currentActivePlan.planIndex === 4 ? 'active' : ''} ${thClass} ${curPlanItems.plan4 === 'yes' ? 'yes' : (curPlanItems.plan4 === 'no' ? '' : '')}" style="vertical-align:middle;">
                    ${curPlanItems.plan4 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan4 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan4}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 1500 : 125}-page book.</small></p></div>`)}
                </td>
                <td class="${currentActivePlan.planIndex === 5 ? 'active' : ''} ${curPlanItems.plan5 === 'yes' ? 'yes' : (curPlanItems.plan5 === 'no' ? '' : '')}" style="vertical-align:middle;">
                    ${curPlanItems.plan5 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan5 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan5}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 6000 : 500}-page book.</small></p></div>`)}
                </td>
                <td class="${currentActivePlan.planIndex === 6 ? 'active' : ''} ${curPlanItems.plan6 === 'yes' ? 'yes' : (curPlanItems.plan6 === 'no' ? '' : '')}" style="vertical-align:middle;">
                    ${curPlanItems.plan6 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan6 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan6}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 12000 : 1000}-page book.</small></p></div>`)}
                </td>
            </tr>`;
            }
        }
        else {
            htmlMonth += `
             <tr>
                <td>
                    <h4>${curPlanItems.title}</h4>
                    <p>${curPlanItems.description}</p>
                </td>
            
                <td class="${curPlanItems.plan1 === 'yes' ? 'yes' : (curPlanItems.plan1 === 'no' ? '' : '')}" style="vertical-align:middle;">
                    ${curPlanItems.plan1 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan1 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan1}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 60 : 5}-page book.</small></p></div>`)}
                </td>
                <td class="${curPlanItems.plan2 === 'yes' ? 'yes' : (curPlanItems.plan2 === 'no' ? '' : '')}" style="vertical-align:middle;">
                    ${curPlanItems.plan2 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan2 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan2}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 216 : 18}-page book.</small></p></div>`)}
                </td>
                <td class="${curPlanItems.plan3 === 'yes' ? 'yes' : (curPlanItems.plan3 === 'no' ? '' : '')}" style="vertical-align:middle;">
                    ${curPlanItems.plan3 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan3 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan3}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 756 : 63}-page book.</small></p></div>`)}
                </td>
                <td class="${thClass} ${curPlanItems.plan4 === 'yes' ? 'yes' : (curPlanItems.plan4 === 'no' ? '' : '')}" style="vertical-align:middle;">
                    ${curPlanItems.plan4 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan4 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan4}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 1500 : 125}-page book.</small></p></div>`)}
                </td>
                <td class="${curPlanItems.plan5 === 'yes' ? 'yes' : (curPlanItems.plan5 === 'no' ? '' : '')}" style="vertical-align:middle;">
                    ${curPlanItems.plan5 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan5 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan5}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 6000 : 500}-page book.</small></p></div>`)}
                </td>
                <td class="${curPlanItems.plan6 === 'yes' ? 'yes' : (curPlanItems.plan6 === 'no' ? '' : '')}" style="vertical-align:middle;">
                    ${curPlanItems.plan6 === 'yes' ? '<span class="yes"></span>' : (curPlanItems.plan6 === 'no' ? '' : `<div class="token-txt"><img src="../images/man-reading-book.svg" /><p>${curPlanItems.plan6}<small>Equivalent to the content of a ${selectedPlanType == "year" ? 12000 : 1000}-page book.</small></p></div>`)}
                </td>
            </tr>`;

        }
        
    }
    htmlMonth += `<tr>
    <td></td>`; // Starting row with an empty first cell

    for (var x = 0; x < plans.length; x++) {
        var curPlan = plans[x];  
        thClass = (x === 3) ? 'recommended' : '';
        thActivelass = (curPlan.planStatus.toLowerCase() == "yes") ? 'active' : '';
        var buttonName = (x === 0) ? 'Current Plan' : 'Get Started';
        var disabledClass = (x === 0) ? 'disabled' : '';

        if (isAnyPurchased > 0) {
            //thClass = currentActivePlan.planPrice < curPlan.planPrice ? "recommended" : "";
            if (x == 3) {
                thClass = "recommended";
            }
            else {
                thClass = "";
            }


            if (currentActivePlan?.planType?.toLowerCase() == "year") {
                if (selectedPlanType == "month") {
                    //thClass = currentActivePlan.planPrice < curPlan.planPrice ? "recommended" : "";
                    if (x == 3 && currentActivePlan.planPrice < curPlan.planPrice) {
                        thClass = "recommended";
                    }
                    else {
                        thClass = "";
                    }

                    htmlMonth += `
                    <td class="${thClass} ${thActivelass}"">
                        <form action="/create-checkout-session/${curPlan.paymentPlanID}" method="POST">                           

                            ${currentActivePlan.planPrice == curPlan.planPrice
                            ? `<a href="/currentsubscription" class="getstarted">Plan Details</a>`
                        : `<button class="getstarted" ${currentActivePlan.planPrice > curPlan.planPrice ? 'style="display:none"' : ''}>
                                                   ${isAnyPurchased > 0 && currentActivePlan.planPrice < curPlan.planPrice
                                ? 'Upgrade'
                                : 'Get Started'}
                                   </button>`
                        }


                        </form>  
                    </td>`;
                }
                else {
                    if (currentActivePlan.planIndex >= 5) {
                        thClass = "";
                    }
                    htmlMonth += `
                    <td class="${thClass} ${thActivelass}"">
                        <form action="/create-checkout-session/${curPlan.paymentPlanID}" method="POST">                           

                            ${currentActivePlan.planPrice == curPlan.planPrice
                            ? `<a href="/currentsubscription" class="getstarted">Plan Details</a>`
                            : `<button class="getstarted" ${currentActivePlan.planPrice > curPlan.planPrice ? 'style="display:none"' : ''}>
                                                   ${isAnyPurchased > 0 && currentActivePlan.planPrice < curPlan.planPrice
                                ? 'Upgrade'
                                : 'Get Started'}
                                   </button>`
                        }


                        </form>  
                    </td>`;

                }
                
            }
            else if (currentActivePlan?.planType?.toLowerCase() == "month") {
                if (selectedPlanType == "month") {
                    if (currentActivePlan.planIndex >= 5) {
                        thClass = "";
                    }
                    htmlMonth += `
                    <td class="${thClass} ${thActivelass}"">
                        <form action="/create-checkout-session/${curPlan.paymentPlanID}" method="POST">                           

                            ${currentActivePlan.planPrice == curPlan.planPrice
                            ? `<a href="/currentsubscription" class="getstarted">Plan Details</a>`
                            : `<button class="getstarted" 
                                                      ${item.planPrice === 0 || currentActivePlan.planPrice > curPlan.planPrice
                                ? 'style="display:none"'
                                : ''}>
                                                   ${isAnyPurchased > 0 && currentActivePlan.planPrice < curPlan.planPrice
                                ? 'Upgrade'
                                : 'Get Started'}
                                               </button>`
                        }


                        </form>  
                    </td>`;
                }
                else {
                    if (currentActivePlan.planIndex >= 5) {
                        thClass = "";
                    }
                    htmlMonth += `
                    <td class="${thClass} ${thActivelass}"">
                        <form action="/create-checkout-session/${curPlan.paymentPlanID}" method="POST">                           

                            ${currentActivePlan.planPrice == curPlan.planPrice
                            ? `<a href="/currentsubscription" class="getstarted">Plan Details</a>`
                        : `<button class="getstarted" ${currentActivePlan.planIndex > curPlan.planIndex ? 'style="display:none"' : ''}>
                                 ${isAnyPurchased > 0 && currentActivePlan.planPrice < curPlan.planPrice ? 'Upgrade' : 'Get Started'}
                               </button>`
                        }


                        </form>  
                    </td>`;

                }
            }
            else {
                htmlMonth += `
                    <td class="${thClass} ${thActivelass}"">
                        <form action="/create-checkout-session/${curPlan.paymentPlanID}" method="POST">                           

                            ${currentActivePlan.planPrice == curPlan.planPrice
                        ? `<a href="/currentsubscription" class="getstarted">Plan Details</a>`
                        : `<button class="getstarted ${curPlan.planPrice === 0 || currentActivePlan.planPrice > curPlan.planPrice ? 'disabled' : ''}">
                                                   ${isAnyPurchased > 0 && currentActivePlan.planPrice < curPlan.planPrice
                            ? 'Upgrade'
                            : 'Get Started'}
                                   </button>`
                    }


                        </form>  
                    </td>`;

            }
        }
        else {

            htmlMonth += `
                    <td class="${thClass} ${thActivelass}"">
                        <form action="/create-checkout-session/${curPlan.paymentPlanID}" method="POST">  
                                <button class="getstarted ${disabledClass}">${buttonName} </button>
                        </form>  
                    </td>`;

        }
    }

    htmlMonth += `</tr>`; // Closing the row

        
    
        
    
    htmlMonth += `</tbody></table>`

    $("#divPlans").html(htmlMonth);
    //$("#divPlansYearly").html(htmlYear);
                // Uncomment to display features
                // BindFeatures();
}

//toggle subsription plans
function TogglePlan(checkbox, monthlyPlanID, yearlyPlanID) {
    let selectedPlanID = checkbox.checked ? yearlyPlanID : monthlyPlanID;
    BindPlansDetails(PlanPriceModel, selectedPlanID);
}

//close popip
function CloseSubscriptionPopup() {
    var popupid = document.querySelector("#divSubscriptionpopup");
    if (popupid) {
        popupid.style.display = "none";
    }
}

function editProfile() {
    window.location.href = "/EditProfile";
}