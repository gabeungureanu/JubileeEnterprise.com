var CurrentFileID = null;
var curFolderID = null;

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
    FetchShareDetails();

    $("#txtfilename, #txtfoldername").on("input", function () {
        $(this).removeClass("danger");
    });

});
var ShareListJson;
var CurShareListJson;
var shareIndex = 0;
var rootIdIndex = 0;
var rootIdsList;
var curIdSel;
var BoundIdList = [];
function FetchShareDetails() {
    var htmlMemory = "";
    $.ajax({
        type: "POST",
        url: "/Home/GetFilesDetails",
        contentType: "application/json;charset=utf-8",
        dataType: "json",
        async: true,
        data: {},
        success: function (response) {
            if (response != null && response.length > 0) {
                ShareListJson = response;
                CurShareListJson = response;

                shareIndex = 0;
                $("#divShareRedirect").html("");
                var curStructure = ShareListJson[shareIndex];

                for (let i = 0; i < ShareListJson.length; i++) {

                    let L_LevelNo = ShareListJson[i].folderlevel;
                    let L_ID = ShareListJson[i].id;
                    let L_RootID = ShareListJson[i].rootId;
                    let L_FolderName = ShareListJson[i].folderName;
                    let L_FileName = ShareListJson[i].fileName;
                    let L_IsFolder = ShareListJson[i].isFolder;
                    let L_FileID = ShareListJson[i].fileID;

                    let structure = ShareListJson[i];
                    let DivContainer = $("#divShareRedirect");
                    //alert(L_LevelNo);
                    if (L_LevelNo != null && L_LevelNo == 'Level_0') {
                        BindRootStructure(structure, DivContainer);
                    }
                    else {
                        DivContainer = $("#divShareRedirect");
                        Generate_HTML_Elements(L_LevelNo, L_ID, L_RootID, L_FolderName, L_FileName, DivContainer, L_IsFolder, L_FileID);
                    }


                }
            }
        },
        error: function (error) {
            alert("Error: " + error.responseText);
        }
    });
}

function Generate_HTML_Elements(L_LevelNo, L_ID, L_RootID, L_FolderName, L_FileName, DivContainer, L_IsFolder, L_FileID) {


    var additionalClass_Leval = "";

    switch (L_LevelNo) {
        case "Level_0":
            additionalClass_Leval = "mm-item-lvl";
            break;
        case "Level_2":
            additionalClass_Leval = "mm-item-lvl-2";
            break;
        case "Level_3":
            additionalClass_Leval = "mm-item-lvl-3";
            break;
        case "Level_4":
            additionalClass_Leval = "mm-item-lvl-4";
            break;
        case "Level_5":
            additionalClass_Leval = "mm-item-lvl-5";
            break;

    }

    let parts = L_LevelNo.split("_");

    if (parts.length === 2 && !isNaN(parts[1])) {
        // Increment the numeric part
        var NextLevel = `${parts[0]}_${parseInt(parts[1]) + 1}`;

        if (NextLevel == 'Level_5') {
            var hideFolder = 'Style="display:none;"'
        } else {
            var hideFolder = ''
        }

    }


    if (L_IsFolder) {
        var FolderHtml = `    <div class="mm-item-nav-row active  ${additionalClass_Leval} nav_${L_LevelNo} root_${L_RootID}"  id="SubFolderID_${L_ID}">
                                 <div class="mm-nav-icon mm-expand" onclick="CollapseExpandFolder('${L_ID}')">+</div>
                                   <div class="mm-nav-icon mm-collapse" onclick="CollapseExpandFolder('${L_ID}')">−</div>
                                    <div class="mm-item-nav-row-icon">
                                        <img src="/images/folder-add-2.svg" class="row-folder" />
                                        <img src="/images/add-file-2.svg" class="row-file" style="display:none;" />
                                    </div>                                   
                                    <input type="text" value="${L_FolderName}" readonly id="txtrenameFolder_${L_ID}" autocomplete="off"  onblur="EditFolderName('${L_ID}', 'txtrenameFolder_${L_ID}')"  >
                                    <div class="add-items">
                               
                                       <span ${hideFolder}  onclick="AddSubFolder('folderId_${L_ID}', 'IsRoot', '${NextLevel}')">
                                            <img src="/images/folder-add-2.svg" alt="Add Folder" title="Add New Folder" />
                                        </span>

                                        <span onclick="AddNewFile('folderId_${L_ID}', 'No', '${NextLevel}')">
                                            <img src="/images/add-file-2.svg" alt="Add File" title="Add New File" />
                                        </span>
                                        <span onclick="showDeletePopup('ID_${L_ID}',true)">
                                            <img src="/images/trash-icon.svg" alt="Delete Folder" title="Delete Folder">
                                        </span>
                                        <span  onclick="renameFolder('txtrenameFolder_${L_ID}');">
                                            <img src="/images/edit-icon2.svg" alt="Edit" title="Edit">
                                        </span>
                                    </div>
                                      
                                </div>
    <div class="mm-item-nav" id="navitem_${L_ID}">
    </div>`;
        DivContainer = $("#navitem_" + L_RootID);
        $(DivContainer).append(FolderHtml);
    }
    else {
        var FileHtml = `
                                <div class="mm-item-nav-row ${additionalClass_Leval}  root_${L_RootID}" id="Level_${L_FileID}" onclick="SetFile(${L_FileID})">
                                    <div class="mm-item-nav-row-icon">
                                        <img src="/images/add-file-2.svg">
                                    </div>
                                    <p>${L_FileName}</p>
                                    <div class="add-items">
                                        <span onclick="showDeletePopup('folderId_${L_ID}',false)">
                                            <img src="/images/trash-icon.svg" alt="Delete File" title="Delete File">
                                        </span>
                                    </div>
                                </div>`;

        //$($(containerCtrl).find(".mm-item-nav")).append(FileHtml);
        DivContainer = $("#navitem_" + L_RootID);
        $(DivContainer).append(FileHtml);
    }

}

//function renameFolder(folderID) {
//    var renameFolderInput = folderID;
//    if (renameFolderInput) {
//        renameFolderInput.classList.add("edit-txt"); // Add class
//        renameFolderInput.removeAttribute("readonly"); // Remove readonly attribute
//    }
//}
function renameFolder(folderID) {
    curFolderID = folderID;
    var renameFolderInput = document.getElementById(folderID);
    if (renameFolderInput) {
        renameFolderInput.classList.add("edit-txt"); // Add class
        renameFolderInput.removeAttribute("readonly"); // Remove readonly attribute
        renameFolderInput.focus(); // Set focus to the input field
        renameFolderInput.select(); // Select the text for easy editing
    }
}


function EditFolderName(id, folderName) {
    var Id = id;
    var folderName = $("#" + folderName).val();

    $.ajax({
        type: "POST",
        url: "/Home/RenameFolderName",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            ID: Id,
          FolderName: folderName
        },
        success: function (response) {
            if (response != null) {
                if (response.status) {
                    $("#" + folderName).val(response.folderName);

                    var renameFolderInput = document.getElementById(curFolderID);
                    if (renameFolderInput) {
                        renameFolderInput.classList.remove("edit-txt"); // Remove the editing class
                        renameFolderInput.setAttribute("readonly", true); // Reapply the readonly attribute
                    }
                    curFolderID = null;

                }
                else {
                    showNotification("", "Failed to rename folder", "error", false);
                }
            }
        },
        error: function (xhr, status, error) {
            console.error("Error:", xhr.responseText);
            showNotification("", "An error occurred while renaming the folder", "error", false);
        }
    });
}



//Accordian of folder structure
function CollapseExpandFolder(id) {
    var subFolder = document.getElementById("SubFolderID_" + id);
    var navItem = document.getElementById("navitem_" + id);
    var collapseIcon = subFolder.querySelector(".mm-collapse");
    var expandIcon = subFolder.querySelector(".mm-expand");

    if (subFolder && navItem) {
        if (subFolder.classList.contains("active")) {
            subFolder.classList.remove("active");
            navItem.style.display = "none";
            collapseIcon.style.display = "none";
            expandIcon.style.display = "flex";
        } else {
            subFolder.classList.add("active");
            navItem.style.display = "block";
            collapseIcon.style.display = "flex";
            expandIcon.style.display = "none";
        }
    }
}
//Bind Root folder
function BindRootStructure(structure, containerCtrl) {
    BoundIdList.push(structure.id);
    var htmlMemory = `<div class="mm-item active  root_${structure.rootId}" data-root="${structure.rootId}" id="folderId_${structure.id}">
                                <div class="mm-item-title clsparentfolder m-0">
                                    <div class="mm-nav-icon mm-expand" onclick="CollapseExpandParent('${structure.rootId}')">+</div>
                                    <div class="mm-nav-icon mm-collapse" onclick="CollapseExpandParent('${structure.rootId}')">−</div>
                                    <p>${structure.folderName}</p>
                                    <div class="add-items">
                                        <span onclick="AddSubFolder('folderId_${structure.rootId}', 'IsRoot', 'Level_1')">
                                            <img src="/images/folder-add-2.svg" alt="Create New Folder" title="Create New Folder">
                                        </span>
                                        <span onclick="AddNewFile('folderId_${structure.rootId}', 'No', 'Level_1')">
                                            <img src="/images/add-file-2.svg" alt="Upload New File" title="Upload New File">
                                        </span>
                                        <span onclick="showDeletePopup('folderId_${structure.rootId}',true)">
                                            <img src="/images/trash-icon.svg" alt="Delete Folder" title="Delete Folder">
                                        </span>
                                    </div>
                                </div>
                                <div class="mm-item-nav" id="navitem_${structure.id}">
                                </div>
                            </div>`;
    $(containerCtrl).append(htmlMemory);
}



//Open right nav
function openrightnav() {
    //remove validation
    $("#txtRedirect").removeClass("danger");
    $("#txtfilename").removeClass("danger");
    $("#txtsharelink").val("");
    //remove selected file
    $("#Level_" + CurrentFileID).removeClass("active");

    // Clear Dropzone files
    let dropzoneInstance = Dropzone.forElement("#uploader");
    if (dropzoneInstance) {
        dropzoneInstance.removeAllFiles(true);
    }

    if (CurrentFileID == null) {
        showNotification("", "Please create and select file!", "error", false);
        return;
    }

    let edit = document.querySelector(".edit-panel");
    if (edit) {
        edit.classList.remove("active");
        CurrentFileID = null;
    }
}
function copyShareURL() {
    var ShareURL = $("#txtsharelink").val();

    // Create a temporary textarea element to copy the URL
    var tempTextArea = document.createElement("textarea");
    tempTextArea.value = ShareURL;

    // Append the textarea to the document
    document.body.appendChild(tempTextArea);

    // Select the text inside the textarea
    tempTextArea.select();
    tempTextArea.setSelectionRange(0, 99999); // For mobile devices

    // Execute the copy command
    document.execCommand("copy");

    // Remove the temporary textarea element from the document
    document.body.removeChild(tempTextArea);


}

document.addEventListener("DOMContentLoaded", function () {
    let myDropzone = new Dropzone("#uploader", {
        dictDefaultMessage: "",  // Remove default message
        paramName: "file", // Name of the file input field
        maxFilesize: 100, // MB
        init: function () {
            this.on("addedfile", function (file) {
                // Validate file name and redirect URL before allowing upload
                var isFileNameValid = validateFileName();
                //var isRedirectURLValid = validateRedirectURL();

                if (!isFileNameValid) {
                    this.removeFile(file); // Remove file if validation fails
                    
                    return;
                }

                // Check for 0-byte file
                if (file.size === 0) {
                    this.removeFile(file);
                    showNotification("", "Uploading 0-byte files is not allowed.", "error", false);
                }
            });

            this.on("sending", function (file, xhr, formData) {
                formData.append("CurrentFileID", CurrentFileID); // Attach the CurrentFileID dynamically
            });

            this.on("success", function (file, response) {
                let dropzoneInstance = this;

                // Add click event to remove file when clicking on dz-success elements
                file.previewElement.addEventListener("click", function () {
                    dropzoneInstance.removeFile(file);
                    $.ajax({
                        type: "POST",
                        url: "/Home/RemoveUploadedFile",
                        contenttype: "application/json;charset=utf-8",
                        datatype: "json",
                        async: true,
                        data: {
                            "FileID": CurrentFileID,
                        },
                        success: function (response) {
                            if (response != null) {
                                console.log('File remove successfully')
                                $("#imageQR").css("display", "none");
                                $("#qrtext").css("display", "flex");
                                $("#txtsharelink").val("");
                            }
                        },
                        error: function (error) {
                            showNotification("", "failed to remove uploaded file", "error", false);
                        }
                    });

                    //window.location.href = "/RemoveUploadedFile/" + encodeURIComponent(CurrentFileID);
                });

                $("#txtsharelink").val(response.message);
                $("#hdnshareID").val(response.shareID);

                let qrImagePath = "/QRCodeImages/QRCode.png"; // Set the expected image path
                $("#QRImage").attr("src", qrImagePath).on("load", function () {
                    $("#imageQR").css("display", "flex");
                    $("#qrtext").css("display", "none");
                }).on("error", function () {
                    $("#imageQR").css("display", "none");
                    $("#qrtext").css("display", "flex");
                });
            });

            this.on("error", function (file, errorMessage) {
                alert("Error uploading file: " + errorMessage);
            });
        }
    });
});

function saveFileDetails() {
    var FileID = CurrentFileID;
    var fileName = $("#txtfilename").val().trim();
    var shareDescription = $("#txtdesc").val().trim();
    var redirectURL = $("#txtRedirect").val().trim();
    var isPublic = $("#cbtest-19").prop("checked");

    // Validate both fields
    var isFileNameValid = validateFileName();
    //var isRedirectURLValid = validateRedirectURL();

    // Stop execution if validation fails
    if (!isFileNameValid) {
        return;
    }
    //validateFileName();
    //validateRedirectURL();
    //if (fileName != "" && fileName != null && fileID != undefined && redirectURL != "" && redirectURL != null && redirectURL != undefined) {
    $.ajax({
        type: "POST",
        url: "/Home/SaveFileDetails",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {

            "FileID": FileID,
            "FileName": fileName,
            "ShareDescription": shareDescription,
            "RedirectURL": redirectURL,
            "IsPublic": isPublic,
        },
        success: function (response) {
            CurrentFileID = null;
            //console.log("Server Response " + response)
            if (response.status) {
                showNotification("", "File details saved successfully", "success", true);
                setTimeout(function () {
                    window.location.reload();
                }, 3000);

            } else {
                showNotification("", "Failed to insert file details", "error", false);
            }
        },
        error: function (error) {
            console.error("Error occurred:", error.responseText || error);
        }
    });
    /*}*/
    //else {
    //    validateFileName();
    //    validateRedirectURL();
    //}
}

function CollapseExpandParent(id) {
    $("#folderId_" + id).toggleClass("active");
}
//function CollapseExpandParent(id) {
//    $("#divparent" + id).toggleClass("active");
//}
function closeFolderPopup() {
    var closebtn = document.getElementById('FolderPopup');
    if (closebtn) {
        closebtn.style.display = "none";
    }
    $("#selectedFolderId").val("");
    $("#txtfoldername").val("");
    $("#hdnid").val("");
    $("#level").val("");

}
//Close file popup
function closeFilePopup() {
    var closebtn = document.getElementById('FilePopup');
    if (closebtn) {
        closebtn.style.display = "none";
    }
    $("#selectedFolderId").val("");
    $("#filename").val("");
    $("#hdnid").val("");
    $("#level").val("");

}

function AddFolder(msg) {
    if (msg == "IsRoot") {
        var IsRoot = true;
    } else {
        var IsRoot = false;
    }
    $("#selectedFolderId").val(IsRoot);
    var closebtn = document.getElementById('FolderPopup');
    if (closebtn) {
        closebtn.style.display = "flex";
    }
}
function AddSubFolder(Id, IsRoot, Level) {
    var folderID = Id.split('_')[1];
    $("#hdnid").val(folderID);

    if (IsRoot == "IsRoot") {
        var IsRoot = true;
    } else {
        var IsRoot = false;
    }
    $("#selectedFolderId").val(IsRoot);
    $("#txtfoldername").val("");
    $("#level").val(Level);
    var closebtn = document.getElementById('FolderPopup');
    if (closebtn) {
        closebtn.style.display = "flex";
    }
}
function AddNewFile(Id, IsRoot, Level) {
    var folderID = Id.split('_')[1];
    $("#hdnid").val(folderID);

    if (IsRoot == "IsRoot") {
        var IsRoot = true;
    } else {
        var IsRoot = false;
    } $("#txtfilename").val("");
    $("#selectedFolderId").val(IsRoot);

    $("#level").val(Level);
    var closebtn = document.getElementById('FilePopup');
    if (closebtn) {
        closebtn.style.display = "none";
    }
    createNewFolder('filename');
}

function SetFile(Fileid) {
    //Remove danger 
    $("#txtfilename").removeClass("danger");
    $("#txtRedirect").removeClass("danger");

    $(".mm-item-nav-row").removeClass("active");
    $("#Level_" + Fileid).toggleClass("active");
    CurrentFileID = Fileid;

    let edit = document.querySelector(".edit-panel");
    if (edit) {
        edit.classList.add("active");
    }

    $.ajax({
        type: "GET",
        url: "/Home/FilesDetailsGET",
        contentType: "application/json;charset=utf-8",
        dataType: "json",
        async: true,
        data: {
            FileID: CurrentFileID
        },
        success: function (response) {
            //console.log("Success:", response);
            if (response != null) {
                $("#txtfilename").val(response.fileName);
                $("#txtdesc").val(response.shareDescription);
                $("#txtRedirect").val(response.redirectURL);
                $("#txtsharelink").val(response.azurefilename);
                $("#cbtest-19").prop("checked", response.isPublic === "1" || response.isPublic === true);
                let qrImagePath = "/QRCodeImages/QRCode.png"; // Set the expected image path
                $("#QRImage").attr("src", qrImagePath).on("load", function () {
                    $("#imageQR").css("display", "flex");
                    $("#qrtext").css("display", "none");
                }).on("error", function () {
                    $("#imageQR").css("display", "none");
                    $("#qrtext").css("display", "flex");
                });
            } else {
                $("#txtfilename").val("");
                $("#txtdesc").val("");
                $("#txtRedirect").val("");
                $("#txtsharelink").val("");
                $("#cbtest-19").prop("checked", false); // Uncheck the checkbox
            }

        },
        error: function (error) {
            console.error("Error:", error);
        }
    });
}

function createNewFolder(inputId) {
    var fileName = document.getElementById(inputId).value;
    var FolderID = $("#hdnid").val();
    var level = $("#level").val();
    var IsRoot = $("#selectedFolderId").val().trim();
    var foldername = fileName.trim();

    if (inputId != "filename") {
        var isFolderNameValid = validateFolderName();
        if (!isFolderNameValid) {
            return;
        }
    }
    

    $.ajax({
        type: "POST",
        url: "/Home/SaveFileStructure",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            IsFolder: IsRoot,
            FolderName: foldername,
            ID: FolderID,
            Folderlevel: level
        },
        success: function (response) {
            if (response != null) {
                var Message = response.message;
                if (Message != null) {
                    if (Message.toLowerCase() == "folder name already exists") {
                        showNotification("", "Folder name already exists", "error", false);
                    } else if (Message.toLowerCase() == "container creation failed.") {
                        showNotification("", "Container creation failed.", "error", false);
                    }
                }
                closeFolderPopup();
                closeFilePopup();
                FetchShareDetails();
            }
        },
        error: function (error) {
            showNotification("","Failed to create", "error", false);
        }
    });
}
//Show delete popup.
function showDeletePopup(Id, isFolder) {
    $("#DeleteFolderPopup").show();
    if (Id != null && Id != undefined) {
        var folderID = Id.split('_')[1];
        $("#spnSelType").html(isFolder ? "folder" : "file");
        $("#hdnid").val(folderID);
        $("#IsFolder").val(isFolder);
    }
    //let edit = document.querySelector(".edit-panel");
    //if (edit) {
    //    edit.classList.remove("active");
    //}
}

//Hide delete popup.
function hideDeletePopup() {
    $("#DeleteFolderPopup").hide();
    currentMemoryID = null;
}
//Delete folder from Azure and DB
function DeleteFolder() {
    //var ID = $("#IsRoot").val().trim();
    //var FolderName = $("#hdnfoldername").val().trim();
    var ID = $("#hdnid").val();
    //var ID = 
    $.ajax({
        type: "POST",
        url: "/Home/DeleteFolder",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            ID: ID
            //FolderName: FolderName,
            //RootID: rootID
        },
        success: function (response) {
            if (response != null) {
                if (response.message == "Success") {
                    showNotification("success", "Delete Successfully!", "success", true);
                    $("#DeleteFolderPopup").hide();
                    setTimeout(function () {
                        window.location.reload();
                    }, 2000);

                }
                else {
                    $("#DeleteFolderPopup").hide();
                    showNotification("", "Please delete the sub-items first!", "error", false);
                }

            }
        },
        error: function (error) {
            //alert(error);
        }
    });
}



function validateFileName() {
    var fileName = $("#txtfilename").val().trim();

    if (!fileName) {
        $("#txtfilename").addClass("danger"); // Add error class
        return false;
    }

    $("#txtfilename").removeClass("danger"); // Remove error class if valid
    return true;
}

//function validateRedirectURL() {
//    var redirectURL = $("#txtRedirect").val().trim();

//    if (!redirectURL) {
//        $("#txtRedirect").addClass("danger"); // Add error class
//        return false;
//    }

//    $("#txtRedirect").removeClass("danger"); // Remove error class if valid
//    return true;
//}

function validateFolderName() {
    var folderName = $("#txtfoldername").val().trim();

    if (!folderName) {
        $("#txtfoldername").addClass("danger"); // Add error class
        return false;
    }

    $("#txtfoldername").removeClass("danger"); // Remove error class if valid
    return true;
}

function QRPopup() {
    var QR = document.getElementById('QRPopup');
    //var imgQR = document.getElementById('imgQR');
    if (QR) {
        QR.style.display = "flex";
    }
    $('#imgQR').attr("src", "");
    $('#imgQR').attr("src", "../QRCodeImages/QRCode.png?v=" + new Date().getUTCMilliseconds().toString());
}
function closeQRPopup() {
    var QR = document.getElementById('QRPopup');
    if (QR) {
        QR.style.display = "none";
    }
    $('#imgQR').attr("src", "");
}

function downloadQRImage(qrUrl, fileName = "qrcode.png") {
    fetch(qrUrl)
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        })
        .catch(error => console.error("Error downloading QR image:", error));
}

