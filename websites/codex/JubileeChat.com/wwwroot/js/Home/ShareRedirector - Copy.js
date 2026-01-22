var CurrentFileID = null;
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

    $("#txtfilename, #txtRedirect").on("input", function () {
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
                //console.log(response);
                shareIndex = 0;
                $("#divShareRedirect").html(""); // Clear existing content

                //var firstStructureId = ShareListJson[shareIndex].Id;
                //CurShareListJson = ShareListJson.filter(o => o.id == firstStructureId || o.rootId == firstStructureId);

                //var curStructure = CurShareListJson[shareIndex];
                // rootIdsList = [...new Set($.map(ShareListJson, function (item) {
                //    return item.rootId;
                //}))];
                //rootIdsList = [...new Set($.map(ShareListJson, function (item) {
                //    return item.id;
                //}))];
                //console.log(rootIdsList);
                //curIdSel = rootIdsList[rootIdIndex];
                //CurShareListJson = ShareListJson.filter(o => o.id == curIdSel || o.rootId == curIdSel);
                var curStructure = ShareListJson[shareIndex];
                //BoundIdList.push(curStructure.id);
                BindSharedStructure(curStructure, $("#divShareRedirect"));

            }
        },
        error: function (error) {
            alert("Error: " + error.responseText);
        }
    });
}


function BindSharedStructure(curStructure, mainContainer) {
    console.log("TEST");
    console.log(curStructure);

    if (curStructure.folderlevel.toLowerCase() == "") {

        BindRootStructure(curStructure, mainContainer);
    }
    else {
        BindLevelStructure(curStructure, mainContainer);
    }
    if (shareIndex < ShareListJson.length - 1) {
        shareIndex++;
        BindSharedStructure(ShareListJson[shareIndex], mainContainer);
    }

    //if (shareIndex < CurShareListJson.length - 1) {
    //    shareIndex++;
    //    BindSharedStructure(CurShareListJson[shareIndex], mainContainer);
    //}
    //else {
    //    if (rootIdIndex < rootIdsList.length - 1) {
    //        rootIdIndex++;
    //        curIdSel = rootIdsList[rootIdIndex];
    //        CurShareListJson = ShareListJson.filter(o => o.id == curIdSel || o.rootId == curIdSel);
    //        shareIndex = 0;
    //        BindSharedStructure(CurShareListJson[shareIndex], mainContainer);
    //    }
    //}
}

function BindRootStructure(structure, containerCtrl) {
    BoundIdList.push(structure.id);
    var htmlMemory = `<div class="mm-item active  root_${structure.rootId}" data-root="${structure.rootId}" id="folderId_${structure.rootId}">
                                <div class="mm-item-title clsparentfolder">
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
                                <div class="mm-item-nav" id="navitem_${structure.rootId}">
                                </div>
                            </div>`;
    $(containerCtrl).append(htmlMemory);
}

function BindLevelStructure(structure, containerCtrl) {
    BoundIdList.push(structure.id);
    var additionalClass = structure.folderlevel.toLowerCase() == "level_1" ? "" : "mm-item-lvl-" + structure.folderlevel.toLowerCase().split('_')[structure.folderlevel.toLowerCase().split('_').length - 1];
    var nextFolderLevel = structure.folderlevel.toLowerCase() == "level_4" ? "" : (structure.folderlevel.toLowerCase() == "level_1" ? "Level_2" : "Level_" + (parseInt(structure.folderlevel.toLowerCase().split('_')[structure.folderlevel.toLowerCase().split('_').length - 1]) + 1));
    ; var SubfolderHtml = structure.folderlevel.toLowerCase() == "level_4" ? "" : `<span onclick="AddSubFolder('folderId_${structure.id}', 'IsRoot', '${nextFolderLevel}')">
                                            <img src="/images/folder-add-2.svg" alt="Add Folder" title="Add New Folder" />
                                        </span>`;
    //console.log(additionalClass);
    //console.log(structure.folderlevel.toLowerCase())
    if (structure.isFolder) {
        var FolderHtml = `
                                <div class="mm-item-nav-row ${additionalClass} nav_${structure.folderlevel} root_${structure.rootId}" data-root="${structure.rootId}" id="SubFolderID_${structure.id}">
                                    <div class="mm-item-nav-row-icon">
                                        <img src="/images/folder-add-2.svg" class="row-folder" />
                                        <img src="/images/add-file-2.svg" class="row-file" style="display:none;" />
                                    </div>
                                    <p>${structure.folderName}</p>
                                    <div class="add-items">
                                       ${SubfolderHtml}
                                        <span onclick="AddNewFile('folderId_${structure.id}', 'No', '${nextFolderLevel}')">
                                            <img src="/images/add-file-2.svg" alt="Add File" title="Add New File" />
                                        </span>
                                        <span onclick="showDeletePopup('ID_${structure.id}',true)">
                                            <img src="/images/trash-icon.svg" alt="Delete Folder" title="Delete Folder">
                                        </span>
                                    </div>
                                </div>`;
        $($(containerCtrl).find(".mm-item-nav")).append(FolderHtml);
        //$("#navitem_" + structure.rootId).append(FolderHtml);
        //closeFolderPopup();
    }
    else {
        var FileHtml = `
                                <div class="mm-item-nav-row ${additionalClass}  root_${structure.rootId}" id="Level_${structure.fileID}" onclick="SetFile(${structure.fileID})">
                                    <div class="mm-item-nav-row-icon">
                                        <img src="/images/add-file-2.svg">
                                    </div>
                                    <p>${structure.fileName}</p>
                                    <div>
                                        <span onclick="showDeletePopup('folderId_${structure.fileID}',false)">
                                            <img src="/images/trash-icon.svg" alt="Delete File" title="Delete File">
                                        </span>
                                    </div>
                                </div>`;
        $($(containerCtrl).find(".mm-item-nav")).append(FileHtml);
        // $("#navitem_" + Item.rootId).append(FileHtml);
        //closeFilePopup();
    }
    //$(containerCtrl).append(htmlMemory);
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



//document.addEventListener("DOMContentLoaded", function () {
//    let myDropzone = new Dropzone("#uploader", {
//        dictDefaultMessage: "",  // Remove default message
//        paramName: "file", // Name of the file input field
//        maxFilesize: 100, // MB
//        init: function () {
//            this.on("addedfile", function (file) {
//                if (file.size === 0) {
//                    this.removeFile(file); // Remove the 0-byte file
//                    alert("Uploading 0-byte files is not allowed.");
//                }
//            });

//            this.on("sending", function (file, xhr, formData) {
//                formData.append("CurrentFileID", CurrentFileID); // Attach the CurrentFileID dynamically
//            });

//            this.on("success", function (file) {
//                let dropzoneInstance = this;

//                // Add click event to remove file when clicking on dz-success elements
//                file.previewElement.addEventListener("click", function () {
//                    dropzoneInstance.removeFile(file);
//                });
//            });
//        },
//        success: function (file, response) {
//            $("#txtsharelink").val(response.message);
//            //console.log('Share ID: ' + response.shareID);
//            $("#hdnshareID").val(response.shareID);

//            let qrImagePath = "/QRCodeImages/QRCode.png"; // Set the expected image path
//            $("#QRImage").attr("src", qrImagePath).on("load", function () {
//                // Show the image only when it's successfully loaded
//                $("#imageQR").css("display", "flex");
//                $("#qrtext").css("display", "none");
//            }).on("error", function () {
//                // If image fails to load, show the text instead
//                $("#imageQR").css("display", "none");
//                $("#qrtext").css("display", "flex");
//            });
//        }
//,
//        error: function (file, errorMessage) {
//            alert("Error uploading file: " + errorMessage);
//        }
//    });
//});

document.addEventListener("DOMContentLoaded", function () {
    let myDropzone = new Dropzone("#uploader", {
        dictDefaultMessage: "",  // Remove default message
        paramName: "file", // Name of the file input field
        maxFilesize: 100, // MB
        init: function () {
            this.on("addedfile", function (file) {
                // Validate file name and redirect URL before allowing upload
                var isFileNameValid = validateFileName();
                var isRedirectURLValid = validateRedirectURL();

                if (!isFileNameValid || !isRedirectURLValid) {
                    this.removeFile(file); // Remove file if validation fails
                    //alert("Please fill in the File Name and Redirect URL before uploading.");
                    return;
                }

                // Check for 0-byte file
                if (file.size === 0) {
                    this.removeFile(file);
                    alert("Uploading 0-byte files is not allowed.");
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
    var FileID = $("#hdnshareID").val().trim();
    var fileName = $("#txtfilename").val().trim();
    var shareDescription = $("#txtdesc").val().trim();
    var redirectURL = $("#txtRedirect").val().trim();
    var isPublic = $("#cbtest-19").prop("checked");

    // Validate both fields
    var isFileNameValid = validateFileName();
    var isRedirectURLValid = validateRedirectURL();

    // Stop execution if validation fails
    if (!isFileNameValid || !isRedirectURLValid) {
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
            console.log("Success:", response);
            if (response != null) {
                $("#txtfilename").val(response.fileName);
                $("#txtdesc").val(response.shareDescription);
                $("#txtRedirect").val(response.redirectURL);
                $("#cbtest-19").prop("checked", response.isPublic === "1" || response.isPublic === true);
            } else {
                $("#txtfilename").val("");
                $("#txtdesc").val("");
                $("#txtRedirect").val("");
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
                var FolderHtml = "";
                if (response.message != null) {
                    showNotification("", response.message, "error", false);
                    closeFolderPopup();
                    closeFilePopup();
                } else if (response.id == 0 && response.folderlevel == null) {
                    //alert("response get");
                    var rootId = response.rootId;
                    if (rootId == undefined && rootId == null && rootId == "") {
                        rootId = "";
                    }
                    var foldername = response.folderName;

                    FolderHtml += '<div class="mm-item active" id=folderId_' + rootId + '">';
                    FolderHtml += '  <div class="mm-item-title clsparentfolder">';
                    FolderHtml += '    <div class="mm-nav-icon mm-expand" onclick="CollapseExpandParent(\'' + rootId + '\')">+</div>';
                    FolderHtml += '    <div class="mm-nav-icon mm-collapse" onclick="CollapseExpandParent(\'' + rootId + '\')">−</div>';
                    FolderHtml += '    <p>' + foldername + '</p>';
                    FolderHtml += '    <div class="add-items">';
                    FolderHtml += '      <span onclick="AddSubFolder(\'folderId_' + rootId + '\', \'IsRoot\', \'Level_1\')"><img src="/images/folder-add-2.svg" alt="Create New Folder" title="Create New Folder"></span>';
                    FolderHtml += '      <span onclick="AddNewFile(\'folderId_' + rootId + '\', \'No\', \'Level_1\')"><img src="/images/add-file-2.svg" alt="Upload New File" title="Upload New File"></span>';
                    FolderHtml += '      <span onclick="showDeletePopup(\'folderId_' + rootId + '\',true)"><img src="/images/trash-icon.svg" alt="Delete Folder" title="Delete Folder"></span>';
                    FolderHtml += '    </div>';
                    FolderHtml += '  </div>';
                    FolderHtml += '  <div class="mm-item-nav" id="navitem_' + rootId + '">';
                    FolderHtml += '  </div>';
                    FolderHtml += '</div>';
                    $("#divShareRedirect").append(FolderHtml);
                    closeFolderPopup();

                } else if (response.folderlevel == "Level_1") {
                    if (response.isFolder) {
                        FolderHtml += '<div class="mm-item-nav-row nav_' + response.folderlevel + '" id="SubFolderID_' + response.id + '">';
                        FolderHtml += '   <div class="mm-item-nav-row-icon">';
                        FolderHtml += '     <img src="/images/folder-add-2.svg" class="row-folder" />';
                        FolderHtml += '     <img src="/images/add-file-2.svg" class="row-file" style="display:none;" />';
                        FolderHtml += '   </div>';
                        FolderHtml += '   <p>' + response.folderName + '</p>';
                        FolderHtml += '   <div class="add-items" >';
                        FolderHtml += '     <span onclick="AddSubFolder(\'folderId_' + response.id + '\', \'IsRoot\', \'Level_2\')"><img src="/images/folder-add-2.svg" alt="Add Folder" title="Add New Folder" /></span>';
                        FolderHtml += '     <span onclick="AddNewFile(\'folderId_' + response.id + '\', \'No\', \'Level_2\')"><img src="/images/add-file-2.svg" alt="Add File" title="Add New File" /></span>';
                        FolderHtml += '      <span onclick="showDeletePopup(\'ID_' + response.id + '\',true)"><img src="/images/trash-icon.svg" alt="Delete File" title="Delete File"></span>';
                        FolderHtml += '   </div>';
                        FolderHtml += ' </div>';
                        $("#navitem_" + response.rootId + "").append(FolderHtml);
                        closeFolderPopup();
                    }
                    if (response.isFile) {
                        FolderHtml += '   <div class="mm-item-nav-row" id="Level_' + response.fileID + '" onclick="SetFile(' + response.fileID + ')">	';
                        FolderHtml += '      <div class="mm-item-nav-row-icon">';
                        FolderHtml += '       <img src="/images/add-file-2.svg">';
                        FolderHtml += '         </div>';
                        FolderHtml += '           <p></p>';
                        FolderHtml += '          <div >';
                        FolderHtml += '      <span onclick="showDeletePopup(\'folderId_' + response.fileID + '\',false)"><img src="/images/trash-icon.svg" alt="Delete Folder" title="Delete Folder"></span>';
                        FolderHtml += '                       </div>';
                        FolderHtml += '                   </div>';
                        $("#navitem_" + response.rootId + "").append(FolderHtml);
                        closeFilePopup();
                    }


                } else if (response.folderlevel == "Level_2") {
                    if (response.isFolder) {
                        FolderHtml += '<div class="mm-item-nav-row mm-item-lvl-2  nav_' + response.folderlevel + '" id="SubFolderID_' + response.id + '">';
                        FolderHtml += '   <div class="mm-item-nav-row-icon">';
                        FolderHtml += '     <img src="/images/folder-add-2.svg" class="row-folder" />';
                        FolderHtml += '     <img src="/images/add-file-2.svg" class="row-file" style="display:none;" />';
                        FolderHtml += '   </div>';
                        FolderHtml += '   <p>' + response.folderName + '</p>';
                        FolderHtml += '   <div class="add-items" >';
                        FolderHtml += '     <span onclick="AddSubFolder(\'folderId_' + response.id + '\', \'IsRoot\', \'Level_3\')"><img src="/images/folder-add-2.svg" alt="Add Folder" title="Add New Folder" /></span>';
                        FolderHtml += '     <span onclick="AddNewFile(\'folderId_' + response.id + '\', \'No\', \'Level_3\')"><img src="/images/add-file-2.svg" alt="Add File" title="Add New File" /></span>';
                        FolderHtml += '      <span onclick="showDeletePopup(\'ID_' + response.id + '\',true)"><img src="/images/trash-icon.svg" alt="Delete File" title="Delete File"></span>';
                        FolderHtml += '   </div>';
                        FolderHtml += ' </div>';
                        $($("#SubFolderID_" + response.rootId + "").parent()).append(FolderHtml);
                        closeFolderPopup();
                    }

                    if (response.isFile) {
                        FolderHtml += '   <div class="mm-item-nav-row mm-item-lvl-2" onclick="SetFile(' + response.fileID + ')" >	';
                        FolderHtml += '      <div class="mm-item-nav-row-icon">';
                        FolderHtml += '       <img src="/images/add-file-2.svg">';
                        FolderHtml += '         </div>';
                        FolderHtml += '           <p></p>';
                        FolderHtml += '          <div >';
                        FolderHtml += '      <span onclick="showDeletePopup(\'folderId_' + response.id + '\',false)"><img src="/images/trash-icon.svg" alt="Delete Folder" title="Delete Folder"></span>';
                        FolderHtml += '                       </div>';
                        FolderHtml += '                   </div>';
                        $($("#SubFolderID_" + response.rootId + "").parent()).append(FolderHtml);
                        closeFilePopup();
                    }
                }
                else if (response.folderlevel == "Level_3") {
                    if (response.isFolder) {
                        FolderHtml += '<div class="mm-item-nav-row mm-item-lvl-3  nav_' + response.folderlevel + '" id="SubFolderID_' + response.id + '">';
                        FolderHtml += '   <div class="mm-item-nav-row-icon">';
                        FolderHtml += '     <img src="/images/folder-add-2.svg" class="row-folder" />';
                        FolderHtml += '     <img src="/images/add-file-2.svg" class="row-file" style="display:none;" />';
                        FolderHtml += '   </div>';
                        FolderHtml += '   <p>' + response.folderName + '</p>';
                        FolderHtml += '   <div class="add-items" >';
                        FolderHtml += '     <span onclick="AddSubFolder(\'folderId_' + response.id + '\', \'IsRoot\', \'Level_4\')"><img src="/images/folder-add-2.svg" alt="Add Folder" title="Add New Folder" /></span>';
                        FolderHtml += '     <span onclick="AddNewFile(\'folderId_' + response.id + '\', \'No\', \'Level_4\')"><img src="/images/add-file-2.svg" alt="Add File" title="Add New File" /></span>';
                        FolderHtml += '      <span onclick="showDeletePopup(\'ID_' + response.id + '\',true)"><img src="/images/trash-icon.svg" alt="Delete File" title="Delete File"></span>';
                        FolderHtml += '   </div>';
                        FolderHtml += ' </div>';
                        $($("#SubFolderID_" + response.rootId + "").parent()).append(FolderHtml);
                        closeFolderPopup();
                    }

                    if (response.isFile) {
                        FolderHtml += '   <div class="mm-item-nav-row mm-item-lvl-3" onclick="SetFile(' + response.fileID + ')" >	';
                        FolderHtml += '      <div class="mm-item-nav-row-icon">';
                        FolderHtml += '       <img src="/images/add-file-2.svg">';
                        FolderHtml += '         </div>';
                        FolderHtml += '           <p></p>';
                        FolderHtml += '          <div >';
                        FolderHtml += '      <span onclick="showDeletePopup(\'folderId_' + response.id + '\',false)"><img src="/images/trash-icon.svg" alt="Delete Folder" title="Delete Folder"></span>';
                        FolderHtml += '                       </div>';
                        FolderHtml += '                   </div>';
                        $($("#SubFolderID_" + response.rootId + "").parent()).append(FolderHtml);
                        closeFilePopup();
                    }
                }
                else if (response.folderlevel == "Level_4") {
                    if (response.isFolder) {
                        FolderHtml += '<div class="mm-item-nav-row mm-item-lvl-4  nav_' + response.folderlevel + '" id="SubFolderID_' + response.id + '">';
                        FolderHtml += '   <div class="mm-item-nav-row-icon">';
                        FolderHtml += '     <img src="/images/folder-add-2.svg" class="row-folder" />';
                        FolderHtml += '     <img src="/images/add-file-2.svg" class="row-file" style="display:none;" />';
                        FolderHtml += '   </div>';
                        FolderHtml += '   <p>' + response.folderName + '</p>';
                        FolderHtml += '   <div class="add-items" >';
                        FolderHtml += '     <span onclick="AddNewFile(\'folderId_' + response.id + '\', \'No\', \'Level_5\')"><img src="/images/add-file-2.svg" alt="Add File" title="Add New File" /></span>';
                        FolderHtml += '      <span onclick="showDeletePopup(\'ID_' + response.id + '\',true)"><img src="/images/trash-icon.svg" alt="Delete File" title="Delete File"></span>';
                        FolderHtml += '   </div>';
                        FolderHtml += ' </div>';
                        $($("#SubFolderID_" + response.rootId + "").parent()).append(FolderHtml);
                        closeFolderPopup();
                    }

                    if (response.isFile) {
                        FolderHtml += '   <div class="mm-item-nav-row mm-item-lvl-4" onclick="SetFile(' + response.fileID + ')" >	';
                        FolderHtml += '      <div class="mm-item-nav-row-icon">';
                        FolderHtml += '       <img src="/images/add-file-2.svg">';
                        FolderHtml += '         </div>';
                        FolderHtml += '           <p></p>';
                        FolderHtml += '          <div >';
                        FolderHtml += '      <span onclick="showDeletePopup(\'folderId_' + response.id + '\',false)"><img src="/images/trash-icon.svg" alt="Delete Folder" title="Delete Folder"></span>';
                        FolderHtml += '                       </div>';
                        FolderHtml += '                   </div>';
                        $($("#SubFolderID_" + response.rootId + "").parent()).append(FolderHtml);
                        closeFilePopup();
                    }

                } else if (response.folderlevel == "Level_5") {
                    if (response.isFile) {
                        FolderHtml += '   <div class="mm-item-nav-row mm-item-lvl-5" onclick="SetFile(' + response.fileID + ')" >	';
                        FolderHtml += '      <div class="mm-item-nav-row-icon">';
                        FolderHtml += '       <img src="/images/add-file-2.svg">';
                        FolderHtml += '         </div>';
                        FolderHtml += '           <p></p>';
                        FolderHtml += '          <div >';
                        FolderHtml += '      <span onclick="showDeletePopup(\'folderId_' + response.id + '\',false)"><img src="/images/trash-icon.svg" alt="Delete Folder" title="Delete Folder"></span>';
                        FolderHtml += '                       </div>';
                        FolderHtml += '                   </div>';
                        $($("#SubFolderID_" + response.rootId + "").parent()).append(FolderHtml);
                        closeFilePopup();
                    }
                }
            }

        },
        error: {

        }

    });
}
//Show delete popup.
function showDeletePopup(Id,isFolder) {
    $("#DeleteFolderPopup").show();
    if (Id != null && Id != undefined) {
        var folderID = Id.split('_')[1];
        $("#spnSelType").html(isFolder ? "folder" : "file");
        $("#hdnid").val(folderID);
        $("#IsFolder").val(isFolder);
    }
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
                if (response.message == "success") {
                    showNotification("success", "Folder delete Successfully!", "success", true);
                    $("#DeleteFolderPopup").hide();
                    setTimeout(function () {
                        //$("SubFolderID_" + ID).detach();
                        //$(".root_" + ID).detach()
                        window.location.reload();
                    }, 2000);

                }
                else {
                    showNotification("", "Failed to delete selected folder!", "error", false);
                }

            }
        },
        error: function (error) {
            alert(error);
        }
    });
}

//// function validate FileName
//function validateFileName() {
//    var FileName = $("#txtfilename").val().trim();

//    if (FileName == "" && FileName == null && FileName == "") {
//        alert("Please enter file name!")
//    }
//}
//// function validate Redirect URL
//function validateRedirectURL() {
//    var RedirectURL = $("#txtRedirect").val().trim();

//    if (RedirectURL == "" && RedirectURL == null && RedirectURL == "") {
//        alert("Please enter Redirect URL!")
//    }
//}

function validateFileName() {
    var fileName = $("#txtfilename").val().trim();

    if (!fileName) {
        $("#txtfilename").addClass("danger"); // Add error class
        return false;
    }

    $("#txtfilename").removeClass("danger"); // Remove error class if valid
    return true;
}

function validateRedirectURL() {
    var redirectURL = $("#txtRedirect").val().trim();

    if (!redirectURL) {
        $("#txtRedirect").addClass("danger"); // Add error class
        return false;
    }

    $("#txtRedirect").removeClass("danger"); // Remove error class if valid
    return true;
}


