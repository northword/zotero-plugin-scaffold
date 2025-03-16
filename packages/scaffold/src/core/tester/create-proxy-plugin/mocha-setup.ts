export function generateMochaSetup(options: {
  port: number;
  timeout: number;
  abortOnFail: boolean;
  exitOnFinish: boolean;
}) {
  return `// Generated by zotero-plugin-scaffold
mocha.setup({ 
  ui: "bdd",
  reporter: Reporter,
  timeout: ${options.timeout} || 10000,
  bail: ${options.abortOnFail}
});

window.expect = chai.expect;
window.assert = chai.assert;

async function send(data) {
  const req = await Zotero.HTTP.request(
    "POST",
    "http://localhost:${options.port}/update",
    {
      body: JSON.stringify(data),
    }
  );

  if (req.status !== 200) {
    dump("Error sending data to server" + req.responseText);
    return null;
  } else {
    const result = JSON.parse(req.responseText);
    return result;
  }
}

window.debug = function (data) {
  send({ type: "debug", data });
};

// Inherit the default test settings from Zotero
function Reporter(runner) {
  var indents = 0,
    passed = 0,
    failed = 0,
    aborted = false;

  function indent() {
    return "  ".repeat(indents);
  }

  function dump(str) {
    // const p = document.createElement("p")
    // p.textContent = str
    // document.querySelector("#mocha").append(p)
    document.querySelector("#mocha").innerText += str;
  }

  runner.on("start", async function () {
    console.log("start")
    await send({ type: "start" });
  });

  runner.on("suite", async function (suite) {
    console.log("suite", suite)
    indents++;
    const str = indent() + suite.title + "\\n";
    dump(str);
    await send({ type: "suite", data: { title: suite.title, root: suite.root } });
  });

  runner.on("suite end", async function (suite) {
    console.log("suite end", suite)
    indents--;
    const str = indents === 1 ? "\\n" : "";
    dump(str);
    await send({ type: "suite end", data: { title: suite.title, root: suite.root } });
  });

  runner.on("pending", async function (test) {
    console.log("pending", test)
    const str = indent() + "pending  -" + test.title + "\\n";
    dump(str);
    await send({ type: "pending", data: { title: test.title, fulltest: test.fullTitle(), duration: test.duration } });
  });

  runner.on("pass", async function (test) {
    console.log("pass", test)
    passed++;
    let str = indent() + Mocha.reporters.Base.symbols.ok + " " + test.title;
    if ("fast" != test.speed) {
      str += " (" + Math.round(test.duration) + " ms)";
    }
    str += "\\n";
    dump(str);
    await send({ type: "pass", data: { title: test.title, fulltest: test.fullTitle(), duration: test.duration } });

  });

  runner.on("fail", async function (test, error) {
    console.log("fail", test, error)

    // Make sure there's a blank line after all stack traces
    // err.stack = err.stack.replace(/\\s*$/, "\\n\\n");

    failed++;
    let indentStr = indent();
    const str =
      indentStr +
      // Dark red X for errors
      Mocha.reporters.Base.symbols.err +
      // Trigger bell if interactive
      (Zotero.automatedTest ? "" : "\\x07") +
      " " +
      test.title +
      "\\n" +
      indentStr +
      "  " +
      error.message +
      // " at\\n" +
      // err.stack.replace(/^/gm, indentStr + "    ").trim() +
      "\\n\\n";
    dump(str);

    await send({ type: "fail", data: { title: test.title, fulltest: test.fullTitle(), duration: test.duration, error } });

  });

  runner.on("end", async function () {
    console.log("end")
    const str =
      passed +
      "/" +
      (passed + failed) +
      " tests passed" +
      (aborted ? " -- aborting" : "") +
      "\\n";
    dump(str);

    await send({
      type: "end",
      data: { passed: passed, failed: failed, aborted: aborted, str },
    });

    // Must exit on Zotero side, otherwise the exit code will not be 0 and CI will fail
    if (${options.exitOnFinish ? "true" : "false"}) {
      Zotero.Utilities.Internal.quit(0);
    }
  });
}
`;
}

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
