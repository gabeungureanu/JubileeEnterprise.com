$(document).ready(function () {
    (function () {
        var inputs;

        inputs = document.querySelectorAll('.form-file');

        Array.prototype.forEach.call(inputs, function (input) {
            var label, labelVal;
            label = input.nextElementSibling;
            labelVal = label.innerHTML;
            return input.addEventListener('change', function (e) {
                var fileName;
                fileName = e.target.value.split('\\').pop();
                if (fileName) {
                    return label.querySelector('span').innerHTML = fileName;
                } else {
                    return label.innerHTML = labelVal;
                }
            });
        });

        input.addEventListener('focus', function () {
            return input.classList.add('has-focus');
        });

        input.addEventListener('blur', function () {
            return input.classList.remove('has-focus');
        });

    }).call(this);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiPGFub255bW91cz4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFBQSxNQUFBOztFQUFBLE1BQUEsR0FBUyxRQUFRLENBQUMsZ0JBQVQsQ0FBMEIsWUFBMUI7O0VBQ1QsS0FBSyxDQUFBLFNBQUUsQ0FBQSxPQUFPLENBQUMsSUFBZixDQUFvQixNQUFwQixFQUE0QixRQUFBLENBQUMsS0FBRCxDQUFBO0FBQzVCLFFBQUEsS0FBQSxFQUFBO0lBQUUsS0FBQSxHQUFRLEtBQUssQ0FBQztJQUNkLFFBQUEsR0FBVyxLQUFLLENBQUM7V0FDakIsS0FBSyxDQUFDLGdCQUFOLENBQXVCLFFBQXZCLEVBQWlDLFFBQUEsQ0FBQyxDQUFELENBQUE7QUFDbkMsVUFBQTtNQUFJLFFBQUEsR0FBVyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFmLENBQXFCLElBQXJCLENBQTBCLENBQUMsR0FBM0IsQ0FBQTtNQUNYLElBQUcsUUFBSDtlQUNFLEtBQUssQ0FBQyxhQUFOLENBQW9CLE1BQXBCLENBQTJCLENBQUMsU0FBNUIsR0FBd0MsU0FEMUM7T0FBQSxNQUFBO2VBR0UsS0FBSyxDQUFDLFNBQU4sR0FBa0IsU0FIcEI7O0lBRitCLENBQWpDO0VBSDBCLENBQTVCOztFQVNBLEtBQUssQ0FBQyxnQkFBTixDQUF1QixPQUF2QixFQUFnQyxRQUFBLENBQUEsQ0FBQTtXQUM5QixLQUFLLENBQUMsU0FBUyxDQUFDLEdBQWhCLENBQW9CLFdBQXBCO0VBRDhCLENBQWhDOztFQUVBLEtBQUssQ0FBQyxnQkFBTixDQUF1QixNQUF2QixFQUErQixRQUFBLENBQUEsQ0FBQTtXQUM3QixLQUFLLENBQUMsU0FBUyxDQUFDLE1BQWhCLENBQXVCLFdBQXZCO0VBRDZCLENBQS9CO0FBWkEiLCJzb3VyY2VzQ29udGVudCI6WyJpbnB1dHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuZm9ybS1maWxlJylcbkFycmF5Ojpmb3JFYWNoLmNhbGwgaW5wdXRzLCAoaW5wdXQpIC0+XG4gIGxhYmVsID0gaW5wdXQubmV4dEVsZW1lbnRTaWJsaW5nXG4gIGxhYmVsVmFsID0gbGFiZWwuaW5uZXJIVE1MXG4gIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIgJ2NoYW5nZScsIChlKSAtPlxuICAgIGZpbGVOYW1lID0gZS50YXJnZXQudmFsdWUuc3BsaXQoJ1xcXFwnKS5wb3AoKVxuICAgIGlmIGZpbGVOYW1lXG4gICAgICBsYWJlbC5xdWVyeVNlbGVjdG9yKCdzcGFuJykuaW5uZXJIVE1MID0gZmlsZU5hbWVcbiAgICBlbHNlXG4gICAgICBsYWJlbC5pbm5lckhUTUwgPSBsYWJlbFZhbFxuaW5wdXQuYWRkRXZlbnRMaXN0ZW5lciAnZm9jdXMnLCAtPlxuICBpbnB1dC5jbGFzc0xpc3QuYWRkICdoYXMtZm9jdXMnXG5pbnB1dC5hZGRFdmVudExpc3RlbmVyICdibHVyJywgLT5cbiAgaW5wdXQuY2xhc3NMaXN0LnJlbW92ZSAnaGFzLWZvY3VzJyJdfQ==
//# sourceURL=coffeescript
});

function uploadFile() {
    var fileInput = document.getElementById('edit-file');
    var fileNameSpan = document.getElementById('fileName');
    var uploadProgress = document.getElementById('uploadProgress');

    var file = fileInput.files[0];

    if (file) {
        // Show file name
        fileNameSpan.textContent = 'Uploading file: ' + file.name;
        // Show progress indicator
        uploadProgress.style.display = 'flex';
        // Simulate upload delay (replace this with your actual upload logic)

        var formData = new FormData();
        formData.append('file', file);

        $.ajax({
            url: '/ContentManager/UploadFile',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (data) {
                if (data != null) {
                    if (data.Status === "1") {
                        setTimeout(function () {
                            uploadProgress.style.display = 'none';                            
                            fileInput.value = '';
                            showNotification("", data.Message, "success", false);
                        }, 1000);
                    } else {
                        showNotification("", data.Message, "error", false);
                        uploadProgress.style.display = 'none'; 
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

function handleFileUpload() {
    var fileInput = document.getElementById('fileInput');
    var fileNameSpan = document.getElementById('fileName');
    var uploadProgress = document.getElementById('uploadProgress');

    if (fileInput.files.length > 0) {
        var file = fileInput.files[0];

        // Show file name
        fileNameSpan.textContent = 'Uploading file: ' + file.name;
        // Show progress indicator
        uploadProgress.style.display = 'block';
        // Simulate upload delay (replace this with your actual upload logic)
       
        setTimeout(function () {
            // Hide progress indicator
            uploadProgress.style.display = 'none';
            // Clear the file input after successful upload
            fileInput.value = '';
        }, 3000); // Simulated 3-second upload time, replace with your actual logic
    }
}