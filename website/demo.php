<?php
// CONFIGURATION
$MAX_REPO_SIZE_KB = 5120; // 5MB

// DETECT BINARY LOCATION
// Priority 1: Local node_modules (if installed as dependency)
$localBin = realpath(__DIR__ . '/../node_modules/.bin/aics');
// Priority 2: Dist folder (if running from source repo)
$distBin = realpath(__DIR__ . '/../dist/index.js');

if ($localBin && file_exists($localBin)) {
    $target = $localBin;
} elseif ($distBin && file_exists($distBin)) {
    $target = $distBin;
} else {
    $target = 'aics'; // Hope it's global
}

// We wrap in 'node' to be safe against PATH issues with shebangs
$AICS_BIN = ($target === 'aics') ? 'aics' : 'node ' . escapeshellarg($target);

$TEMP_DIR = sys_get_temp_dir() . '/aics_demos';

// UTILS
function formatSize($kb) {
    if ($kb < 1024) return $kb . " KB";
    return round($kb / 1024, 2) . " MB";
}

function cleanUp($dir) {
    if (!is_dir($dir)) return;
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($files as $fileinfo) {
        $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
        $todo($fileinfo->getRealPath());
    }
    rmdir($dir);
}

$output = "";
$error = "";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 0. PRE-FLIGHT CHECK
    if (!function_exists('exec')) {
        $error = "SERVER CONFIG ERROR: 'exec()' is disabled on this server. Please enable it in Cloudways PHP Settings (remove from disable_functions).";
    } else {
        $repoUrl = trim($_POST['repo_url']);
        $user = null;
        $repo = null;

        // PARSE URL (HTTPS or SSH)
        if (preg_match('/^https:\/\/github\.com\/([a-zA-Z0-9-_\.]+)\/([a-zA-Z0-9-_\.]+?)(\.git)?$/', $repoUrl, $matches)) {
            $user = $matches[1];
            $repo = $matches[2];
        } elseif (preg_match('/^git@github\.com:([a-zA-Z0-9-_\.]+)\/([a-zA-Z0-9-_\.]+?)(\.git)?$/', $repoUrl, $matches)) {
            $user = $matches[1];
            $repo = $matches[2];
        }

        if (!$user || !$repo) {
            $error = "INVALID URL. Supported formats:\n- https://github.com/user/repo\n- https://github.com/user/repo.git\n- git@github.com:user/repo.git";
        } else {
            // FORCE HTTPS for API and Clone (Server likely has no SSH keys)
            $api_url = "https://api.github.com/repos/$user/$repo";
            $clone_url = "https://github.com/$user/$repo.git";

            // 2. CHECK SIZE via API
            $opts = [
                'http' => [
                    'method' => 'GET',
                    'header' => [
                        'User-Agent: AICS-Demo-Tool'
                    ]
                ]
            ];
            $context = stream_context_create($opts);
            $repoDataJson = @file_get_contents($api_url, false, $context);
            
            if ($repoDataJson === false) {
                $error = "Failed to fetch repo info. Is it public?";
            } else {
                $repoData = json_decode($repoDataJson, true);
                $sizeKB = $repoData['size'];

                if ($sizeKB > $MAX_REPO_SIZE_KB) {
                    $error = "REPO TOO LARGE. Size: " . formatSize($sizeKB) . ". Limit: 5MB.";
                } else {
                    // 3. PROCESS
                    $sessionID = uniqid('aics_', true);
                    $workDir = $TEMP_DIR . '/' . $sessionID;
                    
                    if (!mkdir($workDir, 0777, true)) {
                        $error = "Server Error: Cannot create temp dir.";
                    } else {
                        // CLONE (Timeout 45s) - Use forced HTTPS URL
                        $cmd_clone = "timeout 45s git clone --depth 1 " . escapeshellarg($clone_url) . " " . escapeshellarg($workDir) . " 2>&1";
                        exec($cmd_clone, $clone_output, $clone_ret);

                        if ($clone_ret !== 0) {
                            $error = "Clone Failed (or Timed Out): " . implode("\n", $clone_output);
                        } else {
                            // RUN AICS (Timeout 60s)
                            $outputFile = $workDir . "/.ai-index.md";
                            $cmd_aics = "timeout 60s $AICS_BIN gen -i " . escapeshellarg($workDir) . " -o " . escapeshellarg($outputFile) . " 2>&1";
                            
                            exec($cmd_aics, $aics_output, $aics_ret);

                            if ($aics_ret !== 0) {
                                $error = "AICS Generation Failed:\n" . implode("\n", $aics_output);
                            } elseif (file_exists($outputFile)) {
                                $output = file_get_contents($outputFile);
                            } else {
                                $error = "Unknown Error: Output file not created.";
                            }
                        }
                        // 4. CLEANUP
                        cleanUp($workDir);
                    }
                }
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>AICS | LIVE DEMO</title>
    <style>
        :root { --bg: #000000; --fg: #00ff00; --border: #008800; }
        body { background: var(--bg); color: var(--fg); font-family: "Courier New", monospace; padding: 20px; max-width: 800px; margin: 0 auto; }
        h1 { border: 4px double var(--border); text-align: center; padding: 10px; }
        .box { border: 1px solid var(--border); padding: 20px; margin: 20px 0; }
        input[type="text"] { background: #111; border: 1px solid var(--border); color: #fff; padding: 10px; width: 70%; font-family: inherit; }
        button { background: var(--border); color: #000; border: none; padding: 10px 20px; font-weight: bold; cursor: pointer; font-family: inherit; }
        button:hover { background: #00ff00; }
        pre { background: #111; border: 1px solid #333; padding: 10px; white-space: pre-wrap; overflow-x: auto; }
        .error { color: #ff0000; border: 1px solid #ff0000; padding: 10px; margin-bottom: 20px; }
        a { color: #00ffff; }
    </style>
</head>
<body>

<h1>AICS LIVE DEMO</h1>

<div style="text-align: center;">
    [ <a href="index.html">BACK TO HOME</a> ]
</div>

<div class="box">
    <h3>:: INITIATE SEQUENCE</h3>
    <form method="POST">
        <p>ENTER TARGET COORDINATES (GitHub URL):</p>
        <div style="display: flex; gap: 10px;">
            <input type="text" name="repo_url" placeholder="https://github.com/user/repo OR git@github.com:user/repo.git" required value="<?php echo isset($_POST['repo_url']) ? htmlspecialchars($_POST['repo_url']) : ''; ?>">
            <button type="submit">EXECUTE >></button>
        </div>
        <p style="font-size: 0.8em; color: #666;">LIMIT: 5MB REPO SIZE. PROTOCOL: DEEP SCAN.</p>
    </form>
</div>

<?php if ($error): ?>
    <div class="error">
        <strong>[CRITICAL ERROR]</strong><br>
        <?php echo nl2br(htmlspecialchars($error)); ?>
    </div>
<?php endif; ?>

<?php if ($output): ?>
    <div class="box">
        <h3>:: MISSION REPORT (.ai-index.md)</h3>
        <pre><?php echo htmlspecialchars($output); ?></pre>
    </div>
<?php endif; ?>

</body>
</html>
