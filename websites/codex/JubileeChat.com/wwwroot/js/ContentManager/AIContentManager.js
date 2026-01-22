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
    //ProcessStep22_DraftCopy("abc", 1, "Hello world");
    BindContentTypeDropDown();
    BindContentManager();
    //BindAIConfigurationByType("");

    $("#btnBluePrint").click(function () {
        //SaveContentDetails();
        Step1Clicked();
    });

    $("#btnDraftCopy").click(function () {
        ProcessStep2_DraftCopy()
    });

    $("#txtContentTitle").keyup(function () {
        const element = document.querySelector("#divContentTitle");
        if (element) {
            if (validateTextboxValueReturnMessage('txtContentTitle', "Content Title") !== "") {
                element.classList.add("req-field");
            } else {
                element.classList.remove("req-field");
            }
        }
    });
    $("#ddlContentType").change(function () {
        const element = document.querySelector("#divContentType");
        if (element) {
            if (validateTextboxValueReturnMessage('ddlContentType', "Content Type") !== "") {
                element.classList.add("req-field");
            } else {
                element.classList.remove("req-field");
            }

            showHideNoneFiction();

            BindAIConfigurationByType("Step1:Blueprint");
            setTimeout(function () {
                BindAIConfigurationByType("Step2:Draftcopy");
            }, 500);

        }
    });
    $("#txtContentCode").keyup(function () {
        const element = document.querySelector("#divContentCode");
        if (element) {
            if (validateTextboxValueReturnMessage('txtContentCode', "Content Code") !== "") {
                element.classList.add("req-field");
            } else {
                element.classList.remove("req-field");
            }
        }
    });
    $("#txtContentCategory").keyup(function () {
        const element = document.querySelector("#divContentCategory");
        if (element) {
            if (validateTextboxValueReturnMessage('txtContentCategory', "Content Category") !== "") {
                element.classList.add("req-field");
            } else {
                element.classList.remove("req-field");
            }
        }
    });
    $("#txtContentTheme").keyup(function () {
        const element = document.querySelector("#divContentTheme");
        if (element) {
            if (validateTextboxValueReturnMessage('txtContentTheme', "Content Theme") !== "") {
                element.classList.add("req-field");
            } else {
                element.classList.remove("req-field");
            }
        }
    });
    $("#txtNarrativeStory").keyup(function () {
        const element = document.querySelector("#divContentStory");
        if (element) {
            if (validateTextboxValueReturnMessage('txtNarrativeStory', "Content Theme") !== "") {
                element.classList.add("req-field");
            } else {
                element.classList.remove("req-field");
            }
        }
    });
    $("#txtNarrativeElements").keyup(function () {
        const element = document.querySelector("#divContentElements");
        if (element) {
            if (validateTextboxValueReturnMessage('txtNarrativeElements', "Content Theme") !== "") {
                element.classList.add("req-field");
            } else {
                element.classList.remove("req-field");
            }
        }
    });
    $("#txtBookIdea").keyup(function () {
        const element = document.querySelector("#divBookIdea");
        if (element) {
            if (validateTextboxValueReturnMessage('txtBookIdea', "Book Idea") !== "") {
                element.classList.add("req-field");
            } else {
                element.classList.remove("req-field");
            }
        }
    });
    $("#ddlBookTitle").change(function () {
        const element = document.querySelector("#divBookTitle");
        if (element) {
            if (validateTextboxValueReturnMessage('ddlBookTitle', "Book Title") !== "") {
                element.classList.add("req-field");
            } else {
                element.classList.remove("req-field");
            }
        }
    });
    $("#txtBookTheme").keyup(function () {
        const element = document.querySelector("#divBookTheme");
        if (element) {
            if (validateTextboxValueReturnMessage('txtBookTheme', "Book Theme") !== "") {
                element.classList.add("req-field");
            } else {
                element.classList.remove("req-field");
            }
        }
    });
    $("#txtBookGoals").keyup(function () {
        const element = document.querySelector("#divBookGoals");
        if (element) {
            if (validateTextboxValueReturnMessage('txtBookGoals', "Book Goal") !== "") {
                element.classList.add("req-field");
            } else {
                element.classList.remove("req-field");
            }
        }
    });
    $("#txtBookPersona").keyup(function () {
        const element = document.querySelector("#divBookPersona");
        if (element) {
            if (validateTextboxValueReturnMessage('txtBookPersona', "Book Persona") !== "") {
                element.classList.add("req-field");
            } else {
                element.classList.remove("req-field");
            }
        }
    });
    $("#txtBookIdea").change(function () {
        const element = document.querySelector("#divBookIdea");
        if (element) {
            if (validateTextboxValueReturnMessage('txtBookIdea', "Book Idea") !== "") {
                element.classList.add("req-field");
            } else {
                element.classList.remove("req-field");
            }
        }
    });
    //$("#ddlBookTitle").change(function () {
    //    const element = document.querySelector("#divBookTitle");
    //    if (element) {
    //        if (validateTextboxValueReturnMessage('ddlBookTitle', "Book Title") !== "") {
    //            element.classList.add("req-field");
    //        } else {
    //            element.classList.remove("req-field");
    //        }
    //    }
    //});
    $("#txtBookTheme").change(function () {
        const element = document.querySelector("#divBookTheme");
        if (element) {
            if (validateTextboxValueReturnMessage('txtBookTheme', "Book Theme") !== "") {
                element.classList.add("req-field");
            } else {
                element.classList.remove("req-field");
            }
        }
    });
    $("#txtBookGoals").change(function () {
        const element = document.querySelector("#divBookGoals");
        if (element) {
            if (validateTextboxValueReturnMessage('txtBookGoals', "Book Goal") !== "") {
                element.classList.add("req-field");
            } else {
                element.classList.remove("req-field");
            }
        }
    });
    $("#txtBookPersona").change(function () {
        const element = document.querySelector("#divBookPersona");
        if (element) {
            if (validateTextboxValueReturnMessage('txtBookPersona', "Book Persona") !== "") {
                element.classList.add("req-field");
            } else {
                element.classList.remove("req-field");
            }
        }
    });
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

function BindBookContentUsingContentType(ID, Type) {
    $("#hdContentTypeID").val(ID);
    const element = document.getElementById("content-manager");
    if (element) {
        element.style.display = "";
    }

    //ClearDetails();
    //ClearBlueprintTextbox();
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
            ShowMiddleRightSection();
            if (Type === "Save") {
            } else {
                const element = document.querySelector(".cm-form-tab3");
                const elementp = document.querySelector("#pDetails");
                if (element) {
                    element.classList.add("active");
                    elementp.classList.add("active");
                }
            }
        },
        error: function (error) {
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
                element.style.display = "none";
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


/// AI Content Manager Right section

function ShowHideBCHeader(e) {
    const elements = document.getElementsByClassName("b-content-header");
    for (const element of elements) {
        element.classList.remove("active");
    }
    e.classList.add("active");

    const elementBC = document.getElementsByClassName("b-content");
    for (const element of elementBC) {
        element.classList.remove("active");
    }

    if (e.innerHTML == "Content") {
        const tab2 = document.querySelector(".cm-form-tab2");
        if (tab2)
            tab2.classList.add("active");
    }
    if (e.innerHTML == "Details") {
        const tab3 = document.querySelector(".cm-form-tab3");
        if (tab3)
            tab3.classList.add("active");
    }
    if (e.innerHTML == "Persona") {
        const tab8 = document.querySelector(".cm-form-tab8");
        if (tab8)
            tab8.classList.add("active");
    }
    if (e.innerHTML == "Blueprint") {
        const tab9 = document.querySelector(".cm-form-tab9");
        if (tab9)
            tab9.classList.add("active");

    } if (e.innerHTML == "Draft Copy") {
        const tab10 = document.querySelector(".cm-form-tab10");
        if (tab10)
            tab10.classList.add("active");
    }
    if (e.innerHTML == "Cover") {

    }
}

function ShowHideAIHeader(e) {
    const elements = document.getElementsByClassName("ai-content-header");
    for (const element of elements) {
        element.classList.remove("active");
    }
    e.classList.add("active");

    const elementsAI = document.getElementsByClassName("ai-content");
    for (const element of elementsAI) {
        element.classList.remove("active");
    }

    if (e.innerHTML == "Step 1: Blueprint") {
        const tab5 = document.querySelector(".cm-form-tab5");
        if (tab5)
            tab5.classList.add("active");
    }
    if (e.innerHTML == "Step 2: Draft Copy") {
        const tab6 = document.querySelector(".cm-form-tab6");
        if (tab6)
            tab6.classList.add("active");
    }
    if (e.innerHTML == "Step 3: Manuscript") {
        const tab7 = document.querySelector(".cm-form-tab7");
        if (tab7)
            tab7.classList.add("active");
    }
}

function ShowMiddleRightSection() {
    const elementLeft = document.querySelector(".cm-left");
    const elementRight = document.querySelector(".cm-right");
    if (elementLeft) {
        if (elementLeft.style.display === "none") {
            elementLeft.style.display = "";
            elementRight.style.display = "";
        }
    }
}

function ShowAITabs() {
    var flag = false;
    if ($("#hdChckAdmin").val() === "true") {
        const elementBookTab = document.querySelector("#divBookTab");
        const elementAITab = document.querySelector("#divAITab");
        if (elementBookTab) {
            elementBookTab.classList.remove("active");
        }
        if (elementAITab) {
            elementAITab.classList.add("active");
        }

        const elementsAI = document.getElementsByClassName("ai-content");
        for (const element of elementsAI) {
            if (element.classList.contains("active")) {
                flag = true;
            }
        }
        if (!flag) {
            const elementTb5 = document.querySelector(".cm-form-tab5");
            if (elementTb5) {
                elementTb5.classList.add("active");
                const element = document.querySelector("#pBlueprint");
                element.classList.add("active")
            }
        }

        const elementAi = document.querySelector("#divAIContent");
        const elementBook = document.querySelector("#divBookContent");
        if (elementAi) {
            elementAi.style.display = "";
            elementBook.style.display = "none";


            //const elementTb5 = document.querySelector(".cm-form-tab5");
            //if (elementTb5) {
            //    elementTb5.classList.add("active");
            //    const element = document.querySelector("#pBlueprint");
            //    element.classList.add("active")
            //}
            //const elementTb6 = document.querySelector(".cm-form-tab6");
            //if (elementTb6) {
            //    elementTb6.classList.remove("active");
            //}
            //const elementTb7 = document.querySelector(".cm-form-tab7");
            //if (elementTb7) {
            //    elementTb7.classList.remove("active");
            //}
            //const elementTb8 = document.querySelector(".cm-form-tab8");
            //if (elementTb8) {
            //    elementTb8.classList.remove("active");
            //}
        }
    } else {
        OpenAIUserPopup();
    }
}

function OpenAIUserPopup() {
    const element = document.querySelector("#divOverlay");
    if (element) {
        element.style.display = "";
    }
}

function CloseAIUserPopup() {
    const element = document.querySelector("#divOverlay");
    if (element) {
        element.style.display = "none";
    }
}

function ClearPopup() {
    $("#txtEmailAddress").val("");
    $("#txtPassword").val("");
}

function CheckUserAdminForAIConfiguration() {
    $.ajax({
        type: "post",
        url: "/ContentManager/GetUserInformation",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {
            "EmailAddress": $("#txtEmailAddress").val(),
            "Password": $("#txtPassword").val()
        },
        success: function (response) {
            if (response != null) {
                if (response.Status === "1") {
                    if (response.IsAdmin === "true") {
                        $("#hdChckAdmin").val("true");
                        ClearPopup();
                        CloseAIUserPopup();
                        ShowAITabs();
                    }
                } else {
                    showNotification("", response.Message, "error", false);
                }
            }
        },
        error: function (error) {
        },
        complete: function () {
            HideFullLoader();
        }
    });
}

function ShowBookTab() {
    const elementBookTab = document.querySelector("#divBookTab");
    const elementAITab = document.querySelector("#divAITab");
    if (elementBookTab) {
        elementBookTab.classList.add("active");
    }
    if (elementAITab) {
        elementAITab.classList.remove("active");
    }

    const elementAi = document.querySelector("#divAIContent");
    const elementBook = document.querySelector("#divBookContent");
    if (elementAi) {
        elementAi.style.display = "none";
        elementBook.style.display = "";

        //const elementTb5 = document.querySelector(".cm-form-tab5");
        //const elementTb6 = document.querySelector(".cm-form-tab6");
        //const elementTb7 = document.querySelector(".cm-form-tab7");
        //const elementTb8 = document.querySelector(".cm-form-tab8");
        //if (elementTb5) {
        //    elementTb5.classList.remove("active");
        //}
        //if (elementTb6) {
        //    elementTb6.classList.remove("active");
        //}
        //if (elementTb7) {
        //    elementTb7.classList.remove("active");
        //}
        //if (elementTb8) {
        //    elementTb8.classList.remove("active");
        //}
    }
}

function BindContentTypeDropDown() {
    $.ajax({
        type: "get",
        url: "/ContentManager/GetCMSContentType",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        success: function (response) {
            if (response != null) {
                var dropdown = $('#ddlContentType');
                dropdown.empty();

                dropdown.append($('<option></option>').attr('value', "").text("Choose content type"));
                $.each(response, function (index, item) {
                    dropdown.append($('<option></option>').attr('value', item.id).text(item.type));
                });
            }
        },
        error: function (error) {
            alert("Error");
        }
    });
}

function SaveContentDetails() {
    if (!ValidateContentDetails()) {
        return false;
    }
    ShowFullLoader();
    $.ajax({
        type: "post",
        url: "/ContentManager/SaveContentDetails",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {
            "ContentTypeID": $("#hdContentTypeID").val(),
            "ContentCode": $("#txtContentCode").val(),
            "ContentTitle": $("#txtContentTitle").val(),
            "ContentType": $("#ddlContentType").val(),
            "ContentCategory": $("#txtContentCategory").val(),
            "ContentTheme": $("#txtContentTheme").val(),
            "NarrativeStory": $("#txtNarrativeStory").val(),
            "NarrativeElements": $("#txtNarrativeElements").val(),
            "PersonaContext": $("#txtPersonaContext").val(),
            "PersonaRole": $("#txtPersonaRole").val(),
            "NarrativeStructure": $("#txtNarrativeStructure").val(),
            "PlotDevelopment": $("#txtPlotDevelopment").val(),
            "ThematicDepth": $("#txtThematicDepth").val(),
            "BlueprintRating": $("#txtBlueprintRating").val()
        },
        success: function (response) {
            if (response != null) {
                var elem = document.querySelector("#ancDownload");

                if (response.Status === "1") {
                    showNotification("", response.Message, "success", false);
                    BindBookContentUsingContentType($("#hdContentTypeID").val(), "Save");
                    if (elem) {
                        elem.style.display = "";
                        elem.setAttribute("href", "/apiresponses/" + response.FileName);
                        elem.download = response.FileName;
                    }
                    ClearDetails();
                } else if (response.Status === "2") {
                    //showNotification("", response.Message, "error", false);
                    if (elem) {
                        elem.style.display = "";
                        elem.setAttribute("href", "/apiresponses/" + response.FileName);
                        elem.download = response.FileName;
                    }
                } else {
                    showNotification("", response.Message, "error", false);
                    if (elem) {
                        elem.style.display = "none";
                    }
                }

                if (response.Focus !== null && response.Focus !== "") {
                    $("#" + response.Focus).focus();
                }
            }
        },
        error: function (error) {
        },
        complete: function () {
            HideFullLoader();
        }

    });
}

function Step1Clicked() {
    //if (!ValidateContentDetails()) {
    //    return false;
    //}
    const elementType = document.querySelector("#ddlContentType");
    if (elementType) {
        if (elementType.options[elementType.selectedIndex].text.toLowerCase() === "non-fiction") {
            ProcessBluePrint();
        } else {
            SaveContentDetails();
        }
    }
}

function SaveContentDetails() {
    if (!ValidateContentDetails()) {
        return false;
    }
    ShowFullLoader();
    $.ajax({
        type: "post",
        url: "/ContentManager/SaveContentDetails",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {
            "ContentTypeID": $("#hdContentTypeID").val(),
            "ContentCode": $("#txtContentCode").val(),
            "ContentTitle": $("#txtContentTitle").val(),
            "ContentType": $("#ddlContentType").val(),
            "ContentCategory": $("#txtContentCategory").val(),
            "ContentTheme": $("#txtContentTheme").val(),
            "NarrativeStory": $("#txtNarrativeStory").val(),
            "NarrativeElements": $("#txtNarrativeElements").val(),
            "PersonaContext": $("#txtPersonaContext").val(),
            "PersonaRole": $("#txtPersonaRole").val(),
            "NarrativeStructure": $("#txtNarrativeStructure").val(),
            "PlotDevelopment": $("#txtPlotDevelopment").val(),
            "ThematicDepth": $("#txtThematicDepth").val(),
            "BlueprintRating": $("#txtBlueprintRating").val()
        },
        success: function (response) {
            if (response != null) {
                var elem = document.querySelector("#ancDownload");

                if (response.Status === "1") {
                    showNotification("", response.Message, "success", false);
                    BindBookContentUsingContentType($("#hdContentTypeID").val(), "Save");
                    if (elem) {
                        elem.style.display = "";
                        elem.setAttribute("href", "/apiresponses/" + response.FileName);
                        elem.download = response.FileName;
                    }
                    //ClearDetails();
                } else if (response.Status === "2") {
                    //showNotification("", response.Message, "error", false);
                    if (elem) {
                        elem.style.display = "";
                        elem.setAttribute("href", "/apiresponses/" + response.FileName);
                        elem.download = response.FileName;
                    }
                } else {
                    showNotification("", response.Message, "error", false);
                    if (elem) {
                        elem.style.display = "none";
                    }
                }

                if (response.Focus !== null && response.Focus !== "") {
                    $("#" + response.Focus).focus();
                }
            }
        },
        error: function (error) {
        },
        complete: function () {
            HideFullLoader();
        }

    });
}

function showCMLoader() {
    const element = document.querySelector(".cm-loader");
    if (element) {
        element.style.display = "";
    }
}

function hideCMLoader() {
    const element = document.querySelector(".cm-loader");
    if (element) {
        element.style.display = "none";
    }
}

function ProcessBluePrint() {
    if (!ValidateBlueprintData()) {
        return false;
    }

    DisableBlueprintButtons();
    //ShowFullLoader();
    ActiveBlueprintTab();
    showCMLoader();
    $.ajax({
        type: "post",
        url: "/ContentManager/GenerateBlueprintData",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {
            "ContentTypeID": $("#hdContentTypeID").val(),
            "ContentCode": $("#txtContentCode").val(),
            "BookIdea": $("#txtBookIdea").val(),
            "BookTitle": $("#ddlBookTitle").val(),
            "BookTheme": $("#txtBookTheme").val(),
            "BookGoals": $("#txtBookGoals").val(),
            "BookPersona": $("#txtBookPersona").val(),

            "AIBookTitle": $("#txtPersonaContext").val(),
            "AIBookGoals": $("#txtPersonaRole").val(),
            "AIBookTheme": $("#txtNarrativeStructure").val(),
            "AIBookPersona": $("#txtPlotDevelopment").val(),
            "AIChapterSections": $("#txtThematicDepth").val(),
            "AIChapterOutlines": $("#txtBlueprintRating").val()
        },
        success: function (response) {
            if (response != null) {
                var elem = document.querySelector("#ancDownload");
                if (response.Status === "1") {
                    $("#hfBookID").val(response.BookContentID);
                    //$("#hdBookParentID").val(response.BookContentID);
                    showNotification("", response.Message, "success", false);
                    BindBookContentUsingContentType($("#hdContentTypeID").val(), "Save");
                    if (elem) {
                        elem.style.display = "";
                        elem.setAttribute("href", "/apiresponses/" + response.FileName);
                        elem.download = response.FileName;
                    }

                    $("#txtBlueprint").val(response.BookBlueprint);
                    $("#btnBluePrint").addClass("disabled");
                    $("#btnDraftCopy").removeClass("disabled");

                    UnDisableBlueprintButtons();

                    ///Download blueprint file 
                    var btnDownload = document.getElementById("btnDownloadBlueprint");
                    if (btnDownload) {
                        // Add onclick event dynamically
                        btnDownload.onclick = function () {
                            DownloadBlueprint(response.BookContentID, $("#txtContentCode").val());
                        };
                    }

                    ///Update blueprint data in database
                    var btnUpdate = document.getElementById("btnUpdateBlueprint");
                    if (btnUpdate) {
                        // Add onclick event dynamically
                        btnUpdate.onclick = function () {
                            UpdateBlueprint(response.BookContentID);
                        };
                    }

                    ActiveBlueprintTab();


                    // ClearDetails();
                } else if (response.Status === "2") {
                    ActiveDetailsTab();
                    if (elem) {
                        elem.style.display = "";
                        elem.setAttribute("href", "/apiresponses/" + response.FileName);
                        elem.download = response.FileName;
                    }
                } else {
                    ActiveDetailsTab();
                    showNotification("", response.Message, "error", false);
                    if (elem) {
                        elem.style.display = "none";
                    }
                }

                if (response.Focus !== null && response.Focus !== "") {
                    $("#" + response.Focus).focus();
                }
            }
        },
        error: function (error) {
            ActiveDetailsTab();
        },
        complete: function () {
            hideCMLoader();
        }
    });
}

function ValidateBlueprintData() {
    var flag = true;
    //if (validateTextboxValueReturnMessage('txtContentTitle', "Content Title") !== "") {
    //    const element = document.querySelector("#divContentTitle");
    //    if (element)
    //        element.classList.add("req-field");
    //    flag = false;
    //}
    if (validateDropDownValueReturnMessage('ddlContentType', "Content Type") !== "") {
        const element = document.querySelector("#divContentType");
        if (element)
            element.classList.add("req-field");
        flag = false;
    } else {
        const element = document.querySelector("#divContentType");
        if (element)
            element.classList.remove("req-field");
    }
    if (validateTextboxValueReturnMessage('txtContentCode', "Content Code") !== "") {
        const element = document.querySelector("#divContentCode");
        if (element)
            element.classList.add("req-field");
        flag = false;
    } else {
        const element = document.querySelector("#divContentCode");
        if (element)
            element.classList.remove("req-field");
    }
    if (validateTextboxValueReturnMessage('txtBookIdea', "Book Idea") !== "") {
        const element = document.querySelector("#divBookIdea");
        if (element)
            element.classList.add("req-field");
    } else {
        const element = document.querySelector("#divBookIdea");
        if (element)
            element.classList.remove("req-field");
    }
    if (validateTextboxValueReturnMessage('ddlBookTitle', "Book Title") !== "") {
        const element = document.querySelector("#divBookTitle");
        if (element)
            element.classList.add("req-field");
        flag = false;
    } else {
        const element = document.querySelector("#divBookTitle");
        if (element)
            element.classList.remove("req-field");
    }
    if (validateTextboxValueReturnMessage('txtBookTheme', "Book Theme") !== "") {
        const element = document.querySelector("#divBookTheme");
        if (element)
            element.classList.add("req-field");
        flag = false;
    } else {
        const element = document.querySelector("#divBookTheme");
        if (element)
            element.classList.remove("req-field");
    }
    if (validateTextboxValueReturnMessage('txtBookGoals', "Book Goal") !== "") {
        const element = document.querySelector("#divBookGoals");
        if (element)
            element.classList.add("req-field");
        flag = false;
    } else {
        const element = document.querySelector("#divBookGoals");
        if (element)
            element.classList.remove("req-field");
    }
    if (validateTextboxValueReturnMessage('txtBookPersona', "Book Persona") !== "") {
        const element = document.querySelector("#divBookPersona");
        if (element)
            element.classList.add("req-field");
        flag = false;
    } else {
        const element = document.querySelector("#divBookPersona");
        if (element)
            element.classList.remove("req-field");
    }
    return flag;
}

function UpdateBlueprint(BookContentID) {
    if (BookContentID !== null || BookContentID !== undefined) {
        $.ajax({
            type: "post",
            url: "/ContentManager/UpdateBlueprint",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            data: {
                "BookContentID": BookContentID,
                "BlueprintData": $("#txtBlueprint").val(),
            },
            success: function (response) {
                if (response !== undefined && response != null) {
                    if (response.Status == "1") {
                        showNotification("", response.Message, "success", false);
                    } else {
                        showNotification("", response.Message, "error", false);
                    }
                }
            },
            error: function (error) {
            },
            complete: function () {
                HideFullLoader();
            }
        });
    }
}

async function ProcessStep2_DraftCopy() {
    DisableDraftCopyButtons();
    ActiveDraftCopyTab();
    showCMLoader();
    $.ajax({
        type: "post",
        url: "/ContentManager/Step2_DraftCopy",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {
            "ContentTypeID": $("#hdContentTypeID").val(),
            "BookContentID": $("#hfBookID").val(),
            "ContentCode": $("#txtContentCode").val(),
            "BookIdea": $("#txtBookIdea").val(),
            "BookTitle": $("#ddlBookTitle").val(),
            "BookTheme": $("#txtBookTheme").val(),
            "BookGoals": $("#txtBookGoals").val(),
            "BookPersona": $("#txtBookPersona").val(),

            "AIBookStructure": $("#txtActStructure").val(),
            "AIWritingElements": $("#txtBeatStructure").val(),
            "AIWritingStrategies": $("#txtCharacterProfiles").val(),
            "AIEmotionalResponse": $("#txtSettingContext").val(),
            "AIQualityAssurance": $("#txtDraftChapters").val(),
            "AIWritingInstructions": $("#txtDraftRating").val()
        },
        success: function (response) {
            if (response != null) {
                if (response.Status === "1") {
                    $("#txtDraftCopy").val(response.DraftCopy);
                    ActiveDraftCopyTab();
                    ///Download blueprint file 
                    var btnDownload = document.getElementById("btnDownloadDraftCpoy");
                    if (btnDownload) {
                        // Add onclick event dynamically
                        btnDownload.onclick = function () {
                            DownloadDraftCopy(response.BookContentID, $("#txtContentCode").val());
                        };
                    }
                    UnDisableDraftCopyButtons();

                    //Loop here for each chapter
                    if (response.ChaptersSectionsOutline !== null) {
                        var chapterLoop = 1;
                        var singleChapterOutline = "";
                        for (let chapter of response.ChaptersSectionsOutline) {
                            //response.ChaptersSectionsOutline.forEach(function (chapter) {
                            var sectionLoop = 1;
                            var sectionOutline = "";
                            singleChapterOutline = "\n\n" + chapter.title;

                            for (let section of chapter.sections) {
                                //chapter.sections.forEach(function (section) {
                                singleChapterOutline += "\n" + section.title;
                            };
                            ///Call Step 2.2 function here for generate Chapters Introductions

                            ProcessStep22_DraftCopy(chapter.id, chapterLoop, singleChapterOutline);


                            chapter.sections.forEach(function (section) {
                                sectionOutline = "\n Section " + chapterLoop + "." + sectionLoop;
                                ///Call Step2.3 function here for generate Section Introductions
                                //await ProcessStep23_DraftCopy(sectionOutline);
                                sectionLoop++;
                            });
                            chapterLoop++;
                        };
                    }
                }
                else {
                    showNotification("", response.Message, "success", false);
                    ActiveBlueprintTab();
                    UnDisableBlueprintButtons();
                }
                //ProcessStep22_DraftCopy("abc", 1, "Hello world");
            }
            else {
                ActiveBlueprintTab();
                UnDisableBlueprintButtons();
            }
        },
        error: function (error) {
            ActiveBlueprintTab();
            UnDisableBlueprintButtons();
        },
        complete: function () {
            hideCMLoader();
        }
    });
}

async function ProcessStep22_DraftCopy(chapterID, chapterLoop, singleChapterOutline) {
    showCMLoader();
    return new Promise(resolve => {
        $.ajax({
            type: "POST",
            url: "/ContentManager/Step22_DraftCopy",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            data: {
                "ChapterID": chapterID,
                "LoopChapter": chapterLoop,
                "SingleChapterOutline": singleChapterOutline
            },
            success: function (response) {
                (async () => {
                    if (response != null) {
                        if (response.Status === "1") {
                            var preVal = $("#txtDraftCopy").val();
                            $("#txtDraftCopy").val(preVal + response.DraftCopy);
                        }
                    }
                    resolve(1);
                })();
            },
            error: function (xhr, textStatus, errorThrown) {
                alert("Error: " + textStatus + "; " + errorThrown);
            },
            complete: function () {
                hideCMLoader();
            }
        });
    });
}

//function ProcessStep22_DraftCopy(chapterID, chapterLoop, singleChapterOutline) {
//    showCMLoader();
//    $.ajax({
//        type: "POST",
//        url: "/ContentManager/Step22_DraftCopy",
//        contentType: "application/json; charset=utf-8",
//        dataType: "json",
//        data: JSON.stringify({
//            ChapterID: chapterID,
//            LoopChapter: chapterLoop,
//            SingleChapterOutline: singleChapterOutline
//        }),
//        success: function (response) {
//            // Response handling logic
//            if (response != null && response.Status === "1") {
//                var preVal = $("#txtDraftCopy").val();
//                $("#txtDraftCopy").val(preVal + response.DraftCopy);
//            }
//        },
//        error: function (xhr, textStatus, errorThrown) {
//            // Error handling logic
//            alert("Error: " + textStatus + "; " + errorThrown);
//        },
//        complete: function () {
//            // Always executed logic after success or error
//            hideCMLoader(); // Assuming this is a function that hides the loading animation or indicator.
//        }
//    });
//}



function ProcessStep23_DraftCopy(sectionOutline) {
    DisableDraftCopyButtons();
    ActiveDraftCopyTab();
    showCMLoader();
    $.ajax({
        type: "post",
        url: "/ContentManager/Step2_DraftCopy",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {
            "ContentTypeID": $("#hdContentTypeID").val(),
            "BookContentID": $("#hfBookID").val(),
            "ContentCode": $("#txtContentCode").val(),
            "BookIdea": $("#txtBookIdea").val(),
            "BookTitle": $("#ddlBookTitle").val(),
            "BookTheme": $("#txtBookTheme").val(),
            "BookGoals": $("#txtBookGoals").val(),
            "BookPersona": $("#txtBookPersona").val(),

            "AIBookStructure": $("#txtActStructure").val(),
            "AIWritingElements": $("#txtBeatStructure").val(),
            "AIWritingStrategies": $("#txtCharacterProfiles").val(),
            "AIEmotionalResponse": $("#txtSettingContext").val(),
            "AIQualityAssurance": $("#txtDraftChapters").val(),
            "AIWritingInstructions": $("#txtDraftRating").val(),
            "SectionOutline": sectionOutline,
        },
        success: function (response) {
            if (response != null) {
                if (response.Status === "1") {
                    showNotification("", response.Message, "success", false);
                    $("#txtDraftCopy").val(response.DraftCopy);
                    ActiveDraftCopyTab();
                    ///Download blueprint file 
                    var btnDownload = document.getElementById("btnDownloadDraftCpoy");
                    if (btnDownload) {
                        // Add onclick event dynamically
                        btnDownload.onclick = function () {
                            DownloadDraftCopy(response.BookContentID, $("#txtContentCode").val());
                        };
                    }
                    UnDisableDraftCopyButtons();
                }
            } else {
                ActiveBlueprintTab();
            }
        },
        error: function (error) {
            ActiveBlueprintTab();
        },
        complete: function () {
            hideCMLoader();
        }
    });
}

function DownloadDraftCopy(BookContentID, BookCode) {
    if (BookContentID !== null || BookContentID !== undefined) {
        // Get the text from the textbox
        var textToWrite = document.getElementById("txtDraftCopy").value;

        // Create a Blob containing the text
        var blob = new Blob([textToWrite], { type: "text/plain" });

        // Create a temporary anchor element
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);

        // Set the file name
        var fileName = BookCode + "-DraftCopy.txt";
        a.download = fileName;

        // Append the anchor to the body and click it to trigger the download
        document.body.appendChild(a);
        a.click();

        // Cleanup
        document.body.removeChild(a);
    }
}

function ActiveDraftCopyTab() {
    const elements = document.getElementsByClassName("b-content-header");
    for (const element of elements) {
        element.classList.remove("active");
    }
    const pDCopy = document.querySelector("#pDCopy");
    if (pDCopy)
        pDCopy.classList.add("active");

    const elementsContent = document.getElementsByClassName("b-content");
    for (const element of elementsContent) {
        element.classList.remove("active");
    }
    const tab10 = document.querySelector(".cm-form-tab10");
    if (tab10)
        tab10.classList.add("active");
}

function DownloadBlueprint(BookContentID, BookCode) {
    if (BookContentID !== null || BookContentID !== undefined) {
        // Get the text from the textbox
        var textToWrite = document.getElementById("txtBlueprint").value;

        // Create a Blob containing the text
        var blob = new Blob([textToWrite], { type: "text/plain" });

        // Create a temporary anchor element
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);

        // Set the file name
        var fileName = BookCode + "-Blueprint.txt";
        a.download = fileName;

        // Append the anchor to the body and click it to trigger the download
        document.body.appendChild(a);
        a.click();

        // Cleanup
        document.body.removeChild(a);
    }
}

function ActiveBlueprintTab() {
    const elements = document.getElementsByClassName("b-content-header");
    for (const element of elements) {
        element.classList.remove("active");
    }
    const pBprint = document.querySelector("#pBprint");
    if (pBprint)
        pBprint.classList.add("active");

    const elementsContent = document.getElementsByClassName("b-content");
    for (const element of elementsContent) {
        element.classList.remove("active");
    }
    const tab9 = document.querySelector(".cm-form-tab9");
    if (tab9)
        tab9.classList.add("active");
}

function ActiveDetailsTab() {
    const elements = document.getElementsByClassName("b-content-header");
    for (const element of elements) {
        element.classList.remove("active");
    }
    const pDetails = document.querySelector("#pDetails");
    if (pDetails)
        pDetails.classList.add("active");

    const elementsContent = document.getElementsByClassName("b-content");
    for (const element of elementsContent) {
        element.classList.remove("active");
    }
    const tab3 = document.querySelector(".cm-form-tab3");
    if (tab3)
        tab3.classList.add("active");
}

function UnDisableDraftCopyButtons() {
    const download = document.querySelector("#btnDownloadDraftCpoy");
    if (download) {
        download.classList.remove("disabled");
    }
    const update = document.querySelector("#btnUpdateBlueprint");
    if (update) {
        //update.classList.remove("disabled");
    }
}

function DisableDraftCopyButtons() {
    const download = document.querySelector("#btnDownloadDraftCpoy");
    if (download) {
        download.classList.add("disabled");
    }
    const update = document.querySelector("#btnUpdateDraftCopy");
    if (update) {
        update.classList.add("disabled");
    }
}
function UnDisableBlueprintButtons() {
    const download = document.querySelector("#btnDownloadBlueprint");
    if (download) {
        download.classList.remove("disabled");
    }
    const update = document.querySelector("#btnUpdateBlueprint");
    if (update) {
        update.classList.remove("disabled");
    }
}

function DisableBlueprintButtons() {
    const download = document.querySelector("#btnDownloadBlueprint");
    if (download) {
        download.classList.add("disabled");
    }
    const update = document.querySelector("#btnUpdateBlueprint");
    if (update) {
        update.classList.add("disabled");
    }
}

function ValidateContentDetails() {
    var flag = true;
    if (validateTextboxValueReturnMessage('txtContentTitle', "Content Title") !== "") {
        const element = document.querySelector("#divContentTitle");
        if (element)
            element.classList.add("req-field");
        flag = false;
    } if (validateDropDownValueReturnMessage('ddlContentType', "Content Type") !== "") {
        const element = document.querySelector("#divContentType");
        if (element)
            element.classList.add("req-field");
        flag = false;
    } if (validateTextboxValueReturnMessage('txtContentCode', "Content Code") !== "") {
        const element = document.querySelector("#divContentCode");
        if (element)
            element.classList.add("req-field");
        flag = false;
    } if (validateTextboxValueReturnMessage('txtContentCategory', "Content Category") !== "") {
        const element = document.querySelector("#divContentCategory");
        if (element)
            element.classList.add("req-field");
        flag = false;
    } if (validateTextboxValueReturnMessage('txtContentTheme', "Content Theme") !== "") {
        const element = document.querySelector("#divContentTheme");
        if (element)
            element.classList.add("req-field");
        flag = false;
    } if (validateTextboxValueReturnMessage('txtNarrativeStory', "Content Story") !== "") {
        const element = document.querySelector("#divNarrativeStory");
        if (element)
            element.classList.add("req-field");
        flag = false;
    } if (validateTextboxValueReturnMessage('txtNarrativeElements', "Content Elements") !== "") {
        const element = document.querySelector("#divNarrativeElements");
        if (element)
            element.classList.add("req-field");
        flag = false;
    }
    return flag;
}

function ClearDetails() {
    $("#txtContentTitle").val("");
    $("#ddlContentType").val("");
    $("#txtContentCode").val("");
    $("#txtContentCategory").val("");
    $("#txtContentTheme").val("");
    $("#txtNarrativeStory").val("");
    $("#txtNarrativeElements").val("");
}

function BindParentID(ID) {
    //$("#hdBookParentID").val(ID);
    //$(".cmr").removeClass("active");
    //$("#div_" + ID).parent().addClass("active");
    //BindDetailsByID(ID);
    BindContentData(ID);
}

function BindContentData(ID) {
    $("#txtContent").val("");
    ShowFullLoader();
    $.ajax({
        type: "GET",
        url: "/ContentManager/BindContentData",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {
            "BookContentID": ID,
        },
        timeout: 1000000,
        success: function (response) {
            if (response !== undefined && response != null) {
                $("#txtContent").val(response.description);
            }
        },
        error: function (error) {
        },
        complete: function () {
            HideFullLoader();
        }
    });

}

function BindDetailsByID(BookContentID) {
    if (BookContentID !== undefined && BookContentID !== "") {
        //ShowFullLoader();
        $.ajax({
            type: "post",
            url: "/ContentManager/BindContentDetailsByID",
            contenttype: "application/json;charset=utf-8",
            datatype: "json",
            data: {
                "BookContentID": BookContentID,
            },
            success: function (response) {
                if (response !== undefined && response != null) {
                    $("#txtContentTitle").val(response.contentTitle);
                    $("#ddlContentType").val(response.contentType);
                    $("#txtContentCode").val(response.contentCode);
                    $("#txtContentCategory").val(response.contentCategory);
                    $("#txtContentTheme").val(response.contentTheme);
                    $("#txtNarrativeStory").val(response.narrativeStory);
                    $("#txtNarrativeElements").val(response.narrativeElements);
                    /// Bind Blueprint
                    ///BindAIConfigurationByType(response.contentType);
                }
            },
            error: function (error) {
            },
            complete: function () {
                HideFullLoader();
            }
        });
    }
}

//function BindAIConfigurationBlueprint() {
//    const elementType = document.querySelector("#ddlContentType");
//    if (elementType) {
//        if (elementType.options[elementType.selectedIndex].text.toLowerCase() === "non-fiction") {
//            BindAIConfigurationNonFiction($("#ddlContentType").val());
//        }
//    }
//}

function BindAIConfigurationByType(type) {
    const elementType = document.querySelector("#ddlContentType");
    //ShowFullLoader();
    $.ajax({
        type: "post",
        url: "/ContentManager/BindAIConfigurationSettings",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {
            "ContentTypeID": $("#ddlContentType").val(),
            "Type": type
        },
        success: function (response) {
            if (response !== undefined && response != null) {
                if (elementType.options[elementType.selectedIndex].text.toLowerCase() === "non-fiction") {
                    if (type.toLowerCase() === 'step1:blueprint') {
                        $("#pPersonaContext").html("Book Title");
                        $("#pPersonaRole").html("Book Goals");
                        $("#pNarrativeStructure").html("Book Theme");
                        $("#pPlotDevelopment").html("Book Persona");
                        $("#pThematicDepth").html("Chapter Sections");
                        $("#pBlueprintRating").html("Chapter Outline");
                    } else if (type.toLowerCase() === 'step2:draftcopy') {
                        $("#pActStructure").html("Book Structure");
                        $("#pBeatStructure").html("Writing Elements");
                        $("#pCharacterProfiles").html("Writing Strategies");
                        $("#pSettingContext").html("Emotional Response");
                        $("#pDraftChapters").html("Quality Assurance");
                        $("#pDraftRating").html("Writing Instructions");
                    } else if (type.toLowerCase() === 'step3:manuscript') {
                        $("#pPersonaContext").html("Book Title");
                        $("#pPersonaRole").html("Book Goals");
                        $("#pNarrativeStructure").html("Book Theme");
                        $("#pPlotDevelopment").html("Book Persona");
                        $("#pThematicDepth").html("Chapter Sections");
                        $("#pBlueprintRating").html("Chapter Outline");
                    }
                } else {
                    if (type.toLowerCase() === 'step1:blueprint') {
                        $("#pPersonaContext").html("Persona Context");
                        $("#pPersonaRole").html("Persona Role");
                        $("#pNarrativeStructure").html("Narrative Structure");
                        $("#pPlotDevelopment").html("Plot Development");
                        $("#pThematicDepth").html("Thematic Depth");
                        $("#pBlueprintRating").html("Blueprint Rating");
                    } else if (type.toLowerCase() === 'step2:draftcopy') {
                        $("#pActStructure").html("3 Act Structure");
                        $("#pBeatStructure").html("15 Beat Structure");
                        $("#pCharacterProfiles").html("Character Profiles");
                        $("#pSettingContext").html("Setting Context");
                        $("#pDraftChapters").html("Draft Chapters & Scenes");
                        $("#pDraftRating").html("Draft Rating");
                    } else if (type.toLowerCase() === 'step3:manuscript') {
                        $("#pPersonaContext").html("Book Title");
                        $("#pPersonaRole").html("Book Goals");
                        $("#pNarrativeStructure").html("Book Theme");
                        $("#pPlotDevelopment").html("Book Persona");
                        $("#pThematicDepth").html("Chapter Sections");
                        $("#pBlueprintRating").html("Chapter Outline");
                    }
                }
                if (type.toLowerCase() === 'step1:blueprint') {
                    $("#txtPersonaContext").val(response.textboxOne);
                    $("#txtPersonaRole").val(response.textboxTwo);
                    $("#txtNarrativeStructure").val(response.textboxThree);
                    $("#txtPlotDevelopment").val(response.textboxFour);
                    $("#txtThematicDepth").val(response.textboxFive);
                    $("#txtBlueprintRating").val(response.textboxSix);
                } else if (type.toLowerCase() === 'step2:draftcopy') {
                    $("#txtActStructure").val(response.textboxOne);
                    $("#txtBeatStructure").val(response.textboxTwo);
                    $("#txtCharacterProfiles").val(response.textboxThree);
                    $("#txtSettingContext").val(response.textboxFour);
                    $("#txtDraftChapters").val(response.textboxFive);
                    $("#txtDraftRating").val(response.textboxSix);
                } else if (type.toLowerCase() === 'step3:manuscript') {
                    $("#txtPersonaContext").val(response.textboxOne);
                    $("#txtPersonaRole").val(response.textboxTwo);
                    $("#txtNarrativeStructure").val(response.textboxThree);
                    $("#txtPlotDevelopment").val(response.textboxFour);
                    $("#txtThematicDepth").val(response.textboxFive);
                    $("#txtBlueprintRating").val(response.textboxSix);
                }
                //const element = document.querySelector(".cm-form-tab5");
                //if (element) {
                //    element.classList.add("active");
                //}                
            } else {
                if (type.toLowerCase() === 'step1:blueprint') {
                    ClearBlueprintTextbox();
                } else if (type.toLowerCase() === 'step2:draftcopy') {
                    ClearDraftCopyTextbox();
                } else if (type.toLowerCase() === 'step3:manuscript') {
                    ClearManuscriptTextbox();
                }
            }
        },
        error: function (error) {
        },
        complete: function () {
            HideFullLoader();
        }
    });
}

function ClearBlueprintTextbox() {
    $("#txtPersonaContext").val("");
    $("#txtPersonaRole").val("");
    $("#txtNarrativeStructure").val("");
    $("#txtPlotDevelopment").val("");
    $("#txtThematicDepth").val("");
    $("#txtBlueprintRating").val("");
}

function ClearDraftCopyTextbox() {
    $("#txtActStructure").val("");
    $("#txtBeatStructure").val("");
    $("#txtCharacterProfiles").val("");
    $("#txtSettingContext").val("");
    $("#txtDraftChapters").val("");
    $("#txtDraftRating").val("");
}

function showHideNarrativeNonFiction() {
    const elementNarrative = document.querySelectorAll(".narrative");
    const elementFiction = document.querySelectorAll("non-fiction");
    if (elementNarrative && elementFiction) {
        const elementType = document.querySelector("#ddlContentType");
        if (elementType.options[elementType.selectedIndex].text.toLowerCase() === "non-fiction") {
            elementNarrative.forEach(function (element) {
                element.style.display = "none";
            });
            elementFiction.forEach(function (element) {
                element.style.display = "flex";
            });
        } else {
            elementNarrative.forEach(function (element) {
                element.style.display = "flex";
            });
            elementFiction.forEach(function (element) {
                element.style.display = "none";
            });
        }
    }
}

function showHideNoneFiction() {
    const elementType = document.querySelector("#ddlContentType");
    const elementCategory = document.querySelector("#divContentCategory");
    const elementStory = document.querySelector("#divContentStory");
    const elementElements = document.querySelector("#divContentElements");
    if (elementType) {
        //const pstory = elementStory.querySelector('p.cmf-lable');
        //const pelements = elementElements.querySelector('p.cmf-lable');
        if (elementType.options[elementType.selectedIndex].text.toLowerCase() === "non-fiction") {
            //elementCategory.style.display = "none";
            //elementStory.style.display = "none";
            //pstory.innerHTML = "Content Goals";
            // pelements.innerHTML = "Persona & Roles";
            $("#divNonFiction").css("display", "flex");
            $("#divNarative").hide();
            //elementElements.
        } else {
            //elementCategory.style.display = "";
            //elementStory.style.display = "";
            // pstory.innerHTML = "Narrative Story";
            //pelements.innerHTML = "Narrative Elements";
            $("#divNonFiction").hide();
            $("#divNarative").css("display", "flex");
        }
    }
}

//function showHideNoneFiction() {
//    //const elementType = document.querySelector("#ddlContentType");
//    //const elementCategory = document.querySelector("#divContentCategory");
//    //const elementStory = document.querySelector("#divContentStory");
//    //const elementElements = document.querySelector("#divContentElements");
//    //if (elementType) {
//    //    const pstory = elementStory.querySelector('p.cmf-lable');
//    //    const pelements = elementElements.querySelector('p.cmf-lable');
//    //    if (elementType.options[elementType.selectedIndex].text.toLowerCase() === "non-fiction") {
//    //        elementCategory.style.display = "none";
//    //        elementStory.style.display = "none";
//    //        //pstory.innerHTML = "Content Goals";
//    //        pelements.innerHTML = "Persona & Roles";
//    //        //elementElements.
//    //    } else {
//    //        elementCategory.style.display = "";
//    //        elementStory.style.display = "";
//    //        // pstory.innerHTML = "Narrative Story";
//    //        pelements.innerHTML = "Narrative Elements";
//    //    }
//    //}
//}

function CheckBookCodeExists() {
    if ($("#txtContentCode").val().trim() === "") {
        return false;
    }
    //ShowFullLoader();
    $.ajax({
        type: "get",
        url: "/ContentManager/CheckBookCodeExists",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {
            "ContentCode": $("#txtContentCode").val(),
        },
        success: function (response) {
            if (response !== undefined && response != null) {
                if (response === "1") {
                    showNotification("", "Book code already exists", "error", false);
                }
            }
        },
        error: function (error) {
        },
        complete: function () {
            HideFullLoader();
        }
    });
}


function BindBookTitle() {
    if ($('#txtBookIdea').val().trim() === "") {
        var dropdown = $('#ddlBookTitle');
        dropdown.empty();
        $('#txtBookTheme').val("");
        $('#txtBookGoals').val("");
        $('#txtBookPersona').val("");
        return false;
    }
    ShowFullLoader();
    $.ajax({
        type: "post",
        url: "/ContentManager/GenerateBookTitle",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {
            "BookIdea": $("#txtBookIdea").val(),
        },
        success: function (response) {
            if (response !== undefined && response != null) {
                var dropdown = $('#ddlBookTitle');
                dropdown.empty();
                dropdown.append($('<option></option>').attr('value', "").text("Please select Title"));
                $.each(response, function (index, item) {
                    dropdown.append($('<option></option>').attr('value', item).text(item));
                });
            }
            $('#txtBookTheme').val("");
            $('#txtBookGoals').val("");
            $('#txtBookPersona').val("");
        },
        error: function (error) {
        },
        complete: function () {
            HideFullLoader();
        }
    });
}

function BindBookTheme() {
    if ($('#ddlBookTitle').val().trim() === "") {
        $('#txtBookTheme').val("");
        $('#txtBookGoals').val("");
        $('#txtBookPersona').val("");
        return false;
    }
    ShowFullLoader();
    $.ajax({
        type: "post",
        url: "/ContentManager/GenerateTheme",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {
            "BookTitle": $('#ddlBookTitle').val(),
        },
        success: function (response) {
            if (response !== undefined && response != null) {
                $('#txtBookTheme').val(response);
            }
            $('#txtBookGoals').val("");
            $('#txtBookPersona').val("");
        },
        error: function (error) {
        },
        complete: function () {
            HideFullLoader();
        }
    });
}

function BindBookGoal() {
    if ($('#txtBookTheme').val().trim() === "") {
        $('#txtBookGoals').val("");
        $('#txtBookPersona').val("");
        return false;
    }
    ShowFullLoader();
    $.ajax({
        type: "post",
        url: "/ContentManager/GenerateGoal",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        data: {
            "BookTheme": $('#txtBookTheme').val(),
        },
        success: function (response) {
            if (response !== undefined && response != null) {
                $('#txtBookGoals').val(response);
            }
            $('#txtBookPersona').val("");
        },
        error: function (error) {
        },
        complete: function () {
            HideFullLoader();
        }
    });
}

function BindBookPersona() {
    if ($('#txtBookGoals').val().trim() === "") {
        $('#txtBookPersona').val("");
        return false;
    }

    ShowFullLoader();
    $.ajax({
        type: "post",
        url: "/ContentManager/GeneratePersona",
        contenttype: "application/json;charset=utf-8",
        datatype: "json",
        success: function (response) {
            if (response !== undefined && response != null) {
                $('#txtBookPersona').val(response);
            }
        },
        error: function (error) {
        },
        complete: function () {
            HideFullLoader();
        }
    });
}

function uploadFile() {
    var fileInput = document.getElementById('edit-file');
    var fileNameSpan = document.getElementById('fileName');
    var uploadProgress = document.getElementById('uploadProgress');

    var file = fileInput.files[0];

    if (file) {
        var formData = new FormData();
        formData.append('file', file);
        $.ajax({
            url: '/ContentManager/UploadFileContentCode',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (data) {
                if (data != null) {
                    if (data.Status === "1") {
                        setTimeout(function () {
                            $("#ddlContentType").val("d798f4e5-05db-4541-ac14-6cb38fb3f4d0");    
                            fileInput.value = '';
                            $("#txtContentCode").val(data.ContentCode);
                            $("#txtBookIdea").val(data.BookIdea);;
                            $("#ddlBookTitle").html("<option value=\"" + data.BookTitle + "\">" + data.BookTitle + "</option>")
                            $("#txtBookTheme").val(data.BookTheme);
                            $("#txtBookGoals").val(data.BookGoals);
                            $("#txtBookPersona").val(data.BookPersona);

                            showHideNoneFiction();
                            //BindAIConfigurationByType($("#ddlContentType").val());
                            showNotification("", data.Message, "success", false);
                        }, 1000);
                    } else {
                        showNotification("", data.Message, "error", false);
                    }
                }
            },
            error: function (xhr, status, error) {
                uploadProgress.style.display = 'none';
            }
        });
    } else {
        showNotification("", "Please select the file to upload!", "error", false);
    }
}