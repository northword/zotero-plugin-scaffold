export function generateHtml(
  setupCode: string,
  testFiles: string[],
) {
  const tests = testFiles.map(f => `<script src="${f}"></script>`).join("\n    ");

  return `<!-- Generated by zotero-plugin-scaffold -->
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8"></meta>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"></meta>
    <title>Zotero Plugin Test</title>
    <style>
        html {
            min-width: 400px;
            min-height: 600px;
        }
        body {
            font-family: Arial, sans-serif;
        }
    </style>
</head>
<body>
    <div id="mocha"></div>

    <!-- Include Zotero Vars -->
    <script src="chrome://zotero/content/include.js"></script>

    <!-- Mocha and Chai Libraries -->
    <script src="mocha.js"></script>
    <script src="chai.js"></script>

    <!-- Setup Mocha -->
    <script>
      ${setupCode}
    </script>

    <!-- Unit tests -->
    ${tests}

    <!-- Run Mocha -->
    <script class="mocha-exec">
      mocha.run();
    </script>
</body>
</html>
`;
}
