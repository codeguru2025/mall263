# Quick Start: Image Uploads for Inventory

## What Was Implemented

✅ **Image Upload Component** (`ImageUpload.tsx`)
- Gallery picker for selecting images from device
- Upload multiple images (up to 5 per product)
- Set primary image
- Remove images
- Real-time upload progress

✅ **Inventory Integration**
- Image upload section in "Add Product" page
- Product images display in inventory listing
- Images stored in DigitalOcean Spaces
- Automatic WebP optimization

✅ **Backend Ready**
- Upload endpoints already exist
- S3-compatible DO Spaces integration
- Image optimization with Sharp
- CDN support

## Setup Steps (5 minutes)

### 1. Configure DigitalOcean Spaces

Edit `backend/.env` and add your DO Spaces credentials:

```env
DO_SPACES_ENDPOINT=https://lon1.digitaloceanspaces.com
DO_SPACES_BUCKET=mall263-uploads
DO_SPACES_REGION=lon1
DO_SPACES_ACCESS_KEY=your_actual_access_key
DO_SPACES_SECRET_KEY=your_actual_secret_key
DO_SPACES_CDN_URL=https://mall263-uploads.lon1.cdn.digitaloceanspaces.com
```

### 2. Start Development Servers

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 3. Test It Out

1. Open `http://localhost:3000/inventory`
2. Click **Add Product**
3. Fill in product details
4. Click **Add Image** button
5. Select images from your gallery
6. Watch them upload and display
7. Submit the form

## How Users Will Use It

1. **Add Product** → Navigate to inventory → Click "Add Product"
2. **Upload Images** → Click "Add Image" → Select from gallery
3. **Manage Images** → Set primary image, remove unwanted images
4. **Save Product** → Images are saved with the product
5. **View Products** → Images display in inventory listing

## File Structure

```
frontend/src/
├── components/
│   └── ImageUpload.tsx          # New upload component
└── app/inventory/
    ├── page.tsx                 # Updated with image display
    └── new/page.tsx             # Updated with image upload

backend/src/modules/upload/
├── upload.controller.ts         # Upload endpoints (existing)
├── upload.service.ts            # DO Spaces integration (existing)
└── upload.module.ts             # Module config (existing)
```

## API Endpoints Used

- `POST /api/v1/upload/image` - Upload single image
- `DELETE /api/v1/upload/:key` - Delete image
- `POST /api/v1/products` - Create product with images

## Image Processing

- **Input**: JPEG, PNG, WebP, GIF (max 5MB)
- **Output**: WebP format (optimized)
- **Max Width**: 1200px (maintains aspect ratio)
- **Quality**: 82%
- **Storage**: DigitalOcean Spaces with CDN

## Troubleshooting

**Images not uploading?**
- Check backend console for errors
- Verify DO Spaces credentials in `.env`
- Ensure backend is running on port 4000

**CORS errors?**
- Add CORS configuration in DO Spaces settings
- Allow origins: `http://localhost:3000`

**Images not displaying?**
- Check if `images` array is included in product API response
- Verify CDN URL is accessible

## Next Steps (Optional)

- [ ] Add image cropping/editing before upload
- [ ] Support drag-and-drop reordering
- [ ] Add image zoom/preview modal
- [ ] Implement lazy loading for images
- [ ] Add bulk image upload for multiple products

## Support

For detailed setup instructions, see `UPLOAD_SETUP.md`
