import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD2C-FbviUciXjiFTQQ1yhPt1g8Fptnfgg",
  authDomain: "airforshare-b2066.firebaseapp.com",
  projectId: "airforshare-b2066",
  storageBucket: "airforshare-b2066.firebasestorage.app",
  messagingSenderId: "764213503496",
  appId: "1:764213503496:web:e50e1dd4120dd1af8813bd"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const textDocRef = doc(db, "internal_share", "text");
const filesColRef = collection(db, "internal_share", "attachments", "items");

const $ = (selector) => document.querySelector(selector);
const textArea = $("#sharedText");
const textPreview = $("#sharedTextPreview");
const saveTextBtn = $("#saveTextBtn");
const saveState = $("#saveState");
const copyBtn = $("#copyBtn");
const clearTextBtn = $("#clearTextBtn");
const filesPanel = $("#filesPanel");
const fileInput = $("#fileInput");
const dropzone = $("#dropzone");
const saveFilesBtn = $("#saveFilesBtn");
const selectedFiles = $("#selectedFiles");
const uploadState = $("#uploadState");
const uploadProgress = $("#uploadProgress");
const uploadProgressBar = $("#uploadProgressBar");
const fileList = $("#fileList");
const clearFilesBtn = $("#clearFilesBtn");
const imageViewer = $("#imageViewer");
const viewerImage = $("#viewerImage");
const viewerImageName = $("#viewerImageName");
const viewerImageCount = $("#viewerImageCount");
const closeImageViewer = $("#closeImageViewer");
const previousImage = $("#previousImage");
const nextImage = $("#nextImage");
const toast = $("#toast");

let isSavingText = false;
let isUploading = false;
let pendingFiles = [];
let imageGallery = [];
let activeImageIndex = -1;
const renderedFiles = new Map();

function autoGrowTextArea() {
  textArea.style.height = "auto";
  textArea.style.height = `${textArea.scrollHeight}px`;
}

textArea.addEventListener("input", () => {
  autoGrowTextArea();
  renderLinkifiedText(textArea.value);
});
window.addEventListener("resize", autoGrowTextArea);

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function setStatus(message = "", className = "") {
  saveState.textContent = message;
  saveState.className = `save-state ${className}`.trim();
}

function hideStatusSoon() {
  setTimeout(() => setStatus(""), 900);
}

function stripTrailingPunctuation(value) {
  let clean = value;
  let trailing = "";
  while (/[.,!?;:]$/.test(clean)) {
    trailing = clean.slice(-1) + trailing;
    clean = clean.slice(0, -1);
  }
  return { clean, trailing };
}

function getLinkInfo(value) {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { href: `mailto:${value}`, label: value, className: "email-link" };
  }

  if (/^(https?:\/\/|www\.|[a-z0-9.-]+\.[a-z]{2,}(?:\/|$))/i.test(value)) {
    const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return { href, label: value, className: "url-link", external: true };
  }

  const phoneDigits = value.replace(/[^\d+]/g, "");
  if (phoneDigits.replace(/\D/g, "").length >= 7) {
    return { href: `tel:${phoneDigits}`, label: value, className: "phone-link" };
  }

  return null;
}

function appendLinkedToken(container, token) {
  const { clean, trailing } = stripTrailingPunctuation(token);
  const linkInfo = getLinkInfo(clean);

  if (!linkInfo) {
    container.append(document.createTextNode(token));
    return;
  }

  const link = document.createElement("a");
  link.href = linkInfo.href;
  link.textContent = linkInfo.label;
  link.className = linkInfo.className;
  if (linkInfo.external) {
    link.target = "_blank";
    link.rel = "noopener";
  }

  container.append(link);
  if (trailing) container.append(document.createTextNode(trailing));
}

function renderLinkifiedText(text = "") {
  const value = String(text);
  textPreview.replaceChildren();
  textPreview.hidden = !value.trim();
  if (textPreview.hidden) return;

  const tokenPattern = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+[^\s<>"']*|\+?\d[\d\s().-]{6,}\d)/g;
  let cursor = 0;
  let match;

  while ((match = tokenPattern.exec(value)) !== null) {
    if (match.index > cursor) {
      textPreview.append(document.createTextNode(value.slice(cursor, match.index)));
    }
    appendLinkedToken(textPreview, match[0]);
    cursor = match.index + match[0].length;
  }

  if (cursor < value.length) {
    textPreview.append(document.createTextNode(value.slice(cursor)));
  }
}

function setUploadStatus(message = "", className = "") {
  uploadState.textContent = message;
  uploadState.className = `upload-state ${className}`.trim();
}

function setUploadProgress(percent = 0, visible = true) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  uploadProgress.hidden = !visible;
  uploadProgressBar.style.width = `${safePercent}%`;
}

function hideUploadProgressSoon() {
  setTimeout(() => {
    setUploadStatus("");
    setUploadProgress(0, false);
  }, 900);
}

function bytesToSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function getFileExtension(name = "") {
  const cleanName = String(name).split("?")[0];
  const parts = cleanName.split(".");
  return parts.length > 1 ? parts.pop().toUpperCase().slice(0, 8) : "FILE";
}

function isImageFile(file = {}) {
  const type = file.type || "";
  const name = file.name || file.original_name || "";
  return type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(name);
}

function getExtensionFromMime(type = "") {
  const subtype = String(type).split("/")[1] || "bin";
  const extension = subtype.split(/[;+]/)[0].replace(/^jpeg$/i, "jpg").replace(/[^a-z0-9]/gi, "");
  return extension.slice(0, 8) || "bin";
}

function normalizeIncomingFile(file, fallbackPrefix, index) {
  if (!file) return null;
  if (file.name) return file;

  const extension = getExtensionFromMime(file.type);
  const name = `${fallbackPrefix}-${Date.now()}-${index + 1}.${extension}`;
  return new File([file], name, {
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified || Date.now()
  });
}

function normalizeIncomingFiles(files, fallbackPrefix = "file") {
  return [...(files || [])]
    .map((file, index) => normalizeIncomingFile(file, fallbackPrefix, index))
    .filter(Boolean);
}

function getFilesFromDataTransfer(dataTransfer, fallbackPrefix = "file") {
  if (!dataTransfer) return [];

  const itemFiles = [...(dataTransfer.items || [])]
    .filter((item) => item.kind === "file")
    .map((item, index) => normalizeIncomingFile(item.getAsFile(), fallbackPrefix, index))
    .filter(Boolean);

  if (itemFiles.length) return itemFiles;
  return normalizeIncomingFiles(dataTransfer.files, fallbackPrefix);
}

function hasDataTransferFiles(dataTransfer) {
  return [...(dataTransfer?.types || [])].includes("Files");
}

function createAttachmentPreview(file, url) {
  const preview = document.createElement("div");
  preview.className = "attachment-preview";

  if (isImageFile(file) && url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = file.name || "Attachment preview";
    img.loading = "lazy";
    preview.classList.add("image-preview");
    preview.appendChild(img);
    return preview;
  }

  preview.classList.add("doc-preview");
  preview.textContent = getFileExtension(file.name);
  return preview;
}

function iconTab(tabName) {
  document.querySelectorAll(".side-icon").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabName));
  $("#textPanel").classList.toggle("active-panel", tabName === "text");
  filesPanel.classList.toggle("active-panel", tabName === "files");
}

document.querySelectorAll(".side-icon").forEach((btn) => {
  btn.addEventListener("click", () => iconTab(btn.dataset.tab));
});

document.querySelectorAll('a[href="#text"], a[href="#files"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    iconTab(link.getAttribute("href").slice(1));
  });
});

// Firestore listener only reflects saved text from other users/devices.
onSnapshot(textDocRef, (snapshot) => {
  if (isSavingText) return;
  const data = snapshot.data();
  textArea.value = data?.value || "";
  renderLinkifiedText(textArea.value);
  requestAnimationFrame(autoGrowTextArea);
}, (error) => {
  console.error(error);
  setStatus("Firebase error", "error");
});

async function saveSharedText() {
  if (isSavingText) return;
  isSavingText = true;
  saveTextBtn.disabled = true;
  setStatus("Saving...", "saving");

  try {
    await setDoc(textDocRef, {
      value: textArea.value,
      updatedAt: serverTimestamp()
    }, { merge: true });
    setStatus("Saved", "saved");
    hideStatusSoon();
  } catch (error) {
    console.error(error);
    setStatus("Save failed", "error");
    showToast(error.message || "Save failed");
  } finally {
    isSavingText = false;
    saveTextBtn.disabled = false;
  }
}

saveTextBtn.addEventListener("click", saveSharedText);

document.addEventListener("keydown", (event) => {
  const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
  if (!isSaveShortcut) return;

  event.preventDefault();
  saveSharedText();
});

copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(textArea.value || "");
  showToast("Text copied to clipboard");
});

clearTextBtn.addEventListener("click", async () => {
  if (!confirm("Clear shared text for everyone?")) return;
  clearTextBtn.disabled = true;
  setStatus("Clearing...", "saving");
  try {
    await setDoc(textDocRef, { value: "", updatedAt: serverTimestamp() }, { merge: true });
    textArea.value = "";
    renderLinkifiedText("");
    autoGrowTextArea();
    setStatus("Cleared", "saved");
    hideStatusSoon();
    showToast("Text removed from Firebase");
  } catch (error) {
    console.error(error);
    setStatus("Clear failed", "error");
  } finally {
    clearTextBtn.disabled = false;
  }
});

requestAnimationFrame(autoGrowTextArea);

function setPendingFiles(files) {
  pendingFiles = files;
  if (!pendingFiles.length) {
    selectedFiles.innerHTML = "";
    return;
  }

  selectedFiles.innerHTML = `
    <strong>${pendingFiles.length} selected file${pendingFiles.length > 1 ? "s" : ""}</strong>
    <div class="selected-file-grid"></div>
  `;

  const grid = selectedFiles.querySelector(".selected-file-grid");
  pendingFiles.forEach((file) => {
    const item = document.createElement("div");
    item.className = "selected-file-item";

    const previewUrl = isImageFile(file) ? URL.createObjectURL(file) : "";
    const preview = createAttachmentPreview(file, previewUrl);
    if (previewUrl) {
      preview.querySelector("img")?.addEventListener("load", () => URL.revokeObjectURL(previewUrl), { once: true });
    }

    const details = document.createElement("div");
    details.className = "selected-file-details";
    const fileName = document.createElement("span");
    fileName.className = "selected-file-name";
    fileName.textContent = file.name;
    const fileMeta = document.createElement("small");
    fileMeta.textContent = `${getFileExtension(file.name)} | ${bytesToSize(file.size)}`;
    details.append(fileName, fileMeta);

    item.append(preview, details);
    grid.appendChild(item);
  });
}

function uploadFileWithProgress(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.open("POST", "upload.php");

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress((event.loaded / event.total) * 100);
    });

    xhr.addEventListener("load", () => {
      try {
        const result = JSON.parse(xhr.responseText || "{}");
        if (xhr.status < 200 || xhr.status >= 300 || !result.success) {
          reject(new Error(result.message || "Upload failed"));
          return;
        }
        onProgress(100);
        resolve(result);
      } catch (error) {
        reject(new Error("Upload response was invalid"));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network upload failed")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));
    xhr.send(formData);
  });
}

async function uploadFiles(files) {
  const filesToUpload = normalizeIncomingFiles(files);
  if (!filesToUpload.length) return;
  if (isUploading) {
    showToast("Upload already in progress");
    return;
  }

  isUploading = true;
  saveFilesBtn.disabled = true;
  fileInput.disabled = true;
  dropzone.classList.add("disabled");
  setUploadStatus(`Uploading 0 of ${filesToUpload.length} files...`, "saving");
  setUploadProgress(0, true);

  let uploadedCount = 0;
  let failedCount = 0;

  for (const file of filesToUpload) {
    try {
      setUploadStatus(`Uploading ${uploadedCount + 1} of ${filesToUpload.length}: ${file.name}`, "saving");

      const result = await uploadFileWithProgress(file, (filePercent) => {
        const overallPercent = ((uploadedCount + (filePercent / 100)) / filesToUpload.length) * 100;
        setUploadProgress(overallPercent, true);
      });

      await addDoc(filesColRef, {
        name: result.original_name,
        savedName: result.saved_name,
        url: result.url,
        path: result.path,
        size: result.size,
        type: result.type,
        uploadedAt: serverTimestamp()
      });

      uploadedCount += 1;
      setUploadProgress((uploadedCount / filesToUpload.length) * 100, true);
    } catch (error) {
      failedCount += 1;
      uploadedCount += 1;
      console.error(error);
      showToast(`${file.name}: ${error.message || "Upload failed"}`);
      setUploadProgress((uploadedCount / filesToUpload.length) * 100, true);
    }
  }

  if (failedCount) {
    setUploadStatus(`${filesToUpload.length - failedCount} saved, ${failedCount} failed`, "error");
  } else {
    setUploadStatus("Saved", "saved");
    fileInput.value = "";
    setPendingFiles([]);
    hideUploadProgressSoon();
  }

  saveFilesBtn.disabled = false;
  fileInput.disabled = false;
  dropzone.classList.remove("disabled", "dragover");
  isUploading = false;
}

function uploadIncomingFiles(files, fallbackPrefix) {
  const incomingFiles = normalizeIncomingFiles(files, fallbackPrefix);
  if (!incomingFiles.length) return;
  if (isUploading) {
    showToast("Upload already in progress");
    return;
  }
  setPendingFiles([]);
  uploadFiles(incomingFiles);
}

fileInput.addEventListener("change", (event) => {
  iconTab("files");
  uploadIncomingFiles(event.target.files, "selected-file");
});
["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (!hasDataTransferFiles(event.dataTransfer)) return;
    dropzone.classList.add("dragover");
  });
});
["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
  });
});
dropzone.addEventListener("drop", (event) => {
  uploadIncomingFiles(getFilesFromDataTransfer(event.dataTransfer, "dropped-file"), "dropped-file");
});

document.addEventListener("dragover", (event) => {
  if (!hasDataTransferFiles(event.dataTransfer)) return;
  event.preventDefault();
});

document.addEventListener("drop", (event) => {
  if (!hasDataTransferFiles(event.dataTransfer) || event.defaultPrevented) return;
  event.preventDefault();
  iconTab("files");
  uploadIncomingFiles(getFilesFromDataTransfer(event.dataTransfer, "dropped-file"), "dropped-file");
});

document.addEventListener("paste", (event) => {
  const pastedFiles = getFilesFromDataTransfer(event.clipboardData, "pasted-file");
  if (!pastedFiles.length) return;
  event.preventDefault();
  iconTab("files");
  uploadIncomingFiles(pastedFiles, "pasted-file");
});
saveFilesBtn.addEventListener("click", () => uploadFiles(pendingFiles));

function renderEmptyState() {
  if (!fileList.children.length) {
    fileList.innerHTML = `<div class="empty">No saved attachments yet. Select files, then click Save Files.</div>`;
  }
}

function removeEmptyState() {
  const empty = fileList.querySelector(".empty");
  if (empty) empty.remove();
}

function renderImageViewer() {
  const image = imageGallery[activeImageIndex];
  if (!image) {
    closeViewer();
    return;
  }

  viewerImage.src = image.url;
  viewerImage.alt = image.name || "Uploaded image";
  viewerImageName.textContent = image.name || "Uploaded image";
  viewerImageCount.textContent = `${activeImageIndex + 1} of ${imageGallery.length}`;
  previousImage.disabled = imageGallery.length < 2;
  nextImage.disabled = imageGallery.length < 2;
}

function openImageViewerById(id) {
  const imageIndex = imageGallery.findIndex((image) => image.id === id);
  if (imageIndex === -1) return;

  activeImageIndex = imageIndex;
  imageViewer.hidden = false;
  document.body.classList.add("viewer-open");
  renderImageViewer();
  closeImageViewer.focus();
}

function closeViewer() {
  activeImageIndex = -1;
  imageViewer.hidden = true;
  document.body.classList.remove("viewer-open");
  viewerImage.removeAttribute("src");
  viewerImage.alt = "";
  viewerImageName.textContent = "";
  viewerImageCount.textContent = "";
}

function showAdjacentImage(direction) {
  if (!imageGallery.length) return;
  activeImageIndex = (activeImageIndex + direction + imageGallery.length) % imageGallery.length;
  renderImageViewer();
}

function syncImageGallery(docs) {
  const activeImageId = imageGallery[activeImageIndex]?.id;
  imageGallery = docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((file) => isImageFile(file) && file.url);

  if (imageViewer.hidden) return;
  if (!imageGallery.length) {
    closeViewer();
    return;
  }

  const nextIndex = imageGallery.findIndex((image) => image.id === activeImageId);
  activeImageIndex = nextIndex === -1 ? Math.min(activeImageIndex, imageGallery.length - 1) : nextIndex;
  renderImageViewer();
}

function renderFile(id, file) {
  removeEmptyState();
  const existing = renderedFiles.get(id);
  if (existing) existing.remove();

  const card = document.createElement("div");
  card.className = "file-card";
  card.dataset.id = id;

  const preview = createAttachmentPreview(file, file.url);
  if (isImageFile(file) && file.url) {
    preview.classList.add("zoomable");
    preview.tabIndex = 0;
    preview.setAttribute("role", "button");
    preview.setAttribute("aria-label", `View ${file.name || "uploaded image"}`);
    preview.addEventListener("click", () => openImageViewerById(id));
    preview.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openImageViewerById(id);
    });
  }

  const details = document.createElement("div");
  details.className = "file-details";
  const fileName = document.createElement("div");
  fileName.className = "file-name";
  fileName.textContent = file.name;
  const fileMeta = document.createElement("div");
  fileMeta.className = "file-meta";
  fileMeta.textContent = `${getFileExtension(file.name)} | ${bytesToSize(file.size)} | ${file.type || "file"}`;
  details.append(fileName, fileMeta);

  const actions = document.createElement("div");
  actions.className = "file-actions";
  actions.innerHTML = `
    <a href="${file.url}" target="_blank" rel="noopener">Open</a>
    <a href="${file.url}" download>Download</a>
    <button type="button">Delete</button>
  `;
  actions.querySelector("button").addEventListener("click", () => deleteFile(id, file));

  card.append(preview, details, actions);
  fileList.prepend(card);
  renderedFiles.set(id, card);
}

async function deleteFile(id, file) {
  if (!confirm(`Delete ${file.name}?`)) return;
  const formData = new FormData();
  formData.append("saved_name", file.savedName || "");
  formData.append("path", file.path || "");

  const response = await fetch("delete_attachment.php", { method: "POST", body: formData });
  const result = await response.json();
  if (!result.success) {
    showToast(result.message || "Delete failed");
    return;
  }
  await deleteDoc(doc(db, "internal_share", "attachments", "items", id));
  showToast("Attachment removed");
}

closeImageViewer.addEventListener("click", closeViewer);
previousImage.addEventListener("click", () => showAdjacentImage(-1));
nextImage.addEventListener("click", () => showAdjacentImage(1));
imageViewer.addEventListener("click", (event) => {
  if (event.target === imageViewer) closeViewer();
});

document.addEventListener("keydown", (event) => {
  if (imageViewer.hidden) return;
  if (event.key === "Escape") closeViewer();
  if (event.key === "ArrowLeft") showAdjacentImage(-1);
  if (event.key === "ArrowRight") showAdjacentImage(1);
});

onSnapshot(query(filesColRef, orderBy("uploadedAt", "desc")), (snapshot) => {
  if (snapshot.empty) {
    fileList.innerHTML = "";
    renderedFiles.clear();
    syncImageGallery([]);
    renderEmptyState();
    return;
  }

  syncImageGallery(snapshot.docs);
  snapshot.docChanges().forEach((change) => {
    const id = change.doc.id;
    if (change.type === "removed") {
      const card = renderedFiles.get(id);
      if (card) card.remove();
      renderedFiles.delete(id);
      renderEmptyState();
    } else {
      renderFile(id, change.doc.data());
    }
  });
}, (error) => {
  console.error(error);
  setUploadStatus("Firebase error", "error");
});

clearFilesBtn.addEventListener("click", async () => {
  if (!confirm("Delete all attachments from the assets folder and Firebase?")) return;
  clearFilesBtn.disabled = true;
  setUploadStatus("Clearing...", "saving");
  setUploadProgress(0, false);

  try {
    const snapshot = await getDocs(filesColRef);
    const files = snapshot.docs.map(docSnap => docSnap.data());

    const response = await fetch("clear_attachments.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files })
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.message || "Clear failed");

    await Promise.all(snapshot.docs.map(docSnap => deleteDoc(docSnap.ref)));
    setUploadStatus("Cleared", "saved");
    hideUploadProgressSoon();
    showToast("All attachments removed");
  } catch (error) {
    console.error(error);
    setUploadStatus("Clear failed", "error");
    showToast(error.message || "Clear failed");
  } finally {
    clearFilesBtn.disabled = false;
  }
});
