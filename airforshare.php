<?php
require_once __DIR__ . '/auth.php';

// Internal AirForShare-style app
// 1) Put this folder on a PHP-enabled server.
// 2) Make assets/uploads writable by PHP.
// 3) Add your Firebase Realtime Database config inside assets/app.js.
$loginError = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action === 'login') {
        if (airforshare_attempt_login($_POST['email'] ?? '', $_POST['password'] ?? '')) {
            header('Location: ' . $_SERVER['PHP_SELF']);
            exit;
        }
        $loginError = 'Invalid email or password.';
    }

    if ($action === 'logout') {
        airforshare_logout();
        header('Location: ' . $_SERVER['PHP_SELF']);
        exit;
    }
}

$isAuthenticated = airforshare_is_authenticated();
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AirShare Internal</title>
  <link rel="stylesheet" href="assets/style.css" />
</head>
<body class="<?php echo $isAuthenticated ? '' : 'restricted-page'; ?>">
  <header class="topbar">
    <a class="brand" href="#" aria-label="AirShare Home">
      <span class="brand-mark">AS</span>
      <span class="brand-name"><span>airfor</span><strong>share</strong></span>
    </a>
    <nav>
      <a href="#text">Text</a>
      <a href="#files">Files</a>
      <a href="#">Feedback</a>
      <?php if ($isAuthenticated): ?>
        <form class="logout-form" method="post">
          <input type="hidden" name="action" value="logout" />
          <button class="login nav-button" type="submit">Logout</button>
        </form>
      <?php else: ?>
        <a class="login" href="#login">Internal Login</a>
      <?php endif; ?>
    </nav>
  </header>

  <main class="shell" <?php echo $isAuthenticated ? '' : 'aria-hidden="true"'; ?>>
    <aside class="side-nav" aria-label="Sections">
      <button class="side-icon active" data-tab="text" title="Text" aria-label="Open text panel">
        <span></span><span></span><span></span>
      </button>
      <button class="side-icon file-icon" data-tab="files" title="Files" aria-label="Open files panel">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 2h8l4 4v16H6V2Z" stroke="currentColor" stroke-width="1.6"/>
          <path d="M14 2v5h5" stroke="currentColor" stroke-width="1.6"/>
          <path d="M8.5 11h7M8.5 14h7M8.5 17h4" stroke="currentColor" stroke-width="1.4"/>
        </svg>
      </button>
    </aside>

    <section id="textPanel" class="panel active-panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Realtime Firebase</p>
          <h1>Text</h1>
        </div>
        <div class="status-stack">
          <span class="sync-pill">Live Sync</span>
          <div id="saveState" class="save-state">Ready</div>
        </div>
      </div>

      <textarea id="sharedText" placeholder="Type something..." spellcheck="true"></textarea>
      <div id="sharedTextPreview" class="text-thread" hidden></div>

      <div class="actions">
        <button id="saveTextBtn" class="btn">Save Text</button>
        <button id="copyBtn" class="btn secondary">Copy Text</button>
        <button id="clearTextBtn" class="btn danger">Clear Text</button>
      </div>
    </section>

    <section id="filesPanel" class="panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Local asset storage</p>
          <h1>Files</h1>
        </div>
        <div class="status-stack">
          <span class="sync-pill storage">Asset Vault</span>
          <button id="clearFilesBtn" class="btn danger small">Clear Attachments</button>
        </div>
      </div>

      <label id="dropzone" class="dropzone" for="fileInput">
        <input id="fileInput" type="file" multiple hidden />
        <div class="drop-content">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 16V4m0 0 4.5 4.5M12 4 7.5 8.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
          </svg>
          <strong>Drop files here to upload</strong>
          <span>Paste, drop, or browse files to upload instantly</span>
          <div class="drop-actions" aria-hidden="true">
            <span>Paste</span>
            <span>Drop</span>
            <span>Browse</span>
          </div>
        </div>
      </label>

      <div class="actions file-save-actions" hidden>
        <button id="saveFilesBtn" class="btn">Save Files</button>
      </div>
      <div id="selectedFiles" class="selected-files" hidden></div>
      <div id="uploadState" class="upload-state"></div>
      <div id="uploadProgress" class="upload-progress" hidden>
        <div class="upload-progress-bar" id="uploadProgressBar"></div>
      </div>
      <div id="fileList" class="file-list"></div>
    </section>
  </main>

  <div id="imageViewer" class="image-viewer" hidden aria-modal="true" role="dialog" aria-label="Image gallery">
    <button id="closeImageViewer" class="viewer-close" type="button" aria-label="Close image viewer">&times;</button>
    <button id="previousImage" class="viewer-nav previous" type="button" aria-label="Previous image">&lsaquo;</button>
    <figure class="viewer-frame">
      <img id="viewerImage" alt="" />
      <figcaption>
        <strong id="viewerImageName"></strong>
        <span id="viewerImageCount"></span>
      </figcaption>
    </figure>
    <button id="nextImage" class="viewer-nav next" type="button" aria-label="Next image">&rsaquo;</button>
  </div>

  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <?php if (!$isAuthenticated): ?>
    <div class="auth-overlay" id="login">
      <form class="auth-card" method="post" autocomplete="on">
        <input type="hidden" name="action" value="login" />
        <span class="auth-mark">AS</span>
        <p class="eyebrow">Restricted Workspace</p>
        <h2>Sign in to AirForShare</h2>
        <p class="auth-copy">Use your internal email and password to open the realtime text and file share.</p>
        <?php if ($loginError): ?>
          <div class="auth-error" role="alert"><?php echo htmlspecialchars($loginError, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>
        <label>
          <span>Email</span>
          <input type="email" name="email" placeholder="admin@airforshare.local" required autofocus />
        </label>
        <label>
          <span>Password</span>
          <input type="password" name="password" placeholder="Enter password" required />
        </label>
        <button class="btn auth-submit" type="submit">Login</button>
      </form>
    </div>
  <?php else: ?>
    <script type="module" src="assets/app.js"></script>
  <?php endif; ?>
</body>
</html>
