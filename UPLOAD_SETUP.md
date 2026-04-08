# Image Upload Setup for Inventory

## Overview
The inventory system now supports uploading product images from the device gallery. Images are stored in DigitalOcean Spaces (S3-compatible object storage) and optimized automatically.

## Features Implemented

### Frontend (`ImageUpload` Component)
- **Gallery Selection**: Users can select multiple images from their device gallery
- **Upload to DO Spaces**: Images are uploaded via backend API to DigitalOcean Spaces
- **Image Optimization**: Backend automatically converts images to WebP format and resizes them
- **Primary Image**: First image is set as primary, users can change this
- **Image Management**: Remove images, set primary image
- **Visual Feedback**: Upload progress, image previews, error handling
- **Limits**: Maximum 5 images per product

### Backend Upload Service
- **Endpoints**:
  - `POST /api/v1/upload/image` - Upload single product image
  - `POST /api/v1/upload/images` - Upload multiple images (up to 5)
  - `DELETE /api/v1/upload/:key` - Delete image from storage
- **Image Processing**:
  - Automatic resize to max 1200px width
  - WebP conversion for optimal file size
  - Quality: 82% for regular images
  - Max file size: 5MB per image
- **Storage**: DigitalOcean Spaces with CDN support

## DigitalOcean Spaces Configuration

### 1. Create a Space
1. Log in to DigitalOcean
2. Navigate to **Spaces Object Storage**
3. Click **Create a Space**
4. Choose a region (e.g., `lon1` for London)
5. Name your space (e.g., `mall263-uploads`)
6. Enable CDN for faster delivery
7. Set file listing to **Private** (files will be public-read individually)

### 2. Generate API Keys
1. Go to **API** → **Spaces Keys**
2. Click **Generate New Key**
3. Name it (e.g., `mall263-backend`)
4. Save the **Access Key** and **Secret Key** securely

### 3. Configure Backend Environment Variables

Add these to your `backend/.env` file:

```env
# DigitalOcean Spaces Configuration
DO_SPACES_ENDPOINT=https://lon1.digitaloceanspaces.com
DO_SPACES_BUCKET=mall263-uploads
DO_SPACES_REGION=lon1
DO_SPACES_ACCESS_KEY=your_spaces_access_key_here
DO_SPACES_SECRET_KEY=your_spaces_secret_key_here
DO_SPACES_CDN_URL=https://mall263-uploads.lon1.cdn.digitaloceanspaces.com
```

**Important**: Replace the values with your actual credentials:
- `DO_SPACES_ACCESS_KEY`: Your Spaces access key
- `DO_SPACES_SECRET_KEY`: Your Spaces secret key
- `DO_SPACES_BUCKET`: Your space name
- `DO_SPACES_REGION`: Your chosen region (e.g., `lon1`, `nyc3`, `sgp1`)
- `DO_SPACES_CDN_URL`: Your CDN URL (found in Space settings)

### 4. CORS Configuration (Required for Frontend Uploads)

In your DigitalOcean Space settings:
1. Go to **Settings** → **CORS Configurations**
2. Add a CORS rule:

```json
{
  "AllowedOrigins": ["http://localhost:3000", "https://your-production-domain.com"],
  "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3000
}
```

## How It Works

### Upload Flow
1. User clicks "Add Image" button in inventory form
2. Device gallery/file picker opens
3. User selects one or more images (up to 5 total)
4. Frontend sends each image to `POST /api/v1/upload/image`
5. Backend validates, optimizes, and uploads to DO Spaces
6. Backend returns CDN URL and metadata
7. Frontend displays uploaded images with preview
8. On form submit, image URLs are saved with the product

### Image Storage Structure
```
mall263-uploads/
├── products/
│   ├── uuid-1.webp
│   ├── uuid-2.webp
│   └── ...
├── avatars/
│   └── ...
└── documents/
    └── ...
```

## Testing the Implementation

### 1. Start the Backend
```bash
cd backend
npm run dev
```

### 2. Start the Frontend
```bash
cd frontend
npm run dev
```

### 3. Test Image Upload
1. Navigate to `http://localhost:3000/inventory`
2. Click **Add Product**
3. Fill in product details
4. Click **Add Image** in the Product Images section
5. Select images from your device
6. Verify images upload and display
7. Try setting a different primary image
8. Try removing an image
9. Submit the form and verify product is created with images

### 4. Verify in DO Spaces
1. Log in to DigitalOcean
2. Navigate to your Space
3. Check the `products/` folder for uploaded images
4. Verify images are accessible via CDN URL

## Troubleshooting

### Images Not Uploading
- Check backend logs for errors
- Verify DO Spaces credentials in `.env`
- Ensure CORS is configured correctly
- Check network tab in browser DevTools

### 401 Unauthorized
- Verify `DO_SPACES_ACCESS_KEY` and `DO_SPACES_SECRET_KEY` are correct
- Ensure the API key has write permissions

### Images Not Displaying
- Check if CDN URL is correct
- Verify images are set to public-read
- Check browser console for CORS errors

### File Size Errors
- Images must be under 5MB
- Supported formats: JPEG, PNG, WebP, GIF
- Backend automatically optimizes images

## Security Notes

1. **Never commit `.env` files** - They contain sensitive credentials
2. **Use environment variables** - Keep credentials separate from code
3. **CDN URLs are public** - Anyone with the URL can access images
4. **Authentication required** - Upload endpoints require JWT authentication
5. **File validation** - Backend validates file types and sizes

## Production Deployment

When deploying to production:

1. Update `DO_SPACES_CDN_URL` with your production CDN URL
2. Add your production domain to CORS allowed origins
3. Ensure environment variables are set in your hosting platform
4. Test image uploads in production environment
5. Monitor storage usage in DigitalOcean dashboard

## Cost Considerations

DigitalOcean Spaces pricing (as of 2024):
- **Storage**: $5/month for 250GB
- **Bandwidth**: $0.01/GB after 1TB included
- **CDN**: Included with Spaces

For a typical mall with hundreds of products:
- Average: 5 images per product × 200KB per image = 1MB per product
- 1000 products = ~1GB storage
- Well within the $5/month tier
