/**
* Template Name: Flattern
* Template URL: https://bootstrapmade.com/flattern-multipurpose-bootstrap-template/
* Updated: Aug 07 2024 with Bootstrap v5.3.3
* Author: BootstrapMade.com
* License: https://bootstrapmade.com/license/
*/

(function () {
    "use strict";

    /**
     * Apply .scrolled class to the body as the page is scrolled down
     */
    function toggleScrolled() {
        const selectBody = document.querySelector('body');
        const selectHeader = document.querySelector('#header');
        if (!selectHeader.classList.contains('scroll-up-sticky') && !selectHeader.classList.contains('sticky-top') && !selectHeader.classList.contains('fixed-top')) return;
        window.scrollY >= 150 ? selectBody.classList.add('scrolled') : selectBody.classList.remove('scrolled');
    }

    document.addEventListener('scroll', toggleScrolled);
    window.addEventListener('load', toggleScrolled);

    /**
     * Mobile nav toggle
     */
    const mobileNavToggleBtn = document.querySelector('.mobile-nav-toggle');

    function mobileNavToogle() {
        document.querySelector('body').classList.toggle('mobile-nav-active');
        mobileNavToggleBtn.classList.toggle('bi-list');
        mobileNavToggleBtn.classList.toggle('bi-x');
    }
    mobileNavToggleBtn.addEventListener('click', mobileNavToogle);

    /**
     * Hide mobile nav on same-page/hash links
     */
    document.querySelectorAll('#navmenu a').forEach(navmenu => {
        navmenu.addEventListener('click', () => {
            if (document.querySelector('.mobile-nav-active')) {
                mobileNavToogle();
            }
        });

    });

    /**
     * Toggle mobile nav dropdowns
     */
    document.querySelectorAll('.navmenu .toggle-dropdown').forEach(navmenu => {
        navmenu.addEventListener('click', function (e) {
            e.preventDefault();
            this.parentNode.classList.toggle('active');
            this.parentNode.nextElementSibling.classList.toggle('dropdown-active');
            e.stopImmediatePropagation();
        });
    });

    /**
     * Preloader
     */
    const preloader = document.querySelector('#preloader');
    if (preloader) {
        window.addEventListener('load', () => {
            preloader.remove();
        });
    }

    /**
     * Scroll top button
     */
    let scrollTop = document.querySelector('.scroll-top');

    function toggleScrollTop() {
        if (scrollTop) {
            window.scrollY > 100 ? scrollTop.classList.add('active') : scrollTop.classList.remove('active');
        }
    }
    scrollTop.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    window.addEventListener('load', toggleScrollTop);
    document.addEventListener('scroll', toggleScrollTop);

    /**
     * Animation on scroll function and init
     */
    function aosInit() {
        AOS.init({
            duration: 600,
            easing: 'ease-in-out',
            once: true,
            mirror: false
        });
    }
    window.addEventListener('load', aosInit);

    /**
     * Auto generate the carousel indicators
     */
    document.querySelectorAll('.carousel-indicators').forEach((carouselIndicator) => {
        carouselIndicator.closest('.carousel').querySelectorAll('.carousel-item').forEach((carouselItem, index) => {
            if (index === 0) {
                carouselIndicator.innerHTML += `<li data-bs-target="#${carouselIndicator.closest('.carousel').id}" data-bs-slide-to="${index}" class="active"></li>`;
            } else {
                carouselIndicator.innerHTML += `<li data-bs-target="#${carouselIndicator.closest('.carousel').id}" data-bs-slide-to="${index}"></li>`;
            }
        });
    });

  ///**
  // * Initiate glightbox
  // */
  //const glightbox = GLightbox({
  //  selector: '.glightbox'
  //});

    /**
     * Init isotope layout and filters
     */
    document.querySelectorAll('.isotope-layout').forEach(function (isotopeItem) {
        let layout = isotopeItem.getAttribute('data-layout') ?? 'masonry';
        let filter = isotopeItem.getAttribute('data-default-filter') ?? '*';
        let sort = isotopeItem.getAttribute('data-sort') ?? 'original-order';

        let initIsotope;
        imagesLoaded(isotopeItem.querySelector('.isotope-container'), function () {
            initIsotope = new Isotope(isotopeItem.querySelector('.isotope-container'), {
                itemSelector: '.isotope-item',
                layoutMode: layout,
                filter: filter,
                sortBy: sort
            });
        });

        isotopeItem.querySelectorAll('.isotope-filters li').forEach(function (filters) {
            filters.addEventListener('click', function () {
                isotopeItem.querySelector('.isotope-filters .filter-active').classList.remove('filter-active');
                this.classList.add('filter-active');
                initIsotope.arrange({
                    filter: this.getAttribute('data-filter')
                });
                if (typeof aosInit === 'function') {
                    aosInit();
                }
            }, false);
        });

    });

    /**
     * Animate the skills items on reveal
     */
    let skillsAnimation = document.querySelectorAll('.skills-animation');
    skillsAnimation.forEach((item) => {
        new Waypoint({
            element: item,
            offset: '80%',
            handler: function (direction) {
                let progress = item.querySelectorAll('.progress .progress-bar');
                progress.forEach(el => {
                    el.style.width = el.getAttribute('aria-valuenow') + '%';
                });
            }
        });
    });

    /**
     * Init swiper sliders
     */
    function initSwiper() {
        document.querySelectorAll(".init-swiper").forEach(function (swiperElement) {
            let config = JSON.parse(
                swiperElement.querySelector(".swiper-config").innerHTML.trim()
            );

            if (swiperElement.classList.contains("swiper-tab")) {
                initSwiperWithCustomPagination(swiperElement, config);
            } else {
                new Swiper(swiperElement, config);
            }
        });
    }

    window.addEventListener("load", initSwiper);

})();

//================== Custom JS ==================//
$(document).ready(function () {
    const formInputs = $('#name, #email, #subject, #message');
    const submitBtn = $('#submitBtn');

    // Function to check if any field has value
    function toggleSubmitButton() {
        let anyFieldFilled = false;

        formInputs.each(function () {
            if ($(this).val().trim() !== '') {
                anyFieldFilled = true;
                return false; // break loop
            }
        });

        submitBtn.prop('disabled', !anyFieldFilled);
    }

    // Listen for typing or pasting in any input
    formInputs.on('input change', function () {
        toggleSubmitButton();
    });

    // Run on page load (in case autofill pre-fills something)
    toggleSubmitButton();

    // ✅ Notification display using TempData
   
});

// ✅ General Notification Function
function showNotification(title, message, type = 'info') {
    Swal.fire({
        title: title || '',
        text: message || '',
        icon: type,
        position: 'center',
        width: 400,
        background: '#ffffff',
        color: '#333',
        showConfirmButton: true,
        confirmButtonText: 'OK',
        confirmButtonColor: '#3085d6',
        showClass: {
            popup: 'animate__animated animate__fadeInDown'
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOutUp'
        },
        customClass: {
            popup: 'square-popup'
        },
        didOpen: () => {
            document.querySelector('.square-popup').style.height = '400px';
        }
    });
}

// ✅ Subscription Notification Function
function showSubscribeNotification(message) {
    Swal.fire({
        title: 'Subscription Successful!',
        text: message || "Thank you for subscribing. You'll now receive our latest updates and newsletters.",
        icon: 'success',
        position: 'center',
        width: 400,
        background: '#ffffff',
        color: '#333',
        showConfirmButton: true,
        confirmButtonText: 'OK',
        confirmButtonColor: '#28a745',
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
        customClass: {
            popup: 'square-popup'
        },
        didOpen: () => {
            document.querySelector('.square-popup').style.height = '400px';
        }
    });
}


// ✅ Submit Donation Data via AJAX
function submitUserDonationData() {
    var isValid = validateAddress();
    if (!isValid) return;
    var countryOCde = $(".iti__selected-dial-code").text()
    console.log(countryOCde);
    // STEP 1 — Collect all values in a JS object
    var userDetails = {
        //IsOneTimepayment: 1,
        //IsRecurringPayment: $('#IsDonateMonthly').is(':checked'),
        DonationAmount: parseInt($('#txtdonateAmount').val()) || 0,
        IsCustomMsg: $('#flexCheckDefault').is(':checked'),
        CustomMsg: $('#txtcustomMsg').val().trim(),
        FirstName: $('#txtfirstname').val().trim(),
        LastName: $('#txtlastname').val().trim(),
        EmailAddress: $('#txtemail').val().trim(),
        CountryCode: $(".iti__selected-dial-code").text().trim(),
        PhoneNumber: $("#phone").val(),
        StreetAddress: $('#txtAddress').val().trim(),
        Apartment: $('#txtAppartment').val().trim(),
        City: $('#txtCity').val().trim(),
        State: $('#txtState').val().trim(),
        Zipcode: $('#txtZipCode').val().trim(),
        Country: $('#ddlCountry').val(),
        IsSubscribe: $('#flexCheckDefaultSub').is(':checked'),
        IsOrganization: $('#isOrganization').is(':checked'),
        OrganizationName: $('#txtorganization').val().trim()
    };

    console.log('Donation Data:', userDetails); // Debug log

    // STEP 2 — Create FormData & append values
    var formData = new FormData();
    for (const key in userDetails) {
        formData.append(key, userDetails[key]);
    }

    // STEP 3 — AJAX Call
    $.ajax({
        url: '/Home/InsertUserDonationDetails',
        type: 'POST',
        data: formData,
        contentType: false,
        processData: false,
        beforeSend: function () {
            $('#btnDonate').prop('disabled', true).text('Processing...');
        },
        success: function (response) {
            if (response && response.insertedUserId) {
                //forward to stripe for payment
                //window.location.href = "checkout-session/" + response.insertedUserId;
                window.open("checkout-session/" + response.insertedUserId, "_self");

            } else {
                Swal.fire('Info', 'Donation processed, but no ID returned.', 'info');
            }
        },
        error: function (xhr) {
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Something went wrong while submitting your donation.'
            });
            console.error('Error:', xhr);
        },
    });
}

// ✅ Optional: Form Reset Function (clean UI after success)
function resetDonationForm() {
    $('#IsDonateOnce').prop('checked', false);
    $('#IsDonateMonthly').prop('checked', false);
}





/*})();*/

function SelectDonateAount(element) {
    var id = element.id;
    var selectedAmount = $("#" + id).text().trim(); // e.g. "$750"

    // Remove the $ sign and any extra spaces
    selectedAmount = selectedAmount.replace('$', '').trim();

    console.log("Selected Amount:", selectedAmount);
    $("#txtdonateAmount").val(selectedAmount);
    // 🔹 Re-run validation when user selects a preset amount
    ValidateDonation();
}

//function ShowWindow(prev, next) {
//    var isvalidCust = validatecustmsg();

//    if ($("#" + prev).css("display") === "flex" || $("#" + prev).is(":visible")) {
//        var donationValue = $("#txtdonateAmount").val().trim();
//        var value = parseFloat(donationValue) || 0;

//        // 🔹 Validate donation amount
//        if (donationValue === "") {
//            $("#amount-validate")
//                .text("Please enter a donation amount.")
//                .show();
//            $("#txtdonateAmount").addClass("invalid-field");
//            return;
//        } else if (value < 5) {
//            $("#amount-validate")
//                .text("The minimum donation amount is $5.")
//                .show();
//            $("#txtdonateAmount").addClass("invalid-field");
//            return;
//        } else {
//            $("#amount-validate").hide();
//            $("#txtdonateAmount").removeClass("invalid-field");
//        }
//        // 🔹 Move to next step if valid
//        $("#" + prev).hide();
//        $("#" + next).css("display", "flex");
//    }
//    if (!isvalidCust) return;
//}

function ShowWindow(prev, next) {
    var isvalidCust = validatecustmsg();

    // Proceed only if the current section is visible
    if ($("#" + prev).css("display") === "flex" || $("#" + prev).is(":visible")) {
        var donationValue = $("#txtdonateAmount").val().trim();
        var value = parseFloat(donationValue) || 0;
        var isValidAmount = true;

        // 🔹 Validate donation amount
        if (donationValue === "") {
            $("#amount-validate").text("Please enter a donation amount.").show();
            $("#txtdonateAmount").addClass("invalid-field");
            isValidAmount = false;
        } else if (value < 5) {
            $("#amount-validate").text("The minimum donation amount is $5.").show();
            $("#txtdonateAmount").addClass("invalid-field");
            isValidAmount = false;
        } else {
            $("#amount-validate").hide();
            $("#txtdonateAmount").removeClass("invalid-field");
        }
        // 🔹 Only move to next if BOTH validations pass
        if (isValidAmount && isvalidCust) {
            $("#" + prev).hide();
            $("#" + next).css("display", "flex");
        } else {
            // Stay on current step if any validation fails
            return;
        }
    }
}


// 🔹 Validate amount while typing
function ValidateDonation() {
    var input = $("#txtdonateAmount");
    var value = input.val().trim();

    // Remove non-numeric characters
    if (value !== "" && !/^\d+$/.test(value)) {
        value = value.replace(/\D/g, '');
        input.val(value);
    }

    if (value === "") {
        $("#amount-validate")
            .text("Please enter a donation amount.")
            .show();
        input.addClass("invalid-field");
    } else if (parseInt(value) < 5) {
        $("#amount-validate")
            .text("The minimum donation amount is $5.")
            .show();
        input.addClass("invalid-field");
    } else {
        $("#amount-validate").hide();
        input.removeClass("invalid-field");
    }
}

function ShowStep() {
    $("#step1, #step2, #step3, #step4, #step5").hide();
    $("#step1").css("display", "flex");

    //$("#flexCheckDefault").prop("checked", false);
    $("#amount-validate").hide();
    $("#txtdonateAmount").val("").removeClass("invalid-field");
    //$("#txtcustomMsg").hide().val("");
}

// 🔹 Toggle custom message
function showcustomMsg(element, id) {
    if ($(element).prop("checked")) {
        $("#" + id).show();
    } else {
        $("#" + id).hide();
    }
}

function ShowBackWindow(prev, next) {
    $("#" + next).hide();
    $("#" + prev).css("display", "flex");
}

function ShowNextStep2(step2, step3) {
    var isvalid = validateForm(); // ✅ existing global function
    if (!isvalid) return;

    $("#" + step2).hide();
    $("#" + step3).css("display", "flex");
}

function ShowNextStep3(step3, step4) {
    $("#" + step3).hide();
    $("#" + step4).css("display", "flex");
}

function validatecustmsg() {
    var isvalidCust = true
    $("invalid-field").removeClass();
    // Validate Custom Message
    var isCustomMsg = $("#flexCheckDefault").prop("checked");
    if (isCustomMsg) {
        if ($("#txtcustomMsg").val().trim() === "") {
            $("#txtcustomMsg").addClass("invalid-field");
            isvalidCust = false;
        } else {
            $("#txtcustomMsg").removeClass("invalid-field");
        }
    }
    return isvalidCust;
}
function validateForm() {
    var isValid = true;

    // Clear previous error messages
    $("invalid-field").removeClass();

    // Validate Last Name
    if ($("#txtfirstname").val().trim() === "") {
        $("#txtfirstname").addClass("invalid-field");
        isValid = false;
    } else {
        $("#txtfirstname").removeClass("invalid-field");
    }
    // Validate Last Name
    if ($("#txtlastname").val().trim() === "") {
        $("#txtlastname").addClass("invalid-field");
        isValid = false;
    } else {
        $("#txtlastname").removeClass("invalid-field");
    }

    // Validate Email
    if ($("#txtemail").val().trim() === "") {
        $("#txtemail").addClass("invalid-field");
        isValid = false;
    } else {
        $("#txtemail").removeClass("invalid-field");
    }

    var isOrganization = $("#isOrganization").prop("checked");
    if (isOrganization) {
        // Validate Phone
        if ($("#txtorganization").val().trim() === "") {
            $("#txtorganization").addClass("invalid-field");
            isValid = false;
        } else {
            $("#txtorganization").removeClass("invalid-field");
        }
    }

    return isValid;
}

function validateAddress() {
    var isValid = true;

    // Clear previous error messages
    $("invalid-field").removeClass();

    // Validate street Address
    if ($("#txtAddress").val().trim() === "") {
        $("#txtAddress").addClass("invalid-field");
        isValid = false;
    } else {
        $("#txtAddress").removeClass("invalid-field");
    }
    // Validate City
    if ($("#txtCity").val().trim() === "") {
        $("#txtCity").addClass("invalid-field");
        isValid = false;
    } else {
        $("#txtCity").removeClass("invalid-field");
    }

    // Validate State
    if ($("#txtState").val().trim() === "") {
        $("#txtState").addClass("invalid-field");
        isValid = false;
    } else {
        $("#txtState").removeClass("invalid-field");
    }

    // Validate Zip Code
    if ($("#txtZipCode").val().trim() === "") {
        $("#txtZipCode").addClass("invalid-field");
        isValid = false;
    } else {
        $("#txtZipCode").removeClass("invalid-field");
    }

    return isValid;
}


