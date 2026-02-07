<?php
// CONFIGURATION
$MAX_REPO_SIZE_KB = 5120; // 5MB

// DETECT BINARY LOCATION
// 1. Repo Dist (Preferred for source deploy)
$p1_dist = __DIR__ . '/../dist/index.js';
// 2. Repo Bin (Wrapper) - Only use if dist exists!
$p2_bin  = __DIR__ . '/../bin/aics.js';
// 3. Local Dependency (Root node_modules)
$p3_dep  = __DIR__ . '/../node_modules/aics-gen/dist/index.js';
// 4. Local Bin Link (Root node_modules)
$p4_link = __DIR__ . '/../node_modules/.bin/aics';
// 5. Website Dependency (Website node_modules)
$p5_web  = __DIR__ . '/node_modules/aics-gen/dist/index.js';

$target = null;
if (file_exists($p1_dist)) {
    $target = $p1_dist;
} elseif (file_exists($p3_dep)) {
    $target = $p3_dep;
} elseif (file_exists($p5_web)) {
    $target = $p5_web;
} elseif (file_exists($p4_link)) {
    $target = $p4_link; // Symlinks might point anywhere, risky but try
} elseif (file_exists($p2_bin) && file_exists($p1_dist)) {
    // Only use bin/aics.js if dist exists, otherwise it crashes
    $target = $p2_bin;
}

// Fallback to global if nothing found
if (!$target) {
    // Check if npx is available? 
    // Let's just try 'aics' global
    $target = 'aics';
} else {
    $target = realpath($target);
}

// Wrap in node if it's a file path
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
                            $debugInfo = "\n--- DEBUG INFO ---\n";
                            $debugInfo .= "CMD: $cmd_aics\n";
                            $debugInfo .= "BIN TARGET: $target\n";
                            $debugInfo .= "CHECKED PATHS:\n";
                            $debugInfo .= "1. Dist: $p1_dist (" . (file_exists($p1_dist) ? "FOUND" : "MISSING") . ")\n";
                            $debugInfo .= "2. Bin: $p2_bin (" . (file_exists($p2_bin) ? "FOUND" : "MISSING") . ")\n";
                            $debugInfo .= "3. Dep: $p3_dep (" . (file_exists($p3_dep) ? "FOUND" : "MISSING") . ")\n";
                            $debugInfo .= "4. Link: $p4_link (" . (file_exists($p4_link) ? "FOUND" : "MISSING") . ")\n";
                            $debugInfo .= "5. Web: $p5_web (" . (file_exists($p5_web) ? "FOUND" : "MISSING") . ")\n";
                            $debugInfo .= "CWD: " . getcwd() . "\n";
                            $debugInfo .= "DIR: " . __DIR__ . "\n";
                            $debugInfo .= "PHP USER: " . get_current_user() . "\n";
                            
                            $msg = "AICS Generation Failed:\n" . implode("\n", $aics_output);
                            if (!file_exists($p1_dist) && !file_exists($p3_dep) && $target === 'aics') {
                                $msg .= "\n\n[HINT] 'dist/index.js' is MISSING. Did you run `npm run build` locally and upload the 'dist' folder?";
                            }
                            $error = $msg . $debugInfo;
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
