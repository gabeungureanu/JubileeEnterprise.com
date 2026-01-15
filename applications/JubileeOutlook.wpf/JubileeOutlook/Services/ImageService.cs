using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Windows.Media.Imaging;
using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

/// <summary>
/// Service for handling image and attachment uploads/downloads via API
/// </summary>
public class ImageService
{
    private static ImageService? _instance;
    private static readonly object _lock = new();
    private readonly HttpClientFactory _httpClientFactory;
    private readonly string _uploadEndpoint = "/api/outlook/files/upload";
    private readonly string _downloadEndpoint = "/api/outlook/files";

    /// <summary>
    /// Singleton instance
    /// </summary>
    public static ImageService Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new ImageService();
                }
            }
            return _instance;
        }
    }

    private ImageService()
    {
        _httpClientFactory = HttpClientFactory.Instance;
    }

    /// <summary>
    /// Uploads an image to the server
    /// </summary>
    public async Task<EventImage?> UploadImageAsync(EventImage image)
    {
        try
        {
            byte[]? imageData = image.ImageData;

            // If no image data, try to read from file path
            if ((imageData == null || imageData.Length == 0) && !string.IsNullOrEmpty(image.FilePath) && File.Exists(image.FilePath))
            {
                imageData = await File.ReadAllBytesAsync(image.FilePath);
            }

            if (imageData == null || imageData.Length == 0)
            {
                System.Diagnostics.Debug.WriteLine($"[ImageService] No image data to upload for {image.FileName}");
                return image;
            }

            // Determine content type from extension
            var contentType = GetContentType(image.FileName);
            image.ContentType = contentType;
            image.FileSize = imageData.Length;

            using var content = new MultipartFormDataContent();
            using var fileContent = new ByteArrayContent(imageData);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            content.Add(fileContent, "file", image.FileName);
            content.Add(new StringContent("image"), "type");
            content.Add(new StringContent(image.Id), "id");

            var response = await _httpClientFactory.PostAsync(
                ApiEndpoint.InspireContinuum,
                _uploadEndpoint,
                content,
                isFormData: true);

            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                var uploadResult = JsonSerializer.Deserialize<UploadResponse>(responseContent, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (uploadResult != null)
                {
                    image.Url = uploadResult.Url;
                    image.ThumbnailUrl = uploadResult.ThumbnailUrl ?? uploadResult.Url;
                    System.Diagnostics.Debug.WriteLine($"[ImageService] Image uploaded successfully: {image.Url}");
                }
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"[ImageService] Failed to upload image: {response.StatusCode}");
            }

            return image;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ImageService] Error uploading image: {ex.Message}");
            return image;
        }
    }

    /// <summary>
    /// Uploads an attachment to the server
    /// </summary>
    public async Task<EventAttachment?> UploadAttachmentAsync(EventAttachment attachment)
    {
        try
        {
            byte[]? fileData = null;

            // Read from file path
            if (!string.IsNullOrEmpty(attachment.FilePath) && File.Exists(attachment.FilePath))
            {
                fileData = await File.ReadAllBytesAsync(attachment.FilePath);
            }

            if (fileData == null || fileData.Length == 0)
            {
                System.Diagnostics.Debug.WriteLine($"[ImageService] No file data to upload for {attachment.FileName}");
                return attachment;
            }

            // Determine content type from extension
            var contentType = GetContentType(attachment.FileName);
            attachment.ContentType = contentType;
            attachment.FileSize = fileData.Length;

            using var content = new MultipartFormDataContent();
            using var fileContent = new ByteArrayContent(fileData);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            content.Add(fileContent, "file", attachment.FileName);
            content.Add(new StringContent("attachment"), "type");
            content.Add(new StringContent(attachment.Id), "id");

            var response = await _httpClientFactory.PostAsync(
                ApiEndpoint.InspireContinuum,
                _uploadEndpoint,
                content,
                isFormData: true);

            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                var uploadResult = JsonSerializer.Deserialize<UploadResponse>(responseContent, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (uploadResult != null)
                {
                    attachment.Url = uploadResult.Url;
                    System.Diagnostics.Debug.WriteLine($"[ImageService] Attachment uploaded successfully: {attachment.Url}");
                }
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"[ImageService] Failed to upload attachment: {response.StatusCode}");
            }

            return attachment;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ImageService] Error uploading attachment: {ex.Message}");
            return attachment;
        }
    }

    /// <summary>
    /// Downloads an image from a URL and returns a BitmapImage
    /// </summary>
    public async Task<BitmapImage?> DownloadImageAsync(string url)
    {
        try
        {
            if (string.IsNullOrEmpty(url))
                return null;

            System.Diagnostics.Debug.WriteLine($"[ImageService] Downloading image from: {url}");

            var response = await _httpClientFactory.GetAsync(
                ApiEndpoint.InspireContinuum,
                url.StartsWith("/") ? url : $"{_downloadEndpoint}/{url}");

            if (response.IsSuccessStatusCode)
            {
                var imageData = await response.Content.ReadAsByteArrayAsync();

                if (imageData.Length > 0)
                {
                    var bitmapImage = new BitmapImage();
                    using var stream = new MemoryStream(imageData);
                    bitmapImage.BeginInit();
                    bitmapImage.CacheOption = BitmapCacheOption.OnLoad;
                    bitmapImage.StreamSource = stream;
                    bitmapImage.EndInit();
                    bitmapImage.Freeze();

                    System.Diagnostics.Debug.WriteLine($"[ImageService] Image downloaded successfully: {imageData.Length} bytes");
                    return bitmapImage;
                }
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"[ImageService] Failed to download image: {response.StatusCode}");
            }

            return null;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ImageService] Error downloading image: {ex.Message}");
            return null;
        }
    }

    /// <summary>
    /// Downloads an image and stores it in the EventImage object
    /// </summary>
    public async Task<EventImage> LoadImageDataAsync(EventImage image)
    {
        try
        {
            // If already has image data, return as is
            if (image.ImageData != null && image.ImageData.Length > 0)
                return image;

            // Try to load from URL
            if (!string.IsNullOrEmpty(image.Url))
            {
                var response = await _httpClientFactory.GetAsync(
                    ApiEndpoint.InspireContinuum,
                    image.Url.StartsWith("/") ? image.Url : $"{_downloadEndpoint}/{image.Url}");

                if (response.IsSuccessStatusCode)
                {
                    image.ImageData = await response.Content.ReadAsByteArrayAsync();
                    System.Diagnostics.Debug.WriteLine($"[ImageService] Image data loaded from URL: {image.ImageData.Length} bytes");
                }
            }
            // Try to load from file path
            else if (!string.IsNullOrEmpty(image.FilePath) && File.Exists(image.FilePath))
            {
                image.ImageData = await File.ReadAllBytesAsync(image.FilePath);
                System.Diagnostics.Debug.WriteLine($"[ImageService] Image data loaded from file: {image.ImageData.Length} bytes");
            }

            return image;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ImageService] Error loading image data: {ex.Message}");
            return image;
        }
    }

    /// <summary>
    /// Uploads all images for an event
    /// </summary>
    public async Task<List<EventImage>> UploadEventImagesAsync(List<EventImage> images)
    {
        var uploadedImages = new List<EventImage>();

        foreach (var image in images)
        {
            // Skip already uploaded images
            if (image.IsUploaded)
            {
                uploadedImages.Add(image);
                continue;
            }

            var uploadedImage = await UploadImageAsync(image);
            if (uploadedImage != null)
            {
                uploadedImages.Add(uploadedImage);
            }
        }

        return uploadedImages;
    }

    /// <summary>
    /// Uploads all attachments for an event
    /// </summary>
    public async Task<List<EventAttachment>> UploadEventAttachmentsAsync(List<EventAttachment> attachments)
    {
        var uploadedAttachments = new List<EventAttachment>();

        foreach (var attachment in attachments)
        {
            // Skip already uploaded attachments
            if (attachment.IsUploaded)
            {
                uploadedAttachments.Add(attachment);
                continue;
            }

            var uploadedAttachment = await UploadAttachmentAsync(attachment);
            if (uploadedAttachment != null)
            {
                uploadedAttachments.Add(uploadedAttachment);
            }
        }

        return uploadedAttachments;
    }

    /// <summary>
    /// Loads images from URLs for display
    /// </summary>
    public async Task<List<(EventImage Image, BitmapImage? Bitmap)>> LoadEventImagesForDisplayAsync(List<EventImage> images)
    {
        var result = new List<(EventImage, BitmapImage?)>();

        foreach (var image in images)
        {
            BitmapImage? bitmap = null;

            // Try to create bitmap from existing image data
            if (image.ImageData != null && image.ImageData.Length > 0)
            {
                try
                {
                    bitmap = new BitmapImage();
                    using var stream = new MemoryStream(image.ImageData);
                    bitmap.BeginInit();
                    bitmap.CacheOption = BitmapCacheOption.OnLoad;
                    bitmap.StreamSource = stream;
                    bitmap.EndInit();
                    bitmap.Freeze();
                }
                catch
                {
                    bitmap = null;
                }
            }
            // Try to download from URL
            else if (!string.IsNullOrEmpty(image.Url))
            {
                bitmap = await DownloadImageAsync(image.Url);
            }
            // Try to load from file path
            else if (!string.IsNullOrEmpty(image.FilePath) && File.Exists(image.FilePath))
            {
                try
                {
                    bitmap = new BitmapImage();
                    bitmap.BeginInit();
                    bitmap.CacheOption = BitmapCacheOption.OnLoad;
                    bitmap.UriSource = new Uri(image.FilePath);
                    bitmap.EndInit();
                    bitmap.Freeze();
                }
                catch
                {
                    bitmap = null;
                }
            }

            result.Add((image, bitmap));
        }

        return result;
    }

    private static string GetContentType(string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".bmp" => "image/bmp",
            ".webp" => "image/webp",
            ".pdf" => "application/pdf",
            ".doc" => "application/msword",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls" => "application/vnd.ms-excel",
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".ppt" => "application/vnd.ms-powerpoint",
            ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".txt" => "text/plain",
            ".zip" => "application/zip",
            ".rar" => "application/x-rar-compressed",
            ".7z" => "application/x-7z-compressed",
            _ => "application/octet-stream"
        };
    }
}

/// <summary>
/// Response model for file upload
/// </summary>
internal class UploadResponse
{
    public string? Url { get; set; }
    public string? ThumbnailUrl { get; set; }
    public string? Id { get; set; }
    public string? FileName { get; set; }
    public long FileSize { get; set; }
    public string? ContentType { get; set; }
    public bool Success { get; set; }
    public string? Error { get; set; }
}
