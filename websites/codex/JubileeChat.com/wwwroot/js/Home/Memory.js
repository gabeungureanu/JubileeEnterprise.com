//Global variaable
var currentMemoryID = null;

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
    BindUserMemory();
   
});

//Open right nav
function openrightnav() {
    if (currentMemoryID == null) {
        showNotification("", "Please select atleast one user memory!", "error", false);
        return;
    }

    let edit = document.querySelector(".edit-panel");
    if (edit) {
        edit.classList.toggle("active");
    }
}

function BindUserMemory() {
    var htmlMemory = "";
    $.ajax({
        type: "POST",
        url: "/Home/GetUserMemory",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
        },
        success: function (response) {
            if (response != null && response.length > 0) {
                $("#divMemoryData").html(""); // Clear existing content
                
                for (var i = 0; i < response.length; i++) {
                    var domainItem = response[i];

                    if (i == 0) {
                        htmlMemory += `
                                <div class="mm-item active" id="divparent${domainItem.id}">
                                <div class="mm-item-title m-0">
                                <div class="mm-nav-icon mm-expand" onclick="CollapseExpandParent('${domainItem.id}')">&#x2b;</div>
                                <div class="mm-nav-icon mm-collapse" onclick="CollapseExpandParent('${domainItem.id}')">&#x2212;</div>`
                    }
                    else {
                        htmlMemory += `
                                <div class="mm-item" id="divparent${domainItem.id}">
                                <div class="mm-item-title m-0">
                                <div class="mm-nav-icon mm-expand" onclick="CollapseExpandParent('${domainItem.id}')">&#x2b;</div>
                                <div class="mm-nav-icon mm-collapse" onclick="CollapseExpandParent('${domainItem.id}')">&#x2212;</div>
                        `
                    }


                    htmlMemory += `<p>${domainItem.domain}</p>                            `
                    htmlMemory += `</div>`

                    htmlMemory += `<div class="mm-item-nav">`

                    for (var j = 0; j < domainItem.memoryList.length; j++) {
                        var memory = domainItem.memoryList[j];
                        if (j == 0) {
                            htmlMemory += `<div class="mm-item-nav-row" id="divchild${memory.memoryID}" onclick="SetMemoryItem('${memory.memoryID}', '${memory.memoryData}')">`
                        }
                        else {
                            htmlMemory += `<div class="mm-item-nav-row" id="divchild${memory.memoryID}" onclick="SetMemoryItem('${memory.memoryID}', '${memory.memoryData}')">`
                        }

                        htmlMemory += `<div class="mm-item-nav-row-icon"><img src="/images/memory-card.svg" /></div>
                                <p id="parammemory${memory.memoryID}">${memory.memoryData}</p>
                                <div class="mm-row-trash" title="Delete Row" onclick="showDeletePopup('${memory.memoryID}')">
                                 <img src="/images/trash-icon.svg" />
                                </div>                           
                             `
                        htmlMemory += `</div>`
                    }
                    htmlMemory += `</div>`
                    htmlMemory += `</div>`

                }
                $("#divMemoryData").html(htmlMemory);

            }
            else {
                htmlMemory += `<div id="no-data" class="no-data-message">
                                 <image src="/images/no-data.jpg" alt="No data found" />
                                </div>`
                $("#divMemoryData").html(htmlMemory);
            }
        },
        error: function (error) {
             alert(error.responsetype);
        }
    });
}
//Delete memory data.
function DeleteMemoryData() {

    if (currentMemoryID == null) {
        alert("No item selected for deletion.");
        return;
    }

    $.ajax({
        type: "POST",
        url:"/Home/DeleteUserMemoryData",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            MemoryID: currentMemoryID
        },
        success: function (response) {
            if (response != null) {
                if (response.msg == "success") {
                    showNotification("success", "user selected memory delete Successfully!", "success", true);
                    $("#DeleteMessagePopup").hide();
                    $("#divchild" + currentMemoryID).remove();


                    let edit = document.querySelector(".edit-panel");
                    if (edit && edit.classList.contains("active")) {
                        edit.classList.remove("active");
                    }

                }
                else {
                    showNotification("", "Failed to delete selected user memory!", "error", false);
                }
                
            }
        },
        error: function (error) {
            alert(error);
        }
    });
}

function CollapseExpandParent(id) {    
    $("#divparent" + id).toggleClass("active");
}
function SetMemoryItem(id, memoryData) {
    $(".mm-item-nav-row").removeClass("activeRow");
    $("#divchild" + id).toggleClass("activeRow");
    currentMemoryID = id;

    $("#parausermemory").html(memoryData);
}
//Hide delete popup.
function hideDeletePopup() {
    $("#DeleteMessagePopup").hide();
    currentMemoryID = null;
}
//Show delete popup.
function showDeletePopup(memoryID) {
    $("#DeleteMessagePopup").show();
    currentMemoryID = memoryID;
}

//Update memory data
function updateMemoryData() {
    if (currentMemoryID == null) {
        alert("No item selected for deletion.");
        return;
    }
    let memoryData = $("#parausermemory").text();
    $.ajax({
        type: "POST",
        url: "/Home/UpdateMemoryData",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            MemoryID: currentMemoryID,
            Memorydata: memoryData
        },
        success: function (response) {
            if (response != null) {
                currentMemoryID == null
                if (response.msg == "success") {
                    $("#parammemory" + currentMemoryID).html(memoryData);
                }
                else {
                    showNotification("", "Failed to update data!", "error", false);
                }
            }
        },
        error: function () {
            showNotification("", "failed to update memory data.", "error", false);
        }
    });





}

function editProfile() {
    window.location.href = "/EditProfile";
}