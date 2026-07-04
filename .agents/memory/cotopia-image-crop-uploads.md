---
name: Cotopia image crop-before-upload pattern
description: All image upload flows in Cotopia normalize dimensions via ImageCropModal before upload, not just profile avatar/banner
---

Every image upload entry point in the Cotopia frontend (song cover, video thumbnail, label logo/banner, company post image, playlist cover, plus the original profile avatar/banner) routes the selected file through `ImageCropModal` (`artifacts/cotopia/src/components/image-crop-modal.tsx`) before calling the existing `useUpload().uploadFile`, instead of uploading the raw file directly.

**Why:** display containers already used `object-cover`/`object-contain` with fixed aspect ratios, but raw uploads of arbitrary dimensions still produced inconsistent framing/cropping baked into the stored image. Cropping client-side to the field's real aspect ratio (1:1 for covers/logos/playlist art, 16:9 for thumbnails, ~3:1 for label banners) makes stored images consistent regardless of what the user uploads.

**How to apply:** when adding a new image upload field, don't call `uploadFile(file)` directly from the `<input type="file">` onChange. Instead: set `URL.createObjectURL(file)` into a `cropUrl` state, render `<ImageCropModal imageUrl={cropUrl} aspectRatio={...} onConfirm={blob => uploadFile(new File([blob], name, {type: "image/jpeg"}))} onCancel={...} />` conditionally, and revoke the object URL on cancel/confirm. Match `aspectRatio`/`outputSize` to how the image is actually displayed elsewhere in the app.
