var ParentID;
var dragID;
$(document).ready(function () {
    HideLeftMenuItems();
    $(".left-nav-bar").resizable();
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

function drag(event) {
    event.dataTransfer.setData("text", event.target.id);
}

function allowDrop(event) {
    event.preventDefault();
}

async function drop(event) {
    event.preventDefault();
    var data = event.dataTransfer.getData("text");
    var draggedElement = document.getElementById(data);
    var draggedElementID = draggedElement.id;
    var draggedElementKey = draggedElement.dataset.key;
    var targetElement = event.target.closest('.draggable-item');
    var targetElementID = targetElement.id;
    var targetElementKey = targetElement.dataset.key;

    // Check if the target is a valid drop container and has the specific ID
    if (targetElement.classList.contains('draggable-item') && targetElement.id.startsWith('divMain') && targetElementID != draggedElementID) {
        let currentItem = BookContent.filter(x => x.bookContentID === draggedElementKey)[0];
        if (currentItem != undefined) {
            if (currentItem.childCount != undefined && currentItem.childCount > 0) {
                showNotification("", "To initiate drag-and-drop, please relocate or detach the child elements from this node!.", "error", false);
                return false;
            }
        }
        // Additional logic or function calls after the drop
        var flag = await GetIDSDraggedAndTargetElement(draggedElementKey, targetElementKey);
        if (flag == 1) {
            targetElement.insertAdjacentElement('afterend', draggedElement);
        }
    }
}

async function GetIDSDraggedAndTargetElement(draggedElementID, targetElementID) {
    return new Promise(async resolve => {
        var flag = 0;
        let currentItem = BookContent.filter(x => x.bookContentID === draggedElementID)[0];
        let targetItem = BookContent.filter(x => x.bookContentID === targetElementID)[0];
        if (currentItem && targetItem) {
            var currentIndex = BookContent.findIndex(x => x === currentItem);
            var targetIndex = BookContent.findIndex(x => x === targetItem);

            if ((currentIndex >= 0) && (targetIndex >= 0)) {
                currentItem.indent = targetItem.indent;
                if (currentIndex < targetIndex) {
                    BookContent.splice(currentIndex, 1);
                    BookContent.splice(targetIndex, 0, currentItem);
                } else {
                    BookContent.splice(currentIndex, 1);
                    BookContent.splice(targetIndex + 1, 0, currentItem);
                }

                flag = await BookContentUpdate(currentItem.bookContentID, currentItem.contentTypeID, targetItem.parentID, currentItem.indent, '', targetItem.bookContentID);
            }
        }
        resolve(flag);
    });
}

function SaveBookContentText(e) {
    if (e.keyCode == 13) {
        SaveBookContent();
    } else if (e.keyCode === 27) {
        HideBookContentTextbox();
    }
}

function SaveBookContentOnBlur() {
    //HideBookContentTextbox();
}

function HideBookContentTextbox() {
    var element = document.getElementById("divBookContentTextbox");
    if (element) {
        element.style.display = "none";
    }
}

function SaveBookContent() {
    var ID = $("#hdContentTypeID").val();
    if ($("#txtBookContent").val().trim() != "") {
        $.ajax({
            type: "post",
            url: "/ContentManager/SaveBookContentText",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            data: {
                "ContentTypeID": ID,
                "ParentID": $("#hdBookParentID").val(),
                "Text": $("#txtBookContent").val()
            },
            success: function (response) {
                if (response != null) {
                    if (response.Status == "1") {
                        BindSavedParentNodeUsingTextbox(response.ID, ID);
                        $("#txtBookContent").val("");
                        setTimeout(function () {
                            HideBookContentTextbox(ID);
                        }, 50)
                    } else {
                        showNotification("", response.Message, "error", false);
                    }
                }
            },
            error: function (error) {
            }
        });
    }
}

function BindSavedParentNodeUsingTextbox(BookContentID, ContentTypeID) {
    $.ajax({
        type: "post",
        url: "/ContentManager/BindSavedParentNodeUsingTextbox",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "BookContentID": BookContentID
        },
        success: function (response) {
            var html = '';
            if (response != null) {
                for (var i = 0; i < response.length; i++) {
                    html += ' <div class="draggable-item cmr" draggable="true" id="divMain_' + response[i].bookContentID + '" data-key="' + response[i].bookContentID + '" ondragstart="drag(event)" ondrop="drop(event)" ondragover="allowDrop(event)">                                                                                         ';
                    html += '     <div class="cmr-expand-icon">                                                                         ';
                    if (response[i].childCount > 0) {
                        html += '<i class="mdi mdi-plus-box" id="hrefbookchild_' + response[i].bookContentID + '" onclick="BindBookChild(\'' + response[i].bookContentID + '\', \'' + ContentTypeID + '\', 1)"></i>  ';
                    } else {
                        html += '<i class="mdi" id="hrefbookchild_' + response[i].bookContentID + '" onclick="BindBookChild(\'' + response[i].bookContentID + '\', \'' + ContentTypeID + '\', 1)"></i>  ';
                    }
                    html += '     </div>                                                                                                ';

                    if (response[i].indent == 0)
                        html += '     <div class="cmr-icon"><img src="images/book-section-icon.png" /></div>                                ';
                    else if (response[i].indent == 30)
                        html += '     <div class="cmr-icon"><img src="images/content-book-icon.png" /></div>                                ';
                    else if (response[i].indent == 60)
                        html += '     <div class="cmr-icon"><img src="images/content-book-icon2.png" /></div>                               ';
                    else
                        html += '     <div class="cmr-icon"><img src="images/content-book-icon2.png" /></div>                               ';

                    html += '     <div class="cmr-txt" style="cursor:pointer;" id="div_' + response[i].bookContentID + '" onclick="BindParentID(\'' + response[i].bookContentID + '\')">' + response[i].description + '</div>                                            ';
                    html += '     <div class="cmr-ind"><img src="images/indent-arrow-l.jpg" style="cursor:pointer" onclick="GoBackBookNode(\'' + response[i].bookContentID + '\', \'' + ContentTypeID + '\')"/>  ';
                    //html += '     <div class="cmr-ind"><i class="mdi mdi-arrow-left" onclick="GoBackBookNode(\'' + response[i].bookContentID + '\', \'' + ContentTypeID + '\')"></i>  ';
                    html += '     <img src="images/indent-arrow-r.jpg" style="cursor:pointer" onclick="GoForwardBookNode(\'' + response[i].bookContentID + '\', \'' + ContentTypeID + '\')"/>';
                    //html += '     <i class="mdi mdi-arrow-right" onclick="GoForwardBookNode(\'' + response[i].bookContentID + '\', \'' + ContentTypeID + '\')"></i>';
                    html += '</div>';

                    html += '     <span class="cm-settings"><i class="mdi mdi-dots-vertical"></i></span>                                ';
                    html += ' </div>                                                                                                    ';

                    BookContent.push(response[i]);
                }
            }
            $("#drag-container").append(html);
        },
        error: function (error) {
        }
    });
}

function BindBookContentUsingContentType(ID) {
    $("#hdContentTypeID").val(ID);
    const element = document.getElementById("content-manager");
    if (element) {
        element.style.display = "";
    }
    ClearContentText();
    $("#hdBookParentID").val("");

    $.ajax({
        type: "post",
        url: "/ContentManager/BindBookContentHeader_ContentTypeID",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "ContentTypeID": ID
        },
        success: function (response) {
            var html = '';
            if (response != null) {
                html += '<p style="cursor:pointer;" onclick="BindParentID()">' + response + '</p>';
            }
            $("#cmp-header").html(html);
            BindBookContentParentNode(ID);
        },
        error: function (error) {
            HideLoader();
        }
    });
}

function ShowHideBookContentTextbox(ID) {
    var element = document.getElementById("divBookContentTextbox");
    if (element) {
        if (element.style.display == "none") {
            element.style.display = "flex";
            $("#txtBookContent").focus();
        } else {
            element.style.display = "none";
        }
    }
}

var BookContent = [];
function BindBookContentParentNode(ContentTypeID) {
    $.ajax({
        type: "post",
        url: "/ContentManager/BindBookContentParentNode_ContentTypeID",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "ContentTypeID": ContentTypeID
        },
        success: function (response) {
            var html = '';
            if (response != null) {
                var result = response.bookParts;
                BookContent = response.bookParts;
                for (var i = 0; i < BookContent.length; i++) {
                    html += ' <div class="draggable-item cmr" draggable="true" id="divMain_' + BookContent[i].bookContentID + '" data-key="' + BookContent[i].bookContentID + '" ondragstart="drag(event)" ondrop="drop(event)" ondragover="allowDrop(event)">                                                                                         ';
                    html += '     <div class="cmr-expand-icon">                                                                         ';
                    if (BookContent[i].childCount > 0) {
                        html += '         <i class="mdi mdi-plus-box" id="hrefbookchild_' + BookContent[i].bookContentID + '" onclick="BindBookChild(\'' + BookContent[i].bookContentID + '\', \'' + ContentTypeID + '\', 1)"></i>  ';
                    } else {
                        html += '         <i class="mdi" id="hrefbookchild_' + BookContent[i].bookContentID + '" onclick="BindBookChild(\'' + BookContent[i].bookContentID + '\', \'' + ContentTypeID + '\', 1)"></i>  ';
                    }
                    html += '     </div>                                                                                                    ';
                    if (BookContent[i].indent == 0)
                        html += '     <div class="cmr-icon"><img src="images/book-section-icon.png" /></div>                                ';
                    else if (BookContent[i].indent == 30)
                        html += '     <div class="cmr-icon"><img src="images/content-book-icon.png" /></div>                                ';
                    else if (BookContent[i].indent == 60)
                        html += '     <div class="cmr-icon"><img src="images/content-book-icon2.png" /></div>                               ';
                    else
                        html += '     <div class="cmr-icon"><img src="images/content-book-icon2.png" /></div>                               ';

                    html += '     <div class="cmr-txt" style="cursor:pointer;" id="div_' + BookContent[i].bookContentID + '" onclick="BindParentID(\'' + BookContent[i].bookContentID + '\')">' + BookContent[i].description + '</div>                                            ';

                    html += '     <div class="cmr-ind"><img src="images/indent-arrow-l.jpg" style="cursor:pointer" onclick="GoBackBookNode(\'' + BookContent[i].bookContentID + '\', \'' + ContentTypeID + '\')" />  ';
                    html += '     <img src="images/indent-arrow-r.jpg" style="cursor:pointer" onclick="GoForwardBookNode(\'' + BookContent[i].bookContentID + '\', \'' + ContentTypeID + '\')" />                          ';
                    html += '     </div>';
                    html += '     <span class="cm-settings"><i class="mdi mdi-dots-vertical"></i></span>                                ';
                    html += ' </div>                                                                                                    ';
                }
            }
            $("#drag-container").html(html);
            const element = document.getElementById("divAddNewItem");
            if (element) {
                element.style.display = "";
            }
        },
        error: function (error) {
        }
    });
}

async function BindChildsBookContentIDByParent(ParentID, ContentTypeID) {
    return new Promise((resolve, reject) => {
        $.ajax({
            type: "post",
            url: "/ContentManager/BindChildsBookContentIDByParent",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            async: true,
            data: {
                "ContentTypeID": ContentTypeID,
                "ParentID": ParentID
            },
            success: function (response) {
                resolve(response);
            },
            error: function (error) {
                reject(error);
            }
        });
    });
}

async function BindBookChild(BookContentID, ContentTypeID, IsParent) {
    var BookListID = [];
    var hrefbookchild = $("#hrefbookchild_" + BookContentID);
    if (hrefbookchild) {
        if (hrefbookchild.hasClass("mdi-minus-box")) {
            var currentItem = BookContent.filter(x => x.bookContentID === BookContentID)[0];
            if (currentItem) {
                var List = await BindChildsBookContentIDByParent(BookContentID, ContentTypeID);
                BookListID = List;
            }
            if (IsParent == 1) {
                $('div[data-key]').filter(function () {
                    return $.inArray($(this).attr('data-key'), BookListID) !== -1;
                }).remove(); // Remove the matching elements

                if (BookListID.length > 0) {
                    for (var i = 0; i < BookListID.length; i++) {
                        const indexToRemove = BookContent.findIndex(x => x.bookContentID === BookListID[i]);
                        if (indexToRemove !== -1) {
                            BookContent.splice(indexToRemove, 1);
                        }
                    }
                    rearrangeBookContent();
                }
            } else {
                $('div[data-key]').filter(function () {
                    return $.inArray($(this).attr('data-key'), BookListID) !== -1 && $(this).attr('id') !== 'divMain_' + BookContentID + '';
                }).remove(); // Remove the matching elements

                if (BookListID.length > 0) {
                    for (var i = 0; i < BookListID.length; i++) {
                        const indexToRemove = BookContent.findIndex(x => x.bookContentID === BookListID[i]);
                        if (indexToRemove !== -1 && BookContentID !== BookListID[i]) {
                            BookContent.splice(indexToRemove, 1);
                        }
                    }
                    rearrangeBookContent();
                }
            }
            if (hrefbookchild.hasClass("mdi-plus-box")) {
                hrefbookchild.removeClass("mdi-plus-box");
                hrefbookchild.addClass("mdi-minus-box");
            } else {
                hrefbookchild.addClass("mdi-plus-box");
                hrefbookchild.removeClass("mdi-minus-box");
            }
            return;
        } else {

        }
    }

    $.ajax({
        type: "post",
        url: "/ContentManager/BindBookContentParentNode_ContentTypeID",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "ContentTypeID": ContentTypeID,
            "ParentID": BookContentID,
        },
        success: function (response) {
            var html = '';
            if (response != null && response.bookParts != null) {
                bookParts = response.bookParts;
                for (var i = 0; i < bookParts.length; i++) {
                    html += ' <div class="draggable-item cmr" style="padding-left: ' + bookParts[i].indent + 'px" draggable="true" id="divMain_' + bookParts[i].bookContentID + '" data-key="' + bookParts[i].bookContentID + '" ondragstart="drag(event)" ondrop="drop(event)" ondragover="allowDrop(event)">';
                    html += '     <div class="cmr-expand-icon">                                                                         ';
                    if (bookParts[i].childCount > 0) {
                        html += '         <i class="mdi mdi-plus-box" id="hrefbookchild_' + bookParts[i].bookContentID + '" onclick="BindBookChild(\'' + bookParts[i].bookContentID + '\', \'' + ContentTypeID + '\', 0)"></i>  ';
                    } else {
                        html += '         <i class="mdi" id="hrefbookchild_' + bookParts[i].bookContentID + '" onclick="BindBookChild(\'' + bookParts[i].bookContentID + '\', \'' + ContentTypeID + '\', 0)"></i>  ';
                    }

                    html += '     </div>                                                                                                    ';

                    if (bookParts[i].indent == 0)
                        html += '     <div class="cmr-icon"><img src="images/book-section-icon.png" /></div>                                ';
                    else if (bookParts[i].indent == 30)
                        html += '     <div class="cmr-icon"><img src="images/content-book-icon.png" /></div>                                ';
                    else if (bookParts[i].indent == 60)
                        html += '     <div class="cmr-icon"><img src="images/content-book-icon2.png" /></div>                                ';
                    else
                        html += '     <div class="cmr-icon"><img src="images/content-book-icon2.png" /></div>                                ';


                    html += '     <div class="cmr-txt" style="cursor:pointer;" id="div_' + bookParts[i].bookContentID + '" onclick="BindParentID(\'' + bookParts[i].bookContentID + '\')">' + bookParts[i].description + '</div>                                            ';

                    html += '     <div class="cmr-ind"><img src="images/indent-arrow-l.jpg" style="cursor:pointer" onclick="GoBackBookNode(\'' + bookParts[i].bookContentID + '\', \'' + ContentTypeID + '\')"/>  ';
                    html += '       <img src="images/indent-arrow-r.jpg" style="cursor:pointer" onclick="GoForwardBookNode(\'' + bookParts[i].bookContentID + '\', \'' + ContentTypeID + '\')"/>';
                    html += '</div>';
                    html += '     <span class="cm-settings"><i class="mdi mdi-dots-vertical"></i></span>                                ';
                    html += ' </div>                                                                                                    ';

                    const indexToRemove = BookContent.findIndex(x => x.bookContentID === bookParts[i].bookContentID);
                    if (indexToRemove !== -1) {
                        BookContent.splice(indexToRemove, 1);
                    }
                    BookContent.push(bookParts[i]);
                    rearrangeBookContent();
                }
            }
            $("#divMain_" + BookContentID).after(html);
            var hrefbookchild = $("#hrefbookchild_" + BookContentID);
            if (hrefbookchild) {
                if (hrefbookchild.hasClass("mdi-plus-box")) {
                    hrefbookchild.removeClass("mdi-plus-box");
                    hrefbookchild.addClass("mdi-minus-box");
                } else {
                    hrefbookchild.addClass("mdi-plus-box");
                    hrefbookchild.removeClass("mdi-minus-box");
                }
            }
        },
        error: function (error) {
        }
    });
}

function rearrangeBookContent() {
    const rearrangedArray = [];

    for (const item of BookContent) {
        if (!item.parentID) {
            rearrangedArray.push(item);
            pushChildren(item, rearrangedArray);
        }
    }
    // Update BookContent with the rearranged array
    BookContent = rearrangedArray;
}

function pushChildren(parentItem, rearrangedArray) {
    const children = BookContent.filter(item => item.parentID === parentItem.bookContentID);

    for (const child of children) {
        // Check if the child is not already in the rearrangedArray before pushing
        if (!rearrangedArray.some(item => item.bookContentID === child.bookContentID)) {
            rearrangedArray.push(child);
            // Recursively push children
            pushChildren(child, rearrangedArray);
        }
    }
}

function GoBackBookNode(bookContentID, contentTypeID) {
    let currentItem = BookContent.filter(x => x.bookContentID === bookContentID)[0];
    if (currentItem) {
        if (currentItem.parentID == undefined || currentItem.parentID === null) {
            showNotification('', 'Unable to proceed further Backward!', 'error', false);
            return false;
        }
        let currentParentItem = BookContent.filter(x => x.bookContentID === currentItem.parentID)[0];
        if (currentParentItem) {
            let currentParentID = currentParentItem.parentID;
            let Indent = parseInt(currentItem.indent) - 30;
            BookContentUpdate(bookContentID, contentTypeID, currentParentID, Indent, 'Backward');
        }
    }
}

function GoForwardBookNode(bookContentID, contentTypeID) {
    let currentItem = BookContent.filter(x => x.bookContentID === bookContentID)[0];
    if (currentItem) {
        var currentIndex = BookContent.findIndex(x => x === currentItem);
        if (currentIndex !== -1 && currentIndex > 0) {
            var parentItem = BookContent[currentIndex - 1];
            var Indent = parseInt(parentItem.indent) + 30;

            if (currentItem.indent - parentItem.indent === 30) {
                showNotification('', 'Unable to proceed further Forward!', 'error', false);
            } else {
                //--------Code added-----------
                if (currentItem.indent == parentItem.indent) {
                    BookContentUpdate(bookContentID, contentTypeID, parentItem.bookContentID, Indent, "Forward");
                } else {
                    parentItem = navigateBackToCustomIndent(currentIndex, parseInt(currentItem.indent) + 30)
                    if (parentItem === undefined) {
                        parentItem = BookContent[currentIndex - 1]
                        BookContentUpdate(bookContentID, contentTypeID, parentItem.bookContentID, Indent, "Forward");
                    } else {
                        BookContentUpdate(bookContentID, contentTypeID, parentItem.parentID, parentItem.indent, "Forward");
                    }
                }
            }
        }
    }
}

function navigateBackToCustomIndent(startIndex, customIndent) {
    let currentPosition = startIndex;

    while (currentPosition >= 0) {
        const currentIndent = BookContent[currentPosition].indent;

        if (currentIndent === customIndent) {
            // Found the desired custom indent level
            return BookContent[currentPosition];
            break;
        } else {
            currentPosition--;
        }
    }
}

//function BookContentUpdate(bookContentID, contentTypeID, parentID, indent, type, siblingID) {
//    var status = 0;
//    $.ajax({
//        type: "post",
//        url: "/ContentManager/BookContentUpdateBackForward",
//        contenttype: "application/json;charset=utf-8",
//        datatype: "json",
//        async: true,
//        data: {
//            "bookContentID": bookContentID,
//            "parentID": parentID,
//            "siblingID": siblingID,
//            "indent": indent,
//            "contentTypeID": contentTypeID,
//            "type": type
//        },
//        success: function (response) {
//            if (response != null) {
//                for (var i = 0; i < response.length; i++) {
//                    let currentItem = response[i];
//                    if (currentItem) {
//                        if (currentItem.childCount > 0) {
//                            $("#hrefbookchild_" + currentItem.bookContentID).addClass("mdi-minus-box");
//                        } else {
//                            $("#hrefbookchild_" + currentItem.bookContentID).removeClass("mdi-plus-box");
//                            $("#hrefbookchild_" + currentItem.bookContentID).removeClass("mdi-minus-box");
//                        }
//                        $("#divMain_" + currentItem.bookContentID).css("padding-left", currentItem.indent + "px");

//                        var divMain = document.getElementById("divMain_" + currentItem.bookContentID);
//                        if (divMain) {
//                            var imgElement = divMain.querySelector('.cmr-icon img');
//                            if (imgElement) {
//                                if (currentItem.indent == 0)
//                                    imgElement.src = 'images/book-section-icon.png';
//                                else if (currentItem.indent == 30)
//                                    imgElement.src = 'images/content-book-icon.png';
//                                else if (currentItem.indent == 60)
//                                    imgElement.src = 'images/content-book-icon2.png';
//                                else
//                                    imgElement.src = 'images/content-book-icon2.png';
//                            }
//                        }
//                        if (BookContent.filter(x => x.bookContentID === currentItem.bookContentID).length > 0) {
//                            BookContent.filter(x => x.bookContentID === currentItem.bookContentID)[0].childCount = currentItem.childCount;
//                            BookContent.filter(x => x.bookContentID === currentItem.bookContentID)[0].indent = currentItem.indent;
//                            BookContent.filter(x => x.bookContentID === currentItem.bookContentID)[0].parentID = currentItem.parentID;
//                        }
//                    }
//                }
//            }
//            status = 1;
//        },
//        error: function (error) {
//        }
//    });
//}

async function BookContentUpdate(bookContentID, contentTypeID, parentID, indent, type, siblingID) {
    return new Promise(resolve => {
        $.ajax({
            type: "post",
            url: "/ContentManager/BookContentUpdateBackForward",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            async: true,
            data: {
                "bookContentID": bookContentID,
                "parentID": parentID,
                "siblingID": siblingID,
                "indent": indent,
                "contentTypeID": contentTypeID,
                "type": type
            },
            success: function (response) {
                (async () => {
                    if (response != null) {
                        for (var i = 0; i < response.length; i++) {
                            let currentItem = response[i];
                            if (currentItem) {
                                if (currentItem.childCount > 0) {
                                    $("#hrefbookchild_" + currentItem.bookContentID).addClass("mdi-minus-box");
                                } else {
                                    $("#hrefbookchild_" + currentItem.bookContentID).removeClass("mdi-plus-box");
                                    $("#hrefbookchild_" + currentItem.bookContentID).removeClass("mdi-minus-box");
                                }
                                $("#divMain_" + currentItem.bookContentID).css("padding-left", currentItem.indent + "px");

                                var divMain = document.getElementById("divMain_" + currentItem.bookContentID);
                                if (divMain) {
                                    var imgElement = divMain.querySelector('.cmr-icon img');
                                    if (imgElement) {
                                        if (currentItem.indent == 0)
                                            imgElement.src = 'images/book-section-icon.png';
                                        else if (currentItem.indent == 30)
                                            imgElement.src = 'images/content-book-icon.png';
                                        else if (currentItem.indent == 60)
                                            imgElement.src = 'images/content-book-icon2.png';
                                        else
                                            imgElement.src = 'images/content-book-icon2.png';
                                    }
                                }
                                if (BookContent.filter(x => x.bookContentID === currentItem.bookContentID).length > 0) {
                                    BookContent.filter(x => x.bookContentID === currentItem.bookContentID)[0].childCount = currentItem.childCount;
                                    BookContent.filter(x => x.bookContentID === currentItem.bookContentID)[0].indent = currentItem.indent;
                                    BookContent.filter(x => x.bookContentID === currentItem.bookContentID)[0].parentID = currentItem.parentID;
                                }
                            }
                        }
                    }
                    resolve(1);
                })();
            },
            error: function (error) {
                resolve(0);
            }
        });
    });
}


function BindBookContentParentNode_ContentTypeID(contentTypeID, parentID) {
    $.ajax({
        type: "post",
        url: "/ContentManager/BindBookContentParentNode_ContentTypeID",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "contentTypeID": contentTypeID,
            "parentID": parentID
        },
        success: function (response) {

        },
        error: function (error) {
        }
    });
}

function BindBookContent(ContentTypeID) {
    $.ajax({
        type: "post",
        url: "/ContentManager/BindBookContent_ContentTypeID",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "ContentTypeID": ContentTypeID
        },
        success: function (response) {
            var html = '';
            if (response != null) {
                var CTLength = response.length;

                for (var i = 0; i < CTLength; i++) {
                    html += ' <div class="cmr">                                                                                         ';
                    html += '     <div class="cmr-expand-icon">                                                                         ';
                    html += '     </div>                                                                                                ';
                    if (response[i].indent == 0)
                        html += '     <div class="cmr-icon"><img src="images/book-section-icon.png" /></div>                                ';
                    else if (response[i].indent == 30)
                        html += '     <div class="cmr-icon"><img src="images/content-book-icon.png" /></div>                                ';
                    else if (response[i].indent == 60)
                        html += '     <div class="cmr-icon"><img src="images/content-book-icon2.png" /></div>                               ';
                    else
                        html += '     <div class="cmr-icon"><img src="images/content-book-icon2.png" /></div>                               ';

                    html += '     <div class="cmr-txt" style="cursor:pointer;" id="div_' + response[i].bookContentID + '" onclick="BindParentID(\'' + response[i].bookContentID + '\')">' + response[i].description + '</div>                                            ';
                    if (i == 0) {
                        html += '     <div class="cmr-ind"></div>  ';
                    } else {
                        html += '     <div class="cmr-ind"><i class="mdi mdi-arrow-left"></i><i class="mdi mdi-arrow-right"></i></div>  ';
                    }
                    html += '     <span class="cm-settings"><i class="mdi mdi-dots-vertical"></i></span>                                ';
                    html += ' </div>                                                                                                    ';

                    if (response[i].bookParts != null) {
                        for (var j = 0; j < response[i].bookParts.length; j++) {
                            html += ' <div class="cmr cmr-ch-1">                                                                                ';
                            html += '     <div class="cmr-expand-icon">                                                                         ';
                            html += '         <i class="mdi mdi-minus-box"></i>                                                                 ';
                            html += '     </div>                                                                                                ';

                            if (response[i].bookParts[j].indent == 0)
                                html += '     <div class="cmr-icon"><img src="images/book-section-icon.png" /></div>                                ';
                            else if (response[i].bookParts[j].indent == 30)
                                html += '     <div class="cmr-icon"><img src="images/content-book-icon.png" /></div>                                ';
                            else if (response[i].bookParts[j].indent == 60)
                                html += '     <div class="cmr-icon"><img src="images/content-book-icon2.png" /></div>                               ';
                            else
                                html += '     <div class="cmr-icon"><img src="images/content-book-icon2.png" /></div>                               ';

                            html += '     <div class="cmr-txt" style="cursor:pointer;" id="div_' + response[i].bookParts[j].bookContentID + '" onclick="BindParentID(\'' + response[i].bookParts[j].bookContentID + '\')">' + response[i].bookParts[j].description + '</div>                               ';
                            html += '     <div class="cmr-ind"><i class="mdi mdi-arrow-left"></i><i class="mdi mdi-arrow-right"></i></div>      ';
                            html += '     <span class="cm-settings"><i class="mdi mdi-dots-vertical"></i></span>                                ';
                            html += ' </div>                                                                                                    ';

                            if (response[i].bookParts[j].bookParts != null) {
                                for (var k = 0; k < response[i].bookParts[j].bookParts.length; k++) {
                                    html += ' <div class="cmr cmr-ch-2">                                                                                ';
                                    html += '     <div class="cmr-icon"><i class="mdi mdi-file-document"></i></div>                                     ';
                                    html += '     <div class="cmr-txt" style="cursor:pointer;" id="div_' + response[i].bookParts[j].bookParts[k].bookContentID + '" onclick="BindParentID(\'' + response[i].bookParts[j].bookParts[k].bookContentID + '\')">' + response[i].bookParts[j].bookParts[k].description + '</div>                  ';
                                    html += '     <div class="cmr-ind"><i class="mdi mdi-arrow-left"></i><i class="mdi mdi-arrow-right"></i></div>      ';
                                    html += '     <span class="cm-settings"><i class="mdi mdi-dots-vertical"></i></span>                                ';
                                    html += ' </div>                                                                                                    ';
                                }
                            }
                        }
                    }
                }
            }

            $("#drag-container").html(html);
            const element = document.getElementById("divAddNewItem");
            if (element) {
                element.style.display = "";
            }
        },
        error: function (error) {
        }
    });
}

function BindParentID(ID) {
    $("#hdBookParentID").val(ID);
    $(".cmr").removeClass("active");
    $("#div_" + ID).parent().addClass("active");
    BindSubContent();
}

function BackwardForwardBookContent(ContentID, ID, Type) {
    $.ajax({
        type: "post",
        url: "/ContentManager/BackwardForwardBookContent",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {
            "ID": ID,
            "Type": Type
        },
        success: function (response) {
            if (response != null) {
                if (response.Status == "1") {
                    BindBookContent(ContentID);
                } else {
                    showNotification("", response.Message, "error", false);
                }
            }
        },
        error: function (error) {
        }
    });
}

function SaveSubContentDetail() {
    var buttonType = $("#savebtn").val().toLowerCase();
    if (buttonType == "save") {
        var Id = $("#hdBookParentID").val();
        if (Id == null || Id == undefined || Id == "") {
            showNotification("", "Please select book content from middle section", "error", false);
            return false;
        }
        $.ajax({
            type: "post",
            url: "/ContentManager/SaveSubContentDetail",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            data: {
                "SubContentID": Id,
                "Name": $("#txtname").val(),
                "Description": $("#txtdescription").val(),
                "ContentBody": tinymce.get('txtContentBody').getContent()
            },
            success: function (response) {
                if (response != null) {
                    if (response.Status == "1") {
                        showNotification("", response.Message, "success", false);
                        ClearContentText();
                        $("#hdBookParentID").val("");
                        setTimeout(function () {
                        }, 500);
                    } else {
                        showNotification("", response.Message, "error", false);
                    }
                    if (response.Focus != "") {
                        $("#" + response.Focus).focus();
                    }
                }
            },
            error: function (error) {
            }
        });
    }

    else {
        var Id = $("#hdBookDetailID").val();
        if (Id == null || Id == undefined || Id == "") {
            showNotification("", "Please select book content from middle section", "error", false);
            return false;
        }
        $.ajax({
            type: "post",
            url: "/ContentManager/UpdateSubContentDetail",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            data: {
                "ID": Id,
                "Name": $("#txtname").val(),
                "Description": $("#txtdescription").val(),
                "ContentBody": tinymce.get('txtContentBody').getContent()
            },
            success: function (response) {
                if (response != null) {
                    if (response.Status == "1") {
                        showNotification("", response.Message, "success", false);
                        ClearContentText();
                        $("#hdBookParentID").val("");
                        setTimeout(function () {
                        }, 500);
                    } else {
                        showNotification("", response.Message, "error", false);
                    }
                } else {
                    showNotification("", "Internal  server error!", "error", false);
                }
            },
            error: function (error) {
            }
        });
    }
}

function BindSubContent() {
    var Id = $("#hdBookParentID").val();
    if (Id == null || Id == undefined || Id == "") {
        return false;
    }

    $.ajax({
        type: "post",
        url: "/ContentManager/GetSubContentDetail",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        async: true,
        data: {
            "SubContentID": Id
        },
        success: function (response) {
            var html = '';
            if (response != null) {
                $("#txtname").val(response.name);
                $("#txtdescription").val(response.description);
                tinymce.get('txtContentBody').setContent(response.contentBody);
                $("#hdBookDetailID").val(response.id);
                $("#savebtn").val("Update");
            }
            else {
                ClearContentText();
            }
        },
        error: function (error) {
        }
    });
}

function ClearContentText() {
    $("#txtname").val("");
    $("#txtdescription").val("");
    tinymce.get('txtContentBody').setContent("");
    $("#savebtn").val("Save");
}