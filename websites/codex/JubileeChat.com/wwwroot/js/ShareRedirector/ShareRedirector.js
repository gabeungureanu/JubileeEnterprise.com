var CurrentFileID = null;
var curFolderID = null;
let TimeDurationFile = null;
let fileSize = null;
var authID = "";
var AuthName = "";
var ShareListJson;
var CurShareListJson;
var shareIndex = 0;
var rootIdIndex = 0;
var rootIdsList;
var curIdSel;
var BoundIdList = [];

$(document).ready(function () {
    HideLeftMenuItems();

    $(".left-nav-bar").resizable();
    $("#divMySettings").addClass("active");
    //Toggle_Navbar();
    var div = document.getElementById("left-nav-bar");
    if (div) {
        if (div.classList.contains("bc-leftmenu")) {
        }
        else {
            div.classList.add("bc-leftmenu");
        }
    }
    FetchShareDetails();

    $("#previewFile").css("display", "none");

    $("#txtfilename, #txtfoldername").on("input", function () {
        $(this).removeClass("field-err");
        $("#folderNameError").hide(); // Hide the validation message
    });

    $("#numDisplayOrder").on("input", function () {
        validateDisplayOrder();
    });

    $('#ddlAuthor,#ddlSeries,#ddlProduct,#ddlDelivery').on('change', function () {
        validateDropdowns();
    });

});

function validateShareLink() {

    if ($('input[name="item-type"]:checked').length === 0) {
        $('.item-file-type-wrap').addClass('error');
        return;
    } else {
        $('.item-file-type-wrap').removeClass('error');
        // optionally return false or prevent form submission
    }

    var IsURl = $("#radURL").prop("checked");
    if (!IsURl) {
        showNotification("", "Please select 'URL' as the item type to provide a valid link.", "error", false);
    }


    // Check if any files are still uploading
    let totalFiles = $(".dz-preview").length;
    let completedFiles = $(".dz-preview.dz-complete").length;
    /*    let PreviewFile = $("#preFileName");*/

    // Restrict saving only if there are files AND some are still uploading
    if (totalFiles > 0 && totalFiles !== completedFiles) {
        $("#txtRedirect").val("");
        $("#txtRedirect").attr("readonly", true);
        showNotification("", "The file is uploading, so the redirect URL cannot be entered.", "error", false);
        return;
    }

    if (completedFiles) {
        $("#txtRedirect").val("");
        $("#txtRedirect").attr("readonly", true);
        showNotification("", "Delete the uploaded file to enter the redirect URL.", "error", false);
        return;
    }

    if ($("#previewFile").css("display") === "flex") {
        $("#txtRedirect").val("");
        $("#txtRedirect").attr("readonly", true);
        showNotification("", "Delete the uploaded file to enter the redirect URL.", "error", false);
        return;
    } else if ($("#previewFile").css("display") === "none") {
        $("#txtRedirect").removeAttr("readonly");
        return;
    }

}

function FetchShareDetails() {
    var htmlMemory = "";
    $.ajax({
        type: "POST",
        url: "/ShareRedirector/GetFilesDetails",
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
                    let L_IsActive = ShareListJson[i].isActive;
                    let L_ProductImage = ShareListJson[i].productImage;
                    let L_DisplayOrder = ShareListJson[i].displayOrder;
                    let structure = ShareListJson[i];
                    let L_IsContentAvailable = ShareListJson[i].isContentAvailable;
                    let DivContainer = $("#divShareRedirect");
                    let L_HitCount = ShareListJson[i].hitCount === 0 ? "" : ShareListJson[i].hitCount.toLocaleString();

                    if (L_LevelNo != null && L_LevelNo == 'Level_0') {
                        BindRootStructure(structure, DivContainer);
                    }
                    else {
                        DivContainer = $("#divShareRedirect");
                        Generate_HTML_Elements(L_LevelNo, L_ID, L_RootID, L_FolderName, L_FileName, DivContainer, L_IsFolder, L_FileID, L_IsActive, L_ProductImage, L_DisplayOrder, L_IsContentAvailable, L_HitCount);
                    }


                }
            }
        },
        error: function (error) {
            showNotification("", "Error: " + error.responseText, "error", false);
        }
    });
}
//Bind folders or files
function Generate_HTML_Elements(L_LevelNo, L_ID, L_RootID, L_FolderName, L_FileName, DivContainer, L_IsFolder, L_FileID, L_IsActive, L_ProductImage, L_DisplayOrder, L_IsContentAvailable, L_HitCount) {

    var additionalClass_Leval = "";
    let folderpicture = "";
    let filepicture = "";
    let activetoggle = "";
    let addFile = "";
    let ProductImage = "";
    let Productthumb = "";
    let MoveBtn = "";
    let NoContent = "";
    filepicture = "/images/item.png";
    if (!L_IsContentAvailable) {
        NoContent = '<img src="/images/red-indicator.png" title="No content available" id="NoContent_' + L_FileID + '" />';
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

    switch (L_LevelNo) {
        case "Level_0":

            additionalClass_Leval = "mm-item-lvl";

            break;

        case "Level_2":

            additionalClass_Leval = "mm-item-lvl-2";
            if (L_IsFolder) {
                folderpicture = "/images/series.png";
            }
            break;

        case "Level_3":
            additionalClass_Leval = "mm-item-lvl-3";
            if (L_IsFolder) {
                folderpicture = "/images/product.png";
            }
            activetoggle = `
<label class="switch">
  <input type="checkbox" onclick="ActiveStructure('${L_ID}');" id="togglePlan_${L_ID}" ${L_IsActive ? 'checked' : ''}>
  <span class="slider round"></span>
</label>
`;
            ProductImage = `<div class="more-options-item">
    <span >
        <img src="/images/image-icon.svg" alt="Thumbnail"  title="Add Thumbnail">
    </span>
    <input type="file" id="thumbnailUploader" style="display: none;" accept="image/*">
    <p>Add Thumbnail</p>
      
</div>`;
            if (L_ProductImage != null) {

                Productthumb = ` ${L_HitCount > 0 ? `<span style="margin-right:10px;">Total Hits: ${L_HitCount}</span>` : ''}<div class="product-thumb">
              
     <div class="product-thumb-inner" >
         <img src="../ProductThumbnail/${L_ProductImage}" id="ProductIMG_${L_ID}" alt="" />
     </div>
 </div>`;
            }

            break;



        case "Level_4":

            additionalClass_Leval = "mm-item-lvl-4";
            if (L_IsFolder) {
                folderpicture = "/images/delivery-type.png";
            }
            activetoggle = `
<label class="switch">
  <input type="checkbox" onclick="ActiveStructure('${L_ID}');" id="togglePlan_${L_ID}" ${L_IsActive ? 'checked' : ''}>
  <span class="slider round"></span>
</label>
`;

            addFile = ` <div class="more-options-item">
                                                <span onclick="AddNewFile('folderId_${L_ID}', 'No', '${NextLevel}')">
                                                    <img src="/images/add-file-2.svg" alt="Add File" title="Add New File" />
                                                </span>
                                                <p>Add New File</p>
                                            </div>`;
            break;

        case "Level_5":

            additionalClass_Leval = "mm-item-lvl-5";

            break;

    }
    if (!folderpicture) {
        folderpicture = "/images/author.png"
        MoveBtn = `<div class="more-options-item">
    <span onclick="MoveAutherPopup('${L_ID}','${L_FolderName}')">
        <img src="/images/move.svg" alt="Move Store"  title="Move Store">
    </span>
    <input type="file" id="thumbnailUploader" style="display: none;" accept="image/*">
    <p>Add Thumbnail</p>
</div>`;
    }


    if (L_IsFolder) {
        var FolderHtml = `    <div class="mm-item-nav-row active  ${additionalClass_Leval} nav_${L_LevelNo} root_${L_RootID}"  id="SubFolderID_${L_ID}">
                                 <div class="mm-nav-icon mm-expand" onclick="CollapseExpandFolder('${L_ID}')">+</div>
                                   <div class="mm-nav-icon mm-collapse" onclick="CollapseExpandFolder('${L_ID}')">−</div>
                                    <div class="mm-item-nav-row-icon">
                                       <img src="${folderpicture}" style="width:18px;" />
                                        <img src="/images/add-file-2.svg" class="row-file" style="display:none;" />
                                     
                                    </div>                                   
                                    <input type="text" value="${L_FolderName}" readonly ondblclick="renameFolder('txtrenameFolder_${L_ID}');" id="txtrenameFolder_${L_ID}" autocomplete="off" maxlength="63"  onblur="EditFolderName('${L_ID}', 'txtrenameFolder_${L_ID}',false)"  >
                                    
                                    <span id="RenamefolderError_${L_ID}" style="display: none;"></span>
                                    ${Productthumb}
                                    <div class="add-items">
                                  ${activetoggle}
                                        
                                        <span>
                                            <img src="/images/ellipsis.svg" alt="More Options" onclick="Addmoreoption('${L_ID}')"  title="More Options">
                                        </span>
                                        <div class="more-options" id="moreoption_${L_ID}" style="display:none">
                                            <div class="more-options-item" ${hideFolder} >
                                                <span   onclick="AddSubFolder('folderId_${L_ID}', 'IsRoot', '${NextLevel}')">
                                                <img src="/images/folder-add-2.svg" alt="Add Folder" title="Add New Folder" />
                                                </span>
                                                <p>Add New Folder</p>
                                            </div>

                                            ${addFile}
                                           
                                            <div class="more-options-item">
                                                <span onclick="showDeletePopup('ID_${L_ID}',true)">
                                                    <img src="/images/trash-icon.svg" alt="Delete Folder" title="Delete Folder">
                                                </span>
                                                <p>Delete Folder</p>
                                            </div>
                                             <div class="more-options-item">
                                                <span  onclick="renameFolder('txtrenameFolder_${L_ID}');">
                                                    <img src="/images/edit-icon2.svg" alt="Edit" title="Edit">
                                                </span>
                                                <p>Edit</p>
                                             </div>

                                            
                                             ${MoveBtn}
                                        </div>

                                    </div>
                                      
                                </div>
    <div class="mm-item-nav" id="navitem_${L_ID}">
    </div>`;
        DivContainer = $("#navitem_" + L_RootID);
        $(DivContainer).append(FolderHtml);
    }
    else {
        if (L_LevelNo == 'Level_5') {
            let DisplayOrder = formatDisplayOrder(L_DisplayOrder);
            var FileHtml = `
          
                                <div class="mm-item-nav-row ${additionalClass_Leval}  root_${L_RootID} SubfileID_${L_ID}" id="Level_${L_FileID}" onclick="SetFile(${L_FileID})">
                                     
                                <div class="mm-item-nav-row-icon">
                                        <img src="${filepicture}">
                                    </div>
                                    <div class="mm-item-nav-row-icon" style="width: 25px; text-align: center;">
                                       <p id="displayOrder_${L_ID}">${DisplayOrder}</p>
                                 
                                    
                                    </div>

                                           <input type="text" readonly id="txtfileName_${L_ID}" value="${L_FileName}" ondblclick="renameFolder('txtfileName_${L_ID}');" onblur="EditFolderName('${L_ID}', 'txtfileName_${L_ID}',true)" />
                                   ${NoContent}

                                           <div class="add-items">
                                           <span>${L_HitCount}</span>
                                        <label class="switch">                                        
                                             <input type="checkbox" onclick="ActiveStructure('${L_ID}');" id="togglePlan_${L_ID}" ${L_IsActive ? 'checked' : ''}>
                                                <span class="slider round"></span>
                                        </label>

                                        <span onclick="showDeletePopup('folderId_${L_ID}',false)">
                                            <img src="/images/trash-icon.svg" alt="Delete File" title="Delete File">
                                        </span>
                                        
                                    </div>
                                </div>`;

            DivContainer = $("#navitem_" + L_RootID);
            $(DivContainer).append(FileHtml);
        }

    }

}
//For Format thee DisplayOrder.
function formatDisplayOrder(displayOrder) {
    return displayOrder < 10 ? '0' + displayOrder : String(displayOrder);
}
// Three dots function.
function Addmoreoption(id) {
    var currentPopup = $('#moreoption_' + id);

    // If it's already visible, just hide it
    if (currentPopup.is(':visible')) {
        currentPopup.hide();
    } else {
        // Hide all popups first
        $('[id^="moreoption_"]').hide();

        // Then show the one you clicked
        currentPopup.show();
    }
}
//For rename the folder
function renameFolder(folderID) {
    $('#moreoption_' + folderID.split('_')[1]).css("display", "none");



    curFolderID = folderID;
    var renameFolderInput = document.getElementById(folderID);
    if (renameFolderInput) {
        renameFolderInput.classList.add("edit-txt"); // Add class
        renameFolderInput.removeAttribute("readonly"); // Remove readonly attribute
        renameFolderInput.focus(); // Set focus to the input field
        renameFolderInput.select(); // Select the text for easy editing
    }
}

//For Update folder name.
function EditFolderName(id, folderName, isFile) {
    var renameFolder = folderName;
    var Id = id;
    var isFile = isFile;
    var folderName = $("#" + folderName).val();
    if (!isFile) {
        var isFolderNameValid = validateRenameFolder(renameFolder);
        if (!isFolderNameValid) {
            return;
        }
    }

    $.ajax({
        type: "POST",
        url: "/ShareRedirector/RenameFolderName",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            ID: Id,
            FolderName: folderName,
            IsFile: isFile
        },
        success: function (response) {
            if (response != null) {
                if (response.status) {
                    var safeFolderName = CSS.escape(folderName); // Escape special characters
                    $("#" + safeFolderName).val(response.folderName);
                    if (isFile) {
                        $("#txtfilename").val(response.folderName);
                        $("#txtmainSection").text(response.folderName);
                    }

                    var renameFolderInput = document.getElementById(curFolderID);
                    if (renameFolderInput) {
                        renameFolderInput.classList.remove("edit-txt"); // Remove the editing class
                        renameFolderInput.setAttribute("readonly", true); // Reapply the readonly attribute
                    }
                    curFolderID = null;
                }
                else {
                    showNotification("", response.message, "error", false);
                }
            }
        },
        error: function (xhr, status, error) {
            showNotification("", "An error occurred while renaming the folder", "error", false);
        }
    });
}

//Accordian on file rows.
function CollapseExpandFolder(id) {
    var $subFolder = $("#SubFolderID_" + id);
    var $navItem = $("#navitem_" + id);
    var $expandIcon = $subFolder.find(".mm-expand");
    var $collapseIcon = $subFolder.find(".mm-collapse");
    var isExpanding = !$subFolder.hasClass("active");


    if (!isExpanding) {
        // Collapse all inner subfolders when collapsing the parent
        $subFolder.next().find("[id^='SubFolderID_']").each(function () {
            var subId = $(this).attr("id").replace("SubFolderID_", "");

            var $innerSubFolder = $("#SubFolderID_" + subId);
            var $innerNavItem = $("#navitem_" + subId);
            var $innerExpandIcon = $innerSubFolder.find(".mm-expand");
            var $innerCollapseIcon = $innerSubFolder.find(".mm-collapse");
            // Log the state of elements before making any changes

            $innerSubFolder.removeClass("active");
            $innerNavItem.hide();
            $innerExpandIcon.css("display", "flex");
            $innerCollapseIcon.hide();

        });
    }

    // Toggle active class
    $subFolder.toggleClass("active");

    if (isExpanding) {
        // Expanding: Show child items
        $navItem.show();
        $expandIcon.hide();
        $collapseIcon.css("display", "flex");
    } else {
        // Collapsing: Hide child items
        $navItem.hide();
        $expandIcon.css("display", "flex");
        $collapseIcon.hide();
    }
}

//Bind Root folder (Azure Conatiner)
function BindRootStructure(structure, containerCtrl) {
    BoundIdList.push(structure.id);
    var htmlMemory = `<div class="mm-item   root_${structure.rootId}" data-root="${structure.rootId}" id="folderId_${structure.id}">
                                <div class="mm-item-title clsparentfolder m-0">
                                    <div class="mm-nav-icon mm-expand" onclick="CollapseExpandParent('${structure.rootId}')">+</div>
                                    <div class="mm-nav-icon mm-collapse" onclick="CollapseExpandParent('${structure.rootId}')">−</div>
                                    <img src="/images/store.svg" alt="Author" style="width:21px; margin-right: 5px;" />
                                 
                                     <input type="text" value="${structure.folderName}" readonly ondblclick="renameFolder('txtrenameFolder_${structure.id}');" id="txtrenameFolder_${structure.id}" autocomplete="off" maxlength="63"  onblur="EditFolderName('${structure.id}', 'txtrenameFolder_${structure.id}',false)"  >
                                    <div class="add-items">
                                   
                                        <span onclick="AddSubFolder('folderId_${structure.rootId}', 'IsRoot', 'Level_1')">
                                            <img src="/images/folder-add-2.svg" alt="Create New Folder" title="Create New Folder">
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
    //$(".dz-preview").remove();
    // Check if any files are still uploading
    let totalFiles = $(".dz-preview").length;
    let completedFiles = $(".dz-preview.dz-complete").length;

    // Restrict saving only if there are files AND some are still uploading
    if (totalFiles > 0 && totalFiles !== completedFiles) {
        showNotification("", "Cannot close the file while it is uploading.", "error", false);
        return;
    }
    //remove validation
    $("#txtRedirect").removeClass("field-err");
    $("#txtfilename").removeClass("field-err");
    $("#txtsharelink").val("");
    //remove selected file
    $("#Level_" + CurrentFileID).removeClass("active");

   
    if (CurrentFileID == null) {
        showNotification("", "Please create and select file!", "error", false);
        return;
    }

    let edit = document.querySelector(".edit-panel");
    if (edit) {
        edit.classList.remove("active");
        CurrentFileID = null;
        $("#qr-btn").css("display", "none");
    }
}

//Copy URL
function copyShareURL(elem) {
    // Find the input within the same parent container
    var input = elem.closest(".field-wrap").querySelector("input");
    var ShareURL = input.value;
    //var ShareURL = $("#txtsharelink").val();

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

//Music Album Upload 
document.addEventListener("DOMContentLoaded", function () {
    //For upload music album
    let musicAlbumDropzone = new Dropzone("#MusicAlbumuploader", {
        url: "/ShareRedirector/upload",
        dictDefaultMessage: "",
        paramName: "file",
        maxFilesize: 600,
        acceptedFiles: ".mp3",
        autoProcessQueue: false, // Disable automatic upload
        init: function () {
            let dropzoneInstance = this;

            this.on("addedfile", function (file) {

                $('.item-file-type-wrap').removeClass('error');
                // Step 2: Get uploaded file type
                let fileName = file.name;
                let uploadedType = fileName.split('.').pop().toLowerCase();

                // Step 5: Disallow empty files
                if (file.size === 0) {
                    dropzoneInstance.removeFile(file);
                    showNotification("", "Uploading 0-byte files is not allowed.", "error", false);
                    return;
                }
                // Step 6: Handle audio
                if (file.type.startsWith("audio")) {
                    const mediaElement = document.createElement(file.type.startsWith("audio") ? "audio" : "");
                    mediaElement.preload = "metadata";
                    const fileURL = URL.createObjectURL(file);
                    mediaElement.src = fileURL;

                    mediaElement.onloadedmetadata = function () {
                        URL.revokeObjectURL(fileURL);
                        const durationInSeconds = mediaElement.duration;
                        TimeDurationFile = formatDuration(durationInSeconds);
                        fileSize = formatFileSize(file.size);
                        dropzoneInstance.processFile(file); // ✅ Now start upload
                    };

                    mediaElement.onerror = function () {
                        showNotification("", "Unable to read media metadata.", "error", false);
                        dropzoneInstance.removeFile(file);
                    };
                } else {
                    // Not media, no need to wait
                    TimeDurationFile = "";
                    fileSize = formatFileSize(file.size);
                    dropzoneInstance.processFile(file); // ✅ Start upload
                }
                function formatDuration(seconds) {
                    const mins = Math.floor(seconds / 60);
                    const secs = Math.floor(seconds % 60);
                    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
                }
                function formatFileSize(bytes) {
                    const kb = bytes / 1024;
                    const mb = kb / 1024;
                    return mb.toFixed(2) + " MB";
                }
            });


            this.on("sending", function (file, xhr, formData) {
                let IsMusicAlbum = $("#chkMusicAlbum").prop("checked");//Get the Music Album 
                let UploadType = $("#chkMusicAlbum").parent("label").text().trim();

                if (UploadType.includes("Music")) {
                    UploadType = "IsMusicAlbum";
                } else {
                    UploadType = "";
                }

                formData.append("CurrentFileID", CurrentFileID);
                formData.append("TimeDurationFile", TimeDurationFile || "");
                formData.append("fileSize", fileSize || "");
                formData.append("UploadTypeVal", IsMusicAlbum || "");
                formData.append("UploadType", UploadType || "");
            });

            this.on("success", function (file, response) {
                TimeDurationFile = null;
                fileSize = null;

                if (!response.success) {
                    showNotification("", response.message, "error", false);
                    dropzoneInstance.removeFile(file);
                    return;
                }

                $("#txtsharelinkMusicAlbum").val(response.message ?? "");
                $("#txtfreelinkMusicAlbum").val(response.freeAzureURL ?? "");
                $("#hdnshareID").val(response.shareID);

                $("#imageQRpath").attr("src", "/QRCodeImages/" + response.marketingQRName + "?v=" + new Date().getUTCMilliseconds().toString()).on("load", function () {
                    $("#imageQRM1").css("display", "flex");
                    $("#qrtextM1").css("display", "none");
                }).on("error", function () {
                    $("#imageQRM1").css("display", "none");
                    $("#qrtextM1").css("display", "flex");
                });

                $("#imageQRpathPayment").attr("src", "/QRCodeImages/" + response.paymentQRName + "?v=" + new Date().getUTCMilliseconds().toString()).on("load", function () {
                    $("#imageQRP1").css("display", "flex");
                    $("#qrtextP1").css("display", "none");
                }).on("error", function () {
                    $("#imageQRP1").css("display", "none");
                    $("#qrtextP1").css("display", "flex");
                });

                file.previewElement.addEventListener("click", function () {
                    dropzoneInstance.removeFile(file);
                    $("#txtRedirect").removeAttr("readonly");
                    $(".dz-preview").remove();
                    $("#previewFile").hide();

                    $.post("/ShareRedirector/RemoveUploadedFile", { FileID: CurrentFileID })
                        .done(function () {
                            $("#imageQRM1").hide();
                            $("#qrtextM1").show();
                            $("#txtsharelinkMusicAlbum").val("");
                            $("#imageQRP1").hide();
                            $("#qrtextP1").show();
                            $("#txtfreelinkMusicAlbum").val("");
                        })
                        .fail(function () {
                            showNotification("", "Failed to remove uploaded file", "error", false);
                        });
                });
            });

            this.on("error", function (file, errorMessage) {
                TimeDurationFile = null;
                fileSize = null;
                dropzoneInstance.removeFile(file);
                showNotification("", "Error uploading file: " + errorMessage, "error", false);
            });
        }
    });
    //For upload audio album
    let audioAlbumDropzone = new Dropzone("#AudioBookuploader", {
        url: "/ShareRedirector/upload",
        dictDefaultMessage: "",
        paramName: "file",
        maxFilesize: 600,
        acceptedFiles: ".mp3",
        autoProcessQueue: false, // Disable automatic upload
        init: function () {
            let dropzoneInstance = this;

            this.on("addedfile", function (file) {
                // Step 2: Get uploaded file type
                let fileName = file.name;
                let uploadedType = fileName.split('.').pop().toLowerCase();

                // Step 5: Disallow empty files
                if (file.size === 0) {
                    dropzoneInstance.removeFile(file);
                    showNotification("", "Uploading 0-byte files is not allowed.", "error", false);
                    return;
                }

                // Step 6: Handle audio/video duration
                if (file.type.startsWith("audio") || file.type.startsWith("video")) {
                    const mediaElement = document.createElement(file.type.startsWith("audio") ? "audio" : "video");
                    mediaElement.preload = "metadata";
                    const fileURL = URL.createObjectURL(file);
                    mediaElement.src = fileURL;

                    mediaElement.onloadedmetadata = function () {
                        URL.revokeObjectURL(fileURL);
                        const durationInSeconds = mediaElement.duration;
                        TimeDurationFile = formatDuration(durationInSeconds);
                        fileSize = formatFileSize(file.size);
                        dropzoneInstance.processFile(file); // ✅ Now start upload
                    };

                    mediaElement.onerror = function () {
                        showNotification("", "Unable to read media metadata.", "error", false);
                        dropzoneInstance.removeFile(file);
                    };
                } else {
                    // Not media, no need to wait
                    TimeDurationFile = "";
                    fileSize = formatFileSize(file.size);
                    dropzoneInstance.processFile(file); // ✅ Start upload
                }

                function formatDuration(seconds) {
                    const mins = Math.floor(seconds / 60);
                    const secs = Math.floor(seconds % 60);
                    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
                }

                function formatFileSize(bytes) {
                    const kb = bytes / 1024;
                    const mb = kb / 1024;
                    return mb.toFixed(2) + " MB";
                }
            });

            this.on("sending", function (file, xhr, formData) {
                // Check if checkbox is checked
                let IsAlbum = $("#chkAudioBook").prop("checked");

                // Get the label text (e.g., "Music Album (Songs)")
                let UploadType = $("#chkAudioBook").closest("label").clone()
                    .children()   // remove checkbox & span
                    .remove()
                    .end()
                    .text().trim();

                // Normalize UploadType
                if (UploadType.includes("Audio")) {
                    UploadType = "IsAudioBook";
                } else {
                    UploadType = "";
                }

                // Append values
                formData.append("CurrentFileID", CurrentFileID || "");
                formData.append("TimeDurationFile", TimeDurationFile || "");
                formData.append("fileSize", fileSize || "");
                formData.append("UploadTypeVal", IsAlbum ? "true" : "false"); // ✅ clearer
                formData.append("UploadType", UploadType);
            });
            this.on("success", function (file, response) {
                TimeDurationFile = null;
                fileSize = null;

                if (!response.success) {
                    showNotification("", response.message, "error", false);
                    dropzoneInstance.removeFile(file);
                    return;
                }

                $("#txtsharelinkAudioBook").val(response.message ?? "");
                $("#txtfreelinkAudioBook").val(response.freeAzureURL ?? "");
                $("#hdnshareID").val(response.shareID);

                $("#imageQRAudioBook").attr("src", "/QRCodeImages/" + response.marketingQRName).on("load", function () {
                    $("#imageQR-AudioBook").css("display", "flex");
                    $("#qrtext-AudioBook").css("display", "none");
                }).on("error", function () {
                    $("#imageQR-AudioBook").css("display", "none");
                    $("#qrtext-AudioBook").css("display", "flex");
                });

                $("#imageQRAudioBook-Payment").attr("src", "/QRCodeImages/" + response.paymentQRName).on("load", function () {
                    $("#imageQR-AudioBook-Payment").css("display", "flex");
                    $("#qrtext-AudioBook-Payment").css("display", "none");
                }).on("error", function () {
                    $("#imageQR-AudioBook-Payment").css("display", "none");
                    $("#qrtext-AudioBook-Payment").css("display", "flex");
                });

                file.previewElement.addEventListener("click", function () {
                    dropzoneInstance.removeFile(file);
                    $("#txtRedirect").removeAttr("readonly");
                    $(".dz-preview").remove();
                    $("#previewFile").hide();

                    $.post("/ShareRedirector/RemoveUploadedFile", { FileID: CurrentFileID })
                        .done(function () {
                            $("#imageQR-AudioBook").hide();
                            $("#qrtext-AudioBook").show();
                            $("#txtsharelinkAudioBook").val("");
                            $("#imageQR-AudioBook-Payment").hide();
                            $("#qrtext-AudioBook-Payment").show();
                            $("#txtfreelinkAudioBook").val("");
                        })
                        .fail(function () {
                            showNotification("", "Failed to remove uploaded file", "error", false);
                        });
                });
            });

            this.on("error", function (file, errorMessage) {
                TimeDurationFile = null;
                fileSize = null;
                dropzoneInstance.removeFile(file);
                showNotification("", "Error uploading file: " + errorMessage, "error", false);
            });
        }
    });
    //For upload video files.
    let videoDropzone = new Dropzone("#Videouploader", {
        url: "/ShareRedirector/upload",
        dictDefaultMessage: "",
        paramName: "file",
        maxFilesize: 600,
        acceptedFiles: ".mp4",
        autoProcessQueue: false, // Disable automatic upload
        init: function () {
            let dropzoneInstance = this;

            this.on("addedfile", function (file) {
                // Step 2: Get uploaded file type
                let fileName = file.name;
                let uploadedType = fileName.split('.').pop().toLowerCase();

                // Step 5: Disallow empty files
                if (file.size === 0) {
                    dropzoneInstance.removeFile(file);
                    showNotification("", "Uploading 0-byte files is not allowed.", "error", false);
                    return;
                }

                // Step 6: Handle audio/video duration
                if (file.type.startsWith("audio") || file.type.startsWith("video")) {
                    const mediaElement = document.createElement(file.type.startsWith("audio") ? "audio" : "video");
                    mediaElement.preload = "metadata";
                    const fileURL = URL.createObjectURL(file);
                    mediaElement.src = fileURL;

                    mediaElement.onloadedmetadata = function () {
                        URL.revokeObjectURL(fileURL);
                        const durationInSeconds = mediaElement.duration;
                        TimeDurationFile = formatDuration(durationInSeconds);
                        fileSize = formatFileSize(file.size);
                        dropzoneInstance.processFile(file); // ✅ Now start upload
                    };

                    mediaElement.onerror = function () {
                        showNotification("", "Unable to read media metadata.", "error", false);
                        dropzoneInstance.removeFile(file);
                    };
                } else {
                    // Not media, no need to wait
                    TimeDurationFile = "";
                    fileSize = formatFileSize(file.size);
                    dropzoneInstance.processFile(file); // ✅ Start upload
                }

                function formatDuration(seconds) {
                    const mins = Math.floor(seconds / 60);
                    const secs = Math.floor(seconds % 60);
                    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
                }

                function formatFileSize(bytes) {
                    const kb = bytes / 1024;
                    const mb = kb / 1024;
                    return mb.toFixed(2) + " MB";
                }
            });

            this.on("sending", function (file, xhr, formData) {
                // Check if checkbox is checked
                let IsVideo = $("#chkVideoFiles").prop("checked");

                // Get the label text (e.g., "Music Album (Songs)")
                let UploadType = $("#chkVideoFiles").closest("label").clone()
                    .children()   // remove checkbox & span
                    .remove()
                    .end()
                    .text().trim();

                // Normalize UploadType
                if (UploadType.includes("Video")) {
                    UploadType = "IsVideoFile";
                } else {
                    UploadType = "";
                }

                // Append values
                formData.append("CurrentFileID", CurrentFileID || "");
                formData.append("TimeDurationFile", TimeDurationFile || "");
                formData.append("fileSize", fileSize || "");
                formData.append("UploadTypeVal", IsVideo ? "true" : "false"); // ✅ clearer
                formData.append("UploadType", UploadType);
            });
            this.on("success", function (file, response) {
                TimeDurationFile = null;
                fileSize = null;

                if (!response.success) {
                    showNotification("", response.message, "error", false);
                    dropzoneInstance.removeFile(file);
                    return;
                }

                $("#txtsharelinkVideoFiles").val(response.message ?? "");
                $("#txtfreelinkVideoFiles").val(response.freeAzureURL ?? "");
                $("#hdnshareID").val(response.shareID);

                $("#imageQRVideoFiles").attr("src", "/QRCodeImages/" + response.marketingQRName).on("load", function () {
                    $("#imageQR-VideoFiles").css("display", "flex");
                    $("#qrtext-VideoFiles").css("display", "none");
                }).on("error", function () {
                    $("#imageQR-VideoFiles").css("display", "none");
                    $("#qrtext-VideoFiles").css("display", "flex");
                });

                $("#imageQRVideoFiles-Payment").attr("src", "/QRCodeImages/" + response.paymentQRName).on("load", function () {
                    $("#imageQR-VideoFiles-Payment").css("display", "flex");
                    $("#qrtext-VideoFiles-Payment").css("display", "none");
                }).on("error", function () {
                    $("#imageQR-VideoFiles-Payment").css("display", "none");
                    $("#qrtext-VideoFiles-Payment").css("display", "flex");
                });

                file.previewElement.addEventListener("click", function () {
                    dropzoneInstance.removeFile(file);
                    $("#txtRedirect").removeAttr("readonly");
                    $(".dz-preview").remove();
                    $("#previewFile").hide();

                    $.post("/ShareRedirector/RemoveUploadedFile", { FileID: CurrentFileID })
                        .done(function () {
                            $("#imageQR-VideoFiles").hide();
                            $("#qrtext-VideoFiles").show();
                            $("#txtsharelinkVideoFiles").val("");
                            $("#imageQR-VideoFiles-Payment").hide();
                            $("#qrtext-VideoFiles-Payment").show();
                            $("#txtfreelinkAudioBook").val("");
                        })
                        .fail(function () {
                            showNotification("", "Failed to remove uploaded file", "error", false);
                        });
                });
            });

            this.on("error", function (file, errorMessage) {
                TimeDurationFile = null;
                fileSize = null;
                dropzoneInstance.removeFile(file);
                showNotification("", "Error uploading file: " + errorMessage, "error", false);
            });
        }
    });
    //For upload files.
    let PDFFilesDropzone = new Dropzone("#Filesuploader", {
        url: "/ShareRedirector/upload",
        dictDefaultMessage: "",
        paramName: "file",
        maxFilesize: 600,
        acceptedFiles: ".pdf,.txt,.jpg,.jpeg,.png,.gif,.bmp,.webp",
        autoProcessQueue: false, // Disable automatic upload
        init: function () {
            let dropzoneInstance = this;

            this.on("addedfile", function (file) {
                // Step 2: Get uploaded file type
                let fileName = file.name;
                let uploadedType = fileName.split('.').pop().toLowerCase();

                // Step 5: Disallow empty files
                if (file.size === 0) {
                    dropzoneInstance.removeFile(file);
                    showNotification("", "Uploading 0-byte files is not allowed.", "error", false);
                    return;
                }

                // Step 6: Handle audio/video duration
                if (file.type.startsWith("audio") || file.type.startsWith("video")) {
                    const mediaElement = document.createElement(file.type.startsWith("audio") ? "audio" : "video");
                    mediaElement.preload = "metadata";
                    const fileURL = URL.createObjectURL(file);
                    mediaElement.src = fileURL;

                    mediaElement.onloadedmetadata = function () {
                        URL.revokeObjectURL(fileURL);
                        const durationInSeconds = mediaElement.duration;
                        TimeDurationFile = formatDuration(durationInSeconds);
                        fileSize = formatFileSize(file.size);
                        dropzoneInstance.processFile(file); // ✅ Now start upload
                    };

                    mediaElement.onerror = function () {
                        showNotification("", "Unable to read media metadata.", "error", false);
                        dropzoneInstance.removeFile(file);
                    };
                } else {
                    // Not media, no need to wait
                    TimeDurationFile = "";
                    fileSize = formatFileSize(file.size);
                    dropzoneInstance.processFile(file); // ✅ Start upload
                }

                function formatDuration(seconds) {
                    const mins = Math.floor(seconds / 60);
                    const secs = Math.floor(seconds % 60);
                    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
                }

                function formatFileSize(bytes) {
                    const kb = bytes / 1024;
                    const mb = kb / 1024;
                    return mb.toFixed(2) + " MB";
                }
            });

            this.on("sending", function (file, xhr, formData) {
                // Check if checkbox is checked
                let IsFiles = $("#chkDownloadFiles").prop("checked");

                // Get the label text (e.g., "Music Album (Songs)")
                let UploadType = $("#chkDownloadFiles").closest("label").clone()
                    .children()   // remove checkbox & span
                    .remove()
                    .end()
                    .text().trim();

                // Normalize UploadType
                if (UploadType.includes("Files")) {
                    UploadType = "IsPDFFiles";
                } else {
                    UploadType = "";
                }

                // Append values
                formData.append("CurrentFileID", CurrentFileID || "");
                formData.append("TimeDurationFile", TimeDurationFile || "");
                formData.append("fileSize", fileSize || "");
                formData.append("UploadTypeVal", IsFiles ? "true" : "false"); // ✅ clearer
                formData.append("UploadType", UploadType);
            });
            this.on("success", function (file, response) {
                TimeDurationFile = null;
                fileSize = null;

                if (!response.success) {
                    showNotification("", response.message, "error", false);
                    dropzoneInstance.removeFile(file);
                    return;
                }

                $("#txtsharelinkPDFiles").val(response.message ?? "");
                $("#hdnshareID").val(response.shareID);

                $("#imageQRPDFiles").attr("src", "/QRCodeImages/" + response.marketingQRName).on("load", function () {
                    $("#imageQR-PDFiles").css("display", "flex");
                    $("#qrtext-PDFiles").css("display", "none");
                }).on("error", function () {
                    $("#imageQR-PDFiles").css("display", "none");
                    $("#qrtext-PDFiles").css("display", "flex");
                });

                file.previewElement.addEventListener("click", function () {
                    dropzoneInstance.removeFile(file);
                    $("#txtRedirect").removeAttr("readonly");
                    $(".dz-preview").remove();
                    $("#previewFile").hide();

                    $.post("/ShareRedirector/RemoveUploadedFile", { FileID: CurrentFileID })
                        .done(function () {
                            $("#imageQR-PDFiles").hide();
                            $("#qrtext-PDFiles").show();
                            $("#txtsharelinkPDFiles").val("");
                        })
                        .fail(function () {
                            showNotification("", "Failed to remove uploaded file", "error", false);
                        });
                });
            });

            this.on("error", function (file, errorMessage) {
                TimeDurationFile = null;
                fileSize = null;
                dropzoneInstance.removeFile(file);
                showNotification("", "Error uploading file: " + errorMessage, "error", false);
            });
        }
    });
});

//For validate Drop downs.
function validateDropdowns() {
    let valid = true;
    // Validate Author
    var ddlauthor = $("#ddlAuthor").val();
    if (ddlauthor == "") {
        $("#ddlAuthor").addClass("field-err");
        valid = false;
    } else {
        $("#ddlAuthor").removeClass("field-err");
    }

    // Validate Series
    var ddlseries = $("#ddlSeries").val();
    if (ddlseries == "") {
        $("#ddlSeries").addClass("field-err");
        valid = false;
    } else {
        $("#ddlSeries").removeClass("field-err");
    }

    // Validate Product
    var ddlproduct = $("#ddlProduct").val();
    if (ddlproduct == "") {
        $("#ddlProduct").addClass("field-err");
        valid = false;
    } else {
        $("#ddlProduct").removeClass("field-err");
    }

    // Validate Delivery
    var ddldelivery = $("#ddlDelivery").val();
    if (ddldelivery == "") {
        $("#ddlDelivery").addClass("field-err");
        valid = false;
    } else {
        $("#ddlDelivery").removeClass("field-err");
    }


    return valid;
}

//For Update the content panel data.
function updateFileDetails() {
    var isChecked = $("#chkRedirector").is(":checked");

    if (isChecked) {
        let customURL = $("#txtRedirectURL").val();

        if (!customURL) {
            //showNotification("", "", "error", false);
            $("#chkRedirector").prop("checked", false);
            openrightnav()
            return;
        }

        let fileId = CurrentFileID // assuming you keep FileId in hidden field

        $.ajax({
            url: '/ShareRedirector/InsertRedirectURL',   // your controller/action or API endpoint
            type: 'POST',
            data: {
                "FileId": fileId,
                "URL": customURL
            },
            dataType: "json",
            success: function (response) {
                if (response.status) {
                    showNotification("", "File details processed successfully.", "success", true);
                    $("#NoContent_" + CurrentFileID).remove();
                    openrightnav()
                    $("#txtsavebtn").css("display", "inline-block");
                    $("#txtupdatebtn").css("display", "none");
                } else {
                    $("#txtsavebtn").css("display", "inline-block");
                    $("#txtupdatebtn").css("display", "none");
                }
            },
            error: function (xhr, status, error) {
                console.error("Error:", error);
                showNotification("", "Something went wrong while saving.", "error", false);
            }
        });
    } else {
        $.ajax({
            type: "POST",
            url: "/ShareRedirector/GetFilesDetails",
            contentType: "application/json;charset=utf-8",
            dataType: "json",
            async: true,
            data: {},
            success: function (response) {
                if (response && response.length > 0) {
                    for (let i = 0; i < response.length; i++) {

                        if (response[i].fileID === CurrentFileID) {
                            if (response[i].isContentAvailable) {
                                // Remove red indicator if content exists
                                $("#NoContent_" + CurrentFileID).remove();
                            } 
                        }
                    }

                    openrightnav();
                    $("#txtsavebtn").css("display", "inline-block");
                    $("#txtupdatebtn").css("display", "none");
                }
            }
,
            error: function (error) {
                showNotification("", "Error: " + error.responseText, "error", false);
            }
        });
    }
}

//Save uploaded file
function saveFileDetails() {
    var FileID = CurrentFileID;
    var fileName = $("#txtfilename").val().trim();
    var shareDescription = $("#txtdesc").val().trim();
    var isSpotlight = $("#chkIsSpotlight").prop("checked");
    var deliveryID = $("#ddlDelivery").val();
    var validateDDL = validateDropdowns();
    var displayOrder = $("#numDisplayOrder").val();
    // Validate both fields
    var isFileNameValid = validateFileName();
    var isDisplayOrder = validateDisplayOrder();

    if (!validateDDL || !isFileNameValid) {
        return;
    }

    // Stop execution if validation fails
    if (!isFileNameValid) {
        return;
    }
    // Stop execution if validation fails
    if (!isDisplayOrder) {
        return;
    }

    $.ajax({
        type: "POST",
        url: "/ShareRedirector/SaveFileDetails",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "FileID": FileID,
            "FileName": fileName,
            "ShareDescription": shareDescription,
            "IsSpotlight": isSpotlight,
            "DeliveryID": deliveryID,
            "DisplayOrder": displayOrder,
        },
        success: function (response) {
            if (response.status) {
                let DisplayOrder = formatDisplayOrder(response.displayOrder);
                //Add file name
                $(`#txtfileName_${response.id}`).val(response.fileName);
                $(`#displayOrder_${response.id}`).text(DisplayOrder);

                //Update file structure
                if (response.isFileUpdate) {

                    $(`.SubfileID_${response.id}`).remove();

                    let DivContainer = $("#divShareRedirect");

                    if (response.isFile) {
                        var FileHtml = `
                            <div class="mm-item-nav-row mm-item-lvl-5  root_${response.rootId} SubfileID_${response.id}" id="Level_${response.fileID}" onclick="SetFile(${response.fileID})">
                                <div class="mm-item-nav-row-icon">
                                    <img src="/images/item.png">
                                </div>
                                 <div class="mm-item-nav-row-icon" style="width:25px; text-align: center;">
                                  <p>${displayOrder}</p>
                                </div>
                                
                                <input type="text" readonly id="txtfileName_${response.id}" value="${response.fileName}" ondblclick="renameFolder('txtrenameFolder_${response.id}');" onblur="EditFolderName('${response.id}', 'txtfileName_${response.id}',true)" />
                                <div class="add-items">
                                     <label class="switch">
                                             <input type="checkbox" onclick="ActiveStructure('${response.id}');" id="togglePlan_${response.id}" checked>
                                                <span class="slider round"></span>
                                        </label>
                                    <span onclick="showDeletePopup('folderId_${response.id}',false)">
                                        <img src="/images/trash-icon.svg" alt="Delete File" title="Delete File">
                                    </span>
                                    
                                </div>
                            </div>`;

                        DivContainer = $("#navitem_" + response.rootId);
                        $(DivContainer).append(FileHtml);
                    }
                }

                //Show QR toggle and second panel.
                $("#qr-btn").css("display", "flex");
                $("#first-panel").css("display", "none");
                $("#second-panel").css("display", "block");

                //For The purpose to make Music Album open when user switch second panel.
                ExpendContentPanel('music-album');
                $("#chkMusicAlbum").prop("checked", true);
                $("#music-album").removeClass("disable-block");

                $("#txtsavebtn").css("display", "none");
                $("#txtupdatebtn").css("display", "inline-block");

            } else {
                showNotification("", "Failed to insert file details", "error", false);
            }
        },
        error: function (error) {
            showNotification("", error.responseText, "error", false);
        }
    });
}


function CollapseExpandParent(id) {
    var $rootFolder = $("#folderId_" + id);
    var isExpanding = !$rootFolder.hasClass("active");
    // Toggle root folder
    $rootFolder.toggleClass("active");

    if ($rootFolder.hasClass("active")) {
        $("#navitem_" + id).show();
        $rootFolder.find(".mm-collapse").show();
        $rootFolder.find(".mm-expand").hide();
    } else {
        $("#navitem_" + id).hide();
        $rootFolder.find(".mm-collapse").hide();
        $rootFolder.find(".mm-expand").css("display", "flex");
    }
    // Collapse all subfolders only inside the selected root folder
    $rootFolder.find("[id^='SubFolderID_']").each(function () {
        var subId = this.id.replace("SubFolderID_", "");
        var $subFolder = $("#SubFolderID_" + subId);
        var $navItem = $("#navitem_" + subId);
        var $collapseIcon = $subFolder.find(".mm-collapse");
        var $expandIcon = $subFolder.find(".mm-expand");

        $subFolder.removeClass("active");
        $navItem.hide();
        $collapseIcon.hide();
        $expandIcon.css("display", "flex");
    });
}
function closeFolderPopup() {
    var closebtn = document.getElementById('FolderPopup');
    if (closebtn) {
        closebtn.style.display = "none";
    }
    $("#selectedFolderId").val("");
    $("#txtfoldername").val("");
    $("#hdnid").val("");
    $("#level").val("");

    $("#txtfoldername").removeClass("field-err");
    $("#folderNameError").hide();

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

//Add folder that create on azure blob.
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
        $("#txtfoldername").focus();
    }
}

//Add folder 
function AddSubFolder(Id, IsRoot, Level) {
    //close moreOption window
    $('#moreoption_' + Id.split('_')[1]).css("display", "none");


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
        $("#txtfoldername").focus();
    }
}

//Add new file
function AddNewFile(Id, IsRoot, Level) {
    $('#moreoption_' + Id.split('_')[1]).css("display", "none");

    $("#previewFile").css("display", "none");
    //$(".dz-preview").remove();
    // Check if any files are still uploading
    let totalFiles = $(".dz-preview").length;
    let completedFiles = $(".dz-preview.dz-complete").length;

    // Restrict saving only if there are files AND some are still uploading
    if (totalFiles > 0 && totalFiles !== completedFiles) {
        showNotification("", "The current file is uploading. Cannot create a new file at this time.", "error", false);
        return;
    }

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
    $("#previewFile").css("display", "none");
    $(`.mm-item-nav-row`).removeClass('selected');
    //Remove field-err
    $("#txtfilename").removeClass("field-err");
    $("#txtRedirect").removeClass("field-err");

    $(".mm-item-nav-row").removeClass("active");
    $("#Level_" + Fileid).toggleClass("active");
    $("#Level_" + Fileid).addClass("selected");
    CurrentFileID = Fileid;

    let edit = document.querySelector(".edit-panel");
    if (edit) {
        edit.classList.add("active");
    }

    $.ajax({
        type: "GET",
        url: "/ShareRedirector/FilesDetailsGET",
        contentType: "application/json;charset=utf-8",
        dataType: "json",
        async: true,
        data: {
            FileID: CurrentFileID
        },
        // Show loader before sending the request
        beforeSend: function () {
            $("#dataLoader").css("display", "flex");
        },
        success: function (response) {
            if (response != null) {

                $("#second-panel").css("display", "none");
                $("#first-panel").css("display", "block");
                $("#txtsavebtn").css("display", "inline-block");
                $("#txtupdatebtn").css("display", "none");

                if (response.authors && response.authors.length > 0) {
                    let options = '<option value="">-- Select Author --</option>';
                    response.authors.forEach(item => {
                        options += `<option value="${item.authorID}">${item.authorName}</option>`;
                    });
                    $('#ddlAuthor').html(options);

                    if (response.author) {
                        const selected = response.authors.find(a => a.authorName === response.author);
                        if (selected) $('#ddlAuthor').val(selected.authorID);
                    }
                }

                // Bind Series dropdown
                if (response.seriesModel && response.seriesModel.length > 0) {
                    let seriesOptions = '<option value="">-- Select Series --</option>';
                    response.seriesModel.forEach(item => {
                        seriesOptions += `<option value="${item.seriesID}">${item.seriesName}</option>`;
                    });
                    $('#ddlSeries').html(seriesOptions);

                    if (response.series) {
                        const selectedSeries = response.seriesModel.find(a => a.seriesName === response.series);
                        if (selectedSeries) $('#ddlSeries').val(selectedSeries.seriesID);
                    }
                } else {
                    $('#ddlSeries').html('<option value="">-- Select Series --</option>');
                }

                // Bind Product dropdown
                if (response.productModel && response.productModel.length > 0) {
                    let productOptions = '<option value="">-- Select Product --</option>';
                    response.productModel.forEach(item => {
                        productOptions += `<option value="${item.productID}">${item.productName}</option>`;
                    });
                    $('#ddlProduct').html(productOptions);

                    if (response.product) {
                        const selectedProduct = response.productModel.find(a => a.productName === response.product);
                        if (selectedProduct) $('#ddlProduct').val(selectedProduct.productID);
                    }
                } else {
                    $('#ddlProduct').html('<option value="">-- Select Product --</option>');
                }

                // Bind Delivery dropdown
                if (response.deliveryModel && response.deliveryModel.length > 0) {
                    let deliveryOptions = '<option value="">-- Select Delivery --</option>';
                    response.deliveryModel.forEach(item => {
                        deliveryOptions += `<option value="${item.deliveryID}">${item.deliveryName}</option>`;
                    });
                    $('#ddlDelivery').html(deliveryOptions);

                    if (response.delivery) {
                        const selectedDelivery = response.deliveryModel.find(a => a.deliveryName === response.delivery);
                        if (selectedDelivery) $('#ddlDelivery').val(selectedDelivery.deliveryID);
                    }
                } else {
                    $('#ddlDelivery').html('<option value="">-- Select Delivery --</option>');
                }

                $("#numDisplayOrder").val(response.displayOrder);
                $("#txtfilename").val(response.fileName);
                $("#txtdesc").val(response.shareDescription);
                $("#chkIsSpotlight").prop("checked", response.isSpotlight === "1" || response.isSpotlight === true);

                //---------------------------------------------------------------
                if (response.fileName) {
                    $("#txtsavebtn").text("Update");
                    $("#txtmainSection").text(response.fileName);
                    $("#qr-btn").css("display", "flex");
                } else {
                    $("#txtsavebtn").text("Save");
                    $("#txtmainSection").text("File Upload");
                    $("#qr-btn").css("display", "none");
                }

                setTimeout(() => {
                    ThumbnailPopup("ID_" + response.productID);
                    Get_Content_Record(CurrentFileID);
                }, 100);


            } else {
                $("#txtfilename").val("");
                $("#txtdesc").val("");
                $("#chkIsSpotlight").prop("checked", false); // Uncheck the checkbox
                $("#txtsavebtn").text("Save");
            }

        },
        error: function (error) {
            console.error("Error:", error);
        },
        // Always hide the loader after response (success or error)
        complete: function () {
            $("#dataLoader").css("display", "none");
        }
    });
}

//Create new folder
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
        url: "/ShareRedirector/SaveFileStructure",
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
                if (response.folderlevel == "Level_0") {
                    FetchShareDetails();
                    let edit = document.querySelector(".edit-panel");
                    if (edit) {
                        edit.classList.remove("active");
                        CurrentFileID = null;
                    }
                    return;
                }
                //----------------------------------------------------
                let DivContainer = $("#divShareRedirect");

                let parts = response.folderlevel.split("_");

                if (parts.length === 2 && !isNaN(parts[1])) {
                    // Increment the numeric part
                    var NextLevel = `${parts[0]}_${parseInt(parts[1]) + 1}`;

                    if (NextLevel == 'Level_5') {
                        var hideFolder = 'Style="display:none;"'
                    } else {
                        var hideFolder = ''
                    }
                }



                var additionalClass_Leval = "";
                let folderpicture = "";
                let filepicture = "";
                let activetoggle = "";
                let addFile = "";
                let ProductImage = "";
                let Productthumb = "";
                filepicture = "/images/item.png";
                let MoveBtn = "";

                switch (response.folderlevel) {
                    case "Level_0":
                        additionalClass_Leval = "mm-item-lvl";
                        break;
                    case "Level_2":
                        additionalClass_Leval = "mm-item-lvl-2";
                        if (response.isFolder) {
                            folderpicture = "/images/series.png";
                        }
                        break;
                    case "Level_3":
                        additionalClass_Leval = "mm-item-lvl-3";
                        if (response.isFolder) {
                            folderpicture = "/images/product.png";
                        }
                        activetoggle = `
<label class="switch">
  <input type="checkbox" onclick="ActiveStructure('${response.id}');" id="togglePlan_${response.id}" checked>
  <span class="slider round"></span>
</label>
`;

                        ProductImage = `<div class="more-options-item">
    <span >
        <img src="/images/image-icon.svg" alt="Thumbnail" title="Add Thumbnail">
    </span>
        <input type="file" id="thumbnailUploader" style="display: none;" accept="image/*">
    <p>Add Thumbnail</p>
</div>`;


                        if (response.productImage && response.productImage.trim() !== '') {
                            Productthumb = `<div class="product-thumb">
        <div class="product-thumb-inner" >
            <img src="../ProductThumbnail/${response.productImage}" id="ProductIMG_${response.id}" alt="" />
        </div>
    </div>`;
                        } else {
                            Productthumb = `<div class="product-thumb" id="ProductThumb_${response.id}" style="display:none;">
        <div class="product-thumb-inner" >
            <img src="" id="ProductIMG_${response.id}" alt=""  />
        </div>
    </div>`;
                        }

                        break;
                    case "Level_4":
                        additionalClass_Leval = "mm-item-lvl-4";
                        if (response.isFolder) {
                            folderpicture = "/images/delivery-type.png";
                        }
                        activetoggle = `
<label class="switch">
  <input type="checkbox" onclick="ActiveStructure('${response.id}');" id="togglePlan_${response.id}" checked>
  <span class="slider round"></span>
</label>
`;


                        addFile = ` <div class="more-options-item">
                                                <span onclick="AddNewFile('folderId_${response.id}', 'No', '${NextLevel}')">
                                                    <img src="/images/add-file-2.svg" alt="Add File" title="Add New File" />
                                                </span>
                                                <p>Add New File</p>
                                            </div>`;


                        break;
                    case "Level_5":
                        additionalClass_Leval = "mm-item-lvl-5";
                        break;
                }

                if (!folderpicture) {
                    folderpicture = "/images/author.png";

                    MoveBtn = `<div class="more-options-item">
    <span onclick="MoveAutherPopup('${response.id}','${response.folderName}')">
        <img src="/images/move.svg" alt="Move Store"  title="Move Store">
    </span>
    <input type="file" id="thumbnailUploader" style="display: none;" accept="image/*">
    <p>Add Thumbnail</p>
</div>`;
                }




                if (response.isFolder) {
                    var FolderHtml = `    <div class="mm-item-nav-row ${additionalClass_Leval} nav_${response.folderlevel} root_${response.rootId}"  id="SubFolderID_${response.id}">
                             <div class="mm-nav-icon mm-expand" onclick="CollapseExpandFolder('${response.id}')">+</div>
                               <div class="mm-nav-icon mm-collapse" onclick="CollapseExpandFolder('${response.id}')">−</div>
                                <div class="mm-item-nav-row-icon">
                                    <img src="${folderpicture}" class="row-folder" />
                                    <img src="/images/add-file-2.svg" class="row-file" style="display:none;" />
                                </div>
                                <input type="text" value="${response.folderName}" readonly ondblclick="renameFolder('txtrenameFolder_${response.id}');" id="txtrenameFolder_${response.id}" autocomplete="off" maxlength="63"  onblur="EditFolderName('${response.id}', 'txtrenameFolder_${response.id}',false)"  >
                                <span id="RenamefolderError_${response.id}" style="display: none;"></span>
                                <div class="add-items">
                               ${Productthumb}
                                ${activetoggle}
                                        
                                        <span>
                                            <img src="/images/ellipsis.svg" alt="More Options" onclick="Addmoreoption('${response.id}')" title="More Options">
                                        </span>
                                        <div class="more-options" id="moreoption_${response.id}" style="display:none">
                                            <div class="more-options-item" ${hideFolder}>
                                                <span   onclick="AddSubFolder('folderId_${response.id}', 'IsRoot', '${NextLevel}')">
                                                <img src="/images/folder-add-2.svg" alt="Add Folder" title="Add New Folder" />
                                                </span>
                                                <p>Add New Folder</p>
                                            </div>

                                            ${addFile}

                                            <div class="more-options-item">
                                                 <span onclick="showDeletePopup('ID_${response.id}',true)">
                                                 <img src="/images/trash-icon.svg" alt="Delete Folder" title="Delete Folder">
                                                 </span>
                                            </div>
                                   
                                            <div class="more-options-item">
                                                <span  onclick="renameFolder('txtrenameFolder_${response.id}');">
                                                <img src="/images/edit-icon2.svg" alt="Edit" title="Edit">
                                                </span>
                                            </div>

                                            ${ProductImage}
                                            ${MoveBtn}
                                       </div>
                                </div>
                                  
                            </div>
                            <div class="mm-item-nav" id="navitem_${response.id}" >
                            </div>`;
                    DivContainer = $("#navitem_" + response.rootId);
                    $(DivContainer).append(FolderHtml);

                }
                else if (response.isFile) {
                    let DisplayOrder = formatDisplayOrder(response.displayOrder);
                    var FileHtml = `
                            <div class="mm-item-nav-row ${additionalClass_Leval}  root_${response.rootId} SubfileID_${response.id}" id="Level_${response.fileID}" onclick="SetFile(${response.fileID})">
                                <div class="mm-item-nav-row-icon">
                                    <img src="${filepicture}">
                                </div>
                                  <div class="mm-item-nav-row-icon" style="width:25px; text-align: center;">
                                  <p>${DisplayOrder}</p>
                                </div>
                             <input type="text" readonly id="txtfileName_${response.id}" value="${response.fileName}" ondblclick="renameFolder('txtfileName_${response.id}');" onblur="EditFolderName('${response.id}', 'txtfileName_${response.id}',true)" />
                              <img src="/images/red-indicator.png" title="No content available" id="NoContent_${response.fileID}" />   
                             <div class="add-items">
                                     <label class="switch">
                                             <input type="checkbox" onclick="ActiveStructure('${response.id}');" id="togglePlan_${response.id}" checked>
                                                <span class="slider round"></span>
                                        </label>
                                    <span onclick="showDeletePopup('folderId_${response.id}',false)">
                                        <img src="/images/trash-icon.svg" alt="Delete File" title="Delete File">
                                    </span>
                                    
                                </div>
                            </div>`;


                    DivContainer = $("#navitem_" + response.rootId);
                    $(DivContainer).append(FileHtml);

                } else if (response.folderlevel === "Level_0") {
                    var htmlMemory = `<div class="mm-item   root_${response.rootId}" data-root="${response.rootId}" id="folderId_${response.rootId}">
                                <div class="mm-item-title clsparentfolder m-0">
                                    <div class="mm-nav-icon mm-expand" onclick="CollapseExpandParent('${response.rootId}')">+</div>
                                    <div class="mm-nav-icon mm-collapse" onclick="CollapseExpandParent('${response.rootId}')">−</div>
                                     <img src="/images/store.svg" alt="Author" style="width:21px; margin-right: 5px;" />
                                    <p style="margin-left: 6px;">${response.folderName}</p>
                                    <div class="add-items">
                                   
                                        <span onclick="AddSubFolder('folderId_${response.rootId}', 'IsRoot', 'Level_1')">
                                            <img src="/images/folder-add-2.svg" alt="Create New Folder" title="Create New Folder">
                                        </span>
                                    </div>
                                </div>
                                <div class="mm-item-nav" id="navitem_${response.rootId}">
                                </div>
                            </div>`;
                    $(DivContainer).append(htmlMemory);

                }

                //------------------------------------------------------
                if (response.folderlevel == "Level_5") {
                    SetFile(response.fileID);
                }
                var $rootFolder = $("#folderId_" + FolderID);


                //var $firstSubFolder = $rootFolder.find("[id^='SubFolderID_']").first(); // Select only the first match
                if ($rootFolder.length) {
                    var subId = $rootFolder.attr("id").replace("SubFolderID_", "");
                    var $subFolder = $("#SubFolderID_" + FolderID);
                    var $navItem = $("#navitem_" + FolderID);
                    var $collapseIcon = $rootFolder.find(".mm-collapse");
                    var $expandIcon = $rootFolder.find(".mm-expand");


                    $subFolder.addClass("active");
                    $navItem.show();
                    $collapseIcon.hide();
                    $expandIcon.css("display", "flex");
                }

                $("#folderId_" + FolderID + " > div > .mm-expand").css("display", "none");
                $("#folderId_" + FolderID + " >div >.mm-collapse").css("display", "flex")


                if ($("#SubFolderID_" + response.rootId).hasClass('active') == false) {
                    let expandIcon = $("#SubFolderID_" + response.rootId).find(".mm-expand");
                    let collapseIcon = $("#SubFolderID_" + response.rootId).find(".mm-collapse");

                    expandIcon.hide();
                    collapseIcon.css("display", "flex");


                    $("#navitem_" + response.rootId).css("display", "block");
                    $("#SubFolderID_" + response.rootId).removeClass("active");

                    let expandIconsub = $("#SubFolderID_" + response.id).find(".mm-expand");
                    let collapseIconsub = $("#SubFolderID_" + response.id).find(".mm-collapse");

                    expandIconsub.hide();
                    collapseIconsub.css("display", "flex");


                }
            }
        },
        error: function (error) {
            showNotification("", "Failed to create", "error", false);
        }
    });
}

//Show delete popup.
function showDeletePopup(Id, isFolder) {
    //close moreOption window
    $('#moreoption_' + Id.split('_')[1]).css("display", "none");

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

    $("#deleteFolder").css("display", "block");
    $("#delteQRicon").css("display", "none");
}
//Delete folder from Azure and DB
function DeleteFolder() {
    var ID = $("#hdnid").val();
    //var ID = 
    $.ajax({
        type: "POST",
        url: "/ShareRedirector/DeleteFolder",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            ID: ID
        },
        success: function (response) {
            if (response != null) {
                if (response.redirector.message == "Success") {

                    $("#DeleteFolderPopup").hide();
                    $("#qr-btn").css("display", "none");
                    if (response.redirector.isFile) {
                        $(`.SubfileID_${ID}`).remove();
                        let edit = document.querySelector(".edit-panel");
                        if (edit) {
                            edit.classList.remove("active");
                        }
                    } else if (response.redirector.folderlevel === 'Level_0') {
                        $(`#folderId_${ID}`).remove();
                    } else {
                        $(`#SubFolderID_${ID}`).remove();
                    }


                }
                else {
                    $("#DeleteFolderPopup").hide();
                    showNotification("", "Please delete the sub-items first!", "error", false);
                }
            }
        },
        error: function (error) {
        }
    });
}

//Validation of required
function validateFileName() {
    var fileName = $("#txtfilename").val().trim();
    if (!fileName) {
        $("#txtfilename").addClass("field-err"); // Add error class
        return false;
    }
    $("#txtfilename").removeClass("field-err"); // Remove error class if valid
    return true;
}

//Validation of required
function validateDisplayOrder() {
    var DisplayOrder = $("#numDisplayOrder").val().trim();
    //if (DisplayOrder == 0) {
    //    $("#numDisplayOrder").addClass("field-err"); // Add error class
    //    return false;
    //}
    $("#numDisplayOrder").removeClass("field-err"); // Remove error class if valid
    return true;
}
//Validate folder name
function validateFolderName() {
    var folderName = $("#txtfoldername").val().trim();
    var extraSpacePattern = /\s{2,}/; // Detects multiple consecutive spaces
    var validPattern = /^[a-zA-Z0-9]+(?:[-\s][a-zA-Z0-9]+)*$/;
    var errorMsg = $("#folderNameError"); // Error message element

    if (!folderName) {
        $("#txtfoldername").addClass("field-err");
        $("#folderNameError").addClass("err-msg");
        errorMsg.text("Folder name is required.").show();
        return false;
    } else if (extraSpacePattern.test(folderName)) {
        $("#txtfoldername").addClass("field-err");
        $("#folderNameError").addClass("err-msg");
        errorMsg.text("Extra spaces are not allowed.").show();
        return false;
    } else if (folderName.length < 3 || folderName.length > 63 || !validPattern.test(folderName)) {
        //$("#txtfoldername").addClass("field-err");
        //$("#folderNameError").addClass("err-msg");
        //errorMsg.text("The folder name may only contain letters, numbers, and hyphens and must be 3 to 63 characters long.").show();
        //return false;
    }

    $("#folderNameError").removeClass("err-msg");
    $("#txtfoldername").removeClass("field-err");
    errorMsg.hide(); // Hide error message when valid
    return true;
}

//Validation on rename folder
function validateRenameFolder(FolderName) {
    var folderInput = $("#" + FolderName);
    var folderName = folderInput.val().trim();

    // Extract ID from FolderName (assumes FolderName is like 'Folder_2')
    var match = FolderName.match(/\d+$/);
    var folderId = match ? match[0] : null;

    // Dynamic error message element
    var errorMsg = $("#RenamefolderError_" + folderId);

    var extraSpacePattern = /\s{2,}/;
    var validPattern = /^[a-zA-Z0-9]+(?:[-\s][a-zA-Z0-9]+)*$/;

    // Clear previous errors
    folderInput.removeClass("field-err");
    errorMsg.removeClass("err-msg").hide();

    if (!folderName) {
        folderInput.addClass("field-err");
        errorMsg.addClass("err-msg").text("Folder name is required.").show();
        return false;
    } else if (extraSpacePattern.test(folderName)) {
        folderInput.addClass("field-err");
        errorMsg.addClass("err-msg").text("Extra spaces are not allowed.").show();
        return false;
    } else if (folderName.length < 3 || folderName.length > 63 || !validPattern.test(folderName)) {
        //folderInput.addClass("field-err");
        //errorMsg.addClass("err-msg").text("The folder name may only contain letters, numbers, and hyphens and must be 3 to 63 characters long.").show();
        //return false;
    }
    return true;
}

//Show URL's QR on popup.
function QRPopup(id) {
    // Get source from clicked element
    const QRImageSRC = $("#" + id).attr("src");

    // Show popup using jQuery (shorter + consistent with rest of code)
    $("#QRPopup").css("display", "flex");

    // Add cache-busting query param to avoid browser caching
    const cacheBustedSrc = QRImageSRC + "?v=" + new Date().getTime();

    // Update QR image in popup
    $("#imgQR").attr("src", cacheBustedSrc);
}


//Hide URL's QR on popup.
function closeQRPopup() {
    var QR = document.getElementById('QRPopup');
    if (QR) {
        QR.style.display = "none";
    }
    $('#imgQR').attr("src", "");
}
function closeAuthorPopup() {
    var Authorpopup = document.getElementById('Authorpopup');
    if (Authorpopup) {
        Authorpopup.style.display = "none";
    }
    $('#imgQR').attr("src", "");
}

//For download QR code
function downloadQRImage() {
    var imgElement = document.getElementById("imgQR");
    var imgUrl = imgElement.src;
    var filevalue = $("#txtfilename").val();
    var QRfileName = filevalue.replace(/\s+/g, "");
    var fileName = "QR-" + QRfileName;
    fetch(imgUrl)
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

//Open edit profile
function editProfile() {
    window.location.href = "/EditProfile";
}

function DeleteUploadedFile() {
    $("#txtRedirect").val("");
    //$("#txtsharelink").val("");
    $("#txtRedirect").removeAttr("readonly");
    $("#previewFile").css("display", "none");
}

function ActiveStructure(Id) {
    var isChecked = $('#togglePlan_' + Id).prop('checked'); // true or false

    $.ajax({
        url: '/ShareRedirector/ActiveStructure',
        type: 'POST',
        data: { IsActive: isChecked, ID: Id },
        success: function (response) {
            if (response != null && Array.isArray(response)) {
                for (let i = 0; i < response.length; i++) {
                    let item = response[i];
                    let Id = item.id;
                    let IsActive = item.isActive;

                    $("#togglePlan_" + Id).prop("checked", IsActive);
                }
            }

        },
        error: function (err) {
            console.error('Error saving toggle:', err);
        }
    });
}


$('#ddlAuthor').on('change', function () {
    var selectedAuthorId = $(this).val();

    if (selectedAuthorId) {
        $.ajax({
            url: '/ShareRedirector/Fetch_Series',
            type: 'POST',
            data: { authorID: selectedAuthorId },
            success: function (response) {
                var $SeriesDropdown = $('#ddlSeries');
                $SeriesDropdown.empty();
                $SeriesDropdown.append('<option value="">-- Select Series --</option>');
                $.each(response, function (i, item) {
                    $SeriesDropdown.append($('<option>', {
                        value: item.seriesID,     // or relevant property
                        text: item.seriesName    // or relevant property
                    }));
                });
            },
            error: function (err) {
                console.error('Error saving toggle:', err);
            }
        });
    } else {
        // If no author selected, reset the books dropdown
        $('#ddlSeries').empty().append('<option value="">-- Select Series --</option>');
    }
});

$('#ddlSeries').on('change', function () {
    var selectedSeriesId = $(this).val();

    if (selectedSeriesId) {
        $.ajax({
            url: '/ShareRedirector/Fetch_Product',
            type: 'POST',
            data: { seriesId: selectedSeriesId },
            success: function (response) {
                var $ProductDropdown = $('#ddlProduct');
                $ProductDropdown.empty();
                $ProductDropdown.append('<option value="">-- Select Product --</option>');
                $.each(response, function (i, item) {
                    $ProductDropdown.append($('<option>', {
                        value: item.productID,     // or relevant property
                        text: item.productName    // or relevant property
                    }));
                });
            },
            error: function (err) {
                console.error('Error saving toggle:', err);
            }
        });
    } else {
        // If no author selected, reset the books dropdown
        $('#ddlProduct').empty().append('<option value="">-- Select Product --</option>');
    }
});

$('#ddlProduct').on('change', function () {
    var selectedProductId = $(this).val();

    if (selectedProductId) {

        $.ajax({
            url: '/ShareRedirector/Fetch_Delivery',
            type: 'POST',
            data: { productId: selectedProductId },
            success: function (response) {
                var $DeliveryDropdown = $('#ddlDelivery');
                $DeliveryDropdown.empty();
                $DeliveryDropdown.append('<option value="">-- Select Delivery --</option>');
                $.each(response, function (i, item) {
                    $DeliveryDropdown.append($('<option>', {
                        value: item.deliveryID,     // or relevant property
                        text: item.deliveryName    // or relevant property
                    }));
                });
            },
            error: function (err) {
                console.error('Error saving toggle:', err);
            }
        });
    } else {
        // If no author selected, reset the books dropdown
        $('#ddlDelivery').empty().append('<option value="">-- Select Delivery --</option>');
    }
});

function MoveAutherPopup(id, name) {
    //close moreOption window
    $('#moreoption_' + id).css("display", "none");
    //close moreOption window
    var Authorpopup = document.getElementById('Authorpopup');
    if (Authorpopup) {
        Authorpopup.style.display = "flex";
    }
    authID = id;
    $("#SpnauthName").text(name);
    AuthName = name;
    const formData = new FormData();
    formData.append('id', id);
    //Fetch upload thumbnail
    $.ajax({
        url: '/ShareRedirector/GetStoreDetails', // Your endpoint
        type: 'POST',
        data: formData,
        contentType: false,
        processData: false,
        success: function (response) {
            if (response != null) {
                // Bind Store dropdown
                const $ddl = $('#ddlStore');
                $ddl.empty().append('<option value="">-- Select Store --</option>');

                // Assuming response[0].selectedStoreID holds the current store to exclude
                const selectedStoreID = response[0]?.selectedStoreID;

                $.each(response, function (i, item) {
                    if (item.storeID !== selectedStoreID) {
                        $ddl.append($('<option>', {
                            value: item.storeID,
                            text: item.storeName
                        }));
                    }
                });


            }

        },
        error: function (err) {
            showNotification("", "Upload failed.", "error", false);
        }
    });

}

//For the purpose to move store from one store to another store
function submitSelectedStore() {
    var selectedStoreID = $('#ddlStore').val();
    var selectedAuthorID = authID;

    if (!selectedStoreID) {
        showNotification("", "Please select a store.", "warning", false);
        return;
    }
    if (!selectedAuthorID) {
        showNotification("", "Please select a store.", "warning", false);
        return;
    }

    $.ajax({
        url: '/ShareRedirector/MoveAuthor',
        type: 'POST',
        data: { storeID: selectedStoreID, authorID: selectedAuthorID },

        // Show loader before sending the request
        beforeSend: function () {
            var Authorpopup = document.getElementById('Authorpopup');
            if (Authorpopup) {
                Authorpopup.style.display = "none";
            }
            $("#storeLoader").css("display", "flex");
        },

        success: function (response) {
            // Close popup if it exists
            var Authorpopup = document.getElementById('Authorpopup');
            if (Authorpopup) {
                Authorpopup.style.display = "none";
            }
            let edit = document.querySelector(".edit-panel");
            if (edit) {
                edit.classList.remove("active");
                CurrentFileID = null;
            }

            if (response.status) {
                showNotification("", "Author has been successfully moved to the selected store.", "success", true);
                FetchShareDetails();
            } else {
                showNotification("", response.message || "Some files failed to move.", "error", false);
            }
        },
        error: function () {
            showNotification("", "Failed to submit store.", "error", false);
        },

        // Always hide the loader after response (success or error)
        complete: function () {
            $("#storeLoader").css("display", "none");
        }
    });

}



function ThumbnailPopup(id) {
    const productId = id.split('_')[1];

    // Close moreOption window
    $('#moreoption_' + productId).hide();

    const formData = new FormData();
    formData.append('id', id);

    // Fetch uploaded thumbnail
    $.ajax({
        url: '/ShareRedirector/Fetch_Productthumbnail',
        type: 'POST',
        data: formData,
        contentType: false,
        processData: false,
        success: function (response) {
            const $thumbnailPreview = $('#ThumbnailPreview');
            const cacheBuster = '?v=' + new Date().getUTCMilliseconds();

            // Always hide popup first
            $('#ThumbnailPopup').hide();
            $('#hdnproductID').val(productId);
            $thumbnailPreview.css("display", "flex");

            let srcPath = "../images/jubileechat_Avatar.png" + cacheBuster; // default image

            if (response && response.thumbnail) {
                srcPath = "../ProductThumbnail/" + response.thumbnail + cacheBuster;
            } else if (response && !response.thumbnail) {
                srcPath = "../images/jubilee-album-cover.png" + cacheBuster;
            }

            $thumbnailPreview.attr("src", srcPath);
        },
        error: function () {
            showNotification("", "Upload failed.", "error", false);
        }
    });
}


//Hide URL's QR on popup.
function closeThumbnailPopup() {
    var QR = document.getElementById('ThumbnailPopup');
    if (QR) {
        QR.style.display = "none";
    }
    $('#ThumbnailPreview').attr("src", "");
    //$('#confirmThumbnailUpload').prop("disabled", true);
    $('#confirmThumbnailUpload').css({ 'pointer-events': 'none', 'filter': 'grayscale(1)' });
}

let selectedThumbnailFile = null; // Hold file temporarily
let selectedProductId = null;     // Store Product ID
function uploadThumbnail() {
    //selectedProductId = $("#hdnproductID").val();
    selectedProductId = $("#ddlProduct").val();
    if (!selectedProductId) {
        showNotification("", "Product Id is undefined", "error", false);
        return;
    }

    $('#thumbnailUploader').off('change').on('change', function () {
        const file = this.files[0];
        if (!file) return;

        selectedThumbnailFile = file;

        // Show image preview
        const reader = new FileReader();
        reader.onload = function (e) {
            $('#ThumbnailPreview').attr('src', e.target.result).show();
        };
        reader.readAsDataURL(file);

        // Optionally show Done/Confirm button if hidden
        $('#confirmThumbnailUpload').css({ 'pointer-events': '', 'filter': '' });

    }).click(); // Trigger file input
}

// On clicking "Done"
//$('#confirmThumbnailUpload').on('click', function () {
function uploadAlbumCover() {
    const file = selectedThumbnailFile;
    const elementId = selectedProductId;

    if (!file || !elementId) return;

    const formData = new FormData();
    formData.append('thumbnail', file);
    formData.append('id', elementId);

    $.ajax({
        url: '/ShareRedirector/Uploadthumbnail',
        type: 'POST',
        data: formData,
        contentType: false,
        processData: false,
        success: function (response) {
            if (response != null) {
                $("#AlbumConfirmPopup").css("display", "none");
                // Update image
                $('#ProductThumb_' + elementId).attr("style", "display: flex !important");


                $('#ProductIMG_' + elementId).attr("src", "../ProductThumbnail/" + response.thumbnail + "?v=" + new Date().getUTCMilliseconds());

                // Reset preview and variables
                //$('#ThumbnailPreview').attr("src", "").hide();
                selectedThumbnailFile = null;
                selectedProductId = null;
                //$('#confirmThumbnailUpload').hide();
                //$('#confirmThumbnailUpload').prop("disabled", true);
                $('#confirmThumbnailUpload').css({ 'pointer-events': 'none', 'filter': 'grayscale(1)' });

                // Close popup if open
                //const Thumbnail = document.getElementById('ThumbnailPopup');
                //if (Thumbnail) Thumbnail.style.display = "none";
            }
        },
        error: function () {
            showNotification("", "Upload failed.", "error", false);
        }
    });
}

function confirmAlbumPopup() {
    $("#AlbumConfirmPopup").css("display", "flex");
}

function hideAlbumConfirmPopup() {
    $("#AlbumConfirmPopup").css("display", "none");

}

//Bind preview details.
function PreviewSongs(id) {

    var sharelink = $("#" + id).val();
    var previewfilename = ""
    var redirectURL = sharelink.toLowerCase().includes("re-");
    if (redirectURL) {
        window.open(sharelink, '_blank');
        return;
    }

    const formData = new FormData();
    formData.append('sharelink', sharelink);
    formData.append('previewfilename', previewfilename);
    //Fetch upload thumbnail
    $.ajax({
        url: '/ShareRedirector/SongPreview', // Your endpoint
        type: 'POST',
        data: formData,
        contentType: false,
        processData: false,
        success: function (response) {
            if (response != null) {
                $("#preview").html(response);
            }

        },
        error: function (err) {
            showNotification("", "There is no uploaded content available for preview", "error", false);
        }
    });

}

//Close Popup
function closeContentPopup() {
    var contentPopup = document.getElementById('fileContent');
    if (contentPopup) {
        contentPopup.style.display = "none"; // Hide the popup

        var iframe = document.querySelector(".import-file-wrapper iframe");
        if (iframe) {
            iframe.src = ""; // remove the src
        }
    }
}




//Upload QR logo.
//-----------------Start
let AzureID = "";
let ImageId = "";
function UploadQRlogo(id, imgId) {
    let url = $("#" + id).val();
    ImageId = imgId;
    // Take last part after "/"
    AzureID = url.substring(url.lastIndexOf("/") + 1);
    // Trigger file input click
    $('#qrLogoInput').click();
}

// When a file is selected, automatically upload it
$('#qrLogoInput').on('change', function () {
    var file = this.files[0];
    if (!file) return;

    // ✅ Check if the file is PNG or JPG
    var isValidImage = (
        (file.type === "image/png" && file.name.toLowerCase().endsWith(".png")) ||
        (file.type === "image/jpeg" &&
            (file.name.toLowerCase().endsWith(".jpg") || file.name.toLowerCase().endsWith(".jpeg")))
    );

    if (!isValidImage) {
        showNotification("", "Only PNG and JPG files are allowed.", "error", false);
        return;
    }

    var formData = new FormData();
    formData.append("file", file);
    formData.append("CurrentFileID", CurrentFileID);
    formData.append("BlobId", AzureID);

    $.ajax({
        url: '/ShareRedirector/UploadQRlogo',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function (response) {
            $("#" + ImageId).attr("src", response.filePath + "?t=" + new Date().getTime());
            Get_Content_Record();
            AzureID = "";
            ImageId = "";
        },
        error: function () {
            showNotification("", "File upload failed.", "error", false);
            AzureID = "";

        },
        complete: function () {
            $('#qrLogoInput').val(''); // ✅ Reset input after upload
            AzureID = "";
        }
    });
});

//-----------------END

//For the purpose to save QR color in DB.
function saveQRColor(id, color) {
    let url = $("#" + id).val();
    // Take last part after "/"
    let BlobID = url.substring(url.lastIndexOf("/") + 1);

    const hex = document.getElementById(color).value;
    console.log(hex);
    $("#colorBox").val(hex);
    const rgb = hexToRgb(hex);

    let colorString = "";
    if (rgb) {
        colorString = `${rgb.r},${rgb.g},${rgb.b}`;
    }

    var formData = new FormData();
    formData.append("colorString", colorString);
    formData.append("CurrentFileID", CurrentFileID); // Make sure `CurrentFileID` is defined globally or passed in
    formData.append("BlobID", BlobID); // Make sure `CurrentFileID` is defined globally or passed in

    $.ajax({
        url: '/ShareRedirector/SaveQRColor',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function (response) {
            Get_Content_Record()

        },
        error: function () {

            showNotification("", "Saving QR color failed.", "error", false);

        }
    });
}

// To get file details. Used in many functions.
function GetFile(Fileid) {
    $("#previewFile").css("display", "none");

    // Check if any files are still uploading
    let totalFiles = $(".dz-preview").length;
    let completedFiles = $(".dz-preview.dz-complete").length;

    // Restrict saving only if there are files AND some are still uploading
    if (totalFiles > 0 && totalFiles !== completedFiles) {
        showNotification("", "Cannot select a different file while the current file is uploading.", "error", false);
        return;
    }

    $(`.mm-item-nav-row`).removeClass('selected');
    //Remove field-err
    $("#txtfilename").removeClass("field-err");
    $("#txtRedirect").removeClass("field-err");

    $(".mm-item-nav-row").removeClass("active");
    $("#Level_" + Fileid).toggleClass("active");
    $("#Level_" + Fileid).addClass("selected");
    CurrentFileID = Fileid;

    let edit = document.querySelector(".edit-panel");
    if (edit) {
        edit.classList.add("active");
    }

    $.ajax({
        type: "GET",
        url: "/ShareRedirector/FilesDetailsGET",
        contentType: "application/json;charset=utf-8",
        dataType: "json",
        async: true,
        data: {
            FileID: CurrentFileID
        },
        success: function (response) {
            //console.log("Success:", response);
            if (response != null) {

                //Bind Author dropdown
                var $ddl = $('#ddlAuthor');
                $ddl.empty(); // Clear existing options
                $ddl.append('<option value="">-- Select Author --</option>');

                if (response.authors && response.authors.length > 0) {
                    $.each(response.authors, function (i, item) {
                        $ddl.append($('<option>', {
                            value: item.authorID,
                            text: item.authorName
                        }));
                    });

                    // Auto-select current author if available
                    if (response.author) {
                        var selectedAuthor = response.authors.find(a => a.authorName === response.author);
                        if (selectedAuthor) {
                            $ddl.val(selectedAuthor.authorID);
                        }
                    }
                }

                //Bind Series dropdown
                var $ddlSeries = $('#ddlSeries');
                $ddlSeries.empty(); // Clear existing options
                $ddlSeries.append('<option value="">-- Select Series --</option>');

                if (response.seriesModel && response.seriesModel.length > 0) {
                    $.each(response.seriesModel, function (i, item) {
                        $ddlSeries.append($('<option>', {
                            value: item.seriesID,
                            text: item.seriesName
                        }));
                    });

                    // Auto-select current author if available
                    if (response.series) {
                        var selectedSeries = response.seriesModel.find(a => a.seriesName === response.series);
                        if (selectedSeries) {
                            $ddlSeries.val(selectedSeries.seriesID);
                        }
                    }
                }

                //Bind Series dropdown
                var $ddlProduct = $('#ddlProduct');
                $ddlProduct.empty(); // Clear existing options
                $ddlProduct.append('<option value="">-- Select Product --</option>');

                if (response.productModel && response.productModel.length > 0) {
                    $.each(response.productModel, function (i, item) {
                        $ddlProduct.append($('<option>', {
                            value: item.productID,
                            text: item.productName
                        }));
                    });

                    // Auto-select current author if available
                    if (response.product) {
                        var selectedProduct = response.productModel.find(a => a.productName === response.product);
                        if (selectedProduct) {
                            $ddlProduct.val(selectedProduct.productID);
                        }
                    }
                }

                //Bind Series dropdown
                var $ddlDelivery = $('#ddlDelivery');
                $ddlDelivery.empty(); // Clear existing options
                $ddlDelivery.append('<option value="">-- Select Delivery --</option>');

                if (response.deliveryModel && response.deliveryModel.length > 0) {
                    $.each(response.deliveryModel, function (i, item) {
                        $ddlDelivery.append($('<option>', {
                            value: item.deliveryID,
                            text: item.deliveryName
                        }));
                    });

                    // Auto-select current author if available
                    if (response.delivery) {
                        var selectedDelivery = response.deliveryModel.find(a => a.deliveryName === response.delivery);
                        if (selectedDelivery) {
                            $ddlDelivery.val(selectedDelivery.deliveryID);
                        }
                    }
                }

                if (response.azurefilename != null) {
                    $("#txtsharelink").val(response.azurefilename);
                    $("#txtRedirect").val(response.redirectURL);
                } else {
                    $("#txtsharelink").val(response.urlMapLink);
                    $("#txtRedirect").val(response.redirectLink);
                }
                var QRLogo = response.qrLogo;
                if (QRLogo) {
                    $("#uploadedQRLogo").attr("src", "/UploadQRLogo/" + response.qrLogo + "?t=" + new Date().getTime());
                }
                else {
                    //$("#uploadedQRLogo").attr("src", "/images/askJubileeGPT-Logo-Tiny.png"+"?t=" + new Date().getTime());
                    $("#uploadedQRLogo").attr("src", "/images/image-icon.svg" + "?t=" + new Date().getTime());
                }

                var QRcolor = response.qrColor;

                if (QRcolor) {
                    const parts = QRcolor.split(',');
                    if (parts.length === 3) {
                        const hexColor = rgbToHex(parts[0], parts[1], parts[2]);
                        $('#color').val(hexColor); // bind fetched color
                        $('#colorBox').val(hexColor); // bind fetched color
                    }
                } else {
                    $('#color').val('#000000'); // fallback to black
                }

                // Regular expression to match a GUID
                var guidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

                // Ensure response.urlMapLink is not null or undefined before using match
                if (response.urlMapLink) {
                    var urlMapLinkID = response.urlMapLink.match(guidRegex);

                    if (urlMapLinkID && urlMapLinkID[0]) {  // Check if match exists
                        if (response.azurefilename == urlMapLinkID[0]) {
                            $("#txtsharelink").val(response.urlMapLink);
                            $("#txtRedirect").val(response.redirectLink);
                        }
                    }
                }

                //Bind radio button values  
                if (response.fileExtension != null) {

                    if (response.fileExtension == ".mp3") {
                        $("#radAudio").prop("checked", true);

                    }
                    if (response.fileExtension == ".mp4") {
                        $("#radVideo").prop("checked", true);
                    }
                    if (response.fileExtension != ".mp3" && response.fileExtension != ".mp4") {
                        $("#radFile").prop("checked", true);
                    }
                    $("#songPrev").css("display", "flex");
                } else {
                    $("#radURL").prop("checked", true);
                    $("#songPrev").css("display", "flex");
                }
                $("#cbtest-19").prop("checked", response.isPublic === "1" || response.isPublic === true);
                if (response.redirectURL === null && response.azurefilename === null) {
                    $("#imageQR").css("display", "none");
                    $("#qrtext").css("display", "flex");
                } else {
                    let qrImagePath = "/QRCodeImages/QRCode.png?t=" + new Date().getTime(); // append version
                    $("#QRImage").attr("src", qrImagePath).on("load", function () {
                        $("#imageQR").css("display", "flex");
                        $("#qrtext").css("display", "none");
                    }).on("error", function () {
                        $("#imageQR").css("display", "none");
                        $("#qrtext").css("display", "flex");
                    });
                }
                //---------------------------Bind Upoaded file------------------------------------
                if (response.azurefilename != null && !response.redirectURL) {
                    var CurrentFileName = response.fileName.replace(/\s+/g, '') + response.fileExtension;
                    $("#previewFile").css("display", "flex");
                    $("#preFileName").text(CurrentFileName);
                }
                else {
                    $("#previewFile").css("display", "none");
                }

                //---------------------------------------------------------------
                if (response.fileName) {
                    $("#txtsavebtn").text("Update");
                    $("#txtmainSection").text(response.fileName);
                } else {
                    $("#txtsavebtn").text("Save");
                    $("#txtmainSection").text("File Upload");
                }


            } else {
                $("#txtfilename").val("");
                $("#txtdesc").val("");
                $("#txtRedirect").val("");
                $("#txtsharelink").val("");
                $("#cbtest-19").prop("checked", false); // Uncheck the checkbox
                $("#chkIsSpotlight").prop("checked", false); // Uncheck the checkbox
                $("#imageQR").css("display", "none");
                $("#qrtext").css("display", "flex");
                $("#txtsavebtn").text("Save");
                $("#songPrev").css("display", "flex");
            }

        },
        error: function (error) {
            console.error("Error:", error);
        }
    });
}

// Convert hex to Rgb.
function hexToRgb(hex) {
    hex = hex.replace(/^#/, "");
    if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return { r, g, b };
    }
    return null;
}

// Convert reb to Hex.
function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => {
        const hex = parseInt(x).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join('');
}

// Remove QR logo from DB.
function RemoveQRLogo() {
    var BlobId = blobContentId;
    var formData = new FormData();
    formData.append("CurrentFileID", CurrentFileID); // Make sure `CurrentFileID` is defined globally or passed in
    formData.append("BlobId", BlobId); // Make sure `BlobId` is defined globally or passed in

    $.ajax({
        url: '/ShareRedirector/RemoveQRLogo',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function (response) {
            $("#DeleteFolderPopup").hide();
            $("#deleteFolder").css("display", "block");
            $("#delteQRicon").css("display", "none");
            Get_Content_Record();
            BlobId = "";
            blobContentId = "";

        },
        error: function () {
            $("#DeleteFolderPopup").hide();
            showNotification("", "Remove QR logo failed.", "error", false);
            $("#deleteFolder").css("display", "block");
            $("#delteQRicon").css("display", "none");
        }
    });
}

function goBack() {
    if (document.referrer) {
        window.location.href = document.referrer;
    } else {
        window.location.href = '/'; // fallback if no referrer is available
    }
}
var blobContentId = "";
// Remove QR confirmation popup.
function ConfirmQRLogoRemove(id, blobId) {
    var QRLogoICon = $("#" + id).attr("src");
    var hello = QRLogoICon.split('.');

    if (hello[0] == "/images/image-icon") {
        showNotification("", "No QR code icon uploaded.", "error", false);
        return
    }

    let url = $("#" + blobId).val();
    blobContentId = url.substring(url.lastIndexOf("/") + 1);

    $("#spnSelType").text('QR code icon');
    $("#DeleteFolderPopup").show();
    $("#deleteFolder").css("display", "none");
    $("#delteQRicon").css("display", "block");

}


//To close QR logo popup.
function CloseQRLogoRemove() {
    $("#DeleteFolderPopup").hide();
    blobContentId = "";
}


//================================================Updated JS======================================================

function CollapseContentPanel(id) {
    const ID = id;
    $("#" + ID).css("display", "none");
    $("#plus-icon-" + ID).css("display", "flex");
    $("#minus-icon-" + ID).css("display", "none");

}
function ExpendContentPanel(id) {
    const ID = id;
    $("#" + ID).css("display", "block");
    $("#plus-icon-" + ID).css("display", "none");
    $("#minus-icon-" + ID).css("display", "flex");


}

function togglePanel() {
    // Toggle panels
    $("#first-panel, #second-panel").toggle();

    // Check which panel is visible now
    if ($("#first-panel").is(":visible")) {
        // Show button for first panel, hide button for second panel

        $("#txtsavebtn").css("display", "inline-block");
        $("#txtupdatebtn").css("display", "none");
        //$("#second-btn").hide();
    } else {
        // Show button for second panel, hide button for first panel
        $("#txtsavebtn").css("display", "none");
        $("#txtupdatebtn").css("display", "inline-block");
    }
}


$('#chkMusicAlbum').on('change', function () {
    if ($(this).is(':checked')) {
        // ✅ Do operation when checked
        $("#music-album").removeClass("disable-block");

    } else {
        // ❌ Do operation when unchecked
        $("#music-album").addClass("disable-block");
    }
});
$('#chkAudioBook').on('change', function () {
    if ($(this).is(':checked')) {
        // ✅ Do operation when checked
        $("#audio-book").removeClass("disable-block");
        ExpendContentPanel('audio-book');
    } else {
        // ❌ Do operation when unchecked
        $("#audio-book").addClass("disable-block");
        //CollapseMusicAlbum('audio-book');

    }
});
$('#chkVideoFiles').on('change', function () {
    if ($(this).is(':checked')) {
        // ✅ Do operation when checked
        $("#video-file").removeClass("disable-block");
        ExpendContentPanel('video-file');
    } else {
        // ❌ Do operation when unchecked
        $("#video-file").addClass("disable-block");
    }
});
$('#chkDownloadFiles').on('change', function () {
    if ($(this).is(':checked')) {
        // ✅ Do operation when checked
        $("#download-pdf").removeClass("disable-block");
        ExpendContentPanel('download-pdf');
    } else {
        // ❌ Do operation when unchecked
        $("#download-pdf").addClass("disable-block");
    }
});
$('#chkRedirector').on('change', function () {
    if ($(this).is(':checked')) {
        // ✅ Do operation when checked
        $("#redirector").removeClass("disable-block");
        ExpendContentPanel('redirector');
    } else {
        // ❌ Do operation when unchecked
        $("#redirector").addClass("disable-block");
    }
});


//For the purpose to fetch Content records
function Get_Content_Record() {
    let FileId = CurrentFileID;

    $.ajax({
        url: "/ShareRedirector/Get_Content_Record",   // ✅ API endpoint (change as needed)
        type: "GET",                 // or "POST" depending on your backend
        data: { FileId: FileId },    // parameters
        dataType: "json",            // expecting JSON response
        success: function (response) {
            clearContent();
            for (let i = 0; i < response.length; i++) {

                if (response[i].status) {

                    //Music Album Record Bind
                    if (response[i].isMusicAlbum) {
                        //For The purpose to make Music Album open when user switch second panel.
                        ExpendContentPanel('music-album');
                        if (response[i].isActive) {
                            $("#music-album").removeClass("disable-block");
                            $("#chkMusicAlbum").prop("checked", true);
                           
                        } else {
                            $("#music-album").addClass("disable-block");
                            $("#chkMusicAlbum").prop("checked", false);
                        }
                        //Show uploaded file name.
                        $("#MusicAlbum-dz").css("display", "flex");
                        $("#Music-dzSize").text(response[i].fileSize);
                        $("#Music-dzFileName").text(response[i].fileName + "" + response[i].fileExtension);

                        $("#txtsharelinkMusicAlbum").val(response[i].azurefilename ?? "");
                        $("#txtfreelinkMusicAlbum").val(response[i].freeAzureURl ?? "");
                        $("#hdnshareID").val(response[i].azurefilename);

                        $("#chkIsSpotlightMusicAlbum").prop("checked", response[i].isSpotlight);

                        var QRLogo = response[i].qrLogo;
                        if (QRLogo) {
                            $("#uploadedQRLogoMusicAlbum").attr("src", "/UploadQRLogo/" + response[i].qrLogo + "?t=" + new Date().getTime());
                        }
                        else {
                            $("#uploadedQRLogoMusicAlbum").attr("src", "/images/image-icon.svg" + "?t=" + new Date().getTime());
                        }

                        var QRcolor = response[i].qrColor;

                        if (QRcolor) {
                            const parts = QRcolor.split(',');
                            if (parts.length === 3) {
                                const hexColor = rgbToHex(parts[0], parts[1], parts[2]);
                                $('#color-MusicAlbum').val(hexColor); // bind fetched color
                                $('#colorBox-MusicAlbum').val(hexColor); // bind fetched color
                            }
                        } else {
                            $('#color-MusicAlbum').val('#000000'); // fallback to black
                            $('#colorBox-MusicAlbum').val('#000000'); // fallback to black
                        }

                        $("#imageQRpath").attr("src", "").off("load error");
                        $("#imageQRpathPayment").attr("src", "").off("load error");


                        $("#imageQRpath").attr("src", "/QRCodeImages/" + response[i].marketingQRName + "?v=" + new Date().getUTCMilliseconds().toString()).on("load", function () {
                            $("#imageQRM1").css("display", "flex");
                            $("#qrtextM1").css("display", "none");
                        }).on("error", function () {
                            $("#imageQRM1").css("display", "none");
                            $("#qrtextM1").css("display", "flex");
                        });

                        $("#imageQRpathPayment").attr("src", "/QRCodeImages/" + response[i].paymentQRName + "?v=" + new Date().getUTCMilliseconds().toString()).on("load", function () {
                            $("#imageQRP1").css("display", "flex");
                            $("#qrtextP1").css("display", "none");
                        }).on("error", function () {
                            $("#imageQRP1").css("display", "none");
                            $("#qrtextP1").css("display", "flex");
                        });
                    }
                    //Audio Book
                    if (response[i].isAudioBook) {
                        //For The purpose to make Music Album open when user switch second panel.
                        ExpendContentPanel('audio-book');
                        if (response[i].isActive) {
                            $("#chkAudioBook").prop("checked", true);

                            $("#audio-book").removeClass("disable-block");
                        } else {
                            $("#chkAudioBook").prop("checked", false);

                            $("#audio-book").addClass("disable-block");
                        }

                        //Show uploaded file name.
                        $("#AudioBook-dz").css("display", "flex");
                        $("#AudioBook-dzSize").text(response[i].fileSize);
                        $("#AudioBook-dzFileName").text(response[i].fileName + "" + response[i].fileExtension);
                        //$("#previewFile-audio").css("display", "flex");
                        //$("#preFileName-audio").text(response[i].fileName + '' + response[i].fileExtension);
                        $("#txtsharelinkAudioBook").val(response[i].azurefilename ?? "");
                        $("#txtfreelinkAudioBook").val(response[i].freeAzureURl ?? "");
                        $("#hdnshareID").val(response[i].shareID);

                        $("#chkIsSpotlightAudioBook").prop("checked", response[i].isSpotlight);

                        var QRLogo = response[i].qrLogo;
                        if (QRLogo) {
                            $("#uploadedQRLogoAudioBook").attr("src", "/UploadQRLogo/" + response[i].qrLogo + "?t=" + new Date().getTime());
                        }
                        else {
                            $("#uploadedQRLogoAudioBook").attr("src", "/images/image-icon.svg" + "?t=" + new Date().getTime());
                        }

                        var QRcolor = response[i].qrColor;

                        if (QRcolor) {
                            const parts = QRcolor.split(',');
                            if (parts.length === 3) {
                                const hexColor = rgbToHex(parts[0], parts[1], parts[2]);
                                $('#color-AudioBook').val(hexColor); // bind fetched color
                                $('#colorBox-AudioBook').val(hexColor); // bind fetched color
                            }
                        } else {
                            $('#color-AudioBook').val('#000000'); // fallback to black
                            $('#colorBox-AudioBook').val('#000000'); // fallback to black
                        }

                        $("#imageQRAudioBook").attr("src", "").off("load error");
                        $("#imageQRAudioBook-Payment").attr("src", "").off("load error");

                        $("#imageQRAudioBook").attr("src", "/QRCodeImages/" + response[i].marketingQRName + "?v=" + new Date().getUTCMilliseconds().toString()).on("load", function () {
                            $("#imageQR-AudioBook").css("display", "flex");
                            $("#qrtext-AudioBook").css("display", "none");
                        }).on("error", function () {
                            $("#imageQR-AudioBook").css("display", "none");
                            $("#qrtext-AudioBook").css("display", "flex");
                        });

                        $("#imageQRAudioBook-Payment").attr("src", "/QRCodeImages/" + response[i].paymentQRName + "?v=" + new Date().getUTCMilliseconds().toString()).on("load", function () {
                            $("#imageQR-AudioBook-Payment").css("display", "flex");
                            $("#qrtext-AudioBook-Payment").css("display", "none");
                        }).on("error", function () {
                            $("#imageQR-AudioBook-Payment").css("display", "none");
                            $("#qrtext-AudioBook-Payment").css("display", "flex");
                        });
                    }
                    //Video Book
                    if (response[i].isVideoFile) {
                        ExpendContentPanel('video-file');
                        if (response[i].isActive) {
                            $("#chkVideoFiles").prop("checked", true);
                            $("#video-file").removeClass("disable-block");
                        } else {
                            $("#chkVideoFiles").prop("checked", false);
                            $("#video-file").addClass("disable-block");
                        }

                        //Show uploaded file name.
                        $("#Video-dz").css("display", "flex");
                        $("#Video-dzSize").text(response[i].fileSize);
                        $("#Video-dzFileName").text(response[i].fileName + "" + response[i].fileExtension);

                        $("#txtsharelinkVideoFiles").val(response[i].azurefilename ?? "");
                        $("#txtfreelinkVideoFiles").val(response[i].freeAzureURl ?? "");
                        $("#hdnshareID").val(response[i].shareID);
                        //$("#previewFile-video").css("display", "flex");
                        //$("#preFileName-video").text(response[i].fileName + '' + response[i].fileExtension);
                        $("#chkIsSpotlightVideoFile").prop("checked", response[i].isSpotlight);

                        var QRLogo = response[i].qrLogo;
                        if (QRLogo) {
                            $("#uploadedQRLogoVideoFiles").attr("src", "/UploadQRLogo/" + response[i].qrLogo + "?t=" + new Date().getTime());
                        }
                        else {
                            $("#uploadedQRLogoVideoFiles").attr("src", "/images/image-icon.svg" + "?t=" + new Date().getTime());
                        }

                        var QRcolor = response[i].qrColor;

                        if (QRcolor) {
                            const parts = QRcolor.split(',');
                            if (parts.length === 3) {
                                const hexColor = rgbToHex(parts[0], parts[1], parts[2]);
                                $('#color-VideoFiles').val(hexColor); // bind fetched color
                                $('#colorBox-VideoFiles').val(hexColor); // bind fetched color
                            }
                        } else {
                            $('#color-VideoFiles').val('#000000'); // fallback to black
                            $('#colorBox-VideoFiles').val('#000000'); // fallback to black
                        }

                        $("#imageQRVideoFiles").attr("src", "").off("load error");
                        $("#imageQRVideoFiles-Payment").attr("src", "").off("load error");

                        $("#imageQRVideoFiles").attr("src", "/QRCodeImages/" + response[i].marketingQRName + "?v=" + new Date().getUTCMilliseconds().toString()).on("load", function () {
                            $("#imageQR-VideoFiles").css("display", "flex");
                            $("#qrtext-VideoFiles").css("display", "none");
                        }).on("error", function () {
                            $("#imageQR-VideoFiles").css("display", "none");
                            $("#qrtext-VideoFiles").css("display", "flex");
                        });

                        $("#imageQRVideoFiles-Payment").attr("src", "/QRCodeImages/" + response[i].paymentQRName + "?v=" + new Date().getUTCMilliseconds().toString()).on("load", function () {
                            $("#imageQR-VideoFiles-Payment").css("display", "flex");
                            $("#qrtext-VideoFiles-Payment").css("display", "none");
                        }).on("error", function () {
                            $("#imageQR-VideoFiles-Payment").css("display", "none");
                            $("#qrtext-VideoFiles-Payment").css("display", "flex");
                        });
                    }
                    //PDF or other files
                    if (response[i].isPDFFiles) {
                        ExpendContentPanel('download-pdf');
                        if (response[i].isActive) {
                            $("#chkDownloadFiles").prop("checked", true);
                            $("#download-pdf").removeClass("disable-block");
                        }
                        else {
                            $("#chkDownloadFiles").prop("checked", false);
                            $("#download-pdf").addClass("disable-block");
                        }

                        //Show uploaded file name.
                        $("#Files-dz").css("display", "flex");
                        $("#Files-dzSize").text(response[i].fileSize);
                        $("#Files-dzFileName").text(response[i].fileName + "" + response[i].fileExtension);
                        //$("#previewFile-download").css("display", "flex");
                        //$("#preFileName-download").text(response[i].fileName + '' + response[i].fileExtension);
                        $("#txtsharelinkPDFiles").val(response[i].freeAzureURl ?? "");
                        $("#hdnshareID").val(response[i].shareID);

                        $("#chkIsSpotlightPDFile").prop("checked", response[i].isSpotlight);

                        var QRLogo = response[i].qrLogo;
                        if (QRLogo) {
                            $("#uploadedQRLogoPDFiles").attr("src", "/UploadQRLogo/" + response[i].qrLogo + "?t=" + new Date().getTime());
                        }
                        else {
                            $("#uploadedQRLogoPDFiles").attr("src", "/images/image-icon.svg" + "?t=" + new Date().getTime());
                        }

                        var QRcolor = response[i].qrColor;

                        if (QRcolor) {
                            const parts = QRcolor.split(',');
                            if (parts.length === 3) {
                                const hexColor = rgbToHex(parts[0], parts[1], parts[2]);
                                $('#color-PDFiles').val(hexColor); // bind fetched color
                                $('#colorBox-PDFiles').val(hexColor); // bind fetched color
                            }
                        } else {
                            $('#color-PDFiles').val('#000000'); // fallback to black
                            $('#colorBox-PDFiles').val('#000000'); // fallback to black
                        }

                        $("#imageQRPDFiles").attr("src", "").off("load error");

                        $("#imageQRPDFiles").attr("src", "/QRCodeImages/" + response[i].marketingQRName + "?v=" + new Date().getUTCMilliseconds().toString()).on("load", function () {
                            $("#imageQR-PDFiles").css("display", "flex");
                            $("#qrtext-PDFiles").css("display", "none");
                        }).on("error", function () {
                            $("#imageQR-PDFiles").css("display", "none");
                            $("#qrtext-PDFiles").css("display", "flex");
                        });
                    }

                    if (response[i].redirectURLQRCode) {
                        ExpendContentPanel('redirector');
                        $("#chkRedirector").prop("checked", true);
                        $("#redirector").removeClass("disable-block");

                        $("#txtsharelink").val(response[i].urlMapLink ?? "");
                        $("#txtRedirectURL").val(response[i].redirectLink ?? "");

                        var QRLogo = response[i].qrLogo;
                        if (QRLogo) {
                            $("#uploadedQRLogoRedirect").attr("src", "/UploadQRLogo/" + response[i].qrLogo + "?t=" + new Date().getTime());
                        }
                        else {
                            $("#uploadedQRLogoRedirect").attr("src", "/images/image-icon.svg" + "?t=" + new Date().getTime());
                        }

                        var QRcolor = response[i].qrColor;

                        if (QRcolor) {
                            const parts = QRcolor.split(',');
                            if (parts.length === 3) {
                                const hexColor = rgbToHex(parts[0], parts[1], parts[2]);
                                $('#color-redirector').val(hexColor); // bind fetched color
                                $('#colorBox-redirector').val(hexColor); // bind fetched color
                            }
                        } else {
                            $('#color-redirector').val('#000000'); // fallback to black
                            $('#colorBox-redirector').val('#000000'); // fallback to black
                        }

                        $("#imageQRRedirect").attr("src", "").off("load error");

                        $("#imageQRRedirect").attr("src", "/QRCodeImages/" + response[i].redirectURLQRCode + "?v=" + new Date().getUTCMilliseconds().toString()).on("load", function () {
                            $("#imageQR-Redirect").css("display", "flex");
                            $("#qrtext-Redirect").css("display", "none");
                        }).on("error", function () {
                            $("#imageQR-Redirect").css("display", "none");
                            $("#qrtext-Redirect").css("display", "flex");
                        });
                    }
                }
            }
        },
        error: function (xhr, status, error) {
            console.error("Error:", error);
            showNotification("", "Failed to fetch content record. Please try again.", "error", false);
        }
    });
}


function clearContent() {

    $("#MusicAlbum-dz").css("display", "none");
    $("#Music-dzSize").text("");
    $("#Music-dzFileName").text("");

    $("#AudioBook-dz").css("display", "none");
    $("#AudioBook-dzSize").text("");
    $("#AudioBook-dzFileName").text("");

    $("#Files-dz").css("display", "none");
    $("#Files-dzSize").text("");
    $("#Files-dzFileName").text("");

    $("#Video-dz").css("display", "none");
    $("#Video-dzSize").text("");
    $("#Video-dzFileName").text("");

    //For The purpose to make Music Album close.
    ExpendContentPanel('music-album');
    $("#chkMusicAlbum").prop("checked", true);
    $("#music-album").removeClass("disable-block");

    $("#txtsharelinkMusicAlbum").val("");
    $("#txtfreelinkMusicAlbum").val("");

    $("#chkIsSpotlightMusicAlbum").prop("checked", false);

    $("#imageQRM1").css("display", "none");
    $("#qrtextM1").css("display", "flex");
    $("#imageQRP1").css("display", "none");
    $("#qrtextP1").css("display", "flex");

    $('#color-MusicAlbum').val('#000000'); // fallback to black
    $('#colorBox-MusicAlbum').val('#000000'); // fallback to black

    $("#uploadedQRLogoMusicAlbum").attr("src", "/images/image-icon.svg" + "?t=" + new Date().getTime());

    // Clear Dropzone files
    let dropzoneInstanceMusicAlbum = Dropzone.forElement("#MusicAlbumuploader");
    if (dropzoneInstanceMusicAlbum) {
        dropzoneInstanceMusicAlbum.removeAllFiles(true);

    }

    //For The purpose to make Audio book close.
    CollapseContentPanel('audio-book');
    $("#chkAudioBook").prop("checked", false);
    $("#audio-book").addClass("disable-block");

    $("#txtsharelinkAudioBook").val("");
    $("#txtfreelinkAudioBook").val("");

    $("#chkIsSpotlightAudioBook").prop("checked", false);

    $("#imageQR-AudioBook-Payment").css("display", "none");
    $("#qrtext-AudioBook-Payment").css("display", "flex");
    $("#imageQR-AudioBook").css("display", "none");
    $("#qrtext-AudioBook").css("display", "flex");

    $('#color-AudioBook').val('#000000'); // fallback to black
    $('#colorBox-AudioBook').val('#000000'); // fallback to black

    $("#uploadedQRLogoAudioBook").attr("src", "/images/image-icon.svg" + "?t=" + new Date().getTime());

    // Clear Dropzone files
    let dropzoneInstanceAudioBook = Dropzone.forElement("#AudioBookuploader");
    if (dropzoneInstanceAudioBook) {
        dropzoneInstanceAudioBook.removeAllFiles(true);

    }


    //For The purpose to make Video close.
    CollapseContentPanel('video-file');
    $("#chkVideoFiles").prop("checked", false);
    $("#video-file").addClass("disable-block");

    $("#txtsharelinkVideoFiles").val("");
    $("#txtfreelinkVideoFiles").val("");

    $("#chkIsSpotlightVideoFile").prop("checked", false);

    $("#imageQR-VideoFiles-Payment").css("display", "none");
    $("#qrtext-VideoFiles-Payment").css("display", "flex");
    $("#imageQR-VideoFiles").css("display", "none");
    $("#qrtext-VideoFiles").css("display", "flex");

    $('#color-VideoFiles').val('#000000'); // fallback to black
    $('#colorBox-VideoFiles').val('#000000'); // fallback to black

    $("#uploadedQRLogoVideoFiles").attr("src", "/images/image-icon.svg" + "?t=" + new Date().getTime());

    // Clear Dropzone files
    let dropzoneInstanceVideo = Dropzone.forElement("#Videouploader");
    if (dropzoneInstanceVideo) {
        dropzoneInstanceVideo.removeAllFiles(true);

    }

    //For The purpose to make PDF or other files close.
    CollapseContentPanel('download-pdf');
    $("#chkDownloadFiles").prop("checked", false);
    $("#download-pdf").addClass("disable-block");

    $("#txtsharelinkPDFiles").val("");

    $("#chkIsSpotlightPDFile").prop("checked", false);

    $("#imageQR-PDFiles").css("display", "none");
    $("#qrtext-PDFiles").css("display", "flex");

    $('#color-PDFiles').val('#000000'); // fallback to black
    $('#colorBox-PDFiles').val('#000000'); // fallback to black

    $("#uploadedQRLogoPDFiles").attr("src", "/images/image-icon.svg" + "?t=" + new Date().getTime());

    // Clear Dropzone files
    let dropzoneInstanceFiles = Dropzone.forElement("#Filesuploader");
    if (dropzoneInstanceFiles) {
        dropzoneInstanceFiles.removeAllFiles(true);

    }

    //Redirect 
    CollapseContentPanel('redirector');
    $("#chkRedirector").prop("checked", false);
    $("#redirector").addClass("disable-block");

    $("#txtsharelink").val("");
    $("#txtRedirectURL").val("");

    $("#imageQR-Redirect").css("display", "none");
    $("#qrtext-Redirect").css("display", "flex");

    $('#color-redirector').val('#000000'); // fallback to black
    $('#colorBox-redirector').val('#000000'); // fallback to black

    $("#uploadedQRLogoRedirect").attr("src", "/images/image-icon.svg" + "?t=" + new Date().getTime());
}

function ToggleIsSpotlight(id, FiledID) {
    var isChecked = $('#' + id).prop('checked'); // true or false
    var sectionID = $('#' + FiledID).val();
    var BlobId = sectionID.substring(sectionID.lastIndexOf("/") + 1);
    var FileID = CurrentFileID;

    //Validate
    if (isChecked) {
        if (!sectionID) {
            showNotification("", "Please upload the content first.", "error", false);
            setTimeout(function () {
                $('#' + id).prop('checked', false);
            }, 1000)
            return;
        }
    }

    $.ajax({
        url: '/ShareRedirector/SaveIsSpotLight',
        type: 'POST',
        data: {
            IsSpotLight: isChecked,
            BlobId: BlobId,
            FileID, FileID
        },
        success: function (response) {
            if (response != null && Array.isArray(response)) {
                for (let i = 0; i < response.length; i++) {
                    let item = response[i];
                    let Id = item.id;
                    let IsActive = item.isActive;

                    $("#togglePlan_" + Id).prop("checked", IsActive);
                }
            }

        },
        error: function (err) {
            console.error('Error saving toggle:', err);
        }
    });

}

function DeactiveContent(id,type) {
    var IsActive = $("#" + id).prop("checked");
    var Type = type
    $.ajax({
        url: '/ShareRedirector/DeactiveContent',
        type: 'POST',
        data: { IsActive: IsActive, ID: CurrentFileID, Type: Type },
        success: function (response) {
            if (response != null) {
               
            }

        },
        error: function (err) {
            console.error('Error saving toggle:', err);
        }
    });
}

function RemoveDZFile(id) {
    $("#" + id).css("display", "none");
}

function DownloadBlobFile(id) {
    var sharelink = $("#" + id).val();
    var NanoId = sharelink.split('/').filter(x => x).pop();
    window.location.href = "/ShareRedirector/DownloadBlobFile?NanoId=" + NanoId;
}

