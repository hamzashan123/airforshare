# AirShare Internal Web App

PHP + CSS + JavaScript internal AirForShare-style app.

## What changed

- Uses **Cloud Firestore**, not Realtime Database.
- Text is saved only when you click **Save Text**.
- Files are selected first and shared only when you click **Save Files**.
- Status shows `Saving...` while saving, then disappears after saved.
- Uploaded files are stored locally in `assets/uploads`.
- Firestore stores only the shared text and file metadata.

## Setup

1. Upload the folder to a PHP-enabled server.
2. Make `assets/uploads` writable by PHP.
3. In Firebase Console, enable **Cloud Firestore**.
4. Add the Firestore rules from the ChatGPT response or your own authenticated rules.

## Firestore paths used

- `internal_share/text`
- `internal_share/attachments/items/{fileId}`

## Important

This version does not use Firebase Realtime Database, so you do not need `databaseURL`.


Update: Upload progress bar added. It appears while attachments are uploading and hides after successful save.

- Text area auto expands based on content, without an internal scrollbar.
