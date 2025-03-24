/* Virtual File System structure */
let fileSystem = {
    type: "folder",
    name: "workspace",
    id: generateId(),
    children: []
  };
  
  let currentFile = null;
  let editor = null;
  let draggedElementId = null;
  let currentPanel = "explorer"; // Default panel
  let errorsEnabled = true;      // Toggle for lint errors
  let pyodideLoaded = false;     // For Python execution
  
  /* --------------------------
     Helper Functions
  -------------------------- */
  function generateId() {
    return "id-" + Math.random().toString(36).substr(2, 9);
  }
  
  function saveFileSystem() {
    localStorage.setItem("xcode_fs", JSON.stringify(fileSystem));
  }
  
  function loadFileSystem() {
    const fs = localStorage.getItem("xcode_fs");
    if (fs) {
      fileSystem = JSON.parse(fs);
    } else {
      fileSystem.children.push({
        type: "file",
        name: "welcome.txt",
        content: "Welcome to X Code!\n\nTry commands like ls, cd, pwd, echo, mkdir, touch, rm, mv, or run a Python file with: python welcome.txt",
        id: generateId()
      });
      saveFileSystem();
    }
  }
  
  function findNode(currentNode, id) {
    if (currentNode.id === id) return currentNode;
    if (currentNode.type === "folder" && currentNode.children) {
      for (let child of currentNode.children) {
        let result = findNode(child, id);
        if (result) return result;
      }
    }
    return null;
  }
  
  function findNodeAndParent(currentNode, id, parent) {
    if (currentNode.id === id) return { node: currentNode, parent: parent };
    if (currentNode.type === "folder" && currentNode.children) {
      for (let child of currentNode.children) {
        let result = findNodeAndParent(child, id, currentNode);
        if (result) return result;
      }
    }
    return null;
  }
  
  /* --------------------------
     Render File Tree with Collapse/Expand
  -------------------------- */
  function renderFileTree() {
    const tree = document.getElementById("file-tree");
    tree.innerHTML = "";
    function renderNode(node, parentElement) {
      const li = document.createElement("li");
      li.dataset.id = node.id;
      li.dataset.type = node.type;
      
      if (node.type === "folder") {
        const toggle = document.createElement("span");
        toggle.className = "toggle-btn";
        toggle.textContent = node._collapsed ? "▶" : "▼";
        toggle.addEventListener("click", function(e) {
          e.stopPropagation();
          node._collapsed = !node._collapsed;
          renderFileTree();
        });
        li.appendChild(toggle);
      }
      
      const textSpan = document.createElement("span");
      textSpan.textContent = " " + node.name;
      li.appendChild(textSpan);
      
      li.draggable = true;
      
      li.addEventListener("click", function(e) {
        e.stopPropagation();
        clearSelection();
        li.classList.add("selected");
        if (node.type === "file") {
          currentFile = node;
          if (currentPanel === "explorer" || currentPanel === "search")
            openFile(node);
        } else {
          node._collapsed = !node._collapsed;
          renderFileTree();
        }
      });
      
      li.addEventListener("contextmenu", function(e) {
        e.preventDefault();
        clearSelection();
        li.classList.add("selected");
        showContextMenu(e.pageX, e.pageY, node);
      });
      
      li.addEventListener("dragstart", function(e) {
        draggedElementId = node.id;
        e.dataTransfer.setData("text/plain", node.id);
      });
      li.addEventListener("dragover", function(e) {
        e.preventDefault();
      });
      li.addEventListener("drop", function(e) {
        e.preventDefault();
        const targetId = node.id;
        if (draggedElementId && draggedElementId !== targetId) {
          moveNode(draggedElementId, targetId);
          saveFileSystem();
          renderFileTree();
        }
        draggedElementId = null;
      });
      
      parentElement.appendChild(li);
      
      if (node.type === "folder" && node.children && node.children.length > 0 && !node._collapsed) {
        const ul = document.createElement("ul");
        ul.style.paddingLeft = "15px";
        node.children.forEach(child => renderNode(child, ul));
        parentElement.appendChild(ul);
      }
    }
    renderNode(fileSystem, tree);
  }
  
  function clearSelection() {
    document.querySelectorAll("#file-tree li").forEach(li => li.classList.remove("selected"));
    hideContextMenu();
  }
  
  /* --------------------------
     Editor Functions
  -------------------------- */
  function openFile(file) {
    editor.setValue(file.content);
    updateStatus(`File "${file.name}" opened.`);
  }
  
  function updateCurrentFileContent() {
    if (currentFile) {
      currentFile.content = editor.getValue();
      saveFileSystem();
    }
  }
  
  /* --------------------------
     File/Folder Operations
  -------------------------- */
  function newFile() {
    let fileName = prompt("Enter new file name:");
    if (!fileName) return;
    let newFileObj = {
      type: "file",
      name: fileName,
      content: "",
      id: generateId()
    };
    const selected = document.querySelector("#file-tree li.selected");
    if (selected) {
      let parentNode = findNode(fileSystem, selected.dataset.id);
      if (parentNode.type === "folder") {
        parentNode.children = parentNode.children || [];
        parentNode.children.push(newFileObj);
      } else {
        let parentInfo = findNodeAndParent(fileSystem, selected.dataset.id, null);
        if (parentInfo && parentInfo.parent) {
          parentInfo.parent.children.push(newFileObj);
        } else {
          fileSystem.children.push(newFileObj);
        }
      }
    } else {
      fileSystem.children.push(newFileObj);
    }
    saveFileSystem();
    renderFileTree();
    updateStatus(`File "${fileName}" created.`);
  }
  
  function newFolder() {
    let folderName = prompt("Enter new folder name:");
    if (!folderName) return;
    let newFolderObj = {
      type: "folder",
      name: folderName,
      id: generateId(),
      children: []
    };
    const selected = document.querySelector("#file-tree li.selected");
    if (selected) {
      let parentNode = findNode(fileSystem, selected.dataset.id);
      if (parentNode.type === "folder") {
        parentNode.children = parentNode.children || [];
        parentNode.children.push(newFolderObj);
      } else {
        let parentInfo = findNodeAndParent(fileSystem, selected.dataset.id, null);
        if (parentInfo && parentInfo.parent) {
          parentInfo.parent.children.push(newFolderObj);
        } else {
          fileSystem.children.push(newFolderObj);
        }
      }
    } else {
      fileSystem.children.push(newFolderObj);
    }
    saveFileSystem();
    renderFileTree();
    updateStatus(`Folder "${folderName}" created.`);
  }
  
  function renameItem(id) {
    let node = findNode(fileSystem, id);
    if (!node) return;
    let newName = prompt("Enter new name:", node.name);
    if (!newName) return;
    node.name = newName;
    saveFileSystem();
    renderFileTree();
    updateStatus(`Renamed to "${newName}".`);
  }
  
  function deleteItem(id) {
    if (id === fileSystem.id) {
      alert("Cannot delete root.");
      return;
    }
    fileSystem = deleteNode(fileSystem, id, fileSystem);
    saveFileSystem();
    renderFileTree();
    editor.setValue("");
    updateStatus("Item deleted.");
  }
  
  function deleteNode(currentNode, id, parent) {
    if (currentNode.id === id) {
      if (parent) {
        parent.children = parent.children.filter(child => child.id !== id);
      }
      return currentNode;
    }
    if (currentNode.type === "folder" && currentNode.children) {
      currentNode.children.forEach(child => {
        deleteNode(child, id, currentNode);
      });
    }
    return currentNode;
  }
  
  function downloadItem(id) {
    let node = findNode(fileSystem, id);
    if (node.type === "file") {
      const blob = new Blob([node.content], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = node.name;
      a.click();
      updateStatus(`File "${node.name}" downloaded.`);
    } else {
      alert("Folder download is not supported.");
    }
  }
  
  function uploadFiles(files) {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const newFileObj = {
          type: "file",
          name: file.name,
          content: e.target.result,
          id: generateId()
        };
        fileSystem.children.push(newFileObj);
        saveFileSystem();
        renderFileTree();
        updateStatus(`File "${file.name}" uploaded.`);
      };
      reader.readAsText(file);
    });
  }
  
  /* --------------------------
     Drag & Drop
  -------------------------- */
  function moveNode(draggedId, targetId) {
    let draggedInfo = findNodeAndParent(fileSystem, draggedId, null);
    let targetNode = findNode(fileSystem, targetId);
    if (!draggedInfo || !targetNode) return;
    let { node: draggedNode, parent: draggedParent } = draggedInfo;
    if (targetNode.type === "folder") {
      if (draggedParent) {
        draggedParent.children = draggedParent.children.filter(child => child.id !== draggedId);
      }
      targetNode.children = targetNode.children || [];
      targetNode.children.push(draggedNode);
    } else {
      let targetInfo = findNodeAndParent(fileSystem, targetId, null);
      if (targetInfo && targetInfo.parent) {
        if (draggedParent) {
          draggedParent.children = draggedParent.children.filter(child => child.id !== draggedId);
        }
        targetInfo.parent.children.push(draggedNode);
      }
    }
  }
  
  /* --------------------------
     Context Menu
  -------------------------- */
  function showContextMenu(x, y, node) {
    const menu = document.getElementById("context-menu");
    menu.style.display = "block";
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    menu.dataset.nodeId = node.id;
  }
  
  function hideContextMenu() {
    const menu = document.getElementById("context-menu");
    menu.style.display = "none";
    menu.dataset.nodeId = "";
  }
  
  document.getElementById("context-rename").addEventListener("click", function() {
    const menu = document.getElementById("context-menu");
    const nodeId = menu.dataset.nodeId;
    if (!nodeId) return;
    renameItem(nodeId);
    hideContextMenu();
  });
  
  document.getElementById("context-delete").addEventListener("click", function() {
    const menu = document.getElementById("context-menu");
    const nodeId = menu.dataset.nodeId;
    if (!nodeId) return;
    deleteItem(nodeId);
    hideContextMenu();
  });
  
  document.getElementById("context-download").addEventListener("click", function() {
    const menu = document.getElementById("context-menu");
    const nodeId = menu.dataset.nodeId;
    if (!nodeId) return;
    downloadItem(nodeId);
    hideContextMenu();
  });
  
  /* --------------------------
     Search & Replace (Case-insensitive)
  -------------------------- */
  function showSearchBar() {
    const searchBar = document.getElementById("search-bar");
    searchBar.style.display = "flex";
    searchBar.addEventListener("click", e => e.stopPropagation());
    document.getElementById("search-input").focus();
  }
  
  function hideSearchBar() {
    document.getElementById("search-bar").style.display = "none";
  }
  
  document.getElementById("close-search-btn").addEventListener("click", hideSearchBar);
  
  document.getElementById("find-next-btn").addEventListener("click", function(){
    const query = document.getElementById("search-input").value;
    if(query) {
      let cursor = editor.getSearchCursor(query, editor.getCursor(), {caseFold: true});
      if(!cursor.findNext()){
        cursor = editor.getSearchCursor(query, {line: 0, ch: 0}, {caseFold: true});
        if(!cursor.findNext()){
          updateStatus("No match found.");
          return;
        }
      }
      editor.setSelection(cursor.from(), cursor.to());
      editor.scrollIntoView({ from: cursor.from(), to: cursor.to() });
      updateStatus("Match found.");
    }
  });
  
  document.getElementById("replace-btn").addEventListener("click", function(){
    const query = document.getElementById("search-input").value;
    const replaceText = document.getElementById("replace-input").value;
    if(query) {
      let cursor = editor.getSearchCursor(query, editor.getCursor(), {caseFold: true});
      if(!cursor.findNext()){
        cursor = editor.getSearchCursor(query, {line: 0, ch: 0}, {caseFold: true});
        if(!cursor.findNext()){
          updateStatus("No match found.");
          return;
        }
      }
      editor.replaceRange(replaceText, cursor.from(), cursor.to());
      updateCurrentFileContent();
      updateStatus("One occurrence replaced.");
    }
  });
  
  document.getElementById("replace-all-btn").addEventListener("click", function(){
    const query = document.getElementById("search-input").value;
    const replaceText = document.getElementById("replace-input").value;
    if(query) {
      let count = 0;
      editor.operation(function(){
        let cursor = editor.getSearchCursor(query, {line: 0, ch: 0}, {caseFold: true});
        while(cursor.findNext()){
           editor.replaceRange(replaceText, cursor.from(), cursor.to());
           count++;
        }
      });
      updateCurrentFileContent();
      updateStatus(count + " occurrence(s) replaced.");
    }
  });
  
  /* --------------------------
     Terminal Functionality
  -------------------------- */
  
  // تنظیمات ترمینال: پوشه جاری و مسیر
  let terminalCwd = fileSystem;           // پوشه جاری در ترمینال
  let terminalPath = [fileSystem];         // مسیر فعلی برای نمایش در prompt
  
  function getPrompt() {
    let pathStr = terminalPath.map(node => node.name).join("/");
    return `xcode:~/${pathStr}$`;
  }
  
  function appendToTerminalOutput(outputArea, text) {
    const line = document.createElement("div");
    line.className = "terminal-line";
    line.textContent = text;
    outputArea.appendChild(line);
    outputArea.scrollTop = outputArea.scrollHeight;
  }
  
  function showTerminalPanel() {
    const ep = document.getElementById("editor-panel");
    ep.innerHTML = "";
    
    // ایجاد container ترمینال
    const termContainer = document.createElement("div");
    termContainer.className = "terminal-container";
    
    // هدر ترمینال با عنوان و دکمه Back
    const header = document.createElement("div");
    header.className = "terminal-header";
    header.innerHTML = `<span>Terminal</span>`;
    const backBtn = document.createElement("button");
    backBtn.textContent = "Back";
    backBtn.className = "terminal-back-btn";
    backBtn.addEventListener("click", function(){
        switchPanel("explorer");
    });
    header.appendChild(backBtn);
    termContainer.appendChild(header);
    
    // ناحیه خروجی ترمینال
    const outputArea = document.createElement("div");
    outputArea.className = "terminal-output-area";
    termContainer.appendChild(outputArea);
    
    // ناحیه ورودی ترمینال
    const inputWrapper = document.createElement("div");
    inputWrapper.className = "terminal-input-wrapper";
    const promptSpan = document.createElement("span");
    promptSpan.className = "terminal-prompt";
    promptSpan.textContent = getPrompt();
    inputWrapper.appendChild(promptSpan);
    const inputField = document.createElement("input");
    inputField.type = "text";
    inputField.className = "terminal-input";
    inputField.autocomplete = "off";
    inputField.addEventListener("keydown", function(e) {
      if(e.key === "Enter") {
        const command = inputField.value;
        inputField.value = "";
        appendToTerminalOutput(outputArea, promptSpan.textContent + " " + command);
        processTerminalCommand(command, outputArea);
        promptSpan.textContent = getPrompt();
      }
    });
    inputWrapper.appendChild(inputField);
    termContainer.appendChild(inputWrapper);
    
    ep.appendChild(termContainer);
    inputField.focus();
  }
  
  async function processTerminalCommand(cmd, outputArea) {
    cmd = cmd.trim();
    if(cmd === "") return;
    
    const tokens = cmd.split(" ");
    const baseCmd = tokens[0];
    
    switch(baseCmd) {
      case "exit":
        switchPanel("explorer");
        break;
      case "ls":
        if(terminalCwd.children && terminalCwd.children.length > 0) {
          let listing = terminalCwd.children.map(child => child.name).join("  ");
          appendToTerminalOutput(outputArea, listing);
        } else {
          appendToTerminalOutput(outputArea, "");
        }
        break;
      case "pwd":
        appendToTerminalOutput(outputArea, "/" + terminalPath.map(node => node.name).join("/"));
        break;
      case "cd":
        if(tokens.length < 2) {
          terminalCwd = fileSystem;
          terminalPath = [fileSystem];
        } else {
          let target = tokens[1];
          if(target === "..") {
            if(terminalPath.length > 1) {
              terminalPath.pop();
              terminalCwd = terminalPath[terminalPath.length-1];
            }
          } else {
            if(terminalCwd.children) {
              const found = terminalCwd.children.find(child => child.name === target && child.type==="folder");
              if(found) {
                terminalCwd = found;
                terminalPath.push(found);
              } else {
                appendToTerminalOutput(outputArea, `cd: no such file or directory: ${target}`);
              }
            } else {
              appendToTerminalOutput(outputArea, `cd: no such file or directory: ${target}`);
            }
          }
        }
        break;
      case "mkdir":
        if(tokens.length < 2) {
          appendToTerminalOutput(outputArea, "mkdir: missing operand");
        } else {
          let folderName = tokens[1];
          if(terminalCwd.children.find(child => child.name === folderName)) {
            appendToTerminalOutput(outputArea, `mkdir: cannot create directory '${folderName}': File exists`);
          } else {
            let newFolderObj = { type: "folder", name: folderName, id: generateId(), children: [] };
            terminalCwd.children.push(newFolderObj);
            saveFileSystem();
          }
        }
        break;
      case "touch":
        if(tokens.length < 2) {
          appendToTerminalOutput(outputArea, "touch: missing file operand");
        } else {
          let fileName = tokens[1];
          if(terminalCwd.children.find(child => child.name === fileName)) {
            // به‌روزرسانی timestamp (در اینجا انجام نمی‌دهیم)
          } else {
            let newFileObj = { type: "file", name: fileName, content: "", id: generateId() };
            terminalCwd.children.push(newFileObj);
            saveFileSystem();
          }
        }
        break;
      case "rm":
        if(tokens.length < 2) {
          appendToTerminalOutput(outputArea, "rm: missing operand");
        } else {
          let targetName = tokens[1];
          const index = terminalCwd.children.findIndex(child => child.name === targetName);
          if(index >= 0) {
            terminalCwd.children.splice(index, 1);
            saveFileSystem();
          } else {
            appendToTerminalOutput(outputArea, `rm: cannot remove '${targetName}': No such file or directory`);
          }
        }
        break;
      case "mv":
        if(tokens.length < 3) {
          appendToTerminalOutput(outputArea, "mv: missing operand");
        } else {
          let oldName = tokens[1];
          let newName = tokens[2];
          let target = terminalCwd.children.find(child => child.name === oldName);
          if(target) {
            target.name = newName;
            saveFileSystem();
          } else {
            appendToTerminalOutput(outputArea, `mv: cannot stat '${oldName}': No such file or directory`);
          }
        }
        break;
      case "echo":
        let echoText = tokens.slice(1).join(" ");
        appendToTerminalOutput(outputArea, echoText);
        break;
      case "python":
        if(tokens.length < 2) {
          appendToTerminalOutput(outputArea, "python: missing operand");
        } else {
          let filename = tokens[1];
          let targetFile = terminalCwd.children.find(child => child.name === filename && child.type==="file");
          if(targetFile) {
            await runPythonInTerminal(targetFile, outputArea);
          } else {
            appendToTerminalOutput(outputArea, `python: can't open file '${filename}': No such file`);
          }
        }
        break;
      default:
        appendToTerminalOutput(outputArea, `${baseCmd}: command not found`);
    }
  }
  
  async function runPythonInTerminal(file, outputArea) {
    if (!pyodideLoaded) {
      appendToTerminalOutput(outputArea, "Installing Pyodide... 0%");
      let progress = 0;
      let interval = setInterval(() => {
        progress += 10;
        if(progress > 90) progress = 90;
        outputArea.lastChild.textContent = `Installing Pyodide... ${progress}%`;
      }, 200);
      window.pyodide = await loadPyodide();
      clearInterval(interval);
      pyodideLoaded = true;
      appendToTerminalOutput(outputArea, "Installing Pyodide... 100%");
    }
    try {
      // Override input to use window.prompt
      await pyodide.runPythonAsync(`
  import builtins
  def custom_input(prompt=""):
      from js import prompt
      return prompt(prompt)
  builtins.input = custom_input
      `);
      let code = `
  import io, sys
  _stdout = io.StringIO()
  sys.stdout = _stdout
  sys.stderr = _stdout
  try:
      exec(${JSON.stringify(file.content)})
  except Exception as e:
      print(e)
  _output = _stdout.getvalue()
  _output
  `;
      let result = await pyodide.runPythonAsync(code);
      appendToTerminalOutput(outputArea, result.trim() !== "" ? result : "No output.");
    } catch (err) {
      appendToTerminalOutput(outputArea, err.toString());
    }
  }
  
  // رویداد دکمه Terminal
  document.getElementById("terminal-btn").addEventListener("click", function(){
      showTerminalPanel();
  });
  
  /* --------------------------
     Run Preview (for HTML and Python files)
  -------------------------- */
  document.getElementById("run-preview-btn").addEventListener("click", async function(){
    if (!currentFile) {
      alert("No file selected for run.");
      return;
    }
    const ext = currentFile.name.split('.').pop().toLowerCase();
    if (ext === "html") {
      runHtmlPreview();
    } else if (ext === "py") {
      showTerminalPanel();
      const outputArea = document.querySelector(".terminal-output-area");
      appendToTerminalOutput(outputArea, "Running " + currentFile.name);
      await runPythonInTerminal(currentFile, outputArea);
    } else {
      showTerminalPanel();
      const outputArea = document.querySelector(".terminal-output-area");
      appendToTerminalOutput(outputArea, "Cannot run this file type.");
    }
  });
  
  function runHtmlPreview() {
    const ep = document.getElementById("editor-panel");
    ep.innerHTML = "";
    const backBtn = document.createElement("button");
    backBtn.textContent = "Back to Explorer";
    backBtn.className = "close-preview-btn";
    backBtn.addEventListener("click", function(){
      switchPanel("explorer");
    });
    const previewDiv = document.createElement("div");
    previewDiv.className = "mobile-preview";
    previewDiv.style.background = "#fff";
    const iframe = document.createElement("iframe");
    iframe.srcdoc = currentFile.content;
    previewDiv.appendChild(iframe);
    ep.appendChild(backBtn);
    ep.appendChild(previewDiv);
    updateStatus("HTML Preview loaded.");
  }
  
  /* --------------------------
     Panel Switching
  -------------------------- */
  function switchPanel(panel) {
    currentPanel = panel;
    const ep = document.getElementById("editor-panel");
    if (panel === "explorer" || panel === "search") {
      document.getElementById("explorer-panel").style.display = "flex";
      if (!ep.querySelector(".CodeMirror")) {
        ep.innerHTML = '<textarea id="code-editor"></textarea>';
        editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
          mode: "javascript",
          theme: "dracula",
          lineNumbers: true,
          tabSize: 2,
          indentWithTabs: true,
          extraKeys: { "Ctrl-Space": "autocomplete" },
          lint: errorsEnabled,
          gutters: ["CodeMirror-lint-markers"],
          lineWrapping: true
        });
        editor.on("change", function() {
          updateCurrentFileContent();
        });
      }
      if (panel === "search") {
        updateStatus("Search panel loaded.");
        showSearchBar();
      } else {
        updateStatus("Explorer panel loaded.");
      }
    } else if (panel === "source-control") {
      document.getElementById("explorer-panel").style.display = "none";
      showSourceControlPanel();
    } else if (panel === "server") {
      document.getElementById("explorer-panel").style.display = "none";
      showServerPanel();
    } else if(panel === "terminal") {
      showTerminalPanel();
    }
  }
  
  /* --------------------------
     Source Control Panel
  -------------------------- */
  function showSourceControlPanel() {
    const ep = document.getElementById("editor-panel");
    ep.innerHTML = "";
    const infoDiv = document.createElement("div");
    infoDiv.style.padding = "10px";
    infoDiv.style.background = "#1e1e1e";
    infoDiv.style.color = "#ccc";
    infoDiv.innerHTML = `Source Control is not fully integrated.<br>
    <button id="open-github-btn" class="sc-btn">Open GitHub</button>`;
    ep.appendChild(infoDiv);
    
    document.getElementById("open-github-btn").addEventListener("click", function(){
      window.open("https://github.com/search", "_blank");
    });
    
    updateStatus("Source Control panel loaded.");
  }
  
  /* --------------------------
     Server Panel
  -------------------------- */
  function showServerPanel() {
    const ep = document.getElementById("editor-panel");
    ep.innerHTML = "";
    // ایجاد انیمیشن اسپینر زیبا برای بارگذاری سرور
    const spinnerDiv = document.createElement("div");
    spinnerDiv.className = "spinner";
    spinnerDiv.innerHTML = `
      <div class="loader"></div>
      <div class="loading-text">
        Loading Server...
      </div>`;
    ep.appendChild(spinnerDiv);
    
    // بررسی اتصال به اینترنت (در اینجا نمونه‌ای ساده)
    fetch("https://www.google.com/", { mode: "no-cors" })
      .then(() => {
        setTimeout(() => {
          ep.innerHTML = "";
          const closeBtn = document.createElement("button");
          closeBtn.textContent = "Close Server";
          closeBtn.className = "sc-btn";
          closeBtn.style.margin = "10px";
          closeBtn.addEventListener("click", function(){
            switchPanel("explorer");
          });
          ep.appendChild(closeBtn);
          const iframe = document.createElement("iframe");
          iframe.src = "https://copy.sh/v86/"; // نمونه‌ای از شبیه‌ساز سرور
          iframe.style.width = "100%";
          iframe.style.height = "calc(100% - 40px)";
          iframe.style.border = "none";
          ep.appendChild(iframe);
          updateStatus("Server panel loaded.");
        }, 2000);
      })
      .catch(() => {
        ep.innerHTML = "";
        const errorDiv = document.createElement("div");
        errorDiv.className = "error-message";
        errorDiv.innerHTML = `
          <div class="error-icon">🚫</div>
          <div>No Internet Connection.<br>Please check your connection and try again.</div>`;
        ep.appendChild(errorDiv);
        updateStatus("Internet connection error.");
      });
  }
  
  /* --------------------------
     Activity Bar Event Bindings
  -------------------------- */
  document.querySelectorAll(".activity-bar li").forEach(li => {
    li.addEventListener("click", function() {
      document.querySelectorAll(".activity-bar li").forEach(item => item.classList.remove("active"));
      li.classList.add("active");
      const panel = li.dataset.panel;
      switchPanel(panel);
    });
  });
  
  /* --------------------------
     Initial Setup and Global Events
  -------------------------- */
  document.addEventListener("DOMContentLoaded", function() {
    loadFileSystem();
    renderFileTree();
  
    editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
      mode: "javascript",
      theme: "dracula",
      lineNumbers: true,
      tabSize: 2,
      indentWithTabs: true,
      extraKeys: { "Ctrl-Space": "autocomplete" },
      lint: errorsEnabled,
      gutters: ["CodeMirror-lint-markers"],
      lineWrapping: true
    });
    editor.on("change", function() {
      updateCurrentFileContent();
    });
  
    document.getElementById("new-file-btn").addEventListener("click", newFile);
    document.getElementById("new-folder-btn").addEventListener("click", newFolder);
  
    document.getElementById("open-btn").addEventListener("click", function(){
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.onchange = function(e) {
        uploadFiles(e.target.files);
      };
      input.click();
    });
  
    document.getElementById("upload-btn").addEventListener("click", function(){
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.onchange = function(e) {
        uploadFiles(e.target.files);
      };
      input.click();
    });
  
    document.getElementById("font-size-select").addEventListener("change", function(e) {
      let size = e.target.value;
      editor.getWrapperElement().style.fontSize = size;
      updateStatus("Font size changed to " + size + ".");
    });
  
    document.getElementById("rename-btn").addEventListener("click", function(){
      if (currentFile) {
        renameItem(currentFile.id);
      } else {
        alert("No file selected.");
      }
    });
  
    document.getElementById("delete-btn").addEventListener("click", function(){
      if (currentFile) {
        deleteItem(currentFile.id);
      } else {
        alert("No file selected.");
      }
    });
  
    document.getElementById("download-btn").addEventListener("click", function(){
      if (currentFile) {
        downloadItem(currentFile.id);
      } else {
        alert("No file selected.");
      }
    });
  
    document.getElementById("toggle-errors-btn").addEventListener("click", function(){
      errorsEnabled = !errorsEnabled;
      editor.setOption("lint", errorsEnabled);
      this.innerHTML = errorsEnabled
        ? `<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#ffcc00"/></svg>`
        : `<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#666"/></svg>`;
      updateStatus("Lint errors " + (errorsEnabled ? "enabled" : "disabled") + ".");
    });
    document.getElementById("toggle-errors-btn").innerHTML =
        `<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#ffcc00"/></svg>`;
  
    window.addEventListener("keydown", function(e) {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        updateCurrentFileContent();
        updateStatus("Changes saved.");
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "u") {
        if (currentFile) {
          let content = editor.getValue();
          let newContent = content.toUpperCase();
          editor.setValue(newContent);
          updateCurrentFileContent();
          updateStatus("Converted to uppercase.");
        }
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "l") {
        if (currentFile) {
          let content = editor.getValue();
          let newContent = content.toLowerCase();
          editor.setValue(newContent);
          updateCurrentFileContent();
          updateStatus("Converted to lowercase.");
        }
      }
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        showSearchBar();
      }
    });
  
    document.querySelector('[data-panel="search"]').addEventListener("click", function(){
      showSearchBar();
    });
  
    document.addEventListener("click", function() {
      hideContextMenu();
    });
  });
